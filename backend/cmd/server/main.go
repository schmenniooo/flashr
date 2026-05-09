package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/internal/billing"
	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/internal/upload"
	"github.com/smithlabs/flashr/backend/pkg/config"
	"github.com/smithlabs/flashr/backend/pkg/db"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()
	log.Printf("postgres: connected")

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("postgres: migrate: %v", err)
	}
	log.Printf("postgres: migrations up to date")

	authSvc, err := auth.NewService(pool, auth.Config{
		Secret:             cfg.JWTSecret,
		GoogleClientID:     cfg.GoogleClientID,
		GoogleClientSecret: cfg.GoogleClientSecret,
		GoogleRedirectURL:  cfg.BackendURL + "/api/auth/google/callback",
		GithubClientID:     cfg.GithubClientID,
		GithubClientSecret: cfg.GithubClientSecret,
		GithubRedirectURL:  cfg.BackendURL + "/api/auth/github/callback",
		FrontendURL:        cfg.FrontendURL,
	})
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	if cfg.OllamaURL != "" {
		if err := pingOllama(cfg.OllamaURL); err != nil {
			log.Printf("ollama: not reachable at %s: %v", cfg.OllamaURL, err)
		} else {
			log.Printf("ollama: reachable at %s", cfg.OllamaURL)
		}
	}

	r := gin.Default()
	r.Use(corsMiddleware(cfg.AllowedOrigins))

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		dbStatus := "up"
		if err := pool.Ping(c.Request.Context()); err != nil {
			dbStatus = "down: " + err.Error()
		}
		ollamaStatus := "disabled"
		if cfg.OllamaURL != "" {
			if err := pingOllama(cfg.OllamaURL); err != nil {
				ollamaStatus = "down: " + err.Error()
			} else {
				ollamaStatus = "up"
			}
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "postgres": dbStatus, "ollama": ollamaStatus})
	})

	// Route groups with per-group request timeouts.
	// Auth + collections: 15 s is generous for DB-only work.
	// Billing: 30 s allows for Stripe API latency.
	// AI: no deadline here — the Ollama client enforces a 2-minute HTTP timeout.
	authSvc.RegisterRoutes(api.Group("/auth", timeoutMiddleware(15*time.Second)))

	collectionsSvc := collections.NewService(pool)
	collectionsSvc.RegisterRoutes(
		api.Group("", timeoutMiddleware(15*time.Second)),
		authSvc.RequireUser(),
	)

	var aiClient *ai.Client
	if cfg.OllamaURL != "" {
		aiClient = ai.NewClient(cfg.OllamaURL, cfg.OllamaModel)
	}
	upload.NewService(aiClient).RegisterRoutes(api, authSvc.RequireUser(), authSvc.RequirePro())

	billingSvc := billing.NewService(pool, billing.Config{
		SecretKey:     cfg.StripeSecretKey,
		WebhookSecret: cfg.StripeWebhookSecret,
		ProPriceID:    cfg.StripeProPriceID,
		FrontendURL:   cfg.FrontendURL,
	})
	billingSvc.RegisterRoutes(
		api.Group("", timeoutMiddleware(30*time.Second)),
		authSvc.RequireUser(),
	)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in background so we can listen for shutdown signals.
	go func() {
		log.Printf("flashr backend listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server: %v", err)
		}
	}()

	// Block until SIGINT or SIGTERM is received (Railway sends SIGTERM on deploy).
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("shutting down gracefully…")

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		log.Fatalf("forced shutdown: %v", err)
	}
	log.Println("server stopped")
}

func pingOllama(baseURL string) error {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(baseURL + "/api/tags")
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		return &httpError{status: resp.StatusCode}
	}
	return nil
}

type httpError struct{ status int }

func (e *httpError) Error() string {
	return http.StatusText(e.status)
}

// timeoutMiddleware cancels the request context after d. Downstream handlers
// that respect ctx.Done() (DB queries, HTTP calls) will unblock promptly.
func timeoutMiddleware(d time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), d)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func corsMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowed[origin]; ok {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")
			c.Header("Access-Control-Max-Age", "43200")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

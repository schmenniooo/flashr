package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/gzip"
	"github.com/gin-gonic/gin"

	"github.com/smithlabs/flashr/backend/internal/ai"
	"github.com/smithlabs/flashr/backend/internal/announcements"
	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/internal/billing"
	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/internal/ios"
	"github.com/smithlabs/flashr/backend/internal/notifications"
	"github.com/smithlabs/flashr/backend/internal/upload"
	"github.com/smithlabs/flashr/backend/pkg/config"
	"github.com/smithlabs/flashr/backend/pkg/db"
	"github.com/smithlabs/flashr/backend/pkg/storage"
)

func main() {
	// JSON structured logging for all environments — Railway, Docker, and local.
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("postgres connect failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("postgres connected")

	if err := db.Migrate(ctx, pool); err != nil {
		slog.Error("postgres migrate failed", "error", err)
		os.Exit(1)
	}
	slog.Info("postgres migrations up to date")

	authSvc, err := auth.NewService(pool, auth.Config{
		Secret:             cfg.JWTSecret,
		SecureCookies:      cfg.SecureCookies,
		GoogleClientID:     cfg.GoogleClientID,
		GoogleClientSecret: cfg.GoogleClientSecret,
		GoogleRedirectURL:  cfg.BackendURL + "/api/auth/google/callback",
		GithubClientID:     cfg.GithubClientID,
		GithubClientSecret: cfg.GithubClientSecret,
		GithubRedirectURL:  cfg.BackendURL + "/api/auth/github/callback",
		FrontendURL:        cfg.FrontendURL,
	})
	if err != nil {
		slog.Error("auth service init failed", "error", err)
		os.Exit(1)
	}

	if cfg.OllamaURL != "" {
		if err := pingOllama(cfg.OllamaURL); err != nil {
			slog.Warn("ollama not reachable", "url", cfg.OllamaURL, "error", err)
		} else {
			slog.Info("ollama reachable", "url", cfg.OllamaURL)
		}
	}

	// Replace gin.Default() with gin.New() so we control the middleware stack.
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.MaxMultipartMemory = 500 << 20 // match upload.maxFileSize
	r.Use(gin.Recovery())
	r.Use(requestIDMiddleware())
	r.Use(requestLogger())
	r.Use(corsMiddleware(cfg.AllowedOrigins))
	// Compress JSON responses to cut egress bandwidth — excluding the SSE
	// streaming routes, whose incremental flushes gzip would buffer into one
	// delayed chunk and break the "generating cards…" live UX.
	r.Use(gzip.Gzip(gzip.DefaultCompression, gzip.WithExcludedPaths([]string{
		"/api/ai/upload/stream",
		"/api/ai/generate/stream",
	})))

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
	// AI: no deadline here — the Ollama client enforces a 5-minute HTTP timeout.
	announcements.RegisterRoutes(api, cfg.GithubToken)

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

	var store *storage.Client
	if cfg.StorageEndpoint != "" && cfg.StorageAccessKeyID != "" &&
		cfg.StorageSecretAccessKey != "" && cfg.StorageBucket != "" {
		store = storage.New(cfg.StorageEndpoint, cfg.StorageAccessKeyID, cfg.StorageSecretAccessKey, cfg.StorageBucket)
		pingCtx, pingCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer pingCancel()
		if err := store.Ping(pingCtx); err != nil {
			slog.Warn("storage bucket not reachable", "error", err)
		} else {
			slog.Info("storage bucket connected", "bucket", cfg.StorageBucket)
		}
	}

	upload.NewService(aiClient, store).RegisterRoutes(api, authSvc.RequireUser(), authSvc.RequirePro())

	billingSvc := billing.NewService(pool, billing.Config{
		SecretKey:     cfg.StripeSecretKey,
		WebhookSecret: cfg.StripeWebhookSecret,
		ProPriceID:    cfg.StripeProPriceID,
		FrontendURL:   cfg.FrontendURL,
	})
	authSvc.OnBeforeUserDelete(billingSvc.DeleteCustomer)
	billingSvc.RegisterRoutes(
		api.Group("", timeoutMiddleware(30*time.Second)),
		authSvc.RequireUser(),
	)

	ios.NewService(pool).RegisterRoutes(
		api.Group("", timeoutMiddleware(15*time.Second)),
		authSvc.RequireUser(),
	)

	notifSvc, err := notifications.NewService(pool, notifications.Config{
		VAPIDPublicKey:  cfg.VAPIDPublicKey,
		VAPIDPrivateKey: cfg.VAPIDPrivateKey,
		VAPIDEmail:      cfg.VAPIDEmail,
	})
	if err != nil {
		slog.Error("notifications service init failed", "error", err)
		os.Exit(1)
	}
	notifSvc.RegisterRoutes(
		api.Group("", timeoutMiddleware(15*time.Second)),
		authSvc.RequireUser(),
	)

	// serverCtx lives for the full process lifetime — used by background goroutines
	// that must outlive individual HTTP requests (e.g. the push scheduler).
	serverCtx, serverCancel := context.WithCancel(context.Background())
	notifSvc.StartScheduler(serverCtx)

	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	go func() {
		slog.Info("flashr backend listening", "port", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down gracefully")

	serverCancel() // stop background goroutines (scheduler, etc.)

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := srv.Shutdown(shutCtx); err != nil {
		slog.Error("forced shutdown", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped")
}

// ─── Middleware ───────────────────────────────────────────────────────────────

const requestIDHeader = "X-Request-Id"

// requestIDMiddleware attaches a correlation ID to every request. It honours an
// incoming X-Request-Id header (from a load balancer or client) and always
// echoes the final ID back in the response.
func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(requestIDHeader)
		if id == "" {
			b := make([]byte, 8)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		c.Set(requestIDHeader, id)
		c.Header(requestIDHeader, id)
		c.Next()
	}
}

// requestLogger emits one structured log line per request with method, path,
// status, latency, client IP, and the correlation ID.
func requestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		reqID, _ := c.Get(requestIDHeader)
		slog.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"ms", time.Since(start).Milliseconds(),
			"ip", c.ClientIP(),
			"request_id", reqID,
		)
	}
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
			c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Max-Age", "43200")
			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusNoContent)
				return
			}
		} else if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusForbidden)
			return
		}
		c.Next()
	}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

func (e *httpError) Error() string { return http.StatusText(e.status) }

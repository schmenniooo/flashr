package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/internal/collections"
	"github.com/smithlabs/flashr/backend/pkg/db"
)

func main() {
	port := envOr("PORT", "8080")
	dbURL := os.Getenv("DATABASE_URL")
	ollamaURL := os.Getenv("OLLAMA_URL")
	jwtSecret := os.Getenv("JWT_SECRET")

	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	pool, err := db.Connect(ctx, dbURL)
	if err != nil {
		log.Fatalf("postgres: %v", err)
	}
	defer pool.Close()
	log.Printf("postgres: connected")

	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatalf("postgres: migrate: %v", err)
	}
	log.Printf("postgres: migrations up to date")

	authSvc, err := auth.NewService(pool, auth.Config{Secret: jwtSecret})
	if err != nil {
		log.Fatalf("auth: %v", err)
	}

	if ollamaURL != "" {
		if err := pingOllama(ollamaURL); err != nil {
			log.Printf("ollama: not reachable at %s: %v", ollamaURL, err)
		} else {
			log.Printf("ollama: reachable at %s", ollamaURL)
		}
	}

	r := gin.Default()
	r.Use(corsMiddleware(parseOrigins(os.Getenv("ALLOWED_ORIGINS"))))

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
		if ollamaURL != "" {
			if err := pingOllama(ollamaURL); err != nil {
				ollamaStatus = "down: " + err.Error()
			} else {
				ollamaStatus = "up"
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":   "ok",
			"postgres": dbStatus,
			"ollama":   ollamaStatus,
		})
	})

	authSvc.RegisterRoutes(api.Group("/auth"))

	collectionsSvc := collections.NewService(pool)
	collectionsSvc.RegisterRoutes(api, authSvc.RequireUser())

	log.Printf("flashr backend listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
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

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// parseOrigins splits a comma-separated list of allowed origins, trimming spaces
// and dropping empty entries. Returns nil if the input is empty.
func parseOrigins(raw string) []string {
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := parts[:0]
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// corsMiddleware reflects the request's Origin only if it is in the allowlist.
// Handles preflight OPTIONS by short-circuiting with 204. If no origins are
// configured the middleware is a no-op (used for local dev where the Vite
// proxy makes everything same-origin).
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

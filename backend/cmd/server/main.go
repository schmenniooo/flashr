package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	port := envOr("PORT", "8080")
	dbURL := os.Getenv("DATABASE_URL")
	ollamaURL := os.Getenv("OLLAMA_URL")

	var pool *pgxpool.Pool
	if dbURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		var err error
		pool, err = pgxpool.New(ctx, dbURL)
		if err != nil {
			log.Fatalf("postgres: connect: %v", err)
		}
		defer pool.Close()
		if err := pool.Ping(ctx); err != nil {
			log.Fatalf("postgres: ping: %v", err)
		}
		log.Printf("postgres: connected")
	} else {
		log.Printf("postgres: DATABASE_URL not set, skipping connection")
	}

	if ollamaURL != "" {
		if err := pingOllama(ollamaURL); err != nil {
			log.Printf("ollama: not reachable at %s: %v", ollamaURL, err)
		} else {
			log.Printf("ollama: reachable at %s", ollamaURL)
		}
	}

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	api.GET("/health", func(c *gin.Context) {
		dbStatus := "disabled"
		if pool != nil {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			defer cancel()
			if err := pool.Ping(ctx); err != nil {
				dbStatus = "down: " + err.Error()
			} else {
				dbStatus = "up"
			}
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

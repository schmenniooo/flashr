// Package config loads application configuration from environment variables.
package config

import (
	"log"
	"os"
	"strings"
)

// Config holds all runtime configuration for the flashr backend.
// Required variables (DATABASE_URL, JWT_SECRET) cause a fatal log if absent.
type Config struct {
	Port string

	DatabaseURL string

	JWTSecret string

	OllamaURL   string
	OllamaModel string

	GoogleClientID     string
	GoogleClientSecret string

	GithubClientID     string
	GithubClientSecret string
	GithubToken        string

	FrontendURL string
	BackendURL  string

	StripeSecretKey     string
	StripeWebhookSecret string
	StripeProPriceID    string

	// SecureCookies is true when the backend is served over HTTPS (production).
	// Set automatically from BACKEND_URL; controls the Secure flag on the refresh cookie.
	SecureCookies bool

	// Storage (Railway Buckets / S3-compatible). All four must be set to enable.
	StorageEndpoint        string
	StorageAccessKeyID     string
	StorageSecretAccessKey string
	StorageBucket          string

	// AllowedOrigins is the parsed list from ALLOWED_ORIGINS (comma-separated).
	AllowedOrigins []string

	// VAPID credentials for Web Push notifications.
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDEmail      string
}

// Load reads all environment variables and returns a populated Config.
// It calls log.Fatal if any required variable is missing.
func Load() Config {
	dbURL := os.Getenv("DATABASE_URL")
	jwtSecret := os.Getenv("JWT_SECRET")

	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	return Config{
		Port:        envOr("PORT", "8080"),
		DatabaseURL: dbURL,
		JWTSecret:   jwtSecret,

		OllamaURL:   os.Getenv("OLLAMA_URL"),
		OllamaModel: envOr("OLLAMA_MODEL", "llama3.2:3b"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),

		GithubClientID:     os.Getenv("GITHUB_CLIENT_ID"),
		GithubClientSecret: os.Getenv("GITHUB_CLIENT_SECRET"),
		GithubToken:        os.Getenv("GITHUB_TOKEN"),

		FrontendURL: envOr("FRONTEND_URL", "http://localhost:5173"),
		BackendURL:  envOr("BACKEND_URL", "http://localhost:8080"),

		StripeSecretKey:     os.Getenv("STRIPE_SECRET_KEY"),
		StripeWebhookSecret: os.Getenv("STRIPE_WEBHOOK_SECRET"),
		StripeProPriceID:    os.Getenv("STRIPE_PRO_PRICE_ID"),

		StorageEndpoint:        os.Getenv("STORAGE_ENDPOINT"),
		StorageAccessKeyID:     os.Getenv("STORAGE_ACCESS_KEY_ID"),
		StorageSecretAccessKey: os.Getenv("STORAGE_SECRET_ACCESS_KEY"),
		StorageBucket:          os.Getenv("STORAGE_BUCKET"),

		SecureCookies: strings.HasPrefix(os.Getenv("BACKEND_URL"), "https://"),

		AllowedOrigins: parseOrigins(os.Getenv("ALLOWED_ORIGINS")),

		VAPIDPublicKey:  os.Getenv("VAPID_PUBLIC_KEY"),
		VAPIDPrivateKey: os.Getenv("VAPID_PRIVATE_KEY"),
		VAPIDEmail:      envOr("VAPID_EMAIL", "mailto:hello@flashr.io"),
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// parseOrigins splits a comma-separated list of allowed origins, trimming
// spaces and dropping empty entries. Returns nil if the input is empty.
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

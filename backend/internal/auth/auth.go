// Package auth handles user identity: signup, login, JWT issuance, and OAuth.
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/github"
	"golang.org/x/oauth2/google"
)

// ─── Sentinel errors ─────────────────────────────────────────────────────────

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrInvalidEmail       = errors.New("invalid email address")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrUserNotFound       = errors.New("user not found")
)

const minPasswordLength = 8

// ─── Domain type ─────────────────────────────────────────────────────────────

type User struct {
	ID            string     `json:"id"`
	Email         string     `json:"email"`
	Name          string     `json:"name,omitempty"`
	Streak        int        `json:"streak"`
	Plan          string     `json:"plan"`
	PlanExpiresAt *time.Time `json:"plan_expires_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type Service struct {
	pool        *pgxpool.Pool
	secret      []byte
	tokenTTL    time.Duration
	googleOAuth *oauth2.Config
	githubOAuth *oauth2.Config
	frontendURL string
}

type Config struct {
	Secret             string
	TokenTTL           time.Duration // defaults to 24h
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	GithubClientID     string
	GithubClientSecret string
	GithubRedirectURL  string
	FrontendURL        string
}

func NewService(pool *pgxpool.Pool, cfg Config) (*Service, error) {
	if pool == nil {
		return nil, errors.New("auth: nil db pool")
	}
	if len(cfg.Secret) < 32 {
		return nil, errors.New("auth: JWT secret must be at least 32 bytes")
	}
	ttl := cfg.TokenTTL
	if ttl == 0 {
		ttl = 24 * time.Hour
	}
	svc := &Service{
		pool:        pool,
		secret:      []byte(cfg.Secret),
		tokenTTL:    ttl,
		frontendURL: cfg.FrontendURL,
	}
	if cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "" {
		svc.googleOAuth = &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		}
	}
	if cfg.GithubClientID != "" && cfg.GithubClientSecret != "" {
		svc.githubOAuth = &oauth2.Config{
			ClientID:     cfg.GithubClientID,
			ClientSecret: cfg.GithubClientSecret,
			RedirectURL:  cfg.GithubRedirectURL,
			Scopes:       []string{"read:user", "user:email"},
			Endpoint:     github.Endpoint,
		}
	}
	return svc, nil
}

// ─── Core auth ───────────────────────────────────────────────────────────────

// SignUp creates a new user with hashed credentials and returns a session token.
func (s *Service) SignUp(ctx context.Context, email, password, name string) (User, string, time.Time, error) {
	email = normaliseEmail(email)
	if !validEmail(email) {
		return User{}, "", time.Time{}, ErrInvalidEmail
	}
	if len(password) < minPasswordLength {
		return User{}, "", time.Time{}, ErrWeakPassword
	}
	name = strings.TrimSpace(name)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("hash password: %w", err)
	}

	var u User
	err = s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash)
		VALUES ($1, NULLIF($2, ''), $3)
		RETURNING id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at
	`, email, name, string(hash)).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, "", time.Time{}, ErrEmailTaken
		}
		return User{}, "", time.Time{}, fmt.Errorf("insert user: %w", err)
	}

	token, expires, err := s.issueToken(u.ID, u.Plan)
	if err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, expires, nil
}

// Login verifies credentials and returns a session token. Returns
// ErrInvalidCredentials for any failure to avoid user enumeration.
func (s *Service) Login(ctx context.Context, email, password string) (User, string, time.Time, error) {
	email = normaliseEmail(email)

	var (
		u    User
		hash *string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at, password_hash
		FROM users
		WHERE LOWER(email) = $1
	`, email).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		// Dummy bcrypt compare to keep response timing constant (prevents enumeration).
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"), []byte(password))
		return User{}, "", time.Time{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("lookup user: %w", err)
	}
	if hash == nil {
		return User{}, "", time.Time{}, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*hash), []byte(password)); err != nil {
		return User{}, "", time.Time{}, ErrInvalidCredentials
	}

	token, expires, err := s.issueToken(u.ID, u.Plan)
	if err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, expires, nil
}

func (s *Service) DeleteUser(ctx context.Context, id string) error {
	tag, err := s.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete user: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (s *Service) UserByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("lookup user: %w", err)
	}
	return u, nil
}

// flashrClaims extends the standard JWT claims with the user's plan so that
// plan-gating middleware can avoid a DB round-trip on every protected request.
// The plan in the token reflects the value at sign-in time; it remains valid
// for the token's lifetime (default 24 h). Subscription webhooks update the DB
// immediately, but token-based enforcement has up to a 24-hour lag for upgrades
// and downgrades — an accepted trade-off for this stage of the product.
type flashrClaims struct {
	jwt.RegisteredClaims
	Plan string `json:"plan"`
}

// ParseToken validates a signed JWT and returns the user ID and plan it contains.
func (s *Service) ParseToken(raw string) (userID, plan string, err error) {
	claims := &flashrClaims{}
	token, parseErr := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if parseErr != nil || !token.Valid || claims.Subject == "" {
		return "", "", ErrInvalidToken
	}
	return claims.Subject, claims.Plan, nil
}

func (s *Service) issueToken(userID, plan string) (string, time.Time, error) {
	now := time.Now().UTC()
	expires := now.Add(s.tokenTTL)
	claims := flashrClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expires),
		},
		Plan: plan,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, expires, nil
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func normaliseEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validEmail(s string) bool {
	at := strings.IndexByte(s, '@')
	return at > 0 && at < len(s)-1 && !strings.ContainsAny(s, " \t\n")
}

func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "SQLSTATE 23505")
}

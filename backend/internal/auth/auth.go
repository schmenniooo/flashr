// Package auth implements email/password signup and login with JWT-based
// session tokens. OAuth providers (Google/Apple/GitHub — see ROADMAP Phase 1.1)
// will plug in later via the existing users.oauth_provider column.
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
)

var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("email already registered")
	ErrWeakPassword       = errors.New("password must be at least 8 characters")
	ErrInvalidEmail       = errors.New("invalid email address")
	ErrInvalidToken       = errors.New("invalid or expired token")
	ErrUserNotFound       = errors.New("user not found")
)

const minPasswordLength = 8

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name,omitempty"`
	Streak    int       `json:"streak"`
	CreatedAt time.Time `json:"created_at"`
}

type Service struct {
	pool     *pgxpool.Pool
	secret   []byte
	tokenTTL time.Duration
}

type Config struct {
	Secret   string
	TokenTTL time.Duration // defaults to 24h
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
	return &Service{
		pool:     pool,
		secret:   []byte(cfg.Secret),
		tokenTTL: ttl,
	}, nil
}

// SignUp creates a new user with the given credentials and returns a fresh
// session token. Email is normalised to lowercase. Returns ErrEmailTaken if a
// user with that email already exists.
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
		RETURNING id, email, COALESCE(name, ''), streak, created_at
	`, email, name, string(hash)).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.CreatedAt)
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, "", time.Time{}, ErrEmailTaken
		}
		return User{}, "", time.Time{}, fmt.Errorf("insert user: %w", err)
	}

	token, expires, err := s.issueToken(u.ID)
	if err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, expires, nil
}

// Login verifies credentials and returns a session token. Returns
// ErrInvalidCredentials for any failure (missing user, wrong password, OAuth-only
// account) — the caller must not distinguish between them to avoid user enumeration.
func (s *Service) Login(ctx context.Context, email, password string) (User, string, time.Time, error) {
	email = normaliseEmail(email)

	var (
		u    User
		hash *string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(name, ''), streak, created_at, password_hash
		FROM users
		WHERE LOWER(email) = $1
	`, email).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.CreatedAt, &hash)
	if errors.Is(err, pgx.ErrNoRows) {
		// Run a dummy bcrypt compare anyway to keep timing roughly constant.
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

	token, expires, err := s.issueToken(u.ID)
	if err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, expires, nil
}

func (s *Service) UserByID(ctx context.Context, id string) (User, error) {
	var u User
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(name, ''), streak, created_at
		FROM users
		WHERE id = $1
	`, id).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("lookup user: %w", err)
	}
	return u, nil
}

func (s *Service) issueToken(userID string) (string, time.Time, error) {
	now := time.Now().UTC()
	expires := now.Add(s.tokenTTL)
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(expires),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign token: %w", err)
	}
	return signed, expires, nil
}

// ParseToken validates a signed token and returns the user ID it identifies.
func (s *Service) ParseToken(raw string) (string, error) {
	claims := &jwt.RegisteredClaims{}
	token, err := jwt.ParseWithClaims(raw, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil || !token.Valid || claims.Subject == "" {
		return "", ErrInvalidToken
	}
	return claims.Subject, nil
}

func normaliseEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validEmail(s string) bool {
	at := strings.IndexByte(s, '@')
	return at > 0 && at < len(s)-1 && !strings.ContainsAny(s, " \t\n")
}

// isUniqueViolation reports whether err is a Postgres unique-constraint violation.
// Avoids importing pgconn just for one error code check.
func isUniqueViolation(err error) bool {
	return err != nil && strings.Contains(err.Error(), "SQLSTATE 23505")
}

package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
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
	ID            string     `json:"id"`
	Email         string     `json:"email"`
	Name          string     `json:"name,omitempty"`
	Streak        int        `json:"streak"`
	Plan          string     `json:"plan"`
	PlanExpiresAt *time.Time `json:"plan_expires_at,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
}

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

func (s *Service) GoogleEnabled() bool { return s.googleOAuth != nil }

func (s *Service) GoogleAuthURL(state string) string {
	return s.googleOAuth.AuthCodeURL(state, oauth2.AccessTypeOnline)
}

// GenerateState produces a self-verifying state token: "<unix_ts>.<hmac_hex>".
// No server-side storage required — VerifyState checks the signature and TTL.
func (s *Service) GenerateState() string { return generateState(s.secret) }

// VerifyState checks the HMAC signature and rejects tokens older than 10 minutes.
func (s *Service) VerifyState(state string) error { return verifyState(s.secret, state) }

func generateState(secret []byte) string {
	ts := strconv.FormatInt(time.Now().Unix(), 10)
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(ts))
	return ts + "." + hex.EncodeToString(mac.Sum(nil))
}

func verifyState(secret []byte, state string) error {
	parts := strings.SplitN(state, ".", 2)
	if len(parts) != 2 {
		return errors.New("invalid state")
	}
	ts, sig := parts[0], parts[1]
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(ts))
	if !hmac.Equal([]byte(sig), []byte(hex.EncodeToString(mac.Sum(nil)))) {
		return errors.New("invalid state signature")
	}
	tsInt, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || time.Since(time.Unix(tsInt, 0)) > 10*time.Minute {
		return errors.New("state expired")
	}
	return nil
}

// GenerateStateForTest and VerifyStateForTest expose the package-level state
// functions for unit tests without requiring a Service instance.
func GenerateStateForTest(secret []byte) string        { return generateState(secret) }
func VerifyStateForTest(secret []byte, s string) error { return verifyState(secret, s) }

func (s *Service) GithubEnabled() bool { return s.githubOAuth != nil }

func (s *Service) GithubAuthURL(state string) string {
	return s.githubOAuth.AuthCodeURL(state, oauth2.AccessTypeOnline)
}

type githubUserInfo struct {
	Login string  `json:"login"`
	Name  string  `json:"name"`
	Email *string `json:"email"`
}

type githubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// GithubCallback exchanges the authorization code for a user session.
func (s *Service) GithubCallback(ctx context.Context, code string) (User, string, time.Time, error) {
	tok, err := s.githubOAuth.Exchange(ctx, code)
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("github: exchange code: %w", err)
	}

	doReq := func(url string, out any) error {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
		req.Header.Set("Accept", "application/vnd.github+json")
		req.Header.Set("User-Agent", "flashr")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()
		return json.NewDecoder(resp.Body).Decode(out)
	}

	var info githubUserInfo
	if err := doReq("https://api.github.com/user", &info); err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("github: fetch user: %w", err)
	}

	email := ""
	if info.Email != nil && *info.Email != "" {
		email = *info.Email
	} else {
		// Email is private — fetch from the emails endpoint
		var emails []githubEmail
		if err := doReq("https://api.github.com/user/emails", &emails); err != nil {
			return User{}, "", time.Time{}, fmt.Errorf("github: fetch emails: %w", err)
		}
		for _, e := range emails {
			if e.Primary && e.Verified {
				email = e.Email
				break
			}
		}
	}
	if email == "" {
		return User{}, "", time.Time{}, errors.New("github: no verified email found")
	}

	name := info.Name
	if name == "" {
		name = info.Login
	}

	return s.OAuthUpsert(ctx, email, name, "github")
}

type googleUserInfo struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

// GoogleCallback exchanges the authorization code for a user session.
// It upserts the user row (matching on email) and issues a JWT.
func (s *Service) GoogleCallback(ctx context.Context, code string) (User, string, time.Time, error) {
	tok, err := s.googleOAuth.Exchange(ctx, code)
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("google: exchange code: %w", err)
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("google: fetch userinfo: %w", err)
	}
	defer resp.Body.Close()

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("google: decode userinfo: %w", err)
	}
	if info.Email == "" {
		return User{}, "", time.Time{}, errors.New("google: no email in userinfo")
	}

	return s.OAuthUpsert(ctx, info.Email, info.Name, "google")
}

// OAuthUpsert inserts or links a user by email for the given OAuth provider,
// then issues a JWT. Exported so it can be called directly in tests.
func (s *Service) OAuthUpsert(ctx context.Context, email, name, provider string) (User, string, time.Time, error) {
	var u User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, oauth_provider)
		VALUES ($1, NULLIF($2, ''), $3)
		ON CONFLICT (email) DO UPDATE
		  SET oauth_provider = EXCLUDED.oauth_provider,
		      name = COALESCE(users.name, NULLIF(EXCLUDED.name, ''))
		RETURNING id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at
	`, normaliseEmail(email), name, provider).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt)
	if err != nil {
		return User{}, "", time.Time{}, fmt.Errorf("oauth upsert: %w", err)
	}
	token, expires, err := s.issueToken(u.ID)
	if err != nil {
		return User{}, "", time.Time{}, err
	}
	return u, token, expires, nil
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
		RETURNING id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at
	`, email, name, string(hash)).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt)
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
		SELECT id, email, COALESCE(name, ''), streak, plan, plan_expires_at, created_at, password_hash
		FROM users
		WHERE LOWER(email) = $1
	`, email).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt, &hash)
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

// Package auth handles user identity: signup, login, JWT issuance, and OAuth.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
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
	ErrInvalidCredentials  = errors.New("invalid email or password")
	ErrEmailTaken          = errors.New("email already registered")
	ErrWeakPassword        = errors.New("password must be at least 8 characters")
	ErrInvalidEmail        = errors.New("invalid email address")
	ErrInvalidToken        = errors.New("invalid or expired token")
	ErrUserNotFound        = errors.New("user not found")
	ErrRefreshTokenInvalid = errors.New("invalid or expired refresh token")
)

const minPasswordLength = 8

// ─── Domain types ─────────────────────────────────────────────────────────────

type User struct {
	ID                  string     `json:"id"`
	Email               string     `json:"email"`
	Name                string     `json:"name,omitempty"`
	Streak              int        `json:"streak"`
	DailyGoal           int        `json:"daily_goal"`
	Plan                string     `json:"plan"`
	PlanExpiresAt       *time.Time `json:"plan_expires_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
	OnboardingCompleted bool       `json:"onboarding_completed"`
	Age                 *int       `json:"age,omitempty"`
	LearnerTypes        []string   `json:"learner_types"`
	AvatarURL           *string    `json:"avatar_url,omitempty"`
}

// TokenPair holds both tokens issued after a successful authentication.
// AccessToken is short-lived (15 min) and sent in the Authorization header.
// RefreshToken is long-lived (30 days) and stored in an http-only cookie.
type TokenPair struct {
	AccessToken   string
	AccessExpiry  time.Time
	RefreshToken  string
	RefreshExpiry time.Time
}

// ─── Service ─────────────────────────────────────────────────────────────────

type Service struct {
	pool             *pgxpool.Pool
	secret           []byte
	accessTTL        time.Duration
	refreshTTL       time.Duration
	SecureCookies    bool
	googleOAuth      *oauth2.Config
	githubOAuth      *oauth2.Config
	frontendURL      string
	beforeDeleteHook func(ctx context.Context, userID string) error
}

// OnBeforeUserDelete registers a hook that is called before a user is deleted.
// Use this to clean up external resources (e.g. Stripe customer data).
func (s *Service) OnBeforeUserDelete(fn func(ctx context.Context, userID string) error) {
	s.beforeDeleteHook = fn
}

type Config struct {
	Secret        string
	AccessTTL     time.Duration // defaults to 15 min
	RefreshTTL    time.Duration // defaults to 30 days
	SecureCookies bool

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
	accessTTL := cfg.AccessTTL
	if accessTTL == 0 {
		accessTTL = 15 * time.Minute
	}
	refreshTTL := cfg.RefreshTTL
	if refreshTTL == 0 {
		refreshTTL = 30 * 24 * time.Hour
	}
	svc := &Service{
		pool:          pool,
		secret:        []byte(cfg.Secret),
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
		SecureCookies: cfg.SecureCookies,
		frontendURL:   cfg.FrontendURL,
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

// SignUp creates a new user with hashed credentials and issues a token pair.
func (s *Service) SignUp(ctx context.Context, email, password, name string) (User, TokenPair, error) {
	email = normaliseEmail(email)
	if !validEmail(email) {
		return User{}, TokenPair{}, ErrInvalidEmail
	}
	if len(password) < minPasswordLength {
		return User{}, TokenPair{}, ErrWeakPassword
	}
	name = strings.TrimSpace(name)

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("hash password: %w", err)
	}

	var u User
	err = s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, password_hash)
		VALUES ($1, NULLIF($2, ''), $3)
		RETURNING id, email, COALESCE(name, ''), streak, daily_goal, plan, plan_expires_at, created_at,
		          onboarding_completed, age, learner_types, avatar_url
	`, email, name, string(hash)).Scan(
		&u.ID, &u.Email, &u.Name, &u.Streak, &u.DailyGoal, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt,
		&u.OnboardingCompleted, &u.Age, &u.LearnerTypes, &u.AvatarURL,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, TokenPair{}, ErrEmailTaken
		}
		return User{}, TokenPair{}, fmt.Errorf("insert user: %w", err)
	}

	pair, err := s.issueTokenPair(ctx, u.ID, u.Plan)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return u, pair, nil
}

// Login verifies credentials and issues a token pair. Returns
// ErrInvalidCredentials for any failure to avoid user enumeration.
func (s *Service) Login(ctx context.Context, email, password string) (User, TokenPair, error) {
	email = normaliseEmail(email)

	var (
		u    User
		hash *string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, email, COALESCE(name, ''), streak, daily_goal, plan, plan_expires_at, created_at,
		       onboarding_completed, age, learner_types, avatar_url, password_hash
		FROM users
		WHERE LOWER(email) = $1
	`, email).Scan(
		&u.ID, &u.Email, &u.Name, &u.Streak, &u.DailyGoal, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt,
		&u.OnboardingCompleted, &u.Age, &u.LearnerTypes, &u.AvatarURL, &hash,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		// Dummy bcrypt compare to keep response timing constant (prevents enumeration).
		_ = bcrypt.CompareHashAndPassword([]byte("$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"), []byte(password))
		return User{}, TokenPair{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("lookup user: %w", err)
	}
	if hash == nil {
		return User{}, TokenPair{}, ErrInvalidCredentials
	}
	if err := bcrypt.CompareHashAndPassword([]byte(*hash), []byte(password)); err != nil {
		return User{}, TokenPair{}, ErrInvalidCredentials
	}

	pair, err := s.issueTokenPair(ctx, u.ID, u.Plan)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return u, pair, nil
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
		SELECT id, email, COALESCE(name, ''), streak, daily_goal, plan, plan_expires_at, created_at,
		       onboarding_completed, age, learner_types, avatar_url
		FROM users
		WHERE id = $1
	`, id).Scan(
		&u.ID, &u.Email, &u.Name, &u.Streak, &u.DailyGoal, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt,
		&u.OnboardingCompleted, &u.Age, &u.LearnerTypes, &u.AvatarURL,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrUserNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("lookup user: %w", err)
	}
	return u, nil
}

// UpdateAvatar sets or clears the user's avatar URL. Pass nil to remove it.
func (s *Service) UpdateAvatar(ctx context.Context, userID string, avatarURL *string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET avatar_url = $2 WHERE id = $1`,
		userID, avatarURL,
	)
	return err
}

func (s *Service) UpdateDailyGoal(ctx context.Context, userID string, dailyGoal int) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE users SET daily_goal = $2 WHERE id = $1`,
		userID, dailyGoal,
	)
	return err
}

// CompleteOnboarding persists the name, age, and learner types collected during
// the onboarding flow and marks the user as onboarded. Subsequent calls are
// idempotent — users can update their profile later via the same endpoint.
func (s *Service) CompleteOnboarding(ctx context.Context, userID, name string, age *int, learnerTypes []string) error {
	if learnerTypes == nil {
		learnerTypes = []string{}
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET name = NULLIF($2, ''), age = $3, learner_types = $4, onboarding_completed = TRUE
		WHERE id = $1
	`, userID, name, age, learnerTypes)
	return err
}

// RotateRefreshToken validates the raw token, deletes the DB row atomically,
// and issues a new token pair. Returns ErrRefreshTokenInvalid if the token is
// not found or has expired — including the duplicate-use case where a stolen
// token is presented after the legitimate client already rotated it.
func (s *Service) RotateRefreshToken(ctx context.Context, rawToken string) (User, TokenPair, error) {
	hash := hashToken(rawToken)

	var userID string
	err := s.pool.QueryRow(ctx, `
		DELETE FROM refresh_tokens
		WHERE token_hash = $1 AND expires_at > NOW()
		RETURNING user_id
	`, hash).Scan(&userID)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, TokenPair{}, ErrRefreshTokenInvalid
	}
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("rotate refresh token: %w", err)
	}

	user, err := s.UserByID(ctx, userID)
	if err != nil {
		return User{}, TokenPair{}, err
	}

	pair, err := s.issueTokenPair(ctx, userID, user.Plan)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return user, pair, nil
}

// RevokeRefreshToken deletes the token from the DB. No-op if already gone.
func (s *Service) RevokeRefreshToken(ctx context.Context, rawToken string) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM refresh_tokens WHERE token_hash = $1`,
		hashToken(rawToken),
	)
	return err
}

// ─── JWT ─────────────────────────────────────────────────────────────────────

// flashrClaims extends the standard JWT claims with the user's plan so that
// plan-gating middleware can avoid a DB round-trip on every protected request.
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

// ─── Internal token helpers ──────────────────────────────────────────────────

func (s *Service) issueTokenPair(ctx context.Context, userID, plan string) (TokenPair, error) {
	access, accessExp, err := s.issueAccessToken(userID, plan)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, refreshExp, err := s.issueRefreshToken(ctx, userID)
	if err != nil {
		return TokenPair{}, err
	}
	return TokenPair{
		AccessToken:   access,
		AccessExpiry:  accessExp,
		RefreshToken:  refresh,
		RefreshExpiry: refreshExp,
	}, nil
}

func (s *Service) issueAccessToken(userID, plan string) (string, time.Time, error) {
	now := time.Now().UTC()
	expires := now.Add(s.accessTTL)
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

func (s *Service) issueRefreshToken(ctx context.Context, userID string) (string, time.Time, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", time.Time{}, fmt.Errorf("generate refresh token: %w", err)
	}
	rawHex := hex.EncodeToString(raw)
	expires := time.Now().UTC().Add(s.refreshTTL)

	_, err := s.pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		userID, hashToken(rawHex), expires,
	)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("store refresh token: %w", err)
	}
	return rawHex, expires, nil
}

func hashToken(raw string) string {
	h := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(h[:])
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

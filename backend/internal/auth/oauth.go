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
)

// ─── OAuth state (stateless HMAC token) ──────────────────────────────────────

func (s *Service) GenerateState() string          { return generateState(s.secret) }
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

func GenerateStateForTest(secret []byte) string        { return generateState(secret) }
func VerifyStateForTest(secret []byte, s string) error { return verifyState(secret, s) }

// ─── Google OAuth ─────────────────────────────────────────────────────────────

func (s *Service) GoogleEnabled() bool               { return s.googleOAuth != nil }
func (s *Service) GoogleAuthURL(state string) string { return s.googleOAuth.AuthCodeURL(state) }

type googleUserInfo struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

func (s *Service) GoogleCallback(ctx context.Context, code string) (User, TokenPair, error) {
	tok, err := s.googleOAuth.Exchange(ctx, code)
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("google: exchange code: %w", err)
	}

	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	req.Header.Set("Authorization", "Bearer "+tok.AccessToken)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("google: fetch userinfo: %w", err)
	}
	defer resp.Body.Close()

	var info googleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return User{}, TokenPair{}, fmt.Errorf("google: decode userinfo: %w", err)
	}
	if info.Email == "" {
		return User{}, TokenPair{}, errors.New("google: no email in userinfo")
	}

	return s.OAuthUpsert(ctx, info.Email, info.Name, "google")
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

func (s *Service) GithubEnabled() bool               { return s.githubOAuth != nil }
func (s *Service) GithubAuthURL(state string) string { return s.githubOAuth.AuthCodeURL(state) }

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

func (s *Service) GithubCallback(ctx context.Context, code string) (User, TokenPair, error) {
	tok, err := s.githubOAuth.Exchange(ctx, code)
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("github: exchange code: %w", err)
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
		return User{}, TokenPair{}, fmt.Errorf("github: fetch user: %w", err)
	}

	email := ""
	if info.Email != nil && *info.Email != "" {
		email = *info.Email
	} else {
		var emails []githubEmail
		if err := doReq("https://api.github.com/user/emails", &emails); err != nil {
			return User{}, TokenPair{}, fmt.Errorf("github: fetch emails: %w", err)
		}
		for _, e := range emails {
			if e.Primary && e.Verified {
				email = e.Email
				break
			}
		}
	}
	if email == "" {
		return User{}, TokenPair{}, errors.New("github: no verified email found")
	}

	name := info.Name
	if name == "" {
		name = info.Login
	}
	return s.OAuthUpsert(ctx, email, name, "github")
}

// ─── Shared upsert ───────────────────────────────────────────────────────────

// OAuthUpsert inserts or links a user by email for the given provider and issues
// a token pair. Exported so integration tests can call it directly.
func (s *Service) OAuthUpsert(ctx context.Context, email, name, provider string) (User, TokenPair, error) {
	if email == "" {
		return User{}, TokenPair{}, errors.New("oauth upsert: email is required")
	}
	var u User
	err := s.pool.QueryRow(ctx, `
		INSERT INTO users (email, name, oauth_provider)
		VALUES ($1, NULLIF($2, ''), $3)
		ON CONFLICT (email) DO UPDATE
		  SET oauth_provider = EXCLUDED.oauth_provider,
		      name = COALESCE(users.name, NULLIF(EXCLUDED.name, ''))
		RETURNING id, email, COALESCE(name, ''), streak, daily_goal, plan, plan_expires_at, created_at
	`, normaliseEmail(email), name, provider).Scan(&u.ID, &u.Email, &u.Name, &u.Streak, &u.DailyGoal, &u.Plan, &u.PlanExpiresAt, &u.CreatedAt)
	if err != nil {
		return User{}, TokenPair{}, fmt.Errorf("oauth upsert: %w", err)
	}
	pair, err := s.issueTokenPair(ctx, u.ID, u.Plan)
	if err != nil {
		return User{}, TokenPair{}, err
	}
	return u, pair, nil
}

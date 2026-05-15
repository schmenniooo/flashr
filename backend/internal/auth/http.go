package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"

	"github.com/smithlabs/flashr/backend/pkg/domain"
)

// authLimiters holds a token-bucket rate limiter keyed by client IP.
// Allows 10 auth attempts per minute with a burst of 10.
var (
	authLimiters  sync.Map
	authRateLimit = rate.Every(time.Minute / 10)
	authRateBurst = 10
)

func authRateLimiter(c *gin.Context) {
	ip := c.ClientIP()
	v, _ := authLimiters.LoadOrStore(ip, rate.NewLimiter(authRateLimit, authRateBurst))
	if !v.(*rate.Limiter).Allow() {
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many requests — try again shortly"})
	}
}

// ─── Cookie ───────────────────────────────────────────────────────────────────

const refreshCookieName = "flashr_rt"

func (s *Service) setRefreshCookie(c *gin.Context, token string, expires time.Time) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(
		refreshCookieName,
		token,
		int(time.Until(expires).Seconds()),
		"/api/auth",
		"",
		s.SecureCookies,
		true, // HttpOnly
	)
}

func (s *Service) clearRefreshCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(refreshCookieName, "", -1, "/api/auth", "", s.SecureCookies, true)
}

// ─── Context keys ─────────────────────────────────────────────────────────────

const (
	userIDContextKey = "user_id"
	planContextKey   = "plan"
)

// ─── Request / response types ─────────────────────────────────────────────────

type tokenResponse struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expires_at"`
	User      User   `json:"user"`
}

type signUpRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
	Name     string `json:"name"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// RegisterRoutes mounts auth endpoints under the given group.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/signup", authRateLimiter, s.handleSignUp)
	rg.POST("/login", authRateLimiter, s.handleLogin)
	rg.POST("/refresh", s.handleRefresh)
	rg.POST("/logout", s.handleLogout)
	rg.GET("/me", s.RequireUser(), s.handleMe)
	rg.DELETE("/me", s.RequireUser(), s.handleDeleteMe)
	if s.GoogleEnabled() {
		rg.GET("/google", authRateLimiter, s.handleGoogleRedirect)
		rg.GET("/google/callback", authRateLimiter, s.handleGoogleCallback)
	}
	if s.GithubEnabled() {
		rg.GET("/github", authRateLimiter, s.handleGithubRedirect)
		rg.GET("/github/callback", authRateLimiter, s.handleGithubCallback)
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

func (s *Service) handleGoogleRedirect(c *gin.Context) {
	state := s.GenerateState()
	c.Redirect(http.StatusTemporaryRedirect, s.GoogleAuthURL(state))
}

func (s *Service) handleGoogleCallback(c *gin.Context) {
	if err := s.VerifyState(c.Query("state")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}
	_, pair, err := s.GoogleCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "google login failed"})
		return
	}
	s.setRefreshCookie(c, pair.RefreshToken, pair.RefreshExpiry)
	redirectURL := fmt.Sprintf("%s/auth/callback#token=%s&expires=%d",
		s.frontendURL, pair.AccessToken, pair.AccessExpiry.Unix())
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (s *Service) handleGithubRedirect(c *gin.Context) {
	state := s.GenerateState()
	c.Redirect(http.StatusTemporaryRedirect, s.GithubAuthURL(state))
}

func (s *Service) handleGithubCallback(c *gin.Context) {
	if err := s.VerifyState(c.Query("state")); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid oauth state"})
		return
	}
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}
	_, pair, err := s.GithubCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "github login failed"})
		return
	}
	s.setRefreshCookie(c, pair.RefreshToken, pair.RefreshExpiry)
	redirectURL := fmt.Sprintf("%s/auth/callback#token=%s&expires=%d",
		s.frontendURL, pair.AccessToken, pair.AccessExpiry.Unix())
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (s *Service) handleSignUp(c *gin.Context) {
	var req signUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, pair, err := s.SignUp(c.Request.Context(), req.Email, req.Password, req.Name)
	switch {
	case errors.Is(err, ErrEmailTaken):
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	case errors.Is(err, ErrWeakPassword), errors.Is(err, ErrInvalidEmail):
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
		return
	}

	s.setRefreshCookie(c, pair.RefreshToken, pair.RefreshExpiry)
	c.JSON(http.StatusCreated, tokenResponse{
		Token:     pair.AccessToken,
		ExpiresAt: pair.AccessExpiry.Unix(),
		User:      user,
	})
}

func (s *Service) handleLogin(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, pair, err := s.Login(c.Request.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign in"})
		return
	}

	s.setRefreshCookie(c, pair.RefreshToken, pair.RefreshExpiry)
	c.JSON(http.StatusOK, tokenResponse{
		Token:     pair.AccessToken,
		ExpiresAt: pair.AccessExpiry.Unix(),
		User:      user,
	})
}

// handleRefresh validates the refresh cookie, rotates the token pair, sets a new
// cookie, and returns a fresh access token. No Authorization header required.
func (s *Service) handleRefresh(c *gin.Context) {
	rawToken, err := c.Cookie(refreshCookieName)
	if err != nil || rawToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing refresh token"})
		return
	}

	user, pair, err := s.RotateRefreshToken(c.Request.Context(), rawToken)
	if err != nil {
		s.clearRefreshCookie(c)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired session — please sign in again"})
		return
	}

	s.setRefreshCookie(c, pair.RefreshToken, pair.RefreshExpiry)
	c.JSON(http.StatusOK, tokenResponse{
		Token:     pair.AccessToken,
		ExpiresAt: pair.AccessExpiry.Unix(),
		User:      user,
	})
}

// handleLogout revokes the refresh token and clears the cookie. Always 204,
// even when no cookie is present, so the client-side state is always cleaned up.
func (s *Service) handleLogout(c *gin.Context) {
	if rawToken, err := c.Cookie(refreshCookieName); err == nil && rawToken != "" {
		_ = s.RevokeRefreshToken(c.Request.Context(), rawToken)
	}
	s.clearRefreshCookie(c)
	c.Status(http.StatusNoContent)
}

func (s *Service) handleDeleteMe(c *gin.Context) {
	userID := UserIDFromContext(c)
	if s.beforeDeleteHook != nil {
		if err := s.beforeDeleteHook(c.Request.Context(), userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not clean up account data"})
			return
		}
	}
	if err := s.DeleteUser(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete account"})
		return
	}
	s.clearRefreshCookie(c)
	c.Status(http.StatusNoContent)
}

func (s *Service) handleMe(c *gin.Context) {
	userID := UserIDFromContext(c)
	user, err := s.UserByID(c.Request.Context(), userID)
	if errors.Is(err, ErrUserNotFound) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user no longer exists"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load user"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

// ─── Middleware ────────────────────────────────────────────────────────────────

// RequireUser validates the Authorization: Bearer token and stores the user ID
// and plan in the request context for downstream handlers.
func (s *Service) RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		raw := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		userID, plan, err := s.ParseToken(raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set(userIDContextKey, userID)
		c.Set(planContextKey, plan)
		c.Next()
	}
}

// RequirePro queries the DB for the user's current plan so that subscription
// changes take effect immediately without waiting for token rotation.
// Must be chained after RequireUser.
func (s *Service) RequirePro() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := UserIDFromContext(c)
		var plan string
		err := s.pool.QueryRow(c.Request.Context(),
			`SELECT plan FROM users WHERE id = $1`, userID,
		).Scan(&plan)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not verify plan"})
			return
		}
		if plan != domain.PlanPro {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "pro plan required"})
			return
		}
		c.Next()
	}
}

// PlanFromContext returns the plan stored by RequireUser middleware.
func PlanFromContext(c *gin.Context) string {
	v, _ := c.Get(planContextKey)
	plan, _ := v.(string)
	return plan
}

// UserIDFromContext returns the authenticated user's ID.
func UserIDFromContext(c *gin.Context) string {
	v, _ := c.Get(userIDContextKey)
	id, _ := v.(string)
	return id
}

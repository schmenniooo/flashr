package auth

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const userIDContextKey = "user_id"

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

// RegisterRoutes mounts auth endpoints under the given group:
//
//	POST /signup
//	POST /login
//	GET  /me              (requires Authorization: Bearer <token>)
//	GET  /google          (redirect to Google consent screen)
//	GET  /google/callback (OAuth callback — issues JWT and redirects to frontend)
func (s *Service) RegisterRoutes(rg *gin.RouterGroup) {
	rg.POST("/signup", s.handleSignUp)
	rg.POST("/login", s.handleLogin)
	rg.GET("/me", s.RequireUser(), s.handleMe)
	rg.DELETE("/me", s.RequireUser(), s.handleDeleteMe)
	if s.GoogleEnabled() {
		rg.GET("/google", s.handleGoogleRedirect)
		rg.GET("/google/callback", s.handleGoogleCallback)
	}
	if s.GithubEnabled() {
		rg.GET("/github", s.handleGithubRedirect)
		rg.GET("/github/callback", s.handleGithubCallback)
	}
}

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

	_, token, expires, err := s.GoogleCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "google login failed"})
		return
	}

	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s&expires=%d",
		s.frontendURL, token, expires.Unix())
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

	_, token, expires, err := s.GithubCallback(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "github login failed"})
		return
	}

	redirectURL := fmt.Sprintf("%s/auth/callback?token=%s&expires=%d",
		s.frontendURL, token, expires.Unix())
	c.Redirect(http.StatusTemporaryRedirect, redirectURL)
}

func (s *Service) handleSignUp(c *gin.Context) {
	var req signUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, token, expires, err := s.SignUp(c.Request.Context(), req.Email, req.Password, req.Name)
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

	c.JSON(http.StatusCreated, tokenResponse{
		Token:     token,
		ExpiresAt: expires.Unix(),
		User:      user,
	})
}

func (s *Service) handleLogin(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email and password are required"})
		return
	}

	user, token, expires, err := s.Login(c.Request.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, ErrInvalidCredentials):
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign in"})
		return
	}

	c.JSON(http.StatusOK, tokenResponse{
		Token:     token,
		ExpiresAt: expires.Unix(),
		User:      user,
	})
}

func (s *Service) handleDeleteMe(c *gin.Context) {
	userID := UserIDFromContext(c)
	if err := s.DeleteUser(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete account"})
		return
	}
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

// RequirePro is gin middleware that aborts with 403 if the authenticated user
// is not on the pro plan. Must be chained after RequireUser.
func (s *Service) RequirePro() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := UserIDFromContext(c)
		var plan string
		err := s.pool.QueryRow(c.Request.Context(),
			`SELECT plan FROM users WHERE id = $1`, userID,
		).Scan(&plan)
		if err != nil || plan != "pro" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "pro plan required"})
			return
		}
		c.Next()
	}
}

// RequireUser is gin middleware that validates the Authorization: Bearer token
// and stores the user ID in the request context for downstream handlers.
func (s *Service) RequireUser() gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			return
		}
		raw := strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
		userID, err := s.ParseToken(raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}
		c.Set(userIDContextKey, userID)
		c.Next()
	}
}

// UserIDFromContext returns the authenticated user's ID. Empty if RequireUser
// did not run on the request.
func UserIDFromContext(c *gin.Context) string {
	v, _ := c.Get(userIDContextKey)
	id, _ := v.(string)
	return id
}

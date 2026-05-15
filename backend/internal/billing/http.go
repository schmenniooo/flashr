package billing

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smithlabs/flashr/backend/internal/auth"
)

// RegisterRoutes mounts billing endpoints.
// The webhook route is intentionally outside the auth middleware — Stripe
// authenticates via HMAC signature on the payload instead.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup, requireUser gin.HandlerFunc) {
	rg.POST("/billing/webhook", s.handleWebhook)

	protected := rg.Group("/billing", requireUser)
	protected.POST("/checkout", s.handleCheckout)
	protected.POST("/portal", s.handlePortal)
	protected.POST("/fulfill", s.handleFulfill)
	protected.POST("/sync", s.handleSync)
}

func (s *Service) handleCheckout(c *gin.Context) {
	userID := auth.UserIDFromContext(c)

	var body struct {
		Email     string `json:"email"`
		WithTrial bool   `json:"with_trial"`
	}
	_ = c.ShouldBindJSON(&body)

	url, err := s.CreateCheckoutSession(c.Request.Context(), userID, body.Email, body.WithTrial)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create checkout session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

func (s *Service) handleFulfill(c *gin.Context) {
	userID := auth.UserIDFromContext(c)

	var body struct {
		SessionID string `json:"session_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	if err := s.FulfillCheckout(c.Request.Context(), body.SessionID, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fulfill checkout"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) handleSync(c *gin.Context) {
	userID := auth.UserIDFromContext(c)
	if err := s.SyncPlan(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sync plan"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func (s *Service) handlePortal(c *gin.Context) {
	userID := auth.UserIDFromContext(c)

	url, err := s.CreatePortalSession(c.Request.Context(), userID)
	if errors.Is(err, ErrNoSubscription) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no active subscription"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create portal session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

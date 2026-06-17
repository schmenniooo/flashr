package billing

import (
	"errors"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/smithlabs/flashr/backend/internal/auth"
)

// RegisterRoutes mounts billing endpoints.
// The webhook routes are intentionally outside the auth middleware — they
// authenticate via HMAC (Stripe) or Apple signature instead.
//
// NOTE: /billing/ios-fulfill is intentionally absent. It will be added in
// Phase 2 once Apple JWS signed-transaction verification is implemented.
// Mounting an unverified fulfill endpoint would let any authenticated user
// self-promote to Pro without a real purchase.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup, requireUser gin.HandlerFunc) {
	rg.POST("/billing/webhook", s.handleWebhook)
	rg.POST("/billing/ios-webhook", s.handleIOSWebhook)

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

// handleIOSWebhook receives Apple server-to-server subscription notifications.
// Apple authenticates via a signed JWS payload — no Bearer token is present.
// Phase 1 stub: logs and returns 200. Real JWS verification added in Phase 2.
func (s *Service) handleIOSWebhook(c *gin.Context) {
	payload, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "could not read body"})
		return
	}
	if err := s.IOSWebhook(c.Request.Context(), payload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook processing failed"})
		return
	}
	c.Status(http.StatusOK)
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

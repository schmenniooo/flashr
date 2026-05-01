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
}

func (s *Service) handleCheckout(c *gin.Context) {
	userID := auth.UserIDFromContext(c)

	var body struct {
		Email string `json:"email"`
	}
	_ = c.ShouldBindJSON(&body)

	url, err := s.CreateCheckoutSession(c.Request.Context(), userID, body.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create checkout session"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
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

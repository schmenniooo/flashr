package notifications

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
)

// allowedPushHost guards against SSRF by rejecting any endpoint URL whose
// host is not a known browser push service. The backend calls this URL
// outbound (via webpush.SendNotification), so a user-supplied internal
// address (e.g. 169.254.169.254) would otherwise let them pivot into private
// infrastructure on every scheduled tick.
func allowedPushHost(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return false
	}
	h := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	switch h {
	case "fcm.googleapis.com", "web.push.apple.com":
		return true
	}
	return strings.HasSuffix(h, ".push.services.mozilla.com") ||
		strings.HasSuffix(h, ".notify.windows.com") ||
		strings.HasSuffix(h, ".pushpad.xyz") ||
		strings.HasSuffix(h, ".onesignal.com")
}

// RegisterRoutes mounts the notification endpoints under the given router group.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup, requireUser gin.HandlerFunc) {
	// Public — the frontend needs the VAPID key before it can request permission.
	rg.GET("/notifications/vapid-public-key", s.handleVapidKey)

	// Authenticated — subscribe and unsubscribe a push endpoint.
	rg.POST("/notifications/subscribe", requireUser, s.handleSubscribe)
	rg.DELETE("/notifications/subscribe", requireUser, s.handleUnsubscribe)
}

func (s *Service) handleVapidKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"key": s.vapidPub})
}

func (s *Service) handleSubscribe(c *gin.Context) {
	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
		P256DH   string `json:"p256dh"   binding:"required"`
		Auth     string `json:"auth"     binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint, p256dh, and auth are required"})
		return
	}
	if !allowedPushHost(req.Endpoint) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint is not a recognised push service"})
		return
	}

	userID := userIDFromContext(c)
	if err := s.UpsertSubscription(c.Request.Context(), userID, req.Endpoint, req.P256DH, req.Auth); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save subscription"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Service) handleUnsubscribe(c *gin.Context) {
	var req struct {
		Endpoint string `json:"endpoint" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "endpoint is required"})
		return
	}

	userID := userIDFromContext(c)
	if err := s.DeleteSubscription(c.Request.Context(), userID, req.Endpoint); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not remove subscription"})
		return
	}
	c.Status(http.StatusNoContent)
}

// userIDFromContext reads the user ID set by the auth RequireUser middleware.
func userIDFromContext(c *gin.Context) string {
	v, _ := c.Get("user_id")
	id, _ := v.(string)
	return id
}

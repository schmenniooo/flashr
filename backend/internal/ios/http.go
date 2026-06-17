package ios

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// RegisterRoutes mounts iOS-specific endpoints under the given router group.
func (s *Service) RegisterRoutes(rg *gin.RouterGroup, requireUser gin.HandlerFunc) {
	rg.POST("/users/push-token", requireUser, s.handleRegisterToken)
	rg.DELETE("/users/push-token", requireUser, s.handleDeleteToken)
}

func (s *Service) handleRegisterToken(c *gin.Context) {
	var req struct {
		Token    string `json:"token"    binding:"required"`
		Platform string `json:"platform" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token and platform are required"})
		return
	}
	if req.Platform != "ios" && req.Platform != "macos" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "platform must be 'ios' or 'macos'"})
		return
	}

	userID := userIDFromContext(c)
	if err := s.UpsertPushToken(c.Request.Context(), userID, req.Token, req.Platform); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not save push token"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (s *Service) handleDeleteToken(c *gin.Context) {
	var req struct {
		Token string `json:"token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token is required"})
		return
	}

	userID := userIDFromContext(c)
	if err := s.DeletePushToken(c.Request.Context(), userID, req.Token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete push token"})
		return
	}
	c.Status(http.StatusNoContent)
}

func userIDFromContext(c *gin.Context) string {
	v, _ := c.Get("user_id")
	id, _ := v.(string)
	return id
}

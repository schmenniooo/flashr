// Package collections handles collection and card CRUD. Cards are always
// accessed through their parent collection for ownership validation.
package collections

import (
	"errors"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("not found")

// ─── Domain types ────────────────────────────────────────────────────────────

type Card struct {
	ID          string    `json:"id"`
	Question    string    `json:"question"`
	Answer      string    `json:"answer"`
	AIGenerated bool      `json:"ai_generated"`
	CreatedAt   time.Time `json:"created_at"`
}

type Collection struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Folder      string    `json:"folder"`
	Emoji       string    `json:"emoji"`
	Description string    `json:"description"`
	IsPublic    bool      `json:"is_public"`
	CreatedAt   time.Time `json:"created_at"`
	Cards       []Card    `json:"cards"`
}

// ─── Service ─────────────────────────────────────────────────────────────────

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// RegisterRoutes mounts all collection and card endpoints under /api.
// All routes require the provided auth middleware.
func (s *Service) RegisterRoutes(api *gin.RouterGroup, authMW gin.HandlerFunc) {
	col := api.Group("/collections", authMW)
	col.GET("", s.list)
	col.POST("", s.create)
	col.GET("/:id", s.get)
	col.PATCH("/:id", s.update)
	col.DELETE("/:id", s.delete)
	col.POST("/:id/cards", s.createCard)

	cards := api.Group("/cards", authMW)
	cards.PATCH("/:id", s.updateCard)
	cards.DELETE("/:id", s.deleteCard)
}

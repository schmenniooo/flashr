// Package collections handles collection and card CRUD. Cards are always
// accessed through their parent collection for ownership validation.
package collections

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/smithlabs/flashr/backend/internal/auth"
)

var ErrNotFound = errors.New("not found")

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Queries ─────────────────────────────────────────────────────────────────

func (s *Service) listForUser(ctx context.Context, userID string) ([]Collection, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			c.id, c.name, COALESCE(c.folder,''), c.emoji, c.description, c.is_public, c.created_at,
			k.id, k.question, k.answer, k.ai_generated, k.created_at
		FROM collections c
		LEFT JOIN cards k ON k.collection_id = c.id
		WHERE c.user_id = $1
		ORDER BY c.created_at DESC, k.created_at ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	return scanCollections(rows)
}

func (s *Service) getOne(ctx context.Context, id, userID string) (Collection, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			c.id, c.name, COALESCE(c.folder,''), c.emoji, c.description, c.is_public, c.created_at,
			k.id, k.question, k.answer, k.ai_generated, k.created_at
		FROM collections c
		LEFT JOIN cards k ON k.collection_id = c.id
		WHERE c.id = $1 AND c.user_id = $2
		ORDER BY k.created_at ASC
	`, id, userID)
	if err != nil {
		return Collection{}, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()
	cols, err := scanCollections(rows)
	if err != nil {
		return Collection{}, err
	}
	if len(cols) == 0 {
		return Collection{}, ErrNotFound
	}
	return cols[0], nil
}

func scanCollections(rows pgx.Rows) ([]Collection, error) {
	var result []Collection
	index := map[string]int{}
	for rows.Next() {
		var (
			cID, cName, cFolder, cEmoji, cDesc string
			cPublic                            bool
			cAt                                time.Time
			kID                                *string
			kQ, kA                             *string
			kAI                                *bool
			kAt                                *time.Time
		)
		if err := rows.Scan(
			&cID, &cName, &cFolder, &cEmoji, &cDesc, &cPublic, &cAt,
			&kID, &kQ, &kA, &kAI, &kAt,
		); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		if _, ok := index[cID]; !ok {
			result = append(result, Collection{
				ID: cID, Name: cName, Folder: cFolder, Emoji: cEmoji,
				Description: cDesc, IsPublic: cPublic, CreatedAt: cAt, Cards: []Card{},
			})
			index[cID] = len(result) - 1
		}
		if kID != nil {
			card := Card{ID: *kID, Question: *kQ, Answer: *kA, AIGenerated: *kAI, CreatedAt: *kAt}
			i := index[cID]
			result[i].Cards = append(result[i].Cards, card)
		}
	}
	return result, rows.Err()
}

// ─── Collection handlers ─────────────────────────────────────────────────────

func (s *Service) list(c *gin.Context) {
	cols, err := s.listForUser(c.Request.Context(), auth.UserIDFromContext(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load collections"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"collections": cols})
}

func (s *Service) get(c *gin.Context) {
	col, err := s.getOne(c.Request.Context(), c.Param("id"), auth.UserIDFromContext(c))
	if errors.Is(err, ErrNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not load collection"})
		return
	}
	c.JSON(http.StatusOK, col)
}

func (s *Service) create(c *gin.Context) {
	var body struct {
		Name        string `json:"name" binding:"required"`
		Folder      string `json:"folder"`
		Emoji       string `json:"emoji"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if body.Emoji == "" {
		body.Emoji = "📚"
	}

	var col Collection
	err := s.pool.QueryRow(c.Request.Context(), `
		INSERT INTO collections (user_id, name, folder, emoji, description)
		VALUES ($1, $2, NULLIF($3,''), $4, $5)
		RETURNING id, name, COALESCE(folder,''), emoji, description, is_public, created_at
	`, auth.UserIDFromContext(c), body.Name, body.Folder, body.Emoji, body.Description).Scan(
		&col.ID, &col.Name, &col.Folder, &col.Emoji, &col.Description, &col.IsPublic, &col.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create collection"})
		return
	}
	col.Cards = []Card{}
	c.JSON(http.StatusCreated, col)
}

func (s *Service) update(c *gin.Context) {
	var body struct {
		Name        *string `json:"name"`
		Folder      *string `json:"folder"`
		Emoji       *string `json:"emoji"`
		Description *string `json:"description"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	var col Collection
	err := s.pool.QueryRow(c.Request.Context(), `
		UPDATE collections SET
			name        = COALESCE($3, name),
			folder      = CASE WHEN $4::text IS NOT NULL THEN NULLIF($4,'') ELSE folder END,
			emoji       = COALESCE($5, emoji),
			description = COALESCE($6, description)
		WHERE id = $1 AND user_id = $2
		RETURNING id, name, COALESCE(folder,''), emoji, description, is_public, created_at
	`, c.Param("id"), auth.UserIDFromContext(c), body.Name, body.Folder, body.Emoji, body.Description).Scan(
		&col.ID, &col.Name, &col.Folder, &col.Emoji, &col.Description, &col.IsPublic, &col.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update collection"})
		return
	}
	col.Cards = []Card{}
	c.JSON(http.StatusOK, col)
}

func (s *Service) delete(c *gin.Context) {
	tag, err := s.pool.Exec(c.Request.Context(),
		`DELETE FROM collections WHERE id = $1 AND user_id = $2`,
		c.Param("id"), auth.UserIDFromContext(c),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete collection"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ─── Card handlers ────────────────────────────────────────────────────────────

func (s *Service) createCard(c *gin.Context) {
	userID := auth.UserIDFromContext(c)
	colID := c.Param("id")

	var body struct {
		Question string `json:"question" binding:"required"`
		Answer   string `json:"answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "question and answer are required"})
		return
	}

	// Verify collection ownership before inserting.
	var exists bool
	if err := s.pool.QueryRow(c.Request.Context(),
		`SELECT EXISTS(SELECT 1 FROM collections WHERE id = $1 AND user_id = $2)`,
		colID, userID,
	).Scan(&exists); err != nil || !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}

	var card Card
	err := s.pool.QueryRow(c.Request.Context(), `
		INSERT INTO cards (collection_id, question, answer)
		VALUES ($1, $2, $3)
		RETURNING id, question, answer, ai_generated, created_at
	`, colID, body.Question, body.Answer).Scan(
		&card.ID, &card.Question, &card.Answer, &card.AIGenerated, &card.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create card"})
		return
	}
	c.JSON(http.StatusCreated, card)
}

func (s *Service) updateCard(c *gin.Context) {
	var body struct {
		Question     *string `json:"question"`
		Answer       *string `json:"answer"`
		CollectionID *string `json:"collection_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	userID := auth.UserIDFromContext(c)

	// Validate target collection ownership before moving.
	if body.CollectionID != nil {
		var exists bool
		if err := s.pool.QueryRow(c.Request.Context(),
			`SELECT EXISTS(SELECT 1 FROM collections WHERE id = $1 AND user_id = $2)`,
			*body.CollectionID, userID,
		).Scan(&exists); err != nil || !exists {
			c.JSON(http.StatusNotFound, gin.H{"error": "target collection not found"})
			return
		}
	}

	var card Card
	err := s.pool.QueryRow(c.Request.Context(), `
		UPDATE cards SET
			question      = COALESCE($3, question),
			answer        = COALESCE($4, answer),
			collection_id = COALESCE($5::uuid, collection_id)
		FROM collections
		WHERE cards.id = $1
		  AND cards.collection_id = collections.id
		  AND collections.user_id = $2
		RETURNING cards.id, cards.question, cards.answer, cards.ai_generated, cards.created_at
	`, c.Param("id"), userID, body.Question, body.Answer, body.CollectionID).Scan(
		&card.ID, &card.Question, &card.Answer, &card.AIGenerated, &card.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not update card"})
		return
	}
	c.JSON(http.StatusOK, card)
}

func (s *Service) deleteCard(c *gin.Context) {
	tag, err := s.pool.Exec(c.Request.Context(), `
		DELETE FROM cards
		USING collections
		WHERE cards.id = $1
		  AND cards.collection_id = collections.id
		  AND collections.user_id = $2
	`, c.Param("id"), auth.UserIDFromContext(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not delete card"})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}
	c.Status(http.StatusNoContent)
}

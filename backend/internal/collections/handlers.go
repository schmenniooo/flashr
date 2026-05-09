package collections

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/smithlabs/flashr/backend/internal/auth"
	"github.com/smithlabs/flashr/backend/pkg/domain"
)

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

	userID := auth.UserIDFromContext(c)
	ctx := c.Request.Context()

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create collection"})
		return
	}
	defer tx.Rollback(ctx)

	// Lock the user row so concurrent requests for the same user are serialised
	// through this check, preventing the free-plan limit from being exceeded.
	var plan string
	if err := tx.QueryRow(ctx, `SELECT plan FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create collection"})
		return
	}
	if plan == domain.PlanFree {
		var count int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM collections WHERE user_id = $1`, userID).Scan(&count); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create collection"})
			return
		}
		if count >= 3 {
			c.JSON(http.StatusForbidden, gin.H{"error": "collection limit reached — upgrade to Pro for unlimited collections"})
			return
		}
	}

	var col Collection
	err = tx.QueryRow(ctx, `
		INSERT INTO collections (user_id, name, folder, emoji, description)
		VALUES ($1, $2, NULLIF($3,''), $4, $5)
		RETURNING id, name, COALESCE(folder,''), emoji, description, is_public, created_at
	`, userID, body.Name, body.Folder, body.Emoji, body.Description).Scan(
		&col.ID, &col.Name, &col.Folder, &col.Emoji, &col.Description, &col.IsPublic, &col.CreatedAt,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create collection"})
		return
	}
	if err := tx.Commit(ctx); err != nil {
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
	ctx := c.Request.Context()

	var body struct {
		Question string `json:"question" binding:"required"`
		Answer   string `json:"answer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "question and answer are required"})
		return
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create card"})
		return
	}
	defer tx.Rollback(ctx)

	// Lock user row to serialise concurrent card-creation requests.
	var plan string
	if err := tx.QueryRow(ctx, `SELECT plan FROM users WHERE id = $1 FOR UPDATE`, userID).Scan(&plan); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create card"})
		return
	}

	// Verify collection ownership.
	var exists bool
	if err := tx.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM collections WHERE id = $1 AND user_id = $2)`,
		colID, userID,
	).Scan(&exists); err != nil || !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "collection not found"})
		return
	}

	// Free plan: max 50 cards per collection.
	if plan == domain.PlanFree {
		var cardCount int
		if err := tx.QueryRow(ctx,
			`SELECT COUNT(*) FROM cards WHERE collection_id = $1`, colID,
		).Scan(&cardCount); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create card"})
			return
		}
		if cardCount >= 50 {
			c.JSON(http.StatusForbidden, gin.H{"error": "card limit reached — upgrade to Pro for unlimited cards"})
			return
		}
	}

	var card Card
	err = tx.QueryRow(ctx, `
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
	if err := tx.Commit(ctx); err != nil {
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

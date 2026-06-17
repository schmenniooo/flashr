package collections

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/smithlabs/flashr/backend/internal/srs"
)

// listForUser fetches all collections with their cards for a given user.
func (s *Service) listForUser(ctx context.Context, userID string) ([]Collection, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			c.id, c.name, COALESCE(c.folder,''), c.emoji, c.description, c.is_public, c.created_at,
			k.id, k.question, k.answer, k.ai_generated, k.created_at, k.srs_metadata
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

// getOne fetches a single collection with its cards, enforcing ownership.
func (s *Service) getOne(ctx context.Context, id, userID string) (Collection, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			c.id, c.name, COALESCE(c.folder,''), c.emoji, c.description, c.is_public, c.created_at,
			k.id, k.question, k.answer, k.ai_generated, k.created_at, k.srs_metadata
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

// scanCollections collapses a LEFT JOIN result set (one row per card) into a
// slice of Collections, each with its Cards populated.
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
			kSRS                               []byte
		)
		if err := rows.Scan(
			&cID, &cName, &cFolder, &cEmoji, &cDesc, &cPublic, &cAt,
			&kID, &kQ, &kA, &kAI, &kAt, &kSRS,
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
			card.applyMeta(parseSRSMeta(kSRS))
			i := index[cID]
			result[i].Cards = append(result[i].Cards, card)
		}
	}
	return result, rows.Err()
}

// parseSRSMeta unmarshals a JSONB srs_metadata value; returns nil if empty.
func parseSRSMeta(raw []byte) *srs.Meta {
	if len(raw) == 0 {
		return nil
	}
	var m srs.Meta
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil
	}
	return &m
}

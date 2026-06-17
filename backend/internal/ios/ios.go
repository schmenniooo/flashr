// Package ios handles iOS- and macOS-specific backend functionality:
// APNs device token registration and StoreKit 2 billing fulfillment.
package ios

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Service manages iOS device token storage.
type Service struct {
	pool *pgxpool.Pool
}

// NewService constructs a Service backed by the given connection pool.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// UpsertPushToken stores an APNs device token for a user. If the (user, token)
// pair already exists the row is left unchanged (idempotent).
func (s *Service) UpsertPushToken(ctx context.Context, userID, token, platform string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO push_tokens (user_id, token, platform)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id, token) DO NOTHING
	`, userID, token, platform)
	return err
}

// DeletePushToken removes a specific APNs token for a user (called when the
// token is invalidated or the user logs out on that device).
func (s *Service) DeletePushToken(ctx context.Context, userID, token string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM push_tokens WHERE user_id = $1 AND token = $2
	`, userID, token)
	return err
}

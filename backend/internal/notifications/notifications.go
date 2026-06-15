// Package notifications handles browser push notification subscriptions and
// the background scheduler that delivers daily study reminders.
package notifications

import (
	"context"
	"log/slog"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service manages push subscriptions and the reminder scheduler.
type Service struct {
	pool       *pgxpool.Pool
	vapidPriv  string
	vapidPub   string
	vapidEmail string
}

// Config holds VAPID credentials required for Web Push.
type Config struct {
	VAPIDPublicKey  string
	VAPIDPrivateKey string
	VAPIDEmail      string // e.g. "mailto:hello@flashr.io"
}

// NewService constructs a Service. If VAPID keys are absent, an ephemeral pair
// is generated and a warning is logged — production must supply real keys via
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars.
func NewService(pool *pgxpool.Pool, cfg Config) (*Service, error) {
	if cfg.VAPIDPublicKey == "" || cfg.VAPIDPrivateKey == "" {
		pub, priv, err := webpush.GenerateVAPIDKeys()
		if err != nil {
			return nil, err
		}
		slog.Warn("notifications: no VAPID keys configured — generated ephemeral keys; set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY for production")
		cfg.VAPIDPublicKey = pub
		cfg.VAPIDPrivateKey = priv
	}
	if cfg.VAPIDEmail == "" {
		cfg.VAPIDEmail = "mailto:hello@flashr.io"
	}
	return &Service{
		pool:       pool,
		vapidPriv:  cfg.VAPIDPrivateKey,
		vapidPub:   cfg.VAPIDPublicKey,
		vapidEmail: cfg.VAPIDEmail,
	}, nil
}

// VAPIDPublicKey returns the public VAPID key for the frontend to use when
// subscribing.
func (s *Service) VAPIDPublicKey() string { return s.vapidPub }

// ─── DB helpers ───────────────────────────────────────────────────────────────

// UpsertSubscription stores a push subscription for a user. If the same
// endpoint already exists for this user the row is left unchanged (idempotent).
func (s *Service) UpsertSubscription(ctx context.Context, userID, endpoint, p256dh, authKey string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (user_id, endpoint) DO NOTHING
	`, userID, endpoint, p256dh, authKey)
	return err
}

// DeleteSubscription removes a specific push subscription endpoint for a user.
func (s *Service) DeleteSubscription(ctx context.Context, userID, endpoint string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2
	`, userID, endpoint)
	return err
}

type subscription struct {
	UserID   string
	Endpoint string
	P256DH   string
	AuthKey  string
}

// subscriptionsForUsers returns all push subscriptions for the given user IDs.
func (s *Service) subscriptionsForUsers(ctx context.Context, userIDs []string) ([]subscription, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT user_id, endpoint, p256dh, auth_key
		FROM push_subscriptions
		WHERE user_id = ANY($1)
	`, userIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []subscription
	for rows.Next() {
		var sub subscription
		if err := rows.Scan(&sub.UserID, &sub.Endpoint, &sub.P256DH, &sub.AuthKey); err != nil {
			return nil, err
		}
		subs = append(subs, sub)
	}
	return subs, rows.Err()
}

// usersToNotifyNow returns IDs of users whose notification_time (in their
// notification_tz) matches the current hour and minute.
func (s *Service) usersToNotifyNow(ctx context.Context) ([]string, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id FROM users
		WHERE notification_time IS NOT NULL
		  AND notification_tz   IS NOT NULL
		  AND EXTRACT(HOUR   FROM (NOW() AT TIME ZONE notification_tz))
		        = EXTRACT(HOUR   FROM notification_time::time)
		  AND EXTRACT(MINUTE FROM (NOW() AT TIME ZONE notification_tz))
		        = EXTRACT(MINUTE FROM notification_time::time)
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// claimUsers inserts into notification_log for the given user IDs and today's
// date using ON CONFLICT DO NOTHING. Returns only the user IDs where the
// insert succeeded — i.e. this instance won the race and should send.
func (s *Service) claimUsers(ctx context.Context, userIDs []string) ([]string, error) {
	var claimed []string
	for _, id := range userIDs {
		tag, err := s.pool.Exec(ctx, `
			INSERT INTO notification_log (user_id, sent_date)
			VALUES ($1, CURRENT_DATE)
			ON CONFLICT DO NOTHING
		`, id)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 1 {
			claimed = append(claimed, id)
		}
	}
	return claimed, nil
}

// ─── Push sender ─────────────────────────────────────────────────────────────

func (s *Service) sendNotification(sub subscription) {
	payload := `{"title":"Time to study!","body":"Your daily flashr session is waiting.","url":"/"}`
	resp, err := webpush.SendNotification([]byte(payload), &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256DH,
			Auth:   sub.AuthKey,
		},
	}, &webpush.Options{
		VAPIDPrivateKey: s.vapidPriv,
		VAPIDPublicKey:  s.vapidPub,
		Subscriber:      s.vapidEmail,
		TTL:             3600, // retry for 1 hour if the browser is offline
	})
	if err != nil {
		slog.Warn("push send failed", "user_id", sub.UserID, "error", err)
		return
	}
	defer resp.Body.Close()

	// HTTP 410 Gone means the browser revoked the subscription — clean it up so
	// we don't keep trying on future ticks.
	if resp.StatusCode == http.StatusGone {
		_ = s.DeleteSubscription(context.Background(), sub.UserID, sub.Endpoint)
	}
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

// StartScheduler launches a background goroutine that fires every minute and
// sends push reminders to users whose notification_time matches the current
// time in their timezone. The goroutine exits cleanly when ctx is cancelled.
func (s *Service) StartScheduler(ctx context.Context) {
	go func() {
		// Align to the start of the next minute so ticks fire at :00 of each minute.
		now := time.Now()
		wait := time.Until(now.Truncate(time.Minute).Add(time.Minute))
		select {
		case <-time.After(wait):
		case <-ctx.Done():
			return
		}

		s.runBatch(ctx)

		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				s.runBatch(ctx)
			case <-ctx.Done():
				return
			}
		}
	}()
}

func (s *Service) runBatch(ctx context.Context) {
	userIDs, err := s.usersToNotifyNow(ctx)
	if err != nil {
		slog.Warn("notifications: usersToNotifyNow failed", "error", err)
		return
	}
	if len(userIDs) == 0 {
		return
	}

	// Claim atomically — only proceed for users this instance won.
	claimed, err := s.claimUsers(ctx, userIDs)
	if err != nil {
		slog.Warn("notifications: claimUsers failed", "error", err)
		return
	}
	if len(claimed) == 0 {
		return
	}

	subs, err := s.subscriptionsForUsers(ctx, claimed)
	if err != nil {
		slog.Warn("notifications: subscriptionsForUsers failed", "error", err)
		return
	}
	if len(subs) == 0 {
		return
	}

	for _, sub := range subs {
		go s.sendNotification(sub)
	}
	slog.Info("push notifications dispatched", "users", len(claimed), "subscriptions", len(subs))
}

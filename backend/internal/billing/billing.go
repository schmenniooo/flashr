package billing

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stripe/stripe-go/v76"
	portalsession "github.com/stripe/stripe-go/v76/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
	"github.com/stripe/stripe-go/v76/subscription"

	"github.com/smithlabs/flashr/backend/pkg/domain"
)

var ErrNoSubscription = errors.New("no active subscription")

type Config struct {
	SecretKey     string
	WebhookSecret string
	ProPriceID    string
	FrontendURL   string
}

type Service struct {
	pool          *pgxpool.Pool
	webhookSecret string
	proPriceID    string
	frontendURL   string
}

func NewService(pool *pgxpool.Pool, cfg Config) *Service {
	stripe.Key = cfg.SecretKey
	return &Service{
		pool:          pool,
		webhookSecret: cfg.WebhookSecret,
		proPriceID:    cfg.ProPriceID,
		frontendURL:   cfg.FrontendURL,
	}
}

// CreateCheckoutSession creates a Stripe Checkout Session for the Pro plan and
// returns the hosted URL. If the user doesn't have a Stripe customer yet, one is
// created and stored.
func (s *Service) CreateCheckoutSession(ctx context.Context, userID, userEmail string) (string, error) {
	customerID, err := s.ensureCustomer(ctx, userID, userEmail)
	if err != nil {
		return "", err
	}

	params := &stripe.CheckoutSessionParams{
		Customer: stripe.String(customerID),
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(s.proPriceID),
				Quantity: stripe.Int64(1),
			},
		},
		// {CHECKOUT_SESSION_ID} is replaced by Stripe with the actual session ID
		// so the frontend can call /billing/fulfill immediately on redirect.
		SuccessURL: stripe.String(s.frontendURL + "/app/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
		CancelURL:  stripe.String(s.frontendURL + "/app"),
	}
	sess, err := checkoutsession.New(params)
	if err != nil {
		return "", fmt.Errorf("stripe: create checkout session: %w", err)
	}
	return sess.URL, nil
}

// CreatePortalSession creates a Stripe Customer Portal session for managing or
// cancelling an existing subscription.
func (s *Service) CreatePortalSession(ctx context.Context, userID string) (string, error) {
	customerID, err := s.customerID(ctx, userID)
	if err != nil {
		return "", err
	}
	if customerID == "" {
		return "", ErrNoSubscription
	}

	params := &stripe.BillingPortalSessionParams{
		Customer:  stripe.String(customerID),
		ReturnURL: stripe.String(s.frontendURL + "/app/profile?portal=return"),
	}
	sess, err := portalsession.New(params)
	if err != nil {
		return "", fmt.Errorf("stripe: create portal session: %w", err)
	}
	return sess.URL, nil
}

// FulfillCheckout verifies a Stripe Checkout Session and immediately grants
// Pro access if the payment is confirmed. This is called directly from the
// frontend after the checkout success redirect so the plan updates even when
// webhooks are delayed or not yet configured.
func (s *Service) FulfillCheckout(ctx context.Context, sessionID, userID string) error {
	sess, err := checkoutsession.Get(sessionID, &stripe.CheckoutSessionParams{
		Params: stripe.Params{Context: ctx},
	})
	if err != nil {
		return fmt.Errorf("stripe: get session: %w", err)
	}

	// Verify the session belongs to the authenticated user via customer ID.
	if sess.Customer == nil {
		return fmt.Errorf("session has no customer")
	}
	storedCustomerID, err := s.customerID(ctx, userID)
	if err != nil {
		return err
	}
	if storedCustomerID != sess.Customer.ID {
		return fmt.Errorf("session does not belong to current user")
	}

	// Only fulfill paid sessions that created a subscription.
	if sess.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid || sess.Subscription == nil {
		return nil
	}

	// Idempotent upsert — safe to call multiple times; webhook may also run.
	_, err = s.pool.Exec(ctx, `
		UPDATE users
		SET plan = 'pro',
		    stripe_subscription_id = $1,
		    plan_expires_at = NULL
		WHERE id = $2
	`, sess.Subscription.ID, userID)
	return err
}

// SyncPlan fetches the user's active subscriptions directly from Stripe and
// writes the canonical plan state to the DB. Call this on portal return so
// cancellations and upgrades are reflected immediately without waiting for
// a webhook.
func (s *Service) SyncPlan(ctx context.Context, userID string) error {
	cid, err := s.customerID(ctx, userID)
	if err != nil || cid == "" {
		return err // no customer → no subscription → nothing to sync
	}

	// List all non-cancelled subscriptions for this customer.
	params := &stripe.SubscriptionListParams{
		Customer: stripe.String(cid),
	}
	params.Filters.AddFilter("status", "", "all")
	iter := subscription.List(params)

	plan := domain.PlanFree
	var subID string
	var expiresAt *time.Time

	for iter.Next() {
		sub := iter.Subscription()
		switch sub.Status {
		case stripe.SubscriptionStatusActive, stripe.SubscriptionStatusTrialing:
			plan = domain.PlanPro
			subID = sub.ID
			if sub.CancelAtPeriodEnd {
				t := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
				expiresAt = &t
			}
		}
		if plan == domain.PlanPro {
			break // first active subscription wins
		}
	}
	if err := iter.Err(); err != nil {
		return fmt.Errorf("stripe: list subscriptions: %w", err)
	}

	var subIDPtr *string
	if subID != "" {
		subIDPtr = &subID
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE users
		SET plan                  = $1,
		    stripe_subscription_id = $2,
		    plan_expires_at        = $3
		WHERE id = $4
	`, plan, subIDPtr, expiresAt, userID)
	return err
}

func (s *Service) ensureCustomer(ctx context.Context, userID, email string) (string, error) {
	existing, err := s.customerID(ctx, userID)
	if err != nil {
		return "", err
	}
	if existing != "" {
		return existing, nil
	}

	c, err := customer.New(&stripe.CustomerParams{
		Email: stripe.String(email),
		Metadata: map[string]string{
			"flashr_user_id": userID,
		},
	})
	if err != nil {
		return "", fmt.Errorf("stripe: create customer: %w", err)
	}

	_, err = s.pool.Exec(ctx,
		`UPDATE users SET stripe_customer_id = $1 WHERE id = $2`,
		c.ID, userID,
	)
	if err != nil {
		return "", fmt.Errorf("store stripe customer id: %w", err)
	}
	return c.ID, nil
}

func (s *Service) customerID(ctx context.Context, userID string) (string, error) {
	var id *string
	err := s.pool.QueryRow(ctx,
		`SELECT stripe_customer_id FROM users WHERE id = $1`, userID,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("lookup customer id: %w", err)
	}
	if id == nil {
		return "", nil
	}
	return *id, nil
}

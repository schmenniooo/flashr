package billing

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/stripe/stripe-go/v76"
	portalsession "github.com/stripe/stripe-go/v76/billingportal/session"
	checkoutsession "github.com/stripe/stripe-go/v76/checkout/session"
	"github.com/stripe/stripe-go/v76/customer"
)

var ErrNoSubscription = errors.New("no active subscription")

type Config struct {
	SecretKey      string
	WebhookSecret  string
	ProPriceID     string
	FrontendURL    string
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
		SuccessURL: stripe.String(s.frontendURL + "/app/profile?checkout=success"),
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

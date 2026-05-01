package billing

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/webhook"
)

func (s *Service) handleWebhook(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	event, err := webhook.ConstructEvent(body, c.GetHeader("Stripe-Signature"), s.webhookSecret)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	switch event.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			log.Printf("billing: unmarshal checkout.session.completed: %v", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleCheckoutCompleted(c.Request.Context(), &sess); err != nil {
			log.Printf("billing: checkout.session.completed: %v", err)
			c.Status(http.StatusInternalServerError)
			return
		}

	case "customer.subscription.updated":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			log.Printf("billing: unmarshal customer.subscription.updated: %v", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleSubscriptionUpdated(c.Request.Context(), &sub); err != nil {
			log.Printf("billing: customer.subscription.updated: %v", err)
			c.Status(http.StatusInternalServerError)
			return
		}

	case "customer.subscription.deleted":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			log.Printf("billing: unmarshal customer.subscription.deleted: %v", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleSubscriptionDeleted(c.Request.Context(), &sub); err != nil {
			log.Printf("billing: customer.subscription.deleted: %v", err)
			c.Status(http.StatusInternalServerError)
			return
		}
	}

	c.Status(http.StatusOK)
}

func (s *Service) handleCheckoutCompleted(ctx context.Context, sess *stripe.CheckoutSession) error {
	if sess.Subscription == nil {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = 'pro',
		    stripe_subscription_id = $1,
		    plan_expires_at = NULL
		WHERE stripe_customer_id = $2
	`, sess.Subscription.ID, sess.Customer.ID)
	return err
}

func (s *Service) handleSubscriptionUpdated(ctx context.Context, sub *stripe.Subscription) error {
	plan := "free"
	var expiresAt *time.Time

	switch sub.Status {
	case stripe.SubscriptionStatusActive, stripe.SubscriptionStatusTrialing:
		plan = "pro"
	default:
		// past_due, unpaid, paused, etc. — keep as free
		t := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
		expiresAt = &t
	}

	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = $1,
		    stripe_subscription_id = $2,
		    plan_expires_at = $3
		WHERE stripe_customer_id = $4
	`, plan, sub.ID, expiresAt, sub.Customer.ID)
	return err
}

func (s *Service) handleSubscriptionDeleted(ctx context.Context, sub *stripe.Subscription) error {
	// Keep plan active until end of billing period so the user gets what they paid for.
	expiresAt := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = 'free',
		    stripe_subscription_id = NULL,
		    plan_expires_at = $1
		WHERE stripe_customer_id = $2
	`, expiresAt, sub.Customer.ID)
	return fmt.Errorf("subscription deleted: %w", err)
}

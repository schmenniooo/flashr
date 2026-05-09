package billing

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v76"
	"github.com/stripe/stripe-go/v76/webhook"

	"github.com/smithlabs/flashr/backend/pkg/domain"
)

func (s *Service) handleWebhook(c *gin.Context) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 1<<20))
	if err != nil {
		c.Status(http.StatusBadRequest)
		return
	}

	event, err := webhook.ConstructEventWithOptions(body, c.GetHeader("Stripe-Signature"), s.webhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})
	if err != nil {
		slog.Error("billing: webhook signature error", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature"})
		return
	}

	switch event.Type {
	case "checkout.session.completed":
		var sess stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &sess); err != nil {
			slog.Error("billing: unmarshal checkout.session.completed", "error", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleCheckoutCompleted(c.Request.Context(), &sess); err != nil {
			slog.Error("billing: checkout.session.completed", "error", err)
			c.Status(http.StatusInternalServerError)
			return
		}

	case "customer.subscription.updated":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			slog.Error("billing: unmarshal customer.subscription.updated", "error", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleSubscriptionUpdated(c.Request.Context(), &sub); err != nil {
			slog.Error("billing: customer.subscription.updated", "error", err)
			c.Status(http.StatusInternalServerError)
			return
		}

	case "customer.subscription.deleted":
		var sub stripe.Subscription
		if err := json.Unmarshal(event.Data.Raw, &sub); err != nil {
			slog.Error("billing: unmarshal customer.subscription.deleted", "error", err)
			c.Status(http.StatusBadRequest)
			return
		}
		if err := s.handleSubscriptionDeleted(c.Request.Context(), &sub); err != nil {
			slog.Error("billing: customer.subscription.deleted", "error", err)
			c.Status(http.StatusInternalServerError)
			return
		}

	default:
		// Unhandled event type — acknowledge so Stripe stops retrying.
	}

	c.Status(http.StatusOK)
}

func (s *Service) handleCheckoutCompleted(ctx context.Context, sess *stripe.CheckoutSession) error {
	if sess.Subscription == nil {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = $1,
		    stripe_subscription_id = $2,
		    plan_expires_at = NULL
		WHERE stripe_customer_id = $3
	`, domain.PlanPro, sess.Subscription.ID, sess.Customer.ID)
	return err
}

func (s *Service) handleSubscriptionUpdated(ctx context.Context, sub *stripe.Subscription) error {
	plan := domain.PlanFree
	var expiresAt *time.Time

	switch sub.Status {
	case stripe.SubscriptionStatusActive, stripe.SubscriptionStatusTrialing:
		plan = domain.PlanPro
		if sub.CancelAtPeriodEnd {
			// Subscription will not renew — keep pro access until period ends.
			t := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
			expiresAt = &t
		}
	default:
		t := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
		expiresAt = &t
	}

	// Match on subscription ID so events for other/old subscriptions don't overwrite the plan.
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = $1,
		    plan_expires_at = $2
		WHERE stripe_subscription_id = $3
	`, plan, expiresAt, sub.ID)
	return err
}

func (s *Service) handleSubscriptionDeleted(ctx context.Context, sub *stripe.Subscription) error {
	// Keep plan active until end of billing period so the user gets what they paid for.
	expiresAt := time.Unix(sub.CurrentPeriodEnd, 0).UTC()
	// Match on subscription ID — only downgrade the user whose subscription was actually deleted.
	_, err := s.pool.Exec(ctx, `
		UPDATE users
		SET plan = $1,
		    stripe_subscription_id = NULL,
		    plan_expires_at = $2
		WHERE stripe_subscription_id = $3
	`, domain.PlanFree, expiresAt, sub.ID)
	return err
}

-- Billing fields required for Phase 1.5 Stripe integration.
-- plan is read by all feature-gate checks; stripe_* fields are managed by webhook handler.
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMPTZ;

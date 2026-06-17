-- APNs device tokens for iOS and macOS push notifications.
CREATE TABLE push_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT        NOT NULL,
    platform   TEXT        NOT NULL CHECK (platform IN ('ios', 'macos')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, token)
);

-- Tracks whether the active subscription originated from Stripe (web) or Apple (iOS).
ALTER TABLE users ADD COLUMN billing_source TEXT CHECK (billing_source IN ('stripe', 'apple'));

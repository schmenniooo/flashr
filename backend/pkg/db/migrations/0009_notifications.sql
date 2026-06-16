ALTER TABLE users
    ADD COLUMN notification_time TEXT,
    ADD COLUMN notification_tz   TEXT;

CREATE TABLE push_subscriptions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT        NOT NULL,
    p256dh     TEXT        NOT NULL,
    auth_key   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, endpoint)
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions(user_id);

-- One row per user per day; claimed atomically before sending to prevent
-- duplicate notifications across multiple backend instances.
CREATE TABLE notification_log (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sent_date DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (user_id, sent_date)
);

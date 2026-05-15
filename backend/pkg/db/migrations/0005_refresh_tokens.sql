-- Refresh token store for JWT rotation (Phase 1.1).
-- token_hash is SHA-256(raw_token_hex) — raw token lives only in the http-only cookie.
-- Rows are deleted on use (rotation) or explicit logout; expired rows are inert.
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT UNIQUE NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_id_idx  ON refresh_tokens(user_id);
CREATE INDEX refresh_tokens_expires_idx  ON refresh_tokens(expires_at);

-- Email/password authentication. password_hash is nullable so OAuth-only
-- users (Phase 1.1 — Google/Apple/GitHub) can coexist without a password.
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Case-insensitive lookup by email during login.
CREATE UNIQUE INDEX users_email_lower_idx ON users (LOWER(email));

-- Phase 0 schema. See ROADMAP.md.
-- Fields kept deliberately for later phases: cards.srs_metadata (V2 SRS),
-- collections.is_public (V2 sharing), upload_jobs (async AI processing).

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email          TEXT UNIQUE NOT NULL,
    name           TEXT,
    oauth_provider TEXT,
    streak         INTEGER NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE collections (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    folder     TEXT,
    is_public  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX collections_user_id_idx ON collections(user_id);

CREATE TABLE cards (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    question      TEXT NOT NULL,
    answer        TEXT NOT NULL,
    srs_metadata  JSONB,
    ai_generated  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX cards_collection_id_idx ON cards(collection_id);

CREATE TABLE collection_cards (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    card_id       UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    PRIMARY KEY (collection_id, card_id)
);

CREATE TABLE upload_jobs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path  TEXT,
    status     TEXT NOT NULL DEFAULT 'pending',
    result     JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX upload_jobs_user_id_idx ON upload_jobs(user_id);
CREATE INDEX upload_jobs_status_idx ON upload_jobs(status);

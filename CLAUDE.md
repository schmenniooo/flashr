# flashr

> **Main language: English.** All UI copy, documentation, code, commits, and communication are in English. flashr is built for global usage.

AI-powered Flashcard SaaS. Users create flashcards, organize them into collections, and auto-generate them from existing notes (GoodNotes, Notability, PDFs) via AI.

**Stack:** React · Go (Monolith) · PostgreSQL · Railway · Ollama (self-hosted on Railway)
**Domain:** flashr.io

## Project Documents

Before making changes, consult these canonical documents:

- [ROADMAP.md](ROADMAP.md) — Full product roadmap: phases (Foundation → MVP → Growth → Native Mobile → Platform), database schema, Go package structure, and forward-looking architecture constraints. The roadmap is the source of truth for what to build and — importantly — what schema fields / packages to scaffold now even if they belong to later phases (`srs_metadata`, `is_public`, `upload_jobs`, `srs/` and `sharing/` packages).
- [GUIDELINES.md](GUIDELINES.md) — Brand & design system: color tokens, typography (DM Sans), component styles, spacing scale, iconography (Lucide), motion, voice & tone. Any UI work must use these tokens and rules.

## Working Rules

- Treat ROADMAP.md as authoritative for scope and architecture. If requirements change, update the roadmap rather than diverging silently.
- All UI/visual work must use the tokens and components defined in GUIDELINES.md — no ad-hoc colors, fonts, or radii.
- Everything is in English — UI copy, product language, dev communication, commits, comments, PRs, docs.
- Address the user informally (second person, "you") — friendly and direct, not corporate.
- Write the product name as `flashr` (always lowercase).
- These rules (including the roadmap and brand guidelines) can be broken if the user explicitly instructs you to do so — user instructions override the documents.

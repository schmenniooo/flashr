# flashr

> **Main language: English.** All UI copy, documentation, code, commits, and communication are in English. flashr is built for global usage.

AI-powered Flashcard SaaS. Users create flashcards, organize them into collections, and auto-generate them from existing notes (GoodNotes, Notability, PDFs) via AI.

**Stack:** React · Go (Monolith) · PostgreSQL · Railway · Ollama (self-hosted on Railway)
**Domain:** flashr.io

## Project Documents

Before making changes, consult these canonical documents:

- [ROADMAP.md](ROADMAP.md) — Full product roadmap: phases (Foundation → MVP → Growth → Native Mobile → Platform), database schema, Go package structure, and forward-looking architecture constraints. The roadmap is the source of truth for what to build and — importantly — what schema fields / packages to scaffold now even if they belong to later phases (`srs_metadata`, `is_public`, `upload_jobs`, `srs/` and `sharing/` packages).
- [GUIDELINES.md](GUIDELINES.md) — Brand & design system: color tokens, typography (DM Sans), component styles, spacing scale, iconography (Lucide), motion, voice & tone. Any UI work must use these tokens and rules.

## Testing

### Frontend — Playwright e2e (`web/e2e/`)

- **Runner:** Playwright (`@playwright/test`)
- **Commands:** `npm run test:e2e` · `npm run test:e2e:ui` · `npm run test:e2e:headed`
- **Server:** tests run against `npm run build && npm run preview` on port 4173 — no dev server, no Vite proxy
- **Auth:** `signInAsDemo(page)` from `e2e/fixtures.ts` — fully in-memory, no backend required (the demo user lives in the Zustand store)
- **API mocking:** use `page.route("**/api/...")` for any endpoint that requires a real backend or Ollama; routes are matched LIFO so a second `page.route` call overrides the first for subsequent requests
- **Selectors:** prefer roles (`getByRole`) and labels; fall back to CSS class selectors (`.up__draft`, `.up__save-bar`, etc.) for flashr-specific UI elements that have no semantic role
- **Projects:** `chromium-desktop` (1280×800) runs all non-mobile specs; `chromium-mobile` (Pixel 7) runs `*.mobile.spec.ts` only
- **Spec files:** `auth.spec.ts`, `collections.spec.ts`, `folders.spec.ts`, `search.spec.ts`, `navigation.mobile.spec.ts`, `ai-chat.spec.ts`

### Backend — Go tests (`backend/test/`)

- **Runner:** standard `go test ./...`
- **Unit tests:** `test/unit/` — no database, test logic in isolation (AI prompt parsing, auth helpers, upload validation)
- **Integration tests:** `test/integration/` — require a real PostgreSQL instance; helpers in `test/testutil/db.go` spin up a clean DB per suite
- **No Ollama in tests:** AI client is never called in tests; pass `nil` as the `*ai.Client` to `upload.NewService` to exercise the "not configured" path, or mock at the HTTP level

## Working Rules

- Treat ROADMAP.md as authoritative for scope and architecture. If requirements change, update the roadmap rather than diverging silently.
- All UI/visual work must use the tokens and components defined in GUIDELINES.md — no ad-hoc colors, fonts, or radii.
- Everything is in English — UI copy, product language, dev communication, commits, comments, PRs, docs.
- Address the user informally (second person, "you") — friendly and direct, not corporate.
- Write the product name as `flashr` (always lowercase).
- These rules (including the roadmap and brand guidelines) can be broken if the user explicitly instructs you to do so — user instructions override the documents.

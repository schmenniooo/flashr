# flashr

> AI-powered flashcard SaaS — turn your notes into study-ready cards automatically.

**flashr** lets you create flashcards, organize them into collections, and auto-generate them from PDFs or notes (GoodNotes, Notability) via a self-hosted AI model. Built for serious learners who want a premium Anki alternative with native AI and cloud sync.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · React Router 7 · TypeScript 6 · Vite 8 |
| Backend | Go (monolith) · PostgreSQL |
| AI | Ollama (self-hosted, `llama3.2:3b`) |
| Payments | Stripe |
| Auth | JWT · Google OAuth |
| Deployment | Railway |

---

## Features

- **Flashcard management** — create, edit, and delete cards; organize into collections and folders
- **AI card generation** — upload a PDF or chat with the AI to generate cards from any topic
- **Spaced repetition** — study mode with mastery tracking (SRS Phase 2 in progress)
- **Google OAuth** — sign in with Google or email/password
- **Stripe billing** — free and Pro plans with immediate post-redirect plan sync
- **Responsive UI** — full sidebar layout on desktop, drawer nav on mobile

---

## Getting Started (Local)

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Node.js 20+
- Go 1.22+

### 1. Configure environment

Create a `.env` file at the repo root:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

All other variables (ports, DB URL, JWT secret) have working defaults in `docker-compose.yml`.

### 2. Start backend services

```sh
docker compose up --build
```

This starts:
- **PostgreSQL** on `localhost:5432`
- **Ollama** on `localhost:11434` (pulls `llama3.2:3b` on first boot — takes a few minutes)
- **Backend API** on `localhost:8080` (runs DB migrations automatically on boot)

### 3. Start the frontend

```sh
cd web
npm install
npm run dev
```

The app is now at [http://localhost:5173](http://localhost:5173).

---

## Project Structure

```
flashr/
├── backend/               # Go monolith
│   ├── cmd/server/        # Entry point (main.go)
│   ├── internal/
│   │   ├── ai/            # Ollama client
│   │   ├── auth/          # JWT + OAuth handlers
│   │   ├── billing/       # Stripe checkout, portal, webhooks
│   │   ├── cards/         # Card CRUD
│   │   ├── collections/   # Collection CRUD
│   │   ├── sharing/       # Public sharing (Phase 3 scaffold)
│   │   ├── srs/           # Spaced repetition (Phase 2 scaffold)
│   │   └── upload/        # PDF → AI card pipeline
│   └── pkg/
│       ├── config/        # Env var loading
│       ├── db/            # PostgreSQL connection + migrations
│       └── storage/       # File storage (Railway volume / S3)
│
├── web/                   # React frontend
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level page components
│       ├── lib/           # API client, state store, utilities
│       ├── types/         # Shared TypeScript types
│       └── styles/        # CSS design tokens
│
├── infra/                 # Infrastructure config (Ollama Dockerfile)
├── docker-compose.yml
├── ROADMAP.md             # Product roadmap and architecture decisions
└── GUIDELINES.md          # Brand, design tokens, component rules
```

---

## Running Tests

**Frontend (vitest):**
```sh
cd web
npm test              # single run
npm run test:watch    # watch mode
```

**Frontend (Playwright E2E):**
```sh
cd web
npm run test:e2e         # headless
npm run test:e2e:headed  # with browser window
```

E2E tests run against a production build on port 4173. No backend required — API calls are mocked via `page.route`.

**Backend (Go):**
```sh
cd backend
go test ./...
```

Integration tests require a running PostgreSQL instance. Unit tests have no external dependencies.

---

## Deployment

flashr is deployed on [Railway](https://railway.app/):

- **`api.flashr.io`** — Go backend (auto-deploys from `main`)
- **`flashr.io`** — React frontend (served as static build)
- **Ollama** — self-hosted on Railway, bootstraps its own model on first run

DB migrations run automatically on backend boot. No manual migration step needed.

---

## Documentation

- [ROADMAP.md](ROADMAP.md) — phases, database schema, package structure, and forward-looking architecture decisions
- [GUIDELINES.md](GUIDELINES.md) — brand identity, color tokens, typography, and component patterns
- [PRICING.md](PRICING.md) — plan tiers and feature gates

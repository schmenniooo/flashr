(This document may be updated as requirements change during the project.)

> **Main language: English.** flashr is built for global usage. All UI copy, docs, and code are in English. (Legacy German sections below will be translated incrementally.)

# flashr — Product Roadmap

> Dieses Dokument gibt dem Coding Agent einen vollständigen Überblick über alle geplanten Features. **Ziel:** Skalierbaren, zukunftssicheren Code schreiben — auch wenn ein Feature noch nicht implementiert ist.

---

## Produkt-Übersicht

**flashr** ist eine AI-powered Flashcard SaaS-App. User können Karteikarten erstellen, in Collections organisieren und durch KI automatisch aus bestehenden Notizen (GoodNotes, Notability, PDFs) generieren lassen.

**Stack:** React · Go (Monolith) · PostgreSQL · Railway · Ollama (self-hosted on Railway)  
**Domain:** flashr.io

---

## Phase 0 — Foundation (Pre-MVP)

> Infrastruktur & Architektur-Grundlagen. Kein Feature-Code ohne diese Basis.

- [x] Projekt-Setup: Go Monolith, Railway Deployment, PostgreSQL
- [x] Datenbankschema (siehe unten) — extended with `emoji`, `description` on collections and `password_hash` on users
- [x] Environment Config (dev / staging / prod) — PORT, DATABASE_URL, JWT_SECRET, OLLAMA_URL, ALLOWED_ORIGINS read from env in `main.go`
- [ ] Deploy to Railway + connect GitHub repo — Railway auto-deploys on every push to `main`, so this is the CI/CD pipeline
- [x] Logging & Error Handling Grundstruktur — `slog` JSON structured logging, per-request correlation IDs (`X-Request-Id`), structured JSON error responses from all handlers
- [ ] Railway Buckets für temporären File-Storage (PDFs) — `pkg/storage` is a stub
- [x] Ollama auf Railway deployen & Health-Check — `pingOllama` on startup + `/api/health` reports Ollama status; deployment itself is infra

### Datenbankschema (PostgreSQL)

```sql
-- Nutzer
users (
  id             UUID PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT,
  oauth_provider TEXT,           -- "google" | "apple" | "github"
  streak         INTEGER DEFAULT 0,
  created_at     TIMESTAMP DEFAULT NOW()
)

-- Collections (Ordner für Karteikarten)
collections (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id),
  name       TEXT NOT NULL,
  folder     TEXT,              -- optionale Ordner-Gruppierung
  is_public  BOOLEAN DEFAULT FALSE,  -- für späteres Sharing (V2)
  created_at TIMESTAMP DEFAULT NOW()
)

-- Karteikarten
cards (
  id              UUID PRIMARY KEY,
  collection_id   UUID REFERENCES collections(id),
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  srs_metadata    JSONB,         -- für Spaced Repetition (V2): interval, ease_factor, due_date
  ai_generated    BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
)

-- Many-to-Many: Cards ↔ Collections
collection_cards (
  collection_id UUID REFERENCES collections(id),
  card_id       UUID REFERENCES cards(id),
  PRIMARY KEY (collection_id, card_id)
)

-- AI Upload Jobs (für spätere Async-Verarbeitung)
upload_jobs (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id),
  file_path   TEXT,
  status      TEXT DEFAULT 'pending',  -- pending | processing | done | error
  result      JSONB,
  created_at  TIMESTAMP DEFAULT NOW()
)
```

> **Agent-Hinweis:** `srs_metadata` und `is_public` sind absichtlich von Anfang an im Schema — auch wenn sie im MVP noch nicht genutzt werden. Nicht entfernen.

---

## Phase 0.5 — Legal & DSGVO (Pre-Launch Required)

> SmithLabs is a German company → DSGVO applies automatically from day one, regardless of company size. Fines up to **€20M or 4% of annual revenue**. Abmahnung risk in DE is real even for small apps. All items below must be completed before public launch.

### Required pages

| Page | Route | Status |
|---|---|---|
| Impressum | `/impressum` | ❌ missing |
| Datenschutzerklärung | `/datenschutz` | ❌ missing |
| AGB | `/agb` | ⚠️ recommended (payments active) |

- [x] Create `/imprint` route and page
- [x] Create `/privacy` route and page
- [x] Create `/terms` route and page (Stripe is live)
- [x] Add Imprint, Privacy Policy, and Terms links to the landing page footer

### Google Fonts — self-hosting required

Loading Google Fonts via Google CDN transmits the user's IP address to US servers without consent. This was ruled a DSGVO violation by LG München in 2022 (Az. 3 O 17493/20).

- [x] Remove Google Fonts `<link>` tags from `index.html`
- [x] Self-host DM Sans via `@fontsource/dm-sans` (npm package, bundled by Vite) — weights 400, 600, 700 imported in `main.tsx`. No external font requests at runtime.

### Railway — Auftragsverarbeitungsvertrag (AVV)

Railway is a US provider. A server location alone is not sufficient for DSGVO compliance — a Data Processing Agreement (AVV) is required.

- [ ] Sign AVV with Railway (available in their dashboard)
- [ ] Set EU region in Railway service settings

### Cookie banner

No cookie banner is required as long as no tracking tools are used.

- If analytics are added: use a privacy-friendly, EU-hosted tool such as [Plausible](https://plausible.io) — no cookie banner required
- Do **not** add Google Analytics without a cookie consent banner

---

## Phase 1 — MVP

> Ziel: Funktionierendes Kernprodukt das echte User verwenden können.

### 1.1 Auth

- [x] OAuth 2.0 Login: Google, GitHub — Apple not yet supported
- [x] Email/password signup + login — not in original spec (OAuth-only was planned) but fully implemented: bcrypt hashing, unique email index, error messages
- [x] JWT Session Management — backend issues signed HS256 tokens, frontend stores as `flashr:token:v1`, sends as `Authorization: Bearer`, validated on every protected route
- [ ] Refresh Token Rotation
- [x] Logout / Session Invalidation — token removed from localStorage, local session cleared
- [x] User-Profil-Seite (Name, Avatar, E-Mail) — `Profile.tsx` wired to real user data from store

### 1.2 Collections & Ordner

- [x] Collection erstellen, umbenennen, löschen — full CRUD on backend + frontend store
- [x] Ordner-System zur Gruppierung von Collections — folder label on collections; local folder list derived from backend data; delete folder PATCHes all affected collections
- [x] Karteikarten manuell erstellen (Frage + Antwort) — `POST /collections/:id/cards`
- [x] Karteikarten bearbeiten & löschen — `PATCH /cards/:id`, `DELETE /cards/:id`
- [x] Karteikarten innerhalb einer Collection anzeigen — `CollectionDetail.tsx` with full card list
- [x] Basis-Lernmodus: Karte aufdecken, weiter blättern — `Study.tsx` with keyboard shortcuts (space, arrows)

### 1.3 KI-Generierung (Ollama)

- [x] PDF-Upload über File-Import — drag-and-drop + click-to-pick in `Upload.tsx`; `POST /api/ai/upload` (multipart, auth-gated, 20 MB limit)
- [x] PDF temporär in Railway Buckets speichern — decision: processed fully in-memory (no disk/bucket write needed); `pkg/storage` stub retained for future use
- [x] PDF-Text extrahieren & an Ollama senden — `ledongthuc/pdf` extracts text page-by-page; sent to Ollama via `internal/ai`
- [x] Ollama generiert Frage-Antwort-Paare aus dem Text — `internal/ai/ai.go` prompt-engineered for concise, varied cards; JSON parsed from response
- [x] User reviewt generierte Karten vor dem Speichern — review step in `Upload.tsx` with keep/skip toggles
- [x] User kann einzelne Karten vor dem Speichern bearbeiten / löschen — inline textarea edit + trash toggle per card
- [x] Karten nach Bestätigung in gewählte Collection speichern — saves to chosen or new collection; cards marked `ai_generated = true`
- [x] Temporäre PDF-Datei nach Verarbeitung löschen — no file is written; in-memory processing means nothing to delete

### 1.4 AI Chat — Generate Cards from a Topic

> For users who don't have a PDF but want to study a topic. The user describes what they want to learn (e.g. "AWS S3 and IAM concepts for the Cloud Practitioner exam") and the AI generates a deck of cards from scratch.

- [x] Chat-style input on the Upload/Create page: free-text prompt describing the topic, target level, and card count
- [x] Backend endpoint `POST /ai/generate` — sends the prompt to Ollama, returns a list of question-answer pairs
- [x] Same review flow as PDF-generated cards: user reviews, edits, or deletes individual cards before saving
- [x] Cards saved to a new or existing collection with `ai_generated = true`
- [x] Ollama prompt engineered for flashcard quality: concise answers, no padding, varied question types

**UX note:** This is the primary entry point for users without notes — position it prominently alongside the PDF upload option.

### 1.5 Billing & Subscriptions (Stripe)

> Free vs. Pro plan enforcement. No annual plan at launch — monthly only.

**Schema additions required:**

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';  -- 'free' | 'pro'
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT UNIQUE;
ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMP;
```

**Backend — `internal/billing` package:**

- [x] Stripe SDK integrated (`github.com/stripe/stripe-go/v76`)
- [x] `POST /api/billing/checkout` — creates a Stripe Checkout Session and returns the URL
- [x] `POST /api/billing/portal` — creates a Stripe Customer Portal session
- [x] `POST /api/billing/webhook` — handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [x] Plan enforcement middleware — `plan` embedded in JWT claim, read from context; `RequirePro` checks JWT with no extra DB query
- [x] Feature gates: AI generation gated by `RequirePro`; collection (3) and card (50) limits enforced server-side with TOCTOU-safe `FOR UPDATE` transactions

**Frontend:**

- [x] Upgrade prompt shown when a Free user hits a plan limit (collections, cards, AI)
- [x] "Upgrade to Pro" CTA in profile/settings page — calls `/api/billing/checkout`, redirects to Stripe
- [x] "Manage subscription" link in profile — calls `/api/billing/portal`
- [x] Plan badge shown in profile (Free / Pro)
- [x] Post-checkout success redirect back to `/app/profile?checkout=success` with confirmation banner

**Environment variables to add:**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
```

**Architecture note:** Webhook handler must be registered *without* auth middleware (Stripe signs payloads via `STRIPE_WEBHOOK_SECRET`, not JWT). Validate signature with `webhook.ConstructEvent` before processing.

**Roadmap:** V2 adds an annual plan (~€4.90/mo, ~39% discount) — add a second `STRIPE_PRO_ANNUAL_PRICE_ID` env var at that point.

### 1.6 App-Integrationen (File Import)

- [ ] Import via Share-Sheet (iOS/iPadOS): GoodNotes, Notability, Word, Pages
- [ ] Import via File-Picker: PDF, .docx
- [ ] Datei-Validierung (Typ, Größe, Sicherheit)

### 1.7 Extended File Format Support

> Expand the AI card generation pipeline beyond PDFs to cover the formats students actually use day-to-day.

**Import formats:**

| Format | Extension | Parsing approach |
|---|---|---|
| Markdown | `.md` | Parse as plain text — headings become card hints; strip syntax before sending to Ollama |
| Word | `.docx` | Extract raw text via `unzip` + `word/document.xml` parsing (no Office dependency) |
| PowerPoint | `.pptx` | Extract slide text from `ppt/slides/slide*.xml`; each slide treated as a content chunk |
| Anki package | `.apkg` | SQLite-backed zip — extract `notes` table (`flds` column) and convert front/back pairs directly into flashr cards (no AI needed) |

**Backend:**
- [ ] Add MIME-type detection at the `POST /api/ai/upload` boundary — reject unsupported types early
- [ ] `internal/upload`: add `ParseMarkdown`, `ParseDocx`, `ParsePptx`, `ParseApkg` functions
- [ ] `.apkg` import path bypasses Ollama entirely — cards are extracted 1:1 and go straight to the review step
- [ ] Extend `upload_jobs.result` schema with `source_format` field for analytics

**Frontend:**
- [ ] Update file-picker `accept` attribute: `.pdf,.md,.docx,.pptx,.apkg`
- [ ] Show a format badge on each draft card (`From PDF`, `From Anki`, etc.)
- [ ] `.apkg` import: skip the AI loading state and jump directly to the review step

### 1.6 UI / UX

- [x] Dashboard: Übersicht aller Collections — hero session card, stats, recent collections, suggestions, activity feed; all real data
- [x] Collection-Detail-View mit Kartenliste — `CollectionDetail.tsx` with edit/delete per card, collection metadata, progress bar
- [x] Lern-View (Karte aufdecken, navigieren) — `Study.tsx` with flip animation, keyboard shortcuts, session summary screen
- [x] KI-Upload-Flow (Upload → Review → Speichern) — `Upload.tsx` fully wired: real file pick/drag, processing spinner, review with edit/skip, save to collection
- [x] Responsive Design (Mobile-first, aber Web-App) — sidebar hidden ≥881px; drawer + backdrop + Escape/route auto-close ≤880px
- [x] Brand Design System aus `flashr-brand-guidelines.md` — `tokens.css`, DM Sans, Lucide icons, spacing scale applied throughout

---

## Phase 2 — Growth Features

> Nach erfolgreichem MVP-Launch. Reihenfolge nach User-Feedback priorisieren.

### 2.1 Gamification & Retention

- [ ] **Streak-System:** Tägliche Lernstreak tracken & anzeigen
- [ ] **Ranglisten:** Leaderboard nach Streak / gelernten Karten
- [ ] **Achievements / Badges:** Meilensteine belohnen
- [ ] Push-Notifications / Reminder (Web + später Mobile)

### 2.2 Collection Sharing

> The `is_public` flag on `collections` and the `sharing/` package are already scaffolded — this phase wires them up.

**Schema additions:**

```sql
-- Share tokens: one per collection, revocable
collection_share_tokens (
  id             UUID PRIMARY KEY,
  collection_id  UUID REFERENCES collections(id) ON DELETE CASCADE,
  token          TEXT UNIQUE NOT NULL,   -- URL-safe random token (32 bytes)
  created_by     UUID REFERENCES users(id),
  permission     TEXT NOT NULL DEFAULT 'view',  -- 'view' | 'clone'
  expires_at     TIMESTAMP,              -- NULL = no expiry
  created_at     TIMESTAMP DEFAULT NOW()
)
```

**Backend — `internal/sharing`:**
- [ ] `POST /api/collections/:id/share` — generate a share token, return `flashr.io/s/[token]`
- [ ] `DELETE /api/collections/:id/share` — revoke the active token
- [ ] `GET /api/s/:token` — resolve token → return collection metadata + cards (no auth required for `view` tokens)
- [ ] `POST /api/s/:token/clone` — authenticated users clone the collection into their own account
- [ ] Set `is_public = true` on the collection when a share token is created; `false` when revoked

**Frontend:**
- [ ] "Share" button on collection detail view — generates link and copies it to clipboard
- [ ] Share modal: shows the active link, permission level, optional expiry, and a revoke button
- [ ] Public collection view at `/s/[token]` — read-only card list with a "Clone to my account" CTA
- [ ] Clone flow: prompts for target folder, saves collection with `ai_generated = false`

**Constraints:**
- Free users can share but not receive clones beyond their 3-collection limit
- A collection can have at most one active share token at a time

### 2.3 Export

- [ ] Export als Anki-Deck (`.apkg`)
- [ ] Export als CSV
- [ ] Export als PDF (printbare Karteikarten)

### 2.4 Spaced Repetition (SRS)

- [ ] SM-2 Algorithmus implementieren (basiert auf `srs_metadata` in DB)
- [x] Lernmodus mit "Wieder", "Schwer", "Gut", "Einfach" Buttons — UI done in `Study.tsx`; mastery tracked locally in localStorage; SM-2 scoring not yet wired
- [ ] Due-Date-System: Karten erscheinen wenn sie fällig sind
- [ ] Lernfortschritt-Dashboard (Karten fällig heute, diese Woche etc.)

### 2.5 Erweiterte KI-Features

- [ ] Verschiedene Kartentypen: Multiple Choice, Lückentext, Cloze
- [ ] KI-Qualitätsbewertung der generierten Karten
- [ ] Karten aus Text-Input (not just PDF — basic version shipped in Phase 1.4; this extends it with richer formatting and multi-turn refinement)
- [ ] Multi-turn chat: user can ask the AI to add more cards, adjust difficulty, or focus on a subtopic after the initial generation
- [ ] Karten aus Bild/Screenshot (OCR → KI)
- [ ] KI-gestützte Karten-Verbesserungsvorschläge

### 2.6 AI Exam Mode

> Unlike the standard study mode (flip a card, self-assess), Exam Mode simulates a real exam. The AI generates open-ended questions on a topic, the user answers by typing or speaking, and the AI evaluates the response and gives feedback.

**User flow:**
1. User enters a topic or selects an existing collection as context
2. Selects difficulty level and number of questions
3. AI generates exam-style questions (open-ended, not just the card's `answer` field)
4. User answers each question by **typing** or **speaking** (Web Speech API, browser-native — no backend streaming required)
5. AI evaluates each answer: correct / partially correct / incorrect, with a short explanation
6. End screen shows score, time taken, and a breakdown per question

**Backend — new endpoint in `internal/ai`:**
- [ ] `POST /api/ai/exam/generate` — accepts `{ topic, collection_id?, difficulty, count }`, returns list of `{ question, expected_key_points[] }`
- [ ] `POST /api/ai/exam/evaluate` — accepts `{ question, key_points[], user_answer }`, returns `{ verdict, score, feedback }` — Ollama prompt compares the user's answer against key points, not a rigid string match
- [ ] Exam sessions are stateless on the backend (evaluation is per-question); no DB table needed in Phase 2

**Frontend — new `ExamMode` page / modal:**
- [ ] Topic input + difficulty selector (Beginner / Intermediate / Advanced) + question count slider
- [ ] Per-question view: question text, text area for typed answer, microphone button for speech input
- [ ] Speech input: `window.SpeechRecognition` (browser-native) — transcribed text fills the answer field; no backend audio upload
- [ ] "Submit answer" → spinner → AI feedback card (verdict badge + explanation)
- [ ] Progress bar across questions, skip button, time elapsed counter
- [ ] Results screen: overall score, per-question breakdown, option to save weak questions as a new collection

**Schema (optional, for saving results):**
```sql
exam_sessions (
  id            UUID PRIMARY KEY,
  user_id       UUID REFERENCES users(id),
  topic         TEXT,
  score         INTEGER,    -- 0–100
  question_count INTEGER,
  results       JSONB,      -- [{question, user_answer, verdict, feedback}]
  created_at    TIMESTAMP DEFAULT NOW()
)
```

**Constraints:**
- Exam Mode is a Pro-only feature
- Speech input degrades gracefully: if `SpeechRecognition` is unavailable (Firefox, non-HTTPS), the mic button is hidden and text input is the only option
- Evaluation latency depends on Ollama — show a per-question spinner; don't block all questions at once

---

## Phase 3 — iPhone & iPad App (iOS Native)

> Separate project, built on top of the existing Go API. iOS-first — Android is Phase 4. The iPad is the primary target because that's where GoodNotes and Notability users live.

**Tech:**
- Swift + SwiftUI (iOS 17+)
- Shared Go API — no backend changes needed beyond CORS and push notification endpoints
- Local persistence: Core Data for offline card cache; CloudKit sync as a future option

### 3.1 Core App (iPhone)

- [ ] Auth: email/password login + Google Sign-In via `GoogleSignIn-iOS` SDK
- [ ] Full feature parity with the web app: collections, folders, card CRUD, study mode
- [ ] Offline mode — cards cached locally in Core Data; sync on next network connection
- [ ] Pull-to-refresh, swipe-to-delete, long-press context menus (native feel, not a web wrapper)
- [ ] AI card generation: topic input + PDF pick from Files app → same backend pipeline
- [ ] AI Exam Mode (Phase 2.6) — text + native `SFSpeechRecognizer` for speech input
- [ ] Study mode with flip animation, haptic feedback on card reveal and mastery rating

### 3.2 iPad-Specific Features

> The iPad is the GoodNotes/Notability user's primary device. These features are the core differentiator.

- [ ] **Share Sheet extension** — user shares a PDF or note from GoodNotes/Notability directly to flashr; the extension uploads to `POST /api/ai/upload` in the background and shows a badge when cards are ready
- [ ] **Split View & Slide Over** — app is fully usable in 50/50 split alongside GoodNotes (no minimum width constraint)
- [ ] **Sidebar navigation** — iPad layout uses a persistent sidebar (UISplitViewController) matching the web app's structure
- [ ] **Drag and drop** — drag a PDF from Files into the flashr window to trigger card generation
- [ ] **Apple Pencil** — handwriting input field in card editor (converts strokes to text via `VisionKit` live text)
- [ ] **Stage Manager support** — resizable floating window, no fixed aspect ratio

### 3.3 Notifications & Widgets

- [ ] Push notifications: daily study reminders, streak warnings (backend needs `POST /api/users/push-token` endpoint to store APNs device tokens)
- [ ] Home Screen widget (WidgetKit): streak count + cards due today
- [ ] Lock Screen widget: streak flame icon + due count
- [ ] Interactive widget (iOS 17): flip a card directly from the Home Screen

### 3.4 App Store

- [ ] App Store listing: screenshots, preview video, description
- [ ] In-App Purchase for Pro plan via StoreKit 2 — synced with Stripe via backend webhook (one source of truth: the Go DB `plan` field)
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) — required for App Store submission as of Spring 2024
- [ ] TestFlight beta before public release

---

## Phase 4 — Platform & Scale

> Langfristige Vision. Nur relevant wenn starkes User-Wachstum vorhanden.

- [ ] **Teams / Workspaces:** Gruppen-Accounts für Schulen, Universitäten
- [ ] **API für Drittanbieter:** Öffentliche REST API für Integrationen
- [ ] **Notion Integration:** Direkt aus Notion-Seiten Karten generieren
- [ ] **Browser Extension:** Karten aus Webseiten generieren
- [ ] **LLM-Wechsel:** Ollama durch cloud-basierten Provider ersetzen (OpenAI, Anthropic) — API-Key-basiert pro User
- [ ] **Multi-Language:** Vollständige EN/DE/ES/FR Unterstützung
- [ ] **Analytics Dashboard:** Detaillierte Lernstatistiken

---

## Architektur-Hinweise für den Coding Agent

### Was jetzt schon berücksichtigt werden muss

|Thema|Warum jetzt wichtig|
|---|---|
|`srs_metadata JSONB` in `cards`|SRS kommt in V2 — Feld muss von Anfang an vorhanden sein|
|`is_public` in `collections`|Sharing kommt in V2 — Flag jetzt anlegen, nicht nachträglich migrieren|
|`upload_jobs` Tabelle|KI-Verarbeitung wird async — Job-Queue-Pattern von Anfang an|
|`ai_generated` Boolean auf Cards|Für spätere Filterung & Qualitätsbewertung|
|`plan`, `stripe_customer_id`, `stripe_subscription_id`, `plan_expires_at` auf `users`|Billing-State muss ab Phase 1.5 vorhanden sein — alle Feature-Gates lesen `plan`|
|Auth-Middleware modular halten|OAuth-Provider werden erweitert|
|File-Storage abstrahieren|Railway Buckets jetzt, später ggf. S3-kompatibel|
|Ollama-Client als Interface|LLM-Provider muss in Phase 4 austauschbar sein|
|Alle IDs als UUID|Für spätere API-Exposition & Security|

### Go Monolith — Paketstruktur (empfohlen)

```
/cmd
  /server         → main.go, Einstiegspunkt
/internal
  /auth           → OAuth, JWT, Middleware
  /collections    → CRUD Collections & Ordner
  /cards          → CRUD Karteikarten
  /ai             → Ollama-Client, PDF-Parsing, Karten-Generierung
  /upload         → File-Handling, Validierung, Storage
  /srs            → Spaced Repetition Logik (V2, aber Paket anlegen)
  /sharing        → Public Collections, Sharing-Links (V2)
  /jobs           → Async Job Queue für AI-Processing
  /billing        → Stripe Checkout, Portal, Webhook handler, plan enforcement
/pkg
  /db             → PostgreSQL-Verbindung, Migrations
  /storage        → Railway Buckets Abstraction Layer
  /config         → Env-Variablen, App-Konfiguration
```

> **Agent-Hinweis:** Pakete für `srs` und `sharing` jetzt als leere Pakete anlegen. Kein toter Code — aber die Paketstruktur ist da, damit spätere Features sauber integriert werden können.

---

## Zielgruppen

|Segment|Priorität|Hauptnutzen|
|---|---|---|
|Studenten|⭐⭐⭐ Primär|PDF-Upload, Collections, Cloud Sync|
|Sprachlerner|⭐⭐⭐ Primär|Karteikarten-Erstellung, SRS (V2)|
|Zertifizierungs-Lerner|⭐⭐ Sekundär|Strukturierte Collections, Export|
|iPad-User / GoodNotes-Nutzer|⭐⭐⭐ Primär|Native Integration, Share-Sheet|
|Schüler|⭐⭐ Sekundär|Einfache UX, Sharing|

---

## Key Differentiators

1. **Native GoodNotes & Notability Integration** — Kein Copy-Paste, direkt über Share-Sheet
2. **KI-Generierung aus bestehenden Notizen** — Kein manuelles Erstellen nötig
3. **Cloud Sync** — Anki's größter Pain Point gelöst
4. **Clean UI/UX** — Anki ist hässlich, flashr ist premium

---

_flashr Roadmap v1.0 — SmithLabs_
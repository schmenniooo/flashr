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
- [x] Logging & Error Handling Grundstruktur — stdlib `log` throughout, `gin.Default()` request logging, structured JSON error responses from all handlers
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

## Phase 1 — MVP

> Ziel: Funktionierendes Kernprodukt das echte User verwenden können.

### 1.1 Auth

- [ ] OAuth 2.0 Login: Google, Apple, GitHub
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

- [ ] Chat-style input on the Upload/Create page: free-text prompt describing the topic, target level, and card count
- [ ] Backend endpoint `POST /ai/generate` — sends the prompt to Ollama, returns a list of question-answer pairs
- [ ] Same review flow as PDF-generated cards: user reviews, edits, or deletes individual cards before saving
- [ ] Cards saved to a new or existing collection with `ai_generated = true`
- [ ] Ollama prompt engineered for flashcard quality: concise answers, no padding, varied question types

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

- [ ] Stripe SDK integrated (`github.com/stripe/stripe-go/v76`)
- [ ] `POST /api/billing/checkout` — creates a Stripe Checkout Session and returns the URL; redirects user to Stripe-hosted payment page
- [ ] `POST /api/billing/portal` — creates a Stripe Customer Portal session for managing/cancelling subscriptions
- [ ] `POST /api/billing/webhook` — receives Stripe events; update `plan`, `stripe_subscription_id`, `plan_expires_at` on `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Plan enforcement middleware — attach `plan` to request context after JWT validation; used by feature-gated handlers
- [ ] Feature gates: AI generation, PDF upload, app integrations, collection/card limits enforced server-side (not just UI)

**Frontend:**

- [ ] Upgrade prompt shown when a Free user hits a plan limit (collections, cards, AI)
- [ ] "Upgrade to Pro" CTA in profile/settings page — calls `/api/billing/checkout`, redirects to Stripe
- [ ] "Manage subscription" link in profile — calls `/api/billing/portal`
- [ ] Plan badge shown in profile (Free / Pro)
- [ ] Post-checkout success redirect back to `/app` with a confirmation state

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

### 2.2 Collections teilen

- [ ] Collections als "public" markieren
- [ ] Shareable Link generieren (z.B. `flashr.io/c/[slug]`)
- [ ] Andere User können öffentliche Collections klonen
- [ ] Kollaborative Collections (mehrere User bearbeiten)

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

---

## Phase 3 — Native Mobile App

> Separates Projekt, baut auf der bestehenden Go API auf.

- [ ] React Native App (iOS + Android)
- [ ] Vollständige Feature-Parität mit Web-App
- [ ] Native Share-Sheet Integration (GoodNotes → flashr direkt)
- [ ] Offline-Modus mit lokalem Sync
- [ ] Push Notifications (Lern-Reminder, Streak-Warnung)
- [ ] Apple Widget (Streak, fällige Karten heute)
- [ ] Haptic Feedback beim Lernen

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
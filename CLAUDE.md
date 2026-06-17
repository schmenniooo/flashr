# flashr

> **Main language: English.** All UI copy, documentation, code, commits, and communication are in English. flashr is built for global usage.

AI-powered Flashcard SaaS. Users create flashcards, organize them into collections, and auto-generate them from existing notes (GoodNotes, Notability, PDFs) via AI.

**Stack:** React · Go (Monolith) · PostgreSQL · Railway · Ollama (self-hosted on Railway) · Swift/SwiftUI (iOS & macOS)
**Domain:** flashr.io

## Project Documents

Before making changes, consult these canonical documents:

- [ROADMAP.md](ROADMAP.md) — Full product roadmap: phases (Foundation → MVP → Growth → Native Mobile → Platform), database schema, Go package structure, and forward-looking architecture constraints. The roadmap is the source of truth for what to build and — importantly — what schema fields / packages to scaffold now even if they belong to later phases (`srs_metadata`, `is_public`, `upload_jobs`, `srs/` and `sharing/` packages).
- [GUIDELINES.md](GUIDELINES.md) — Brand & design system: color tokens, typography (DM Sans), component styles, spacing scale, iconography (Lucide), motion, voice & tone. Any UI work must use these tokens and rules.
- [ANNOUNCEMENTS.md](ANNOUNCEMENTS.md) — User-facing changelog. **You MUST add an entry here for every feature addition, bug fix, or notable change you ship.** Bump the semantic version (patch for fixes, minor for features, major for breaking changes), set the date to today, and write a short user-facing description. Never leave this file stale.
- [MOBILE_ROADMAP.md](MOBILE_ROADMAP.md) — iOS & macOS implementation plan: Xcode project structure, phase timeline (iPhone → iPad → macOS), StoreKit 2 billing, CI/CD, design tokens in SwiftUI, and App Store requirements.

---

## Frontend (`web/`)

### Stack

- **Framework:** React 19 + React Router 7
- **Build:** Vite 8 · TypeScript 6 (strict mode, `noUnusedLocals`)
- **Icons:** Lucide React
- **Styling:** Vanilla CSS with design tokens (`src/styles/tokens.css`) — no Tailwind, no CSS-in-JS
- **State:** Custom pub/sub store (`useSyncExternalStore`) — no Zustand/Redux

### Source structure

```
src/
├── types/
│   └── index.ts              # All domain types: Card, Collection, Folder, User, etc.
│
├── lib/
│   ├── api.ts                # Thin fetch wrapper (JWT, ApiError, FormData handling)
│   ├── logo.tsx              # Wordmark SVG component
│   ├── storageKeys.ts        # Central localStorage key constants (DB, TOKEN, AI_CHAT_DRAFT)
│   └── store/                # State management — split by domain
│       ├── db.ts             # Pub/sub engine, localStorage, useDb, selectNow, selectors, helpers
│       ├── auth.ts           # Sign up/in, OAuth, bootstrap, onboarding, profile, delete
│       ├── collections.ts    # Collections CRUD + backend ↔ frontend mapping
│       ├── cards.ts          # Card CRUD + mastery (local-only until SRS Phase 2)
│       ├── folders.ts        # Folder CRUD
│       ├── suggestions.ts    # Suggestion selector + accept/dismiss
│       ├── billing.ts        # Stripe checkout + portal redirect
│       └── index.ts          # Barrel re-export (public API for all components)
│   store.ts                  # Shim — re-exports store/index so old imports still resolve
│
├── data/
│   └── mock.ts               # Seed data only (types live in src/types/). Demo user,
│                             #   collections, folders, suggestion catalog.
│
├── components/               # Reusable UI
│   ├── AppShell.tsx/css      # Sidebar, topbar, search (debounced 150ms), folder nav
│   ├── ErrorBoundary.tsx     # Class component — wraps entire app in main.tsx
│   ├── RequireAuth.tsx/css   # Auth guard — renders immediately from cached session;
│   │                         #   only blocks when bootstrapping AND session is null
│   ├── RequireOnboarded      # (in RequireAuth.tsx) redirects to /onboarding if needed
│   ├── Modal.tsx/css         # Base modal (size sm/md, footer slot)
│   ├── CollectionCard.tsx/css
│   ├── CardEditorModal.tsx   # Create / edit a single card
│   ├── MoveCardModal.tsx     # Move a card to another collection
│   ├── CreateCollectionModal.tsx
│   ├── EditCollectionModal.tsx
│   ├── RenameFolderModal.tsx
│   ├── NewFolderModal.tsx
│   └── UpgradePrompt.tsx/css # Pro gate banner
│
├── pages/
│   ├── Landing.tsx/css
│   ├── Login.tsx/css         # Handles /login and /signup routes
│   ├── OAuthCallback.tsx     # Receives token from backend OAuth redirect
│   ├── Onboarding.tsx/css
│   ├── Dashboard.tsx/css
│   ├── Collections.tsx/css
│   ├── CollectionDetail.tsx/css
│   ├── Study.tsx/css
│   ├── Profile.tsx/css
│   ├── Upload.tsx/css        # Orchestrator — PDF tab + AI chat tab
│   ├── upload/               # Upload sub-components
│   │   ├── AiChat.tsx        # Full AI topic-to-cards chat panel
│   │   ├── DraftCardItem.tsx # Single draft card (view / edit / toggle)
│   │   ├── ReviewStep.tsx    # Post-PDF-upload review + save
│   │   └── types.ts          # DraftCard, Level
│   ├── Imprint.tsx           # Lazy-loaded (legal)
│   ├── PrivacyPolicy.tsx     # Lazy-loaded (legal)
│   └── TermsOfService.tsx    # Lazy-loaded (legal)
│
├── styles/
│   └── tokens.css            # CSS variables: colors, spacing, radius, shadows, transitions
│
├── test/
│   ├── setup.ts              # Stubs localStorage before module init (needed by db.ts)
│   └── store.test.ts         # 12 vitest unit tests: selectors, currentUser, passthrough
│
├── App.tsx                   # Router — core app pages loaded eagerly; legal pages lazy
├── main.tsx                  # Entry: bootstrap() then render inside <ErrorBoundary>
└── index.css                 # Global resets, typography classes, .fade-in, .badge__icon
```

### Key architecture decisions

- **Optimistic auth on reload** — `RequireAuth` renders from cached localStorage session immediately; `bootstrap()` validates the JWT in the background and clears the session on 401. No full-screen loading spinner for returning users.
- **No lazy loading for core app pages** — Dashboard, Collections, etc. are eagerly bundled. Only Imprint/Privacy/Terms are lazy. Lazy-loading app pages caused a visible Suspense null-fallback flicker.
- **Store is a shim** — `src/lib/store.ts` is one line re-exporting `src/lib/store/index.ts`. All existing imports (`from "../lib/store"`) still resolve without change.
- **Shared selectors** — `selectTotalCards`, `selectCardsDueToday`, `selectKnownCards` in `db.ts` — used by AppShell, Dashboard, Profile. Never inline `reduce` over collections again.
- **CSS convention** — BEM-like: `.component__element--modifier`. All spacing via `--space-*` tokens. No inline `style={{}}` except genuinely dynamic values (progress bar widths, avatar background images).

### Testing

**Unit tests (vitest)**
- **Runner:** `npm test` (vitest run) · `npm run test:watch`
- **Environment:** `happy-dom` (provides localStorage before module init)
- **Setup file:** `src/test/setup.ts` stubs `localStorage` globally
- **Spec files:** `src/test/store.test.ts`

**E2E tests (Playwright)**
- **Runner:** `npm run test:e2e` · `npm run test:e2e:ui` · `npm run test:e2e:headed`
- **Server:** tests run against `npm run build && npm run preview` on port 4173 — no dev server, no Vite proxy
- **Auth:** `signInAsDemo(page)` from `e2e/fixtures.ts` — fully in-memory, no backend required
- **API mocking:** use `page.route("**/api/...")` for any endpoint that requires a real backend or Ollama; routes are matched LIFO so a second `page.route` call overrides the first
- **Selectors:** prefer roles (`getByRole`) and labels; fall back to CSS class selectors (`.up__draft`, `.up__save-bar`, etc.)
- **Projects:** `chromium-desktop` (1280×800) runs all non-mobile specs; `chromium-mobile` (Pixel 7) runs `*.mobile.spec.ts` only
- **Spec files:** `auth.spec.ts`, `collections.spec.ts`, `folders.spec.ts`, `search.spec.ts`, `navigation.mobile.spec.ts`, `ai-chat.spec.ts`, `billing.spec.ts`

---

## Backend (`backend/`)

### Stack

- **Language:** Go (monolith)
- **Entry point:** `cmd/server/main.go`
- **Database:** PostgreSQL — migrations embedded and run on boot

### Package structure

```
backend/
├── cmd/server/main.go
├── internal/
│   ├── ai/          # Ollama client — generate cards from text/PDF
│   ├── auth/        # JWT, OAuth (Google), signup/login handlers
│   ├── billing/     # Stripe checkout, portal, webhook
│   ├── cards/       # Card CRUD
│   ├── collections/ # Collection CRUD
│   ├── jobs/        # Background jobs
│   ├── sharing/     # Public collection sharing (Phase 3 scaffold)
│   ├── srs/         # Spaced repetition (Phase 2 scaffold)
│   └── upload/      # PDF upload → AI card generation pipeline
├── pkg/
│   ├── config/      # Env var loading
│   ├── db/          # PostgreSQL connection + migration runner
│   └── storage/     # File storage (Railway volume / S3)
└── test/
    └── testutil/db.go  # Spins up a clean DB per integration test suite
```

### Testing

- **Runner:** `go test ./...`
- **Unit tests:** `test/unit/` — no database (AI prompt parsing, auth helpers, upload validation)
- **Integration tests:** `test/integration/` — require a real PostgreSQL instance
- **No Ollama in tests:** pass `nil` as `*ai.Client` to `upload.NewService` for the "not configured" path

---

## iOS & macOS (`/ios`)

### Stack

- **Language:** Swift 5.9+ · SwiftUI
- **Targets:** iOS 17+ (iPhone & iPad) · macOS 14+ (native — no Catalyst)
- **Bundle ID:** `io.flashr.app`
- **Billing:** StoreKit 2 (product ID `io.flashr.pro.monthly`) — Stripe remains for web only
- **Distribution:** iPhone/iPad via App Store · macOS via GitHub Releases + Sparkle auto-update

### Source structure

```
ios/
├── flashr.xcodeproj
└── flashr/
    ├── App/
    │   ├── flashrApp.swift         # @main entry — injects AuthStore as environment object
    │   └── AppDelegate.swift       # APNs registration (#if os(iOS))
    ├── Core/
    │   ├── DesignSystem.swift      # Brand tokens: Color.flashr*, Font.flashr*, Radius.*
    │   ├── Network/
    │   │   ├── APIClient.swift     # URLSession wrapper — reads API_BASE_URL from Config.xcconfig,
    │   │   │                       #   injects Authorization: Bearer on every request
    │   │   └── Endpoints.swift     # All API endpoint path constants
    │   ├── Auth/
    │   │   ├── AuthManager.swift   # @MainActor ObservableObject — login, signup, Google OAuth,
    │   │   │                       #   logout, token refresh
    │   │   └── KeychainHelper.swift # read/write/delete JWT — never UserDefaults
    │   ├── Models/
    │   │   ├── Card.swift
    │   │   ├── Collection.swift
    │   │   └── User.swift
    │   └── Store/
    │       ├── AuthStore.swift
    │       ├── CollectionStore.swift  # ObservableObject — mirrors web store pattern
    │       └── CardStore.swift
    ├── Features/
    │   ├── Auth/
    │   │   ├── LoginView.swift
    │   │   ├── SignupView.swift
    │   │   └── OAuthCallbackView.swift
    │   ├── Collections/
    │   │   ├── CollectionsView.swift
    │   │   ├── CollectionDetailView.swift
    │   │   └── CreateCollectionSheet.swift
    │   ├── Cards/
    │   │   ├── CardEditorView.swift
    │   │   └── CardRowView.swift
    │   ├── Study/
    │   │   ├── StudyView.swift        # rotation3DEffect flip + SM-2 rating buttons
    │   │   └── StudyCompleteView.swift
    │   ├── Upload/
    │   │   ├── UploadView.swift       # DocumentPickerViewController + AI topic input
    │   │   └── ReviewView.swift       # Draft cards review before saving
    │   ├── Billing/
    │   │   ├── UpgradeView.swift      # StoreKit 2 paywall shown at Free plan limits
    │   │   └── BillingManager.swift   # Product.products(), product.purchase(), restore
    │   └── Profile/
    │       └── ProfileView.swift
    ├── Platform/
    │   ├── iOS/
    │   │   ├── AppShell+iOS.swift     # TabView (iPhone) / NavigationSplitView (iPad)
    │   │   └── ShareExtension/        # GoodNotes → flashr (Phase 2)
    │   └── macOS/
    │       ├── AppShell+macOS.swift   # 3-column NavigationSplitView + NSToolbar
    │       └── MenuBarExtra.swift     # Streak + cards due today in menu bar (optional)
    └── Resources/
        ├── Assets.xcassets
        ├── Fonts/                     # DM Sans TTF files — registered in Info.plist
        │   ├── DMSans-Regular.ttf
        │   ├── DMSans-SemiBold.ttf
        │   └── DMSans-Bold.ttf
        └── flashr.entitlements        # Push Notifications, App Groups (Share Extension)
```

### Design system

All brand tokens live in `Core/DesignSystem.swift` — never hardcode hex values elsewhere:

```swift
Color.flashrBg          // #0D0F14
Color.flashrSurface     // #161923
Color.flashrCard        // #1E2332
Color.flashrAccent      // #6C63FF  ← only CTA color
Color.flashrAccentLight // #8B85FF
Color.flashrText        // #F0F2FF
Color.flashrMuted       // #8890A4
Color.flashrBorder      // #2A2F45

Font.flashrH1           // DMSans-Bold 28pt
Font.flashrH2           // DMSans-SemiBold 20pt
Font.flashrBody         // DMSans-Regular 14pt
Font.flashrMeta         // DMSans-SemiBold 11pt

Radius.sm / .md / .lg / .xl  // 8 / 12 / 16 / 24 pt

// Accent glow — use sparingly, only on accent elements
.shadow(color: Color.flashrAccent.opacity(0.3), radius: 10, x: 0, y: 4)
```

DM Sans TTF files must be listed under `UIAppFonts` (iOS) and `NSFontFileName` (macOS) in `Info.plist`. SwiftUI Previews will crash silently if the font isn't registered.

### Build configurations

Environment config lives in `Config.xcconfig` per scheme — never hardcode in source:

```
// Debug
API_BASE_URL = http://localhost:8080

// Release
API_BASE_URL  = https://api.flashr.io
GOOGLE_CLIENT_ID = <from Google Console>
STOREKIT_PRODUCT_ID = io.flashr.pro.monthly
```

### Key architecture decisions

- **Token storage** — JWT always in Keychain (`KeychainHelper.swift`). Never `UserDefaults`. `AuthManager` is `@MainActor ObservableObject` injected at app root.
- **Platform split via `#if os(...)`** — business logic (stores, models, API client) is shared. Platform-specific UI is isolated to `Platform/iOS/` and `Platform/macOS/`. No Catalyst.
- **StoreKit 2 + backend sync** — after a successful purchase, `BillingManager` calls `POST /api/billing/ios-fulfill` to sync `plan='pro'` into the DB. The web plan and iOS plan write the same `users.plan` column. The `billing_source` column (`'stripe'` | `'apple'`) tracks origin.
- **macOS distribution** — outside the App Store via GitHub Releases + Sparkle 2. Every `git tag v*` triggers `.github/workflows/macos-release.yml` which builds, notarizes (once Apple Developer Account is set up), and publishes a `.dmg`.

### Testing

- **Unit tests (`flashrTests`):** `APIClientTests` (mock URLSession), `BillingManagerTests` (mock StoreKit), `SRSTests` (SM-2 algorithm port from Go `internal/srs`)
- **UI tests (`flashrUITests`):** login flow, create collection → add card → study, upload flow (mock API), upgrade paywall trigger
- **CI:** `.github/workflows/ios.yml` — runs `xcodebuild test` on `macos-15` runner against iPhone 16 simulator on every push/PR touching `ios/**`

---

## Known Bugs Fixed & Architectural Decisions

### Stripe billing: never rely on webhooks alone for plan state

**Problem (fixed 2026-05-09):** After subscribing or cancelling, the plan badge in the app didn't update. Root cause: Stripe's success/portal return redirect happens *before* the webhook fires. If webhooks aren't configured at all (common in new environments), the DB is never updated.

**Pattern to always follow:**

- **Upgrade (free → pro):** The Stripe Checkout `success_url` includes `{CHECKOUT_SESSION_ID}`. On redirect, the frontend calls `POST /api/billing/fulfill` with the session ID. The backend fetches the session directly from Stripe, verifies ownership via `stripe_customer_id`, and immediately writes `plan='pro'` + `stripe_subscription_id` to the DB. Then `auth.refreshUser()` fetches the updated plan.

- **Cancel/downgrade (pro → free):** After Customer Portal return, the frontend calls `POST /api/billing/sync`. The backend lists all Stripe subscriptions for the customer, determines the canonical plan, and writes it to the DB. Then `auth.refreshUser()` fetches the updated plan.

- **Webhooks** remain registered and process events, but they are a *secondary* sync — not the primary source of truth for the post-redirect flow.

**Relevant files:** `backend/internal/billing/billing.go` (`FulfillCheckout`, `SyncPlan`), `backend/internal/billing/http.go` (`/billing/fulfill`, `/billing/sync`), `web/src/pages/Profile.tsx` (calls fulfill/sync before refreshUser), `web/src/lib/store/billing.ts` (`fulfill`, `sync`).

---

## Worktrees

When working in a git worktree (path contains `.claude/worktrees/`), copy both env files from the real repo before starting anything — the worktree won't have them:

```bash
# Frontend — Vite's loadEnv reads from process.cwd() (web/)
cp /Users/ennio/_projects/flashr/web/.env /Users/ennio/_projects/flashr/.claude/worktrees/<worktree-name>/web/.env

# Backend — Go server reads from backend/
cp /Users/ennio/_projects/flashr/backend/.env /Users/ennio/_projects/flashr/.claude/worktrees/<worktree-name>/backend/.env
```

Do this once at the start of the session.

---

## Working Rules

- Treat ROADMAP.md as authoritative for scope and architecture. If requirements change, update the roadmap rather than diverging silently.
- All UI/visual work must use the tokens and components defined in GUIDELINES.md — no ad-hoc colors, fonts, or radii.
- Everything is in English — UI copy, product language, dev communication, commits, comments, PRs, docs.
- Address the user informally (second person, "you") — friendly and direct, not corporate.
- Write the product name as `flashr` (always lowercase).
- These rules (including the roadmap and brand guidelines) can be broken if the user explicitly instructs you to do so — user instructions override the documents.

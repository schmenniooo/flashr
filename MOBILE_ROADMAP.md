# flashr — iOS & macOS App

> Agent instructions for building the flashr native app.  
> Read ROADMAP.md, GUIDELINES.md, and CLAUDE.md before starting.

---

## Decisions

| Topic | Decision |
|---|---|
| Framework | Swift + SwiftUI (iOS 17+, macOS 14+) |
| Platforms | iPhone → iPad → macOS (native, in that order) |
| Billing | StoreKit 2 + Backend sync (Stripe remains for web) |
| Repo | Monorepo — new `/ios` folder |
| Backend | Existing Go API at `api.flashr.io` — minimal additions needed |

---

## Project Structure

```
/ios
  flashr.xcodeproj
  flashr/
    App/
      flashrApp.swift         # @main entry point
      AppDelegate.swift       # APNs registration
    Core/
      Network/
        APIClient.swift       # URLSession wrapper, JWT auth
        Endpoints.swift       # All API endpoint definitions
      Auth/
        AuthManager.swift     # Token storage (Keychain), session state
        KeychainHelper.swift
      Models/
        Card.swift
        Collection.swift
        User.swift
      Store/
        CollectionStore.swift # ObservableObject, mirrors web store pattern
        CardStore.swift
        AuthStore.swift
    Features/
      Auth/
        LoginView.swift
        SignupView.swift
        OAuthCallbackView.swift
      Collections/
        CollectionsView.swift
        CollectionDetailView.swift
        CreateCollectionSheet.swift
      Cards/
        CardEditorView.swift
        CardRowView.swift
      Study/
        StudyView.swift       # Flip animation + SM-2 rating buttons
        StudyCompleteView.swift
      Upload/
        UploadView.swift      # File picker + AI topic input
        ReviewView.swift      # Draft cards before saving
      Billing/
        UpgradeView.swift     # StoreKit 2 paywall
        BillingManager.swift  # StoreKit 2 purchase + restore logic
      Profile/
        ProfileView.swift
    Platform/
      iOS/
        AppShell+iOS.swift    # TabView / NavigationSplitView (iPad)
        ShareExtension/       # GoodNotes → flashr (Phase 2)
      macOS/
        AppShell+macOS.swift  # NavigationSplitView + Toolbar + Menu
        MenuBarExtra.swift    # Optional streak counter in menu bar
    Resources/
      Assets.xcassets
      flashr.entitlements
```

---

## Backend Changes Required

Two new endpoints needed in the Go backend before starting iOS development.

### 1. Push Token Registration

```go
// POST /api/users/push-token
// Body: { "token": "<APNs device token>", "platform": "ios" | "macos" }
// Auth: Bearer JWT (existing middleware)
// Action: store token in new push_tokens table
```

New table:

```sql
push_tokens (
  id         UUID PRIMARY KEY,
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,
  platform   TEXT NOT NULL,  -- 'ios' | 'macos'
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, token)
)
```

### 2. StoreKit 2 Webhook

```go
// POST /api/billing/ios-webhook
// Apple sends server-to-server notifications for subscription events
// No JWT auth — verify Apple signature instead
// Events to handle:
//   SUBSCRIBED       → plan = 'pro'
//   DID_RENEW        → plan = 'pro', extend plan_expires_at
//   EXPIRED          → plan = 'free'
//   REFUND           → plan = 'free'
```

### 3. Billing Source of Truth

Both Stripe (web) and StoreKit (iOS) write the same `plan` field. Rules:

```
iOS purchase  → StoreKit receipt verified by Apple → backend sets plan = 'pro'
Web purchase  → Stripe webhook → backend sets plan = 'pro'
Cancellation  → whichever platform → backend sets plan = 'free'
```

Add `billing_source` column to track origin:

```sql
ALTER TABLE users ADD COLUMN billing_source TEXT;  -- 'stripe' | 'apple' | null
```

---

## iOS Implementation Plan

### Phase 1 — iPhone MVP (Weeks 1–6)

**Week 1–2: Foundation**
- Xcode project setup, Bundle ID `io.flashr.app`
- `APIClient.swift` — `URLSession` wrapper with `Authorization: Bearer` header
- `KeychainHelper.swift` — token storage (never UserDefaults)
- Environment config: `DEBUG` → `http://localhost:8080`, `RELEASE` → `https://api.flashr.io`
- `AuthManager.swift` — login, signup, Google OAuth, logout, token refresh

**Week 3–4: Core Features**
- Collections list + detail view
- Card CRUD (create, edit, delete)
- Study mode: flip animation (`rotation3DEffect`), SM-2 rating buttons (Again / Hard / Good / Easy)
- Haptic feedback on card reveal (`UIImpactFeedbackGenerator`)

**Week 5: Upload & AI**
- File picker (`DocumentPickerViewController`) — accepts `.pdf`, `.md`, `.docx`, `.pptx`, `.apkg`
- AI topic input (text field → `POST /api/ai/generate`)
- Review step: draft cards with keep/skip toggles before saving
- Upload streams cards as they arrive (matching web behavior)

**Week 6: Billing + Polish**
- StoreKit 2: `Product.products(for:)`, `product.purchase()`, receipt verification
- `BillingManager.swift` syncs purchase state to backend via `POST /api/billing/ios-fulfill`
- Upgrade paywall (`UpgradeView`) shown when Free user hits limit
- Offline handling: Core Data cache for cards, sync on reconnect

### Phase 2 — iPad (Weeks 7–9)

- `NavigationSplitView` — persistent sidebar (Collections) + detail pane
- Share Extension: target receives PDF/file from GoodNotes/Notability, uploads to `/api/ai/upload` in background, badge when cards ready
- Drag & drop: `DropDelegate` for PDFs into upload view
- Keyboard shortcuts: `⌘N` new collection, `⌘K` search, `Space` flip card

### Phase 3 — macOS Native (Weeks 10–14)

- New `AppShell+macOS.swift` with `NavigationSplitView` (3-column: folders / collections / cards)
- Native menu bar: File → New Collection, Card → Flip, Study → Start Session
- `NSToolbar` for primary actions
- Window management: minimum size 900×600, resizable
- `MenuBarExtra` (optional): streak count + cards due today in menu bar
- `#if os(macOS)` / `#if os(iOS)` conditionals for platform-specific UI only — business logic shared

---

## Design System (SwiftUI)

Match the web brand system exactly.

```swift
// Colors — add to Assets.xcassets
extension Color {
    static let flashrBg           = Color(hex: "#0D0F14")
    static let flashrSurface      = Color(hex: "#161923")
    static let flashrCard         = Color(hex: "#1E2332")
    static let flashrAccent       = Color(hex: "#6C63FF")
    static let flashrAccentLight  = Color(hex: "#8B85FF")
    static let flashrText         = Color(hex: "#F0F2FF")
    static let flashrMuted        = Color(hex: "#8890A4")
    static let flashrBorder       = Color(hex: "#2A2F45")
}
```

```swift
// Typography — DM Sans via @fontsource equivalent
// Register DM Sans TTF in Info.plist (UIAppFonts / NSFontFileName)
extension Font {
    static let flashrDisplay = Font.custom("DMSans-Bold", size: 40)
    static let flashrH1      = Font.custom("DMSans-Bold", size: 28)
    static let flashrH2      = Font.custom("DMSans-SemiBold", size: 20)
    static let flashrBody    = Font.custom("DMSans-Regular", size: 14)
    static let flashrMeta    = Font.custom("DMSans-SemiBold", size: 11)
}
```

```swift
// Border radius tokens
enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 24
}
```

**Glow effect on accent elements:**
```swift
.shadow(color: Color(hex: "#6C63FF").opacity(0.3), radius: 10, x: 0, y: 4)
```

---

## StoreKit 2 Implementation

```swift
// BillingManager.swift
import StoreKit

class BillingManager: ObservableObject {
    static let proMonthlyID = "io.flashr.pro.monthly"

    @Published var isProActive = false

    func loadProducts() async throws -> [Product] {
        return try await Product.products(for: [Self.proMonthlyID])
    }

    func purchase(_ product: Product) async throws {
        let result = try await product.purchase()
        switch result {
        case .success(let verification):
            let transaction = try checkVerified(verification)
            await syncToBackend(transaction: transaction)
            await transaction.finish()
            isProActive = true
        default:
            break
        }
    }

    private func syncToBackend(transaction: Transaction) async {
        // POST /api/billing/ios-fulfill
        // Body: { "transaction_id": transaction.id, "product_id": transaction.productID }
        // Backend verifies with Apple and sets plan = 'pro'
    }

    func restorePurchases() async throws {
        for await result in Transaction.currentEntitlements {
            let transaction = try checkVerified(result)
            if transaction.productID == Self.proMonthlyID {
                await syncToBackend(transaction: transaction)
                isProActive = true
            }
        }
    }
}
```

---

## App Store Requirements

| Item | Notes |
|---|---|
| Bundle ID | `io.flashr.app` |
| Apple Developer Account | 99$/year — register before starting |
| Privacy Manifest | `PrivacyInfo.xcprivacy` — required since 2024 |
| Screenshots | 6.9" iPhone Pro Max + 13" iPad Pro + MacBook (for Mac) |
| Privacy Policy URL | `https://flashr.io/privacy` — already exists |
| Entitlements | Push Notifications, App Groups (Share Extension) |
| TestFlight | Beta before App Store submission — internal first, then external |

**Privacy manifest must declare:**
- `NSPrivacyAccessedAPITypes` for any system API used
- No third-party SDKs that require reasons declaration beyond `GoogleSignIn`

---

## Environment Variables (iOS)

No `.env` file — use Xcode Build Configurations:

```
DEBUG:   API_BASE_URL = http://localhost:8080
RELEASE: API_BASE_URL = https://api.flashr.io
         GOOGLE_CLIENT_ID = <from Google Console>
         STOREKIT_PRODUCT_ID = io.flashr.pro.monthly
```

Add `Config.xcconfig` per scheme — never hardcode in source.

---

## Testing

**Unit tests (`flashrTests`):**
- `APIClientTests` — mock URLSession, test auth header injection
- `BillingManagerTests` — mock StoreKit, test purchase + restore flow
- `SRSTests` — SM-2 algorithm (port from Go `internal/srs`)

**UI tests (`flashrUITests`):**
- Login flow
- Create collection → add card → study
- Upload flow (mock API)
- Upgrade paywall trigger

**TestFlight:**
- Internal: Ennio + devices
- External beta: target existing flashr.io Pro users first

---

## macOS Distribution

macOS is distributed outside the App Store via GitHub Releases + direct download on flashr.io.  
iPhone and iPad are distributed via the App Store only.

| Platform | Distribution | Updates |
|---|---|---|
| iPhone / iPad | App Store | Apple automatic |
| macOS | GitHub Releases + flashr.io/download | Sparkle Framework |

### Notarization (required)

Without notarization macOS blocks the download with "can't be opened because Apple cannot check it for malicious software." Notarization requires the Apple Developer Account (99$/year).

```
Xcode → Product → Archive → Notarize → .dmg → GitHub Release
```

### CI/CD — GitHub Actions

Every `git tag v*` triggers an automated build, notarization, and GitHub Release.

```yaml
# .github/workflows/macos-release.yml
name: macOS Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build & Archive
        run: xcodebuild archive -scheme flashr -archivePath flashr.xcarchive

      - name: Export .app
        run: xcodebuild -exportArchive -archivePath flashr.xcarchive -exportPath export/

      - name: Notarize
        run: xcrun notarytool submit flashr.dmg
          --apple-id ${{ secrets.APPLE_ID }}
          --password ${{ secrets.APPLE_APP_PASSWORD }}
          --team-id ${{ secrets.APPLE_TEAM_ID }}
          --wait

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          files: flashr.dmg
```

**GitHub Secrets required:**

| Secret | Where to find it |
|---|---|
| `APPLE_ID` | Apple Developer email |
| `APPLE_APP_PASSWORD` | appleid.apple.com → App-specific passwords |
| `APPLE_TEAM_ID` | developer.apple.com → Membership |
| `CERTIFICATE_P12` | Xcode → Keychain → export Signing Certificate |

**Release workflow:**
```bash
git tag v1.2.0
git push --tags
# → GitHub Actions builds, notarizes, publishes .dmg automatically
```

### In-App Update Notifications (Sparkle)

Sparkle is the standard update framework for Mac apps outside the App Store. On launch it checks an `appcast.xml` hosted on GitHub and shows a native update dialog when a new version is available.

```swift
// Package.swift
.package(url: "https://github.com/sparkle-project/Sparkle", from: "2.0.0")
```

```swift
// macOS only — AppDelegate.swift
#if os(macOS)
import Sparkle

class AppDelegate: NSObject, NSApplicationDelegate {
    let updaterController = SPUStandardUpdaterController(
        startingUpdater: true,
        updaterDelegate: nil,
        userDriverDelegate: nil
    )
}
#endif
```

The GitHub Actions workflow generates and pushes `appcast.xml` automatically on every release — no manual step needed.

---

## Launch Sequence

```
1. Backend endpoints merged to main (push-token + ios-webhook)
2. Xcode project created, /ios added to monorepo
3. iPhone MVP → TestFlight internal
4. iPad features → TestFlight external beta (existing users)
5. App Store submission (iPhone + iPad)
6. macOS native build → GitHub Actions CI/CD set up
7. flashr.io/download page → links to latest GitHub Release
8. Sparkle integrated → in-app update notifications live
```

---

## What NOT to build yet

- Android (revisit after iOS user data)
- Mac Catalyst (native macOS only — Catalyst quality doesn't match flashr's premium positioning)
- WidgetKit / Apple Pencil (Phase 2 after stable iOS)
- watchOS

---

*flashr iOS & macOS Plan v1.0 — SmithLabs*

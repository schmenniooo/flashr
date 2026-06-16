# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into flashr. Here's what was set up:

- **`posthog-js` and `@posthog/react`** were installed and initialized in `src/main.tsx`. The app is wrapped in `PostHogProvider` so all components can access PostHog via the `usePostHog()` hook.
- **User identification** is performed on successful email sign-up and sign-in, associating PostHog's anonymous distinct ID with the user's email address. `posthog.reset()` is called on sign-out to clear the identity.
- **13 events** are captured across 7 files covering the full user lifecycle: acquisition → activation → engagement → monetization.
- **Error tracking** was added to `ErrorBoundary.tsx` via `posthog.captureException()` so unhandled React errors are surfaced in PostHog.
- **Environment variables** (`VITE_PUBLIC_POSTHOG_PROJECT_TOKEN`, `VITE_PUBLIC_POSTHOG_HOST`) were written to `.env`.

## Events

| Event | Description | File |
|---|---|---|
| `user_signed_up` | User creates a new account via email/password | `src/pages/Login.tsx` |
| `user_signed_in` | User signs in via email/password | `src/pages/Login.tsx` |
| `user_signed_out` | User signs out | `src/pages/Profile.tsx` |
| `onboarding_completed` | User finishes the 3-step onboarding flow | `src/pages/Onboarding.tsx` |
| `upgrade_clicked` | User clicks "Upgrade to Pro" | `src/pages/Profile.tsx` |
| `ai_generation_started` | AI card generation started from file upload | `src/pages/Upload.tsx` |
| `ai_generation_started` | AI card generation started from topic prompt | `src/pages/upload/AiChat.tsx` |
| `ai_cards_saved` | AI-generated cards saved to a collection (file) | `src/pages/Upload.tsx` |
| `ai_cards_saved` | AI-generated cards saved to a collection (topic) | `src/pages/upload/AiChat.tsx` |
| `study_session_completed` | User finishes a full study session | `src/pages/Study.tsx` |
| `card_rated` | User rates a card (again/hard/good/easy) | `src/pages/Study.tsx` |
| `suggestion_accepted` | User accepts a suggested deck from the dashboard | `src/pages/Dashboard.tsx` |
| `collection_deleted` | User permanently deletes a collection | `src/pages/CollectionDetail.tsx` |

## Next steps

We've built a dashboard and five insights to keep an eye on the metrics that matter most for flashr:

- **Dashboard:** [Analytics basics (wizard)](https://eu.posthog.com/project/202318/dashboard/751263)
- [Signup & Onboarding Funnel](https://eu.posthog.com/project/202318/insights/S400dkdP) — conversion from signup through onboarding completion
- [New Signups Over Time](https://eu.posthog.com/project/202318/insights/bV79mZbU) — daily unique users signing up
- [AI Generation: Started vs Saved](https://eu.posthog.com/project/202318/insights/494624KP) — how many generation sessions result in saved cards
- [Study Sessions Completed](https://eu.posthog.com/project/202318/insights/1NNXt4Ox) — daily study engagement
- [Upgrade Intent](https://eu.posthog.com/project/202318/insights/xeVnrJsZ) — users clicking Upgrade to Pro

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_PUBLIC_POSTHOG_PROJECT_TOKEN` and `VITE_PUBLIC_POSTHOG_HOST` to `.env.example` and any bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — currently `identify` fires only on fresh email login/signup. Consider calling `posthog.identify(user.email)` inside `auth.bootstrap()` once the user session is loaded, so returning users are also identified on page reload.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

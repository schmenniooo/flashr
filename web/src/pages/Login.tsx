import { useState } from "react";
import { useNavigate, useLocation, useSearchParams, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Wordmark } from "../lib/logo";
import { API_BASE } from "../lib/api";
import { auth, billingApi, selectNow, selectCurrentUser } from "../lib/store";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { usePostHog } from "@posthog/react";
import "./Login.css";

type Mode = "signin" | "signup";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: "Sign-in with Google or GitHub failed — please try again.",
};

export function Login() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const posthog = usePostHog();
  const [mode, setMode] = useState<Mode>(pathname === "/signup" ? "signup" : "signin");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const code = searchParams.get("error");
    return code ? (OAUTH_ERRORS[code] ?? "Something went wrong — please try again.") : null;
  });
  const [submitting, setSubmitting] = useState(false);
  const [wantsTrial, setWantsTrial] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEYS.TRIAL_INTENT) === "1";
    } catch { return false; }
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const hasProIntent = () => sessionStorage.getItem(STORAGE_KEYS.CHECKOUT_INTENT) === "pro";

  function clearIntent() {
    sessionStorage.removeItem(STORAGE_KEYS.CHECKOUT_INTENT);
  }

  async function redirectAfterAuth(defaultPath: string) {
    if (hasProIntent()) {
      clearIntent();
      let withTrial = false;
      try {
        withTrial = sessionStorage.getItem(STORAGE_KEYS.TRIAL_INTENT) === "1";
        sessionStorage.removeItem(STORAGE_KEYS.TRIAL_INTENT);
      } catch { /* ignore */ }
      const user = selectNow(selectCurrentUser);
      if (user?.plan === "pro") {
        navigate("/app");
      } else {
        await billingApi.checkout(form.email || selectNow(selectCurrentUser)?.email || "", withTrial);
      }
    } else {
      navigate(defaultPath);
    }
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError(null);
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res =
        mode === "signin"
          ? await auth.signIn(form.email, form.password)
          : await auth.signUp({
              email: form.email,
              password: form.password,
              firstName: form.name.split(" ")[0] ?? "",
              lastName: form.name.split(" ").slice(1).join(" "),
            });
      if (res.ok) {
        if (mode === "signup") {
          posthog.identify(form.email, { email: form.email, name: form.name });
          posthog.capture("user_signed_up", { method: "email" });
          if (wantsTrial) {
            await billingApi.checkout(form.email, true);
          } else {
            await redirectAfterAuth("/onboarding");
          }
        } else {
          posthog.identify(form.email, { email: form.email });
          posthog.capture("user_signed_in", { method: "email" });
          await redirectAfterAuth("/app");
        }
      } else {
        setError(res.error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__hero">
        <div className="auth__hero-brand">
          <Wordmark size={26} />
        </div>

        <div className="auth__hero-body">
          <span className="text-meta auth__hero-meta">
            <Sparkles size={11} strokeWidth={2} />
            AI-powered flashcards
          </span>
          <h1 className="auth__hero-title">
            Your notes.
            <br />
            Flashcards,
            <br />
            <span className="auth__hero-accent">automatically.</span>
          </h1>
          <p className="auth__hero-sub">
            Drop a PDF or sync GoodNotes — we'll do the rest. Study smarter with
            spaced repetition that actually sticks.
          </p>

          <ul className="auth__hero-list">
            <li>
              <CheckCircle2 size={14} strokeWidth={2} />
              Turn any note into a deck in seconds
            </li>
            <li>
              <CheckCircle2 size={14} strokeWidth={2} />
              Spaced repetition tuned to your day
            </li>
            <li>
              <CheckCircle2 size={14} strokeWidth={2} />
              Sync across every device, always
            </li>
          </ul>
        </div>

        <div className="auth__hero-foot text-meta">
          flashr.io · SmithLabs
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__panel-inner">
          <div className="auth__switch" role="tablist" aria-label="Authentication mode">
            <button
              role="tab"
              aria-selected={mode === "signin"}
              className={`auth__switch-btn${mode === "signin" ? " active" : ""}`}
              onClick={() => switchMode("signin")}
            >
              Sign in
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup"}
              className={`auth__switch-btn${mode === "signup" ? " active" : ""}`}
              onClick={() => switchMode("signup")}
            >
              Create account
            </button>
          </div>

          <header className="auth__head">
            <h2 className="text-h1">
              {mode === "signin" ? "Welcome back." : "Start learning faster."}
            </h2>
            <p className="text-body auth__head-sub">
              {mode === "signin"
                ? "Sign in to pick up where you left off."
                : "It takes less than a minute — no card required."}
            </p>
          </header>

          <div className="auth__oauth">
            <button
              className="auth__oauth-btn"
              onClick={() => {
                try {
                  if (mode === "signup" && wantsTrial)
                    sessionStorage.setItem(STORAGE_KEYS.TRIAL_INTENT, "1");
                } catch {
                  // sessionStorage unavailable (e.g. private mode) — proceed anyway
                }
                window.location.href = `${API_BASE}/auth/google`;
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              className="auth__oauth-btn"
              onClick={() => {
                try {
                  if (mode === "signup" && wantsTrial)
                    sessionStorage.setItem(STORAGE_KEYS.TRIAL_INTENT, "1");
                } catch {
                  // sessionStorage unavailable (e.g. private mode) — proceed anyway
                }
                window.location.href = `${API_BASE}/auth/github`;
              }}
            >
              <GithubIcon />
              Continue with GitHub
            </button>
          </div>

          <div className="auth__divider">
            <span>or with email</span>
          </div>

          {error && (
            <div className="auth__error" role="alert">
              <AlertCircle size={14} strokeWidth={2} />
              {error}
            </div>
          )}

          <form className="auth__form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label className="auth__field">
                <span className="text-meta">Your name</span>
                <div className="auth__input">
                  <User size={14} strokeWidth={1.8} />
                  <input
                    className="auth__input-inner"
                    type="text"
                    autoComplete="name"
                    placeholder="Jordan Smith"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                  />
                </div>
              </label>
            )}

            <label className="auth__field">
              <span className="text-meta">Email</span>
              <div className="auth__input">
                <Mail size={14} strokeWidth={1.8} />
                <input
                  className="auth__input-inner"
                  type="email"
                  autoComplete="email"
                  placeholder="you@flashr.io"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
            </label>

            <label className="auth__field">
              <span className="text-meta auth__field-row">
                Password
                {mode === "signin" && (
                  <button
                    type="button"
                    className="auth__forgot"
                    onClick={() => navigate("/app")}
                  >
                    Forgot?
                  </button>
                )}
              </span>
              <div className="auth__input">
                <Lock size={14} strokeWidth={1.8} />
                <input
                  className="auth__input-inner"
                  type={showPw ? "text" : "password"}
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                  minLength={mode === "signup" ? 8 : undefined}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth__eye"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? (
                    <EyeOff size={14} strokeWidth={1.8} />
                  ) : (
                    <Eye size={14} strokeWidth={1.8} />
                  )}
                </button>
              </div>
            </label>

            {mode === "signup" && (
              <>
                <label className="auth__check auth__check--trial">
                  <input
                    type="checkbox"
                    checked={wantsTrial}
                    onChange={(e) => setWantsTrial(e.target.checked)}
                  />
                  <span>
                    <strong>Start with a 7-day free Pro trial</strong>
                    <span className="auth__check-sub">
                      Enter payment details — no charge until the trial ends. Cancel any time.
                    </span>
                  </span>
                </label>

                <label className="auth__check">
                  <input type="checkbox" required />
                  <span>
                    I agree to the{" "}
                    <Link to="/terms">Terms of Service</Link>{" "}
                    and{" "}
                    <Link to="/privacy">Privacy Policy</Link>
                    .
                  </span>
                </label>
              </>
            )}

            <button
              type="submit"
              className="btn-primary auth__submit"
              disabled={submitting}
            >
              {submitting
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
              <ArrowRight size={14} strokeWidth={2} />
            </button>
          </form>

          <div className="auth__foot">
            {mode === "signin" ? (
              <>
                New to flashr?{" "}
                <button className="auth__link" onClick={() => switchMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="auth__link" onClick={() => switchMode("signin")}>
                  Sign in
                </button>
              </>
            )}
          </div>


        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.3-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4.5 24 4.5c-7.4 0-13.8 4.2-17.7 10.2z"
      />
      <path
        fill="#4CAF50"
        d="M24 43.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.4-4.5 2.2-7.2 2.2-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.9 39.3 16.4 43.5 24 43.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2c-.4.4 6.6-4.8 6.6-14.6 0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M12 .5C5.73.5.67 5.57.67 11.85c0 5.02 3.24 9.28 7.74 10.79.57.1.78-.25.78-.55 0-.27-.01-.99-.02-1.94-3.15.68-3.82-1.52-3.82-1.52-.52-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.24 3.31.95.1-.73.4-1.24.72-1.52-2.51-.29-5.15-1.26-5.15-5.6 0-1.24.44-2.25 1.16-3.05-.12-.29-.5-1.44.11-3 0 0 .95-.3 3.11 1.16.9-.25 1.86-.38 2.82-.39.96.01 1.92.14 2.82.39 2.16-1.46 3.11-1.16 3.11-1.16.62 1.56.23 2.71.11 3 .72.8 1.16 1.81 1.16 3.05 0 4.36-2.65 5.31-5.17 5.59.41.35.77 1.05.77 2.11 0 1.52-.01 2.75-.01 3.13 0 .31.2.66.79.55 4.5-1.51 7.73-5.77 7.73-10.79C23.33 5.57 18.27.5 12 .5z" />
    </svg>
  );
}


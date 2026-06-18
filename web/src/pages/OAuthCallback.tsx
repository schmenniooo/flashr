import { capture, identify } from "../lib/analytics";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../lib/logo";
import { auth, billingApi, selectNow, selectCurrentUser } from "../lib/store";
import { STORAGE_KEYS } from "../lib/storageKeys";
import "../components/RequireAuth.css";

export function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Token is in the URL fragment (#token=…) so it never appears in server
    // logs or the Referer header.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const token = hashParams.get("token");

    if (!token) {
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    auth.loginWithToken(token).then(async (res) => {
      if (!res.ok) {
        navigate("/login?error=oauth_failed", { replace: true });
        return;
      }
      const user = selectNow(selectCurrentUser);

      const oauthRaw = sessionStorage.getItem(STORAGE_KEYS.OAUTH_METHOD);
      sessionStorage.removeItem(STORAGE_KEYS.OAUTH_METHOD);
      if (oauthRaw) {
        try {
          const { method, mode } = JSON.parse(oauthRaw) as { method: string; mode: string };
          if (mode === "signup") {
            if (user) identify(user.id, { email: user.email, name: `${user.firstName} ${user.lastName}`.trim(), plan: user.plan });
            capture("signup_completed", { method });
          } else {
            if (user) identify(user.id, { email: user.email, plan: user.plan });
            capture("login_completed", { method });
          }
        } catch { /* malformed */ }
      }

      const hasTrialIntent = sessionStorage.getItem(STORAGE_KEYS.TRIAL_INTENT) === "1";
      const hasProIntent = sessionStorage.getItem(STORAGE_KEYS.CHECKOUT_INTENT) === "pro";
      if (hasTrialIntent && user?.plan !== "pro") {
        sessionStorage.removeItem(STORAGE_KEYS.TRIAL_INTENT);
        await billingApi.checkout(user?.email ?? "", true);
      } else if (hasProIntent && user?.plan !== "pro") {
        sessionStorage.removeItem(STORAGE_KEYS.CHECKOUT_INTENT);
        await billingApi.checkout(user?.email ?? "");
      } else {
        navigate(user?.onboardingCompleted ? "/app" : "/onboarding", { replace: true });
      }
    }).catch(() => {
      navigate("/login?error=oauth_failed", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="require-auth__loading">
      <Wordmark size={24} />
      <span className="require-auth__label">Signing you in…</span>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../lib/logo";
import { auth, billingApi, selectNow, selectCurrentUser } from "../lib/store";
import { STORAGE_KEYS } from "../lib/storageKeys";
import "../components/RequireAuth.css";

export function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Token is in the URL fragment (#token=…) on current deployments so it
    // never appears in server logs or the Referer header. Fall back to the
    // query string for backwards-compatibility during rolling deploys where
    // the frontend is updated before the backend.
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const token = hashParams.get("token") ?? searchParams.get("token");

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

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../lib/logo";
import { auth, billingApi, selectNow, selectCurrentUser } from "../lib/store";

export function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Token is delivered in the URL fragment (#token=…) so it never appears
    // in server access logs or the Referer header on subsequent navigation.
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get("token");

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
      const hasProIntent = sessionStorage.getItem("checkout_intent") === "pro";
      if (hasProIntent && user?.plan !== "pro") {
        sessionStorage.removeItem("checkout_intent");
        await billingApi.checkout(user?.email ?? "");
      } else {
        navigate(user?.onboardingCompleted ? "/app" : "/onboarding", { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-4)",
      background: "var(--color-bg)",
      color: "var(--color-muted)",
    }}>
      <Wordmark size={24} />
      <span style={{ fontSize: "13px" }}>Signing you in…</span>
    </div>
  );
}

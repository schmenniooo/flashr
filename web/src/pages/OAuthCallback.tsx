import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wordmark } from "../lib/logo";
import { auth, selectNow, selectCurrentUser } from "../lib/store";

export function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    auth.loginWithToken(token).then((res) => {
      if (!res.ok) {
        navigate("/login?error=oauth_failed", { replace: true });
        return;
      }
      const user = selectNow(selectCurrentUser);
      navigate(user?.onboardingCompleted ? "/app" : "/onboarding", { replace: true });
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

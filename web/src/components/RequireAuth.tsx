import { Navigate, useLocation } from "react-router-dom";
import { useDb, selectCurrentUser, selectSession, selectBootstrapping } from "../lib/store";
import { Wordmark } from "../lib/logo";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const bootstrapping = useDb(selectBootstrapping);
  const session = useDb(selectSession);
  const location = useLocation();

  if (bootstrapping) {
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
        <span style={{ fontSize: "13px" }}>Loading…</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequireOnboarded({ children }: { children: React.ReactNode }) {
  const user = useDb(selectCurrentUser);
  if (user && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

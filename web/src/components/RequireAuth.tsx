import { Navigate, useLocation } from "react-router-dom";
import { useDb, selectSession, selectBootstrapping, selectCurrentUser } from "../lib/store";
import { Wordmark } from "../lib/logo";
import "./RequireAuth.css";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const bootstrapping = useDb(selectBootstrapping);
  const session = useDb(selectSession);
  const location = useLocation();

  // Block only when bootstrap is still running AND we have no cached session to show.
  // When a session exists in localStorage we render immediately from cached data;
  // bootstrap validates the token in the background and clears the session on 401.
  if (bootstrapping && !session) {
    return (
      <div className="require-auth__loading">
        <Wordmark size={24} />
        <span className="require-auth__label">Loading…</span>
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

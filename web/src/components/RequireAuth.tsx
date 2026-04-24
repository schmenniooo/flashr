import { Navigate, useLocation } from "react-router-dom";
import { useDb, selectSession } from "../lib/store";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useDb(selectSession);
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

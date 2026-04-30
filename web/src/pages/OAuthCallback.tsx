import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../lib/store";

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
      navigate(res.ok ? "/app" : "/login?error=oauth_failed", { replace: true });
    });
  }, [navigate]);

  return null;
}

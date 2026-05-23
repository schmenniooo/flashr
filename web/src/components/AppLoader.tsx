import { useState, useEffect } from "react";
import { Wordmark } from "../lib/logo";
import "./AppLoader.css";

const SLOW_THRESHOLD_MS = 5000;

export function AppLoader() {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_THRESHOLD_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="app-loader">
      <div className="app-loader__glow" />
      <div className="app-loader__content">
        <Wordmark size={34} />
        <div className="app-loader__spinner" />
        {slow && (
          <div className="app-loader__slow">
            Taking longer than expected&hellip;
          </div>
        )}
      </div>
    </div>
  );
}

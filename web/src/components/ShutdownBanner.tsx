import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { STORAGE_KEYS } from "../lib/storageKeys";
import "./ShutdownBanner.css";

const SHUTDOWN_DATE = "September 5, 2026";

function readDismissed() {
  try {
    return sessionStorage.getItem(STORAGE_KEYS.SHUTDOWN_BANNER_DISMISSED) === "1";
  } catch {
    return false;
  }
}

export function ShutdownBanner() {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(STORAGE_KEYS.SHUTDOWN_BANNER_DISMISSED, "1");
    } catch { /* sessionStorage unavailable */ }
    setDismissed(true);
  }

  return (
    <div className="shutdown-banner" role="alert">
      <div className="shutdown-banner__inner">
        <AlertTriangle size={16} strokeWidth={2} className="shutdown-banner__icon" />
        <p className="shutdown-banner__text">
          <strong>flashr is shutting down on {SHUTDOWN_DATE}.</strong> After
          that date your account and all data will be permanently deleted —
          please save or back up anything you want to keep before then.
        </p>
      </div>
      <button
        type="button"
        className="shutdown-banner__close"
        aria-label="Dismiss this notice"
        onClick={dismiss}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

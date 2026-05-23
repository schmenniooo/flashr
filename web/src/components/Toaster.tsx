import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { useToasts, dismissToast } from "../lib/toast";
import type { ToastType } from "../lib/toast";
import "./Toaster.css";

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={15} strokeWidth={2} />,
  error:   <XCircle     size={15} strokeWidth={2} />,
  info:    <Info        size={15} strokeWidth={2} />,
};

export function Toaster() {
  const toasts = useToasts();
  if (toasts.length === 0) return null;

  return (
    <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          <span className="toast__icon">{ICONS[t.type]}</span>
          <span className="toast__msg">{t.message}</span>
          <button
            className="toast__close"
            onClick={() => dismissToast(t.id)}
            aria-label="Dismiss"
          >
            <X size={13} strokeWidth={2.5} />
          </button>
        </div>
      ))}
    </div>
  );
}

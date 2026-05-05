import { useState } from "react";
import { Crown, X } from "lucide-react";
import { billingApi, selectCurrentUser, useDb } from "../lib/store";
import "./UpgradePrompt.css";

interface Props {
  reason: string;
}

export function UpgradePrompt({ reason }: Props) {
  const currentUser = useDb(selectCurrentUser);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!currentUser || currentUser.plan !== "free" || dismissed) return null;

  async function handleUpgrade() {
    if (!currentUser) return;
    setLoading(true);
    try {
      await billingApi.checkout(currentUser.email);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="upgrade-prompt fade-in">
      <div className="upgrade-prompt__icon">
        <Crown size={16} strokeWidth={2} />
      </div>
      <div className="upgrade-prompt__body">
        <strong>Upgrade to Pro</strong>
        <span>{reason}</span>
      </div>
      <button
        className="btn-primary upgrade-prompt__cta"
        onClick={handleUpgrade}
        disabled={loading}
      >
        {loading ? "Redirecting…" : "Upgrade"}
      </button>
      <button className="upgrade-prompt__dismiss" onClick={() => setDismissed(true)}>
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

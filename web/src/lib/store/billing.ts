import { api } from "../api";
import { capture } from "../analytics";

export const billingApi = {
  async checkout(email: string, withTrial = false): Promise<void> {
    capture("checkout_started", { plan: "pro_monthly" });
    const { url } = await api<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ email, with_trial: withTrial }),
    });
    window.location.href = url;
  },

  async portal(): Promise<void> {
    const { url } = await api<{ url: string }>("/billing/portal", {
      method: "POST",
    });
    window.location.href = url;
  },

  async fulfill(sessionId: string): Promise<void> {
    await api("/billing/fulfill", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
    capture("upgrade_completed", { plan: "pro_monthly" });
  },

  async sync(): Promise<void> {
    await api("/billing/sync", { method: "POST" });
  },
};

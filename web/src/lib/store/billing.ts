import { api } from "../api";
import posthog from "posthog-js";

export const billingApi = {
  async checkout(email: string, withTrial = false): Promise<void> {
    posthog.capture("checkout_started", { plan: "pro_monthly" });
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
    posthog.capture("upgrade_completed", { plan: "pro_monthly" });
  },

  async sync(): Promise<void> {
    await api("/billing/sync", { method: "POST" });
  },
};

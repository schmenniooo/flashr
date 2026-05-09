import { api } from "../api";

export const billingApi = {
  async checkout(email: string): Promise<void> {
    const { url } = await api<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    window.location.href = url;
  },

  async portal(): Promise<void> {
    const { url } = await api<{ url: string }>("/billing/portal", {
      method: "POST",
    });
    window.location.href = url;
  },

  /** Verify a completed Checkout Session and grant Pro immediately.
   *  Call this on the checkout success redirect before refreshing user state. */
  async fulfill(sessionId: string): Promise<void> {
    await api("/billing/fulfill", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  /** Sync the user's plan from Stripe's live subscription state.
   *  Call this on portal return so cancellations are reflected immediately. */
  async sync(): Promise<void> {
    await api("/billing/sync", { method: "POST" });
  },
};

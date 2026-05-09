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

  async fulfill(sessionId: string): Promise<void> {
    await api("/billing/fulfill", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    });
  },

  async sync(): Promise<void> {
    await api("/billing/sync", { method: "POST" });
  },
};

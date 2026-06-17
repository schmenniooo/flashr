import { api } from "../api";

// ─── State ────────────────────────────────────────────────────────────────────

type NotifState = {
  /** "unsupported" when the browser doesn't support push notifications. */
  permission: NotificationPermission | "unsupported";
  /** true when the browser has an active push subscription for this device. */
  subscribed: boolean;
  loading: boolean;
};

let _state: NotifState = {
  permission:
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  subscribed: false,
  loading: false,
};

const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((fn) => fn());
}

function _set(patch: Partial<NotifState>) {
  _state = { ..._state, ...patch };
  _emit();
}

// ─── useSyncExternalStore interface ─────────────────────────────────────────

export function subscribeNotif(fn: () => void): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function getNotifSnapshot(): NotifState {
  return _state;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function getVapidKey(): Promise<string> {
  const res = await api<{ key: string }>("/notifications/vapid-public-key");
  return res.key;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export const notificationsApi = {
  /**
   * Called once on app boot. Registers the service worker and checks whether
   * the browser already has an active push subscription.
   */
  async init(): Promise<void> {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      _set({ permission: "unsupported" });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      _set({
        permission: Notification.permission,
        subscribed: existing !== null,
      });
    } catch {
      // SW registration can fail in certain browser configurations — treat as unsupported.
      _set({ permission: "unsupported" });
    }
  },

  /**
   * Enables push notifications for this device.
   * Requests browser permission, creates a push subscription, persists it to
   * the backend, and saves the preferred reminder time + timezone.
   *
   * Throws if the user denies permission — callers should catch to update UI.
   */
  async enable(notificationTime: string, timezone: string): Promise<void> {
    if (!("serviceWorker" in navigator)) return;
    _set({ loading: true });
    try {
      const [vapidKey, reg] = await Promise.all([
        getVapidKey(),
        navigator.serviceWorker.ready,
      ]);

      // Unsubscribe any stale subscription before creating a new one. This is
      // necessary when the backend restarts and generates a new VAPID key — the
      // browser would otherwise throw "applicationServerKey differs from current
      // subscription" and block the subscribe call entirely.
      const stale = await reg.pushManager.getSubscription();
      if (stale) await stale.unsubscribe();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys?: { p256dh: string; auth: string };
      };

      if (!json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Push subscription is missing VAPID keys — try reloading the page.");
      }

      await api("/notifications/subscribe", {
        method: "POST",
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      });

      await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          notification_time: notificationTime,
          notification_tz: timezone,
        }),
      });

      _set({ permission: Notification.permission, subscribed: true });
    } catch (err) {
      // If permission was denied the state reflects that; other errors bubble up.
      _set({ permission: Notification.permission, subscribed: false });
      throw err;
    } finally {
      _set({ loading: false });
    }
  },

  /**
   * Disables push notifications for this device.
   * Removes the subscription from the browser and the backend, and clears the
   * reminder schedule from the user's profile.
   */
  async disable(): Promise<void> {
    _set({ loading: true });
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await api("/notifications/subscribe", {
            method: "DELETE",
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
      }
      // Clear notification schedule — send "" as the opt-out sentinel.
      await api("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ notification_time: "", notification_tz: "" }),
      });
      _set({ subscribed: false });
    } finally {
      _set({ loading: false });
    }
  },

  /**
   * Updates the reminder time for an already-subscribed device.
   * Called from the Profile save handler when notificationTime changes.
   */
  async updateTime(notificationTime: string, timezone: string): Promise<void> {
    await api("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({
        notification_time: notificationTime,
        notification_tz: timezone,
      }),
    });
  },
};

import { api, ApiError, setToken, API_BASE } from "../api";
import { state, setState, seedCollections, seedFolders } from "./db";
import { collectionsApi } from "./collections";
import { STORAGE_KEYS } from "../storageKeys";
import type { StoredUser } from "./db";
import type { LearnerType } from "../../types";

// ─────────────────────────────────────────────────────────────
// Session-expired event
// Fired by api.ts when a token refresh fails mid-session.
// ─────────────────────────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("flashr:logout", () => {
    setToken(null);
    localStorage.removeItem(STORAGE_KEYS.AI_CHAT_DRAFT);
    setState((db) => ({ ...db, session: null, collections: [], folders: [] }));
  });
}

// ─────────────────────────────────────────────────────────────
// Backend types
// ─────────────────────────────────────────────────────────────

type BackendUser = {
  id: string;
  email: string;
  name?: string;
  streak: number;
  plan: "free" | "pro";
  plan_expires_at?: string | null;
  created_at: string;
  onboarding_completed: boolean;
  age?: number | null;
  learner_types?: string[];
  avatar_url?: string | null;
};

type AuthResponse = {
  token: string;
  expires_at: string;
  user: BackendUser;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function shadowFromBackend(
  bu: BackendUser,
  hint?: { firstName?: string; lastName?: string },
): StoredUser {
  const fallbackName = (bu.name ?? "").trim();
  const [first, ...rest] = fallbackName ? fallbackName.split(/\s+/) : [];
  return {
    id: bu.id,
    email: bu.email,
    password: "",
    streak: bu.streak ?? 0,
    firstName: hint?.firstName?.trim() || first || bu.email.split("@")[0],
    lastName: hint?.lastName?.trim() || rest.join(" "),
    username: bu.email.split("@")[0],
    oauthProvider: "google",
    plan: bu.plan ?? "free",
    planExpiresAt: bu.plan_expires_at ?? null,
    memberSince: new Date(bu.created_at).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
    }),
    avatarUrl: bu.avatar_url ?? null,
    bio: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    language: "English",
    dailyGoal: 20,
    emailReminders: true,
    weeklyDigest: false,
    age: null,
    learnerTypes: bu.learner_types ?? [],
    age: bu.age ?? null,
    onboardingCompleted: bu.onboarding_completed,
    dismissedSuggestions: [],
  };
}

function adoptBackendUser(
  bu: BackendUser,
  hint?: { firstName?: string; lastName?: string },
) {
  setState((db) => {
    const existing = db.users.find((u) => u.id === bu.id);
    let user: StoredUser;
    if (existing) {
      const fallbackName = (bu.name ?? "").trim();
      const [first, ...rest] = fallbackName ? fallbackName.split(/\s+/) : [];
      user = {
        ...existing,
        email: bu.email,
        streak: bu.streak ?? existing.streak,
        plan: bu.plan ?? existing.plan,
        planExpiresAt: bu.plan_expires_at ?? null,
        onboardingCompleted: bu.onboarding_completed,
        age: bu.age ?? existing.age,
        learnerTypes: bu.learner_types ?? existing.learnerTypes,
        avatarUrl: bu.avatar_url ?? null,
        ...(fallbackName
          ? { firstName: first || existing.firstName, lastName: rest.join(" ") }
          : {}),
      };
    } else {
      user = shadowFromBackend(bu, hint);
    }
    const switchingUser = db.session?.userId !== bu.id;
    return {
      ...db,
      users: [...db.users.filter((u) => u.id !== bu.id), user],
      session: { userId: bu.id },
      // Clear previous user's data when the active account changes so there is
      // never a window where one user's session is paired with another's collections.
      collections: switchingUser ? [] : db.collections,
      folders: switchingUser ? [] : db.folders,
    };
  });
}

type AuthResult = { ok: true } | { ok: false; error: string };

function toAuthResult(err: unknown): AuthResult {
  if (err instanceof ApiError) return { ok: false, error: err.message };
  return { ok: false, error: "Network error. Please try again." };
}

// ─────────────────────────────────────────────────────────────
// Auth actions
// ─────────────────────────────────────────────────────────────

export const auth = {
  async signUp(input: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
  }): Promise<AuthResult> {
    const fullName = [input.firstName, input.lastName ?? ""]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    try {
      const res = await api<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email: input.email.trim(),
          password: input.password,
          name: fullName,
        }),
      });
      setToken(res.token);
      adoptBackendUser(res.user, { firstName: input.firstName, lastName: input.lastName });
      void collectionsApi.load().catch(console.error);
      return { ok: true };
    } catch (err) {
      return toAuthResult(err);
    }
  },

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setToken(res.token);
      adoptBackendUser(res.user);
      void collectionsApi.load().catch(console.error);
      return { ok: true };
    } catch (err) {
      return toAuthResult(err);
    }
  },

  async loginWithToken(token: string): Promise<AuthResult> {
    try {
      setToken(token);
      const res = await api<{ user: BackendUser }>("/auth/me");
      adoptBackendUser(res.user);
      void collectionsApi.load().catch(console.error);
      return { ok: true };
    } catch (err) {
      setToken(null);
      return toAuthResult(err);
    }
  },

  async bootstrap(): Promise<void> {
    try {
      if (!state.session) return;

      // Fulfill a pending Stripe checkout before any routing happens.
      // Profile.tsx normally does this, but new users get redirected to
      // /onboarding by RequireOnboarded before Profile ever mounts, which
      // drops the session_id from the URL and leaves the plan as free.
      const urlParams = new URLSearchParams(window.location.search);
      const checkoutSessionId = urlParams.get("session_id");
      if (urlParams.get("checkout") === "success" && checkoutSessionId) {
        await api("/billing/fulfill", {
          method: "POST",
          body: JSON.stringify({ session_id: checkoutSessionId }),
        }).catch(() => {});
      }

      const res = await api<{ user: BackendUser }>("/auth/me");
      adoptBackendUser(res.user);
      await collectionsApi.load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setState((db) => ({ ...db, session: null }));
      }
    } finally {
      setState((db) => ({ ...db, bootstrapping: false }));
    }
  },

  signInAsDemo() {
    const demo = state.users.find((u) => u.id === "demo-user");
    if (!demo) return;
    setState((db) => ({
      ...db,
      session: { userId: demo.id },
      collections: JSON.parse(JSON.stringify(seedCollections)),
      folders: JSON.parse(JSON.stringify(seedFolders)),
    }));
  },

  async completeOnboarding(input: {
    firstName: string;
    lastName?: string;
    age: number;
    learnerTypes: LearnerType[];
  }): Promise<void> {
    if (!state.session) return;
    const fullName = [input.firstName, input.lastName ?? ""]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    const res = await api<{ user: BackendUser }>("/auth/onboarding", {
      method: "POST",
      body: JSON.stringify({
        name: fullName,
        age: input.age,
        learner_types: input.learnerTypes,
      }),
    });
    adoptBackendUser(res.user);
  },

  async saveAvatar(dataUrl: string): Promise<void> {
    const res = await api<{ user: BackendUser }>("/auth/avatar", {
      method: "POST",
      body: JSON.stringify({ avatar_url: dataUrl }),
    });
    adoptBackendUser(res.user);
  },

  async removeAvatar(): Promise<void> {
    const res = await api<{ user: BackendUser }>("/auth/avatar", {
      method: "DELETE",
    });
    adoptBackendUser(res.user);
  },

  async refreshUser(): Promise<void> {
    try {
      const res = await api<{ user: BackendUser }>("/auth/me");
      adoptBackendUser(res.user);
    } catch {
      // ignore — stale plan is better than a broken UI
    }
  },

  async deleteAccount(): Promise<AuthResult> {
    try {
      await api("/auth/me", { method: "DELETE" });
      setToken(null);
      setState((db) => ({ ...db, session: null, collections: [], folders: [] }));
      return { ok: true };
    } catch (err) {
      return toAuthResult(err);
    }
  },

  signOut() {
    // Fire-and-forget: revoke the refresh cookie server-side so it can't be reused.
    fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
    setToken(null);
    localStorage.removeItem(STORAGE_KEYS.AI_CHAT_DRAFT);
    setState((db) => ({ ...db, session: null, collections: [], folders: [] }));
  },

  updateProfile(patch: Partial<Omit<StoredUser, "id" | "password" | "email">>) {
    const session = state.session;
    if (!session) return;
    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId ? { ...u, ...patch } : u,
      ),
    }));
  },
};

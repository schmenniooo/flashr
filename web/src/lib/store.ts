import { useSyncExternalStore } from "react";
import {
  collections as seedCollections,
  folders as seedFolders,
  suggestions as suggestionCatalog,
  user as seedUser,
  type Card,
  type Collection,
  type Folder,
  type LearnerType,
  type Suggestion,
  type User,
} from "../data/mock";
import { api, ApiError, setToken } from "./api";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type StoredUser = User & {
  id: string;
  streak: number;
  // Plain-text password — ONLY acceptable because this is a local prototype.
  // Replace with backend-issued session tokens when the Go API lands.
  password: string;
};

export type Session = {
  userId: string;
} | null;

type Db = {
  users: StoredUser[];
  session: Session;
  collections: Collection[];
  folders: Folder[];
  // card id → mastery, local-only until SRS lands in Phase 2
  masteryMap: Record<string, Card["mastery"]>;
  // transient — never persisted, always resets to true on load
  bootstrapping: boolean;
};

// ─────────────────────────────────────────────────────────────
// localStorage layer
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "flashr:db:v1";

function freshDb(): Db {
  const demoUser: StoredUser = {
    ...seedUser,
    id: "demo-user",
    streak: 12,
    password: "demo1234",
  };
  return {
    users: [demoUser],
    session: null,
    collections: [],
    folders: [],
    masteryMap: {},
    bootstrapping: true,
  };
}

function migrateUser(u: StoredUser): StoredUser {
  const legacy = u as StoredUser & { learnerType?: LearnerType | null };
  const learnerTypes = Array.isArray(u.learnerTypes)
    ? u.learnerTypes
    : legacy.learnerType
      ? [legacy.learnerType]
      : [];
  return {
    ...u,
    age: u.age ?? null,
    learnerTypes,
    // Pre-existing accounts predate onboarding, so treat them as completed
    // unless we explicitly know they need it.
    onboardingCompleted: u.onboardingCompleted ?? true,
    dismissedSuggestions: Array.isArray(u.dismissedSuggestions)
      ? u.dismissedSuggestions
      : [],
  };
}

function readDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = freshDb();
      writeDb(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as Db;
    return {
      ...parsed,
      users: parsed.users.map(migrateUser),
      masteryMap: parsed.masteryMap ?? {},
      bootstrapping: true,
    };
  } catch {
    const fresh = freshDb();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(db: Db) {
  const { bootstrapping: _, ...toSave } = db;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

// ─────────────────────────────────────────────────────────────
// Pub/sub
// ─────────────────────────────────────────────────────────────

let state: Db = readDb();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  writeDb(state);
  listeners.forEach((fn) => fn());
}

function setState(updater: (db: Db) => Db) {
  state = updater(state);
  emit();
}

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        state = JSON.parse(e.newValue) as Db;
        listeners.forEach((fn) => fn());
      } catch {
        /* ignore */
      }
    }
  });
}

function getSnapshot() {
  return state;
}

export function useDb<T>(selector: (db: Db) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getSnapshot()),
    () => selector(getSnapshot()),
  );
}

export function selectNow<T>(selector: (db: Db) => T): T {
  return selector(getSnapshot());
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────


function recalcProgress(c: Collection): Collection {
  if (c.cards.length === 0) return { ...c, progress: 0 };
  const score = c.cards.reduce((s, card) => {
    if (card.mastery === "known") return s + 1;
    if (card.mastery === "learning") return s + 0.5;
    return s;
  }, 0);
  return { ...c, progress: Math.round((score / c.cards.length) * 100) };
}

function recountFolders(folders: Folder[], collections: Collection[]): Folder[] {
  return folders.map((f) => ({
    ...f,
    count: collections.filter((c) => c.folder === f.name).length,
  }));
}

// ─────────────────────────────────────────────────────────────
// Selectors
// ─────────────────────────────────────────────────────────────

export const selectBootstrapping = (db: Db) => db.bootstrapping;
export const selectSession = (db: Db) => db.session;
export const selectCurrentUser = (db: Db): StoredUser | null => {
  if (!db.session) return null;
  return db.users.find((u) => u.id === db.session!.userId) ?? null;
};
export const selectCollections = (db: Db) => db.collections;
export const selectFolders = (db: Db) => db.folders;
export const selectCollection = (id: string) => (db: Db) =>
  db.collections.find((c) => c.id === id);

// ─────────────────────────────────────────────────────────────
// Auth actions
// ─────────────────────────────────────────────────────────────

// Backend identity payload returned by /api/auth/{signup,login,me}.
type BackendUser = {
  id: string;
  email: string;
  name?: string;
  streak: number;
  plan: "free" | "pro";
  plan_expires_at?: string | null;
  created_at: string;
};

type AuthResponse = {
  token: string;
  expires_at: number;
  user: BackendUser;
};

// Build a local profile shadow for a backend user. The backend owns identity
// (id, email, name, password). Everything else (preferences, onboarding state,
// daily goal, etc.) is local-only profile data until those endpoints exist.
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
    avatarUrl: null,
    bio: "",
    timezone: "Europe/Berlin",
    language: "English",
    dailyGoal: 20,
    emailReminders: true,
    weeklyDigest: false,
    age: null,
    learnerTypes: [],
    onboardingCompleted: false,
    dismissedSuggestions: [],
  };
}

function adoptBackendUser(
  bu: BackendUser,
  hint?: { firstName?: string; lastName?: string },
) {
  setState((db) => {
    const existing = db.users.find((u) => u.id === bu.id);
    const user = existing
      ? { ...existing, email: bu.email, streak: bu.streak ?? existing.streak, plan: bu.plan ?? existing.plan, planExpiresAt: bu.plan_expires_at ?? null }
      : shadowFromBackend(bu, hint);
    return {
      ...db,
      users: [...db.users.filter((u) => u.id !== bu.id), user],
      session: { userId: bu.id },
    };
  });
}

type AuthResult = { ok: true } | { ok: false; error: string };

function toAuthResult(err: unknown): AuthResult {
  if (err instanceof ApiError) return { ok: false, error: err.message };
  return { ok: false, error: "Network error. Please try again." };
}

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
      adoptBackendUser(res.user, {
        firstName: input.firstName,
        lastName: input.lastName,
      });
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

  /**
   * OAuth callback: the backend already issued a token; store it and fetch
   * the user to establish a full session. Used by OAuthCallback.tsx.
   */
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

  /**
   * On app boot: if we have a stored token, ask the backend who it belongs to.
   * If the token is invalid or expired, drop it and the local session.
   */
  async bootstrap(): Promise<void> {
    try {
      if (!state.session) return;
      const res = await api<{ user: BackendUser }>("/auth/me");
      adoptBackendUser(res.user);
      await collectionsApi.load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setState((db) => ({ ...db, session: null }));
      }
      // Network errors: leave local session alone — user can retry.
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

  /**
   * Dev-only: signs in as a fresh test user that still needs to complete
   * onboarding. Resets the test user every call so the flow can be re-tried.
   */
  signInAsOnboardingTest() {
    const id = "onboarding-test-user";
    const testUser: StoredUser = {
      id,
      streak: 0,
      email: "onboarding-test@flashr.io",
      password: "onboarding",
      firstName: "",
      lastName: "",
      username: "onboarding-test",
      oauthProvider: "google",
      plan: "free",
      planExpiresAt: null,
      memberSince: new Date().toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
      avatarUrl: null,
      bio: "",
      timezone: "Europe/Berlin",
      language: "English",
      dailyGoal: 20,
      emailReminders: true,
      weeklyDigest: false,
      age: null,
      learnerTypes: [],
      onboardingCompleted: false,
      dismissedSuggestions: [],
    };
    setState((db) => ({
      ...db,
      users: [...db.users.filter((u) => u.id !== id), testUser],
      session: { userId: id },
    }));
  },

  completeOnboarding(input: {
    firstName: string;
    lastName?: string;
    age: number;
    learnerTypes: LearnerType[];
  }) {
    const session = state.session;
    if (!session) return;
    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId
          ? {
              ...u,
              firstName: input.firstName,
              lastName: input.lastName ?? u.lastName,
              age: input.age,
              learnerTypes: input.learnerTypes,
              onboardingCompleted: true,
            }
          : u,
      ),
    }));
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
    setToken(null);
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

// ─────────────────────────────────────────────────────────────
// Backend → frontend mapping helpers
// ─────────────────────────────────────────────────────────────

type BackendCard = {
  id: string;
  question: string;
  answer: string;
  ai_generated: boolean;
  created_at: string;
};

type BackendCollection = {
  id: string;
  name: string;
  folder: string;
  emoji: string;
  description: string;
  is_public: boolean;
  created_at: string;
  cards: BackendCard[];
};

// Re-export core domain types so components don't need to import from data/mock.
export type { Card, Collection, Folder, LearnerType, Suggestion } from "../data/mock";

function mapCard(bc: BackendCard, masteryMap: Record<string, Card["mastery"]>): Card {
  return {
    id: bc.id,
    question: bc.question,
    answer: bc.answer,
    aiGenerated: bc.ai_generated,
    mastery: masteryMap[bc.id] ?? "new",
  };
}

function mapCollection(bc: BackendCollection, db: Db): Collection {
  const cards = bc.cards.map((k) => mapCard(k, db.masteryMap));
  const progress = cards.length === 0 ? 0 : Math.round(
    (cards.reduce((s, k) => s + (k.mastery === "known" ? 1 : k.mastery === "learning" ? 0.5 : 0), 0) / cards.length) * 100
  );
  const existing = db.collections.find((c) => c.id === bc.id);
  return {
    id: bc.id,
    name: bc.name,
    folder: bc.folder,
    emoji: bc.emoji,
    description: bc.description,
    isPublic: bc.is_public,
    createdAt: bc.created_at,
    cards,
    lastStudied: existing?.lastStudied ?? "never",
    progress,
  };
}

// ─────────────────────────────────────────────────────────────
// Collection actions
// ─────────────────────────────────────────────────────────────

export const collectionsApi = {
  /** Fetch all collections from the backend and replace local state. */
  async load(): Promise<void> {
    const res = await api<{ collections: BackendCollection[] }>("/collections");
    setState((db) => {
      const collections = res.collections.map((bc) => mapCollection(bc, db));
      // Upsert any folders present in backend data that aren't in local state yet.
      const known = new Set(db.folders.map((f) => f.name));
      const merged = [...db.folders];
      for (const c of collections) {
        if (c.folder && !known.has(c.folder)) {
          merged.push({ name: c.folder, emoji: "📁", count: 0 });
          known.add(c.folder);
        }
      }
      return { ...db, collections, folders: recountFolders(merged, collections) };
    });
  },

  async create(input: {
    name: string;
    folder: string;
    emoji?: string;
    description?: string;
  }): Promise<Collection> {
    const bc = await api<BackendCollection>("/collections", {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        folder: input.folder === "Uncategorized" ? "" : input.folder,
        emoji: input.emoji || "📚",
        description: input.description || "",
      }),
    });
    const col = mapCollection(bc, state);
    setState((db) => {
      const collections = [col, ...db.collections];
      // Upsert the folder locally in case it was passed in as a brand-new name.
      const known = new Set(db.folders.map((f) => f.name));
      const folders = col.folder && !known.has(col.folder)
        ? [...db.folders, { name: col.folder, emoji: "📁", count: 0 }]
        : db.folders;
      return { ...db, collections, folders: recountFolders(folders, collections) };
    });
    return col;
  },

  async update(id: string, patch: Partial<Omit<Collection, "id" | "cards">>): Promise<void> {
    // Apply optimistically so the UI responds immediately.
    setState((db) => {
      const existing = db.collections.find(c => c.id === id);
      if (!existing) return db;
      const updated = recalcProgress({ ...existing, ...patch });
      const collections = db.collections.map(c => c.id === id ? updated : c);
      const known = new Set(db.folders.map(f => f.name));
      const folders = updated.folder && !known.has(updated.folder)
        ? [...db.folders, { name: updated.folder, emoji: "📁", count: 0 }]
        : db.folders;
      return { ...db, collections, folders: recountFolders(folders, collections) };
    });

    // Persist and reconcile with authoritative backend data.
    try {
      const bc = await api<BackendCollection>(`/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: patch.name,
          folder: patch.folder === "Uncategorized" ? "" : patch.folder,
          emoji: patch.emoji,
          description: patch.description,
        }),
      });
      setState((db) => {
        const existing = db.collections.find(c => c.id === id);
        const updated = recalcProgress({
          ...mapCollection(bc, db),
          cards: existing?.cards ?? [],
          lastStudied: patch.lastStudied ?? existing?.lastStudied ?? "never",
        });
        const collections = db.collections.map(c => c.id === id ? updated : c);
        const known = new Set(db.folders.map(f => f.name));
        const folders = updated.folder && !known.has(updated.folder)
          ? [...db.folders, { name: updated.folder, emoji: "📁", count: 0 }]
          : db.folders;
        return { ...db, collections, folders: recountFolders(folders, collections) };
      });
    } catch (err) {
      console.error(err);
    }
  },

  async remove(id: string): Promise<void> {
    await api(`/collections/${id}`, { method: "DELETE" });
    setState((db) => {
      const collections = db.collections.filter((c) => c.id !== id);
      return { ...db, collections, folders: recountFolders(db.folders, collections) };
    });
  },

  /** Local-only: record last studied timestamp without a backend call. */
  touch(id: string) {
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === id ? { ...c, lastStudied: "just now" } : c,
      ),
    }));
  },
};

// ─────────────────────────────────────────────────────────────
// Card actions
// ─────────────────────────────────────────────────────────────

export const cardsApi = {
  async add(collectionId: string, input: { question: string; answer: string }): Promise<Card> {
    const bc = await api<BackendCard>(`/collections/${collectionId}/cards`, {
      method: "POST",
      body: JSON.stringify({ question: input.question, answer: input.answer }),
    });
    const card = mapCard(bc, state.masteryMap);
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: [...c.cards, card] })
          : c,
      ),
    }));
    return card;
  },

  async update(collectionId: string, cardId: string, patch: { question?: string; answer?: string }): Promise<void> {
    const bc = await api<BackendCard>(`/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify({ question: patch.question, answer: patch.answer }),
    });
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({
              ...c,
              cards: c.cards.map((k) =>
                k.id === cardId ? { ...k, question: bc.question, answer: bc.answer } : k,
              ),
            })
          : c,
      ),
    }));
  },

  async remove(collectionId: string, cardId: string): Promise<void> {
    await api(`/cards/${cardId}`, { method: "DELETE" });
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: c.cards.filter((k) => k.id !== cardId) })
          : c,
      ),
    }));
  },

  async move(fromCollectionId: string, cardId: string, toCollectionId: string): Promise<void> {
    const card = state.collections.find(c => c.id === fromCollectionId)?.cards.find(k => k.id === cardId);
    if (!card) return;
    await api(`/cards/${cardId}`, {
      method: "PATCH",
      body: JSON.stringify({ collection_id: toCollectionId }),
    });
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) => {
        if (c.id === fromCollectionId) return recalcProgress({ ...c, cards: c.cards.filter(k => k.id !== cardId) });
        if (c.id === toCollectionId) return recalcProgress({ ...c, cards: [...c.cards, card] });
        return c;
      }),
    }));
  },

  /** Local-only: mastery tracking stays in localStorage until SRS (Phase 2). */
  setMastery(collectionId: string, cardId: string, mastery: Card["mastery"]) {
    setState((db) => ({
      ...db,
      masteryMap: { ...db.masteryMap, [cardId]: mastery },
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({ ...c, cards: c.cards.map((k) => k.id === cardId ? { ...k, mastery } : k) })
          : c,
      ),
    }));
  },
};

// ─────────────────────────────────────────────────────────────
// Folder actions
// ─────────────────────────────────────────────────────────────

export const foldersApi = {
  create(name: string, emoji = "📁") {
    setState((db) => {
      if (db.folders.some((f) => f.name === name)) return db;
      return {
        ...db,
        folders: [...db.folders, { name, emoji, count: 0 }],
      };
    });
  },

  rename(oldName: string, newName: string) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    const affected = state.collections.filter((c) => c.folder === oldName);
    setState((db) => {
      if (db.folders.some((f) => f.name.toLowerCase() === trimmed.toLowerCase() && f.name !== oldName)) return db;
      return {
        ...db,
        folders: db.folders.map((f) => f.name === oldName ? { ...f, name: trimmed } : f),
        collections: db.collections.map((c) => c.folder === oldName ? { ...c, folder: trimmed } : c),
      };
    });
    void Promise.all(
      affected.map((c) =>
        api(`/collections/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ folder: trimmed }),
        }).catch(console.error),
      ),
    );
  },

  remove(name: string) {
    const affected = state.collections.filter((c) => c.folder === name);

    // Update local state immediately so the UI responds without waiting.
    setState((db) => ({
      ...db,
      folders: db.folders.filter((f) => f.name !== name),
      collections: db.collections.map((c) =>
        c.folder === name ? { ...c, folder: "" } : c,
      ),
    }));

    // Persist each affected collection to the backend in parallel.
    void Promise.all(
      affected.map((c) =>
        api(`/collections/${c.id}`, {
          method: "PATCH",
          body: JSON.stringify({ folder: "" }),
        }).catch(console.error),
      ),
    );
  },
};

// ─────────────────────────────────────────────────────────────
// Suggestions
// ─────────────────────────────────────────────────────────────

const MAX_SUGGESTIONS = 4;
const EMPTY_SUGGESTIONS: Suggestion[] = [];

let suggestionsCache: {
  users: Db["users"];
  collections: Db["collections"];
  session: Db["session"];
  result: Suggestion[];
} | null = null;

export const selectSuggestionsForUser = (db: Db): Suggestion[] => {
  if (
    suggestionsCache &&
    suggestionsCache.users === db.users &&
    suggestionsCache.collections === db.collections &&
    suggestionsCache.session === db.session
  ) {
    return suggestionsCache.result;
  }

  const user = db.session
    ? db.users.find((u) => u.id === db.session!.userId)
    : null;

  let result: Suggestion[];
  if (!user || user.learnerTypes.length === 0) {
    result = EMPTY_SUGGESTIONS;
  } else {
    const types = new Set(user.learnerTypes);
    const dismissed = new Set(user.dismissedSuggestions);
    const existingNames = new Set(
      db.collections.map((c) => c.name.toLowerCase()),
    );
    const filtered = suggestionCatalog
      .filter((s) => s.learnerTypes.some((t) => types.has(t)))
      .filter((s) => !dismissed.has(s.id))
      .filter((s) => !existingNames.has(s.title.toLowerCase()))
      .slice(0, MAX_SUGGESTIONS);
    result = filtered.length === 0 ? EMPTY_SUGGESTIONS : filtered;
  }

  suggestionsCache = {
    users: db.users,
    collections: db.collections,
    session: db.session,
    result,
  };
  return result;
};

export const suggestionsApi = {
  dismiss(id: string) {
    const session = state.session;
    if (!session) return;
    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId
          ? {
              ...u,
              dismissedSuggestions: u.dismissedSuggestions.includes(id)
                ? u.dismissedSuggestions
                : [...u.dismissedSuggestions, id],
            }
          : u,
      ),
    }));
  },

  async accept(id: string): Promise<Collection | null> {
    const session = state.session;
    if (!session) return null;
    const suggestion = suggestionCatalog.find((s) => s.id === id);
    if (!suggestion) return null;

    // Dismiss first so the UI removes it immediately.
    setState((db) => ({
      ...db,
      users: db.users.map((u) =>
        u.id === session.userId
          ? {
              ...u,
              dismissedSuggestions: u.dismissedSuggestions.includes(id)
                ? u.dismissedSuggestions
                : [...u.dismissedSuggestions, id],
            }
          : u,
      ),
    }));

    // Ensure the folder exists locally.
    setState((db) => {
      if (db.folders.some((f) => f.name === suggestion.folder)) return db;
      return {
        ...db,
        folders: [
          ...db.folders,
          { name: suggestion.folder, emoji: suggestion.folderEmoji, count: 0 },
        ],
      };
    });

    return collectionsApi.create({
      name: suggestion.title,
      folder: suggestion.folder,
      emoji: suggestion.emoji,
      description: suggestion.description,
    });
  },
};

// ─────────────────────────────────────────────────────────────
// Billing actions
// ─────────────────────────────────────────────────────────────

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
};

// ─────────────────────────────────────────────────────────────
// Dev utility
// ─────────────────────────────────────────────────────────────

export function resetLocalDb() {
  state = freshDb();
  emit();
}

if (typeof window !== "undefined") {
  (window as unknown as {
    flashrResetDb: () => void;
    flashrSignInAsDemo: () => void;
  }).flashrResetDb = resetLocalDb;
  (window as unknown as {
    flashrResetDb: () => void;
    flashrSignInAsDemo: () => void;
  }).flashrSignInAsDemo = () => auth.signInAsDemo();
}

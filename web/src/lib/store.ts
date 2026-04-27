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
};

// ─────────────────────────────────────────────────────────────
// localStorage layer
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "flashr:db:v1";

function freshDb(): Db {
  const demoUser: StoredUser = {
    ...seedUser,
    id: "demo-user",
    password: "demo1234",
  };
  return {
    users: [demoUser],
    session: null,
    collections: JSON.parse(JSON.stringify(seedCollections)),
    folders: JSON.parse(JSON.stringify(seedFolders)),
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
    return { ...parsed, users: parsed.users.map(migrateUser) };
  } catch {
    const fresh = freshDb();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(db: Db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
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

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function uid(prefix = "") {
  return `${prefix}${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

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
    firstName: hint?.firstName?.trim() || first || bu.email.split("@")[0],
    lastName: hint?.lastName?.trim() || rest.join(" "),
    username: bu.email.split("@")[0],
    oauthProvider: "google",
    plan: "free",
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
      ? { ...existing, email: bu.email }
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
      return { ok: true };
    } catch (err) {
      return toAuthResult(err);
    }
  },

  /**
   * On app boot: if we have a stored token, ask the backend who it belongs to.
   * If the token is invalid or expired, drop it and the local session.
   */
  async bootstrap(): Promise<void> {
    if (!state.session) return;
    try {
      const res = await api<{ user: BackendUser }>("/auth/me");
      adoptBackendUser(res.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setToken(null);
        setState((db) => ({ ...db, session: null }));
      }
      // Network errors: leave local session alone — user can retry.
    }
  },

  signInAsDemo() {
    const demo = state.users.find((u) => u.id === "demo-user");
    if (!demo) return;
    setState((db) => ({ ...db, session: { userId: demo.id } }));
  },

  /**
   * Dev-only: signs in as a fresh test user that still needs to complete
   * onboarding. Resets the test user every call so the flow can be re-tried.
   */
  signInAsOnboardingTest() {
    const id = "onboarding-test-user";
    const testUser: StoredUser = {
      id,
      email: "onboarding-test@flashr.io",
      password: "onboarding",
      firstName: "",
      lastName: "",
      username: "onboarding-test",
      oauthProvider: "google",
      plan: "free",
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

  signOut() {
    setToken(null);
    setState((db) => ({ ...db, session: null }));
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
// Collection actions
// ─────────────────────────────────────────────────────────────

export const collectionsApi = {
  create(input: {
    name: string;
    folder: string;
    emoji?: string;
    description?: string;
  }): Collection {
    const col: Collection = {
      id: uid("col_"),
      name: input.name,
      folder: input.folder,
      emoji: input.emoji || "📚",
      description: input.description || "",
      cards: [],
      lastStudied: "just now",
      progress: 0,
      isPublic: false,
    };
    setState((db) => {
      const collections = [col, ...db.collections];
      return {
        ...db,
        collections,
        folders: recountFolders(db.folders, collections),
      };
    });
    return col;
  },

  update(id: string, patch: Partial<Omit<Collection, "id" | "cards">>) {
    setState((db) => {
      const collections = db.collections.map((c) =>
        c.id === id ? { ...c, ...patch } : c,
      );
      return {
        ...db,
        collections,
        folders: recountFolders(db.folders, collections),
      };
    });
  },

  remove(id: string) {
    setState((db) => {
      const collections = db.collections.filter((c) => c.id !== id);
      return {
        ...db,
        collections,
        folders: recountFolders(db.folders, collections),
      };
    });
  },

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
  add(collectionId: string, input: Omit<Card, "id" | "mastery"> & { mastery?: Card["mastery"] }): Card {
    const card: Card = {
      id: uid("card_"),
      question: input.question,
      answer: input.answer,
      aiGenerated: input.aiGenerated ?? false,
      mastery: input.mastery ?? "new",
    };
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

  update(
    collectionId: string,
    cardId: string,
    patch: Partial<Omit<Card, "id">>,
  ) {
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({
              ...c,
              cards: c.cards.map((k) =>
                k.id === cardId ? { ...k, ...patch } : k,
              ),
            })
          : c,
      ),
    }));
  },

  remove(collectionId: string, cardId: string) {
    setState((db) => ({
      ...db,
      collections: db.collections.map((c) =>
        c.id === collectionId
          ? recalcProgress({
              ...c,
              cards: c.cards.filter((k) => k.id !== cardId),
            })
          : c,
      ),
    }));
  },

  setMastery(
    collectionId: string,
    cardId: string,
    mastery: Card["mastery"],
  ) {
    this.update(collectionId, cardId, { mastery });
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

  remove(name: string) {
    setState((db) => ({
      ...db,
      folders: db.folders.filter((f) => f.name !== name),
      collections: db.collections.map((c) =>
        c.folder === name ? { ...c, folder: "Uncategorized" } : c,
      ),
    }));
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

  accept(id: string): Collection | null {
    const session = state.session;
    if (!session) return null;
    const suggestion = suggestionCatalog.find((s) => s.id === id);
    if (!suggestion) return null;

    const col: Collection = {
      id: uid("col_"),
      name: suggestion.title,
      folder: suggestion.folder,
      emoji: suggestion.emoji,
      description: suggestion.description,
      cards: [],
      lastStudied: "just now",
      progress: 0,
      isPublic: false,
    };

    setState((db) => {
      const folderExists = db.folders.some((f) => f.name === suggestion.folder);
      const folders = folderExists
        ? db.folders
        : [
            ...db.folders,
            { name: suggestion.folder, emoji: suggestion.folderEmoji, count: 0 },
          ];
      const collections = [col, ...db.collections];
      return {
        ...db,
        collections,
        folders: recountFolders(folders, collections),
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
      };
    });
    return col;
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
  (window as unknown as { flashrResetDb: () => void }).flashrResetDb = resetLocalDb;
}

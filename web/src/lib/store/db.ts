import { useSyncExternalStore } from "react";
import {
  collections as seedCollections,
  folders as seedFolders,
  user as seedUser,
} from "../../data/mock";
import { STORAGE_KEYS } from "../storageKeys";
import type { Card, Collection, Folder, LearnerType, User } from "../../types";

// ─────────────────────────────────────────────────────────────
// Public types
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

export type Db = {
  users: StoredUser[];
  session: Session;
  collections: Collection[];
  folders: Folder[];
  // card id → mastery, local-only until SRS lands in Phase 2
  masteryMap: Record<string, Card["mastery"]>;
  // transient — never persisted, always resets to true on load
  bootstrapping: boolean;
  collectionsLoading: boolean;
  // cards reviewed today (from review API responses, resets on reload)
  cardsToday: number;
  theme: "dark" | "light" | "system";
};

// ─────────────────────────────────────────────────────────────
// localStorage layer
// ─────────────────────────────────────────────────────────────

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
    collectionsLoading: false,
    cardsToday: 0,
    theme: "system",
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
    const raw = localStorage.getItem(STORAGE_KEYS.DB);
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
      collectionsLoading: false,
      cardsToday: 0,
      theme: parsed.theme ?? "system",
    };
  } catch {
    const fresh = freshDb();
    writeDb(fresh);
    return fresh;
  }
}

function writeDb(db: Db) {
  localStorage.setItem(STORAGE_KEYS.DB, JSON.stringify(db, (key, value) =>
    key === "bootstrapping" ? undefined : value
  ));
}

// ─────────────────────────────────────────────────────────────
// Pub/sub engine
// ─────────────────────────────────────────────────────────────

export let state: Db = readDb();
const listeners = new Set<() => void>();

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  writeDb(state);
  listeners.forEach((fn) => fn());
}

export function setState(updater: (db: Db) => Db) {
  state = updater(state);
  emit();
}

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEYS.DB && e.newValue) {
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
// Selectors
// ─────────────────────────────────────────────────────────────

export const selectBootstrapping = (db: Db) => db.bootstrapping;
export const selectCollectionsLoading = (db: Db) => db.collectionsLoading;
export const selectSession = (db: Db) => db.session;
export const selectCurrentUser = (db: Db): StoredUser | null => {
  if (!db.session) return null;
  return db.users.find((u) => u.id === db.session!.userId) ?? null;
};
export const selectCollections = (db: Db) => db.collections;
export const selectFolders = (db: Db) => db.folders;
export const selectCollection = (id: string) => (db: Db) =>
  db.collections.find((c) => c.id === id);
export const selectTotalCards = (db: Db) =>
  db.collections.reduce((s, c) => s + c.cards.length, 0);
export const selectCardsDueToday = (db: Db) => {
  const now = new Date();
  return db.collections.reduce(
    (s, c) => s + c.cards.filter((k) => !k.dueDate || new Date(k.dueDate) <= now).length,
    0,
  );
};
export const selectKnownCards = (db: Db) =>
  db.collections.reduce((s, c) => s + c.cards.filter((k) => k.mastery === "known").length, 0);
export const selectCardsToday = (db: Db) => db.cardsToday;
export const selectTheme = (db: Db) => db.theme;
export function setTheme(t: "dark" | "light" | "system") {
  setState((db) => ({ ...db, theme: t }));
}

// ─────────────────────────────────────────────────────────────
// Shared helpers (used across action modules)
// ─────────────────────────────────────────────────────────────

export function recalcProgress(c: Collection): Collection {
  if (c.cards.length === 0) return { ...c, progress: 0 };
  const score = c.cards.reduce((s, card) => {
    if (card.mastery === "known") return s + 1;
    if (card.mastery === "learning") return s + 0.5;
    return s;
  }, 0);
  return { ...c, progress: Math.round((score / c.cards.length) * 100) };
}

export function recountFolders(folders: Folder[], collections: Collection[]): Folder[] {
  return folders.map((f) => ({
    ...f,
    count: collections.filter((c) => c.folder === f.name).length,
  }));
}

// ─────────────────────────────────────────────────────────────
// Dev utilities
// ─────────────────────────────────────────────────────────────

export function resetLocalDb() {
  state = freshDb();
  emit();
}

// Seed data exported for use by auth actions (demo sign-in).
export { seedCollections, seedFolders };

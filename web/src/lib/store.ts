import { useSyncExternalStore } from "react";
import {
  collections as seedCollections,
  folders as seedFolders,
  user as seedUser,
  type Card,
  type Collection,
  type Folder,
  type User,
} from "../data/mock";

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

function readDb(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = freshDb();
      writeDb(fresh);
      return fresh;
    }
    return JSON.parse(raw) as Db;
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

export const auth = {
  signUp(input: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
  }): { ok: true } | { ok: false; error: string } {
    const email = input.email.trim().toLowerCase();
    if (state.users.some((u) => u.email.toLowerCase() === email)) {
      return { ok: false, error: "An account with this email already exists." };
    }
    const id = uid("u_");
    const newUser: StoredUser = {
      id,
      email,
      password: input.password,
      firstName: input.firstName || email.split("@")[0],
      lastName: input.lastName || "",
      username: email.split("@")[0],
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
    };
    setState((db) => ({
      ...db,
      users: [...db.users, newUser],
      session: { userId: id },
    }));
    return { ok: true };
  },

  signIn(
    email: string,
    password: string,
  ): { ok: true } | { ok: false; error: string } {
    const found = state.users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!found || found.password !== password) {
      return { ok: false, error: "Email or password is incorrect." };
    }
    setState((db) => ({ ...db, session: { userId: found.id } }));
    return { ok: true };
  },

  signInAsDemo() {
    const demo = state.users.find((u) => u.id === "demo-user");
    if (!demo) return;
    setState((db) => ({ ...db, session: { userId: demo.id } }));
  },

  signOut() {
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
// Dev utility
// ─────────────────────────────────────────────────────────────

export function resetLocalDb() {
  state = freshDb();
  emit();
}

if (typeof window !== "undefined") {
  (window as unknown as { flashrResetDb: () => void }).flashrResetDb = resetLocalDb;
}

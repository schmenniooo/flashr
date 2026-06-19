import { describe, it, expect } from "vitest";
import {
  selectTotalCards,
  selectCardsDueToday,
  selectCardsToday,
  selectKnownCards,
  selectCurrentUser,
  selectCollections,
  selectFolders,
} from "../lib/store";
import type { StoredUser, Session } from "../lib/store";
import type { Card, Collection, Folder } from "../types";

// ─────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: "c1",
    question: "Q",
    answer: "A",
    aiGenerated: false,
    mastery: "new",
    dueDate: null,
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    ...overrides,
  };
}

function makeCollection(overrides: Partial<Collection> = {}): Collection {
  return {
    id: "col1",
    name: "Test",
    folder: "",
    emoji: "📚",
    description: "",
    cards: [],
    lastStudied: "never",
    progress: 0,
    isPublic: false,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<StoredUser> = {}): StoredUser {
  return {
    id: "u1",
    email: "test@flashr.io",
    password: "",
    streak: 0,
    firstName: "Test",
    lastName: "User",
    username: "test",
    oauthProvider: "google",
    plan: "free",
    planExpiresAt: null,
    memberSince: "January 2026",
    avatarUrl: null,
    bio: "",
    timezone: "Europe/Berlin",
    language: "English",
    dailyGoal: 20,
    emailReminders: false,
    weeklyDigest: false,
    notificationTime: "08:00",
    age: null,
    learnerTypes: [],
    onboardingCompleted: true,
    dismissedSuggestions: [],
    ...overrides,
  };
}

function makeDb(overrides: {
  users?: StoredUser[];
  session?: Session;
  collections?: Collection[];
  folders?: Folder[];
  cardsToday?: number;
} = {}) {
  return {
    users: overrides.users ?? [],
    session: overrides.session ?? null,
    collections: overrides.collections ?? [],
    folders: overrides.folders ?? [],
    masteryMap: {},
    bootstrapping: false,
    collectionsLoading: false,
    cardsToday: overrides.cardsToday ?? 0,
    theme: "dark" as const,
  };
}

// ─────────────────────────────────────────────────────────────
// selectTotalCards
// ─────────────────────────────────────────────────────────────

describe("selectTotalCards", () => {
  it("returns 0 with no collections", () => {
    expect(selectTotalCards(makeDb())).toBe(0);
  });

  it("sums cards across all collections", () => {
    const db = makeDb({
      collections: [
        makeCollection({ id: "a", cards: [makeCard(), makeCard()] }),
        makeCollection({ id: "b", cards: [makeCard()] }),
      ],
    });
    expect(selectTotalCards(db)).toBe(3);
  });

  it("ignores empty collections", () => {
    const db = makeDb({
      collections: [
        makeCollection({ id: "a", cards: [] }),
        makeCollection({ id: "b", cards: [makeCard()] }),
      ],
    });
    expect(selectTotalCards(db)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// selectCardsDueToday
// ─────────────────────────────────────────────────────────────

describe("selectCardsDueToday", () => {
  it("returns 0 with no collections", () => {
    expect(selectCardsDueToday(makeDb())).toBe(0);
  });

  it("counts cards with null dueDate (never reviewed) as due", () => {
    const db = makeDb({
      collections: [
        makeCollection({
          cards: [
            makeCard({ id: "1", dueDate: null }),
            makeCard({ id: "2", dueDate: null }),
          ],
        }),
      ],
    });
    expect(selectCardsDueToday(db)).toBe(2);
  });

  it("counts cards with a past dueDate as due", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const db = makeDb({
      collections: [
        makeCollection({
          cards: [makeCard({ id: "1", dueDate: yesterday })],
        }),
      ],
    });
    expect(selectCardsDueToday(db)).toBe(1);
  });

  it("excludes cards with a future dueDate", () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const db = makeDb({
      collections: [
        makeCollection({
          cards: [makeCard({ id: "1", dueDate: tomorrow })],
        }),
      ],
    });
    expect(selectCardsDueToday(db)).toBe(0);
  });

  it("mixes due and not-due cards correctly", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const db = makeDb({
      collections: [
        makeCollection({
          cards: [
            makeCard({ id: "1", dueDate: null }),       // due (never reviewed)
            makeCard({ id: "2", dueDate: yesterday }),  // due (past)
            makeCard({ id: "3", dueDate: tomorrow }),   // not due
          ],
        }),
      ],
    });
    expect(selectCardsDueToday(db)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// selectKnownCards
// ─────────────────────────────────────────────────────────────

describe("selectKnownCards", () => {
  it("counts only known cards across collections", () => {
    const db = makeDb({
      collections: [
        makeCollection({
          id: "a",
          cards: [
            makeCard({ id: "1", mastery: "known" }),
            makeCard({ id: "2", mastery: "new" }),
          ],
        }),
        makeCollection({
          id: "b",
          cards: [makeCard({ id: "3", mastery: "known" })],
        }),
      ],
    });
    expect(selectKnownCards(db)).toBe(2);
  });

  it("uses backend-derived mastery field", () => {
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
    const db = makeDb({
      collections: [
        makeCollection({
          cards: [
            makeCard({ id: "1", mastery: "known", dueDate: future, interval: 30, repetitions: 5 }),
            makeCard({ id: "2", mastery: "learning", dueDate: future, interval: 6, repetitions: 2 }),
          ],
        }),
      ],
    });
    expect(selectKnownCards(db)).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// selectCardsToday
// ─────────────────────────────────────────────────────────────

describe("selectCardsToday", () => {
  it("returns 0 by default", () => {
    expect(selectCardsToday(makeDb())).toBe(0);
  });

  it("returns cardsToday from db", () => {
    expect(selectCardsToday(makeDb({ cardsToday: 7 }))).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────
// selectCurrentUser
// ─────────────────────────────────────────────────────────────

describe("selectCurrentUser", () => {
  it("returns null when no session", () => {
    const db = makeDb({ users: [makeUser()], session: null });
    expect(selectCurrentUser(db)).toBeNull();
  });

  it("returns the user matching the session", () => {
    const user = makeUser({ id: "u1" });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)).toEqual(user);
  });

  it("returns null when session userId matches no user", () => {
    const db = makeDb({ users: [makeUser({ id: "u1" })], session: { userId: "ghost" } });
    expect(selectCurrentUser(db)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// selectCollections / selectFolders (passthrough)
// ─────────────────────────────────────────────────────────────

describe("selectCollections", () => {
  it("returns the collections array", () => {
    const cols = [makeCollection()];
    expect(selectCollections(makeDb({ collections: cols }))).toBe(cols);
  });
});

describe("selectFolders", () => {
  it("returns the folders array", () => {
    const folders: Folder[] = [{ name: "Medicine", emoji: "🧬", count: 2 }];
    expect(selectFolders(makeDb({ folders }))).toBe(folders);
  });
});

// ─────────────────────────────────────────────────────────────
// Onboarding flag
// ─────────────────────────────────────────────────────────────

describe("onboardingCompleted", () => {
  it("selectCurrentUser returns user with onboardingCompleted = false", () => {
    const user = makeUser({ id: "u1", onboardingCompleted: false });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.onboardingCompleted).toBe(false);
  });

  it("selectCurrentUser returns user with onboardingCompleted = true", () => {
    const user = makeUser({ id: "u1", onboardingCompleted: true });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.onboardingCompleted).toBe(true);
  });

  it("onboardingCompleted does not affect selectTotalCards", () => {
    const user = makeUser({ id: "u1", onboardingCompleted: false });
    const db = makeDb({
      users: [user],
      session: { userId: "u1" },
      collections: [makeCollection({ cards: [makeCard(), makeCard()] })],
    });
    expect(selectTotalCards(db)).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────
// Avatar URL
// ─────────────────────────────────────────────────────────────

describe("avatarUrl", () => {
  it("selectCurrentUser returns user with avatarUrl set", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/fakedata";
    const user = makeUser({ id: "u1", avatarUrl: dataUrl });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.avatarUrl).toBe(dataUrl);
  });

  it("selectCurrentUser returns null avatarUrl when unset", () => {
    const user = makeUser({ id: "u1", avatarUrl: null });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.avatarUrl).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Learner types and age (onboarding fields)
// ─────────────────────────────────────────────────────────────

describe("onboarding profile fields", () => {
  it("selectCurrentUser returns learnerTypes from user", () => {
    const user = makeUser({ id: "u1", learnerTypes: ["university", "certifications"] });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.learnerTypes).toEqual(["university", "certifications"]);
  });

  it("selectCurrentUser returns empty learnerTypes by default", () => {
    const user = makeUser({ id: "u1", learnerTypes: [] });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.learnerTypes).toEqual([]);
  });

  it("selectCurrentUser returns age when set", () => {
    const user = makeUser({ id: "u1", age: 25 });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.age).toBe(25);
  });

  it("selectCurrentUser returns null age when unset", () => {
    const user = makeUser({ id: "u1", age: null });
    const db = makeDb({ users: [user], session: { userId: "u1" } });
    expect(selectCurrentUser(db)?.age).toBeNull();
  });
});

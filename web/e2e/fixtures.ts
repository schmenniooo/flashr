import { test, expect, type Page } from "@playwright/test";

export { test, expect };

export async function signInAsDemo(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => (window as any).flashrSignInAsDemo());
  await page.goto("/app");
  await page.waitForURL("**/app");
}

/** Sign in as the demo user then downgrade their plan to free in the store. */
export async function signInAsFree(page: Page) {
  await signInAsDemo(page);
  await page.evaluate(() => {
    const key = "flashr:db:v1";
    const db = JSON.parse(localStorage.getItem(key)!);
    db.users = db.users.map((u: any) =>
      u.id === "demo-user" ? { ...u, plan: "free", planExpiresAt: null } : u
    );
    localStorage.setItem(key, JSON.stringify(db));
  });
  await page.reload();
  await page.waitForURL("**/app");
}

/**
 * Set the demo user's collections to an exact list in the local store.
 * Call after signInAsDemo / signInAsFree.
 */
export async function setCollections(page: Page, names: string[]) {
  await page.evaluate((names) => {
    const key = "flashr:db:v1";
    const db = JSON.parse(localStorage.getItem(key)!);
    db.collections = names.map((name, i) => ({
      id: `e2e-col-${i}`,
      name,
      folder: "",
      emoji: "📚",
      description: "",
      isPublic: false,
      createdAt: new Date().toISOString(),
      cards: [],
      lastStudied: "never",
      progress: 0,
    }));
    db.folders = [];
    localStorage.setItem(key, JSON.stringify(db));
  }, names);
}

/**
 * Set the cards array of an existing collection by its index in the store.
 * Call after setCollections.
 */
export async function setCards(page: Page, collectionIndex: number, count: number) {
  await page.evaluate(({ collectionIndex, count }) => {
    const key = "flashr:db:v1";
    const db = JSON.parse(localStorage.getItem(key)!);
    db.collections[collectionIndex].cards = Array.from({ length: count }, (_, i) => ({
      id: `e2e-card-${i}`,
      question: `Q${i + 1}`,
      answer: `A${i + 1}`,
      aiGenerated: false,
      mastery: "new",
    }));
    localStorage.setItem(key, JSON.stringify(db));
  }, { collectionIndex, count });
}

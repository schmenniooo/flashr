import { test, expect } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

// Demo collection has cards; we use biochem-7 which has multiple cards.
const COLLECTION_ID = "biochem-7";

// A mock review response — mirrors what the backend returns.
function mockReviewResponse(cardId: string) {
  return {
    id: cardId,
    question: "Q",
    answer: "A",
    ai_generated: false,
    created_at: new Date().toISOString(),
    mastery: "learning",
    interval: 1,
    ease_factor: 2.5,
    repetitions: 1,
    due_date: new Date(Date.now() + 86_400_000).toISOString(),
  };
}

test.describe("SRS — study session", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
  });

  test("study session starts and shows a card", async ({ page }) => {
    await page.route("**/api/cards/*/review", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReviewResponse("c1")) })
    );

    await page.goto(`/app/c/${COLLECTION_ID}/study`);
    await expect(page.locator(".study__card")).toBeVisible();
    await expect(page.locator(".study__card-text").first()).not.toBeEmpty();
  });

  test("rating a card advances to the next one", async ({ page }) => {
    await page.route("**/api/cards/*/review", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReviewResponse("c1")) })
    );

    await page.goto(`/app/c/${COLLECTION_ID}/study`);

    // Reveal the answer.
    await page.locator(".study__card").click();
    await expect(page.locator(".study__card--revealed")).toBeVisible();

    // Get counter before rating.
    const counterBefore = await page.locator(".study__counter").textContent();

    // Rate as Good.
    await page.locator(".study__rate--good").click();

    // Counter should advance (allow time for the 180ms delay).
    await page.waitForTimeout(300);
    const counterAfter = await page.locator(".study__counter").textContent();
    expect(counterAfter).not.toEqual(counterBefore);
  });

  test("completing all cards shows the session complete screen", async ({ page }) => {
    await page.route("**/api/cards/*/review", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReviewResponse("c1")) })
    );

    await page.goto(`/app/c/${COLLECTION_ID}/study`);

    // Rate every card as Easy until session ends.
    for (let i = 0; i < 20; i++) {
      const done = await page.locator(".study__done").isVisible().catch(() => false);
      if (done) break;

      const revealed = await page.locator(".study__card--revealed").isVisible().catch(() => false);
      if (!revealed) {
        await page.locator(".study__card").click();
        await page.waitForTimeout(50);
      }
      await page.locator(".study__rate--easy").click();
      await page.waitForTimeout(300);
    }

    await expect(page.locator(".study__done")).toBeVisible();
    await expect(page.getByText("Session complete")).toBeVisible();
  });

  test("keyboard shortcut 1-4 rates the card", async ({ page }) => {
    await page.route("**/api/cards/*/review", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReviewResponse("c1")) })
    );

    await page.goto(`/app/c/${COLLECTION_ID}/study`);
    await page.locator(".study__card").click();
    await expect(page.locator(".study__card--revealed")).toBeVisible();

    const counterBefore = await page.locator(".study__counter").textContent();
    await page.keyboard.press("3"); // Good
    await page.waitForTimeout(300);
    const counterAfter = await page.locator(".study__counter").textContent();
    expect(counterAfter).not.toEqual(counterBefore);
  });
});

// Demo sessions are fully local (seeded into localStorage by signInAsDemo,
// never fetched from `/api/collections`), so push every card's `dueDate` in
// the target collection into the future directly in the persisted store —
// intercepting the collections API would be a no-op for the demo flow.
async function pushDueDatesToFuture(page: import("@playwright/test").Page, collectionId: string) {
  const future = new Date(Date.now() + 7 * 86_400_000).toISOString();
  await page.evaluate(
    ({ collectionId, future }) => {
      const raw = localStorage.getItem("flashr:db:v1");
      if (!raw) return;
      const db = JSON.parse(raw) as { collections: Array<{ id: string; cards: Array<Record<string, unknown>> }> };
      for (const c of db.collections) {
        if (c.id === collectionId) {
          c.cards = c.cards.map((k) => ({ ...k, dueDate: future }));
        }
      }
      localStorage.setItem("flashr:db:v1", JSON.stringify(db));
    },
    { collectionId, future }
  );
}

test.describe("SRS — all caught up screen", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
  });

  test("shows all-caught-up screen when all cards have future due dates", async ({ page }) => {
    await pushDueDatesToFuture(page, COLLECTION_ID);

    await page.goto(`/app/c/${COLLECTION_ID}/study`);
    await expect(page.getByText("All caught up")).toBeVisible();
    await expect(page.getByRole("button", { name: "Study all cards" })).toBeVisible();
  });

  test("Study all cards button starts a session with all cards", async ({ page }) => {
    await pushDueDatesToFuture(page, COLLECTION_ID);

    await page.route("**/api/cards/*/review", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(mockReviewResponse("c1")) })
    );

    await page.goto(`/app/c/${COLLECTION_ID}/study`);
    await expect(page.getByText("All caught up")).toBeVisible();

    await page.getByRole("button", { name: "Study all cards" }).click();
    await expect(page.locator(".study__card")).toBeVisible();
  });
});

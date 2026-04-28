import { test, expect, signInAsDemo } from "./fixtures";

test.describe("collections", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
  });

  test("lists seeded collections", async ({ page }) => {
    await page.goto("/app/collections");
    await expect(page.getByRole("heading", { name: /all collections/i })).toBeVisible();
    const cards = page.locator(".cols__chip, .col-card, [class*='collection']");
    await expect.poll(async () => await cards.count()).toBeGreaterThan(0);
  });

  test("creates a new collection from the modal", async ({ page }) => {
    await page.goto("/app/collections");
    const unique = `Playwright deck ${Date.now()}`;
    const newId = "e2e-col-id";

    // Mock the create endpoint — no backend runs in the preview/CI environment.
    await page.route("**/api/collections", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: newId,
          name: unique,
          folder: "",
          emoji: "📚",
          description: "",
          is_public: false,
          created_at: new Date().toISOString(),
          cards: [],
        }),
      });
    });

    await page.getByRole("button", { name: /new collection/i }).click();
    await page.getByLabel(/name/i).first().fill(unique);
    await page.getByRole("button", { name: /^create$/i }).click();

    await page.waitForURL(/\/app\/c\//);
    await expect(page.getByRole("heading", { name: unique })).toBeVisible();
  });

  test("filters collections by folder chip", async ({ page }) => {
    await page.goto("/app/collections");
    const chips = page.locator(".cols__chip");
    const chipCount = await chips.count();
    if (chipCount < 2) test.skip(true, "need at least one folder chip beyond 'All' to filter");

    await chips.nth(1).click();
    await expect(page).toHaveURL(/folder=/);
  });
});

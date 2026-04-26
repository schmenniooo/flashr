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

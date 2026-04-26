import { test, expect, signInAsDemo } from "./fixtures";

test.describe("global search", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app");
  });

  test("⌘K opens the search panel and finds a seeded match", async ({ page }) => {
    const input = page.getByPlaceholder(/search collections, cards, or folders/i);
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+k" : "Control+k");

    await input.fill("a");
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect.poll(async () => list.getByRole("option").count()).toBeGreaterThan(0);
  });

  test("Enter on a result navigates to that collection or folder", async ({ page }) => {
    const input = page.getByPlaceholder(/search collections, cards, or folders/i);
    await input.click();
    await input.fill("a");
    await expect(page.getByRole("listbox")).toBeVisible();

    await input.press("Enter");
    await expect(page).toHaveURL(/\/app\/(c\/|collections)/);
  });
});

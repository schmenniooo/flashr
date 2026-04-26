import { test, expect, signInAsDemo } from "./fixtures";

test.describe("mobile navigation", () => {
  test("sidebar opens via toggle, closes via Escape", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app");

    const toggle = page.getByRole("button", { name: /open navigation/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    const sidebar = page.locator(".shell").first();
    await expect(sidebar).toHaveClass(/shell--sidebar-open/);

    await page.keyboard.press("Escape");
    await expect(sidebar).not.toHaveClass(/shell--sidebar-open/);
  });

  test("clicking a nav link auto-closes the drawer", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app");

    await page.getByRole("button", { name: /open navigation/i }).click();
    const sidebar = page.locator(".shell").first();
    await expect(sidebar).toHaveClass(/shell--sidebar-open/);

    await page.locator('a[href="/app/collections"]').first().click();
    await expect(page).toHaveURL(/\/app\/collections/);
    await expect(sidebar).not.toHaveClass(/shell--sidebar-open/);
  });
});

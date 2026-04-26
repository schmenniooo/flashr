import { test, expect, signInAsDemo } from "./fixtures";

test.describe("folders", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
  });

  test("creates a new folder from the sidebar", async ({ page }) => {
    const unique = `PW-${Date.now()}`;
    await page.goto("/app");

    await page.getByRole("button", { name: /new folder/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/name/i).fill(unique);
    await dialog.getByRole("button", { name: /create folder/i }).click();

    await expect(page.getByRole("link", { name: new RegExp(unique) })).toBeVisible();
  });

  test("rejects duplicate folder names", async ({ page }) => {
    await page.goto("/app");
    const dupe = `Dupe-${Date.now()}`;

    await page.getByRole("button", { name: /new folder/i }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill(dupe);
    await dialog.getByRole("button", { name: /create folder/i }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: /new folder/i }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel(/name/i).fill(dupe);
    await dialog.getByRole("button", { name: /create folder/i }).click();

    await expect(dialog.getByRole("alert")).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

export { test, expect };

export async function signInAsDemo(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: /use demo account/i }).click();
  await page.waitForURL("**/app");
}

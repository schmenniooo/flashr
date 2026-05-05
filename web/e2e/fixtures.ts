import { test, expect, type Page } from "@playwright/test";

export { test, expect };

export async function signInAsDemo(page: Page) {
  await page.goto("/login");
  await page.evaluate(() => (window as Window & { flashrSignInAsDemo(): void }).flashrSignInAsDemo());
  await page.goto("/app");
  await page.waitForURL("**/app");
}

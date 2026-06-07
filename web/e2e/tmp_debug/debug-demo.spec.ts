import { test, expect } from "@playwright/test";

test("debug demo sign in 2", async ({ page }) => {
  page.on("response", (res) => {
    if (res.url().includes("/api/")) console.log("RESPONSE:", res.status(), res.url());
  });
  await page.goto("/login");
  await page.evaluate(() => (window as any).flashrSignInAsDemo());
  await page.waitForTimeout(300);
  await page.goto("/app");
  await page.waitForTimeout(2000);
  console.log("URL after goto /app:", page.url());
});

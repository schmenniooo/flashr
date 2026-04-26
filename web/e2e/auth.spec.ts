import { test, expect, signInAsDemo } from "./fixtures";

const passwordInput = (form: "signin" | "signup") => {
  const autocomplete = form === "signin" ? "current-password" : "new-password";
  return `input[autocomplete="${autocomplete}"]`;
};

test.describe("auth", () => {
  test("rejects bad credentials with an inline error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill("nope@flashr.io");
    await page.locator(passwordInput("signin")).fill("wrongpass1");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("demo sign-in lands on the dashboard", async ({ page }) => {
    await signInAsDemo(page);
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();
  });

  test("sign-up routes a new account through onboarding", async ({ page }) => {
    await page.goto("/signup");
    await page.getByRole("tab", { name: /create account/i }).click();
    await page.getByLabel(/your name/i).fill("Test User");
    await page.getByLabel(/^email$/i).fill(`new+${Date.now()}@flashr.io`);
    await page.locator(passwordInput("signup")).fill("testpass123");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();

    await page.waitForURL("**/onboarding");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("sign-out from profile returns to login", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login$/);
  });
});

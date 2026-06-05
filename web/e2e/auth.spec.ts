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
    const email = `new+${Date.now()}@flashr.io`;

    // Mock the signup endpoint — no backend runs in the preview/CI environment.
    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          token: "e2e-test-token",
          expires_at: Math.floor(Date.now() / 1000) + 86400,
          user: {
            id: "e2e-test-user-id",
            email,
            name: "Test User",
            streak: 0,
            created_at: new Date().toISOString(),
          },
        }),
      })
    );

    await page.goto("/signup");
    await page.getByRole("tab", { name: /create account/i }).click();
    await page.getByLabel(/your name/i).fill("Test User");
    await page.getByLabel(/^email$/i).fill(email);
    await page.locator(passwordInput("signup")).fill("testpass123");
    await page.getByRole("checkbox", { name: /I agree to the Terms/i }).check();
    await page.getByRole("button", { name: "Create account", exact: true }).click();

    await page.waitForURL("**/onboarding");
    await expect(page).toHaveURL(/\/onboarding$/);
  });

  test("sign-out from profile returns to login", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");
    // Click triggers immediate session clear + React unmount, so race with waitForURL.
    await Promise.all([
      page.waitForURL("**/login"),
      page.getByRole("button", { name: /^sign out$/i }).click(),
    ]);
    await expect(page).toHaveURL(/\/login$/);
  });
});

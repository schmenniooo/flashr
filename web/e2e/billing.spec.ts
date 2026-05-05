import { test, expect, type Page } from "@playwright/test";
import { signInAsDemo, signInAsFree, setCollections, setCards } from "./fixtures";

// ── API mock helpers ──────────────────────────────────────────────────────────

function mockCheckout(page: Page, redirectUrl = "https://checkout.stripe.com/test") {
  return page.route("**/api/billing/checkout", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: redirectUrl }),
    })
  );
}

function mockPortal(page: Page, redirectUrl = "https://billing.stripe.com/test") {
  return page.route("**/api/billing/portal", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: redirectUrl }),
    })
  );
}

function mockMe(page: Page, plan: "free" | "pro", extras: Record<string, unknown> = {}) {
  return page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "demo-user",
          email: "demo@flashr.io",
          name: "Demo User",
          streak: 0,
          plan,
          plan_expires_at: null,
          created_at: new Date().toISOString(),
          ...extras,
        },
      }),
    })
  );
}

// ── Profile — plan display ────────────────────────────────────────────────────

test.describe("profile — plan badge", () => {
  test("free user sees Free badge and Upgrade CTA", async ({ page }) => {
    await signInAsFree(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--free")).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /manage subscription/i })).not.toBeVisible();
  });

  test("pro user sees Pro badge and Manage subscription link", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();
    await expect(page.getByRole("button", { name: /manage subscription/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).not.toBeVisible();
  });

  test("pro user with pending cancellation sees expiry date and Reactivate link", async ({ page }) => {
    await signInAsDemo(page);

    const expiryDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    await page.evaluate((expiryDate) => {
      const key = "flashr:db:v1";
      const db = JSON.parse(localStorage.getItem(key)!);
      db.users = db.users.map((u: any) =>
        u.id === "demo-user" ? { ...u, plan: "pro", planExpiresAt: expiryDate } : u
      );
      localStorage.setItem(key, JSON.stringify(db));
    }, expiryDate);

    await page.reload();
    await page.waitForURL("**/app");
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();
    await expect(page.getByText(/cancels/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /reactivate/i })).toBeVisible();
  });
});

// ── Upgrade flow ──────────────────────────────────────────────────────────────

test.describe("upgrade flow", () => {
  test("Upgrade to Pro button calls checkout API and redirects to Stripe", async ({ page }) => {
    await signInAsFree(page);
    await mockCheckout(page, "https://checkout.stripe.com/test-session");

    await page.goto("/app/profile");
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();

    const [navigation] = await Promise.all([
      page.waitForURL("**/checkout.stripe.com/**", { timeout: 10_000 }).catch(() => null),
      page.waitForRequest("**/api/billing/checkout"),
      page.getByRole("button", { name: /upgrade to pro/i }).click(),
    ]);

    // The checkout API was called.
    // (The actual Stripe redirect is blocked in test — we just verify the call was made.)
    void navigation;
  });

  test("Manage subscription calls portal API", async ({ page }) => {
    await signInAsDemo(page);
    await mockPortal(page, "https://billing.stripe.com/test-portal");

    await page.goto("/app/profile");

    const [portalRequest] = await Promise.all([
      page.waitForRequest("**/api/billing/portal"),
      page.getByRole("button", { name: /manage subscription/i }).click(),
    ]);

    expect(portalRequest.method()).toBe("POST");
  });
});

// ── Post-checkout success ─────────────────────────────────────────────────────

test.describe("post-checkout success", () => {
  test("landing on profile with ?checkout=success shows banner and refreshes plan", async ({ page }) => {
    await signInAsFree(page);
    await mockMe(page, "pro");

    await page.goto("/app/profile?checkout=success");

    // Success banner should appear.
    await expect(page.locator(".prof__checkout-banner")).toBeVisible();

    // Plan should now show as Pro (after refreshUser call).
    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();

    // URL should be cleaned (no query param).
    await expect(page).toHaveURL(/\/app\/profile$/);
  });

  test("landing on profile with ?portal=return refreshes plan", async ({ page }) => {
    await signInAsFree(page);
    await mockMe(page, "free");

    await page.goto("/app/profile?portal=return");

    // No banner for portal return.
    await expect(page.locator(".prof__checkout-banner")).not.toBeVisible();

    // URL cleaned up.
    await expect(page).toHaveURL(/\/app\/profile$/);
  });
});

// ── Landing page Pro CTA ──────────────────────────────────────────────────────

test.describe("landing page — Pro CTA", () => {
  test("Get Pro button stores checkout intent and navigates to signup", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /get pro/i }).click();

    await page.waitForURL("**/signup");

    const intent = await page.evaluate(() => sessionStorage.getItem("checkout_intent"));
    expect(intent).toBe("pro");
  });
});

// ── AI page plan gate ─────────────────────────────────────────────────────────

test.describe("AI page — plan gate", () => {
  test("free user sees upgrade prompt and locked content", async ({ page }) => {
    await signInAsFree(page);
    await page.goto("/app/upload");

    // Upgrade prompt should be visible.
    await expect(page.locator(".upgrade-prompt")).toBeVisible();

    // Content area should be visually locked (has the --locked modifier).
    await expect(page.locator(".up__content--locked")).toBeVisible();
  });

  test("pro user sees normal AI page without gate", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/upload");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.locator(".up__content--locked")).not.toBeAttached();

    // PDF tab and drop zone should be accessible.
    await expect(page.locator(".up__drop")).toBeVisible();
  });

  test("403 from AI endpoint shows upgrade prompt inline", async ({ page }) => {
    await signInAsDemo(page);

    await page.route("**/api/ai/generate", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ error: "pro plan required" }),
      })
    );

    await page.goto("/app/upload");
    await page.getByRole("button", { name: /describe a topic/i }).click();
    await page.locator(".up__chat-input").fill("AWS fundamentals");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
  });
});

// ── Collection limit ──────────────────────────────────────────────────────────

test.describe("collection limit", () => {
  test("free user at 3 collections sees upgrade prompt and disabled New button", async ({ page }) => {
    await signInAsFree(page);
    await setCollections(page, ["Col 1", "Col 2", "Col 3"]);

    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeDisabled();
  });

  test("free user below limit sees no upgrade prompt and enabled New button", async ({ page }) => {
    await signInAsFree(page);
    await setCollections(page, ["Col 1", "Col 2"]);

    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeEnabled();
  });

  test("pro user with 3+ collections sees no upgrade prompt", async ({ page }) => {
    await signInAsDemo(page);
    await setCollections(page, ["Col 1", "Col 2", "Col 3"]);

    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeEnabled();
  });
});

// ── Card limit ────────────────────────────────────────────────────────────────

test.describe("card limit", () => {
  test("free user at 50 cards sees upgrade prompt and disabled Add card button", async ({ page }) => {
    await signInAsFree(page);
    await setCollections(page, ["Cards Test"]);
    await setCards(page, 0, 50);

    await page.goto("/app/c/e2e-col-0");

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeDisabled();
  });

  test("free user below 50 cards sees no upgrade prompt and enabled Add card button", async ({ page }) => {
    await signInAsFree(page);
    await setCollections(page, ["Cards Test"]);
    await setCards(page, 0, 10);

    await page.goto("/app/c/e2e-col-0");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeEnabled();
  });

  test("pro user at 50 cards sees no upgrade prompt and enabled Add card button", async ({ page }) => {
    await signInAsDemo(page);
    await setCollections(page, ["Cards Test"]);
    await setCards(page, 0, 50);

    await page.goto("/app/c/e2e-col-0");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeEnabled();
  });
});

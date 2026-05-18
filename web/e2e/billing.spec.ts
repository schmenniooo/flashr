import { test, expect, type Page } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

// ── Backend mock helpers ──────────────────────────────────────────────────────

type Plan = "free" | "pro";

interface BackendCollection {
  id: string;
  name: string;
  folder: string;
  emoji: string;
  description: string;
  is_public: boolean;
  created_at: string;
  cards: BackendCard[];
}

interface BackendCard {
  id: string;
  question: string;
  answer: string;
  ai_generated: boolean;
  created_at: string;
}

function makeCollection(id: string, name: string, cardCount = 0): BackendCollection {
  return {
    id,
    name,
    folder: "",
    emoji: "📚",
    description: "",
    is_public: false,
    created_at: new Date().toISOString(),
    cards: Array.from({ length: cardCount }, (_, i) => ({
      id: `card-${id}-${i}`,
      question: `Q${i + 1}`,
      answer: `A${i + 1}`,
      ai_generated: false,
      created_at: new Date().toISOString(),
    })),
  };
}

/** Mock /api/auth/me and /api/collections so bootstrap resolves immediately. */
async function mockBackend(
  page: Page,
  plan: Plan,
  collections: BackendCollection[] = [],
) {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "demo-user",
          email: "demo@flashr.io",
          name: "Demo",
          streak: 0,
          plan,
          plan_expires_at: null,
          created_at: new Date().toISOString(),
          onboarding_completed: true,
        },
      }),
    })
  );
  await page.route("**/api/collections", (route) => {
    if (route.request().method() !== "GET") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ collections }),
    });
  });
}

function mockCheckout(page: Page, url = "https://checkout.stripe.com/test") {
  return page.route("**/api/billing/checkout", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url }),
    })
  );
}

function mockPortal(page: Page, url = "https://billing.stripe.com/test") {
  return page.route("**/api/billing/portal", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url }),
    })
  );
}

// ── Profile — plan display ────────────────────────────────────────────────────

test.describe("profile — plan badge", () => {
  test("free user sees Free badge and Upgrade CTA", async ({ page }) => {
    await mockBackend(page, "free");
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--free")).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /manage subscription/i })).not.toBeVisible();
  });

  test("pro user sees Pro badge and Manage subscription link", async ({ page }) => {
    await mockBackend(page, "pro");
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();
    await expect(page.getByRole("button", { name: /manage subscription/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /upgrade to pro/i })).not.toBeVisible();
  });

  test("pro user with pending cancellation sees expiry date and Reactivate link", async ({ page }) => {
    const expiryDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "demo-user",
            email: "demo@flashr.io",
            name: "Demo",
            streak: 0,
            plan: "pro",
            plan_expires_at: expiryDate,
            created_at: new Date().toISOString(),
            onboarding_completed: true,
          },
        }),
      })
    );
    await page.route("**/api/collections", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: [] }) })
    );

    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();
    await expect(page.getByText(/cancels/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /reactivate/i })).toBeVisible();
  });
});

// ── Upgrade flow ──────────────────────────────────────────────────────────────

test.describe("upgrade flow", () => {
  test("Upgrade to Pro button calls checkout API", async ({ page }) => {
    await mockBackend(page, "free");
    await mockCheckout(page, "https://checkout.stripe.com/test-session");
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.getByRole("button", { name: /upgrade to pro/i })).toBeVisible();

    const checkoutRequest = page.waitForRequest("**/api/billing/checkout");
    await page.getByRole("button", { name: /upgrade to pro/i }).click();
    await checkoutRequest;
  });

  test("Manage subscription calls portal API", async ({ page }) => {
    await mockBackend(page, "pro");
    await mockPortal(page, "https://billing.stripe.com/test-portal");
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.getByRole("button", { name: /manage subscription/i })).toBeVisible();

    const portalRequest = page.waitForRequest("**/api/billing/portal");
    await page.getByRole("button", { name: /manage subscription/i }).click();
    await portalRequest;
  });
});

// ── Post-checkout success ─────────────────────────────────────────────────────

test.describe("post-checkout success", () => {
  test("?checkout=success shows banner and refreshes plan to Pro", async ({ page }) => {
    // First load: free user
    await mockBackend(page, "free");
    await signInAsDemo(page);

    // Re-mock /api/auth/me to return pro (simulating post-payment state)
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "demo-user",
            email: "demo@flashr.io",
            name: "Demo",
            streak: 0,
            plan: "pro",
            plan_expires_at: null,
            created_at: new Date().toISOString(),
            onboarding_completed: true,
          },
        }),
      })
    );

    await page.goto("/app/profile?checkout=success");

    await expect(page.locator(".prof__checkout-banner")).toBeVisible();
    await expect(page.locator(".prof__plan-pill--pro")).toBeVisible();
    await expect(page).toHaveURL(/\/app\/profile$/);
  });

  test("?portal=return cleans up URL", async ({ page }) => {
    await mockBackend(page, "pro");
    await signInAsDemo(page);
    await page.goto("/app/profile?portal=return");

    await expect(page.locator(".prof__checkout-banner")).not.toBeVisible();
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
    await mockBackend(page, "free");
    await signInAsDemo(page);
    await page.goto("/app/upload");

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
    await expect(page.locator(".up__content--locked")).toBeVisible();
  });

  test("pro user sees normal AI page without gate", async ({ page }) => {
    await mockBackend(page, "pro");
    await signInAsDemo(page);
    await page.goto("/app/upload");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.locator(".up__content--locked")).not.toBeAttached();
    await expect(page.locator(".up__drop")).toBeVisible();
  });
});

// ── Collection limit ──────────────────────────────────────────────────────────

test.describe("collection limit", () => {
  test("free user at 3 collections sees upgrade prompt and disabled New button", async ({ page }) => {
    const cols = [
      makeCollection("c1", "Col 1"),
      makeCollection("c2", "Col 2"),
      makeCollection("c3", "Col 3"),
    ];
    await mockBackend(page, "free", cols);
    await signInAsDemo(page);
    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeDisabled();
  });

  test("free user below limit sees no upgrade prompt and enabled New button", async ({ page }) => {
    await mockBackend(page, "free", [makeCollection("c1", "Only Col")]);
    await signInAsDemo(page);
    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeEnabled();
  });

  test("pro user with 3+ collections sees no upgrade prompt", async ({ page }) => {
    const cols = [
      makeCollection("c1", "Col 1"),
      makeCollection("c2", "Col 2"),
      makeCollection("c3", "Col 3"),
    ];
    await mockBackend(page, "pro", cols);
    await signInAsDemo(page);
    await page.goto("/app/collections");

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /new collection/i }).first()).toBeEnabled();
  });
});

// ── Card limit ────────────────────────────────────────────────────────────────

// Helper: sign in with a specific collection pre-loaded into the store.
// signInAsDemo navigates to /app which triggers bootstrap. We wait for network
// idle so bootstrap finishes writing the mocked collection to localStorage
// before the second page.goto (which does a full reload and re-reads localStorage).
async function signInAndGoToCollection(
  page: Parameters<typeof signInAsDemo>[0],
  plan: Plan,
  col: BackendCollection,
) {
  await mockBackend(page, plan, [col]);
  await signInAsDemo(page);
  await page.waitForLoadState("networkidle");
  await page.goto("/app/c/" + col.id);
}

test.describe("card limit", () => {
  test("free user at 50 cards sees upgrade prompt and disabled Add card button", async ({ page }) => {
    const col = makeCollection("col-main", "My Deck", 50);
    await signInAndGoToCollection(page, "free", col);

    await expect(page.locator(".upgrade-prompt")).toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeDisabled();
  });

  test("free user below 50 cards sees no upgrade prompt and enabled Add card button", async ({ page }) => {
    const col = makeCollection("col-main", "My Deck", 10);
    await signInAndGoToCollection(page, "free", col);

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeEnabled();
  });

  test("pro user at 50 cards sees no upgrade prompt and enabled Add card button", async ({ page }) => {
    const col = makeCollection("col-main", "My Deck", 50);
    await signInAndGoToCollection(page, "pro", col);

    await expect(page.locator(".upgrade-prompt")).not.toBeVisible();
    await expect(page.getByRole("button", { name: /add card/i })).toBeEnabled();
  });
});

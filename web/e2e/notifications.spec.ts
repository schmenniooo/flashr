import { test, expect } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

// A fake VAPID public key in base64url format (P-256 uncompressed, 65 bytes = 87 base64url chars).
const MOCK_VAPID_KEY =
  "BAN-jUhg_sa8WdXyouUx4TZHs83qeOrIoWXVEM3nlrrawKwGqwA0bkLjfQrXvdSQbNQcep-4SJn9rCIjPAHD3-4";

// Injects a mock PushManager so tests never hit a real push service.
// Must be added via page.addInitScript before navigation.
const MOCK_PUSH_MANAGER_SCRIPT = `
  (function () {
    let _sub = null;
    const mockSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/mock-test-endpoint",
      toJSON() {
        return {
          endpoint: this.endpoint,
          keys: { p256dh: "BHmock-p256dh-key", auth: "mock-auth-key" },
        };
      },
      unsubscribe: () => Promise.resolve(true),
    };
    const mockPM = {
      subscribe: () => { _sub = mockSub; return Promise.resolve(mockSub); },
      getSubscription: () => Promise.resolve(_sub),
      permissionState: () => Promise.resolve("granted"),
    };
    Object.defineProperty(ServiceWorkerRegistration.prototype, "pushManager", {
      get: () => mockPM,
      configurable: true,
    });
  })();
`;

/** Route all notification-related API calls so no backend is required. */
async function mockNotifBackend(
  page: Parameters<typeof signInAsDemo>[0],
  opts: { subscribed?: boolean } = {},
) {
  // VAPID key endpoint
  await page.route("**/api/notifications/vapid-public-key", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key: MOCK_VAPID_KEY }),
    }),
  );
  // Subscribe / unsubscribe
  await page.route("**/api/notifications/subscribe", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  // PATCH /auth/me (notification_time update)
  await page.route("**/api/auth/me", (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "demo-user",
          email: "demo@flashr.io",
          name: "Demo",
          streak: 0,
          plan: "free",
          plan_expires_at: null,
          created_at: new Date().toISOString(),
          onboarding_completed: true,
          notification_time: opts.subscribed ? "08:00" : null,
          notification_tz: opts.subscribed ? "UTC" : null,
        },
      }),
    });
  });
}

// ── Section visibility ────────────────────────────────────────────────────────

test.describe("push notifications — profile UI", () => {
  test("daily reminder section is visible on the profile page", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__toggle-label")).toHaveText(
      "Daily study reminder",
    );
    await expect(page.locator(".prof__time-input")).toBeVisible();
    await expect(page.locator(".prof__switch")).toBeVisible();
  });

  test("switch is unchecked and not disabled by default", async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");

    const switchInput = page.locator(".prof__switch input[type='checkbox']");
    await expect(switchInput).not.toBeChecked();
    // Switch should not carry the disabled modifier class initially (permission is "default")
    await expect(page.locator(".prof__switch--disabled")).not.toBeAttached();
  });

  test("shows blocked hint and disables switch when permission is denied", async ({ page }) => {
    // Override Notification.permission before the page loads so init() reads "denied"
    await page.addInitScript(() => {
      Object.defineProperty(Notification, "permission", {
        get: () => "denied" as NotificationPermission,
        configurable: true,
      });
    });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__toggle-hint")).toContainText(
      "Notifications are blocked",
    );
    await expect(page.locator(".prof__switch--disabled")).toBeAttached();
  });

  test("shows unsupported hint when push API is absent", async ({ page }) => {
    await page.addInitScript(() => {
      delete (window as Window & { PushManager?: unknown }).PushManager;
    });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    await expect(page.locator(".prof__toggle-hint")).toContainText(
      "Push notifications aren't supported in this browser.",
    );
    await expect(page.locator(".prof__switch--disabled")).toBeAttached();
  });
});

// ── Enable / disable flow ─────────────────────────────────────────────────────

test.describe("push notifications — enable / disable", () => {
  test("enabling notifications posts to subscribe endpoint and checks the switch", async ({
    page,
    context,
  }) => {
    // Grant permission before page load so Notification.permission = "granted"
    await context.grantPermissions(["notifications"]);
    await page.addInitScript(MOCK_PUSH_MANAGER_SCRIPT);
    await mockNotifBackend(page);

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const switchInput = page.locator(".prof__switch input[type='checkbox']");
    await expect(switchInput).not.toBeChecked();

    const subscribeRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/api/notifications/subscribe") &&
        r.method() === "POST",
    );

    await page.locator(".prof__switch").click();
    await subscribeRequest;

    await expect(switchInput).toBeChecked();
    await expect(page.locator(".prof__toggle-error")).not.toBeAttached();
  });

  test("disabling notifications sends DELETE to subscribe endpoint", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["notifications"]);

    // Start with a mock subscription already active
    await page.addInitScript(`
      ${MOCK_PUSH_MANAGER_SCRIPT}
      // Pre-subscribe so the initial state is subscribed=true
      (async () => {
        // We can't directly set the store, but we can pre-call subscribe on the mock.
        // The store's init() will call getSubscription() and find the mock sub.
        ServiceWorkerRegistration.prototype.pushManager.getSubscription =
          () => Promise.resolve({
            endpoint: "https://fcm.googleapis.com/fcm/send/mock-test-endpoint",
            toJSON() {
              return {
                endpoint: this.endpoint,
                keys: { p256dh: "BHmock-p256dh-key", auth: "mock-auth-key" },
              };
            },
            unsubscribe: () => Promise.resolve(true),
          });
      })();
    `);
    await mockNotifBackend(page, { subscribed: true });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const switchInput = page.locator(".prof__switch input[type='checkbox']");
    // Should be checked because init() found an existing subscription
    await expect(switchInput).toBeChecked();

    const deleteRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/api/notifications/subscribe") &&
        r.method() === "DELETE",
    );

    await page.locator(".prof__switch").click();
    await deleteRequest;

    await expect(switchInput).not.toBeChecked();
  });

  test("time input is pre-filled with notification_time from user profile", async ({
    page,
  }) => {
    await signInAsDemo(page);
    await page.goto("/app/profile");

    // Default value is 08:00 from the demo user (mock.ts)
    await expect(page.locator(".prof__time-input")).toHaveValue("08:00");
  });
});

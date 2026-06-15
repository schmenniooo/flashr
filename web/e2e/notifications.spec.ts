import { test, expect } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

// A fake VAPID public key in base64url format (P-256 uncompressed).
const MOCK_VAPID_KEY =
  "BAN-jUhg_sa8WdXyouUx4TZHs83qeOrIoWXVEM3nlrrawKwGqwA0bkLjfQrXvdSQbNQcep-4SJn9rCIjPAHD3-4";

/**
 * Replaces navigator.serviceWorker entirely so SW registration always
 * "succeeds" in headless CI — real SW support is irrelevant for these tests.
 * preSubscribed controls whether pushManager.getSubscription() finds an
 * existing subscription (used by the disable-flow test).
 */
function mockSwScript(preSubscribed = false) {
  return `
(function () {
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
    subscribe: () => Promise.resolve(mockSub),
    getSubscription: () => Promise.resolve(${preSubscribed ? "mockSub" : "null"}),
    permissionState: () => Promise.resolve("prompt"),
  };

  const mockReg = {
    scope: "/",
    pushManager: mockPM,
    installing: null,
    waiting: null,
    active: { state: "activated" },
    update: () => Promise.resolve(),
    unregister: () => Promise.resolve(true),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };

  Object.defineProperty(navigator, "serviceWorker", {
    get: () => ({
      register: () => Promise.resolve(mockReg),
      ready: Promise.resolve(mockReg),
      getRegistration: () => Promise.resolve(mockReg),
      getRegistrations: () => Promise.resolve([mockReg]),
      controller: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
    configurable: true,
  });
})();
`;
}

/** Route all notification-related API calls so no backend is required. */
async function mockNotifBackend(
  page: Parameters<typeof signInAsDemo>[0],
  opts: { subscribed?: boolean } = {},
) {
  await page.route("**/api/notifications/vapid-public-key", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key: MOCK_VAPID_KEY }),
    }),
  );
  await page.route("**/api/notifications/subscribe", (route) =>
    route.fulfill({ status: 204, body: "" }),
  );
  // Only intercept PATCH — let GET through (bootstrap uses demo localStorage).
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

/**
 * The push-notification toggle row is the one that contains the time input.
 * The Profile page has multiple .prof__toggle-row elements (weekly digest etc.),
 * so we scope every child selector through this container.
 */
function pushRow(page: Parameters<typeof signInAsDemo>[0]) {
  return page
    .locator(".prof__toggle-row")
    .filter({ has: page.locator(".prof__time-input") });
}

// ── Section visibility ────────────────────────────────────────────────────────

test.describe("push notifications — profile UI", () => {
  test("daily reminder section is visible on the profile page", async ({
    page,
  }) => {
    await page.addInitScript(mockSwScript());
    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    await expect(row.locator(".prof__toggle-label")).toHaveText(
      "Daily study reminder",
    );
    await expect(row.locator(".prof__time-input")).toBeVisible();
    await expect(row.locator(".prof__switch")).toBeVisible();
  });

  test("switch is unchecked and not disabled by default", async ({ page }) => {
    // Mock SW so init() succeeds and reads Notification.permission ("default")
    // rather than falling back to "unsupported" on a headless runner.
    await page.addInitScript(mockSwScript());
    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    await expect(
      row.locator(".prof__switch input[type='checkbox']"),
    ).not.toBeChecked();
    await expect(row.locator(".prof__switch--disabled")).not.toBeAttached();
  });

  test("shows blocked hint and disables switch when permission is denied", async ({
    page,
  }) => {
    // Mock SW first so init() doesn't short-circuit to "unsupported".
    await page.addInitScript(mockSwScript());
    await page.addInitScript(() => {
      Object.defineProperty(Notification, "permission", {
        get: () => "denied" as NotificationPermission,
        configurable: true,
      });
    });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    await expect(row.locator(".prof__toggle-hint")).toContainText(
      "Notifications are blocked",
    );
    await expect(row.locator(".prof__switch--disabled")).toBeAttached();
  });

  test("shows unsupported hint when push API is absent", async ({ page }) => {
    // Deleting PushManager causes init() to return early with "unsupported"
    // before attempting SW registration.
    await page.addInitScript(() => {
      delete (window as Window & { PushManager?: unknown }).PushManager;
    });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    await expect(row.locator(".prof__toggle-hint")).toContainText(
      "Push notifications aren't supported in this browser.",
    );
    await expect(row.locator(".prof__switch--disabled")).toBeAttached();
  });
});

// ── Enable / disable flow ─────────────────────────────────────────────────────

test.describe("push notifications — enable / disable", () => {
  test("enabling notifications posts to subscribe endpoint and checks the switch", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["notifications"]);
    await page.addInitScript(mockSwScript());
    await mockNotifBackend(page);

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    const switchInput = row.locator(".prof__switch input[type='checkbox']");
    await expect(switchInput).not.toBeChecked();

    const subscribeRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/api/notifications/subscribe") &&
        r.method() === "POST",
    );

    await row.locator(".prof__switch").click();
    await subscribeRequest;

    await expect(switchInput).toBeChecked();
    await expect(row.locator(".prof__toggle-error")).not.toBeAttached();
  });

  test("disabling notifications sends DELETE to subscribe endpoint", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["notifications"]);
    // Pre-subscribed variant: getSubscription() returns the mock sub so
    // init() sets subscribed=true and the switch starts checked.
    await page.addInitScript(mockSwScript(true));
    await mockNotifBackend(page, { subscribed: true });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    const switchInput = row.locator(".prof__switch input[type='checkbox']");
    await expect(switchInput).toBeChecked();

    const deleteRequest = page.waitForRequest(
      (r) =>
        r.url().includes("/api/notifications/subscribe") &&
        r.method() === "DELETE",
    );

    await row.locator(".prof__switch").click();
    await deleteRequest;

    await expect(switchInput).not.toBeChecked();
  });

  test("time input is pre-filled with notification_time from user profile", async ({
    page,
  }) => {
    await page.addInitScript(mockSwScript());
    await signInAsDemo(page);
    await page.goto("/app/profile");

    // Demo user has notificationTime: "08:00" (set in mock.ts)
    await expect(pushRow(page).locator(".prof__time-input")).toHaveValue(
      "08:00",
    );
  });
});

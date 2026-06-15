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

// Same as above but pre-loads an existing subscription so init() finds subscribed=true.
const MOCK_PUSH_MANAGER_SUBSCRIBED_SCRIPT = `
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
      getSubscription: () => Promise.resolve(mockSub),
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
  // Only intercept PATCH /auth/me — let GET through (bootstrap uses demo localStorage).
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

// The push-notification toggle row is the one that contains the time input.
// There are multiple .prof__toggle-row elements on the page (weekly digest, etc.),
// so we scope every selector through this container to avoid strict-mode violations.
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
    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    await expect(
      row.locator(".prof__switch input[type='checkbox']"),
    ).not.toBeChecked();
    // The push switch should not be disabled when permission is "default"
    await expect(row.locator(".prof__switch--disabled")).not.toBeAttached();
  });

  test("shows blocked hint and disables switch when permission is denied", async ({
    page,
  }) => {
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
    await page.addInitScript(MOCK_PUSH_MANAGER_SCRIPT);
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
    await page.addInitScript(MOCK_PUSH_MANAGER_SUBSCRIBED_SCRIPT);
    await mockNotifBackend(page, { subscribed: true });

    await signInAsDemo(page);
    await page.goto("/app/profile");

    const row = pushRow(page);
    const switchInput = row.locator(".prof__switch input[type='checkbox']");
    // init() finds an existing subscription → subscribed = true
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
    await signInAsDemo(page);
    await page.goto("/app/profile");

    // Demo user has notificationTime: "08:00" (set in mock.ts)
    await expect(pushRow(page).locator(".prof__time-input")).toHaveValue(
      "08:00",
    );
  });
});

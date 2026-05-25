import { test, expect } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

const MOCK_CARDS = [
  { question: "What is a goroutine?", answer: "A lightweight thread managed by the Go runtime." },
  { question: "What is a channel?", answer: "A typed conduit for passing values between goroutines." },
];

function mockUpload(page: Parameters<typeof signInAsDemo>[0], cards = MOCK_CARDS) {
  return page.route("**/api/ai/upload", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ cards }),
    })
  );
}

test.describe("File upload — PDF and Markdown", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/upload");
  });

  // ── Drop zone UI ─────────────────────────────────────────────────────────

  test("drop zone shows PDF or Markdown subtitle", async ({ page }) => {
    await expect(page.locator(".up__drop-text")).toContainText("PDF or Markdown");
  });

  test("supported formats section lists both PDF and Markdown badges", async ({ page }) => {
    const badges = page.locator(".up__formats .badge");
    await expect(badges.filter({ hasText: "PDF" })).toBeVisible();
    await expect(badges.filter({ hasText: "Markdown" })).toBeVisible();
  });

  // ── MD upload ────────────────────────────────────────────────────────────

  test("uploading a .md file proceeds to the review step", async ({ page }) => {
    await mockUpload(page);

    await page.locator(".up__file-input").setInputFiles({
      name: "go-notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Go Notes\n\nA goroutine is a lightweight thread.\n"),
    });

    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);
    await expect(page.locator(".up__save-bar")).toBeVisible();
  });

  test("collection name is derived from the .md filename (no extension)", async ({ page }) => {
    await mockUpload(page);

    await page.locator(".up__file-input").setInputFiles({
      name: "go-notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Go Notes\n\nSome content.\n"),
    });

    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);
    // The new-collection option in the select should carry the derived name.
    const select = page.locator(".up__save-bar .up__select");
    await expect(select).toContainText("go notes");
  });

  test("save bar shows the correct kept count after MD upload", async ({ page }) => {
    await mockUpload(page);

    await page.locator(".up__file-input").setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n\nContent here.\n"),
    });

    await expect(page.locator(".up__save-summary strong")).toHaveText(String(MOCK_CARDS.length));
  });

  // ── Unsupported types ────────────────────────────────────────────────────

  test("uploading a .txt file shows an error banner", async ({ page }) => {
    await page.locator(".up__file-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("plain text content"),
    });

    await expect(page.locator(".up__error")).toBeVisible();
    await expect(page.locator(".up__error")).toContainText(/only pdf/i);
  });

  // ── API error path ───────────────────────────────────────────────────────

  test("API error during MD upload shows an error banner and stays on drop step", async ({ page }) => {
    await page.route("**/api/ai/upload", (route) =>
      route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({ error: "no text found in file" }),
      })
    );

    await page.locator(".up__file-input").setInputFiles({
      name: "empty.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("   "),
    });

    await expect(page.locator(".up__error")).toBeVisible();
    await expect(page.locator(".up__drop")).toBeVisible();
  });

  // ── Back navigation ──────────────────────────────────────────────────────

  test("Back button from review step returns to the drop zone", async ({ page }) => {
    await mockUpload(page);

    await page.locator(".up__file-input").setInputFiles({
      name: "notes.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Notes\n\nSome content.\n"),
    });

    await expect(page.locator(".up__save-bar")).toBeVisible();
    await page.getByRole("button", { name: /back/i }).click();
    await expect(page.locator(".up__drop")).toBeVisible();
  });
});

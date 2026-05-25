import { test, expect, type Page } from "@playwright/test";
import { signInAsDemo } from "./fixtures";

const MOCK_CARDS = [
  { question: "What is React?", answer: "A JavaScript library for building user interfaces." },
  { question: "What is JSX?", answer: "A syntax extension for JavaScript that resembles HTML." },
  { question: "What is a component?", answer: "A reusable piece of UI that accepts props and returns JSX." },
];

function sseBody(cards: typeof MOCK_CARDS): string {
  return (
    cards.map((c) => `event: card\ndata: ${JSON.stringify(c)}\n\n`).join("") +
    "event: done\ndata: {}\n\n"
  );
}

function mockGenerateStream(page: Page, cards = MOCK_CARDS) {
  return page.route("**/api/ai/generate/stream", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody(cards),
    })
  );
}

test.describe("AI chat — generate cards from topic", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDemo(page);
    await page.goto("/app/upload");
  });

  // ── Tabs ────────────────────────────────────────────────────────────────

  test("upload tab is active by default and shows the drop zone", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Upload file", exact: true })).toHaveClass(/up__tab--active/);
    await expect(page.locator(".up__drop")).toBeVisible();
  });

  test("switching to the chat tab shows the empty state", async ({ page }) => {
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await expect(page.getByRole("heading", { name: /what do you want to study/i })).toBeVisible();
    await expect(page.locator(".up__composer")).toBeVisible();
    await expect(page.locator(".up__drop")).not.toBeAttached();
  });

  test("switching back to the upload tab restores the drop zone", async ({ page }) => {
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.getByRole("button", { name: "Upload file", exact: true }).click();
    await expect(page.locator(".up__drop")).toBeVisible();
    await expect(page.locator(".up__chat")).not.toBeAttached();
  });

  // ── Composer ────────────────────────────────────────────────────────────

  test("generate button is disabled when the prompt is empty", async ({ page }) => {
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await expect(page.getByRole("button", { name: /generate cards/i })).toBeDisabled();
  });

  test("clicking an example chip populates the textarea and enables the button", async ({ page }) => {
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.getByRole("button", { name: /Macroeconomics/i }).click();
    await expect(page.locator(".up__chat-input")).toHaveValue(/Macroeconomics/);
    await expect(page.getByRole("button", { name: /generate cards/i })).toBeEnabled();
  });

  test("count pill selection updates active state", async ({ page }) => {
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.getByRole("button", { name: "15" }).click();
    await expect(page.getByRole("button", { name: "15" })).toHaveClass(/up__pill--active/);
    await expect(page.getByRole("button", { name: "10" })).not.toHaveClass(/up__pill--active/);
  });

  // ── Generation ──────────────────────────────────────────────────────────

  test("generates cards and renders the review list", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);
    await expect(page.locator(".up__save-bar")).toBeVisible();
  });

  test("save bar shows the correct initial kept count", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await expect(page.locator(".up__save-summary strong")).toHaveText(String(MOCK_CARDS.length));
  });

  test("composer stays visible after generation and button becomes Regenerate", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await expect(page.locator(".up__composer")).toBeVisible();
    await expect(page.getByRole("button", { name: /regenerate/i })).toBeVisible();
  });

  test("shows an error banner when the API returns an error", async ({ page }) => {
    await page.route("**/api/ai/generate/stream", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI generation failed" }),
      })
    );

    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await expect(page.locator(".up__error")).toBeVisible();
    await expect(page.locator(".up__draft")).toHaveCount(0);
  });

  // ── Regenerate ──────────────────────────────────────────────────────────

  test("regenerating replaces the card list with new results", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();
    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);

    await page.route("**/api/ai/generate/stream", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody(MOCK_CARDS.slice(0, 2)),
      })
    );

    await page.locator(".up__chat-input").fill("Different topic now");
    await page.getByRole("button", { name: /regenerate/i }).click();
    await expect(page.locator(".up__draft")).toHaveCount(2);
  });

  test("cards are cleared when regeneration starts", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();
    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);

    // Block the second request so we can observe the cleared state mid-flight.
    await page.route("**/api/ai/generate/stream", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "fail" }) });
    });
    await page.getByRole("button", { name: /regenerate/i }).click();

    // Cards are cleared immediately when regeneration begins.
    await expect(page.locator(".up__draft")).toHaveCount(0);
  });

  // ── Discard ─────────────────────────────────────────────────────────────

  test("Discard button resets to the empty state", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();
    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);

    await page.getByRole("button", { name: /discard/i }).click();

    await expect(page.getByRole("heading", { name: /what do you want to study/i })).toBeVisible();
    await expect(page.locator(".up__draft")).toHaveCount(0);
  });

  // ── Card interactions ────────────────────────────────────────────────────

  test("skipping a card decrements the save bar count", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await page.locator(".up__draft").first().locator(".up__draft-icon--danger").click();
    await expect(page.locator(".up__save-summary strong")).toHaveText(String(MOCK_CARDS.length - 1));
  });

  test("save button is disabled when all cards are skipped", async ({ page }) => {
    await mockGenerateStream(page, [MOCK_CARDS[0]]);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    await page.locator(".up__draft").first().locator(".up__draft-icon--danger").click();
    await expect(page.locator(".up__save-bar").getByRole("button", { name: /save to collection/i })).toBeDisabled();
  });

  test("pencil opens inline edit mode, Done closes it", async ({ page }) => {
    await mockGenerateStream(page);
    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();

    const firstCard = page.locator(".up__draft").first();
    await firstCard.locator(".up__draft-icon").first().click();
    await expect(firstCard.locator(".up__draft-textarea").first()).toBeVisible();

    await firstCard.getByRole("button", { name: /done/i }).click();
    await expect(firstCard.locator(".up__draft-textarea").first()).not.toBeVisible();
  });

  // ── Save ────────────────────────────────────────────────────────────────

  test("saving cards to a new collection navigates to the collection", async ({ page }) => {
    await mockGenerateStream(page);

    const collectionId = "e2e-chat-col";
    await page.route("**/api/collections", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: collectionId,
          name: "React hooks for beginners",
          folder: "Uncategorized",
          emoji: "✨",
          description: "",
          is_public: false,
          created_at: new Date().toISOString(),
          cards: [],
        }),
      });
    });
    await page.route(`**/api/collections/${collectionId}/cards`, (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "card-id", question: "Q", answer: "A", ai_generated: true }),
      })
    );

    await page.getByRole("button", { name: "Describe a topic" }).click();
    await page.locator(".up__chat-input").fill("React hooks for beginners");
    await page.getByRole("button", { name: /generate cards/i }).click();
    await expect(page.locator(".up__draft")).toHaveCount(MOCK_CARDS.length);

    await page.locator(".up__save-bar .up__select").selectOption("__new");
    await page.locator(".up__save-bar").getByRole("button", { name: /save to collection/i }).click();

    await page.waitForURL(`**/app/c/${collectionId}`);
  });
});

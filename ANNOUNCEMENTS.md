# flashr — Announcements

User-facing changelog. Each entry represents a release visible to users.  
**Format:** add a new object to the top of the list when shipping a feature, fix, or notable change.

---

## Releases

```yaml
- version: 1.6.2
  date: 2026-05-29
  title: No more silent limits — raised text limits and visible warnings
  description: >
    flashr no longer caps Anki imports at 100 cards — your entire deck
    is imported, no matter how large. The file size limit has also been
    raised from 20 MB to 500 MB across all formats. For PDF, Markdown,
    and Word uploads, the amount of text sent to AI has been raised from
    4 KB to 20 KB, and if a file is still too large to process in full
    you'll see a clear warning instead of silent truncation. The AI topic
    field now shows a character counter when you're approaching the 2 000
    character limit. The processing screen shows an accurate time estimate.

- version: 1.6.1
  date: 2026-05-27
  title: Fix Anki import for decks exported from Anki 2.1.50+
  description: >
    Anki packages created with Anki 2.1.50 or newer use a compressed
    database format (collection.anki21b). flashr now recognises and
    decompresses this format automatically, so decks that previously
    showed "no cards found" will import correctly.

- version: 1.6.0
  date: 2026-05-25
  title: Upload more file types — Markdown, Word, and Anki decks
  description: >
    You can now upload three new file formats in addition to PDFs.
    Markdown (.md) files are processed directly and turned into cards.
    Word documents (.docx) have their text extracted and sent through
    the same AI card generation pipeline as PDFs.
    Anki packages (.apkg) are imported natively — flashr reads the
    cards straight from the deck without involving AI, so you get your
    existing flashcards instantly and accurately.
    All three formats are available from the same upload page.

- version: 1.5.0
  date: 2026-05-23
  title: Smarter AI generation — streaming cards, no duplicates, and a full reset flow
  description: >
    A batch of improvements to the AI card generation experience.
    Cards now appear one by one as the AI generates them, so you see
    results immediately instead of waiting for the full batch.
    A Cancel button lets you stop mid-generation at any time.
    When adding cards to an existing collection, flashr passes your
    current deck to the AI so it won't produce duplicates or near-duplicates —
    every new card genuinely extends your knowledge.
    Suggestion decks on the dashboard now include real starter cards when
    you add them.
    You can also fully discard a generation in progress and start fresh
    from the same page, with no leftover state.

- version: 1.4.1
  date: 2026-05-18
  title: Profile picture syncs across devices
  description: >
    Your avatar is now stored in your account rather than the browser, so it
    shows up on every device you sign into. Photos are resized to 400 px before
    upload to keep things snappy.

- version: 1.4.0
  date: 2026-05-18
  title: Onboarding now syncs across devices
  description: >
    Completing the welcome flow on one device now carries over to all your
    other devices. Your name, age, and learner type are saved to your account
    instead of just the browser, so you'll never be asked to set them up twice.

- version: 1.3.3
  date: 2026-05-18
  title: Fixed AI card generation failing
  description: >
    Card generation via topic or PDF upload was returning an error for all users.
    The root cause was inputs that pushed Ollama's context window past its limit,
    causing the model runner to crash after 60–90 seconds. Input lengths are now
    capped (PDF text: 4 KB, topic: 500 chars) and the context window is explicitly
    set to 2048 tokens so the model always has headroom to respond.

- version: 1.3.2
  date: 2026-05-17
  title: Study completion screen shows your name
  description: >
    The "session complete" screen after finishing a collection now correctly
    shows your own first name instead of a hardcoded placeholder.

- version: 1.3.1
  date: 2026-05-16
  title: Promo codes at checkout
  description: >
    You can now enter a promo code directly on the upgrade checkout page
    to redeem discounts or special offers.

- version: 1.3.0
  date: 2026-05-14
  title: Smarter AI cards based on your learning focus
  description: >
    The AI card generator now uses the learning focus you set during onboarding
    (e.g. university, certifications, professional) to tailor the examples and
    framing of generated cards — not just suggestions.

- version: 1.1.0
  date: 2026-05-14
  title: 7-day Pro trial
  description: >
    New users can now opt into a 7-day free Pro trial directly on the sign-up
    page. Enter your payment details and get full Pro access immediately — no
    charge until the trial ends. Cancel any time before day 7 and you won't
    be billed.

- version: 1.0.0
  date: 2026-05-10
  title: MVP
  description: >
    flashr is here. Create flashcards and organize them into collections and folders,
    generate cards instantly from any topic via AI Chat, sign in with Google OAuth,
    subscribe to Pro with Stripe, and study your cards with the built-in review mode.
```


# flashr — Brand Guidelines

> Version 1.0 · Midnight Focus Theme · flashr.io

---

## 1. Brand Identity

**Product Name:** flashr  
**Domain:** flashr.io  
**Tagline:** _"Mach deine Notizen wie immer — wir bauen automatisch die Karteikarten daraus."_  
**Category:** AI-powered Flashcard SaaS  
**Positioning:** Premium Anki-Alternative mit nativer KI-Integration und Cloud Sync

---

## 2. Logo & Wordmark

### Schreibweise

- Immer lowercase: `flashr` — niemals `Flashr`, `FLASHR` oder `Flash r`
- Im Fließtext: **flashr** (bold empfohlen beim ersten Auftreten)

### Wordmark-Aufbau

```
flash  →  Farbe: #F0F2FF (Text Primary)
r      →  Farbe: #6C63FF (Accent Violet) + Glow-Effekt
```

### Logo-Varianten

|Variante|Verwendung|
|---|---|
|Icon + Wordmark horizontal|Standard — Navbar, Header|
|Icon allein|App Icon, Favicon, Avatar|
|Wordmark allein|Textbasierte Kontexte, Emails|
|Light Variant|Helle Hintergründe|

### Icon-Beschreibung

- Zwei gestapelte Karten (Card Stack) symbolisieren Flashcards
- Violett-Akzent-Kreis mit Checkmark = AI-Bestätigung
- Rounded Rectangle, Radius `rx="13"` bei 48×48px
- Glow-Effekt: `drop-shadow(0 0 9.6px rgba(108, 99, 255, 0.3))`

### App Icon Varianten

|Stil|Hintergrund|Verwendung|
|---|---|---|
|Dark|`linear-gradient(135deg, #1E1A4A, #0D0F14)`|iOS / Android dark|
|Gradient|`linear-gradient(135deg, #6C63FF, #3D35CC)`|Marketing, Stores|
|Favicon|`#6C63FF` solid, "f" in `#0D0F14`|Browser Tab|
|Outline|Transparent + `2px border #6C63FF`|Monochrome contexts|

---

## 3. Farbpalette

### Primäre Farben

|Name|Hex|CSS Variable|Verwendung|
|---|---|---|---|
|Midnight|`#0D0F14`|`--color-bg`|Page Background|
|Surface|`#161923`|`--color-surface`|Cards, Panels, Sidebars|
|Card|`#1E2332`|`--color-card`|Nested Cards, Inputs|
|Violet|`#6C63FF`|`--color-accent`|Primary CTA, Links, Highlights|
|Lavender|`#8B85FF`|`--color-accent-light`|Hover States, Secondary Accents|
|Soft Violet|`#A09BFF`|`--color-accent-soft`|Disabled States, Subtle Accents|
|Snow|`#F0F2FF`|`--color-text`|Primary Text|
|Muted|`#8890A4`|`--color-muted`|Secondary Text, Placeholders|
|Border|`#2A2F45`|`--color-border`|Dividers, Input Borders|

### Glow / Shadow Tokens

```css
--glow-accent: rgba(108, 99, 255, 0.3);
--glow-accent-soft: rgba(108, 99, 255, 0.15);
--shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
--shadow-button: 0 4px 16px rgba(108, 99, 255, 0.35);
```

### CSS Custom Properties (vollständig)

```css
:root {
  --color-bg:           #0D0F14;
  --color-surface:      #161923;
  --color-card:         #1E2332;
  --color-accent:       #6C63FF;
  --color-accent-light: #8B85FF;
  --color-accent-soft:  #A09BFF;
  --color-accent-glow:  rgba(108, 99, 255, 0.3);
  --color-text:         #F0F2FF;
  --color-muted:        #8890A4;
  --color-border:       #2A2F45;

  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   24px;

  --shadow-card:   0 4px 24px rgba(0, 0, 0, 0.4);
  --shadow-button: 0 4px 16px rgba(108, 99, 255, 0.35);
  --shadow-glow:   0 0 30px rgba(108, 99, 255, 0.2);
}
```

### Light Theme Override (für spätere Theme-Funktion)

```css
[data-theme="light"] {
  --color-bg:      #F0F2FF;
  --color-surface: #FFFFFF;
  --color-card:    #F7F8FF;
  --color-text:    #1A1A2E;
  --color-muted:   #6870A0;
  --color-border:  #DDE0F0;
  /* accent bleibt identisch */
}
```

---

## 4. Typografie

### Font Stack

|Rolle|Font|Weight|Verwendung|
|---|---|---|---|
|Display / Headings|DM Sans|700|Headlines, Hero Text, Logo|
|Body|DM Sans|400|Fließtext, Beschreibungen|
|UI Labels|DM Sans|600|Buttons, Nav, Tags|
|Monospace|System Mono|400–500|Code, HEX-Werte, Meta-Labels|

### Google Fonts Import

```html
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&display=swap" rel="stylesheet" />
```

### Typografie-Skala

```css
/* Display */
.text-display {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -1.5px;
  line-height: 1.1;
  color: var(--color-text);
}

/* Heading 1 */
.text-h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.2;
}

/* Heading 2 */
.text-h2 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.5px;
  line-height: 1.3;
}

/* Body */
.text-body {
  font-size: 14px;
  font-weight: 400;
  line-height: 1.7;
  color: var(--color-muted);
}

/* Small / Meta */
.text-meta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-family: monospace;
  color: var(--color-muted);
}
```

---

## 5. Komponenten-Stil

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-bg);
  font-weight: 700;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  border: none;
  box-shadow: var(--shadow-button);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary / Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  font-weight: 600;
  font-size: 14px;
  padding: 10px 20px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.btn-ghost:hover {
  border-color: var(--color-accent);
  background: rgba(108, 99, 255, 0.06);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-card);
}

/* Flashcard spezifisch */
.flashcard {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 28px 24px;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
```

### Inputs

```css
.input {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 14px;
  padding: 10px 14px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.15);
}
::placeholder {
  color: var(--color-muted);
}
```

### Tags / Badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  background: rgba(108, 99, 255, 0.12);
  color: var(--color-accent-light);
  border: 1px solid rgba(108, 99, 255, 0.2);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  font-family: monospace;
  letter-spacing: 0.03em;
}
```

---

## 6. Spacing & Layout

```css
/* Spacing Scale (8px base) */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  24px;
--space-6:  32px;
--space-7:  48px;
--space-8:  64px;
--space-9:  96px;

/* Max Widths */
--max-content: 900px;
--max-wide:    1200px;
--max-narrow:  640px;
```

---

## 7. Iconography

- **Icon Set:** Lucide Icons (empfohlen: `lucide-react`)
- **Stroke Width:** `1.5px` Standard, `2px` für Emphasis
- **Größen:** 14px (inline), 16px (UI), 20px (Feature), 24px (Hero)
- **Farbe:** `var(--color-muted)` Standard · `var(--color-accent)` bei aktiven States

---

## 8. Animation & Motion

```css
/* Standard Transitions */
--transition-fast:   0.1s ease;
--transition-base:   0.2s ease;
--transition-slow:   0.35s ease;

/* Hover Lift */
.hover-lift {
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 32px rgba(108, 99, 255, 0.25);
}

/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in {
  animation: fadeIn 0.3s ease forwards;
}
```

---

## 9. Do's & Don'ts

### ✅ Do

- Immer `flashr` lowercase schreiben
- Violett (`#6C63FF`) als einzige CTA-Farbe verwenden
- Glow-Effekte sparsam einsetzen — nur auf dem Accent
- DM Sans als primäre Schrift nutzen
- Dark Background als Standard — Light als opt-in Theme

### ❌ Don't

- Keine anderen Akzentfarben neben Violett einführen (außer System-Status: rot/grün)
- Keinen weißen Hintergrund als Standard verwenden
- Logo nicht verzerren, rotieren oder einfärben
- Nicht mehr als 2 Schriftgewichte pro Seite mischen
- Keine Text-Shadows auf Fließtext

---

## 10. Voice & Tone

|Kontext|Ton|Beispiel|
|---|---|---|
|Marketing|Direkt, selbstbewusst|_"Deine Notizen. Automatisch Karteikarten."_|
|Onboarding|Freundlich, knapp|_"PDF hochladen, fertig."_|
|Fehlermeldungen|Ehrlich, lösungsorientiert|_"Upload fehlgeschlagen — versuch's nochmal."_|
|Empty States|Motivierend|_"Noch keine Karten. Lad eine Notiz hoch."_|

**Sprache:** Deutsch als Default, Englisch für technische Labels & Metadaten  
**Ansprache:** `du` (kein `Sie`)

---

_flashr Brand Guidelines v1.0 — SmithLabs_
---
name: Tickle the Pig
description: A cozy paper-craft storybook aesthetic — ink-outlined stickers, hard drop-shadows, and warm cream paper.
colors:
  ink: "#2a1f15"
  paper: "#fffaf0"
  cream: "#fbeee2"
  cream2: "#f6e6d4"
  rose: "#ffd6dc"
  rose-deep: "#f8a8b3"
  sky: "#c8e3f0"
  sage: "#c9dec1"
  sun: "#ffd87a"
  lilac: "#d6c8f0"
  lilac-deep: "#a89bff"
  peach: "#ffc8a8"
  accent: "#c25a3f"
  bark: "#3a2c1e"
  bark-text: "#fff3e2"
  angel: "#a89bff"
  goblin: "#d4a437"
  success: "#5bc97d"
typography:
  display:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "32px"
    lineHeight: "34px"
  pageTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "26px"
    lineHeight: "28px"
  sectionTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "22px"
    lineHeight: "24px"
    letterSpacing: "0.2px"
  cardTitle:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "18px"
    lineHeight: "22px"
    letterSpacing: "0.2px"
  numeral:
    fontFamily: "Caprasimo_400Regular"
    fontSize: "16px"
  body:
    fontFamily: "Nunito_700Bold"
    fontSize: "15px"
    lineHeight: "21px"
  bodySm:
    fontFamily: "Nunito_700Bold"
    fontSize: "13px"
    lineHeight: "18px"
  label:
    fontFamily: "Nunito_800ExtraBold"
    fontSize: "12px"
    letterSpacing: "0.3px"
  kicker:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "13px"
    letterSpacing: "0.4px"
  hand:
    fontFamily: "PatrickHand_400Regular"
    fontSize: "14px"
    lineHeight: "20px"
  kickerPill:
    fontFamily: "Nunito_800ExtraBold"
    fontSize: "11px"
    letterSpacing: "1.6px"
rounded:
  sm: "8px"
  md: "12px"
  lg: "14px"
  xl: "18px"
  xxl: "22px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  page: "18px"
components:
  sticker:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
  button-primary:
    textColor: "{colors.ink}"
    rounded: "{rounded.xxl}"
    padding: "0 18px"
    height: "44px"
  button-purple:
    backgroundColor: "{colors.lilac-deep}"
    textColor: "{colors.paper}"
    rounded: "{rounded.xxl}"
    height: "44px"
  button-locked:
    backgroundColor: "#f4efe7"
    textColor: "#9a9a9a"
    rounded: "{rounded.xxl}"
    height: "44px"
  kicker-pill:
    textColor: "{colors.accent}"
    typography: "{typography.kicker}"
---

# Design System: Tickle the Pig

## 1. Overview

**Creative North Star: "The Paper-Craft Scrapbook"**

Tickle the Pig looks like a storybook someone who cares assembled by hand: ink-outlined stickers pinned with tape onto warm cream paper, each card tilted a degree or two off-square, throwing a hard offset shadow as if lit by a single desk lamp. It is a deliberately maximalist, cozy, paper-craft aesthetic. The whimsy *is* the design — not decoration bolted onto a neutral shell. Every surface is a `Sticker`: a 2px ink border, a hand-drawn tilt (±0.5–1.5°), a hard-edged drop shadow with zero blur.

This system explicitly rejects the SaaS-dashboard playbook. The usual "eliminate AI slop" advice — kill the cards, flatten the gradients, calm the motion, default to system fonts — is *wrong* here. A perfectly-aligned, borderless, soft-shadow card is what reads as slop in this app. Slop here is **governance erosion**: the intentional tokens in `constants/theme.ts` silently bypassed by an inline hex, a raw font size, a reinvented radius. The craft standard is enforcing the taste that already exists, not imposing a new look.

The system shows feelings rather than stating them. A pig's mood is its sprite; a streak is a garden that grows; there is no meter, number, or label for anything emotional. The heart counter is the only number that earns its place. And the world responds *now* — a cleansed curse vanishes on tap, a claim animates, a find names itself the instant it surfaces.

**Key Characteristics:**
- Ink-outlined paper stickers on warm cream, every card tilted and hard-shadowed
- One palette (WHIMSY): muted storybook pastels, rust accent, dark "bark" for storyteller callouts
- Four fonts, each with a job: Caprasimo (whimsy titles), Nunito (body), Fredoka (display), PatrickHand (hand-drawn kickers)
- Two hard shadow tiers, zero blur — no soft ambient shadows in sticker contexts
- Springy, hand-wound motion; feelings shown as sprites and growth, never numbers
- No emoji, ever — hand-drawn `Glyph` art or SVG `Icon` only

## 2. Colors

A muted storybook palette of pastels on warm paper/cream, with a single rust accent for kickers and one sanctioned dark "bark" surface for the storyteller voice. All colors are tokens in `WHIMSY` (`constants/theme.ts`) — a new color is a token, never a fresh hex.

### Primary
- **Warm Cream Paper** (`#fffaf0` paper / `#fbeee2` cream / `#f6e6d4` cream2): The base surface everywhere. Every screen and sticker sits on this warm cream continuity — a black wrapper anywhere breaks it.
- **Rust Accent** (`#c25a3f`): The one accent. Used on kickers — the small hand-drawn line above a section title ("★ welcome", "★ friends"). Its scarcity is the point; it is never a fill.

### Secondary
- **Storybook Pastels** (rose `#ffd6dc`, rose-deep `#f8a8b3`, sky `#c8e3f0`, sage `#c9dec1`, sun `#ffd87a`, lilac `#d6c8f0`, peach `#ffc8a8`): Sticker fills. Each `Sticker` picks one; they rotate to give the scrapbook its varied, hand-placed feel. `sun` also tints the `Tape` strips that pin stickers.

### Tertiary
- **Bark** (`#3a2c1e` panel / `#fff3e2` text / `#e8d9c6` muted body): The single sanctioned dark surface — the ink-dark "storyteller" callouts that carry the Great Hunger fiction ("why we scuffle", "vs the Great Hunger"). Kickers on bark use `sun`, not rust.
- **Alignment Tints** (angel `#a89bff` / goblin `#d4a437`): The Goblins-vs-Angels alignment axis. Reserved for alignment surfaces only.

### Neutral
- **Ink** (`#2a1f15`): Every sticker border, every hard shadow, most body text. The single ink that draws the whole scrapbook. A companion `COLORS` set carries ink text ramps (`ink`/`ink2`/`ink3`/`ink4`) and paper tints for the shop/list chrome.

### Named Rules
**The One Palette Rule.** All color comes from `WHIMSY`. If a value isn't a token, either use an existing token or add one — never inline a raw hex past the token layer. There are ~125 leaked literals in the codebase; they are debt, not license.

**The One Accent Rule.** Rust (`#c25a3f`) is a kicker color, never a fill. It appears above a title as a hand-drawn line; the moment it becomes a button or a card background, it stops being the accent.

## 3. Typography

**Display Font:** Caprasimo (whimsy titles & numbers)
**Body Font:** Nunito (Bold / ExtraBold / Black weights for reading text and labels)
**Secondary Display:** Fredoka (700 Bold / 600 SemiBold)
**Label/Hand Font:** PatrickHand (hand-drawn kickers and cozy accents)

**Character:** Four intentional fonts, each with a job. Caprasimo's round whimsy carries titles and the numbers that earn their place; Nunito's warm bold does the reading; PatrickHand adds the hand-drawn kicker that makes a header feel scrapbook-made. Never reach for a system font.

### Hierarchy
- **Display** (Caprasimo, 32px, 34px line): The largest headline moments.
- **Page Title** (Caprasimo, 26px, 28px line): Top-of-screen page headers (`PageHeader`).
- **Section Title** (Caprasimo, 22px, 24px line, 0.2px tracking): In-screen section headers (`SectionHeader`).
- **Card Title** (Caprasimo, 18px, 22px line, 0.2px tracking): Titles inside cards.
- **Numeral** (Caprasimo, 16px): Progression numbers (XP, tiers, prices) — never emotional readouts.
- **Body** (Nunito Bold, 15px, 21px line): Primary reading text.
- **Body Small** (Nunito Bold, 13px, 18px line): Secondary reading text.
- **Label** (Nunito ExtraBold, 12px, 0.3px tracking): Compact tracked labels.
- **Kicker** (PatrickHand, 13px, 0.4px tracking): The rust hand-drawn line above a title (`KICKER_TEXT`).
- **Kicker Pill** (Nunito ExtraBold, 11px, 1.6px tracking, uppercase): The heavier tracked-caps band above a header (`KICKER_PILL`).

### Named Rules
**The Compose-From-Roles Rule.** Text is built from `TYPE` role styles, not raw sizes. Color is intentionally *not* baked into a role — compose `{ ...TYPE.body, color: WHIMSY.ink }` so one role serves ink / mute / accent. A bare `fontSize: 15` in new code is a smell (634 such sites exist as debt; migrate under "leave it better").

**The Feelings-Aren't-Numbers Rule.** Numbers are allowed for progression only — XP, tiers, prices. Anything emotional is shown, never numbered: mood is a sprite, a streak is a garden. The heart counter is the only emotional number that earns its place.

## 4. Elevation

Depth is drawn, not blurred. Every sticker throws a hard-edged offset shadow with **zero blur radius** — as if a paper cutout were lit by a single lamp. Soft ambient shadows are retired from sticker contexts entirely. There are exactly two shadow tiers and no new tiers may be added.

### Shadow Vocabulary
- **Sticker Shadow** (`shadowColor: ink, offset: 4,4, radius: 0, opacity: 1, elevation: 4`): The primary tier — cards, panels, modals. The signature "paper cutout" lift.
- **Small Shadow** (`shadowColor: ink, offset: 2,2, radius: 0, opacity: 1, elevation: 2`): The lighter companion — interactive chips, buttons, list rows.

### Named Rules
**The Two-Tiers-No-Blur Rule.** Sticker contexts use only `STICKER_SHADOW` (4,4) or `SHADOW_SM` (2,2), both zero-blur, ink-colored, full-opacity. A soft blurred `SHADOW`-style shadow in a sticker context is a taste failure — if the shadow has a blur radius, it belongs to a different app.

## 5. Components

### Centered Dialogs
- **Shell:** Use `AdaptiveModalScaffold` for centered, dismissible tasks so the frame respects safe areas, compact heights, and accessibility-sized content.
- **Dismiss action:** A corner X uses `DialogCloseRow`. It stays in normal layout flow with a 44pt target; never absolutely position an X over a dialog heading.
- **Content:** Dialog artwork and ceremony layouts may keep their own composition, but safe-area sizing, scrolling, and dismiss placement come from the shared primitives.

### Buttons
- **Shape:** Full pills (radius scales with size: 16/22/27px for sm/md/lg — always ≥ half the height).
- **Primary:** Colorful gradient fills (rose `#F0B8C8→#E8A7B9`, purple `#9078FF→#7B5FFF`, gold `#F8D068→#F5C44A`) wrapped in the signature 2px ink outline + `SHADOW_SM`, so they read as hand-drawn buttons, not flat gradient pills. Ink or contrasting text per variant.
- **Locked ("asleep"):** Full chrome — 2px ink outline, muted paper fill (`#F4EFE7`), muted ink text (`#9A9A9A`) — and **no opacity crush**. A disabled control keeps its shape: you mute the fill, you never dissolve the outline.
- **Ghost / Dark / Success:** Flat fills with their own border treatment; dark is the near-black `#1A1A1A`, success rides the green `successBg`/`successText` pair.

### Cards / Containers
- **Signature primitive:** `Sticker` — the base of nearly every surface.
- **Corner Style:** 14px radius default (`RADII.lg`); the RADII scale runs 8/12/14/18/22.
- **Background:** A `WHIMSY` pastel fill (`paper` default) chosen per sticker.
- **Border:** 2px ink border, always.
- **Tilt:** A hand-drawn rotation (default −0.6°; list rows cycle `ROW_TILTS` for varied scrapbook angles).
- **Shadow:** `STICKER_SHADOW` (see Elevation).
- **Tape:** A narrow translucent `Tape` strip (default `sun`, −8° tilt) pins stickers to the page.

### Empty & Loading States
- **Style:** Cozy, never utilitarian. A `Sticker` with a `Glyph` and a warm line (`EmptyState`), or a warm `LoadingBeat` — never a bare gray "Nothing here." string or a naked `ActivityIndicator`.

### Navigation
- **Signature component:** `HangingSignsTabBar` — a custom tab bar of hand-drawn hanging signs that sway with springy motion, not a flat system tab bar.
- **Headers:** Every stack screen wears the same crown — `PageHeader` (uppercase kicker + whimsy title + ink rule + optional `‹ back`) at the top of screen; in-screen `SectionHeader` for section breaks. No ad-hoc back-arrow rows.

### Motion
- **Character:** Springy, slightly overshooting, hand-wound — the tab-bar sway, heart floats, chain-tug, reveal pop-ins. Native-driven Reanimated 3 springs; Rive for Rosie's live animation. Never a linear fade that could belong to any app.

## 6. Do's and Don'ts

### Do:
- **Do** reach for tokens: `WHIMSY`, `FONTS`, `TYPE`, `RADII` (8/12/14/18/22), `SPACE` (4/8/12/16/24), `STICKER_SHADOW`/`SHADOW_SM`. `constants/theme.ts` is the single source of truth.
- **Do** put every surface on a `Sticker` — 2px ink border, hand-drawn tilt (±0.5–1.5°), a hard zero-blur shadow. Cards are good here. Tilt is good here.
- **Do** compose text from `TYPE` roles with a color applied per use; keep the 18px canonical page padding (`PAGE_PAD`) on headers and scroll edges.
- **Do** show feelings as sprites and growth — mood is Rosie's sprite, a streak is the garden.
- **Do** make the world respond *now* — animate the claim on tap, vanish the cleansed curse immediately.
- **Do** keep every screen cream/paper and crown every stack screen with `PageHeader`.

### Don't:
- **Don't** treat this like a SaaS dashboard — do not kill the cards, flatten the gradients, calm the motion, or default to system fonts. A borderless, perfectly-aligned, soft-shadow card is slop here.
- **Don't** inline a raw hex, font size, radius, or pad past the token layer. That governance erosion *is* the slop — not a generic look.
- **Don't** add a third shadow tier or a blurred shadow in a sticker context. Two tiers, zero blur, ink-colored.
- **Don't** use a meter, number, or label for anything emotional. The heart counter is the only number that earns its place.
- **Don't** ever put an emoji character in a render — use `Glyph` (hand-drawn art) or `Icon` (SVG). An emoji in the UI is an automatic taste failure.
- **Don't** wrap a screen in black (`#1A1A1A`) — it breaks the warm cream continuity with a flash.
- **Don't** dissolve a disabled control's outline under an opacity crush — mute the fill, keep the shape.

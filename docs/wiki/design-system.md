---
title: Design System (WHIMSY UI)
aliases: [whimsy, design-system, design-tokens, sticker-ui]
tags: [design, ui, tokens, strategy]
status: draft
sources:
  - code: constants/theme.ts
  - code: components/ui/Sticker.tsx
  - code: components/ui/Button.tsx
  - doc: docs/ui-inventory.md
  - doc: docs/wiki/outputs/memos/ui-layout-audit-2026-06.md
last_compiled: 2026-06-13
---

# Design System (WHIMSY UI)

TTP's cozy hand-drawn "storybook" look — a warm paper palette, two display fonts, and rotated paper-sticker cards with hard black outlines and offset drop-shadows. The brand is coherent at the **token** level (`constants/theme.ts`); the problem is **application drift** — most screens hardcode values instead of consuming the tokens.

## How it works

The whole identity is a handful of exported tokens in `constants/theme.ts`:

- **Palette** — `WHIMSY` (paper-sticker palette: `ink` dark brown, `paper`/`cream`, `sun`, `lilac`, `rose`, `accent`). Alignment tints `angel`/`goblin` live here too (see `constants/theme.ts:4`). A second, older `COLORS` set coexists.
- **Two display fonts** — `FONTS.whimsy` (`Caprasimo`) for fat-rounded headers and `FONTS.hand` (`PatrickHand`) for kickers; `Nunito`/`Fredoka` weights for body (`constants/theme.ts:63`).
- **Sticker cards** — the core surface unit: `components/ui/Sticker.tsx` renders a rotated (default −0.6°) card with a 2px `WHIMSY.ink` border and the hard `STICKER_SHADOW` (offset 4,4 / radius 0). `Tape` pins them scrapbook-style.
- **Two shadow tiers** — `STICKER_SHADOW` (hard, opaque, offset) for sticker cards vs `SHADOWS.card`/`SHADOWS.pillFloat` (soft, blurred) for floating chrome (`constants/theme.ts:26,82`).
- **Header furniture** — `KICKER_TEXT` (★ leading hand-font caption), `KICKER_PILL` (tracked uppercase band), and `TITLE_RULE` (short ink underline) compose the canonical section header (`constants/theme.ts:110–137`).
- **Spacing/radii** — `RADII` (sm 8 → xxl 22) and `ROW_TILTS` (shared scrapbook angle sequence).

**The drift (verified counts).** `RADII` has **0** importers while **58** files hardcode `borderRadius`; the `Sticker` component is imported by only **4** files despite "everything lives on Stickers" (`docs/ui-inventory.md:16`); `TITLE_RULE` (4) and `KICKER_PILL` (5) are barely used. Spacing is a scatter of raw numerics with no scale. So the standardized spec — adopt `RADII`, a single spacing scale, the two shadow tiers, the `Sticker` primitive, and the canonical kicker+rule header everywhere — is a *consolidation* job, not a redesign.

## Key files

- `constants/theme.ts` — single source of truth: `WHIMSY`/`COLORS` palettes, `FONTS`, `RADII`, `STICKER_SHADOW`/`SHADOWS`, `KICKER_TEXT`/`KICKER_PILL`/`TITLE_RULE`, `RARITY_GRADIENT`.
- `components/ui/Sticker.tsx` — the `Sticker` + `Tape` primitives; the only enforced piece of the identity.
- `components/ui/Button.tsx` — the button system (gradient/flat variants, sm/md/lg sizes); note it carries its own `SIZE_MAP` radii/colors rather than reading `RADII`.
- `docs/ui-inventory.md` — per-screen inventory; section 0 is the canonical prose statement of the visual identity.
- `docs/wiki/outputs/memos/ui-layout-audit-2026-06.md` — the layout/drift audit (companion memo; see Open questions).

## Connects to

- [[shop-cosmetics-closet]] — `RARITY_GRADIENT`/`RARITY_BG_SOLID` tokens drive shop card backgrounds.
- [[alignment]] — `WHIMSY.angel`/`goblin` tints theme the Greedy↔Generous UI.
- [[architecture-seams]] — token-vs-application drift is a structural seam: the fix is consolidation onto `constants/theme.ts`.
- [[achievements-and-titles]] — kicker/rule header furniture styles the titles + achievement screens.

## Open questions / risks

- **Status: draft.** The cited audit memo `docs/wiki/outputs/memos/ui-layout-audit-2026-06.md` does **not exist on disk** yet (the `outputs/memos/` dir is empty) — this page anticipates it. Either write the memo or drop the citation.
- **Two palettes** (`WHIMSY` vs `COLORS`) and **two color systems** (`Button` hardcodes hex pairs in `GRADIENT_VARIANTS` instead of palette tokens) — which is canonical? Pick one to avoid re-divergence.
- `RADII` is dead (0 importers) — is the spacing/radii scale actually the intended standard, or should it be redefined before enforcing?

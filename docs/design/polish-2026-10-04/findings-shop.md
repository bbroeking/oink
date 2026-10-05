# Polish findings — Shop area (2026-10-04)

40 findings: P1 3 · P2 12 · P3 25. Fixed 35, deferred 4, server copy 1. Gates at finish: tsc clean; eslint 0 errors on 25 files; the 24 suites covering these files 331/331 green (updated `closetCatalog`, `shopNav`; new tests in `shopShelves`, `previewFit`, `PigPen`); scorecard `{}`. Layout claims measured with the shipped fonts at default and 1.3× on SE and 17 Pro widths.

## Fixed (highlights)
- **S-01 (P1)** the Neck slot drew a bandana but read "Neck slot, empty" and had no ✕ (hidden categories were dropped from the catalog): the hook returns `wornItems`, so anything the pig wears can be named and taken off.
- **S-30 (P1)** the slot ✕ sat inside the pressable chip, unreachable by VoiceOver: now a sibling control over the corner.
- **S-02 (P1)** the item preview cut the Wizard Hat's tip (and overflowed the SE frame): `utils/previewFit.ts` fits the union of the renderer's item boxes, never scaling up. S-03 its ✕ sits inside the card, labelled "Close".
- S-04/S-05 fixed-width slot columns (the pig window yields), one-line slot labels capped at `CHROME_TYPE_CAP` ("Tickle", "Scene" replace "TICKLES", "BG"); S-06/S-27 closet tile names in the `label` role, up to three lines, rows stretch: no truncation measured.
- S-08 the crown kicker reports today's shelf ("three you can buy today" / "11 on the shelves today"); S-09 an ink edge appears under the Shop and Pen headers once content scrolls (local until the primitive lands).
- Pen: S-10 the "Rosie at home" note at the paddock's top and a lone Rosie centred; S-11 the page runs under the home indicator; S-12 "Send Rosie out looking" (the old label literally ended in "…"); S-13 "In the Pen" disabled when no other pig can come home; S-14 consistent coat line; S-15 the pig row runs edge to edge.
- Reward return: S-16 the "feather smudge" was confetti bursting from Bandit's face, now drawn behind the pig; S-17 no double naming; S-18 the pig's name, not its id, in the label.
- Titles: S-19 icon by `titles.source`; S-20 VoiceOver reads descriptions, names wrap; S-21/S-22 duplicate count removed, Close named.
- Smaller: shelf slots line up, Furnish sign fits, members' sign hint, plain-grid kicker, prices grouped, SafeAreaView from safe-area-context.

## Primitive asks
1. `PageHeader` (and panel headers) scroll edge: a full-width `BORDER.ink` rule always laid out, visible once content scrolls (local `crownEdge` in `shop.tsx` and `app/pen.tsx` to replace); the same defect is on Friends (016), Season (043), Barn (005) and the Me sheets (074/076).
2. `Sticker` passes `accessibilityActions` / `onAccessibilityAction` through, so a pressable sticker can offer a nested control as a custom action.
3. `StackPage` takes safe-area `edges`, so a scrolling stack screen can run under the home indicator.

## Server copy
53 em dashes in `titles.description` and the retired "Dig-Off week" in `the_unmissable`: covered by `supabase/migrations/20261004231000_catalog_copy_polish.sql` (the lead's migration; Crown Hog reads "The big boar: fifty recruits.", since "sounder" meant the referral downline when it was written).

## Deferred
S-36 on the SE nothing of the storefront is above the fold: the real fix is the sticky try-on bar + fitting-room sheet ratified 2026-09-17 and never built (a redesign, not polish) · S-35 Copper's paddock sprite is cropped at the top-right (repaint `assets/images/sprites/copper/idle_*`) · S-37 usernames over ~12 characters can break mid-word at large text in the counter tag and corkboard pin · S-38 `components/shop/TroughByCounter.tsx` has no importer (recommend deleting; an earlier session edited it).

## Proposed taste-log lines
A 3-up tile's name uses the `label` role. The product shot is fitted, never cut. A slot label is one word that fits its chip at the text cap, and anything the pig wears can be named and taken off. The header owns its scroll edge.

# Season 1 — Visual Brief: theme, the Season page, graphics

Companion to `season-1-goblins-vs-angels.md`. Covers the season's
*visual identity* — the part that needs new graphics.

---

## 1. Season theme — tints & palette

The base app palette (WHIMSY: cream / rose / lilac / sun) stays. Season 1
layers a **duotone** on top — gold for the angelic pole, moss for the
goblin pole — so any "this is a Season 1 surface" reads instantly.

Proposed `SEASON_1` theme block (for `constants/theme.ts`):

```
SEASON_1 = {
  angelGold:   "#F2C94C"   // halo gold — the generous pole
  angelLight:  "#FFFDF5"   // cloud white
  goblinMoss:  "#7BA266"   // the greedy pole
  goblinDeep:  "#3F4A2E"   // swamp shadow
  tarnish:     "#B8923A"   // goblin's dirty gold
  duskTint:    "rgba(...)" // the schism happens at dusk — a faint
                           // warm-to-cool wash for season headers
}
```

**Where the tint applies:**
- Season page hero header — gold→moss horizontal gradient wash.
- Alignment leaderboard scope — gold at the top, moss at the bottom,
  a neutral hairline where the list crosses zero.
- `AlignmentBadge` + `BarnOverlay` — already tint by side; pull their
  hardcoded rgba values into `SEASON_1` so it's one source of truth.
- Achievement cards in the trade ladder — faint side tint.

Nothing else changes — the rest of the app stays its cozy self. The
season is a *layer*, not a reskin.

---

## 2. The Season page

Today `app/(tabs)/season.tsx` is the battle-pass tab (tier list +
bounty board). Proposal: give it a **Season 1 hero header** so it
becomes a real season hub, content below unchanged.

```
┌────────────────────────────────────────┐
│   [ HERO ART — pig between angel+goblin]│  ← new graphic
│   SEASON 1                              │
│   Goblins vs Angels                     │
│   Week 3 of 8 · 38 days to Judgement    │  ← seasonWeek() + countdown
├────────────────────────────────────────┤
│   YOUR STANDING                         │
│   [alignment dial]   Generous  +52      │  ← reuse AlignmentBadge
│   #4 most generous                      │
├────────────────────────────────────────┤
│   THIS WEEK                             │
│   [ BountyBoard — already built ]       │
├────────────────────────────────────────┤
│   THE LADDER                            │
│   [ battle-pass tier list — existing ]  │
├────────────────────────────────────────┤
│   COMING UP                             │  ← drives off SEASON_1_UNLOCKS
│   ☀ Blessings  · live                   │
│   🟢 Curses    · Week 4                 │
│   👑 Judgement · Week 8                 │
└────────────────────────────────────────┘
```

The "Coming up" strip reads straight from `utils/season.ts` — it's the
in-app twin of the release-notes drip, so players see what's next
without it being playable early.

**Build cost:** ~1 new header component + the "Coming up" strip;
everything below already exists. The blocker is the hero art.

---

## 3. Graphics needed

| # | Asset | Used by | Pipeline |
|---|---|---|---|
| 1 | **Season 1 key art** — a pig flanked by a small halo'd angel-pig and a small horned goblin-pig, tug-of-war pose | Season page hero | ChatGPT / icon-gen |
| 2 | **Season header texture** — faint gold→moss duotone wash, ~1024×360 | Season page hero bg | could be CSS gradient — no art needed |
| 3 | **8 cosmetic ladder icons** — daisy_crown, angel_halo, angel_wings, holy_radiance / gold_tooth, coin_monocle, goblin_ears, goblin_crown | achievement + tier rewards | icon-gen (brief exists) |
| 4 | **2 finale exclusives** — seraph_wings, cursed_crown | Judgement Day grants | icon-gen |
| 5 | Blessing/curse kind icons (8) | RitualPicker — *currently emoji, fine for now* | defer |

**Priority:** #1 (hero art) unblocks the Season page. #3 unblocks the
cosmetic rewards. #2 is just a gradient — no art. #4 can wait for
week 8. #5 stays emoji.

### Hero-art prompt (icon-gen ready)

```
A wide hero banner for a cozy mobile game's season screen.
Subject: one round pink cartoon pig in the center, facing forward,
caught mid tug-of-war between TWO tiny versions of itself —
- on the left, a small pink pig with a golden halo and little white
  feathered wings, tugging the center pig's hoof gently
- on the right, a small pink pig with short curved horns and a
  sly grin, tugging the center pig's other hoof
The center pig looks cheerfully torn. Whimsical storybook
illustration, bold ~3px black outline, flat painted shading, soft
saturated palette. Warm gold light washing in from the left, cool
mossy green from the right, meeting behind the center pig.
Transparent background. Wide 16:6 banner composition.
```

---

## 4. Build order

1. `SEASON_1` theme block in `constants/theme.ts` (no art needed).
2. "Coming up" strip + season hero header *scaffold* (placeholder
   art slot) — wires up `seasonWeek` / countdown / `SEASON_1_UNLOCKS`.
3. Generate hero art (#1) via icon-gen, drop into the header.
4. Generate the 8 ladder icons (#3) — already briefed.
5. Finale exclusives (#4) before week 8.

# Pair Flames — UI Design Brief

> Shaped 2026-07-15 with the founder (flame home = friend rows · milestones =
> art stages AND worn cosmetics · lapse tone = soft ember trace). Companion to
> `docs/wedge-plan.md` Phase 2 and the pair-bonds feature (migration
> `20260743000000`, staged). Consult `docs/design/taste-standard.md` before
> implementing — its "show feelings, never state them: streak = the garden
> growing" rule is the spine of this design.

## What it is (one line each)

- A **flame** exists per pair of friends. It lights the first day BOTH pigs do
  a pair action (trade · blessing · visit), climbs +1 per consecutive mutual
  day, **sleeps** (soft ember trace, count banked to "longest") on a missed
  day, and rekindles fresh on the next mutual day.
- The flame is **drawn, staged art** — never a bare meter. The number rides
  beside the art the way the heart-counter earns its place, in progression
  contexts only.
- No blame, ever: the UI never says who missed. Copy blames the *fire*
  ("the fire's resting"), not a pig.

## The flame sprite set (new art — cosmetic ImageGen lane, flat-sticker law)

| Sprite | Stage | Used when |
|---|---|---|
| `flame_spark` | days 1–6 | newly lit |
| `flame_steady` | days 7–29 | the workhorse |
| `flame_bonfire` | days 30–89 | committed pairs |
| `flame_hearthlight` | days 90+ | halo-glow tier |
| `flame_wisp` | lapsed | soft ember trace, rendered at 55% opacity |

Style: hand-drawn storybook flame matching Glyph art (2px ink line, warm
`WHIMSY.sun` core, `accent` rust licks). NO emoji anywhere (taste law) — the
🔥 in early sketches was placeholder only. Sizes: 18pt (rows), 44pt (sheet),
14pt (board). One sprite sheet, five states; no animation baked into art —
motion is code (below).

## Surface 1 — Friend rows (the flame's home)

```
★ friends
┌──────────────────────────────────────────┐
│ (avatar) kate · Drove Captain   ⟡ 12 ✦   │   ⟡ = flame_steady 18pt
│ (avatar) noah                    ⟡ 4     │   numeral: TYPE.numeral,
│ (avatar) matchy                  ~       │   FONTS.whimsy, WHIMSY.ink
└──────────────────────────────────────────┘   ~ = flame_wisp @55%, NO number
```

- Placement: right-aligned cluster, before the chevron, after the favorite
  star — the star (user-set) keeps precedence; flames never reorder the list.
- Alive: sprite + day numeral, `gap: SPACE.xs`. Lapsed: wisp only — the lost
  count appears nowhere on the row (banked in the sheet). Never-lit: nothing.
- Milestone day (crossing 7/30/90): the row sprite swaps stage with the pop
  animation (below) next time the list is visible. No badges, no dots.

## Surface 2 — Friend sheet (UserSheet) — the keepsake cluster

```
┌────────────────────────────────────┐
│        (big pig portrait)          │
│        kate · Drove Captain        │
│                                    │
│   (flame_bonfire 44pt)  burning    │
│                         34 days    │
│   you two: 40 trades · 12          │
│   blessings · 5 visits             │
│   longest flame: 40 days ★         │   only when longest > current
│   day 90 lights matching crowns    │   quiet next-milestone line
└────────────────────────────────────┘
```

- The flame block sits directly above the existing keepsake line ("you two:")
  — one friendship cluster, `Sticker color="cream"`, rotate −0.4.
- "burning N days": FONTS.hand, TYPE.hand, ink; the numeral is part of the
  sentence, not a stat cell (feelings-adjacent → words first).
- Milestone line: static, `WHIMSY.mute`, PatrickHand — states what the NEXT
  milestone pays ("day 30 lights matching lanterns"), never a countdown, never
  urgency. Hidden at hearthlight (nothing left to tease — replaced by
  "a hearthlight — the bog's oldest kind of warm").
- Lapsed state: `flame_wisp` 44pt + "the fire's resting — any kindness
  rekindles it." + "longest flame: 40 days ★". No date of lapse. No cause.
- Never-lit state (friends, no flame yet): tiny unlit line under the keepsake:
  "no fire yet — a kindness each, same day, lights one." (discovery-by-copy;
  no tutorial modal).

## Surface 3 — the lighting moment (motion is the feature)

When a pair-day completes while a flame surface is mounted (e.g. you fulfill
kate's trade from the trades sheet, or the row is visible during refetch):

- **First light**: sprite scales in 0→1.15→1 (spring, ~450ms), 5–6 spark
  particles (`WHIMSY.sun`, 2–3px, 600ms fade-up) — the SAME particle idiom as
  the dig's truffle pop, reused not reinvented. One-shot announcement row
  (existing feed): "a little fire started between you and kate."
- **Daily climb** (+1): sprite does a single warm pulse (scale 1→1.08→1,
  300ms); numeral crossfades.
- **Stage-up / milestone**: pulse + sparks + (for 30/90) the existing
  item-grant dialog: "thirty days burning — you and kate earned matching
  lanterns." Both pigs get the item; the OTHER pig learns via announcement +
  push ("your fire with brian hit thirty days — matching lanterns, both of
  you").
- All motion behind `useReducedMotion` → crossfades.
- **World-responds-now rule**: the flame bump renders optimistically the
  moment the qualifying action succeeds locally; server reconciles after
  (same optimistic idiom as bumpHomeStats).

## Surface 4 — milestone cosmetics (the "Both" decision)

- Stages pay themselves (art gets grander); WORN items at the big marks:
  - **day 30 — matching lantern charms** (neck slot)
  - **day 90 — matching ember crowns** (hat slot)
- Items are normal `user_hats` grants flagged pair-earned; in Collectibles
  they show a small two-pigs mark + "earned with {name}" in the detail sheet.
  Not tradeable, not shop-visible (earn-only law).
- Art: 2 new cosmetics through the regen-studio lane + placement studio.
  Identical art for both pigs (matching IS the point).

## Surface 5 — everywhere else (light touches only)

- **Strongest Pairs board**: alive pairs get the stage sprite at 14pt before
  the bond number. No flame column, no second number — bond stays the board's
  one metric. (A "longest flames" scope is future, not now.)
- **Share card / text-grid** (wedge Phase 1–2): pair share gains one line —
  "34 days burning ⟡" — and the Monday recap card includes the herd's
  brightest flame.
- **Barn**: nothing in v1 (the hearth-on-barn concept was considered and
  parked — friend rows won the "home" question).

## Copy inventory (final strings)

| Context | String |
|---|---|
| sheet, alive | `burning {n} days` |
| sheet, next milestone | `day {30\|90} lights matching {lanterns\|crowns}` |
| sheet, hearthlight | `a hearthlight — the bog's oldest kind of warm` |
| sheet, lapsed | `the fire's resting — any kindness rekindles it.` |
| sheet, banked | `longest flame: {n} days ★` |
| sheet, never lit | `no fire yet — a kindness each, same day, lights one.` |
| announcement, first light | `a little fire started between you and {name}.` |
| grant dialog, day 30 | `thirty days burning — you and {name} earned matching lanterns.` |
| push, milestone (other pig) | `your fire with {name} hit {n} days — matching {item}, both of you` |

Voice check: lowercase, folkloric, fire-as-subject (never "you missed").

## Data contract (UI's needs from the server — informs the migration)

- Per pair: `flame_days int`, `flame_alive bool`, `longest_days int`,
  `last_mutual_day date` (server-computed; day boundary = UTC day, same
  authority as feeding windows — copy never exposes the boundary).
- Delivered on: friend list payload (per-row), `pair_bond_with` (sheet),
  `pair_leaderboard` (board sprite).
- Mutual-day evaluation is server-side (trigger alongside the pair_bonds
  bumps); client only renders + optimistically pulses.

## Edge cases

- Unfriend → flame hidden everywhere, data retained (re-friend resumes
  longest, current lapses naturally).
- Same-day multiple actions → still +1/day (copy never implies more).
- Brand-new friendship → never-lit line only; no wisp (wisp = HAD a fire).
- Offline/unpushed-migration → all flame UI renders nothing (fail-soft,
  pair-bonds idiom).
- A pig with 200 friends → sprites are cheap static images; no per-row
  animation on mount (pulse only on live increments).

## A11y

- Row cluster label: `"flame with kate: 12 days burning"` / `"resting"`.
- Sprites carry no information color alone doesn't duplicate (stage names in
  labels); reduced-motion honored on all pulses.

## Anti-goals (what this must NOT become)

- No "about to lapse" warnings, timers, or evening nag pushes — the only
  flame pushes are CELEBRATIONS (milestones). This is the charter line.
- No who-missed attribution, anywhere, ever.
- No flame decay stages (alive or resting — nothing in between to fret over).
- No paid saves/freezes (earn-only law; also: guilt monetization is the
  competitor's move we're positioned against).
```

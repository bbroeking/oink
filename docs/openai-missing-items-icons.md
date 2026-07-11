# Missing-items icons — ChatGPT image-gen brief

The **11 art-missing cosmetics** from the audit (`docs/item-art-audit-2026-07.md`).
All 11 were seeded in `20260632000000_daily_shop_expand.sql` and blanket-hidden
(`cost = 0`) by `20260685000000_hide_orphan_cosmetics.sql` because they render a
wrong category fallback with no art. **None is obtainable today** (`daily_shop()`
draws `cost > 0` only; no pass/beta/war/cron grants them), so there is no
strict "obtainable-now" subset — this brief is the art-pass backlog. Each item
re-enters daily-shop rotation the moment it gets a PNG **and** a restored cost.

Ordering rationale (most-shippable / highest-value first): the 7 worn
accessories match the sticker style anchor directly and unblock the widest shop
band, so they lead. `particle_bubble` (Batch 4) also unblocks its bubble tap-FX.
Batch 5's aura + 2 backgrounds use a **different pipeline** (full-canvas, NOT the
flat sticker) — noted inline; keep them last.

Post-processing for every item: slice per-item bbox → `assets/images/hats/`
(backgrounds → `assets/images/backgrounds/`, particle → `assets/images/tickle-particles/`),
register in `HAT_IMAGES`, place worn items via `tools/placement_studio.py`
(writes `constants/hat_rel.generated.ts`), then restore each item's cost in a
migration (reverse of `20260685`).

Refs to drag (staged in `~/Desktop/ttp-refs/`) for the sticker batches: any two
existing hat stickers as the style lock, e.g. `beanie.png`, `chef_toque.png`.

## Style anchor (paste once)

```
You are generating cosmetic item stickers for a cozy mobile game about pigs.
Match the attached reference stickers EXACTLY in style: kawaii sticker art,
thick dark chocolate-brown ink outlines, soft warm palette, flat matte fills
with at most one soft highlight, cream-paper white balance.

HARD RULES for every item:
- Each item is a PURE 2D PAPER CUTOUT viewed straight from the front.
- The bottom edge is a SOLID PAINTED EDGE — never an opening showing the inside.
- NO back-of-brim, NO back-of-band, NO underside, NO inner cavity.
- Bands and trim are visible only on the front-facing portion; where they would
  wrap behind, they simply end at the silhouette edge.
- Think: a sticker glued to a flat surface — not a 3D-rendered object.
- Plain solid WHITE background, generous spacing between items, no text,
  no watermarks, no drop shadows.

Acknowledge these rules and wait for the item batches.
```

## Batch 1 of 5 — Hats

```
Two items side by side, generous gap, same scale:

LEFT — MUSHROOM CAP: a toadstool worn as a hat, dome cap in warm muted red with
soft cream polka-dot spots, a thick pale-cream stalk band beneath it as the
brim. Storybook, just-sprouted, smells-like-rain feeling. Front view, solid
painted bottom edge.

RIGHT — PAPER BOAT: a folded-newspaper boat worn as a hat, crisp origami
folds in off-white newsprint with faint grey printed-text texture, a soft
muddy-grey shadow in the hull crease. Jaunty, seaworthy-ish. Front view, the
open top of the boat facing up, solid painted bottom edge.
```

## Batch 2 of 5 — Glasses + Bow

```
Two items side by side, generous gap, same scale:

LEFT — JAM-JAR LENSES: round bottle-bottom spectacles, two thick chunky
circular lenses of pale amber-tinted glass with a swirly concentric ripple,
joined by a small dark-brown bridge, short brown temple arms ending at the
silhouette edge. Goofy, bookish. Front view.

RIGHT — ACORN BOW: a small hair bow tied from a thin twig, two acorn-brown
loops with a real acorn (glossy nut + textured cap) as the center knot, a tiny
green twig tail. Woodland, a-squirrel-wants-it-back charm. Front view.
```

## Batch 3 of 5 — Bow + Held (lantern)

```
Two items side by side, generous gap, same scale:

LEFT — BUMBLEBEE BOW: a plump hair bow in alternating black and warm-yellow
horizontal stripes, two rounded loops and a small center knot, a pair of tiny
translucent rounded wings peeking from behind the knot. Cheerful, gently
humming. Front view, solid painted bottom edge.

RIGHT — FIREFLY LANTERN: a small round paper lantern held in the hand, warm
paper-amber body with a soft glowing center, thin dark-brown wire frame top and
bottom, a short handle loop above, three tiny glowing-gold firefly dots inside.
Cozy porch-light glow. Front view.
```

## Batch 4 of 5 — Held (umbrella) + Tickle particle

```
Two items, generous gap. NOTE the particle is a TINY tap-effect glyph, not a
worn accessory — render it small and simple like an emoji-scale icon.

LEFT — TINY UMBRELLA: a small closed-ish cocktail umbrella, scalloped canopy in
cheerful pastel candy stripes (soft pink / cream / mint), a thin brown stick and
a little curled handle. For drizzle, sun, or dramatic exits. Front view, solid
painted edge.

RIGHT — BUBBLE PARTICLE (small icon): a single wobbly soap bubble, near-circular
with a soft iridescent pale-blue/lavender sheen, one bright white highlight
crescent, a couple of tiny satellite bubbles beside it. Clean, poppable, floaty.
Solid white background — this is a tap-effect glyph.
```

## Batch 5 of 5 — Aura + Backgrounds (DIFFERENT PIPELINE)

These are NOT flat sticker accessories. Generate each on its own so it can be
sliced/framed correctly. Ignore the paper-cutout HARD RULES for these three.

```
ITEM A — MOTH WALTZ (AURA overlay): a full-canvas soft radial aura meant to
sit BEHIND the pig. A ring of pale luna-moth silhouettes (soft sage-green,
gentle wings) drifting in a slow circle around a warm dim center glow, like
moths around a porch light. Mostly transparent/dark toward the edges, subtle,
dreamy. Square, centered, transparent or plain dark background (it composites
behind the character).
```

```
ITEM B — PUMPKIN PATCH (BACKGROUND scene): a cozy storybook autumn pumpkin
patch as a full backdrop — a field of big lumpy orange pumpkins of varied
sizes on curling green vines, one pumpkin subtly pig-shaped, warm low golden
afternoon light, soft hills and a hint of barn behind. Match the painterly
style of the game's other backgrounds (soft, warm, cozy, no text). Full-bleed
rectangular scene, room in the lower-center for a pig to stand.
```

```
ITEM C — LIBRARY NOOK (BACKGROUND scene): a cozy rainy-day reading nook as a
full backdrop — tall warm-wood bookshelves packed with colorful spines, a
worn overstuffed armchair, a small glowing reading lamp, a rain-streaked window
with soft grey daylight. Warm, hushed, epic-tier coziness. Match the game's
other painterly backgrounds, no text. Full-bleed rectangular scene, room in the
lower-center for a pig to stand.
```

## After art lands

1. Slice + register in `HAT_IMAGES` (hats/bg/tickle-particles per category).
2. Worn items → `tools/placement_studio.py` for RelSpecs. Auras/backgrounds/
   particle need no per-item RelSpec (category-placed / full-canvas).
3. Migration (reverse of `20260685`): restore each cost — `mushroom_cap` 240,
   `paper_boat` 120, `jam_jar_lenses` 260, `acorn_bow` 130, `bumblebee_bow` 280,
   `firefly_lantern` 600, `tiny_umbrella` 150 (also drop from `HIDDEN_CLOSET_IDS`
   in `ClosetView.tsx`), `particle_bubble` 300, `moth_waltz` 750,
   `pumpkin_patch` 650, `library_nook` 1200.

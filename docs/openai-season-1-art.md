# Season 1 Art — ChatGPT Generation Brief

All Season 1 "Goblins vs Angels" graphics: the 8 cosmetic ladder
icons, the 2 finale exclusives, and the season hero banner.

Run with `/icon-gen docs/openai-season-1-art.md`. Batches 1-3 are
4-/2-cell accessory strips; Batch 4 is the standalone hero banner.

## Workflow

1. Fresh ChatGPT conversation. Attach references from `~/Desktop/ttp-refs/`:
   `idle_1.png`…`idle_4.png` (the pig), `wizard.png`, `magic_wand.png`
   (existing accessory style).
2. Paste the **Style anchor** once.
3. Send each batch; slice the strips into individual PNGs → save to
   `assets/images/hats/<id>.png`.
4. `python3 scripts/compute_overlays.py` to regenerate overlays.
5. Wire the item ids into the achievement/battle-pass reward tracks.

---

## Style anchor (paste once)

```
I'm generating cosmetic accessory sprites for a 2D mobile game.
NO characters, NO pigs, NO people — only the items themselves.

Attached references: idle_1..idle_4 (the pig these sit on) and
wizard.png / magic_wand.png (existing accessories — match THIS style).

Style for every accessory (STRICT):
- Flat children's storybook illustration, bold ~3px black outline
- Flat painted cel-shading only — NO 3D, NO metallic gradients,
  NO photorealistic reflections, NO glossy highlights
- Soft saturated colors, pure transparent background

Silhouette rules (CRITICAL — items must lie flat on a pig sprite):
- Each item is a PURE 2D PAPER CUTOUT viewed straight from the front
- NO back-of-brim, NO underside, NO inner cavity, NO 3D volume
- Bottom edges are SOLID painted edges, never an opening
- Think: a sticker glued to a flat surface

Layout: a horizontal strip, each item centered in its own cell with
even spacing + side padding so nothing is cropped. Confirm, then
I'll send the first batch.
```

---

## Batch 1 of 4 — Angel ladder (4-cell strip, transparent)

```
SEASON BATCH 1: a 4-cell strip, these angel-themed items in order.
Same flat 2D paper-cutout rules.

1. daisy_crown — a dainty crown of small white-and-yellow daisies,
   front-facing arc, sits on a head
2. angel_halo — a simple glowing gold ring, flat front-facing ring
   (a front arc, NOT a 3D ellipse)
3. angel_wings — a pair of small white feathered wings, shown
   spread + flat, as a back-worn accessory
4. holy_radiance — a soft sunburst aura: gentle gold-and-white rays
   radiating from a center, flat, no pig

Transparent background. Clean 4-cell row, side padding.
```

## Batch 2 of 4 — Goblin ladder (4-cell strip, transparent)

```
SEASON BATCH 2: a 4-cell strip, these goblin-themed items in order.
Same flat 2D paper-cutout rules.

1. gold_tooth — a single shiny gold tooth, simple flat shape
2. coin_monocle — a gold coin worn as a monocle, with a short chain,
   flat front view
3. goblin_ears — a pair of long pointed greenish ears, flat,
   head-worn accessory
4. goblin_crown — a small twisted dark-gold crown with crooked
   points and tiny green gems, front-facing arc only

Transparent background. Clean 4-cell row, side padding.
```

## Batch 3 of 4 — Finale exclusives (2-cell strip, transparent)

```
SEASON BATCH 3: a 2-cell strip, the two Season 1 finale items.
Same flat 2D paper-cutout rules — these are the "legendary" tier so
they can be a touch more ornate, but still flat painted, no 3D.

1. seraph_wings — large, layered white-and-gold feathered wings,
   grander than angel_wings, spread + flat, back-worn
2. cursed_crown — an ornate blackened crown with jagged points,
   glowing green gems, a faint dark aura along the edge,
   front-facing arc only

Transparent background. 2-cell row, side padding.
```

## Batch 4 of 4 — Season hero banner (standalone, NOT a strip)

```
SEASON HERO: a single wide banner image for the game's Season page.
Subject: one round pink cartoon pig in the center, facing forward,
caught mid tug-of-war between TWO tiny versions of itself —
- left: a small pink pig with a gold halo + little white feathered
  wings, gently tugging the center pig's hoof
- right: a small pink pig with short curved horns + a sly grin,
  tugging the center pig's other hoof
The center pig looks cheerfully torn.

Whimsical storybook illustration, bold ~3px black outline, flat
painted shading, soft saturated palette. Warm gold light from the
left, cool mossy green from the right, meeting behind the center
pig. Transparent background. Wide 16:6 banner composition.
```

---

## Item id → reward mapping

| Item id        | Slot   | Earned via |
|----------------|--------|------------|
| daisy_crown    | hat    | alignment +25 |
| angel_halo     | hat    | alignment +50 |
| angel_wings    | cape   | alignment +75 |
| holy_radiance  | aura   | alignment +90 (hold 3d) |
| gold_tooth     | mask   | alignment −25 |
| coin_monocle   | glasses| alignment −50 |
| goblin_ears    | hat    | alignment −75 |
| goblin_crown   | hat    | alignment −90 (hold 3d) |
| seraph_wings   | cape   | finale — top 3 Givers |
| cursed_crown   | hat    | finale — top 3 Goblins |

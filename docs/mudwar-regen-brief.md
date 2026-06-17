# Mud Wars items — flat-sticker regeneration brief

Regenerate the Mud Wars **wearable** cosmetics (hats / held / festival items that
sit ON the pig) as flat 2D stickers. Two problems with the current set:
1. They render with **3D depth** — visible insides / undersides / back-of-rim
   (e.g. the slop bucket shows its open top, the helmet/cap read as 3D domes).
   Placed flat on the pig, that 3D "back" looks wrong.
2. The previous slice **clipped the sides**. The new art must sit fully inside the
   frame with generous margin so nothing is cut off when re-sliced.

Auras and backgrounds are NOT in scope (they're effects/scenes, not on the pig).

## Workflow

- Refs to stage (drag into ChatGPT): the existing strips in
  `assets/images/hats/_mudwar_raw/` — `strip1-mud-hats.png`, `strip2-held.png`,
  `strip5-festival.png` — as the STYLE + subject reference (same items, same
  palette, just flattened + uncropped).
- After each batch lands: download, slice per-item with padding, re-run
  `scripts/compute_overlays.py`, spot-check placement on Rosie.

## Style anchor (paste once)

```
You are redrawing a set of game cosmetic icons for "Tickle the Pig" — a cute,
hand-painted storybook cartoon style: bold dark-brown outlines, soft cel shading,
warm muddy/swamp palette. I'll give you reference images of the existing items;
match their subject, charm, and palette EXACTLY, but fix two things:

1. Each item is a PURE 2D PAPER CUTOUT viewed straight from the FRONT. NO 3D
   depth, NO perspective, NO visible inside/cavity, NO back-of-rim or underside.
   A bucket is drawn as a flat front silhouette — never showing the open top or
   the inside. A helmet/cap/crown is a flat front profile — never a rounded 3D
   dome you can see "around." Think: a sticker glued to a flat surface.
2. Each item sits FULLY inside its area with generous empty margin on ALL sides —
   nothing touches or runs off the edges. Do not crop or zoom in.

Output each batch as a horizontal row of separate items on a TRANSPARENT (or flat
solid magenta #ff00ff) background, evenly spaced, each item the same scale, with
clear gaps between them. Bold consistent outline weight. Reply "ready" and wait
for each batch.
```

## Batch 1 of 3 — Mud hats (head items)

```
Batch 1 — five MUD HATS, flat front-facing paper-cutout stickers in a row, even
spacing, generous margin, NO 3D / NO inside / NO underside:
1. muddy_cap — a lumpy cap made of wet brown mud.
2. slop_bucket_hat — a wooden slop bucket worn as a hat; drawn as a flat FRONT
   silhouette of the bucket, do NOT show the open top or any inside.
3. reed_hat — a conical woven reed/thatch hat, flat front, no visible underside.
4. bog_helmet — a battered grey metal helmet with mud splats + a small green
   leaf, flat front profile (not a 3D dome).
5. swamp_crown — a golden crown with a little red-capped mushroom + moss, flat
   front, no back band.
Match the reference palette + charm; just flatten + keep them fully in frame.
```

## Batch 2 of 3 — Held items

```
Batch 2 — five HELD items, flat front-facing paper-cutout stickers in a row, even
spacing, generous margin, NO 3D / NO inside:
1. slop_bucket — a wooden bucket of mud with a rope handle; flat FRONT silhouette,
   do NOT show the open top / inside of the bucket.
2. mud_shovel — a shovel with a muddy blade.
3. mud_pie — a mud "pie" in a tin with a cherry on top.
4. golden_truffle — a shiny golden truffle nugget with a few sparkles.
5. crew_pennant — a small green triangular pennant flag (with a tiny pig-snout
   mark) on a short pole.
Match the reference palette + charm; flatten + keep fully in frame.
```

## Batch 3 of 3 — Festival items

```
Batch 3 — three FESTIVAL items, flat front-facing paper-cutout stickers in a row,
even spacing, generous margin, NO 3D / NO inside:
1. rosette_cap — a pleated prize rosette ribbon (award medal style).
2. prize_sash — a winner's sash / award ribbon.
3. festival_pennant — a string of colorful triangular bunting flags.
Match the reference palette + charm; flatten + keep fully in frame.
```

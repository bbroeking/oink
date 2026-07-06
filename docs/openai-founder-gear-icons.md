# Founding Herd gear — ChatGPT image-gen brief

Season-0 veteran cosmetics (earn-only, granted by tier from `beta_reward_grants`).
Wave 1 = the ribbon (build-104 critical). Wave 2 = pin + laurels.
The **First-Light Aura is NOT in this brief** — auras are procedural
(`cosmeticFx.ts` recipe), not sprites.

Refs to drag (staged in `~/Desktop/ttp-refs/`): `rosette_cap.png`,
`prize_sash.png` — the war-spoils county-fair anchors this set must match.

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

## Batch 1 of 2 — Founder's Mud Ribbon (BUILD-104 CRITICAL)

```
One item, centered, large: FOUNDER'S MUD RIBBON — a legendary prize rosette
worn as a necklace charm. A county-fair rosette: layered ruffled circle of
muddy-gold and warm bronze fabric, a small circle of dried mud at its center
stamped with a tiny pig snout (two nostrils, front view, same ink outline),
two short trailing ribbon tails below in alternating gold/bronze. Slightly
weathered, beloved, first-prize-at-the-fair feeling. Pure flat sticker per
the rules. White background.
```

## Batch 2 of 2 — Trough Table Pin + Snoutfather's Laurels

```
Two items side by side, generous gap, same scale:

LEFT — TROUGH TABLE PIN: a small carved-wood badge shaped like a feeding
trough seen from the front, warm oak grain painted flat, a thin muddy-gold
rim, a tiny gold acorn stud at each end. Humble, sturdy, guild-badge energy.

RIGHT — SNOUTFATHER'S LAURELS: a laurel wreath hat worn flat across the brow,
front view only — an arc of small painted laurel leaves in muddy gold and
deep bronze, tied at the center-bottom with a tiny mud-brown ribbon knot.
Regal but humble, crusted with a hint of dried mud on the lowest leaves.
NO circular back of the wreath — only the front-facing arc, per the rules.

Pure flat stickers, white background.
```

## Post-processing

1. Slice per-item bboxes from the downloads → `assets/images/hats/` at the
   existing hat-asset conventions; register in `HAT_IMAGES`.
2. Place via `tools/placement_studio.py` (→ RelSpecs in
   `constants/hat_rel.generated.ts`): ribbon = necklace anchor, pin =
   accessory anchor, laurels = hat anchor.
3. First-Light Aura: procedural recipe in `cosmeticFx.ts` (pre-Hunger golden
   valley motes — rhyme with ReclaimSlam's joy-motes).
4. Wave-2 grant migration reads tiers from `beta_reward_grants`.

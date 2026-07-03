# Season 2 ChatGPT art briefs — paste-ready batches (icon-gen flow)

Executable brief pack for the icon-gen Chrome flow. Targets + inventory:
`docs/great-hunger-art-manifest.md`. Flow constraints: the Chrome connector
**cannot upload files** — the user drags refs into ChatGPT manually; downloads
ARE automatable (image viewer → top-right download); free tier caps ~3–5
images/day — stop on the limit message and resume next day; **always show every
generated image to the user before slicing**.

## 0. Refs to stage (once)

Copy these into `~/Desktop/ttp-refs/s2/` so they're drag-ready:

```
cp assets/images/hats/golden_truffle.png   ~/Desktop/ttp-refs/s2/
cp assets/images/hats/muddy_cap.png        ~/Desktop/ttp-refs/s2/
cp assets/images/hats/slop_bucket.png      ~/Desktop/ttp-refs/s2/
cp assets/images/glyphs/crown.png          ~/Desktop/ttp-refs/s2/
cp assets/images/glyphs/barn.png           ~/Desktop/ttp-refs/s2/
cp assets/images/glyphs/bell.png           ~/Desktop/ttp-refs/s2/
cp assets/images/backgrounds/golden_mire_bg.png ~/Desktop/ttp-refs/s2/
cp assets/images/backgrounds/bog_dusk_bg.png    ~/Desktop/ttp-refs/s2/
cp assets/concepts/great-hungerer/great_hungerer_boss_LOCKED.png ~/Desktop/ttp-refs/s2/
cp assets/images/sprites/rosie/idle_1.png  ~/Desktop/ttp-refs/s2/
```

Per-batch drag list is given on each batch below. Refs clear between prompts in
some ChatGPT modes — re-drag per batch, not per conversation.

## 1. The two style anchors (paste ONE at the top of each batch)

**ANCHOR ①: ITEM-STICKER** *(for Sheets A, E — item/collectible art)*

> Match the attached game item sprites EXACTLY: soft, glossy, hand-illustrated
> kawaii cartoon; chunky rounded forms; soft cel-plus-gradient shading with
> gentle highlights; thick warm dark-brown ink outline; a clean white sticker
> border around each object; fully transparent background. Warm
> cream-gold-pastel palette. Cozy and gently comedic, never gritty or
> photoreal. Each object must read clearly at 40 pixels — bold silhouette
> first, detail second.
>
> *Glyph variant (Sheets B, C, D):* same hand and palette but single-weight
> hand-inked line art, NO white sticker border; tiles/stamps/glyphs, not
> stickers.

**ANCHOR ②: SCENE** *(for Batches 5, 6, 7 — vignettes and dressing)*

> Match the attached background paintings EXACTLY: warm painterly
> children's-storybook illustration, golden-hour bog and mire light, soft
> edges, glowing golden sparkle-motes. Cozy, whimsical, gently comedic — never
> scary or photoreal. NOT flat-sticker, NOT gouache, NOT felt.

## 2. Batches (run in order; P1 first)

### Batch 1 — Sheet A: Patch items *(P1 · anchor ① · drag: golden_truffle.png, muddy_cap.png)*

> Using the style anchor above, draw ONE image: a 4-column × 2-row sprite sheet
> on a fully transparent background, equal cells, generous spacing, no labels.
> Cell 1: a knobbly round brown forest truffle, earthy and appetizing. Cell 2:
> a dull grey-brown stone lump, plain and boring. Cell 3: a single worn old
> leather boot, comically oversized. Cell 4: a crumpled shiny snack wrapper,
> giant-sized. Cell 5: a small drawstring burlap pouch, open at the top, with
> two golden truffles peeking out. Cell 6: a rustic wooden feeding trough,
> side view, heaped with glowing golden truffles. Cell 7: a radial golden
> sparkle burst, star-shaped shine. Cell 8: the same truffle as cell 1 but
> gilded gold and gleaming.

*Process:* download → verify transparency → `scripts/slice_sheet.py` →
`assets/images/mudwar/patch/{truffle,stone,junk_boot,junk_wrapper,pouch,trough,gild_burst,truffle_golden}.png`
(only keep cell 8 if the existing `hats/golden_truffle.png` reads wrong at 40 px).

### Batch 2 — Sheet B: mud tiles *(P1 · anchor ① glyph variant · drag: muddy_cap.png, golden_mire_bg.png)*

> Using the glyph variant of the style anchor, draw ONE image: a 3-column ×
> 1-row sheet of three square mud-texture tiles, edge to edge within each cell.
> Tile 1: deep dark wet bog mud, rich and heavy. Tile 2: the same mud one
> shade lighter, a few small root flecks. Tile 3: thin pale drying mud,
> almost scraped through, subtle and low-contrast at the center. Hand-painted
> texture, warm browns, no objects, no borders between… each tile must still
> read as distinct shades when shrunk to 52 pixels.

*Process:* slice → `assets/images/mudwar/patch/tile_{deep,mid,thin}.png` (opaque squares).

### Batch 3 — Sheet C: fort stamps *(P2 · anchor ① glyph variant · drag: crown.png, barn.png)*

> Using the glyph variant of the style anchor, draw ONE image: a 3-column ×
> 2-row sheet of six hand-inked stamp illustrations, single ink weight,
> transparent background, no sticker border — like rubber-stamp prints. In
> order: 1 an empty muddy lot with survey pegs; 2 a low wooden fence ring;
> 3 a packed-mud wall; 4 the wall with rough ramparts on top; 5 a gated
> mud fort; 6 the finished fort flying a little pennant flag. Same fort,
> growing across the six stamps, same viewing angle.

*Process:* slice → `assets/images/mudwar/fort/stamp_{1..6}.png`.

### Batch 4 — Sheet D: Bog Weather glyphs *(P2 · anchor ① glyph variant · drag: bell.png, crown.png)*

> Using the glyph variant of the style anchor, draw ONE image: a 3-column ×
> 2-row sheet of six small hand-inked weather glyphs, transparent background.
> 1: a rain cloud dripping heavy mud drops. 2: an open bucket with lids
> flying off, one extra ball of mud popping out. 3: a tiny songbird perched,
> singing two hand-drawn notes. 4: a soft rolling fog bank. 5: a single
> bold music note with a small echo note behind it. 6: a smiling calm sun
> over a reed. Bold, readable at 24 pixels.

*Process:* slice → `assets/images/mudwar/weather/{deep_mud,loose_lids,songbird_gift,thick_fog,echo_verse,fair_skies}.png`.

### Batch 5 — the hoard mountain *(P3 · anchor ② · drag: golden_mire_bg.png, great_hungerer_boss_LOCKED.png)*

> Using the scene anchor, draw ONE image on a transparent background: a great
> hoarded mountain of brown forest truffles and glowing golden joy-motes,
> heaped like a dragon's treasure pile in a dark bog clearing, warm gold light
> spilling from within, fireflies around it. No characters — just the hoard.
> Storybook-painterly, cozy-ominous, never scary.

*Process:* → `assets/images/mudwar/boss/hoard_full.png`; shrink states
(`hoard_{80..05}.png`) + distant silhouette (`hoard_far.png`) derive by script.

### Batch 6 — Personal Stash dressing *(P1-optional · anchor ② · drag: bog_dusk_bg.png, golden_truffle.png)*

> Using the scene anchor, draw ONE wide framing illustration, transparent
> center: an ornate dug-earth alcove seen straight on — root-woven walls,
> hanging fireflies, small piles of golden truffles tucked in the corners —
> framing an empty rectangular space in the middle where a game board will
> sit. Rich, gilded, "his private pantry" energy.

*Process:* → `assets/images/mudwar/patch/stash_frame.png`. Skippable for v1
(gilded tint fallback).

### Batch 7 — Truffle Exchange *(P4 · anchor ② · drag: golden_mire_bg.png, slop_bucket.png)*

> Using the scene anchor, draw ONE image: a cozy wooden market stall in a
> sunny bog clearing — a hand-painted "exchange" shelf board with small
> shelves, golden truffles in weighing pans, reeds and cattails around, warm
> morning light. Leave the shelf faces plain (items render on top in-game). No
> text anywhere.

*Process:* crop banner (1200×500 → `assets/images/mudwar/exchange/banner.png`)
+ shelf strip (1024×256 transparent → `…/exchange/shelf.png`).

### Batch 8 — Sheet E: commemoratives + finale *(P4 · anchor ① · drag: golden_truffle.png, crew_pennant if desired)*

> Using the style anchor, draw ONE image: a 3-column × 2-row sprite sheet of
> six collectible tokens on a transparent background, each with the white
> sticker border. 1: a bronze snout-print medal on a mud-brown ribbon. 2: a
> silver acorn charm. 3: a gold reed-wreath pin. 4: a rose-gold trough
> pendant. 5: a tiny crystal jar holding one glowing golden mote. 6: a
> radiant golden crown-and-truffle trophy, the grandest of the set.

*Process:* slice → `assets/images/hats/commem_stage{1..5}.png` +
`assets/images/hats/famished_finale.png`.

## 3. Session checklist

1. Stage refs (§0) → open ChatGPT → drag the batch's refs → paste anchor →
   wait for "ready" → paste the batch prompt.
2. Download each render via the viewer; verify distinct byte sizes; **show the
   user every image**.
3. Transparency check → `scripts/slice_sheet.py` → move to manifest target
   paths → `scripts/optimize_assets.py` pass.
4. Rejections: record the reason (the studio's reject-with-reason flow) and
   re-prompt with one corrective line, not a rewrite.

Cross-refs: `docs/great-hunger-art-manifest.md` ·
`docs/wiki/outputs/memos/mudwar-dig-minigame-2026-07.md` ·
`mudwar-hunger-arc-cadence-2026-07.md` · `mudwar-rewards-spec-2026-07.md` ·
`docs/great-hunger-opening-production.md` (the cinematic's separate prompt pack).

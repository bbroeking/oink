# Trade-Themed Icons — ChatGPT Generation Brief

12 new trade-themed cosmetic items, generated in 3 sheets of 4 items each (1024×256 transparent strips). Designed to be unlocked as rewards in the Trade Masters achievement ladder.

## Workflow

1. Fresh ChatGPT conversation. Attach the references below as a single drag (Cmd+A in Finder, drag into the input):
   - `idle_1.png` … `idle_4.png` — new Rosie idle frames (art style of the pig the items will sit on)
   - `wizard.png` — example "hat" accessory (existing pipeline style)
   - `magic_wand.png` — example "held" accessory (existing pipeline style)
2. Paste the **Style anchor** prompt below once at the top of the conversation.
3. Paste **Batch 1**, save the result. Repeat for Batch 2 and Batch 3.
4. Slice each strip into 4 PNGs. Save to `assets/images/hats/<id>.png` using the IDs in the prompts.
5. Run `python3 scripts/compute_overlays.py` to regenerate `constants/hat_overlays.generated.ts`.
6. Add achievement rewards pointing at the new item IDs in `supabase/migrations/<next>_trade_items.sql`.

Reference staging folder: `~/Desktop/ttp-refs/`

---

## Style anchor (paste once)

```
I'm going to ask you to generate sprite-sheet images of cosmetic
accessory items for a 2D mobile game. NO characters, NO pigs, NO
people — only the items themselves.

I'm attaching reference images:
- idle_1..idle_4: the pig these items will sit on (match its art style)
- wizard.png and magic_wand.png: existing accessories in the same
  game (match THIS exact accessory style — bold outlines, flat
  shading, transparent background)

Style for every accessory image (STRICT):
- Flat children's storybook illustration with bold ~3px black outline
- Flat painted cel-shading only — NO 3D rendering, NO metallic
  gradients, NO photorealistic reflections, NO glossy highlights
- Soft saturated colors, clean palette per item
- Simple shapes, very readable at small sizes (this is a mobile game)
- No drop shadows, no glow effects (unless the item itself is an aura)
- Pure transparent background — nothing behind the item

Silhouette rules (CRITICAL — items must lie flat on a pig sprite):
- Each item is a PURE 2D PAPER CUTOUT viewed straight from the front
- The silhouette is ONLY what you'd see from directly in front
- NO back-of-brim, NO back-of-band, NO underside, NO inner lining
- NO opening or cavity at the bottom where a head would go
- Bottom edges are SOLID PAINTED EDGES — never an opening showing
  the inside of the hat
- Bands and trim are visible only on the front-facing portion;
  where they would wrap behind, they simply end at the silhouette edge
- Think: a sticker glued to a flat surface, not a 3D-rendered object

Layout: 4-cell horizontal strip. Items evenly spaced in a clean 4×1
row, each centered in its imaginary cell, padding on left and right
edges so nothing is cropped. ChatGPT will likely produce a 1536×1024
canvas regardless — that's fine, as long as the 4 items are in a
neat horizontal row with consistent gaps and no edge-cropping.

Confirm you understand the references and the style, then I'll send
the first batch.
```

---

## Batch 1 of 3 — Trade Hats (1024×256, transparent)

```
TRADE BATCH 1: a 4-cell strip with these hats, in this order.
RENDERING RULES (CRITICAL):
- Flat 2D front view, as if pressed against the camera.
- NO back-of-brim showing behind the head. NO wrap-around band
  that loops behind the head. Paper-cutout silhouette only.
- Brims are a front-facing arc only — never a full ellipse.
- No head, no face, no body — just the hat.

1. merchant_cap — soft burgundy velvet cap with a single gold coin
   pinned to the front, slightly slouched silhouette
2. captain_hat — navy blue peaked officer's cap with gold rope braid
   on the brim and a small gold anchor emblem on the front
3. tricorn_hat — black pirate tricorn, three points clearly visible,
   gold trim along the edges, a small red feather tucked into one side
4. crown_of_coins — small gold circlet built entirely from
   overlapping coin discs, no gems, no velvet liner (front arc only)

Transparent background. Strict rules (repeat): flat 2D paper-cutout silhouette, no back-of-brim, no underside, no inner cavity, solid painted bottom edges. Items in a clean 4×1 row with side padding.
```

## Batch 2 of 3 — Trade Held Items (1024×256, transparent)

```
TRADE BATCH 2: a 4-cell strip with these held items, in this order.
RENDERING RULES (CRITICAL):
- Items shown flat front-on, NOT in a hand. NO pig, NO arm, NO head.
- Each item centered in its 256×256 cell.

1. coin_pouch — brown drawstring leather pouch, bulging, with three
   gold coins spilling from the top
2. gold_scale — small two-pan balance scale in gold, both pans level,
   one pan holding a single gold coin
3. spyglass — brass collapsible telescope, partially extended,
   leather grip in the middle
4. treasure_chest — small wooden chest with gold bands, lid open,
   gold coins and a few gems visible inside

Transparent background. Strict rules (repeat): flat 2D paper-cutout silhouette, no back-of-brim, no underside, no inner cavity, solid painted bottom edges. Items in a clean 4×1 row with side padding.
```

## Batch 3 of 3 — Trade Held Items + Accent (1024×256, transparent)

```
TRADE BATCH 3: a 4-cell strip with these items, in this order.
SAME rules as Batch 2: flat front, no hand, no pig.

1. quill_ledger — a small open ledger book with handwritten entries,
   a white feather quill resting diagonally across the page,
   ink pot in the corner
2. ships_wheel — wooden ship's steering wheel, eight spokes,
   brass center hub, front-facing flat view (not perspective)
3. bag_of_pearls — small velvet pouch in deep purple with three
   white pearls spilling out the top (different color from
   coin_pouch — purple not brown, pearls not coins)
4. merchant_sash — diagonal cloth sash in deep red with gold trim
   and a gold coin medallion at the lower hip — render as a
   floating sash shape, NOT on a body, paper-cutout style

Transparent background. Strict rules (repeat): flat 2D paper-cutout silhouette, no back-of-brim, no underside, no inner cavity, solid painted bottom edges. Items in a clean 4×1 row with side padding.
```

---

## Item ID → Achievement reward mapping

When PNGs land in `assets/images/hats/`, wire each as the `reward_item_id` for the corresponding Trade Masters tier:

| Item ID         | Category | Reward for                          |
|-----------------|----------|-------------------------------------|
| merchant_cap    | hat      | trade_giver tier 1 (Open Hoof)      |
| captain_hat     | hat      | trade_giver tier 2 (Snout Saint)    |
| tricorn_hat     | hat      | trade_giver tier 3 (Bacon Bountiful)|
| crown_of_coins  | hat      | trade_giver tier 4 (Hog of Hearts)  |
| coin_pouch      | held     | trade_receiver tier 1 (Hungry Hog)  |
| gold_scale      | held     | trade_receiver tier 2 (Trough Sniffer) |
| spyglass        | held     | tbd                                 |
| treasure_chest  | held     | trade_receiver tier 4 (Glutton King)|
| quill_ledger    | held     | tbd                                 |
| ships_wheel     | held     | tbd                                 |
| bag_of_pearls   | held     | trade_receiver tier 3 (Bottomless)  |
| merchant_sash   | scarf    | tbd (Phase 2 quests reward)         |

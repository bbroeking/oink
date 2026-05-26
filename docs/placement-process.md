# Item Placement Process

How to add new cosmetic items to TTP and place them correctly on Rosie. This is the **canonical workflow**; `tools/item-anchor.html` is the **only** placement tool — the old in-app `/item-anchor` route was deleted in favor of consolidation.

---

## Architecture in one paragraph

Every cosmetic item in the catalog needs three pieces of data: a **PNG file**, a **HAT_IMAGES registration**, and a **placement spec**. The PNG lives in `assets/images/hats/<id>.png`. The registration in `constants/hats.ts` makes the bundler require it. The placement spec lives in either `HAT_OVERLAYS_GENERATED` (auto-computed pixel coordinates from the PNG's aspect ratio + category) or `HAT_REL_DATA` (a hand-tuned `RelSpec` of `pivot`, `widthFrac`, `anchor`). Items in `HAT_REL_DATA` override `HAT_OVERLAYS_GENERATED` — use auto for fast iteration, hand-tune when the auto math doesn't read right.

---

## Step-by-step (single new item)

### 1. Get the artwork

Generate via ChatGPT image-gen using the patterns in `docs/openai-accessory-prompts.md` (or the missing-artwork doc `docs/openai-missing-artwork.md` for batches). The output you want is a **256×256 PNG on transparent background**, drawn as a flat front-view paper cutout with a ~3px black outline, matching Rosie's storybook palette.

If ChatGPT returns a wider strip (it sometimes outputs 1536×1024 regardless of your size request), slice + center each item into its own 256×256 PNG with PIL — see the `slice_strip` function in any prior PNG-drop commit (`8ff7099`).

### 2. Drop the PNG

```
assets/images/hats/<id>.png
```

The `<id>` must match the `id` column in the catalog SQL row that references this item. Convention is `snake_case`.

### 3. Register in HAT_IMAGES

Add a line near the bottom of `constants/hats.ts` (inside the `HAT_IMAGES` const, before the closing `};`):

```ts
<id>: require("../assets/images/hats/<id>.png"),
```

If the new item is part of a deliberate batch, add a `// Batch N — short context` comment above the group (see existing batches for the convention).

### 4. Run the auto-overlay computer

```bash
python3 scripts/compute_overlays.py
```

This regenerates `constants/hat_overlays.generated.ts`. The script reads every PNG in `assets/images/hats/`, looks up its category from the shop_catalog migration, and computes a `{ bottom, left, width, height }` rect tuned to the category's anchor (e.g. `hat` anchors at top-of-head, `glasses` straddle the eye line, `necklace` hangs from the neck).

**If the script logs `skipped N (not in catalog)`** for your new item, edit `parse_catalog()` near the bottom to add an explicit `items.setdefault("<id>", "<category>")` entry. This happens for items added in later migrations than `20260502030000_shop_catalog.sql`.

### 5. Eyeball the auto placement

Start the placement tool to see how it looks on Rosie:

```bash
# From repo root:
python3 -m http.server 8765 > /tmp/anchor_server.log 2>&1 &
open http://localhost:8765/tools/item-anchor.html
```

Pick the new item from the grid. The right-side preview shows it composited on Rosie using whatever is in `HAT_OVERLAYS_GENERATED`. If it looks right, skip to step 7.

### 6. Hand-tune via the tool

If the auto placement is off — wrong size, wrong anchor, mis-aligned pivot — fine-tune it:

1. **Click on the item canvas** (left panel) to set the **pivot** — the attach point on the item itself. Convention:
   - Hat / cap → bottom-center (`x: 0.5, y: 1`)
   - Mask / glasses → middle (`x: 0.5, y: 0.5`)
   - Necklace → top-center (`x: 0.5, y: 0`)
2. **Click an anchor dot on the pig** (right panel) to set the **anchor** — the point on Rosie's anatomy where the pivot will land.
3. **Drag the width slider** to set **widthFrac** — the item's width as a fraction of the 300px pig canvas. 0.4 is the default; large items (full hat, gas mask) go higher.
4. The preview updates live.

When it looks right, click **Copy RelSpec line for HAT_REL**. The output is in the exact format used in `constants/hat_rel.generated.ts`:

```ts
astronaut: { pivot: { x: 0.485, y: 0.2479 }, widthFrac: 1, anchor: "head", behind: false },
```

### 7. Paste into HAT_REL_DATA

Open `constants/hat_rel.generated.ts` and paste the line **in alphabetical order** between sibling entries. Items in `HAT_REL_DATA` automatically override the auto-computed overlays for the same id.

### 8. Verify

```bash
npx tsc --noEmit          # types compile
npx jest --testPathIgnorePatterns="worktrees"  # tests still green
```

Then visually verify by reloading the tool tab (the preview reads the same `HAT_REL_DATA` indirectly through the source).

### 9. Stop the server

```bash
kill $(lsof -ti:8765) 2>/dev/null
```

### 10. Commit

```bash
git add assets/images/hats/<id>.png constants/hats.ts \
        constants/hat_overlays.generated.ts \
        constants/hat_rel.generated.ts
git commit -m "Placement — <id>"
```

---

## Adding many items at once

For batch drops, the workflow is the same per-item but you can amortize:

1. Drop **all** PNGs into `assets/images/hats/`.
2. Add **all** lines to `HAT_IMAGES` under a single `// Batch N` comment block.
3. Run `compute_overlays.py` **once** at the end — all new items get auto overlays in one pass.
4. Update the `ITEMS` array at the top of `tools/item-anchor.html` to include the new ids (with their PNG paths). They appear in the picker grid.
5. Hand-tune in the tool one item at a time.
6. Paste each `RelSpec` line into `HAT_REL_DATA`, **keeping alphabetical order**.

---

## Categories + anchors reference

The anchors on Rosie (300×300 card space, from `REST_ANCHORS` in `constants/hats.ts`):

| Anchor | Use for | Position |
|---|---|---|
| `head` | hats, ears, helmets, crowns | top of head |
| `eyes` | glasses, masks (between the eyes) | mid-face |
| `eye_l` / `eye_r` | single-eye accessories (e.g. monocle) | left/right pupil |
| `snout` | nose-mounted | snout center |
| `mouth` | pacifier, lollipop | mouth center |
| `neck` | necklaces, scarves, collars | upper chest |
| `body` | full-body items (auras) | torso center |
| `hand_l` / `hand_r` | held items | left/right hand |
| `leg_l` / `leg_r` / `feet` | leg / foot accessories | lower body |

Auto-overlay category defaults (from `scripts/compute_overlays.py`, CATEGORY dict):

- `hat`: width 160, anchor at top-of-head, pivot bottom-center.
- `glasses`: width 216, anchor mid-face, pivot center.
- `mask`: width 160, anchor mid-face, pivot center.
- `bow`: width 80, anchor top-of-head, pivot bottom-center.
- `scarf`: width 180, anchor neck, pivot top-center.
- `necklace`: width 140, anchor neck, pivot top-center.
- `cape`: width 240, anchor shoulders, pivot top-center.
- `held`: width 80, anchor right hand, pivot center.
- `aura`: full canvas.

If the new item doesn't fit any of these, add a new category in both the migration's `category` column AND the `CATEGORY` dict in `compute_overlays.py`.

---

## Anti-patterns to avoid

- **Don't render items that wrap around the body in 3D.** Necklaces (full loop), capes that drape behind, headphones with a band behind the head — all break the 2D-front pig silhouette. Either render as a flat front-only paper cutout (viking-helmet trick: just the front rim with open visor) or drop the item entirely.

- **Don't put the pig in the PNG.** Items should render alone on transparent background — no body, no head, no face. The pig comes from the runtime; the item is the cosmetic overlay.

- **Don't skip the auto-overlay step.** Even if you plan to hand-tune via the tool, run `compute_overlays.py` first — it gives you a usable starting position and catches "not in catalog" warnings.

- **Don't edit `hat_overlays.generated.ts` by hand.** It's regenerated every time `compute_overlays.py` runs. Hand-edits live in `HAT_REL_DATA` (which overrides) or as a manual entry in `HAT_OVERLAYS` (the spread above generated, in `constants/hats.ts`).

---

## File map

| File | Purpose |
|---|---|
| `assets/images/hats/<id>.png` | The artwork. |
| `constants/hats.ts` → `HAT_IMAGES` | RN bundler require() registration. |
| `scripts/compute_overlays.py` | Auto-computes overlay rects from PNG aspect + category. Outputs `hat_overlays.generated.ts`. |
| `constants/hat_overlays.generated.ts` | Auto-generated overlay rects. **Do not hand-edit.** |
| `constants/hat_rel.generated.ts` → `HAT_REL_DATA` | Hand-tuned RelSpecs from the placement tool. Overrides the auto overlays. |
| `tools/item-anchor.html` | The placement tool. Run via `python3 -m http.server 8765`. |
| `docs/openai-accessory-prompts.md` | Style anchor + per-batch prompts for ChatGPT image gen. |
| `docs/openai-missing-artwork.md` | Same, for the 6 catalog-gap items shipped this session. |
| `supabase/migrations/20260502030000_shop_catalog.sql` | Source-of-truth catalog rows (id + category + rarity + cost). |

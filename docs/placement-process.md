# Item Placement Process

How cosmetic items get placed on Rosie. The **Placement Studio**
(`tools/placement_studio.py`) is the single tool; it replaced the old
`item-anchor.html` / `item-anchor/` / `anchor-editor/` tools.

---

## Architecture in one paragraph

Every cosmetic needs a **PNG** (`assets/images/hats/<id>.png`), a **HAT_IMAGES
registration** (so the bundler `require()`s it — members art is auto-wired via
`scripts/gen_members_catalog.js`), and a **placement spec**. The canonical spec
is a **`RelSpec`** (`pivot`, `widthFrac`, `anchor`, `behind`) — fraction-based so
it scales across screen sizes. RelSpecs live in `constants/hat_rel.generated.ts`
(written by the studio) and `constants/membersRel.generated.ts` (category
defaults for members items). `resolveSlot` (in `components/ui/PigStage.tsx`) uses
the RelSpec whenever one exists; an item's pivot point lands on its pig anchor,
sized to `widthFrac × 300`. The **legacy** `HAT_OVERLAYS` path (absolute
`bottom/left/width/height`) now only serves the handful of items that don't yet
have a RelSpec — including an aura until it is deliberately tuned — see
"Legacy" below.

---

## Place an item (or fix a misfit)

1. **Start the studio**

   ```bash
   python3 tools/placement_studio.py
   open http://127.0.0.1:8124/
   ```

2. **Pick the item** in the left rail. Every item is listed automatically
   (incl. all members cosmetics). Filter chip **Untuned** shows exactly the items
   relying on a category-default or legacy placement. Status dot: green = hand
   tuned, gold = members category-default, grey = none. Use **Auras** to pull up
   the aura-only placement queue.

3. **Tune** in the right panel:
   - **Pivot** — drag the red marker on the item thumbnail (the attach point on
     the item: hats → bottom-center, glasses/masks → center, held → grip).
   - **Anchor** — click a blue dot on the pig (head, eyes, hand_r, …).
   - **Width** — slider (`widthFrac`, the item's width as a fraction of the
     300px canvas).
   - **Render behind** — for items that sit behind the pig (on by default for
     auras).
   The on-pig preview updates live and matches the app exactly.

4. **It autosaves** to `constants/hat_rel.generated.ts` (full rebuild, sorted).
   Metro hot-reloads it. Use **Next untuned →** to walk the backlog.

## Edit the pig's anatomy anchors

Switch to **Pig anatomy** mode. Drag the 11 body anchors for the selected
animation + frame (onion-skin toggle to check across frames). Autosaves
`PIG_FRAME_ANCHORS` in `constants/hats.ts` **and** keeps `REST_ANCHORS` in sync
with `idle[0]` — no manual copy step. `eyes`/`feet` are computed midpoints and
aren't directly editable.

---

## Legacy `HAT_OVERLAYS` (being retired)

`scripts/compute_overlays.py` generates `constants/hat_overlays.generated.ts`,
but now **only for items without a RelSpec** (fixed-canvas backgrounds and
tickle_particle are skipped; any item with a RelSpec is skipped because RelSpec
wins in `resolveSlot`). Untuned auras keep their category fallback; tuning one
gives it a RelSpec. This file is the shrinking legacy backlog — tune each item
in the studio and it drops out on the next `compute_overlays.py` run. `tophat`
keeps a manual entry in `constants/hats.ts` until it's tuned.

```bash
python3 scripts/compute_overlays.py   # regenerate after tuning legacy items
```

---

## Categories + anchors reference

Anchors on Rosie (300×300 card space, `REST_ANCHORS` in `constants/hats.ts`):

| Anchor | Use for |
|---|---|
| `head` | hats, bows, helmets, crowns |
| `eyes` / `eye_l` / `eye_r` | glasses, masks; single-eye (monocle) |
| `snout` / `mouth` | nose/mouth-mounted |
| `neck` | scarves, collars |
| `body` | full-body / aura |
| `hand_l` / `hand_r` | held items |
| `leg_l` / `leg_r` / `feet` | leg/foot accessories |

`CATEGORY_ANCHORS` / `CATEGORY_PIVOTS` in `constants/hats.ts` give the per-
category defaults the studio seeds from.

---

## Anti-patterns

- **No 3D wrap-around** (full-loop necklaces, draping capes, headphone bands) —
  they break the 2D-front silhouette. Render flat front-only or drop the item.
- **No pig in the PNG** — items render alone on transparent background; the pig
  comes from the runtime.
- **Don't hand-edit the generated files** (`hat_rel.generated.ts`,
  `hat_overlays.generated.ts`, `membersRel.generated.ts`) — the studio and
  scripts own them.

---

## File map

| File | Purpose |
|---|---|
| `tools/placement_studio.py` / `.html` | The placement tool (items + pig anatomy). |
| `assets/images/hats/<id>.png` | The artwork. |
| `constants/hats.ts` | `HAT_IMAGES`, `REST_ANCHORS`, `PIG_FRAME_ANCHORS`, category defaults, `resolveSlot` data. |
| `constants/hat_rel.generated.ts` | Hand-tuned RelSpecs (studio writes these). |
| `constants/membersRel.generated.ts` | Members category-default RelSpecs. |
| `constants/hat_overlays.generated.ts` | Legacy overlays — only items without a RelSpec. **Do not hand-edit.** |
| `scripts/compute_overlays.py` | Regenerates the legacy overlay file. |
| `scripts/pig_preview.py` | Bakes on-pig preview PNGs for the review gallery. |

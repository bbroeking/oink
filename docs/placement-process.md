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
sized to `widthFrac × 300`. An item without a RelSpec — an aura until it is
deliberately tuned — renders from its category preset; see "Items without a
RelSpec" below. A RelSpec may also carry a **per-pose override** (`perAnim`) —
see "Per-pose overrides" below.

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
   The on-pig preview updates live and matches the app exactly — same anchors,
   same side sprite on the turn, same eye shift, same head tilt (see "What the
   preview mirrors").

4. **It autosaves** to `constants/hat_rel.generated.ts` (full rebuild, sorted).
   Metro hot-reloads it. Use **Next untuned →** to walk the backlog, or
   **Next in list →** to walk the filtered list you're looking at.

### The pose bar

Above the pig: **Pose** (every family in `PigAnimationKey` — `idle`, `walk`,
`jump`, `happy`, `sad`, `tired`, `surprise`, `wave`, `face`, `face_sit`),
**Pig** (rosie, copper, pepper, bandit, pickles, biscuit — *preview only*;
anchors are shared by every pig), the frame buttons for that pose (idle has
**12**), ▶ to play, and the per-pose render **Scale**.

Anchor arrays are 4 frames long even where the sprite has more; the app clamps
a frame index past the array to the last frame, and so does the studio. Frame 5
of idle therefore shows frame 4's anchors — that is what ships.

### What the preview mirrors

One function (`layoutItem`) draws the stage and the Sheet, and it is a direct
port of `resolveSlot`:

- **Side sprites.** On `face` / `face_sit` an item with
  `assets/images/hats/side/<id>.png` is drawn with that sprite and its own
  aspect. A small tag under the stage says *front sprite* / *side sprite*.
- **Eye shift.** An item anchored exactly on `eyes` sits back `TURNED_EYE_SHIFT`
  (16 canvas px) on the turn so its bridge lands over the nose.
- **Head tilt + apparent scale.** `resolveWearablePose`: head/face anchors take
  the eye-line angle delta as a rotation and the eye-distance ratio as a scale
  (clamped 0.72–1.18); on the turn a non-eye anchor keeps scale 1 — the head
  turned, it didn't shrink.

## Per-pose overrides

One RelSpec normally serves every pose. Two cases break that:

- a **side sprite** is a different silhouette, so it often wants its own pivot
  and width on the turn;
- a **one-eyed item** (monocle, lorgnette, signet crest) lands on the far eye
  when the head turns and needs the near one.

For those, the studio writes `perAnim` — a complete copy of the spec, scoped to
one animation family, merged shallowly over the base at render time. **The base
spec stays the front truth**; removing the override always returns the item to
it.

In the panel, under the sliders:

1. On the pose you want to fix, press **Override for `<pose>`**. The header
   turns gold and reads *Editing override: `<pose>`* — from here every edit
   (dragging on the pig, the pivot marker, the sliders, an anchor dot, the
   behind toggle) writes to that pose only.
2. Tune it.
3. Press **Copy to…** with `face_sit` selected. The seated turn is the same
   camera as the standing one, so the standing fix is nearly always the seated
   fix too. (Nothing copies automatically — poses stay independent.)
4. **Remove override** drops it.

Poses that carry an override show as gold chips under the item name; click one
to jump the scrubber there. The list badges an item `±N poses`, and the filter
chip **Overridden** collects them all (**Side art** collects items with a side
sprite).

The render-only variants resolve through `pigAnchorAnimation`: `sit` reads
`happy`'s override, `bounce` reads `jump`'s. There is no `sit` or `bounce` row
to write.

## The Sheet tab

A contact sheet of every item on the pig at one pose/frame/pig, drawn with the
same `layoutItem` — the surface for reviewing a whole queue after a batch of
side sprites lands. Same search and filter chips as the Items rail; click a cell
to jump to that item in Items mode at the same pose, frame and pig.

Cells draw the 300 card at 82% with the headroom **above** and no clipping: a
hat on the turn rides above the canvas top, and the first pass of the
2026-09-15 angle audit reported every hat as "squashed" purely because its cells
clipped to the canvas box. A review surface must show the whole stage.

## Edit the pig's anatomy anchors

Switch to **Pig anatomy** mode. Drag the 11 body anchors for the selected
animation + frame (onion-skin toggle to check across frames). Autosaves
`PIG_FRAME_ANCHORS` in `constants/hats.ts` **and** keeps `REST_ANCHORS` in sync
with `idle[0]` — no manual copy step. `eyes`/`feet` are computed midpoints and
aren't directly editable. The **Pig** picker here is preview only, same as in
Items mode — the anchors are shared by every pig.

Frame buttons cover the **sprite** count, so idle offers 12 while its anchor
array holds 4. A frame past the array is dimmed and the panel says *"no anchors
of its own — clamped from frame N"*; it draws the clamped anchors, exactly like
the app. Dragging a dot there materialises the array up to that index, filling
the gap with copies of the last authored frame — nothing moves except what you
drag. Match-prev, Freeze, Scale ±, Pin and ⇉ all then operate over the new
length.

## Auto rig

`scripts/auto_rig.py` proposes a whole anchor rig from the sprites and writes it
to `docs/rig-candidate.json` (every `PigAnimationKey`, one entry per **sprite**
frame — idle has 12 — plus a per-anchor confidence of `detected` / `derived` /
`prior`):

```bash
.venv-tools/bin/python scripts/auto_rig.py
```

The studio reads that file on every request and **never applies it**. Nothing
changes until you accept a scope by hand.

**Compare.** In **Pig anatomy**, press **Auto rig: off** to flip it to *show*.
The candidate draws as orange dots with a white ring beside the green live
anchors, with a thin orange line from each green dot to its orange partner so
the delta reads at a glance. The orange dots are not draggable. A caption under
the toolbar names the run: *auto rig from `<source>` · `<generatedAt>`*.

**Accept, smallest scope first.**

| Control | Scope |
|---|---|
| **← auto** (per anchor row) | that one anchor, this frame |
| **Accept auto: this frame** | all 11 anchors, this frame |
| **Accept auto: this animation** | every frame of this animation |
| **Accept auto: all animations** | the whole rig |

Each accept materialises the anchor array the same way dragging does (a clamped
frame gets a row of its own first; an animation grows to the candidate's frame
count) and autosaves through the usual `PIG_FRAME_ANCHORS` write. There is no
undo, so **all animations** is a two-step: the button turns into *Really replace
every animation?* and only the second click does it; clicking anywhere else
resets it.

Each anchor row also shows the candidate's value, the delta in px (Δx, Δy) and
its confidence tag, so a `prior` anchor that moved 40px is easy to spot before
accepting it.

**Preview it on the items first.** Items mode's pose bar and the Sheet toolbar
gain a **Rig: current | auto** segmented control (one shared selection — both
tabs agree). On *auto*, the whole preview — `layoutItem`, the head tilt, the
rest eye-line, the anchor dots — resolves from the candidate's frames instead of
the live rig, including idle frames 5–12, which the candidate authors for real
where the live rig clamps. This writes nothing; it answers "would the items
still sit right if I accepted this?" before you do.

---

## Items without a RelSpec

An item the studio hasn't tuned renders from its category preset
(`CATEGORY_OVERLAYS` in `constants/hats.ts`) — that is the only fallback.
The per-item legacy `HAT_OVERLAYS` map, `scripts/compute_overlays.py` and
`constants/hat_overlays.generated.ts` were retired 2026-09-12 once the
generated map was empty; `resolveSlot` is RelSpec → category preset.

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
  `membersRel.generated.ts`) — the studio and scripts own them.

---

## File map

| File | Purpose |
|---|---|
| `tools/placement_studio.py` / `.html` | The placement tool (items + pig anatomy). |
| `assets/images/hats/<id>.png` | The artwork. |
| `constants/hats.ts` | `HAT_IMAGES`, `REST_ANCHORS`, `PIG_FRAME_ANCHORS`, category defaults, `resolveSlot` data. |
| `constants/hat_rel.generated.ts` | Hand-tuned RelSpecs, incl. `perAnim` overrides (studio writes these). |
| `constants/hat_side.generated.ts` | Side sprites for the turned families (`tools/gen_side_items.py` writes it). |
| `constants/membersRel.generated.ts` | Members category-default RelSpecs. |
| `scripts/pig_preview.py` | Bakes on-pig preview PNGs for the review gallery. |
| `scripts/auto_rig.py` | Proposes an anchor rig; writes `docs/rig-candidate.json`. |
| `docs/rig-candidate.json` | The auto-rig candidate the studio compares against (read-only to the studio). |

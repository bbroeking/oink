# Pig anchor editor

Standalone web tool for hand-tuning `PIG_FRAME_ANCHORS` against the sprite
art. Opens every frame of every animation on one page; drag-and-drop the
named anatomy points (head, eyes, snout, etc.) directly on each sprite.

## Run it

Two options — both work.

**Direct (no server):**

```
open /Users/bbroeking/projects/oink/tools/anchor-editor/index.html
```

Chrome will load it via `file://` and the relative sprite paths
(`../../assets/images/sprites/rosie/*.png`) resolve fine.

**Local server (if file:// gives you trouble):**

```bash
cd /Users/bbroeking/projects/oink
npx serve
# then visit http://localhost:3000/tools/anchor-editor/
```

## Workflow

The editor has two modes — toggle via the **Anchors / Items** buttons
in the top bar.

### Anchors mode (default)

1. The editor opens with **all 28 frames** visible — 7 animations × 4
   frames each. The focus area at the top shows whichever frame you
   click.
2. **Drag any anchor dot** to its real position on this pose. Works on
   both the focus canvas (2× zoom) and any thumbnail.
3. **Arrow keys** nudge the selected anchor by 1px (hold shift for 5px).
   Number keys 1–9 select an anchor.
4. Use **Copy from prev frame** to start from the previous frame's
   anchors when poses are similar.
5. Use **Mirror L↔R** with a hand anchor selected to auto-place its
   counterpart at the mirrored x.
6. State **auto-saves to localStorage** — close + reopen the page,
   work is restored.
7. When you're done, **Export TS** opens a dialog with the literal
   ready to paste into `constants/hats.ts` under `PIG_FRAME_ANCHORS`.

### Items mode

For placing a specific item (hat / glasses / cape / background) on each
animation. Edits `HAT_OVERLAYS[id].perAnim` overrides.

1. Toggle to **Items** mode in the top bar.
2. Type an item id (e.g. `wizard`, `monocle`, `pearl_necklace`) into
   the picker — autocomplete shows every known id. Press Enter or tab
   away to load. The item PNG draws on every frame at its current
   position.
3. **Click any thumbnail** to focus that anim — its overlay scope
   becomes the editing target. Idle is special: edits in idle write
   to the **base** overlay (applies to all anims). Edits in any other
   anim create a **perAnim** override. The bounding box turns ORANGE
   when you're editing a perAnim override, PURPLE for base.
4. **Drag the item** on the focus canvas to reposition. **Drag the
   bottom-right corner** to resize. Numeric inputs on the right give
   exact values; arrow keys nudge.
5. **Use base for this anim** deletes the current anim's override so
   it falls back to base. **Copy this anim → all** promotes the
   current anim's overlay to base (and clears all overrides). **Reset
   item** wipes the placement entirely.
6. **Export TS** emits the item's entry ready to paste into
   `HAT_OVERLAYS` in `constants/hats.ts`. Only `perAnim` entries that
   differ from base are emitted.
7. **Import** lets you paste an existing `HAT_OVERLAYS` entry to seed
   the current item.

Item placements auto-save to localStorage independently from anchor
state, so you can iterate on both without conflicts.

## Importing existing data

The editor seeds from the current REST_ANCHORS + the `shiftAll(-7)` /
`shiftAll(-40)` shorthand baked into the current `PIG_FRAME_ANCHORS`.
To start from a different TS literal:

1. Copy the existing `PIG_FRAME_ANCHORS` block from `constants/hats.ts`
2. Click **Import TS** in the editor toolbar
3. Paste → Apply

The parser handles both explicit `{head: {x,y}, eyes: {x,y}, ...}`
frames and `shiftAll(N)` helpers.

## Anchor names

The system has nine named anatomy points. Each item (hat / glasses /
necklace / etc.) is bound to one anchor via `CATEGORY_ANCHORS` in
`constants/hats.ts`:

| Anchor  | Color    | Default category usage |
|---------|----------|------------------------|
| head    | red      | hats, bows             |
| eyes    | orange   | glasses, masks         |
| snout   | yellow   | -                      |
| mouth   | green    | -                      |
| neck    | cyan     | scarves, necklaces     |
| body    | blue     | capes, auras, bg       |
| hand_l  | purple   | -                      |
| hand_r  | pink     | held items             |
| feet    | gray     | -                      |

All positions are in 300×300 card-coord space (y measured from TOP).
The runtime app renders the pig in that space; anchors drive item
positioning.

## What to do with the export

Open `constants/hats.ts`, find the existing `PIG_FRAME_ANCHORS` literal,
replace its body with the pasted one. The TS shape matches exactly.

Save, reload the running app — items should now follow the new anchor
positions per frame.

## Caveats

- The seed assumes the current shift-based `PIG_FRAME_ANCHORS` is the
  starting point. If anchors were heavily customized, import first.
- The editor uses `localStorage` so each browser holds its own state —
  it's not synced across devices. Export when you're done.
- The Mirror L↔R tool assumes the character is symmetric about x=150.
  Disable manually for poses where the pig actually leans (jump
  airborne, wave with arm out).

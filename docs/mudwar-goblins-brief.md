# Mud Wars — Goblin Horde art brief (icon-gen)

Art for the Slop Toss minigame: the Goblin King's horde you pelt with mud, plus
the impact splat. Generated via the ChatGPT icon-gen flow (`/icon-gen
docs/mudwar-goblins-brief.md`). The connector CANNOT upload — drag the reference
images in yourself when prompted. Reuse the SAME flat-2D style the mud-war hats
shipped under (`docs/mudwar-regen-brief.md`).

**Minimum set = Batch 1 + Batch 2 + the splat in Batch 3 (9 sprites).** That
retires every placeholder the player actually looks at (the runner + the splat).
Batch 4 (lane decals) is defer-able polish.

**Workflow after generation:** key the magenta out + slice via
`scripts/slice_mudwar.py` (add a `strip6-goblins-run.png` / `strip7-goblins-hit.png`
to `ITEM_STRIPS`), run `scripts/compute_overlays.py`, then wire each id into
`HAT_IMAGES` and the `ARCHETYPES`/`hitSprite` in `components/mudwar/SlopToss.tsx`.

## Style anchor (paste once)

```
You are drawing flat 2D storybook game sprites for a cozy mobile game called
Tickle the Pig. Critical style rules, follow EXACTLY:
- PURE 2D PAPER CUTOUT viewed straight from the SIDE. Think a sticker glued to a
  flat surface — NOT a 3D-rendered object.
- Bold hand-inked OUTLINE in near-black (#2a1f15). Soft SINGLE-TONE cel shading
  only. NO 3D shading, NO gradients, NO metallic, NO glossy highlights, NO drop
  shadows, NO photoreal texture, NO ambient occlusion.
- Each subject on a FLAT MAGENTA background, exactly #ff00ff, edge to edge, no
  vignette (we key it out). One subject per cell.
- Output the set as a horizontal ROW of separate subjects, evenly spaced, all the
  same baseline, generous empty margin around each (we bbox-crop per subject).
- NO text, NO labels, NO emoji, NO logos.

The villains are the GOBLIN KING'S HORDE: charming-menacing bog-imps — round,
big-eyed, mud-daubed, comic. Grumpy garden-gnome / storybook imp energy. NEVER
scary: NO fangs, NO blood, NO menace, NO red glowing eyes. They are a thieving
green rabble of mud-tracking pests the player shoos away with slop at a village
mud-derby. Palette: pickle/olive greens, ink outline, with each type's ONE warm
accent. Stolen treasure is gold-flecked "treasure-mud".
```

## Batch 1 of 4 — Goblin RUN poses (side-profile, facing RIGHT, mid-run)

```
Draw these FOUR bog-goblins as a horizontal row, each a flat 2D side-profile
facing RIGHT in a clear MID-RUN pose, on flat magenta #ff00ff. They must be
tellable apart by SILHOUETTE alone (round vs dart vs fat vs crowned):

1. BOG GRUNT — the common everyman-imp. Pot-bellied, knock-kneed, bottom-heavy
   round blob. Big floppy bat-ears, snub upturned nose, eager dim oversized eyes.
   Pickle-green. Mid-waddle, hugging a sloppy ARMLOAD OF STOLEN BROWN TRUFFLES to
   his chest. NO warm accent (he is the plain baseline).
2. MIRE SCOUT — tiny, wiry, lizardy dart-shape, half the grunt's mass. Long legs
   leaning hard FORWARD sprinting. Brighter lime/chartreuse skin. A streaming RED
   scout's rag/scarf trailing behind (his one warm pop). Holds a swiped GOLDEN
   TRUFFLE overhead like a prize; smug thief's grin, finger to lips.
3. SLOP BRUTE — the fattest, drabbest: a wide heavy almost-square trapezoid,
   hunched slab-shoulders, tiny head sunk between them. Dull MOSSY/OLIVE-GREY
   (dirtier than the grunt). Slow plodding gait, dragging a big iron MUD-SHOVEL
   over one shoulder. Heavy brow, droopy grumpy frown, sleepy and unbothered.
4. WARBOSS — the grand showpiece (the Goblin King's lieutenant). Tall, deep rich
   EMERALD jewel-green. A battered crooked GOLD CROWN, a gold tooth, a gold-trim
   sash, fistfuls of gold treasure-mud. Struts even while running — pompous,
   theatrical, greedy grin, chin up, demands to be looked at. Cozy-menacing, not
   scary.

Flat 2D paper-cutout, bold #2a1f15 ink outline, soft cel shading only, NO 3D / NO
shadows / NO gloss. Horizontal row, even spacing, magenta #ff00ff bg, NO text.
```

## Batch 2 of 4 — Goblin HIT / RECOIL poses (side-profile)

```
Draw the SAME four bog-goblins again as a horizontal row, now in a COMIC
HIT/RECOIL pose (just got splatted with mud). Must still read when tilted ~26deg.
Cozy and funny, never violent:

1. BOG GRUNT — recoiling with a comic "oof", his armload of truffles DROPPED and
   scattering around him.
2. MIRE SCOUT — tripping forward off-balance, his golden truffle popping loose in
   a little gold sparkle.
3. SLOP BRUTE — barely flinching, slowly TOPPLING like a felled log (comic, stiff,
   unbothered).
4. WARBOSS — the juiciest: wailing dramatically, his GOLD CROWN flying off, gold
   treasure-mud erupting around him.

Same flat 2D paper-cutout style, bold #2a1f15 ink outline, soft cel shading, NO 3D
/ NO shadows / NO gloss. Horizontal row, magenta #ff00ff bg, NO text.
```

## Batch 3 of 4 — Mud splat (the impact)

```
Draw a single MUD SPLAT impact decal, flat 2D storybook: a chunky hand-painted
brown slop blob with a few flung droplets around it — a cartoon SPLAT, NOT a
realistic spray, NO 3D, NO shadow. Honest mud brown. On flat magenta #ff00ff, NO
text. (Optionally also a slightly larger gold-flecked "treasure-mud" splat variant
for warboss hits.)
```

## Batch 4 of 4 — Lane decals (DEFER — polish, not the minimum set)

```
Flat 2D storybook props, horizontal row, magenta #ff00ff bg, bold #2a1f15 outline,
NO 3D / NO shadow / NO text:
1. REED ARCH GATE — a bowed reed archway, two cattail bundles leaning together
   lashed with twine, soft-green (marks the "good" zone).
2. GOLD TREASURE POST — a half-buried lump of gold-flecked treasure-mud under a
   warm shaft of light (marks the "perfect" zone).
3. REED CURTAIN — a tall cattail/bulrush bundle (theater wing; one sprite, we
   mirror it left/right).
4. MUD RIDGE — a chunky clay ground lip with a few grass tufts (the lane floor).
```

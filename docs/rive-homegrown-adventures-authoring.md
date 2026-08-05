# Homegrown Adventures — Rive authoring handoff

This is the exact authoring and export contract for Goal 6 in
`docs/homegrown-adventures-build-goals.md`. The browser prototype automatically
uses the custom scene when the exported file exists; no React rewiring is
required.

## Required visual context

Open all three images at full size before authoring. They are sequential states
of one fixed 390×844 camera, not three unrelated compositions.

1. Starting Barn:
   `assets/concepts/homegrown-adventures/01-starting-barn.png`
2. First farming payoff:
   `assets/concepts/homegrown-adventures/02-first-payoff.png`
3. Developed Barn:
   `assets/concepts/homegrown-adventures/03-developed-barn.png`

The corresponding `*-scene-plate.png` files remove only Rosie from those
approved compositions. Use them behind the transparent Rive artboard so the
animated rig is the sole Rosie on screen; keep the originals as the visual
comparison source.

Absolute source directory:
`/Users/bbroeking/projects/oink/assets/concepts/homegrown-adventures/`

Preserve Rosie's approved silhouette and relative scale, the three-bed Kitchen
Patch, the warm paper-cut material language, and the hedge route. Do not draw
counters, prose, buttons, or navigation into Rive; accessible product UI stays
in DOM/React above the canvas.

## File structure — names are exact

- Artboard: `Homegrown Adventures`, 390×844.
- State machine: `Homegrown Adventures State Machine`.
- View Model: `Homegrown Adventures View Model`.
- Default View Model instance: `Browser Prototype`.
- The View Model must be bound as the artboard default so runtime `autoBind`
  resolves it without instance lookup code.

Create the properties in
`assets/rive/homegrown-adventures/contract.json` exactly as typed there:

- Enums: `rosieMood`, `rosieAction`, `bedOneState`, `bedTwoState`,
  `bedThreeState`.
- Booleans: `satchelEquipped`, `hedgehogVisible`, `frogVisible`,
  `mothsVisible`, `hedgeCrossingOpen`, `hedgeBellEarned`, `reduceMotion`.
- Triggers: `tickle`, `harvest`, `pack`, `return`, `plant`.

The reducer remains authoritative. Data Binding only selects visual state and
fires one-shot motion.

The current runtime file also exposes these exact foreground-rig animations:

- `Rosie Breathing Idle`
- `Rosie Tickle`
- `Rosie Notice`
- `Rosie Pack`
- `Rosie Return`
- `Rosie Bag Hidden`
- `Clover Bed Empty`
- `Clover Bed Growing`
- `Clover Bed Ready`
- `Clover Plant`
- `Clover Ready Flourish`
- `Clover Harvest`

The v0.3 breathing timeline authors a one-second rise and lets the web motion
controller hold the resting pose for 2.25 seconds before replaying it. The
notice timeline leans Rosie toward the Kitchen Patch and runs after the tickle
lift; it may layer over breathing only when Notice wins the shared body keys.
Legacy duplicate timelines remain editor history and are not runtime names.

The v0.4 equipment checkpoint adds a native `rosie_satchel` vector group. Its
translation, rotation, and scale constraints target `body` with offset
preservation, so the Bag remains registered through breathing and tickling.
`Rosie Pack` reveals and settles the Bag, `Rosie Return` gives it one restrained
arrival swing, and the static `Rosie Bag Hidden` clip preserves the reducer's
unequipped state. The reducer—not animation playback—owns whether it is worn.

The v0.5 Living Barn checkpoint adds a native `bed_one_crop_rig` aligned to
Kitchen Patch bed one. Its soil cover, clover group, and sparkle group share the
fixed 390×844 artboard coordinates, so the crop changes without moving the
camera or replacing the Barn plate. Empty, growing, and ready clips are static
runtime poses used for reload and reduced-motion correctness. Plant, ready
flourish, and harvest are short one-shots that always settle back to the
reducer-selected pose. During the first Clover Lunch loop, beds two and three
remain empty.

## Layer and rig plan

Build back to front: sky and distant hills; Barn and hedge; crossing and Hedge
Bell; three Kitchen Patch beds; residents and moths; Rosie; foreground grass
and particles. Keep every named interactive object in a stable group so state
changes do not shift the camera or DOM hit targets.

Rosie's rig needs body, head, snout, ears, four legs, eyes, mouth, cheek marks,
tail, satchel strap, satchel body, and held-item anchor. Use a single attachment
hierarchy for every animation. Check the face, strap, Bag, and held-item anchor
at each extreme pose before export.

## Motion sheet

Use restrained, readable timings. One-shot reactions must settle into the
currently bound idle pose.

| Motion | Target timing | Required behavior |
| --- | ---: | --- |
| Rosie breathing idle | 2.8–3.6s loop | 1–2% body rise, small ear offset; no sliding feet |
| Tickle anticipate/squash/bounce | 450–650ms | anticipation, squash, joyful lift, clean happy settle |
| Notice/point | 650–900ms | eyes and snout lead toward the Kitchen Patch or Bag |
| Harvest celebration | 700–950ms | Rosie responds after the bed pop; no accessory drift |
| Pack | 550–800ms | satchel appears on its registered anchor and settles |
| Return | 900–1,200ms | Rosie enters/settles with Bag emphasis and warm moth echo |
| Bed sprout | 350–550ms | soil lift and readable leaf emergence |
| Growing | 2.5–4s loop | subtle leaf sway only |
| Ready flourish | 900–1,300ms loop | slow readable gleam; never notification-like pulsing |
| Harvest pop | 350–550ms | crop lifts, small paper particles, bed returns empty |
| Hedge Bell | 500–800ms | one ring with diminishing overshoot |
| Crossing open | 700–1,100ms | hedge parts without obscuring Rosie or buttons |
| Glowroot flourish | 1.0–1.5s | warm root light reveals the lasting developed state |
| Resident idles | 3–7s staggered | hedgehog sniff, frog blink, moth drift; low visual priority |

Trigger policy: a new tickle may interrupt the settle portion of the previous
tickle but must first return the rig to a valid anticipation pose. Other
one-shots queue or crossfade once; they must never stack duplicate transforms.

When `reduceMotion` is true, stop breathing, crop sway, moth drift, particles,
and resident loops. Replace one-shots with a 100–180ms pose or opacity change
that still communicates the result.

## Export and automatic integration

1. Export the editor file as
   `assets/rive/homegrown-adventures/source/homegrown-adventures-editor-export.riv`.
2. Ensure the artboard fill is transparent and every required raster asset is
   `Force Export` + `Embedded`; `pig_skin` must never remain `Prevent Export`.
3. Run `node scripts/rive/patch-homegrown-rive.mjs` to produce
   `assets/rive/homegrown-adventures/homegrown-adventures.riv` with the exact
   runtime contract names.
4. Run `npm run verify:rive-homegrown`.
5. Run `npm run prototype:homegrown:build`. The build appends a content hash to
   the `.riv` request; do not remove it when changing the asset.
6. Open `docs/homegrown-adventures.html?variant=A` at 390×844 and complete the
   full loop with Lab tools closed.

The build detects the file and publishes it to
`docs/assets/rive/homegrown-adventures.riv`. Without it, the page deliberately
uses an invisible official Rive runtime probe while showing the concept plate;
that fallback does not satisfy Goal 6.

## Manual acceptance after the static gate

- Inspect Rosie at every extreme pose: no silhouette, face, satchel, or held
  item drift.
- Observe one full idle cycle: the foreground rig rises for roughly one second,
  rests for 2.25 seconds, and does not slide its feet.
- Trigger the first meaningful tickle: the joyful lift resolves into the
  foreground Notice lean before returning to breathing.
- Rapidly tickle Rosie at least ten times: no broken or additive poses.
- Traverse harvest, pack, return, and Glowroot planting: every one-shot settles
  into the correct state.
- Toggle reduced motion before and during a reaction: loops stop and state stays
  legible.
- Test current mobile Safari and desktop Chrome at device pixel ratio 2 or
  higher: the canvas stays sharp and no horizontal overflow appears.
- Confirm the counters, controls, focus order, screen-reader names, and touch
  targets remain DOM-owned and usable above the Rive canvas.

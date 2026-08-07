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
- `Rosie Departure`
- `Rosie Return`
- `Rosie Bag Hidden`
- `Clover Bed Empty`
- `Clover Bed Growing`
- `Clover Bed Ready`
- `Clover Plant`
- `Clover Ready Flourish`
- `Clover Harvest`
- `Home Consequence Hidden`
- `Home Consequence Developed`
- `Glowroot Home Flourish`
- `Moonberry Bed Empty`
- `Moonberry Bed Growing`
- `Moonberry Plant`
- `Dusk Moths Hidden`
- `Dusk Moths Present`
- `Dusk Moths Arrive`
- `Dusk Moths Resting`
- `Dusk Moths Laugh`

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
The WebGL2 boundary must start `Rosie Pack` before scrubbing its nested vector
group to frame 16 (`16 / 60` seconds), then pause it on the next task. Scrubbing
the never-started group does not reliably paint its keyed blend and transform.

The v0.27 departure checkpoint adds `Rosie Departure` as a one-second direct
timeline on the existing foreground `body` root. It moves Rosie toward the
right-side hedge path through three restrained step beats, alternates a small
body lean, and reduces scale slightly as she travels. The web motion controller
layers the complete foreground pose beneath those root keys so Rosie and the
equipped Bag never disappear. React owns the departure clock and changes from
Position 8 to Position 9; the Rive timeline owns only the visible performance.

The v0.28 growth checkpoint adds `Clover Growing Sway` on `bed_one_clover`.
The one-second timeline keys only a restrained −0.7° → 0.9° → −0.7° rotation;
it never moves the soil or owns the growth timer. The web controller holds the
reducer-selected `Clover Bed Growing` pose underneath it, rests for 1.85
seconds between plays, and stops it entirely for sprouts, ready crops, and
reduced motion. React derives the early/middle boundary from persisted crop
timestamps and remains authoritative for readiness.

The v0.29 harvest-presentation checkpoint makes `Clover Harvest` the only
visible crop-removal performance. The final rhythm beat stores a React-owned
completion timestamp, temporarily removes the rhythm and result interfaces,
and reveals the stock result after the existing 560 ms one-shot. The painterly
bed cover lowers only while that authored clip plays; the former DOM/CSS leaf
burst has been removed. Reload and reduced motion still settle directly from
reducer facts, and Rive never owns yield, timing eligibility, stock, or the
Position 5 → 6 transition.

The v0.34 Adventure Glowroot checkpoint reuses the native
`glowroot_bed_three` vector rig and its `Glowroot Home Flourish` keys through a
second, tightly clipped 100×78 web canvas over the Position 9 clearing. React
mounts that canvas only when the deterministic Bag outcome is `discovery`;
Near-Discovery never instantiates it. The first 780 ms reveal settles at frame
47, then the final keyed portion replays for 260 ms between 2.35-second rests as
a restrained breathing glow. Reduced motion starts the nested timeline, scrubs
to frame 47, and pauses on the next task so the final silhouette paints
atomically. The Rive rig owns vector appearance and motion; React still owns
the Bag outcome, reward, persistence, and dismissal.

The v0.35 homecoming checkpoint stages the existing `Rosie Return` timeline
against the approved Position 10 Barn-worktable composition. React switches
between matched character-free complete and clue-only plates, applies the
exact `+1` Glowroot Seed / `+1` Compost / `+2` Willow Fiber delta, and renders
the accessible stock and cause labels. Fast-forwarding from Position 9 emits
one `return` trigger and records it on
`data-rive-last-performed-motion`; repeated input is idempotent. A direct or
reloaded Position 10 holds the bound final pose without replaying, and reduced
motion skips the one-shot. Rive still owns only Rosie's visible arrival and Bag
swing—not branch choice, reward quantities, acknowledgement, or persistence.

The v0.36 pond-memory checkpoint imports the native `pond-frog` group on the
unchanged 390×844 artboard. The v0.37 painterly pass moves its parent to
`(222, 438)` and sets `pond_water`, `pond_light`, `pond_rocks`, `lily_pads`,
`pond_flower`, and `frog_rock` to 0% base blend. Those static objects remain in
the editor only as source history because the character-free Farm plate now
owns the pond environment. `Pond Frog Present` keys the root at 100%, `Pond
Frog Hidden` keys it at 0%, and `Pond Frog Response` gives only the remaining
living `frog` subgroup a restrained 32-frame lift and settle. The root's editor
base blend is also 0%, so any timeline reset safely returns to Hidden instead
of leaking the future resident into an unearned Farm. React reveals Present
when the persisted Home memory is earned—including later mornings. Direct
reload holds the correct pose; reduced motion never plays Response. The unused
editor-history `Timeline 26` is intentionally not part of the runtime contract.

The persistent Farm canvas and the temporary Position 9 Glowroot canvas both
use `useOffscreenRenderer: true`. This follows Rive's multiple-instance WebGL2
guidance and lets the temporary canvas unmount without tearing down a graphics
context still used by the Farm. It does not merge their React lifecycles or
give either Rive instance progression authority.

The v0.38 painterly-crops checkpoint leaves the current Rive export unchanged
and preserves its Moonberry and Glowroot timelines as the motion/state source.
In the Farm composition, React exposes both `bedTwoState` and `bedThreeState`
and registers painted clips from
`11-changed-home-painted-crops-scene-plate.png` over the corresponding static
vector masses. This keeps the crops visually rooted in the same soil and light
as the pond while retaining the authored Home flourish and future editable
motion source. The browser must never reveal either painted clip while its bed
state is `empty`; reduced motion holds the final registered art without an
arrival animation.

The v0.39 Changed Home pose adds `Rosie Home Admire` to the same foreground
rig. It keys only the shared `body` root: `(118, 500)` at `50%` scale for the
resting frame, a restrained lift to `(118, 494)` at `51%`, then the exact
resting pose again. React selects and holds frame zero only at Position 11,
plays the bounded lift for the final tickle, and restores the ordinary
full-size breathing pose after **Begin another day**. The new clip never owns
Home progression, the tickle reward, persistence, or position selection.

The v0.40 resident pass keeps the existing pond hierarchy and all three frog
timelines intact. The native `frog` subgroup is reduced from 100% to 80% scale
to match the approved Position 11 resident, while the two dark contour colors
are softened to 48% opacity. Its body, feet, eye bulbs, and belly move to a
quieter olive, moss, and warm-gold palette derived from the checked-in
`pond-frog-painterly.png` authoring study. No bitmap was added to the runtime;
the study remains visual provenance for the editable vector treatment. The
existing parent position `(222, 438)`, hidden root blend, Present pose,
Response lift, React reveal boundary, and reduced-motion behavior are
unchanged.

The v0.41 doorway pass keeps the established Home consequence timelines and
front `hedge_crossing_flourish` intact. Two duplicates remain under the same
parent and are sent behind the flowering original: an outer backing at
`(26, -103)`, `103% x 102%`, and 82% blend, plus an inner backing at
`(32, -108)`, `97% x 98%`. Their cream and pink node colors become muted
olive, sage, and leaf green. This is an authored appearance and draw-order
change only. React still decides when the crossing is open, and the existing
Hidden, Developed, and `Glowroot Home Flourish` clips continue to supply every
persisted and reduced-motion pose.

The v0.5 Living Barn checkpoint adds a native `bed_one_crop_rig` aligned to
Kitchen Patch bed one. Its soil cover, clover group, and sparkle group share the
fixed 390×844 artboard coordinates, so the crop changes without moving the
camera or replacing the Barn plate. Empty, growing, and ready clips are static
runtime poses used for reload and reduced-motion correctness. Plant, ready
flourish, and harvest are short one-shots that always settle back to the
reducer-selected pose. During the first Clover Lunch loop, beds two and three
remain empty.

The v0.6 Home Remembers checkpoint adds a native `home_consequence_rig` while
keeping the starting Barn plate fixed. Its Glowroot bed, flowering hedge arch,
Hedge Bell, and restrained sparkles share the approved 390×844 coordinates.
Hidden and Developed are static reload/reduced-motion poses; Glowroot Home
Flourish reveals the same lasting state once when `hedgeCrossingOpen` changes
from false to true. It does not own progression or replace the scene plate.

The v0.9 Moonberries Take Root checkpoint adds a second crop rig at bed two.
Its purple Moonberry clusters share the existing paper-cut soil language but
remain visually distinct from Clover. Empty and Growing are static reload and
reduced-motion poses; Plant is a short opacity arrival that settles back to
the reducer-selected Growing pose. It introduces no new timer or economy.

The v0.10 Dusk Moths Arrive checkpoint adds one native three-shape moth above
the Barn roof. Hidden and Present are static persisted poses; Arrive fades the
gold-winged resident in over 21 frames when reducer-owned `mothsVisible`
changes from false to true. It remains absent before the Moonberry choice,
survives reload afterward, and snaps directly to Present under reduced motion.

The v0.11 Moth at Rest checkpoint adds one 28-frame authored pulse to that
same resident. Its two wing groups rotate from the static Present pose to a
readable open-wing silhouette while the body lifts two pixels, then every
property returns to its exact starting value. The web controller plays the
560ms pulse between 2.25-second holds; reduced motion never starts it.

The v0.14 Moth Joins the Laugh checkpoint adds a separate authored response to
Rosie's established tickle. It starts from Present, lifts the moth three pixels,
opens its wings slightly farther than the calm rest pulse, and returns every
property to the exact Present values in 17 frames. A visible resident restarts
this response on every tickle, then resumes its independent rest cadence;
reduced motion remains on the static Present pose.

The v0.15 A Shared Glint checkpoint adds one gold paper shape beside the same
resident. Its Rive base is collapsed and hidden; Laugh keys bring it to full
scale and opacity before returning it to zero. Because the nested authored
shape does not remain visible when the parent artboard is rasterized by the web
runtime, the React boundary also renders one matching 22-pixel paper star keyed
to `data-rive-moth-motion="laugh"`. That single presentation cue remounts on the
existing trigger nonce so rapid tickles restart rather than stack. Rest,
reload, and reduced motion always leave it absent.

The v0.16 The Moth Finds Its Place checkpoint moves the existing resident onto
the Barn roofline without grouping, duplicating, or resizing its authored
pieces. Present and Arrive settle 38 pixels lower. Resting keeps its two-pixel
body lift at frame 14; Laugh keeps its three-pixel lift at frame 7; both return
to the shared `Y = 150` body perch. The translated wing and body keys remain
attached across all frames, so the resident does not drift or teleport when a
one-shot hands back to Present. The web-mirrored glint now sits to the left of
that same perch, clear of the compact story card. Hidden, persisted, and
reduced-motion behavior is unchanged.

The v0.17 The Moth Comes Home checkpoint turns `Dusk Moths Arrive` into a
21-frame landing. Its three resident groups begin 45 pixels left and 30 pixels
below their final transforms at zero opacity, then translate and fade together
to the exact Present roof perch. The endpoint uses the v0.16 `Y = 150` pose for
all three groups, preventing the old sky-to-roof snap when Arrive hands off.
For reduced motion, the web boundary atomically plays, scrubs to that authored
endpoint, and pauses on the next task; this makes Rive WebGL2 commit every
nested shape without presenting an intermediate motion frame.

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
- Traverse harvest, pack, departure, return, and Glowroot planting: every one-shot settles
  into the correct state.
- Replay **Reveal Glowroot** in the animation lab: the discovery appears only
  on the successful clearing, rests between glows, and is absent from the clue
  branch.
- Toggle reduced motion before and during a reaction: loops stop and state stays
  legible.
- Test current mobile Safari and desktop Chrome at device pixel ratio 2 or
  higher: the canvas stays sharp and no horizontal overflow appears.
- Confirm the counters, controls, focus order, screen-reader names, and touch
  targets remain DOM-owned and usable above the Rive canvas.

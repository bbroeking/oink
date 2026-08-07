# Homegrown Adventures Rive scene

Expected export: `homegrown-adventures.riv`.

Authoring sheet: `docs/rive-homegrown-adventures-authoring.md`.
Machine-readable contract: `contract.json`.
Static export gate: `npm run verify:rive-homegrown`.

This directory intentionally does not contain a placeholder renamed as the
production asset. The Rive editor work must export one portrait scene with a
Data Binding View Model matching
`components/prototypes/homegrown-adventures/homegrownRiveContract.ts`.

Required authored motion:

- Rosie: breathing idle, tickle squash/bounce, happy settle, notice, harvest,
  pack, and satchel return;
- three Kitchen Patch beds: sprout, grow, ready flourish, harvest pop;
- Hedge Bell, opening hedge crossing, and Glowroot planting flourish;
- restrained hedgehog, frog, and moth loops;
- reduced-motion states with ambient loops stopped and short pose/opacity
  reactions.

The scene must preserve Rosie's approved silhouette and keep her satchel,
features, and held objects registered at every extreme pose. The current Rive
account's export gate is documented in `docs/rive-pig-rigging.md`. The browser
prototype uses the official `runtime-sample.riv` only to verify the WebGL2
runtime boundary; it is not completion evidence for this asset.

The first gameplay equipment checkpoint authors `rosie_satchel` as a single
native Rive group. Offset-preserving translation, rotation, and scale
constraints bind it to Rosie's `body` rig. `Rosie Pack`, `Rosie Return`, and
`Rosie Bag Hidden` are the runtime clips for equipping, returning, and the
unequipped resting state.

The v0.55 selection-response checkpoint adds `Bag Receive` to that same group.
It gives every valid React-owned slot change one direct 600 ms rise, enlarge,
settle, and hide performance. The timeline carries no item identity or gameplay
state; the accessible open-Bag preview remains reducer-derived.

The v0.57 fitted-satchel checkpoint refines the existing group rather than
introducing another Bag. `Rosie Pack` settles at `(-58, -58)`, 112% scale, and
82° rotation. `Rosie Return` uses the same endpoint with a restrained
112% → 118% → 110% → 112% swing. The mustard body and flap become warm brown
leather (`#8b5a32` / `#b97845`) with a quieter ochre strap highlight. React's
existing `satchelEquipped` fact and selected Bag items remain authoritative.

The Living Barn checkpoint adds `bed_one_crop_rig` over the first Kitchen
Patch bed. `Clover Bed Empty`, `Clover Bed Growing`, and `Clover Bed Ready`
provide deterministic persisted poses; `Clover Plant`,
`Clover Ready Flourish`, and `Clover Harvest` communicate the three meaningful
transitions. The other two beds remain empty during the first loop. Crop state
is reducer-owned and no longer arrives through a whole background-plate swap.

The v0.28 growth checkpoint adds `Clover Growing Sway`, a one-second
clover-only lean selected over whole-bed lift and scale-pulse studies. React
derives `sprout` versus `growing` from persisted planting and ready timestamps;
the runtime replays the authored sway only during the leafy middle stage, with
a 1.85-second rest and no playback under reduced motion. The matching
`patch-growing-lush.webp` keeps the approved painterly bed readable while the
Rive rig provides restrained living motion.

The Home Remembers checkpoint adds `home_consequence_rig` over the unchanged
starting Barn plate. `Home Consequence Hidden` and
`Home Consequence Developed` are the persisted poses; `Glowroot Home
Flourish` reveals the planted Glowroot, flowering hedge crossing, and earned
Hedge Bell as one bounded Home consequence. React still owns the underlying
`hedgeCrossingOpen` fact, copy, controls, and persistence.

The Adventure Glowroot checkpoint reuses only the native
`glowroot_bed_three` portion of that rig in a clipped Position 9 canvas.
`Glowroot Home Flourish` supplies the reveal and quiet keyed glow; React mounts
the canvas only for a successful deterministic Bag outcome. The clue branch
does not render a Glowroot canvas, and neither Rive instance owns reward state.

The Position 10 homecoming checkpoint keeps `Rosie Return` on the same
foreground rig but replaces the generic Barn underneath it with one physical
worktable scene. React selects the complete or clue-only plate, applies the
exact fast-forward stock delta, and exposes the current quantity labels. The
Rive trigger is observable as `data-rive-last-performed-motion="return"` after
the short performance; direct reloads do not replay it and reduced motion
holds the final bound pose.

The Position 11 pond-memory checkpoint adds one native `pond-frog` group to the
same artboard. The follow-up painterly-pond checkpoint leaves the imported
water, highlight, rocks, lily pads, flower, and `frog_rock` in the source for
authoring history but sets them to 0% base blend. The character-free Farm plate
now owns that static environment; only the living `frog` subgroup is revealed
by `Pond Frog Present` and moved by `Pond Frog Response`. Its parent sits at
`(222, 438)` so the frog lands on the painted foreground rock. React decides
when the earned resident becomes visible, preserves it into later mornings,
and stops the cadence for reduced motion; Rive owns no resident progression,
reward, or persistence. The root group also defaults to 0% blend, making a
runtime reset safely hidden until React explicitly holds Present.

The Moonberries Take Root checkpoint adds a second native crop rig aligned to
Kitchen Patch bed two. `Moonberry Bed Empty` and `Moonberry Bed Growing` are
the reducer-selected persisted poses; `Moonberry Plant` is one restrained
arrival that always settles to Growing. React still owns `nextPlanting`, so a
reload and reduced motion select the correct pose without animation-owned
progression or another farming timer.

The painterly-crops checkpoint keeps those authored timelines and their
reducer binding intact but places registered painterly bed clips above the
static Moonberry and Glowroot vector masses in the browser composition.
`bedTwoState` and `bedThreeState` independently select the clips, preventing a
future crop from appearing early. React still owns visibility and persistence;
Rive remains responsible for the shared Home flourish, Rosie, and residents.

The Changed Home composition adds `Rosie Home Admire`, a root-bone-only pose
on the canonical rig. It reduces and shifts Rosie left for Position 11 so the
remembered crops and pond remain visible, gives the final tickle one small
lift, and settles to the same ground line. React owns when the pose is active,
holds it on reload and reduced motion, and returns to ordinary breathing on
the next morning.

The v0.40 frog treatment keeps the native `frog` subgroup and its Present,
Hidden, and Response clips. The subgroup is 80% scale; its two dark contours
are 48% opacity; and its body, feet, eye bulbs, and belly use muted olive,
moss, and warm-gold colors. The checked-in
`source/pond-frog-painterly.png` is a built-in ImageGen authoring reference
derived from the approved Position 11 concept, not a runtime bitmap. Its final
prompt requested one compact friendly frog, warm hand-painted storybook
gouache, natural olive and moss greens, golden highlights, low-contrast edges,
and no rock, pond, UI, text, heavy outline, or neon green. The original
magenta-key generation was converted locally to alpha, trimmed to the subject,
and given a 12-pixel transparent authoring margin.

The v0.41 hedge treatment keeps the existing `hedge_crossing_flourish` as the
front blossom layer and adds two editable duplicates behind it inside the same
Home consequence hierarchy. The backings are registered within three pixels
of the established path, use olive, sage, and muted leaf-green in place of the
pink and cream blossom colors, and hold the outer backing at 82% blend. The
result is one broad flowered doorway instead of a thin pair of vector strokes.
`Home Consequence Hidden`, `Home Consequence Developed`, and `Glowroot Home
Flourish` remain unchanged; no new authored name or runtime progression input
was introduced.

The v0.42 leaf treatment keeps that exact state and timeline contract while
breaking the backing silhouette into foliage. Two additional muted copies use
different X/Y scales, offsets, rotations, and restrained blend values. Inside
one green node subgroup, two editable duplicates stretch the existing circles
into crossed rows of elliptical leaves; an exact blossom copy remains in
front. The authored leaves therefore reveal, persist, and stop with the same
Home consequence parent. React still owns `hedgeCrossingOpen`, save state,
rewards, copy, and reduced-motion selection, and no new Rive input or gameplay
fact was added.

The Dusk Moths Arrive checkpoint adds one native golden-and-purple moth in the
open sky above the Barn. `Dusk Moths Hidden` and `Dusk Moths Present` are the
reducer-selected persisted poses; `Dusk Moths Arrive` is a bounded 21-frame
opacity arrival. React still owns the Moonberry choice and `mothsVisible`, so
reload and reduced motion select the correct pose without a resident timer,
collection, or reward system.

The Moth at Rest checkpoint adds `Dusk Moths Resting`, a 28-frame authored
wing-and-hover pulse on the same resident. The runtime plays it for 560ms
between 2.25-second static holds, resumes the cadence after reload, and leaves
the reducer-owned Present pose untouched for reduced motion. It adds no new
resident or progression fact.

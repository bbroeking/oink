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

The Moonberries Take Root checkpoint adds a second native crop rig aligned to
Kitchen Patch bed two. `Moonberry Bed Empty` and `Moonberry Bed Growing` are
the reducer-selected persisted poses; `Moonberry Plant` is one restrained
arrival that always settles to Growing. React still owns `nextPlanting`, so a
reload and reduced motion select the correct pose without animation-owned
progression or another farming timer.

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

# Homegrown Adventures prototype

Throwaway browser prototype for the loop in
`docs/homegrown-adventures-build-goals.md`. It uses one deterministic reducer
and three UI variants; `?variant=A|B|C` changes presentation without changing
the saved simulation.

Run from the repository root:

```sh
npm run prototype:homegrown
```

Then open `http://127.0.0.1:4174/homegrown-adventures.html?variant=A`.

Build and test:

```sh
npm run prototype:homegrown:build
npm run prototype:homegrown:test
```

The build writes a content hash onto the published JavaScript URL and onto the
authored Rive request. Keep both when changing deployment code; public QA must
exercise the exact bundle produced for the checkpoint.

The web-only Rive wrapper uses `@rive-app/react-webgl2`. The build now publishes
the checked-in authored Homegrown Adventures scene: Rosie's mesh/bone rig,
breathing, tickle and notice motions, plus the registered satchel with pack,
return, and hidden-state clips. The same scene owns Kitchen Patch bed one's
empty, growing, ready, plant, flourish, and harvest poses. The first crop loop
keeps the starting Barn plate fixed instead of faking growth with a background
swap. It now also owns the lasting Glowroot bed, flowering hedge crossing, and
Hedge Bell reveal; hidden, flourish, and developed clips remain bound to the
reducer's `hedgeCrossingOpen` fact. `runtime-sample.riv` remains only the
fallback runtime probe. Static
character-free concept plates provide the scene behind the transparent Rive
canvas so the animated rig is the only Rosie rendered.

Position 9 now uses a second tightly clipped view of the same authored file for
the physical Glowroot only. The successful branch removes the root from its
character-free environment plate and lets `Glowroot Home Flourish` reveal and
gently re-light the native vector rig. React decides whether that component is
mounted; the Near-Discovery plate contains no reward and instantiates no
Glowroot Rive canvas. The animation lab exposes the exact motion as **Reveal
Glowroot**.

Position 10 now replaces the floating return stack with matched, character-free
Barn-worktable plates derived from the approved return concept. The successful
plate physically shows the earned Glowroot Seed, Compost, and two Willow Fiber
coils; the Near-Discovery plate shows a leaf-print clue, Compost, and one Fiber
coil with no Seed. Canonical Rive Rosie performs the existing `Rosie Return`
above the plate, while React owns the branch, quantities, causal copy,
acknowledgement, and fast-forward stock delta. Reload holds the complete scene
without replaying the one-shot, and reduced motion skips it.

Position 11 now switches to the character-free
`11-changed-home-pond-scene-plate.png`, where the earned pond is painted into
the same Farm camera and visual language. The shared Rive artboard contributes
only the living frog, aligned to the plate's foreground rock; its older vector
water, rocks, lily pads, flower, and duplicate rock remain hidden. React
separates the already-earned Position 10 fact from the Position 11 reveal, then
preserves the plate and `Pond Frog Present` through reload and later mornings.
`Pond Frog Response` supplies one quiet bob between long rests; reduced motion
keeps the frog still and no resident progression lives inside Rive. The
animation lab exposes the same composition as **Pond remembers**.
The v0.40 resident pass retains that exact motion contract but reduces the
native frog to 80% scale, softens its contours, and replaces its bright vector
palette with muted olive, moss, and warm-gold colors derived from the approved
Position 11 concept. The frog remains one editable Rive group; React still owns
its earned visibility and persistence.

The remembered Moonberry and Glowroot beds use registered clips from
`11-changed-home-painted-crops-scene-plate.png` above that same pond plate.
`bedTwoState` and `bedThreeState` independently reveal the middle and right
beds, so Glowroot can be present while Moonberries are still a future choice.
The source Rive timelines remain connected to the reducer-owned states, while
the painterly clips keep the lasting crop mass rooted in the Farm art instead
of reading as a flat sticker.

The persistent Farm view and temporary Position 9 Glowroot view share Rive's
offscreen WebGL2 renderer. They remain separate canvases and React components,
but the temporary discovery view can unmount without invalidating the Farm's
live renderer before Position 11 reveals the frog.

Crop growth now has an explicit painterly early-sprout asset and a separate
flower-free lush-middle asset. React derives that visual boundary from
`plantedAt` and `readyAt`; the authored `Clover Growing Sway` timeline supplies
one restrained clover-only cadence during the middle stage. Rive still owns no
timer, inventory fact, ready transition, or reward.

Variant A is canonical. The return story temporarily expands for a 2.4-second
welcome-home ceremony, then becomes a compact, accessible Home record below the
HUD. Tickling Rosie dismisses the ceremony immediately; developed reloads are
compact from their first frame; reduced motion never opens it. The record's
button exposes the full story and Field Guide on request without permanently
covering Rosie or the Kitchen Patch.

The baked Clover instruction becomes visible once that record collapses, so the
post-return scene covers it with a reducer-bound DOM purpose sign. It reads
Glowroot Seed on return, requests Moonberries after planting, and persists the
chosen Moonberries state. Product text remains accessible and outside Rive; the
sign is not another inventory, order board, or progression system.

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

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

The web-only Rive wrapper uses `@rive-app/react-webgl2`. The build now publishes
the checked-in authored Homegrown Adventures scene: Rosie's mesh/bone rig,
breathing, tickle and notice motions, plus the registered satchel with pack,
return, and hidden-state clips. The same scene owns Kitchen Patch bed one's
empty, growing, ready, plant, flourish, and harvest poses. The first crop loop
keeps the starting Barn plate fixed instead of faking growth with a background
swap. `runtime-sample.riv` remains only the fallback runtime probe. Static
character-free concept plates provide the scene behind the transparent Rive
canvas so the animated rig is the only Rosie rendered.

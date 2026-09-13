# Mote Machine runtime layer pack

This directory registers the source images embedded in the shipping
Rosie/Barn V3 Rive runtime. The approved READY reference is
`../2026-08-30-rosie-style-lock/mote-machine-impeccable-v3-ready.png`; the full
generation, compositing, and hierarchy handoff is in
`../2026-08-30-rosie-style-lock/rive-parts-v3/README.md`.

The shipping source keeps the Mote, three reel strips, four lever pieces, and
Clockwork Acorn reward independently animated. Rive clip layouts constrain the
deposit, reel, and reward motion. Dynamic balances, result copy, navigation,
notification copy, and the screen-reader action remain native.

`manifest.json` is the registration contract for the 390 × 844 artboard. It
records the production bounds, stop frames, interaction geometry, runtime
size, and accepted SHA-256. The old alchemy-era files remain here only as source
history and are explicitly excluded from the runtime export.

Accepted runtime:

- `assets/rive/mote-machine.riv`
- 2,726,550 bytes
- SHA-256 `9e728bb2d468873480eabfccbaf458834e92b06f5216055f44a2c1324a9e5e9c`

The asset, iOS, and Android runtime copies must stay byte-identical. Run
`npm run verify:rive-mote-machine` after every editor export.

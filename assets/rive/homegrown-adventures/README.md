# Homegrown Adventures Rive scene

Expected export: `homegrown-adventures.riv`.

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

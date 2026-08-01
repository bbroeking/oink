---
title: "Rive homepage pig implementation plan"
type: plan
date: 2026-07-26
status: active
tags: [rive, animation, pigs, homepage]
---

# Rive homepage pig implementation plan

## Goal

Prove and, only if validated, adopt a shared Rive homepage pig rig with
identical animations across all six skins and reliable equipped-cosmetic
attachment, while preserving the current raster renderer as a safe fallback.

## Product decision

Every pig must use the same silhouette, joints, timing, and animation graph.
Identity comes from its skin: coat color, markings, facial treatment, and other
painted details. A pig must never be independently redrawn for each frame.

Rive is the preferred architecture if a thin prototype proves:

1. two skins remain registered to exactly the same rig;
2. representative cosmetics stay attached throughout continuous animation;
3. the native renderer is stable in Oink's current Expo 52 / React Native 0.76
   iOS build;
4. the result looks materially better than the current raster flipbook.

The supporting feasibility research is in
[`rive-homepage-feasibility-2026-07.md`](./rive-homepage-feasibility-2026-07.md).

## Scope

### Prototype

- One 300×300 Rive artboard.
- One skeleton and one state machine.
- Rosie and Pickles skins using identical joint locations.
- `idle`, `jump`, and `wave`.
- One hat, one pair of glasses, and one held item.
- A development-only switch between `SpritePig` and `RivePig`.
- iOS simulator and physical-device validation.

### Production, only after the prototype passes

- Six skins: Rosie, Copper, Pepper, Bandit, Pickles, and Biscuit.
- Eight authored animations: `idle`, `walk`, `jump`, `happy`, `sad`, `tired`,
  `surprise`, and `wave`.
- `bounce` reuses the jump animation.
- Homepage state-machine parity with the current tickle and mood behavior.
- A production strategy for every currently supported cosmetic slot.
- Raster fallback retained through rollout.

### Not in the first prototype

- Lounge directional poses.
- Replacing thumbnails or secondary-screen portraits.
- Migrating to the new Nitro Rive runtime.
- Removing the raster sprite packs.
- Importing the complete cosmetic catalog.

## Guardrails

- Do not replace `SpritePig` on the production homepage during the spike.
- Do not combine the spike with an Expo upgrade. The new Rive runtime requires
  Expo 53+; this app remains on Expo 52 for the experiment.
- Use the already-linked legacy `rive-react-native@9.8.3` runtime.
- Do not duplicate animation timelines per skin.
- Do not recreate the current React Native anchor table as a second Rive rig.
- No distributable build is started without following
  `docs/RELEASE_CHECKLIST.md`.

## Execution plan

### 1. Lock the contract and baseline

**Status: complete for the simulator spike.**

- Capture the current homepage at rest and during every reaction.
- Record current animation names, durations, completion behavior, and mood
  transitions.
- Select three real cosmetics that stress different anchors:
  - head: party hat;
  - face: pixel glasses;
  - hand: garden trowel.
- Define a renderer-neutral `PigRenderer` contract so the homepage can switch
  implementations without changing game logic.
- Add a development-only renderer selector; raster remains the default.

The renderer-neutral animation contract now lives in
`components/ui/pigRendererContract.ts`, with regression coverage in
`__tests__/pigRendererContract.test.ts`. The development audit route also
contains an isolated native-runtime probe. On 2026-07-26, the official Rive
avatar sample rendered successfully in the iPhone 16e / iOS 18.6 simulator
through Oink's installed legacy runtime.

**Exit gate:** passed for contract extraction and native runtime linkage. The
same interaction script can drive both renderers after the local pig `.riv`
exists.

### 2. Prepare prototype skin artwork

**Status: complete.**

- Choose one clean canonical pig drawing with the approved homepage silhouette.
- Prepare the approved full idle image as a deformable mesh texture.
- Normalize every skin to the same canvas dimensions and exact alpha field.
- Keep coat colors, facial paint, and markings inside the skin texture so they
  inherit mesh deformation instead of being independently positioned.

The generated cut-part lane was assembled in the audit lab and rejected because
it changed Rosie into an upright doll-like silhouette. The active lane uses the
approved full idle sprite as a deformable image mesh. The script
`scripts/rive/build-prototype-mesh-textures.sh` now produces all six 370×383
textures, and ImageMagick comparison reports zero alpha differences between
Rosie and every other skin.

**Exit gate:** passed for source texture geometry. Rive editor authoring must
still prove that one mesh topology and weight map can be duplicated across all
six image assets without approximation.

### 3. Author the Rive spike

**Status: in progress. The stronger prototype uses one Referenced image asset
(`pig_skin`) so every coat literally shares the same mesh and weights. One mesh
is bound to the shared `body`, `head`, and `leg_front_screen_right` bones.
Controlled 60 fps keys now produce stable `idle`, `jump`, and `wave` poses.
The `pig` state machine has jump/wave paths back to idle, and the real party
hat, pixel glasses, and garden trowel now remain registered to their attachment
slots at the tested motion extremes. Independent 0/1 selectors now work for
all three cosmetics. The authored runtime export is still missing.**

- Build one skeleton with stable head, face, body, limb, and held-item nodes.
- Author `idle`, `jump`, and `wave` once.
- Mark the single meshed image asset `pig_skin` as Referenced and supply the
  selected alpha-identical coat through `rive-react-native`'s
  `referencedAssets` prop. Retain the numeric `skin` input for compatibility.
- Add internal cosmetic slots for hat, glasses, and held item.
- Build the `pig` state machine with:
  - skin selection;
  - rest state;
  - three animation triggers;
  - animation-complete signaling.
- Export one local `.riv` file.

The editor preview currently proves:

- idle: `body.positionY` keys at frames `0`, `30`, and `60`;
- jump: a shared-root arc through frames `0`, `8`, `20`, `32`, and `40`;
- wave: restrained leg rotations through frames `0`, `15`, `25`, `35`, and
  `45`;
- trigger-driven entry to jump/wave and timed return to idle;
- head and face attachment groups parented to the head bone;
- a `slot_held` Transform constraint targeting the front leg in World space;
- real garden-trowel artwork that follows the held slot through wave frame
  `25` and the shared-root jump at frame `20`;
- a real party-hat image constrained to `slot_head` with Translation and
  Rotation (not Scale), remaining registered at jump frame `20`.
- real pixel-glasses artwork using the same constraint pattern on `slot_face`,
  remaining registered at jump frame `20`.

The original duration inputs were interpreted as seconds. On 2026-07-26 the
timelines were corrected to 60-frame idle, 40-frame jump, and 45-frame wave
durations; Rive rescaled the existing keys into the intended frame positions.
All three representative cosmetic images are imported, instantiated, and
attached. Separate `Hat Equip`, `Face Equip`, and `Held Equip` state-machine
layers default to hidden and switch at 0 ms from their corresponding
`equip_*` Number input. Editor playback passes the empty loadout, each singleton
loadout, and the fully equipped loadout. A mistaken 10,000% visible-opacity key
was corrected to 100% on all three selector timelines.

The fully equipped loadout remains attached at the jump apex in state-machine
playback. Wave attachment is proven at its authored frame-25 extreme; the
editor's sampled state-machine wave frames did not show a sufficiently distinct
pose to count as an additional runtime proof. The current Rive account also
gates `.riv` export behind `Upgrade`; do not purchase or publish around that
gate without explicit approval.

**Exit gate:** the shared mesh, motion, and held-slot architecture are proven in
the editor, and the three representative selectors pass editor playback. This
phase remains open until a local `.riv` can be exercised through the native
runtime.

### 4. Integrate without replacing production

- Add `.riv` to Metro's asset extensions if required by the chosen loading
  path.
- Activate and modernize `components/ui/RivePig.tsx`.
- Map the existing `PigAnimation` and `PigId` values into the Rive state
  machine.
- Map the three selected cosmetics into Rive selectors.
- Keep `SpritePig` as the default and immediate error fallback.
- Surface Rive load/state errors in development.

**Exit gate:** the spike renders from the local app on the iOS simulator without
changing gameplay state or equipment data.

Metro now recognizes `.riv`, and the audit route successfully rendered a
locally bundled official sample through the native runtime. The remaining
integration work depends on the authored `assets/rive/pig.riv`.

The production-shaped renderer seam is also in place:

- `components/ui/rivePigContract.ts` owns all six skin indexes, the complete
  animation input map, and the three prototype cosmetic selectors.
- `components/ui/RivePig.native.tsx` drives that contract and immediately
  mounts `SpritePig` after any native/load error.
- Base and `.web.tsx` adapters remain raster-only, so Expo Router can discover
  `/ui-audit` and `/expedition` without evaluating `rive-react-native`.
- Every native `onPlay` replays skin, equipment, and animation inputs. This is
  required because changing pig remounts the Rive view to replace `pig_skin`;
  retaining a one-time React ready flag would leave the new instance with
  default equipment and motion.
- `components/ui/PigRenderer.tsx` keeps raster as the default and refuses Rive
  for pre-baked frames, frozen-frame inspection, raster-only skin tinting,
  unsupported equipment, or Reduce Motion.
- `PigStage` keeps unsupported anchored equipment on raster; external overlays
  are never layered over continuous Rive motion as a pretend attachment fix.
- `utils/rivePigRollout.ts` owns an AsyncStorage-backed rollout gate. The
  development audit exposes the gate, while missing assets and compatibility
  failures still win and keep the stage on raster. Native renderer failures
  emit structured development telemetry before fallback.
- `npm run verify:rive-web` creates a temporary Expo web export and fails if a
  native Rive marker reaches a web bundle. The paired source guard prevents
  shared and `.web` modules from importing the native runtime.

The authored `.riv` is still required before this phase's exit gate can pass.

`npm run verify:rive-pig` is the first gate after export. It validates the
binary header and authored contract names, the manifest, all six texture
dimensions, and identical alpha geometry. `npm run verify:rive-pig:assets`
runs the currently available skin/manifest portion without pretending that the
missing binary has passed. Neither command replaces simulator or device
playback.

### 5. Validate the spike

Run the same scripted interactions against raster and Rive:

- idle for 30 seconds;
- repeated tickles through jump and wave;
- switch Rosie ↔ Pickles while resting and after a reaction;
- equip and remove each representative cosmetic;
- background/foreground the app;
- enable Reduce Motion;
- test on simulator and a physical iPhone development build.

Record:

- silhouette and skin fidelity;
- cosmetic attachment at animation extremes;
- touch-to-reaction latency;
- state-machine completion/recovery;
- memory growth and crashes;
- visual artifacts during skin/equipment changes.

**Pass criteria:**

- no skin geometry drift;
- no cosmetic separation or one-frame lag;
- all interactions recover to the correct rest state;
- no crash or unbounded memory growth;
- the Rive result is visibly better than the raster baseline.

### 6. Make the lane decision

#### If Rive passes

- Add the remaining six shared animations.
- Add Copper, Pepper, Bandit, and Biscuit as paint-only skins.
- Choose and execute the full cosmetic-catalog strategy inside Rive.
- Add automated contract tests around animation/skin/equipment mapping.
- Roll out behind a persistent feature flag, then make Rive the default after
  TestFlight validation.

#### If Rive fails

- Keep `SpritePig`.
- Produce coordinated 32-frame homepage packs per pig: eight four-frame
  animation sheets generated from one locked identity reference.
- Never generate isolated frames.
- Validate frame registration, markings, alpha, and cosmetic anchors before
  replacing the current packs.

## Definition of done

- All six pigs share one approved animation graph and identical geometry.
- Every homepage mood and reaction has parity with the current game behavior.
- Equipped cosmetics remain attached throughout every animation.
- The renderer survives simulator and physical-device validation.
- Reduced Motion has an intentional alternative.
- The raster fallback has been retained until the new renderer passes
  TestFlight validation.
- Relevant sprite/Rive, layout, TypeScript, and integration checks pass.
- The final renderer decision and operating instructions are documented.

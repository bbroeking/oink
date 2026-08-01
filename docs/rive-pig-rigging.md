# Rive homepage pig authoring guide

This is the editor-side contract for the homepage Rive decision spike. The
current implementation plan is
`docs/design/rive-homepage-implementation-plan-2026-07.md`.

## Non-negotiable result

One skeleton and one animation graph drive every pig. A skin may change pixels,
but it may not change the artboard, bone positions, mesh topology, vertex
weights, animation timelines, or state-machine transitions.

The earlier exploded-parts approach failed the Rosie silhouette review. Do not
import those cut parts into the active rig. Use the approved full idle images as
deformable meshes so the neutral pose remains the current homepage artwork.

## Prepared inputs

Run:

```sh
scripts/rive/build-prototype-mesh-textures.sh
```

The outputs are:

```text
assets/rive/prototype/textures/
├── rosie.png
├── copper.png
├── pepper.png
├── bandit.png
├── pickles.png
└── biscuit.png
```

Every file is 370×383 and has Rosie's exact alpha field. The build script
verifies zero alpha differences across all six outputs. Coat colors, facial
paint, and markings are contained inside the texture, so they deform with the
mesh instead of drifting as independent overlays.

The machine-readable hierarchy and indexes live in
`assets/rive/prototype/rig-manifest.json`.

## Current editor prototype

Verified in the Rive editor on 2026-07-27:

- `pig_skin` is a Referenced image asset with `Prevent Export` behavior.
- One `pig_mesh` is bound to `body`, `head`, and
  `leg_front_screen_right`; Auto Weights has been applied once.
- `slot_head` and `slot_face` are direct children of `head`.
- `slot_held` is Transform-constrained in World space to
  `leg_front_screen_right`. The real garden-trowel image follows it through
  separate Translation and Rotation constraints, inheriting the foreleg at
  wave frame 25 and the shared root at jump frame 20. The temporary Rectangle
  proxy has been removed.
- The real party-hat image is fitted at 35% scale and follows `slot_head`
  through separate World-space Translation and Rotation constraints. This
  avoids copying the slot's scale; it remains registered at jump frame 20.
- The real pixel-glasses image is fitted at 35% scale and follows `slot_face`
  through the same Translation-and-Rotation pattern. It remains registered at
  jump frame 20.
- `idle`, `jump`, and `wave` contain only controlled numeric keys:
  - idle translates the shared body root by two points and back;
  - jump translates that same root through a 40-frame arc;
  - wave rotates only `leg_front_screen_right` between its measured
    `145.814°` rest angle and a restrained `116°` extreme.
- The `pig` state machine contains `idle`, `jump`, and `wave`, with working
  `jump` and `wave` triggers and timed returns to idle.
- Compatibility Number inputs exist for `skin`, `rest`, `equip_hat`,
  `equip_face`, and `equip_held`.
- Independent `Hat Equip`, `Face Equip`, and `Held Equip` state-machine layers
  use 0 ms transitions: `0 = hidden`, `1 = visible`, and Entry routes to hidden.
- Selector playback passes no equipment, every single representative item, and
  all three equipped together. All three remain attached at the jump apex.

All timelines use a 60 fps timebase: idle is 60 frames, jump is 40 frames, and
wave is 45 frames. An earlier numeric pass was interpreted as seconds; changing
the durations to their frame-based values rescaled the keys into the verified
positions above. The state-machine return times already match the corrected
one-shot durations.

The editor preview has proven that both one-shots enter and return to idle. The
extreme idle, jump, and wave poses retain the neutral silhouette, painted
details stay inside the shared mesh, and the visible held-item proxy follows
the foreleg without screen-space drift.

The visible selector timelines must use 100% opacity. During authoring they were
briefly keyed at 10,000%, which rendered white silhouettes; this has been
corrected for the hat, face, and held item.

Still incomplete:

- The current Rive account shows `Upgrade` for `.riv` export, so no local
  production asset exists and native six-skin/runtime validation cannot run.
- Wave attachment passes at the authored frame-25 extreme, but should be
  repeated through the exported state machine before adoption.

The rejected Rive Agent transform pass produced invalid absolute values
including a `2005.352°` leg rotation. Those keys were removed. Do not ask the
Agent to author transform keys; use measured absolute values in the Inspector.

## File and artboard

1. Create one file named `Oink homepage pig`.
2. Create one 300×300 artboard named `pig`.
3. Import Rosie, rename the image asset `pig_skin`, and mark it Referenced.
4. Center Rosie in the artboard and fit her to the same visual footprint as the
   current 300-point `SpritePig`.
5. Add a custom image mesh to Rosie. Preserve the outside contour and add enough
   internal vertices to isolate the head, body, ears, visible legs, and tail.

## Shared skeleton

Use this hierarchy:

```text
root
└── body
    ├── head
    │   ├── ear_screen_left
    │   ├── ear_screen_right
    │   ├── slot_head
    │   └── slot_face
    ├── leg_front_screen_left
    ├── leg_front_screen_right
    │   └── slot_held
    ├── leg_rear_screen_left
    └── tail
```

Bind the single `pig_skin` mesh to these bones and weight transitions broadly
enough to avoid creases in the painted outline. Do not duplicate the mesh for
the other coats. `rive-react-native@9.8.3` supplies Rosie, Copper, Pepper,
Bandit, Pickles, or Biscuit through its `referencedAssets` prop when the Rive
view mounts. Since every prepared texture has the same dimensions and alpha
field, all six pigs literally share the same vertices, triangles, bindings, and
weights.

Retain the numeric `skin` state-machine input for the renderer contract, but the
prototype's visible coat comes from the referenced `pig_skin` asset. Remounting
on pig selection is acceptable because players change their active pig
infrequently. The React renderer must replay the numeric skin, all three
equipment inputs, and the current animation after every native `onPlay`; the
remounted native instance has no state from the previous coat.

## Prototype animation set

Author these once on the shared bones:

| Animation | Behavior | Duration |
|---|---|---:|
| `idle` | subtle breathing | 1000 ms loop |
| `jump` | anticipation, lift, settle | 667 ms one-shot |
| `wave` | front leg raises and waves, then settles | 750 ms one-shot |

The durations match the renderer-neutral contract closely enough for the first
comparison. Do not animate skin mesh objects directly; animate shared bones.

## State machine

Create one state machine named `pig` with legacy-compatible inputs:

| Input | Type | Meaning |
|---|---|---|
| `skin` | Number | Compatibility input: `0` Rosie, `1` Copper, `2` Pepper, `3` Bandit, `4` Pickles, `5` Biscuit. The prototype coat is supplied through `pig_skin`. |
| `rest` | Number | `0` idle, `1` sad, `2` tired |
| `walk` | Trigger | play `walk`, then return to selected rest state |
| `jump` | Trigger | play `jump`, then return to `idle` |
| `happy` | Trigger | play `happy`, then return to selected rest state |
| `surprise` | Trigger | play `surprise`, then return to selected rest state |
| `wave` | Trigger | play `wave`, then return to `idle` |
| `equip_hat` | Number | `0` none, `1` party hat |
| `equip_face` | Number | `0` none, `1` pixel glasses |
| `equip_held` | Number | `0` none, `1` garden trowel |

`idle` is the default state. The production animation set is deliberately not
authored until this vertical slice passes.

The exact code-side input and skin maps live in
`components/ui/rivePigContract.ts`; treat that module and this table as one
contract and update both together.

## Cosmetics

Cosmetics must be inside Rive. The React Native runtime does not expose live
bone world transforms, so external `<Image>` layers cannot reliably follow
interpolated animation.

Import only these first:

- `assets/images/hats/party.png` under `slot_head`;
- `assets/images/hats/pixel_glasses.png` under `slot_face`;
- `assets/images/hats/garden_trowel_held.png` under `slot_held`.

Each slot uses a Solo with `0 = none` and `1 = item`. Check attachment at the
extreme pose of both `jump` and `wave`.

## Export

Export the binary as:

```text
assets/rive/pig.riv
```

Then run:

```sh
npm run verify:rive-pig
```

This is a static preflight only. It rejects a missing or malformed binary,
missing authored contract names, skin-map drift, wrong texture dimensions, and
alpha-geometry differences. Passing it does not satisfy the simulator/device
motion and attachment gate.

Do not replace the current homepage renderer after export. The app first loads
the file through the development audit route, maps the state-machine contract,
and runs the simulator/device comparison. `SpritePig` remains the default and
fallback until the full gate passes.

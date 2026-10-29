# Equipped pig attachment audit — 2026-10-14

PigStage now owns one source-frame clock for the raster pig and all seven
equipment slots. A surface no longer needs an `onPigFrame` callback to keep
items attached. Animation changes, repeated reactions, loop wraps, reduced
motion, freezing, and visibility changes use a coherent sprite/attachment
frame. The original reproduction was an equipped cowboy hat remaining at idle
frame 1 while the pig reached frame 7; that regression now passes.

The head rig has 288 calibrated records: six pigs × 48 unique source frames.
Hats use crown position and tilt, rather than ear-edge anchors or expression
eye spacing. Uniform hat scale stays constant within each pig/pose family.
The overlapping ears in `face_sit` require an explicit hidden-crown calibration
at `(178, 40)`, `+6°`. Item pivots, intrinsic aspect, side artwork, and layering
remain part of each item's authored fit. Category-fallback hats receive the
same head transform. Other anatomy anchors retain their existing placement.

The astronaut helmet also has authored `sad` and `tired` fit overrides. These
use uniform scale and pivot changes to clear eyes and snouts while keeping its
resting fit. Android accessory image fades are disabled on artwork switches.

## Design and preview

[Claude Design canvas](https://claude.ai/design/p/82947548-0691-46d2-b923-d2dda23be516?file=Accessory+Attachment+Audit.dc.html)
used the established Tickle the Pig Design System and the authorized Rosie
contact sheet/cowboy artwork. Its crown, tilt, stable-width, uniform-aspect, and
preview rulings guided the implementation. Exact coordinates were calibrated
against the shipping PNGs, rather than copied from its reduced reference sheet.

[Live production-renderer preview](http://127.0.0.1:6382/?pig=rosie&item=cowboy&animation=wave)
offers every pig, animation, wearable, facing, a true 300px stage, pause/step,
clickable source frames, mixed loadouts, mirrored poses, and same-mounted-stage
transitions. Each headwear item also links its complete 48-frame contact sheet.

Rebuild and serve locally:

```sh
node scripts/accessory-audit/export.mjs
python3 scripts/accessory-audit/render.py --all-hats
node scripts/accessory-audit/build-preview.mjs
python3 -m http.server 6382 --bind 127.0.0.1 --directory artifacts/accessory-attachment-preview
```

Generated runtime exports, copied preview assets, and the 306 full contact
sheets live under ignored `artifacts/accessory-attachment-preview/`. The source
landmark generator is `scripts/accessory-audit/measure-heads.py`; its committed
diagnostics and per-image SHA-256 provenance are in [landmarks](./landmarks/README.md).

## Verification

- Reviewed all 51 headwear styles × six pigs × 48 frames: **14,688 combinations**.
  See [base-pig review](./visual-review-base.md) and
  [recruit review](./visual-review-recruits.md). Final seated calibration and
  astronaut fitting were rechecked separately after changes.
- **72 targeted Jest tests passed** across ten suites. Coverage includes every
  calibrated head-item pivot, stable family widths, side selection, legacy
  fallback, helmet face clearance, all seven slots sharing playback, loop wrap,
  immediate transitions, rest tempo, reduced motion, and visibility/frozen state.
- **72 browser samples passed**, one for each animation key/pig pairing: the
  actual visible sprite and accessory box matched exported production geometry
  within 0.02px. The stage measured exactly 300 × 300px. Samples are recorded in
  [browser-frame-checks.json](./browser-frame-checks.json).
- Normal-size playback was inspected with mixed head/bow/face/held loadouts,
  large reaction poses, seated and mirrored side poses, and automatic transitions.
  [Playback screenshot](./playback-mixed-loadout.jpg) shows the real PigStage.
- TypeScript and diff checks pass. New hook, geometry, and preview code passes
  ESLint; PigStage retains its existing React ref/effect warnings.
- `quality:loop` hits the host's `EMFILE` watch limit. `quality:check` runs but
  fails on the unchanged repository baseline: 138 text clamps against a budget
  of 91, plus the default-role revoke contract for `my_drives` in
  `20260916140000_my_drives_opener_pig.sql`.

This preview verifies the raster production compositor using React Native Web.
The rollout-gated Rive prototype keeps its existing bone-owned equipment and
clock; fallback contract tests and its six-skin asset check pass. Fresh native
device acceptance and continuous Rive playback were not performed here.
Post-release checks are queued as `pig-accessory-frame-attachment`.

## Remaining artwork exceptions

These two items track their anchors consistently but still need artwork work
to satisfy the request for completely natural fit. Frames are **one-based**;
all six pigs are affected. Transform changes cannot change a hood opening or
create a missing profile view without compromising the intended fit.

| Item | Animation / frame | Remaining limitation |
| --- | --- | --- |
| `aurora_glow_hood` | `sad` 1–4; `tired` 1–4 | The deep fur opening obscures parts of the lowered face. A revised opening or pose artwork is needed. |
| `aurora_glow_hood` | `face` 1–4; `face_sit` 1–4 | Its supplied side artwork still has a rigid circular opening around the profile head. |
| `hungerers_crown` | `face` 1–4; `face_sit` 1–4 | Frontal-only wide crown artwork lacks a profile fit; no side asset is registered. |

The earlier astronaut clipping is **resolved** by the authored per-pose fit.
Its original exception capture is retained as before evidence; use the final
contact sheets for the corrected result.

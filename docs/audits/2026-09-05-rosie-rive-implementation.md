# Rosie loading and animation implementation — verification record

Date: 2026-09-05. **Partial implementation; not ready for physical-device acceptance.**

The app integration, semantic playback contract, development gallery, and safe
raster behavior are implemented. The editable prototype was located in a cloud
document, but has not been recovered into a local editable source or completed.
There is still **no `assets/rive/pig.riv`**. Native/web Rosie Rive playback,
motion quality, and attachment are unverified. The asset gate stays closed.

This record accompanies [the implementation plan](2026-09-05-rive-loading-and-rosie-states.md).
It does not supersede the release checklist or assert that its acceptance gates passed.

## Review

- Development gallery: `http://localhost:8083/rosie-gallery` (Metro must remain running).
- Route: `app/rosie-gallery.tsx`; implementation: `components/dev/screens/rosie-gallery.tsx`.
  The gallery is development-only and redirects in production.
- It exposes all nine animation values, four persistent moods, repeated reaction
  buttons, six identities, pause, Reduce Motion, asset failure/retry, navigation,
  candidate/unsupported equipment, a frozen Shop preview, loading success/error/retry,
  and a five-second JS frame sample. The visible status identifies raster fallback.
- The gallery's equipped Rive override is development-only. It does not persist
  a rollout setting or enable the production Barn. With a verified asset present,
  this allows attachment testing before enabling the production rollout.

![Rosie with candidate equipment, raster fallback](../../artifacts/rosie-rive-2026-09-05/gallery-rosie-raster.png)

The screenshot is **raster**, with Reduce Motion on. Six separate coat captures
and an actual web asset-error capture are in `artifacts/rosie-rive-2026-09-05/`.

## Source recovery and provenance

The July documentation called the source **Oink homepage pig**. The strongest
recovered candidate is now named **Homegrown Adventures**, in the Tickle the Pig
workspace, Personal Files project `1739111`:

<https://editor.rive.app/file/homegrown-adventures/2462699>

The browser editor hierarchy exposes the `pig` state machine, `idle`, `jump`,
`wave`, equipment visibility timelines, and party/pixel-glasses/garden-trowel
assets. The document has subsequently acquired adventure scenery and a renamed
main artboard. These observations identify a recovery candidate, not a verified
snapshot of the approved July mesh. Inspect revision history and recover into an
isolated document before modifying it; preserve the adventure work.

No matching editable `.rev` was found in the scoped local source search.
The browser's Download Backup/Download Revision actions did not produce a
verified local download. No current account export restriction was established.

Local `homegrown_adventures` runtime exports contain `pig_skin`, but are not
interchangeable with the required standalone pig. The actual installed WASM
runtime imported `~/Downloads/homegrown_adventures (7).riv` and the new gate
rejected it because artboard `pig` is absent (`recovered-candidate-runtime.log`).
No adventure file or generic sample was renamed to `pig.riv`.

The Rive connector currently exposes only Mote Machine artboards, including
active `0-355 / MOTE MACHINE`. Its callable file tools manage the open document's
artboards; they cannot select another cloud document. Native computer controls
are disabled in this session. The user was asked to open the linked document in
Rive Early Access. No Rosie rig edits or exports were performed through the
connector, and no Mote Machine artboards were changed by this task.

When authoring is complete, preserve the `.rev` source, source file/revision IDs,
export timestamp, runtime version, SHA-256 of source and `.riv`, and the verified
artboard/mesh/bone inventory. Record neutral-pose comparisons against the approved
Rosie artwork and all six referenced coats. Those provenance fields remain pending.

## Implemented app behavior

`PigRenderer` and `PigStage` remain the rendering seams. A reaction carries an
explicit sequence ID, separate from resting mood and activity. Both adapters
write persistent inputs independently from reaction identity. The raster
adapter restarts identical requests, completes once, and restores the newest
mood. Normal Barn reaction timers were removed; the existing special 6–7
audio/digits choreography retains its own bounded lifetime.

`WaitingRosie` reserves its footprint and exposes a static pose immediately,
mounting an animated renderer only after 200 ms. Loading text is accessible and
busy; request completion has no animation delay. Shared `LoadingBeat`, profile
loading, and Contraptions use it. Onboarding animates only the current page.
Lucky Pig uses a temporary jump and persistent happy mood.

Barn and Visits submit semantic reactions while preserving immediate gameplay
callbacks/haptics. Closet receives the active identity instead of always Rosie.
Barn pauses while a popup covers it; Closet pauses for an item preview. The
shared visibility hook combines explicit visibility, navigation focus, and
AppState. Sprite timers stop while inactive. Reduce Motion uses a stable raster
pose and preserves completion without starting a frame interval.

The native adapter separates view readiness from animation changes, supplies a
referenced coat, uses completion events, pauses/resumes, and falls back on errors
or a four-second readiness timeout. The web adapter uses WebGL2, decodes the
referenced coat, disables asset CDN loading, and provides the same port contract
and error behavior. Web canvases share the runtime's offscreen renderer. Actual
native playback is still unverified. Native file decoding is currently owned by
each instance through the installed `useRiveFile` hook, not pooled.

**Lifetime review still required:** the installed native hook disposes a file
already resolved at cleanup, but its source does not dispose a file that resolves
after that cleanup. Address and test this late-resolution path before opening
the asset gate for frequently mounted loaders. Validate any decode-sharing
change with independent state machines and coats; never mutate a shared file's
coat underneath another visible pig.

Only party hat, pixel glasses, and garden trowel are attachment candidates.
Unsupported items, bows/masks/neck items, tints, custom placements, pre-baked
looks, and frozen previews keep the complete existing raster stage. Raster
equipment remains visible until Rive reports ready, and returns on failure.
External Barn/Visit squish stops when the Rive stage actually owns the pig.

`components/ui/rivePigAsset.ts` deliberately exports `undefined`. Replace it
with a static local require only after the authoring and playback gates pass.
The production equipped renderer additionally requires its existing rollout gate.
Neither missing files nor an enabled rollout flag can select Rive alone.

Removed superseded prototype animation gating, the unused sprite duration
wrapper, and normal reaction-revert timers. Sprite artwork remains necessary
for the active fallback, unsupported cosmetics, frozen Shop previews, and other
consumers; no sprite assets were deleted by this task.

## Current runtime contract to author

One artboard `pig`, one state machine `pig`, one referenced image `pig_skin`,
one approved mesh topology/weight map and shared skeleton across all six coats.
The prepared coat order remains Rosie, Copper, Pepper, Bandit, Pickles, Biscuit.

| Input | Type | Meaning |
| --- | --- | --- |
| `skin` | Number | 0–5 identity metadata; actual coat comes from `pig_skin` |
| `rest` | Number | 0 idle/content, 1 sad, 2 tired, 3 happy |
| `activity` | Number | 0 rest, 1 walk loop, 2 bounce loop, 3 wave loop |
| `happy`, `jump`, `surprise`, `wave` | Trigger | Interruptible temporary reaction |
| `equip_hat`, `equip_face`, `equip_held` | Number | 0 hidden, 1 candidate item |

Persistent state names are `idle`, `sad`, `tired`, `happy`, `walk`, `bounce`, and
`wave`. Reaction state names are `jump`, `surprise`, `happy_reaction`, and
`wave_reaction`. The latter two must not emit completion from their persistent
counterparts. Emit exactly one Rive event named `reaction_complete` on completion
of the current reaction, never on interruption or from a looping activity.
Allow self re-entry from repeated identical triggers. Reaction completion routes
to the latest requested rest/activity, rather than hard-coding idle. Persistent
input changes must not cut off or restart a reaction. Check mixed interruptions
as well as repeated identical taps.

The existing rig's controlled numeric transforms and attachment constraints are
the starting point. New animation cannot silently substitute artwork, split
painted parts, or introduce a separate skeleton/graph for each coat.

`npm run verify:rive-pig` checks texture geometry and binary contract names, then
runs `scripts/rive/test-pig-state-machine.mjs` with the installed WASM engine.
The graph test checks rest/activity entry, repeated self re-entry, newest-mood
returns, mixed interruption, completion counts, and six skin/equipment selectors.
Its no-op image loader deliberately cannot certify pixels or attachment. This
gate currently fails before graph testing because the production file is absent.

## Verification evidence

All paths below are under `artifacts/rosie-rive-2026-09-05/`.

| Check | Result | Evidence / limits |
| --- | --- | --- |
| Full Jest suite | 155 suites, 1,398 tests pass | `full-jest.log`; includes mocked native bindings, not real Rosie playback |
| Focused presentation tests | 6 suites, 46 tests pass | `pig-tests.log`; repeated requests, mood return, Reduce Motion, visibility, AppState, loading delay, renderer/appearance fallback |
| TypeScript | Pass | `typecheck.log` |
| Fast quality gate | Pass | `quality-check.log`; quality watcher also ran during layout edits |
| Scoped source ESLint | 0 errors, 111 warnings | `scoped-lint.log`; not a warning-free result |
| Web export/boundary smoke | Pass, two Expo bundles | `web-export.log`; approved WebGL2 boundary, no native runtime leakage |
| iOS production export | Pass | `after-ios-export.json` and retained output directory |
| Android production export | Pass | `android-export.log`; `/tmp/oink-rosie-android-export` |
| Six prepared textures | Pass, 370×383, identical alpha | `skin-geometry.log`; geometry does not prove visual deformation |
| Production pig graph | **Blocked/fail** | `rig-gate.log`; `pig.riv` absent |
| Local Debug simulator build | Pass and installed | `simulator-build.log`; native linkage/build only |

Jest used `--forceExit` after reporting results. A diagnostic open-handle run
identified a Sentry `AsyncExpiringMap` interval through logging; see
`pig-handles.log`. This is not evidence of native animation memory stability.

Browser checks used the development gallery at 390×844:

- Two wave taps followed by a sad mood produced one completion and returned to sad.
- A Reduce Motion jump completed immediately; all six static coats and candidate
  equipment were visually inspected and captured.
- Pausing held a pending jump across subsequent checks; resuming completed it once.
- Request failure showed its error and Try again; retry exposed content without
  an animation wait. Fast-request initialization/unmount is also covered in Jest.
- An actual WebGL2 load of the generic runtime sample with the required `pig`
  artboard failed as intended. The entire equipped raster stage stayed visible.
  Retry returned to the explicit missing-asset fallback. Cowboy appearance also
  retained the raster stage.
- Navigation to `/ui-audit` and back preserved gallery state without an error.
  This is not a physical background/foreground test.

## Measurements — no improvement claim

Baseline is the working tree at task start, based on
`dd4516ba4ff8495f9a7c6c8bdca90390c70c141f`, with extensive pre-existing changes.
`preexisting-tracked.patch` preserves its tracked diff. These are aggregate
working-tree export observations, not an isolated production Rive A/B experiment.

| Metric | Before | Current | Interpretation |
| --- | ---: | ---: | --- |
| Exported asset count | 759 | 759 | Sprite assets still required |
| Exported asset bytes | 70,742,823 | 70,742,823 | No asset reduction |
| iOS Hermes bytes | 8,329,412 | 8,366,444 | +37,032 bytes |
| Total export bytes, including maps | 98,292,501 | 98,341,961 | Not an IPA/download-size measurement |
| Export wall time | 14,967 ms | 16,345 ms | Build tooling time; machine load/cache differ |
| Metro bundle time | 11,414 ms | 12,080 ms | Does not measure app startup |
| Browser development JS sample | No paired sample | 601 callbacks / 5 s, p95 10.0 ms, max 10.4 ms | Raster gallery, 120 Hz host; not native UI FPS |
| Cold/warm first usable screen | Not measured | Not measured | Requires controlled installed-binary comparison |
| Loader canvas mount cost | Not measured | Not measured | Production Rosie asset absent |
| Native frame rate / memory after navigation | Not measured | Not measured | Required before performance acceptance |

## Installed simulator build

Classification: **local Debug simulator host**, not a distributable, RC, IPA,
TestFlight upload, or store build. No EAS invocation, database push, upload, or
build-number increment was performed.

```sh
NODE_OPTIONS='--max-old-space-size=16384' SENTRY_DISABLE_AUTO_UPLOAD=true \
xcodebuild -workspace ios/ttp.xcworkspace -scheme ttp -configuration Debug \
  -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,id=CD15DE05-E6E0-4689-8A73-9589DACF9A1E' \
  -derivedDataPath /tmp/oink-rosie-rive-simulator CODE_SIGNING_ALLOWED=NO build
```

Installed on iPhone 17 Pro / iOS 26.4, bundle ID `com.broeking.ttp`:
`/tmp/oink-rosie-rive-simulator/Build/Products/Debug-iphonesimulator/TicklethePig.app`.
This Debug host obtains current JavaScript from Metro at port 8083.

The launch sequence stopped at the simulator's **Open in “Tickle the Pig”?**
dialog. `simulator-gallery.png` records that prompt, not a successful native
gallery session. Native controls are unavailable to this agent, so the user must
complete the prompt and open the gallery. Native playback/navigation acceptance
has not been performed. A successful build/install alone does not satisfy it.

## Remaining work and physical acceptance

Before physical acceptance: recover and preserve editable source; complete the
shared rig/graph; export and verify local `pig.riv`; verify native/web pixels and
events; fix/test native late-load disposal and evaluate decode sharing; inspect
all six coats and candidate cosmetics through motion/interruption; then enable
the asset gate and repeat exports, simulator review, and controlled measurements.

Physical-device checklist after those engineering gates pass:

1. Cold/warm launch, fast/slow/error/retry loaders; VoiceOver loading text and
   immediate content reveal; Dynamic Type and safe areas.
2. All nine states, rapid identical/mixed reactions, changing mood mid-reaction,
   and immediate Barn/Visit haptics/gameplay; onboarding and Lucky Pig parity.
3. All six skins; hat/glasses/trowel at jump/wave extremes; unsupported cosmetics,
   tint/pre-baked looks, and frozen Shop previews remain correct.
4. Reduce Motion before launch and toggled while open; navigation, modal coverage,
   lock/background/foreground, asset errors and retry with no stale completion.
5. Sustained UI/JS frame behavior, memory after repeated navigation, first usable
   screen and loader mount cost, thermal/battery behavior on representative devices.

Release follow-up `rosie-rive-loading-states` is queued in
`docs/release-followups.json`. Attach it to the first distributable build containing
these changes; it is neither attached nor marked notified by this simulator build.

## Follow-up: intermittent rear hoof in the raster idle

User review found the rear hoof appearing/disappearing during idle. Inspection of
the four original Rosie PNGs confirmed a source-art stance mismatch: frames 1/3
hide the far rear hoof behind the body; frames 2/4 use a matching standing pose
with it visible. No Rive asset was playing when this was reported.

The base idle now plays source indices `1, 1, 3, 3`, holding each standing pose
for 800 ms and preserving the 1,600 ms cycle. All six identities use this same
sequence. `onFrame` reports the actual source index so existing cosmetic anchors
stay aligned. The gallery now tracks that index for its equipped preview.
Explicit frozen frames, Reduce Motion's original static pose, and custom
pre-baked sequences retain their behavior. No artwork files were changed.

Follow-up verification: 34 tests across five relevant suites pass
(`hoof-tests.log`), TypeScript passes (`hoof-typecheck.log`), and
`quality:check` passes (`hoof-quality-check.log`). The browser gallery was checked
with and without candidate equipment. Export sizes, full-suite results, build
evidence, and source hashes earlier in this document describe the preceding
implementation snapshot; no new native build or performance claim accompanies
this small playback correction.

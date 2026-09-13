# Living Mud Patch — production implementation plan

Status: execution approved by Brian on September 12. The native surface, generated production art, progress persistence, and durable receipt API are implemented. Native acceptance and production migration go are pending; this is not yet live.

## Release order

Recommended sequence: ship the timezone-compatible client first, then Living
Mud Patch. The server's `commuter_local` schedule is already active, but build
180 does not understand it or register player timezones. At activation, no
non-test player had a registered zone; the server therefore used Eastern time.
Do not make that compatibility fix wait for new art or interaction work.

Brian approved executing this sequence. Timezone compatibility is packaging as non-RC TestFlight build 181 from an isolated source snapshot. Living Mud will use a separate tested build after its database and native gates.

## What we are building

A warm, short digging session: brush a continuous mud patch, uncover the
existing finds, pack them, and return to the Barn. The approved visual authority
is [Living Mud Patch](2026-09-12-living-mud-patch.md), especially
`04-living-mud-patch-active.png` and `05-living-mud-patch-complete.png`.

The patch occupies most of the active screen. The Hungerer sits at its far
edge; Rosie and the pouch sit near the player. Native text and controls carry
“Brush the mud away,” “Pack up,” “Finds packed,” and “Back to Barn.”
The completion state replaces the active instructions. Share/history are
secondary actions. “Back to Barn” must actually return to the Barn even when
the session was opened from Season.

The seeded 6×5 board remains underneath the mud. Preserve board generation,
rub/shove physics, the 20/25 solo/co-op stir budget, free-rub streaks, cluster
completion, blessings, crew echo, relics, carry-forward finds and existing
reward amounts. Preserve feature visibility: the illustration's key, glow,
three-find count and other sample content do not add new rewards or expose
the hidden Mote Machine. Practice stays distinct; its existing one-time
Beginner's Snout gift appears only when its own RPC confirms it.

## Work packages and acceptance

| Order | Deliverable | Main ownership | Acceptance |
| --- | --- | --- | --- |
| 1 | Reliable session and receipt lifecycle | `hooks/useRooting.ts`, `utils/digSession.ts`, `components/mudwar/useFeedingCta.tsx`, a new durable pending-submission module, and an additive receipt migration if needed | A committed dig can recover its exact receipt after a lost response or relaunch; retry cannot mint twice; completed sessions cannot reopen as a fresh board |
| 2 | Deterministic brushing | New `utils/digBrush.ts` and focused tests | Equivalent sampled traces produce the same rub/shove actions and stir spend; hold, cancellation, disabled state and off-edge behavior are explicit |
| 3 | Layered mud renderer and production art | New `components/mudwar/LivingMudSurface.tsx`, production assets under `assets/images/patch/living-mud/` | One continuous patch matches the selected composition; accepted board state alone controls reveal; every playable location remains reachable |
| 4 | Full active-to-completed integration | `components/mudwar/TrufflePatch.tsx`, modal host, receipt presentation and navigation | Correct loading, brushing, submitting, uncertain, recovered, expired, practice and completed states; confirmed completion hides the Feeding entry after dismissal |
| 5 | Native acceptance and release | New build record, release follow-up and exact-binary evidence | Small/large phones, VoiceOver, large text, Reduce Motion, poor network, lifecycle and performance checks pass; local TestFlight then an accepted release candidate |

Keep file ownership separate while work runs in parallel: the session owner
owns the hook/reducer/persistence; the surface owner owns the new renderer and
sampler; the lead owns `TrufflePatch.tsx` integration and final verification.
Art production can run alongside the session work. Do not let multiple agents
rewrite the existing 2,604-line component concurrently.

## Session correctness before visual integration

The audit found these concrete gaps:

- `TrufflePatch.finish()` ends the session before awaiting a single submission
  and has no retry path after a transport failure. A server commit followed by
  a lost response becomes an unconfirmed result. The current “remember your
  armful” copy overstates the recovery that exists.
- The modal's close callback remains `clear` during submission. Dismissal can
  remove the result surface before the request finishes.
- `open_rooting` can return `already: true`; the hook still installs the
  returned session. A stale entry can reopen a completed board.
- The component does not enforce the server-issued session expiry. Reopening
  currently rebuilds from the seed rather than restoring excavated progress.

Use explicit states: opening → digging → submitting → confirmed receipt, with
separate uncertain, refused and expired states. A timeout is **uncertain**,
not proof that nothing was banked. Disable gestures and modal dismissal while
a request is in flight. An uncertain result offers “Check result” / retry and
an honest recoverable exit; it must not trap the player indefinitely.

Persist the sanitized pending submission under the authenticated user and
server-issued window before sending it. Persist active logical progress
(layers, accepted action ledger, collected finds, stir/free-rub state) if the
UI continues to promise that leaving preserves progress. Reconstruct the mud
from those values; raw brush pixels are not saved-game truth. Bind restores
to the same account, seed and unexpired window.

Prefer a server-stored receipt keyed by user/window, written atomically with
the existing reward transaction and readable by that owner. Duplicate submits
and a receipt read must return the original credited outcome rather than
recomputing echo, blessing or rewards from current state. Confirm whether all
required fields already exist before choosing the final schema. If a new
migration is required, author and test it separately after the applied
`20260913000000` boundary; production push needs Brian's explicit database go.
Do not reconstruct a personal receipt from changes in a global meter.

Expiry must follow the actual server contract, including its distinction
between the open phase and the session/window end. Reconcile at foreground
and before submission. Stop new actions when the session is no longer valid,
retain a recovery path for an uncertain request already sent, and test the
Monday timezone-change boundary. Do not silently introduce a grace period.

## Rendering and gesture boundary

Use the installed React Native Skia renderer for one Canvas; the project
already exercises Skia in `app/lounge.tsx`. Retain native controls and the
existing session adapter. Start with the current PanResponder approach to
avoid replacing the gesture stack at the same time as the surface.

`LivingMudSurface` takes the board, current layers/reveal state, disabled and
motion settings, and emits semantic `rub`/`shove` actions with a board index.
It owns drawing, point conversion, transient brush trails and the accessible
board overlay. `TrufflePatch` remains responsible for accepted actions, stir,
find collection, haptics/audio, finish and submission.

The pure brush sampler must be independent of event frequency. Normalize
movement to board geometry and emit bounded semantic actions from distance
and direction changes; calibrate the cadence against the existing game.
A stationary hold produces one shove; moving cancels the hold; a tap remains
one accessible rub. Never spend stir on every incoming move event. Test sparse
and dense samples of the same path, and prevent touch cancellation, multitouch,
backgrounding or layout changes from inventing an action.

Cosmetic mud displacement can follow the finger immediately. Reward exposure
and collection must follow `utils/rooting.ts` layer/cluster rules. Mask alpha,
brush speed and decorative particles never decide a find. Use the same
coordinate transform for drawing, hit testing and the 30 native accessibility
targets. Organic edges may decorate outside the playable field; they must not
hide corner cells or reveal adjacent buried rewards.

Keep the old renderer available for development comparison while the new
surface is built. Freeze the selected renderer for an open session. Decide
whether the fallback remains in the release after device acceptance; do not
add a remotely mutable mid-session switch by default.

## Art production packet

The concept files are excluded from builds by `.easignore`. They are
references, not shipping assets. Produce the following layers using the
selected composition and palette:

| Asset | Content | Constraints |
| --- | --- | --- |
| Forest backdrop | Distant clearing and atmosphere | No text, pigs, baked rewards, controls or receipt numbers |
| Patch surround | Roots, grass and organic earth rim | Transparent center; works around a fully reachable playable field |
| Mud textures | Coherent deep/top soil and restrained crumb material | No hidden object silhouettes baked into texture; masks derive from game state |
| Pouch | Empty pouch and optional decorative fill layers | Real find count is native text driven by the session/receipt |
| Characters and finds | Existing Rosie, Hungerer, truffle, relic and junk art | Reuse the game's assets; newly generated character variations require visual comparison with the established characters |

Keep prompts and provenance beside generated assets. Optimize at actual device
display sizes, inspect alpha edges and texture memory, and verify required
assets appear in the exported app bundle. All readable text and touch targets
remain native. Reuse existing scrape, pop, shimmer and pouch sounds, with
bounded haptics/audio per accepted action.

## Evidence required before packaging

- **Parity:** fixed seed and semantic actions produce unchanged layers, stir,
  finds, missed finds and submission payload; no premature reward exposure.
- **Lifecycle integration:** commit-then-timeout, retry, duplicate response,
  relaunch, account switch, stale completed open, expiry, modal back and
  background during both gesture and submission. Check real and practice
  paths separately.
- **Accessibility:** every playable spot exposes native rub/shove actions and
  depth/reveal information; at least 44pt targets; receipt focus/announcement;
  large text leaves the primary action reachable. Reduce Motion removes
  decorative travel while preserving all state changes.
- **Visual and performance:** compare active and completed native captures
  with the selected mockups at small and large supported phone sizes; measure
  frame pacing during continuous brushing on the oldest supported device and
  verify memory settles across repeated sessions. Target smooth 60fps play;
  a static screenshot is not performance evidence.
- **Quality:** run `npm run quality:loop` during implementation and
  `npm run quality:check` before handoff. Run the full release-grade gates,
  focused session/gesture tests, and database harness for any receipt migration.

## Build, upload and public release

Follow `docs/RELEASE_CHECKLIST.md`. Reconcile the intended release source with
the heavily dirty shared workspace and record its exact provenance; do not
silently bundle unrelated changes. Enqueue the redesign and any receipt/API
change in `docs/release-followups.json` while authoring them, then attach them
and the existing timezone entry to the first containing build.

Write the changelog before invoking EAS and give the pre-build gate report.
Package locally with the required 16GB heap, inspect the signed IPA, record
the actual incremented build number, rename the artifact, and open Transporter.
Brian owns Apple ID sign-in and the final Deliver click.

Test the exact installed TestFlight binary against the active production
schedule, including a non-Eastern and fractional-offset account, confirmed
completed-entry hiding, recovery and Sentry. Public release requires the RC
lane and explicit go/no-go. Any change after an RC invalidates that candidate.
Neither a concept image nor a successful build constitutes store release.

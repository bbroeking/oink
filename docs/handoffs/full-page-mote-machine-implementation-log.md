# Full-page Mote Machine implementation log

## 2026-08-14 baseline inspection

- Working tree: broad and dirty on `main` at `6a30b3d`; all unrelated user
  changes preserved.
- Runtime baseline: `886,139` bytes,
  SHA-256 `8cd5b7205aeae960bf0e9a81cf9ef0005e96bc32aff6c42818c6d3fcddba20fc`.
  The asset, iOS, and Android runtime copies were byte-identical.
- Recoverable backups created at
  `assets/rive/backups/mote-machine-pre-full-page-2026-08-14.rev` and `.riv`.
- iPhone 16 Pro baseline screenshot:
  `artifacts/mote-machine/baseline-iphone16pro.png`. It shows the simplified
  160-208 pt `Fit.Contain` machine embedded in a cream scrolling page with a
  duplicate native title, balance, result card, CTA, and prize shelf.
- MCP readback: active artboard `MOTE MACHINE` (`9-16`); state machine
  `MoteMachine` (`9-21`); animations `Machine Spin` 2.2 s and
  `Machine Settle` 0.2 s; View Model `MoteMachineViewModel` (`9-628`) and
  instance `Default` (`9-629`). Only the six v1 properties existed. Listener
  `Spin request` observed `spin` and had zero actions. No `*Hit Area` objects
  existed. Full-spin reel keys still ended independently at frames 96, 108,
  and 120; reduced settle retained its 12-frame path.
- Baseline focused tests: 8/8 passed. Baseline name-only Rive verifier passed
  its ten v1 names.
- Independent layout assessment and detector: the deterministic detector was
  clean; manual inspection found only the compact balance pill's `5/10/5`
  spacing drift. Both assessments identified the structural blocker: cream
  `ScrollView`, cropped `Fit.Contain` host, 208 pt cabinet ceiling, and duplicate
  native visual roles.

## Registered layer pack

- Created `assets/concepts/mote-machine/runtime-layers/` with one 780 x 1688
  full-bleed room background, one transparent empty-socket cabinet shell, one
  reusable crisp reel strip, separate lever arm and knob, separate Mote, and a
  separate Tickles reward symbol.
- Runtime textures total about 1.25 MB and every longest edge is <= 1933 px.
- Manifest: `assets/concepts/mote-machine/runtime-layers/manifest.json`.
- Visual composite:
  `artifacts/mote-machine/layer-validation/registered-ready-composite.png`.
  The initial cabinet isolation baked Mote symbols into both sockets; visual QA
  caught this and a targeted second pass replaced only those emblems with empty
  recessed sockets before Rive import.

## Remaining loop

- Obtain/export the changed `.riv`, synchronize native copies, and run the
  simulator and repository acceptance matrices.
- No database push, production mutation, distributable build, upload, staging,
  commit, or push has occurred.

## 2026-08-14 Rive v2 authoring readback

- Retained `MOTE MACHINE · PRE REDESIGN REF` (`0-355`) as a non-exported,
  non-published reference artboard. Only `MOTE MACHINE` (`9-16`) is included in
  export. Removed the old `Machine Root` vector tree from the runtime artboard
  after its replacement was complete.
- Uploaded seven embedded, export-included assets: `Room Background`, `Cabinet
  Shell`, `Reel Strip`, `Lever Arm`, `Lever Knob`, `Mote Symbol`, and `Reward
  Symbol`. All nine legacy `frame-*` assets remain source-only with
  `includeInExport = false`; there are no `frame-*` instances on the runtime
  artboard.
- Created clipped `Full Page Layout` (`0-1160`) at 390 x 844 with front-to-back
  branches `Interaction Layer`, `Live HUD`, `Machine Foreground`, and `Scene
  Background`. The hierarchy contains the Rive-owned machine title, live
  balance, carved cabinet, three independently clipped reels, separate lever
  pieces, Mote/reward symbols, prize shelf, action, and status copy.
- Corrected Rive's container-normalized image basis after readback. Final
  computed dimensions are background 390 x 844, cabinet 350 x 525, reel strips
  70 x 435 inside independent 70 x 132 clips, lever arm 51 x 168, lever knob
  41 x 48, crown Mote 29 x 37, playable Mote 27 x 34, and reward 46 x 48. The
  cabinet/reward animation scale keys were converted proportionally.
- `MoteMachineViewModel` now exposes all 12 v2 contract properties plus the
  clearly private `_playPressed` and `_leverPressed` booleans. `Default` is
  bound to the runtime artboard; live text runs bind to `motesLabel`,
  `ticklesLabel`, `actionLabel`, and `statusLabel`.
- `Play Hit Area` is 270 x 58 and `Lever Hit Area` is 96 x 220. Both are opaque
  interaction targets with transparent paint. Each has Down feedback,
  Up/Exit reset, and Click -> `requestPlay` listeners.
- State machine `MoteMachine` retains `Machine Spin` at 2.2 seconds and
  `Machine Settle` at 0.2 seconds. `spin` still routes through `reduceMotion`.
  The full path moves the three 435 pt strips through coverage-safe ranges to
  independent stops at frames 96, 108, and 120; drives lever, Mote insertion,
  cabinet response, action squash, and reward reveal. Both normal and reduced
  paths now enter `Result Hold`, which preserves the confirmed reward and has
  explicit replay transitions back through the appropriate motion path.
  Additional layers cover play press,
  lever press, and Ready/Settled, Empty, Confirming, and Uncertain/Safe Error
  treatments.
- Visual editor inspection caught and corrected three final composition gaps:
  the reel clips now fill the cabinet opening without black/blank bottoms, the
  balance label includes its Mote icon, and the prize shelf shows four source-
  registered symbols beside `+3`, `+5`, `+10`, and `+25`.

## Native v2 integration and pre-export checks

- Replaced the cream scrolling host with a deep-plum safe-area page whose Rive
  view uses `Fit.Layout`. Removed all visible duplicate native machine UI while
  retaining one 44 x 44 native back control and a screen-reader-only native
  action/status surface.
- The native binding reads/writes the complete v2 View Model, observes
  `requestPlay`, writes all confirmed values before `spin`, and fails closed on
  any missing contract property. The route retains the synchronous in-flight
  latch, durable request ID, server-owned reward boundary, timeout replay,
  Reduced Motion path, and one VoiceOver result announcement per `spin_id`.
- Focused Mote Machine suites: 4 suites, 16 tests passed. Targeted ESLint passed
  with zero findings. Repository lint exited 0 with 386 pre-existing warnings.
  The live `quality:loop` checkpoint passed quality contracts, sprite
  integrity, TypeScript, 78 layout tests, and 202 security tests.
- The strengthened verifier requires every runtime-retained v2 contract name,
  all seven approved generated asset names, `Result Hold`, the reveal/press/
  button state layers, and both play-request listeners. Rive's runtime exporter
  strips ordinary layout-instance names even with editor optimization set to
  None, so the complete layout/hit-area/prize-symbol hierarchy is evidenced by
  the MCP readback above rather than pretending those strings exist in the
  binary;
  rejects `frame-*` and Snout references, validates the `RIVE` header, and
  proves the asset/iOS/Android runtime files are byte-identical. It intentionally
  cannot pass until the newly authored runtime has been exported and synced.
- The Rive MCP has no runtime export command. The next required action is the
  exact manual export checkpoint in the implementation prompt.

## Development acceptance seam and full local gate

- Added an explicit development-only acceptance client selected with the
  `/mote-machine` query parameter `acceptance`. `sequence` provides eight local
  Motes and returns `+3`, `+5`, `+10`, and `+25` in order;
  `timeout-after-commit` stores/debits one local receipt, returns an uncertain
  first response, and replays the same receipt for the same durable request ID;
  `empty` starts at zero Motes. The client never imports or calls Supabase/RPC
  code and returns `null` outside `__DEV__`.
- Added a development-only `forceRiveFailure=1` route parameter. The real native
  fallback now distinguishes the pre-confirmation promise (“Your Mote was not
  spent”) from a post-confirmation safe receipt and provides a 48 pt accessible
  `RELOAD MACHINE` action. The production screen remounts the Rive runtime for
  retry while retaining the native back path.
- Acceptance/focused suites: 5 suites, 22 tests passed, including all four
  reward amounts, one-debit idempotent replay, timeout-after-commit, zero Motes,
  development-only isolation, and truthful fallback copy.
- `npm run quality:check:full` passed: quality contracts; 324 sprite integrity
  checks; TypeScript; 136 Jest suites / 1,328 tests; production lint with
  warnings only; simulator-free iOS Metro export; database harness; and linked
  database lint with zero findings.
- The strengthened verifier was run against the still-old 886,139-byte runtime
  and correctly rejected it at missing authored name `requestPlay`. This is an
  expected checkpoint failure, not an accepted runtime.

## Runtime export, fluid-motion correction, and simulator readback

- Exported the authored source through the authenticated Rive editor. The
  first accepted full-page runtime was 2,104,771 bytes with SHA-256
  `4b42c6cd9fc9d38f29cc354a803a7b5295d58d6c55eeb2c147d880ccbe095c35`.
  The editor's ordinary runtime-download path then proved stale while tuning
  motion: saved revisions and source-visible keyframe changes repeatedly
  returned those exact old bytes. Exporting the live `.rev`, importing that
  exact revision into a fresh project file, and exporting from the fresh
  compiler produced byte-distinct runtimes. The canonical source remains file
  `2506441`; the temporary fresh-compile files are `2508520`, `2508528`, and
  `2508533`.
- Simulator recording exposed the founder-reported motion defect: each reel
  originally had only a start and end translation and nearly every animated
  property used straight linear interpolation. A first correction added eased
  lever anticipation/rebound, Mote insertion, cabinet compression/wiggle,
  crown pulse, reel braking, and a spring reward reveal. Visual readback showed
  that repeated ease-in/out segments still lingered and each 435 pt strip could
  traverse only about three symbols.
- Added source objects `Reel Strip 1 Loop`, `Reel Strip 2 Loop`, and
  `Reel Strip 3 Loop` as seamless siblings inside their existing independent
  clips. Each pair now travels roughly 1.7 strip lengths, uses continuous
  linear velocity through the mid-spin, then brakes and overshoots at frames
  78/90/104 before springing to independent stops at 96/108/120. No blank seam
  or black frame appeared in the native recording.
- The lever's raster pieces rotated around their own centers, so rotation alone
  barely read. `Machine Spin` now adds a visible down-left positional arc plus
  rebound for `Lever Arm` and `Lever Knob`; `Lever Press Feedback` uses the same
  direction over seven frames for immediate pointer-down response.
- Final runtime: 2,104,771 bytes, SHA-256
  `9dd461b631830ac612173071d2ef184c8f07a7966548e533ded6742f81914e5a`.
  `assets/rive/mote-machine.riv`, `ios/ttp/mote_machine.riv`, and
  `android/app/src/main/res/raw/mote_machine.riv` are byte-identical and the
  strengthened verifier passes all 32 runtime-retained names.
- Latest iPhone 16 Pro evidence:
  `artifacts/mote-machine/fluid-motion-final.mov` records the continuous reels,
  staggered braking, cabinet response, lever arc, and reward settle in one
  mounted session. `artifacts/mote-machine/fluid-motion-lever-direct-settled.png`
  proves a direct visible-lever play reached a confirmed `+10` result and spent
  one Mote. Simulator screen recording paints a development/system blue status
  strip; ordinary screenshots confirm that strip is not part of the app or
  Rive scene.

## Final local acceptance and terminal status

- The final `npm run quality:check:full` report is green for every gate:
  quality contracts, layout contracts, all 324 sprite integrity checks,
  security contracts, TypeScript, 137 Jest suites / 1,329 tests, production
  lint (warnings only), simulator-free iOS Metro export, database harness, and
  linked database lint. The machine verifier also passes all 32 retained names
  and all three 2,104,771-byte runtime copies remain byte-identical at SHA-256
  `9dd461b631830ac612173071d2ef184c8f07a7966548e533ded6742f81914e5a`.
- Final visual acceptance covers an iPhone 16 Pro mounted-session action play
  (`artifacts/mote-machine/fluid-motion-final.mov`), a direct lever play settled
  at `+10` (`fluid-motion-lever-direct-settled.png`), and the 390 x 844 iPhone
  16e composition (`final-iphone16e-ready.png`). No reel seam, black/blank
  frame, clipping, or duplicate native visual surface appears in the ordinary
  simulator captures.
- Reduced Motion was enabled at the OS level and the machine settled at `+3`
  after the short path (`final-reduced-motion.png`); the setting was restored
  afterward. The native accessibility tree was captured in Ready, Busy, and
  Settled states as `final-a11y-ready.json`, `final-a11y-busy.json`, and
  `final-a11y-settled.json`. It exposes a 44 x 44 back control and a 278 x 88
  action surface; Busy is disabled and reports `busy`. Source/tests guard the
  result announcement to once per `spin_id`.
- The deterministic acceptance seam completed `+3`, `+5`, `+10`, and `+25`,
  rapid alternating action/lever input with one receipt/debit, three-plus
  consecutive plays without remounting, timeout-after-commit replay with the
  same request ID, background/resume confirmation, Empty, and fallback before
  and after confirmation. The safe fallback crash regression is covered by
  `__tests__/MoteMachineRive.native.test.tsx`.
- Read-only acceptance against the real server is captured at
  `artifacts/mote-machine/real-server-read-only.png`: the signed-in test account
  had zero Motes, so the UI correctly showed `0 MOTES` and `FIND A MOTE TO PLAY`.
  No production mutation was authorized. A real RPC spend with a spendable
  Mote, physical-device VoiceOver speech confirmation, and release/device
  performance checks remain explicit manual gates rather than local failures.
- No database push, production data mutation, EAS/distributable build,
  Transporter/store upload, staging, commit, or push was performed.

## Founder polish pass: motion, typography, and slot control

- Reworked the visible hierarchy in the authoritative desktop Rive source so
  the title, balance, action label, status, and prize values are optically
  centered. The title uses Caprasimo and supporting labels use Nunito Extra
  Bold. The primary action is now a brass slot-machine housing with a recessed
  plum face, upper highlight, bevel stroke, and two visible fasteners instead
  of a flat generic button.
- Native simulator A/B recordings proved that the layout-owned reel `y` tracks
  were largely suppressed until the result snap. The final `Machine Spin`
  therefore adds bounded `originy` cycles to all four continuous images in
  each clipped reel. The runtime-honored cycles run in one direction through
  repeated 30-70 ramps, then settle at 50 before the original independent
  result stops. Left, middle, and right settle at frames 58, 64, and 70. A
  rejected version exposed black windows during the stop; the final version
  removes easing overshoot and ends the auxiliary cycles before the result
  translations, with no blank frame in the complete native contact sheet.
- Lengthened the lever's visible pull and spring return from 72 to 96 frames.
  MCP readback for `Lever Motion Group` (`0-2676`) now reports rotation keys at
  frames 0/8/18/30/38/50/62/72/84/96 with values
  0/-6/-24/-52/-62/-38/10/-7/3/0 degrees. The native lever crop shows the full
  down-left pull, overshoot, rebound, and upright settle.
- Final runtime: 1,407,613 bytes, SHA-256
  `276869726efacc62b00bf922aa6c480eb926b4eb6bbc783401a322247292e77d`.
  This replaces the immediate pre-polish 1,406,113-byte runtime at
  `be6136893ee3969733114800cdecf95ed17bcedd20388744b5c105cbf67f078b`.
  The asset, iOS, and Android copies are byte-identical; the strengthened
  verifier passes all 32 retained names. The exported source is retained at
  `artifacts/mote-machine/mote-machine-polish-final-source.riv`.
- Final simulator evidence is
  `artifacts/mote-machine/polish-final-motion.mov`, with inspection sheets at
  `/tmp/mote-review/final-video-all.png` and
  `/tmp/mote-review/final-lever.png`. Native stills are
  `polish-final-iphone16pro-result.png`, `polish-final-lever-direct.png`, and
  `polish-final-iphone16e.png`; the direct-lever capture confirms that the
  visible Rive lever requested and settled a one-Mote `+3` play. All three
  preserve the centered type, slot control, full-bleed composition, masks, and
  readable 44 pt interaction hierarchy without clipping or black reel seams.
- Final focused acceptance: 5 Jest suites / 19 tests passed. Final
  `npm run quality:check` passed. Final `npm run quality:check:full` passed all
  quality/layout/security contracts, 324 sprite checks, TypeScript, 137 Jest
  suites / 1,329 tests, production lint with warnings only, iOS Metro export,
  database harness, and linked database lint. No database push, production
  mutation, distributable build, upload, staging, commit, or push occurred.

## Long-spin correction: 4.2 seconds without the reel flash

- Extended `Machine Spin` from 132 to 252 frames at 60 fps (4.2 seconds) and
  moved the state-machine exit to frame 252. MCP readback confirms a 4.2-second
  authored duration, exit frame 252, and maximum keyed frame 252.
- Retimed the cabinet, lever, playable Mote, and reward motion across the longer
  timeline so the pull, response, and result reveal remain coordinated rather
  than finishing during the opening second.
- Native recordings isolated the reported flash to large reel-strip and pivot
  excursions crossing empty artwork outside the masks. The accepted runtime
  removes all 36 reel `y` translation keys from `Machine Spin`, keeps the result
  hold on the populated base positions, and constrains the continuous reel
  pivot cycles to the safe 47-53 range. The reels remain in motion through the
  long spin without traversing a blank strip seam.
- Full-run iPhone 16 Pro evidence is
  `artifacts/mote-machine/polish-long-spin-final.mov`; the settled still is
  `artifacts/mote-machine/polish-long-spin-result.png`. A 12 fps contact sheet
  of the complete 9.56-second capture is retained at
  `/tmp/mote-review/long-spin-safe-whole.png`. The reel-window luminance audit
  bottoms out near 127 in the accepted run, versus about 72 in rejected runs
  containing the visible black flash.
- Final runtime: 1,407,477 bytes, SHA-256
  `2f58218621837a8989524fb54a2bf431337809e433ef75b11dbf5899f9b27c3f`.
  The asset, iOS, and Android copies are byte-identical and the 32-name Rive
  contract passes. Focused acceptance remains 5 Jest suites / 19 tests green;
  the final `npm run quality:check` also passes.
- No database push, production mutation, distributable build, upload, staging,
  commit, or push was performed.

## 2026-08-30 Rosie/Barn V3 integration

- Replaced the retired dark alchemy/casino composition with the
  Impeccable-reviewed Rosie/Barn V3 stage. The accepted READY hierarchy is one
  floating Mote above an empty feed well, three still project-symbol reels, one
  attached low-right lever/PULL assembly, and an empty reward cavity. Dynamic
  Mote and Clockwork Acorn balances remain accessible native safe-area chrome.
- The editable Rive source is
  <https://editor.rive.app/file/untitled/2506441>. The final runtime is
  2,713,318 bytes with SHA-256
  `d0d049a42dfcfac08bf2dc0fcb12c7eee8d2d5005ae7f8f8c65896ec9a2c9d13`.
  `assets/rive/mote-machine.riv`, `ios/ttp/mote_machine.riv`, and
  `android/app/src/main/res/raw/mote_machine.riv` are byte-identical.
- Added the receipt-safe `presenting` View Model boolean. Native code writes
  confirmed balances and result labels before raising it, so the 258-frame
  `Machine Spin` or 28-frame `Machine Settle` cannot begin before the server
  receipt exists. Both paths exit into `Result Hold`, preserving final reels,
  an upright lever, an absent spent Mote, and the revealed Acorn until replay.
- Retired alchemy assets are excluded from export. The runtime verifier now
  requires the V3 Barn, Rosie cabinet, Mote, project-symbol strip, Clockwork
  Acorn, lever parts, `presenting`, `Result Hold`, and the single working
  `Request play from lever` listener; the obsolete actionless `Spin request`
  listener is no longer part of the accepted contract.
- Native integration uses project icons instead of text/emoji glyphs, compact
  tokenized balance tickets, and a screen-reader action mapped to the authored
  right-side lever. The existing one-request latch, durable request ID,
  idempotent server boundary, haptics, result toast, and one announcement per
  `spin_id` remain intact.
- iPhone 16 Pro simulator evidence:
  `artifacts/mote-machine/rosie-v3-live-ready-iphone16pro.png`,
  `artifacts/mote-machine/rosie-v3-live-motion-contact.png`,
  `artifacts/mote-machine/rosie-v3-live-result-iphone16pro.png`, and
  `artifacts/mote-machine/rosie-v3-reduced-motion-result-iphone16pro.png`.
  Full motion, repeated play, result hold, notification, and OS-level Reduced
  Motion were exercised; the OS setting was restored afterward.
- Final focused acceptance: 4 Jest suites / 21 tests passed. Final
  `npm run verify:rive-mote-machine` and `npm run quality:check` passed.
  A clean iPhone 16 Pro development rebuild then bundled the accepted runtime,
  installed successfully with zero build errors, and rendered the final READY
  state at
  `artifacts/mote-machine/rosie-v3-post-rebuild-ready-iphone16pro.png`.
  No database push, production mutation, distributable build, store upload,
  staging, commit, or push was performed.

## 2026-08-30 continuous reel-physics correction

- Replaced the short drifting/two-image reel motion with continuous physical
  strip travel in the editable Rive source. Each masked reel now owns a stack
  of shared 351.9-point periodic image instances: 9 left, 10 center, and 11
  right. The extra instances share the existing raster asset, so no duplicate
  reel textures were embedded.
- `Machine Spin` holds the reels until the lever downstroke reaches frame 30,
  accelerates from rest, cruises at roughly 1,300 logical points per second,
  then brakes left-center-right. Stops occur at frames 180, 204, and 223 after
  seven, eight, and nine complete strip cycles. Each reel overshoots and returns
  to its resolved symbol position before holding through frame 258.
- MCP readback verifies 593 reel `y` keys across 30 strip instances, exact
  351.9-point spacing at every authored key, no reel origin/reset tracks, no
  duplicate object/property/frame keys, and pixel-identical final positions for
  the `Result Hold` handoff. The editor's 21 Problems remain confined to the
  unused `MOTE MACHINE · ALCHEMY REF` artboard; the production artboard adds
  none.
- Accepted runtime: 2,726,550 bytes, SHA-256
  `9e728bb2d468873480eabfccbaf458834e92b06f5216055f44a2c1324a9e5e9c`.
  `assets/rive/mote-machine.riv`, `ios/ttp/mote_machine.riv`, and
  `android/app/src/main/res/raw/mote_machine.riv` are byte-identical. The
  immediately prior accepted runtime is retained as
  `assets/rive/backups/mote-machine-pre-real-reel-physics-2026-08-30.riv`.
- The final export also removes the retired purple reference background from
  the shipped file. Production `MOTE MACHINE` was checked directly at frames 0
  and 150: the Rosie/Barn artboard remains clean while the three periodic reel
  stacks advance independently.

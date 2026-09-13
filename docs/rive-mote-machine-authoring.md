# Mote Machine — Rive authoring contract

Status: Rosie/Barn V3 transition repair and app integration completed on 2026-09-05.
The prior artwork export is dated 2026-08-30; see runtime provenance below.

The shipping machine is a friendly Barn contraption: deposit one Mote, pull
the lever, spin three independently stopping reels, and always receive a
Contraption resource. The retired alchemy cabinet, Warmth/Whirl/Resonance
controls, selectable payout shelf, and zero-result motion are not part of the
runtime.

## Authoritative files

- Editable cloud source: <https://editor.rive.app/file/untitled/2506441>
- Approved READY reference:
  `assets/concepts/mote-machine/2026-08-30-rosie-style-lock/mote-machine-impeccable-v3-ready.png`
- Production part handoff:
  `assets/concepts/mote-machine/2026-08-30-rosie-style-lock/rive-parts-v3/README.md`
- Registered runtime layer manifest:
  `assets/concepts/mote-machine/runtime-layers/manifest.json`
- Runtime export: `assets/rive/mote-machine.riv`
- Native copies: `ios/ttp/mote_machine.riv` and
  `android/app/src/main/res/raw/mote_machine.riv`

The three runtime copies must be byte-identical. The accepted V3 runtime with
continuous reel physics is 2,726,539 bytes with SHA-256
`ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`.

## Exact runtime contract

- Artboard: `MOTE MACHINE`
- State machine: `MoteMachine`
- View Model: `MoteMachineViewModel`
- Instance: `Default`
- Full timeline: `Machine Spin` — 258 frames at 60 fps (4.3 seconds)
- Reduced timeline: `Machine Settle` — 28 frames at 60 fps (under 500 ms)
- Settled timeline/state: `Result Hold`
- Rive-to-app trigger: `requestPlay`
- App-to-Rive receipt trigger: `spin`
- Presentation display state: `presenting` (never starts a spin)
- App values: `motes`, `tickles`, `reduceMotion`, `presenting`, `busy`, `canPlay`,
  `hasError`, `motesLabel`, `ticklesLabel`, `actionLabel`, `statusLabel`

`tickles` and `ticklesLabel` are legacy authored names used as the reel-tier
selector and dynamic reward label. They never grant Tickles. Rename them to
`resultTier` and `rewardLabel` only when native bindings, tests, and the binary
verifier change in the same edit.

The runtime verifier also requires these exported V3 asset/listener names:

- `V3 Open Barn Background`
- `V3 Rosie Cabinet Shell`
- `V3 Mote Preview Runtime`
- `V3 Project Symbol Reel Strip`
- `V3 Clockwork Acorn Reward`
- `V3 Lever Shaft`, `V3 Lever Knob`, `V3 Lever Pivot`, and
  `V3 Lever Pull Sign`
- `Request play from lever`

## Authored hierarchy and interaction

The artboard is 390 × 844. Rive owns the full visual stage and motion. Native
code owns the safe-area Back action, Mote balance, Clockwork Acorn balance,
server request/receipt, haptics, result notification, accessibility, and
recovery.

The source contains three independent clipped reel stacks, a clipped feed well,
a clipped reward cavity, and a separate lever assembly. Every reel stack reuses
one 351.9-point periodic image asset so the runtime adds instances without
duplicating raster bytes. The authored geometry is recorded in the runtime
manifest. The Rive lever hit layout is
`(304, 395, 86, 300)` and fires `requestPlay`. A visible native button below
the stage invokes the same guarded action and exposes its recovery hint to
VoiceOver. The stage reserves the measured receipt-panel height so the reward
tray is not covered, and uses aspect-preserving Contain fitting.

The state machine enters either `Machine Spin` or `Machine Settle` only after
the app binds all confirmed values and fires `spin` once. A boolean
`presenting` update alone never starts or restarts either animation. Full motion
exits after 4,300 ms; Reduced Motion exits after 467 ms. Both paths
exit into `Result Hold`, which keeps the Mote absent, final symbols stable, the
lever upright, and the earned Acorn visible until the next confirmed play.

Dynamic balances and result quantities must not be baked into Rive. Only the
fixed `MOTE MACHINE` plaque and attached `PULL` instruction may remain authored
text.

## Truthful motion

1. **Ready:** a separate Mote floats 1–2 points above an empty feed well; the
   reels are still, the lever is raised, and the reward tray is empty.
2. **Deposit / wake:** after the server confirms the spend, the Mote seats and
   disappears through its clip while the cabinet wakes.
3. **Lever / acceleration:** the shaft, knob, and PULL sign travel as one
   mechanical assembly. Reel motion holds through frame 30, then accelerates
   from rest as the lever reaches its downstroke.
4. **Fast travel:** 9 left, 10 center, and 11 right shared-strip instances move
   as continuous 351.9-point stacks inside their apertures. There is no cyclic
   reset, origin jump, blank seam, or two-image swap. Cruise speed is about
   1,300 logical points per second.
5. **Brake:** the left reel brakes and settles at frame 180 after seven strip
   cycles; center settles at 204 after eight; right settles at 223 after nine.
   Each stop includes a short mechanical overshoot and return rather than an
   abrupt ease-to-zero.
6. **Reveal:** after the right reel settles, the Clockwork Acorn rises from the
   tray cavity and holds.
7. **Receipt:** native code updates both balances, announces the server receipt,
   and shows one success notification per `spin_id`.

Reduced Motion preserves the deposit, lever state change, final symbols, and
reward state change without repeated reel travel.

## Export gate

After every editor export:

1. Exclude all retired alchemy assets from export and keep all V3 assets
   embedded.
2. Replace all three runtime copies with the same binary.
3. Run `npm run verify:rive-mote-machine` and
   `npm run test:rive-mote-machine-state-machine`. The latter verifies real
   runtime progression, full duration, all four selectors, repeated plays,
   Reduced Motion, and no automatic restart while holding a result.
4. Rebuild the native development client because the `.riv` is bundled.
5. Exercise full motion, Reduced Motion, repeated spins, timeout replay, and a
   forced Rive failure.
6. Run the focused Mote Machine tests and `npm run quality:check`.

Never substitute concept frames, videos, GIFs, or native animated reels for
the authored Rive performance.

## Runtime provenance — 2026-09-05

The connected Rive editor's Publish → To .riv action closed without producing a
download. The cloud source was corrected first: transitions `0-5377` and
`0-5378` now use 4,300 and 467 milliseconds; the four Idle/Result Hold entrances
use the `spin` trigger plus their existing `reduceMotion` conditions.

The previous binary was parsed using Rive's published generated schema
([runtime source](https://github.com/rive-app/rive-runtime/tree/77804e8)). A
reproducible, exact-hash repair in
`scripts/rive/repair-mote-machine-transitions.mjs` applies those same six transition edits plus the visibility corrections below.
It refuses every unknown input hash, checks each original byte range, verifies
the output hash, and synchronizes the three runtime copies. No artwork, masks,
reel movement keyframes, listeners, or reward selectors changed. Visual playback
also exposed 24 obsolete opacity keys: 22 re-enabled retired cabinet/reel/UI
layers, and two prematurely restored the Mote and Acorn at frame 150. Those
values are now zero in the cloud source and bundled runtime, preserving the
intended final reveal. The existing restore
script also runs this repair so it cannot restore the broken transitions.

The source query, original binary, and patch manifest are retained under
`artifacts/audit-2026-09-05/`. The local `.rev` remains the prior authoring export;
a fresh cloud `.rev` should be archived when editor downloads work. A future
fresh `.riv` export should pass the behavioral verifier directly; do not relax
the repair's hash guard to apply it to a new file.

Browser acceptance uses the real app routes and web Rive runtime with a
local-only receipt client. Examples:

- `/mote-machine?acceptance=sequence&acceptanceSession=review`
- `/mote-machine?acceptance=empty&acceptanceSession=empty-review`
- `/mote-machine?acceptance=timeout-after-commit&acceptanceSession=retry-review`
- Add `&reducedMotion=1` or `&forceRiveFailure=1` for those development cases.

Normal app routes use the server. Acceptance parameters only select fixtures
in development builds. Their session key follows navigation into Contraptions.

## V4 authoring in progress — 2026-09-06

The earned-Mote Wager suite is being authored beside the accepted V3 runtime.
The frozen contract is `docs/specs/23b-mote-contract-freeze.md`; the complete
required choreography is `docs/specs/23a-mote-animation-suite.md`. The existing
three bundled machine copies remain V3 until the exported V4 source, real
runtime behavior and rendered pixels pass together. A draft clip inventory or
mocked binding test is not a promotion gate.

Current editable backups can be downloaded reliably from the Rive dashboard:
right-click the file, choose **Download Backup**, then inspect `export.zip` for
the `.rev`. The editor **Publish → To .riv** action downloads a runtime into
Downloads even when the browser download event is not reported. Reload the
browser editor only after the connected authoring session saves, and verify
new hierarchy/state names before exporting: separate browser sessions can
otherwise export stale revisions. The dated artifact directory retains source
backups and failed/intermediate exports without overwriting production copies.

Wager uses its own clipped vector reel bank and canonical Clover/Mote/Acorn/
Rosie Crest stop codes. Reveal retains its original reel assets and selectors.
The server receipt selects the mode, stake, stops, outcome and version before
`spin`; `enter` and `presenting` never spend or start the receipt sequence.
The native receipt and history carry exact amounts independently of rendering.

The audio authoring source is `scripts/audio/author-mote-suite.py`; its 22
original PCM cues and checksums live under `assets/sounds/mote-machine/`.
`moteMachineTiming.ts` supplies shared choreography timing, while the sensory
controller handles persisted sound/haptic controls and interruption cleanup.
Physical audio/haptic acceptance remains separate from deterministic cue tests.

See `docs/handoffs/2026-09-06-mote-wagering.md` for current verified work,
unapplied migrations, source/runtime gates and native acceptance status.

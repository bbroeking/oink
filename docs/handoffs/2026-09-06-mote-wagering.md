# Mote wagering implementation and acceptance

Latest status: [fresh restart audit and implementation, September 7](2026-09-07-mote-restart.md).
The record below preserves earlier implementation evidence.

Work resumed after the Rive editor handoff. This document records local work, not migration application or
public availability. Build goal: `docs/goals/mote-wagering-build-goal.md`.
Frozen contract: `docs/specs/23b-mote-contract-freeze.md`.

## Source and rollout boundary

Starting HEAD: `dd4516ba4ff8495f9a7c6c8bdca90390c70c141f`, with substantial
pre-existing dirty work retained. Starting tracked diff and selected original
files are archived under `artifacts/mote-wagering-2026-09-06/before/`.
Backup source files use `.snapshot` so they cannot enter Jest or Metro.

Read-only linked migration inspection on September 6 found the remote ending
at `20260829010000`. Prestige migration `20260905174000` remains unapplied.
Wagering follows it at `20260906010000`. No database push is authorized or
performed. Wager's server flag defaults off. Local fixtures and the throwaway
database exercise the proposed defaults without affecting player balances.

Preserved V3 machine SHA-256:
`ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`.
New Rive work is staged under the dated artifact directory until export,
behavior and visual checks justify promotion.

## Authored sensory suite

`scripts/audio/author-mote-suite.py` is the editable source for 22 original PCM
cues in `assets/sounds/mote-machine/`. They use damped wood, glass-like seeds,
short spring tones, a shared musical motif and quiet air. They contain no
third-party samples or silent placeholder files. The audio manifest records
duration, SHA-256, peak and RMS for every file. Regenerate normally; use
`python3 scripts/audio/author-mote-suite.py --check` for verification only.

`moteMachineTiming.ts` centralizes the versioned stop/result/cue schedule.
The sensory controller preloads on focus, checks hardware silent mode and the
existing game mute, persists separate sound/haptic switches, cancels playback
on interruption and deduplicates receipt IDs. Recovery emits only a quiet
remembering cue; loss and stake-return never use success haptics. Reduced
Motion allows at most a confirmation impact and one outcome acknowledgement.
Automated controller tests pass; speaker/headphone and physical haptic quality
remain device acceptance, not a claim inferred from PCM arithmetic.

## Economy and audience decision before public enablement

The proposed Wager table returns 0.89 Motes and 0.11 Acorns in expectation per
Mote staked; net Motes are −0.11. Reveal still guarantees Acorns, averaging
1.8 per Mote. The complete simulation report is produced from the checked
settlement table and includes short-session depletion, not only long-run means.

The source audit found Mote credits at submitted Shimmer finds and eligible
prestige claims. The client product IDs currently list monthly/yearly Slop
Club and a Season Pass; no direct Mote, stake, XP-skip or energy purchase was
found in the inspected acquisition paths. This does not certify the external
store catalog or all indirect membership benefits. Verify the actual store
catalog and acquisition configuration before describing stakes as entirely
unconnected to purchases. No paid stake, cash-out or real-money prize was added.

Apple's current definition places frequent simulated gambling in its global
18+ category for OS 26 and later; regional and older-OS ratings differ. The
actual App Store Connect questionnaire and resulting distribution decision
remain uncompleted. An optional mode alone does not settle the app rating.
[Apple age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)
(checked September 6, 2026).

Apple separately prohibits IAP currency for real-money gaming. This feature
has no real-money gaming, and its earned-resource scope should remain explicit
in review materials. Store approval is a separate review outcome.
[App Review Guidelines, 5.3](https://developer.apple.com/app-store/review/guidelines/#gaming-gambling-and-lotteries).

Release follow-ups `mote-wagering-v1` and `mote-animation-v4` are queued and
unattached to any distributable build. Attach them to the first containing
binary; notify only after its public store version is verified. Any
distributable build must follow `docs/RELEASE_CHECKLIST.md`; the local Debug
simulator acceptance build is separate.

### Migration and feature rollout sequence (not executed)

Recheck linked migration history and review the complete pending migration set
before an explicitly authorized database push: this shared checkout contains
other work, so the push must not be assumed to apply only these two files.
The Mote prerequisite order is prestige `20260905174000`, then wagering
`20260906010000`. Keep `app_settings.mote_wager_enabled` false through source,
runtime, native and audience acceptance. The active immutable rule versions
are `reveal-v1` and `wager-v1` in `mote_game_active_rules`.

Only enable the Wager setting after those gates and an authorized rollout.
Operational rollback sets that setting back to false: it rejects fresh Wager
commands while preserving guaranteed Reveal, receipt lookup/history and
idempotent replay of already settled commands. Do not delete receipts, rewrite
published paytable rows or reverse earned rewards as a rollback. A future table
change inserts a new immutable version and changes the active-version setting;
clients must acknowledge that version before submitting a fresh command.

## Acceptance evidence

Evidence is accumulating under `artifacts/mote-wagering-2026-09-06/`.
Current verified evidence:

- Final unmodified database harness passes without skipped smokes, including
  the nine wagering sections and concurrent housing tests. The exact command,
  historical-stub bridge and complete PostgreSQL output are in
  `backend-harness-final-command.md` and `backend-harness-final.log`.
- All four v2 Reveal receipts, all five v2 Wager outcomes and both historical
  protocol-1 receipt shapes are parsed from actual PostgreSQL-exported JSON.
- Final full quality passed 170 suites / 1,487 tests, TypeScript, production lint,
  simulator-free iOS export, the complete database harness and linked database
  lint (`quality-acceptance-retry.log` / `.json`, completed 21:55:44 UTC).
  This includes the final history/session account-race regressions.
- Simulator-free iOS export passes. Linked database lint reports no errors;
  this inspects the currently linked schema, not the unapplied wagering SQL.
- Local Debug `xcodebuild` succeeds. Its installed machine is still the
  preserved V3 SHA, not the staged V4 source.
- Actual browser acceptance confirms a v2 guaranteed Reveal debits one Mote,
  grants one Acorn, shows its exact receipt/history, preserves the fixture on
  navigation to Inventory, and activates the Auto-Tickler for one day using
  that Acorn. This is local fixture evidence, not native acceptance or a
  production transaction.

## Current Rive source/export gate

The connected authoring session contains the V4 sequence, separate vector
Wager bank, independent stop layers and reduced-motion layers. Full expanded
object/keyframe/binding/state-machine readback is archived in
`v4/editor-full-readback.json`. Actual export tests and the real WebGL harness
reject the available runtime draft because it still follows generic stops and
renders the old reel bank. No runtime copy has been promoted.

A new dashboard backup also conclusively lacks `Mode Reel Bank`,
`wager.reel.left.vector`, `Low Motion Left Stop` and
`Full Deposit Follow Through`, despite those objects existing in the connected
session's readback. The latest cloud snapshot is
`v4/mote-machine-cloud-snapshot-latest.rev`, SHA
`072d04dc187374ce2bcfc56333de695f7f0d7eb1b84b57fce391b933c7a95ed3`.
It is a stale source archive, not the completed suite. The actual connected
Rive editor must save/sync its changes before the fresh `.rev` and `.riv` can
be downloaded and validated. A save/sync request is pending with the user.

The shared Rosie source was also archived before reaction changes as
`v4/rosie-before-reactions.rev`, SHA
`b3ebff4e691520f5b8206ee4232ff6223054a46abb1be4490d018871fe7935ca`.
Opening that file in the controlled browser does not switch the Rive MCP
connection away from Mote Machine, and that browser page exposes no WebMCP
editing tools. After the machine export passes, switch the connected editor
to the shared Rosie source (file 2462699) so the bespoke reaction clips can be
authored and exported. The scene's development mappings are not those clips.

## Native acceptance still required

A dedicated simulator was created to avoid disrupting the housing task:
`Mote Wager Acceptance`, iPhone 17 Pro / iOS 26.4,
`B96C97DA-BE4B-4D16-A6B0-D1E34B7C48CB`. The Debug application installs and
launches against Metro 8091. Native UI control is unavailable in this session;
startup captures show the platform Open confirmation and development-menu
onboarding. They are diagnostic evidence only. They do not prove the native
Mote journey, VoiceOver, Dynamic Type, haptic feel or frame performance.

After a verified V4 export and bespoke Rosie rig are bundled, rebuild the
Debug client, complete the native fixture matrix (all outcomes/stakes/motion,
recovery/background/repeated play/render failure), reach Inventory and activate
the helper, inspect six coats/moods/equipment, and record small-screen safe
areas, large text, VoiceOver, sound/silent-mode/haptics and performance. The
44-row Rive capture matrix remains pending until actual captures exist.

The goal remains incomplete. No migration push, distributable build, upload,
public feature enablement or store release has occurred.


## Final client and native fallback integration

Rosie now occupies a separate non-interactive companion zone through the
existing shared PigStage presentation. It preserves published player coat and
equipment, pauses on blur/background, suppresses recovery celebrations and
uses monotonic reaction identities. The thirteen proposed `pig-rive-v4`
reaction names remain intents with development fallback mappings until the
shared rig is actually authored/exported; they are not advertised as completed
bespoke clips. Reduced Motion and account fallback are covered in focused tests.

The native loading/failure card now uses the same approved empty cabinet art,
copied unchanged to `assets/images/mote-machine/machine-resting.png` because
Metro deliberately excludes `assets/concepts`. It has no interactive lever or
fake reward. Actual browser failure acceptance confirms fresh Reveal is
disabled until V3/V4 loads; receipt recovery remains available independently.

Final focused tests: 13 suites / 69 tests pass with `--detectOpenHandles` and a
clean exit. Test-only mock isolation resets prevent queued implementations
leaking between cases; the existing Sentry interval is kept outside the route
unit test through the logging boundary mock. Source was frozen at 21:40:58 UTC
for the independent housing task's native capture window. Final quality output
is recorded separately in `quality-final.log` / `quality-final.json`.

Browser viewport acceptance was 1280×720. The in-app browser did not apply the
requested 320×568 override, so those screenshots are not small-device evidence.
Actual minimum-screen and accessibility acceptance remain in the native gate.

Final account-boundary hardening also covers delayed history, delayed session
resolution, legacy fallback and failed hydration after an account change. Each
async continuation checks the current generation before updating the screen.
Strict Mode effect replay restores the mounted guard. The three navigation
links each have a minimum 44×44 touch target.

The final integrated run's first attempt terminated during Jest with native
`SIGSEGV` in V8's garbage collector, without a failing assertion. The unchanged
retry passed every gate. `quality-acceptance-final.json` preserves that failure;
`jest-native-crash-summary.json` records the sanitized native exception and
stack. It was not treated as a passing run or concealed by removing tests.

The final connected-editor state-machine snapshot is
`v4/editor-final-state-machine-readback.json`, SHA-256
`677ee5f889c1bd14ce7b784165c06c145b427f6a5381da1343659715cf12dc9e`.
Its state-machine definition supersedes the earlier full readback's snapshot.
It adds selected-stake display routes and all four receipt-specific Reveal
result overlays, plus verified Medium and First Unlock reachability. These
are source readbacks; the final `.rev`/`.riv` and actual runtime capture matrix
are still outstanding.

To reconstruct all latest source definitions, combine the base
`v4/editor-full-readback.json` with that final state-machine replacement and
append `v4/editor-final-timeline-supplement.json` (SHA-256
`94786278cd62ae6af7428abb708c292318db6c1b6ee76da50feaca5f493fb972`).
The supplement contains five later timelines and their twenty opacity keys;
all referenced Mote objects already exist in the base hierarchy. The union has
11 layers, 129 states, 279 transitions, 437 conditions, 74 animations and 617
keyframes. This preserves the connected-session edits even though the cloud
backup remains stale; it does not substitute for the required editable export.

### Source gate rechecked at 21:59 UTC

A fresh cloud-editor runtime download remains exactly 2,734,242 bytes, SHA-256
`b2137d31f3f705809464d5586009ca296e9b0db2be80fe281fbe36e706997296`,
identical to the rejected draft. The final runtime verifier again rejects it
(`v4/continuation-runtime-gate.log`). The live connector still finds the newer
vector reel objects, so this is a source-sync mismatch rather than completed
export acceptance. No source or bundled runtime was replaced. Native UI
surfaces are still unavailable. The pending user action remains saving/syncing
the actual connected editor, followed by connecting the shared Rosie source.

At approximately 22:00 UTC, another refreshed download retained the same
rejected SHA and lacked the final vector-reel and stake-display names. The
same external blocker has persisted across three consecutive goal turns, so
the goal is marked blocked, not complete. `blocked-audit.json` records the
observations. Resume after saving/syncing the actual connected Mote Machine
editor; validate its exports before switching the connector to the shared
Rosie source. Native acceptance remains a separate required gate afterward.

### User handoff resolved source sync

After the user opened the current editor, a fresh cloud tab displayed the final
stake animations and produced a new runtime: `v4/mote-machine-resumed-export.riv`,
2,757,292 bytes, SHA-256
`62c23b99bd6aff03cf9ba025ec67179ae84f6a97ff81d971d1370dcfd5fb63a6`.
The matching synced editable backup is `v4/mote-machine-synced-source.rev`,
12,384,821 bytes, SHA-256
`f478b9b2ccddb503288591b8a7778c662321a4af90c9bdc2b565b744f767ca03`.
The earlier source revision is now obtainable. Runtime checks expose Wager
outcome starts drifting to 3,750 ms. The initial full-Reveal failure was a test
bug: Rive reports animation names rather than editor state captions, and the
old Reveal machine and new overlay both emit a Result Hold event. The verifier
now selects the correct event and does not conceal that correction as a source
fix. Expanded checks expose actual Reduced Motion and repeated-play failures.
These are being corrected before promotion; the bundled V3 copies remain
preserved. Shared Rosie authoring and native acceptance are still pending.

Actual WebGL pixel inspection also found three solid gray reel windows and a
Clockwork Acorn sprite shown for a small Wager result. Source inspection traced
the gray windows to 102 vector paths inheriting the reel's 69×370 dimensions
and default gray fills. Corrective geometry and paint values are archived in
`v4/editor-post-runtime-visual-corrections.json`; state-machine corrections are
in `v4/editor-post-runtime-fix-state-machine-readback.json`. Later downloads
remain byte-identical to the resumed export, so these later corrections have
not yet been proven in an exported runtime. The reward-bank isolation is still
being authored.

The real-runtime verifier now covers 36 Wager animation combinations (six
outcomes × three stakes × two motion settings), eight Reveal combinations,
recovery, reset and repeated plays. `v4/candidate3-runtime-gate.log` preserves
its current failures. The expanded HTML harness fits the full stage into the
viewport and exposes modes, exact selectors, recovery, unlock, reset and empty
state. It changes local acceptance tooling only.

Later source fixes add a separate bank of five blue-violet tray Motes, with
legacy Acorn opacity controlled independently for Wager. Loss shows no reward;
stake return shows 1/3/5 Motes; Small shows Motes only; Big/Jackpot show Motes
before their Acorns. Large visual clusters cap at five while the native receipt
retains the exact amount. Reduced Wager deposit/result delays were shortened
to target the frozen 490 ms readable deadline. The repeated-play failure was
another verifier setup error: the test fired its initial spin from Idle instead
of entering Ready. The corrected test initializes the presentation first.

These exact later deltas are archived in
`v4/editor-result-resource-bank-delta.json` (SHA-256
`ec80101b8f20bc4ae613ed4cc2e0c12be11c4ab22b3da8888cd7792808a64a89`)
and the superseding complete state machine is
`v4/editor-final-v4-state-machine-readback.json` (SHA-256
`8c01237533838de222df882376866a275f0d9a48f1474fe38095428b768b538b`).
It contains 12 layers, 142 states, 301 transitions and 472 conditions.
These are authored-source claims only: subsequent automated downloads still
have SHA `62c23b99...`, so the corrective source has not passed runtime/pixel
acceptance. The revision-checkpoint dialog was inspected, but its textbox was
disabled in the automated browser; no named revision was created. A manual
revision/export from the user's editor is the next concrete persistence check.

### User runtime export received at 23:25 UTC

The user's `Downloads/mote_machine.riv` is archived as
`v4/mote-machine-user-export.riv`: 2,761,133 bytes, SHA-256
`01a2d16d149da0ec92fbb9e32857b033a93656263394840fd7c5e97ab947c6c9`.
The expanded real-runtime behavior gate passes (`user-export-runtime-gate.log`).
Actual WebGL inspection confirms the corrected blue-violet Mote tray and no
Acorn for Small, but the reel symbols remain stretched into full-height brown
blocks and pink/green wedges instead of recognizable centered symbols. This
export is rejected for visual acceptance and is not bundled. The source-layout
cause is being diagnosed; state-machine success does not establish pixel
correctness. `user-export-acceptance.json` records this distinction.

### Fixed-coordinate glyph correction: export still pending

The composite-symbol grouping persisted but did not fix visual distortion:
Rive continued rewriting the 102 nested parametric paths to the reel layout's
69×370 dimensions. They have now been replaced in the connected source with
fixed-coordinate `PointsPath` geometry, preserving the six animated reel
targets, 30 composite symbols and canonical stops. The reconstructable delta
is `v4/editor-fixed-coordinate-reel-glyphs-delta.json`, SHA-256
`608668d865354ece9a52a04fbdc8da999d2a07dc0d836b2301c580c42c7e26c7`.
Live readback confirms the new eight-vertex Mote path `0-12374` under `3-8709`
and no width/height properties. This is source evidence, not pixel acceptance.

Two subsequent fresh-session downloads, `mote_machine (26).riv` and
`mote_machine (27).riv`, are both 2,761,151 bytes with SHA-256
`b9eb704f6ec5498d6ef725e918f68d7204bbdff7da9df1b6f061c26a19650b23`:
identical to the earlier rejected composite-symbol runtime. The latest cloud
backup is `v4/mote-machine-post-glyph-backup.rev`, 12,395,289 bytes, SHA-256
`0fefa037d650fed8dc1d0da949396bb4dbe6ae3422bde96ae8d4a04d484399a5`;
its fixed-path geometry is not verified. Fresh browser sessions sometimes
retrieve newer snapshots, but they have not resolved this latest mismatch.
Changing the user's browser selection did not change the connector selection;
the browser and connected tool editor are distinct selection sessions. The
available Rive connector has no save/export operation.

`v4/fixed-glyph-export-check.json` records this evidence and the unchanged
bundled V3 hashes. No V4 candidate was promoted. The next concrete action is
an export from the connected editor after its latest source changes are saved,
followed by pixel checks of every canonical stop and result. Bespoke shared
Rosie authoring and native acceptance remain separate required gates. Passing
46 runtime behavior lanes on the user's earlier export does not clear these.

### New user export: glyphs fixed; mechanical pixel failures corrected in source

The replacement `Downloads/mote_machine.riv` is archived as
`v4/mote-machine-user-fixed-export.riv`, 2,763,104 bytes, SHA-256
`5d1c2b2183fe2c93b8fc639cc1bd05beb5b69d44d6d24248b14f47f260010a46`.
It passes the 51-animation/24-binding contract and all 46 state-routing lanes.
The verifier now explicitly describes canonical **stop-state routing**, not
rendered symbol placement; pixel acceptance is a separate mandatory gate.

Actual WebGL captures confirm that the glyph stretching is fixed. They also
expose mechanics the state-name checks missed: Small 111 and Jackpot 333 show
the same uncentered symbols; the visible lever remains upright during Lever
Pull; and deposit sprites are hidden. The harness now supports pausing the
actual Rive runtime at a requested elapsed time and saves screenshots. Its
initial wallet is also corrected to 40 Motes before Entry, matching native
binding order. The ready socket Mote is visible; a fresh play paused at 251 ms
still shows the deposit/lever failure. Earlier ReadyEmpty initialization was
a harness artifact and is not used as proof of deposit failure.

Source corrections are complete for this batch, pending an exported pixel gate:

- Six layout wrappers discarded their animated positions. Existing curves now
  animate fixed path geometry directly, including acceleration, cruise, full
  stops and reduced stops. See `editor-reel-effective-motion-delta.json`.
- Lever Pull rotated only a separate pivot image. The visible arm/knob/sign
  node now receives the authored curve; the clipped feed well is raised above
  the cabinet so deposit sprites can render. See
  `editor-lever-visible-mechanism-delta.json`.
- Recovery Pending now also targets the visible lever. Returned/Small clips
  no longer restore obsolete input-well stakes or pulse legacy Acorns; the
  dedicated tray bank owns Wager rewards. Reveal clips remain intact. See
  `editor-recovery-returned-cleanup-delta.json`.

The subsequent automated download is archived as
`v4/mote-machine-mechanics-export-attempt.riv`, 2,763,121 bytes, SHA-256
`e5d8b2017a359c91eac1e4e706b75086bf0f8e0239fd2a581ca935f11667e585`.
Its 251 ms capture still lacks the lever/deposit correction. Do not promote it.
The next required source action is a new manual export from the connected
editor containing the completed correction batch, then paused mechanical and
held canonical-symbol checks. Source writes are paused for that export.

`v4/user-fixed-pixel-acceptance.json` records hashes and remaining gates.
Current browser screenshots (diagnostic failures, **not native acceptance**):
`user-fixed-ready-40-motes.png`, `user-fixed-wallet40-deposit-251ms.png`,
`user-fixed-small-held.png`, and `mechanics-export-attempt-251ms.png`.
All bundled V3 assets remain preserved. Shared Rosie authoring and native
journey/accessibility/sensory/performance acceptance are still incomplete.

### Continued MCP authoring under the user's synchronization assumption

The user explicitly directed work to continue through MCP without waiting for
another manual export. The machine source now additionally contains staggered
Deposit 3/5 positions, 224 reset keys covering fixed reel paths, deposits,
rewards, lever and machine scale, a Wager-only center payline, and Reduced
Motion route isolation. `v4/editor-final-motion-reset-delta.json` records the
live readback and reconstruction instructions, SHA-256
`dd24e9f1f4caa43a2479a5134e4e10bc467eef2b5f96a74a7e91422beb3b322b`.
The 33-clip manifest check and verifier syntax check pass. Synchronization is
assumed for continued authoring; final exported pixels are still unverified.

`MoteRosieStage` now preserves the player's resting mood and equipment. Its
local Reduced Motion flag suppresses generic happy/jump reactions and freezes
the current mood pose, independently of global motion preferences. Focused
Rosie tests and TypeScript pass; the lead reran `quality:check` successfully.
See `v4/mcp-continuation-quality.log` and its paired JSON report.

An isolated editable Rosie copy was created through Rive MCP `upload_rev`
with `target=current_project`: file **2560001**, `rosie-mote-reactions`, at
<https://editor.rive.app/file/rosie-mote-reactions/2560001>. It derives from the
archived `rosie-before-reactions.rev` and leaves the original adventure source
unchanged. The upload used the connector's documented data-URI transport after
its filesystem sandbox refused the local path. The upload response is archived
as `v4/rosie-isolated-source-upload.json`.

The browser loads the isolated copy, but live MCP `list_artboards` still targets
`MOTE MACHINE` / `0-355`. Its exposed tools cannot switch cloud documents.
Bespoke Rosie clip authoring therefore requires opening this isolated copy in
the Rive application hosting the MCP connection. No placeholder clips were
created in the cabinet document. `v4/mcp-continuation-status.json` records this
specific remaining access gate separately from export and native acceptance.
No database push, distributable build or runtime promotion occurred.

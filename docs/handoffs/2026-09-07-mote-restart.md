# Mote Machine restart — fresh audit and implementation

**Browser authoring update:** Direct browser editing passed a persistence/export
test after the restart audit below. A temporary `Timeline 1` was created through
Rive's browser UI, survived opening the document in a second browser tab, and
appeared in the actual WASM-loaded download (`mote_machine (31).riv`). The
`MOTE MACHINE` artboard increased from 82 to 83 animations with exactly that
addition. The probe was then deleted through the UI, and its removal appeared in
the second editor view. Evidence: `browser-roundtrip-probe.json` and
`browser-roundtrip-runtime-check.json` in the restart artifact directory.
The test binary was not promoted. Browser authoring is now the selected path;
reapply/verify the MCP-only corrections in this persisted browser document and
use browser navigation for the isolated Rosie document. The older MCP export
mismatch described below remains historical evidence, not a reason to stop
browser authoring.

Recorded September 7, 2026 UTC. The user requested restarting both the Rive/MCP
connection work and implementation from the specifications. The existing checkout
was preserved; the tracked restart baseline is archived at
`artifacts/mote-restart-2026-09-07/checkout-before-restart.patch`. No reset, database
push, distributable build, or upload was performed.

## Changes made during the restart

- The client now requires the frozen Reveal/Wager stake lists and individual
  paytable rows. Malformed tables, null rows, extra modes, or changed values fail
  closed without throwing. Receipts validate resource identity and timestamps.
- The live Rive graph now gates normal mechanical/reward entrances against receipt
  replay, presents static reduced-motion and recovered symbols/resources, and
  resets the coordinator and side layers from interrupted states. The actual
  WASM tests now cover the previously missed side layers, delayed replay effects,
  exact reduced reward states, and four mid-play reset points.
- The V4 binary verifier now enforces spec 23a's 6 MB hard limit rather than an
  incorrect 8 MB staging allowance.
- A real Monday-boundary database harness failure was repaired in test fixtures
  only. Attribution now uses the settlement clock, while current standings and
  synthetic prior-week payout fixtures use explicit, isolated cycles.

Independent Sol audits and raw evidence are in
`artifacts/mote-restart-2026-09-07/`: `backend-audit.md`, `client-audit.md`,
`rive-audit.md`, `rive-source-routing-after.json`, and
`rive-state-machine-after-raw.json`. The raw Rive archive includes all 12 layers,
transition endpoints and condition operands, and the reward/replay keyframes.
Source readback confirms the static resource timelines have no varying or
transform channels. These are source findings, not exported runtime acceptance.

## Fresh verification

| Check | Result and evidence |
| --- | --- |
| Complete configured, unskipped local PostgreSQL harness | Passed; `database-harness.log` and backend audit |
| Client focused tests | Passed, including malformed-contract regressions; client audit |
| Full Jest suite | 178 suites, 1,532 tests passed; `quality-full.log` |
| Final `npm run quality:check` | Passed after client changes; `quality-check.log` |
| TypeScript | Passed in final quality check |
| iOS Metro export | Passed separately; `ios-export.log`; this is not an installed native binary |
| Linked database lint, read-only | Passed; `linked-db-lint.log`; no migration was applied |
| Authored audio | `python3 scripts/audio/author-mote-suite.py --check` passed all 22 source-matched audible PCM cues |
| V4 manifest | Passed declarations; `rive-manifest.log` |
| V4 binary contract | Download imports and exposes 51 required animations / 24 public bindings within the 6 MB limit |
| V4 runtime behavior | Failed; `post-fix-runtime.log` rejects the stale exported graph |
| Scoped diff/syntax/JSON checks | Passed |

`quality:check:full` is **not green**. After its passing Jest run it stopped on
the existing untracked Habitat discovery test's render-time assignment at
`__tests__/useHabitatExpansionDiscovery.test.tsx:19` (React hooks purity lint).
That unrelated file was left intact. The skipped export and linked-lint gates
were run separately, and the complete database harness had already passed.
Repository-wide whitespace checking also reports existing unrelated whitespace
in `components/ui/EmptyState.tsx:64`; the touched scope passes.

## Rive connection and export boundary

A fresh standard MCP initialization succeeded against the available Rive server
and selected the same Mote document/artboard (`2506441`, `0-355`). A fresh browser
session was also opened. This restarts the connection checks; it does not claim
the native Rive application or its server process was restarted.

MCP edits and readbacks work. The newly downloaded runtime after the graph fixes,
`Downloads/mote_machine (30).riv`, is still 2,763,121 bytes with SHA-256
`e5d8b2017a359c91eac1e4e706b75086bf0f8e0239fd2a581ca935f11667e585`.
It is byte-identical to the rejected restart baseline. The stronger actual WASM
tests reproduce missing reduced resources, normal-play replay activity, and
interrupted-reset failures on that export.

The fresh downloaded editable `.rev` is 12,400,335 bytes with SHA-256
`7ebe310856a6d9acb92ce223b31db16a611bc2dfb029fb8aecb45faa69f0f001`.
It lacks `wager.payline.v4`, although that shape exists in live MCP readback.
Thus the mismatch affects saved source too; it is not established to be only a
runtime export cache. Repeating exports has not synchronized these sessions.

Available MCP commands have no save/sync/export or cloud-document-switch action.
Browser navigation to another cloud file does not switch the MCP document.
The live graph must be persisted and exported by the editor session hosting MCP
before its runtime/pixel acceptance can proceed. Preserve that session's unsaved
work. The raw source readback is archived as recovery evidence.

## Remaining acceptance gates

1. Obtain a source/runtime pair containing the latest live graph, then pass the
   strengthened WASM checks and actual frame captures for deposit, visible lever,
   distinct centered stop symbols, stable holds, losses, returned stakes, wins,
   recovery, Reduced Motion, and interruption/reset. The earlier exported pixels
   failed canonical centering and visible deposit/lever motion.
2. Activate the isolated shared Rosie source in the editor hosting MCP and author
   the required reactions. The prepared copy is
   [Rosie Mote reactions](https://editor.rive.app/file/rosie-mote-reactions/2560001).
   Its browser tab is available, but MCP remains attached to Mote Machine.
   Shared-rig authored reactions, six-coat/equipment coverage, and the matching
   shared-pig asset are not complete. Existing fallback reactions are not suite
   completion.
3. Complete and record native/device acceptance, including accessibility,
   lifecycle recovery, performance, silent-switch/audio, and physical haptics.
   No new native acceptance is claimed from mocked tests or the Metro export.
4. Resolve the independent Habitat test lint failure before a green full quality
   gate. Database application still requires the user's explicit go; every
   distributable build still requires the release checklist. Existing release
   follow-ups `mote-wagering-v1` and `mote-animation-v4` remain queued.

The three bundled V3 runtime copies remain byte-identical at SHA-256
`ae891be3c9b79235c5ae19e8718ade07d5f5b0799bd14a1288f5bc4b5ebac52a`.
The incomplete V4 export was not promoted. Wager remains disabled by default.
The build goal remains incomplete.

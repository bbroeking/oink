# Performance benchmark and improvement report — 2026-08-25

## Scope and environment

- Baseline: the existing dirty working tree on `main` at `6a30b3d`, before the
  performance changes in this goal. No user changes were reverted.
- Host: local macOS development machine, Node 22-compatible project runtime,
  Expo 57 / React Native 0.86.2.
- Native packaging loop: production-mode `expo export --platform ios` with
  Hermes bytecode and source maps. No distributable build or upload was run.
- Interaction loop: deterministic 20-tap burst contracts with mocked RPCs and
  fake timers. Counts exclude optional lucky/echo side effects so the same
  common path is compared on both sides.

The reusable packaging benchmark is:

```sh
npm run performance:benchmark
```

## Bottlenecks found

1. Every successful Barn tickle paid for a remote `auth.getUser()`, its required
   mutation, a full `home_stats` read, and an `unseen_pass_events` read.
2. Font-family and icon-package root imports retained unused font assets and
   modules in the iOS export.
3. A 7–9-particle heart burst added and removed every particle with its own
   React state update, even though the animations already use the native driver.
4. The native route graph still contains prototype/audit routes and assets.
   This remains a measured follow-up rather than being removed during an active,
   heavily modified prototype cycle.

## Changes

- Use the cached Supabase session identity on the repeat-tap client path. The
  server RPC remains responsible for accepting or rejecting the mutation.
- Apply the mutation's returned balance and earned-tickle fields immediately,
  then coalesce authoritative `home_stats` reconciliation at the trailing edge
  of a tap burst (500 ms).
- Share an in-flight pass-event read and rate-limit ambient pass polling to one
  read per 10 seconds.
- Add/remove a whole heart-particle burst in two React state updates while
  retaining per-particle native-driver delays.
- Import only the eight used Google font files and the two used vector-icon
  families.
- Add focused performance regression tests and a reusable iOS export benchmark.

## Before and after

### Common 20-tap Barn burst

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Required tickle mutations | 20 | 20 | unchanged |
| Remote auth identity reads | 20 | 0 | -100% |
| `home_stats` reads | 20 | 1 | -95% |
| `unseen_pass_events` reads | 20 | 1 | -95% |
| Total common-path server operations | 80 | 22 | -72.5% |
| Auxiliary operations beyond the mutations | 60 | 2 | -96.7% |

The visible balance and earned counters previously waited for the mutation and
then a second server round trip. They now update from the mutation response,
removing one sequential round trip from the common feedback path; the trailing
read remains the authoritative reconciliation for happiness, regen, cosmetics,
and concurrent grants.

### Heart-particle burst

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| React state updates for 7 particles | 14 | 2 | -85.7% |
| React state updates for 9 particles | 18 | 2 | -88.9% |
| Per-particle JS timers | 7–9 | 0 | -100% |

### iOS export

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Metro modules | 3,820 | 3,751 | -69 (-1.8%) |
| Exported assets | 790 | 758 | -32 (-4.1%) |
| Asset bytes | 74,963,614 | 70,487,862 | -4,475,752 (-6.0%) |
| Hermes bytecode | 8,599,416 | 8,438,500 | -160,916 (-1.9%) |
| Total export bytes (including source map) | 103,059,563 | 98,377,755 | -4,681,808 (-4.5%) |

The first baseline export took 15.3 s in Metro / 20.65 s wall time; the post-change
run took 9.4 s / 11.95 s. Those timings are recorded but not claimed as an
improvement because the second run benefited from warm filesystem/transformer
caches. Byte, module, asset, and deterministic request/commit counts are the
comparison signals.

## Verification

- Performance contracts: pass-event burst 20 → 1 RPC; home reconciliation
  burst 20 → 1 RPC; Barn source contracts enforce cached session lookup,
  trailing refresh, and two particle state updates.
- TypeScript: `npx tsc --noEmit` passes.
- iOS production export: passes and is reproducible with
  `npm run performance:benchmark`.
- A release-followup entry (`barn-core-loop-performance`) is queued for physical
  iPhone responsiveness, reconciliation, foreground refresh, and production
  telemetry checks in the first public build containing these changes.

## Remaining opportunities

- The native graph still contains prototype/audit routes such as
  `idle-battler-prototype`, `lounge-prototype`, `member-perks-prototype`,
  `mote-machine-prototype`, and `ui-audit`, plus prototype Rive probe assets.
  Separating development routes from the production router should be measured
  in an isolated change after the active prototype work settles.
- A server-side batch-tickle RPC could reduce the remaining one mutation per tap,
  but that changes authoritative economy behavior and requires a migration,
  database harness coverage, explicit database-push approval, and device UX
  validation. It was intentionally not folded into this client-only pass.

## Future build note

Plan these improvements into the next appropriate distributable build after the
current prototype work is stable. Before invoking EAS, follow
`docs/RELEASE_CHECKLIST.md`: classify the build, create its numbered changelog,
run the applicable preflight gates, and attach the queued
`barn-core-loop-performance` follow-up to that exact build. Test rapid Barn
tickling and post-burst reconciliation on the exact TestFlight-installed binary;
this note does not authorize or start a build.

# Code quality, build performance, and Mote Machine audit

Date: 2026-09-05. Scope: the current working tree, including the existing Expo 57
upgrade and extensive uncommitted game work. No branch reset, staging, commit,
database push, EAS build, or store upload was performed.

## Result

The production dependency graph is smaller, authoring files are excluded from
build inputs, the shop makes fewer unnecessary requests, and the Mote Machine
is connected to its normal UI entry points. The animation now runs once per
confirmed receipt, completes its authored duration, and holds the reward.

## Measured production export

The existing `npm run performance:benchmark -- --keep` command exported iOS
Hermes bundles with source maps using a 16 GB Node heap.

| Measurement | Initial tree | After focused changes | Difference |
| --- | ---: | ---: | ---: |
| Modules | 3,759 | 3,740 | −19 |
| Hermes bytecode | 8,465,816 B | 8,329,156 B | −136,660 B (1.61%) |
| Asset count | 760 | 759 | −1 |
| Asset bytes | 70,757,617 B | 70,742,823 B | −14,794 B |
| Total export including source map | 98,718,831 B | 98,290,975 B | −427,856 B |
| Observed export wall time | 20.766 s | 14.027 s | −6.739 s |
| Observed Metro bundle time | 16.978 s | 10.597 s | −6.381 s |

Timing is observational: the later run benefits from warm caches and is not a
controlled cold-build speedup. Byte and module reductions are concrete. A final retest after visibility/logging changes retained 3,740 modules and
8,329,860 B of bytecode (135,956 B below baseline). Its wall time was 21.267 s
while the separate web smoke export ran concurrently; the observed wall-time
range is therefore 13.7–21.3 s, not evidence of a guaranteed build speedup. The
Rive repair subsequently removes 11 asset bytes. Final measurements and check
results are retained with the audit artifacts. Export totals
include source maps and are not App Store download sizes. Server p50/p95 latency
and device frame rates were not measured.

## Changes implemented

- Seven development routes now use `__DEV__`-conditional loading of their
  implementations in `components/dev/screens/`. Production source-map inspection
  confirms those implementations are absent. Existing production redirects are
  preserved, and the lounge/expedition previews are also development-only.
- Retired five unused Mote Machine prototype files (238 lines) from production
  source directories. Originals remain in the audit artifact directory.
- Shared the machine's loading/error presentation across native and web,
  consolidated its play/recovery handler, and removed unused shop username data.
- Metro excludes authoring concepts, marketing art, raw images, `.rev` files,
  documentation, and build evidence. The two used machine icons were copied
  into `assets/images/mote-machine/` so runtime imports remain valid.
- Added `.easignore`, preserving every existing `.gitignore` exclusion and
  excluding source-only directories. These directories occupy about 1.86 GB
  uncompressed locally; actual archive reduction was not measured. Native
  project source and runtime assets remain build inputs; Pods, Gradle caches,
  and compiler output directories are excluded. This follows
  [Expo's archive exclusion guidance](https://docs.expo.dev/build-reference/easignore/).
- Shop refreshes reuse cached session identity, coalesce overlapping requests,
  pause countdown/rollover work when blurred or backgrounded, and stop automatic
  retries after errors. A cold successful load no longer needs a serial remote
  `getUser()` request before its five data requests. RLS remains authoritative.
- Added behavior tests for hidden/background shop activity, failed requests,
  overlapping refreshes, durable spin storage failures, lost responses, double
  taps, runtime failure recovery, and the inventory/activation acceptance path.
- Updated the stale Expo 52 description in `AGENTS.md` to match installed Expo
  57 / React Native 0.86.

## Mote Machine completion

The old file passed name checks but failed behavioral verification: setting
`presenting=true` re-entered Machine Spin at 0.017, 0.283, and 0.550 seconds;
`spin` itself started no animation. Exit values 258 and 28 had been interpreted
as milliseconds instead of the authored frame counts.

The cloud source now has four receipt-triggered entrances and waits 4,300 ms
for full motion or 467 ms for Reduced Motion before Result Hold. Browser export
was unavailable, so the bundled file was repaired using the published Rive
schema with exact input/output hashes and byte-range checks. All original
artwork and reel movement keyframes are preserved. Visual playback also caught
and fixed 24 opacity keys that exposed retired artwork and prematurely showed
the Mote/reward at frame 150. See
[the authoring contract](../rive-mote-machine-authoring.md) for reproducibility
and the outstanding editable `.rev` archive step.

The app now provides a visible accessible play/recovery button and receipt,
reserves their measured height below the animation, and uses aspect-preserving
fitting. Plays require durable storage before contacting the server. Unknown or
lost responses retain their request ID; recovery works with zero remaining
Motes or a failed renderer. The reward, inventory, and Auto-Tickler activation
flow shares a development-only acceptance session. Normal routes use server
RPCs. The web boundary now uses the real Rive file; renaming its `.ts` entry to
`.tsx` fixes Metro choosing native Nitro code ahead of the web implementation.

The shared feature flag is enabled after the local gates passed. The two large
changes are queued in `docs/release-followups.json` for the first distributable
build that contains them; they are not marked released or notified.

## Highest-value remaining work

| Priority | Evidence | Recommended bounded change | How to establish improvement |
| --- | --- | --- | --- |
| High | `utils/rpc.ts`: `rpcAction` maps every RPC error to `network`, trusts successful JSON payloads, and does not catch thrown transport exceptions. | Add classified outcomes and runtime validation at economy/auth write boundaries, with caller migration in small slices. Preserve idempotency and avoid blind retries. | Malformed payload, permission failure, SQL failure, and lost-response tests; fewer misleading retry prompts. |
| High | `app/_layout.tsx` still makes multiple independent remote `getUser()` calls before launch reads. | Reuse the existing session identity and coalesce independent launch data behind one lifecycle owner. Do not move server authorization into the client. | Capture launch request count and critical path on a throttled network before/after. |
| High | The export still contains about 70.7 MB of assets; source art is over 1 GB. | Rank actual exported textures by decoded dimensions and use, then resize/compress a bounded family. Keep full-resolution authoring sources outside runtime directories. | Export bytes and decoded-memory peak, plus side-by-side device visual checks. |
| Medium | `hooks/useRace.ts` closing-hour interval/wake timeout checks `enabled` and the cycle time, but not screen focus or AppState. | Apply focus/background ownership and request coalescing as done for the shop; preserve ceremony freshness on return. | No hidden/background polling; exactly one reconciliation on foreground. |
| Medium | Large source seams include `Account.tsx` (~2,900 lines), `TrufflePatch.tsx` (~2,670), Season (~2,610), and root layout (~1,030). | Extract lifecycle/economy responsibilities behind small feature APIs before extracting more visual fragments. Avoid a broad rename/reformat pass. | Smaller change surface and behavioral tests around each extracted responsibility. |
| Medium | Full-tree lint is green but reports hundreds of warnings, including unused symbols, hook dependencies, and render-time ref/state access. | Fix warnings in changed production modules and ratchet a warning baseline; prioritize hook correctness over cosmetic rules. | Declining baseline and no newly introduced correctness warnings. |
| Medium | Several tests assert exact source strings/indentation. Moving previews broke assertions even though redirects remained intact. | Replace lifecycle/control-flow string tests with mounted behavior tests; retain static tests only for deliberate policy boundaries. | Refactors preserve tests without rewriting expected source formatting. |
| Investigate | `home_stats()` calls several helpers and has per-slot hat lookups; 349 applied migrations repeatedly redefine hot functions. | Capture current function definitions and query statistics, then profile the slowest statement with representative data before changing SQL. | Measured database p95 and rows/buffers read. No speculative migration or index change was made. |

## Verification and limits

- `npm run quality:check:full` passed: type checking, all 154 Jest suites / 1,400
  tests, production-source lint (zero errors), iOS export, asset/layout/security
  checks, the database harness, and linked database lint.
- Read-only migration listing found all 349 local migrations applied remotely,
  including the machine and Contraptions migrations; no push was needed.
- Rive name/asset verification passes, and all three runtime copies are identical.
  Behavioral testing covers four successive reward selectors in both motion
  modes and confirms no restart while holding the result.
- The local iOS simulator development build succeeded. This is not a production
  IPA or release candidate. Exact TestFlight/device frame-time, VoiceOver,
  background/termination, and haptic acceptance remain release-checklist gates.
- Browser acceptance exercises the actual app routes with local fixtures, not
  live player writes. The normal Season/inventory paths use the deployed RPCs.
- Final visibility/receipt-copy edits also passed the fast quality gate,
  type checking, focused recovery tests, and runtime behavioral verification.
- Logs, export measurements, prior source/binary, source graph, and repair
  manifest are under `artifacts/audit-2026-09-05/`.

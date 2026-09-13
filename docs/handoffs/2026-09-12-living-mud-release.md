# Living Mud production execution — September 12

Brian approved executing the production plan. The timezone compatibility client is built separately; Living Mud remains staged pending its database go and native acceptance.

## Timezone client

- Build 181 / v1.3: `build-181.ipa`, SHA-256 `2267c4014aee0fabbb3bf444cd8ff24c65d3663f9382a35c77a3fff1441837e8`.
- Source: isolated clean commit `7f71b90eec9ec905d0ae0a4bd4c4803c77e0e284`, based on the preserved build 180 source plus the feeding compatibility delta.
- Signed artifact and provenance checks passed. Transporter is open; Brian owns sign-in and Deliver. No upload or public release has been performed.
- See `docs/builds/2026-09-12-build-181.md` for automated checks, known transition behavior, and all pending exact-binary device/store gates.
- The server already runs midnight–4 a.m., 8 a.m.–noon, and 4–8 p.m. under `commuter_local`. Registration and deferred timezone-change rules need validation in the installed client.

## Implemented Living Mud scope

- Imagegen production artwork: forest clearing, continuous mud texture, transparent empty pouch, and embedded prompt provenance under `assets/images/patch/living-mud/`.
- Native Skia mud surface with deterministic brushing, tap/rub and hold/shove. The seeded 6×5 board, stir budget, free-rub streaks, blessings, echo, relics, and carried finds remain authoritative.
- Thirty native accessible patch targets expose quiet-rub and shove actions. Background, cancellation, disabled state, multiple touches, and off-edge behavior do not award cosmetic-only progress.
- Logical progress persists by account/window/seed. A failed save keeps the active board open. Gesture ownership disables parent scrolling only during brushing.
- Pack up, uncertain recovery, confirmed receipt, practice, and Back to Barn flows use native components. Reward art and success copy derive from the confirmed outcome.
- Receipts are acknowledged across mounted tabs by account/window. New requests include the persisted owner/window so server authorization and rollover checks are atomic.
- Native development fixture: `app/living-mud-preview.tsx`; production redirects away and cannot run its mocked submission.

## Database rollout boundary

The new migration is `20260913010000_durable_rooting_receipts.sql`, SHA-256 `e7364483c6934cc01866066938f4729d080644a843ff99fdec7a40656e316953`.

It stores the exact successful receipt in the same transaction as the existing reward. Owner-only lookup recovers it after rollover. Existing two- and three-argument submits remain compatible and share one account/window lock. `submit_rooting_checked` binds new clients to the original account and window before any reward mutation. The new client fails closed while receipt support is absent.

The canonical disposable database harness passes, including checked owner/window rejection, historical recovery, owner isolation, and genuinely concurrent two-/three-argument submissions yielding one receipt and one reward. Independent review found no remaining database/recovery blockers after the account race, pending-storage race, and migration-order fixes.

Production migration go was requested separately and is pending. Do not infer an answer from elapsed time. The unrelated `20260912153621_empty_starter_barns.sql` remains excluded.

Read-only ledger and isolated dry-run evidence:

- `artifacts/living-mud-migration-ledger.txt`
- `artifacts/living-mud-migration-dry-run.txt` — only `20260913010000_durable_rooting_receipts.sql` would apply.
- `artifacts/living-mud-migration-workdir.txt` — linked isolated workdir with the applied chain plus that migration only; no secrets are stored in this handoff.

After Brian's explicit go: recheck the migration hash and remote boundary, apply only the isolated migration, then run owner/read compatibility smoke checks and regenerate linked database types. Record actual application time and results here. Do not broadly push the main checkout's pending migrations.

## Verification and outstanding gates

- Final isolated full Jest: 230 suites / 2,005 tests passed. Focused Living Mud tests: 8 suites / 62 tests passed. TypeScript, layout/security contracts, sprite validation, production lint (zero errors), iOS export, and canonical database harness including 83/84 passed. The isolated quality wrapper reports only missing Supabase linkage; separately linked database lint returned no findings. Full evidence and hashes: `artifacts/living-mud-release-preflight/PREFLIGHT.md`.
- Main `quality:check` passed; TypeScript and focused brush, renderer, receipt, progress and recovery tests pass.
- The verified overlay contains 28 files (6 changed, 22 added) with no post-gate source drift; archived source and per-file hashes are in the preflight artifacts. `node_modules` is a temporary root symlink for Metro and must become isolated dependencies before packaging.
- An isolated Living Mud checkout at `/Users/bbroeking/projects/oink-living-mud-release` starts from build 181's clean source and includes only the digging overlay. Metro runs at port 8082 for stable native acceptance.
- Native large-phone inspection found the primary action below the first viewport; a responsive compact/large layout correction is implemented. Final captures are pending because another active task repeatedly replaces/shuts down the acceptance simulators. Exclusive Simulator coordination was requested.
- Small/large final native capture, interaction validation, accessibility/large text/reduced motion, finish review, and final design documentation remain pending. Do not describe the new digging UI as production-ready on the basis of unit tests or a web export.
- No Living Mud IPA has been built. Prepare its build changelog and pre-build report only after applicable gates are recorded; use a separate local TestFlight validation build, followed by exact-binary testing and the RC lane for store release.
- `living-mud-patch` remains queued in `docs/release-followups.json`, unattached until its first distributable build. Do not mark notified until the public store serves that version.

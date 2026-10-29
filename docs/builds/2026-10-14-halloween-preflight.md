# Halloween 2026 production preflight — build number pending

This is a preflight worksheet, **not an actual build record**. No build number is assigned because no EAS build has been invoked and the remote counter can change. The read-only EAS query on 2026-10-14 returned 197; the actual attempted build number must be recorded only after the frozen candidate is ready and immediately before/after EAS packaging.

## Proposed build record

- Classification: intended release candidate if this exact binary is selected for the store; otherwise distributable TestFlight validation build.
- Release/version: current source says 1.3; owner decision pending.
- iOS build number: pending actual EAS allocation.
- Candidate commit: pending clean/frozen release checkout. Current audit HEAD `16faad00c626e5e52aa9cc9cc80bb79a6ca1cbe6` is not acceptable because the checkout has 210 dirty paths.
- Working-tree state/diff reference: pending isolated candidate.
- Previous live build: historical record says 1.2 (143) as of 2026-10-04; current App Store verification pending.
- Release owner / rollback decision-maker: Brian.
- Target: local production-profile IPA → Transporter → TestFlight → accepted RC → manual App Store submission/release.
- Planned release date: unset.
- Database state required: seasonal-card schema plus Halloween login-gift schema deployed inactive; explicit user **go** required for any push. Campaign activation is post-binary acceptance only.
- Feature/timed state: Halloween login-gift campaign inactive; exact opening/closing window and minimum accepted client build require release-owner approval.
- RC status: pending; no candidate exists yet.

## Proposed headline

A one-time Halloween login surprise grants one random costume from a frozen five-costume pool, backed by replay-safe ownership receipts.

## User-facing scope

- One authenticated account receives at most one random Halloween login-gift costume for the versioned campaign.
- The gift reappears as the same receipt on retry or another device rather than minting again.
- Five additional Halloween costume identities/cards are included in the campaign pool.

## Deferred from the production claim

- Full production wardrobe integration across Closet, Home, Barn, and Visit.
- All non-idle poses and all pigs; current fitted visual evidence is Rosie front idle only.
- Costume transfer/consumption and restoration of modular equipment outside the accepted login-gift ownership flow.
- The local card-packet/fitting-room prototype as a production reward authority.

## Migrations

- `20261014180000_seasonal_card_item_unlocks.sql`: prerequisite seasonal catalog/ownership schema; remote status pending linked migration-list evidence.
- `20261014200000_halloween_login_costume_gift.sql`: one-time authenticated gift receipt, costume instance provenance, claim replay, acknowledgement, and five-item pool. It seeds the campaign inactive. No push performed.
- Other unapplied migrations in this checkout must be classified and either included deliberately or excluded via an isolated release checkout; do not let timestamp order silently pull unrelated work into production.

## Verification ledger

| Gate | Result |
| --- | --- |
| AGENTS and canonical release checklist | PASS, read completely on 2026-10-14 |
| Git freeze | FAIL: branch `feat/matchmade-play`; 210 dirty paths |
| Remote EAS iOS version | PASS read-only: 197 |
| Current public store version/build | PENDING; 1.2 (143) is historical 2026-10-04 evidence only |
| Xcode / iOS SDK | AVAILABLE: Xcode 26.4.1, SDK 26.4 |
| EAS / CocoaPods / Docker | AVAILABLE: EAS 16.28.0, CocoaPods 1.16.2, Docker 29.6.0 |
| Node parity | PENDING: shell Node 24.12.0; `.nvmrc`/EAS resolves Node 22 |
| App/native static configuration | PASS static presence: version 1.3, bundle `com.broeking.ttp`, production push, Apple Sign In, associated domain |
| Login-gift disabled default | PASS static SQL inspection: campaign seeded `active = false` |
| Migration filename order/collision | PASS locally: `20261014200000` follows `20261014180000`; no duplicate timestamp prefix found |
| Linked production migration boundary | PENDING: read-only CLI command hung and was stopped; no SQL applied |
| TypeScript | PASS: `npx tsc --noEmit` |
| iOS Metro export | PASS: 4,532 modules / 1,300 assets |
| Database harness | PASS: disposable Docker harness completed `DB HARNESS OK` |
| Full Jest | FAIL post-fix: 320 passed, 2 failed, 1 skipped suites; 3,757 passed, 2 failed, 2 skipped tests. Only existing `relPerAnim` and `pigStageSideSprite` geometry checks fail; all Halloween tests pass. Focused Halloween run: 8 suites / 48 tests PASS |
| Production lint | PASS with warnings after test fix: 0 errors, 865 warnings, exit 0 |
| Pig sprite validator | FAIL: Copper `idle_8.png` has an opaque canvas corner |
| `npm run quality:check:full` | FAIL at locked contracts: 138 layout clamps against budget 91; `public.my_drives()` lacks default-role revoke |
| Linked database lint | PENDING: command emitted no output for 60 seconds and was interrupted; no SQL applied |
| Manual pre-package device checklist | PENDING owner/device |
| Local EAS build | NOT STARTED |
| Signed IPA inspection | PENDING artifact |
| Transporter upload | PENDING; Brian performs sign-in and Deliver |
| Exact TestFlight binary acceptance | PENDING owner/device |
| RC go/no-go | PENDING explicit owner decision |
| Campaign activation | BLOCKED until accepted public binary and separate explicit user go |

## Known issues / release blockers

- Current source tree is broad, dirty, and mixes unrelated work; it cannot provide defensible RC provenance.
- Production-root login integration is complete and staged with the backend disabled by default. Closet/Home/Barn/Visit presentation remains separate pending work; the fitting-room prototype is not evidence for those surfaces.
- Linked Supabase migration status is unverified.
- Fresh release automation is red: clamp budget 138/91; `my_drives()` revoke; Copper sprite corner; two animation-geometry Jest failures; linked database lint unavailable. All Halloween tests pass, including a focused 8-suite / 48-test run; production lint exits 0 with 865 warnings.
- Real-device accessibility, lifecycle, second-device replay, and native fit acceptance remain pending.

## Release status

No artifact exists. Nothing has been uploaded, deployed, pushed, activated, or version-bumped. Follow the ordered path in `docs/design/halloween-2026/production-readiness.md`; create the numbered build changelog only when the exact frozen candidate and immediately current build counter are known.

## Release follow-ups

The queue contains `halloween-fitted-costume-expansion` and `halloween-one-time-login-gift`; neither has a speculative build attachment. Attach both to the first actual containing build and do not mark either notified before the accepted version is public.

# Player-local Feedings beginning at 8am

## Requested behavior

Each player receives three Feedings at their registered local hours:
**08:00–12:00, 16:00–20:00, and 00:00–04:00**. Brian explicitly confirmed
these hours on 2026-09-12. The midnight window belongs to the preceding
08:00-anchored day. All closing boundaries are exclusive.

The Barn dig entry and Season Feeding action disappear after a real completed
dig and return on the next Feeding. Collection/history and the earned receipt
remain accessible. Practice does not consume a real Feeding.

## Authored implementation

- Migration `20260913000000_player_local_feeding_schedule.sql` adds validated,
  server-controlled IANA timezone registration and a dormant `commuter_local`
  mode. Existing uniform and `commuter_eastern` behavior is preserved.
- Dig RPCs still take no client clock or timezone. Logical local-date/bucket
  IDs preserve corresponding Sounder boards and one submission per Feeding.
  Local IDs use `1_000_000_000 + digDay * 3 + bucket`, keeping them separate
  from completed legacy UTC and Eastern windows.
- An established player's timezone change waits until Monday 00:00 UTC and
  is limited to once per 30 days. Initial registration while the mode is
  dormant can be immediate. This limits timezone hopping; an IANA string is
  user asserted and is not proof of physical location.
- Notifications use each recipient's clock. Race participation snapshots both
  timezone and schedule, so later changes do not reinterpret that cycle's
  completion requirements. Weekly enumeration uses opening instants directly.
- The client uses the server-returned effective timezone, caches it per account,
  and refreshes on login/foreground and at a pending change boundary. Pending
  or phone timezone values never directly replace the effective clock.
- IANA daylight saving folds follow PostgreSQL's later standard-time instant.
  Midnight–04:00 covers three elapsed hours on New York's spring transition
  and five on its fall transition while retaining the same local boundaries.

## Verification

The canonical local database harness includes smoke 82 after the new migration.
It exercises real open/submit calls in New York and Los Angeles, equal logical
board/seed identity, Sounder cooperation, duplicate rejection, recipient-specific
pushes and dedupe, timezone grants/validation/cooldown, Monday changes, Tokyo,
spring/fall DST, the midnight window, 21-window weekly slates and a real award.
It passed on 2026-09-12.

Client verification covers local clocks, configuration, per-account cache,
deferred timezone registration, completed-dig visibility and rollover.

- `npm run quality:check`: passed, including TypeScript, layout/security
  contracts, sprite integrity and the configured focused suites. Repeated
  successfully after regenerating `utils/database.types.ts` from the live DB.
- Six focused digging/timezone Jest suites: 153 tests passed, including the
  deferred-registration hook regression covering a pending
  change discovered on foreground, its scheduled attempt, and no retry loop
  after a failed boundary read.
- Canonical full database harness: passed with smoke 82.
- Post-push linked database lint (`--level error --fail-on error`): passed.
- Post-push read-only checks: applied ledger entry, timezone columns, six
  New York boundaries, and unchanged live schedule all passed.
- Post-activation checks at 22:44 UTC: the public configuration RPC returned
  `commuter_local`, the live clock used the namespaced local window, and all
  24 opening/closing boundaries passed across New York, Los Angeles, Tokyo
  and Kolkata using the active setting (no schedule override).
- `npm run release:followups -- check`: passed.
- Changed-source whitespace check: passed.

Generated mockups are not evidence of an installed native binary.

## Rollout state and next steps

**Database migration applied on 2026-09-12 at 22:28 UTC; server schedule
activated at 22:43:44 UTC after Brian said “lets active these hours.” No app
build was performed.** Read-only verification of the migration confirmed the
remote ledger contains `20260913000000`, all four timezone columns exist,
and all six local opening/closing boundaries return the expected clock.
The setting is now `{"mode":"commuter_local"}`. Activation used a conditional
update matching both the exact previous uniform value (`window_secs=28800`,
`open_secs=14400`, `offset_secs=0`) and its 2026-07-16 update timestamp.
The older phone-offset migration from PR #52 was never applied; do not restore
it. Client source remains in the shared workspace; this task did not commit
or push Git changes. The completed-dig visibility fix and Living Mud Patch
mockups have not shipped in a binary.

1. Done: applied only `20260913000000_player_local_feeding_schedule.sql`
   after Brian requested the migration and confirmed the three windows.
   Used an isolated CLI workdir containing the already-applied chain plus
   this migration; the dry run listed only this file. Unrelated migration
   `20260912153621` remains unapplied and now precedes the latest ledger
   version; its owner must review that ordering when deploying it.
   Applied source SHA-256:
   `64034333f5fb23102d4c24d1187dcb9b4af9ca2e3bef6e05140f385d28f28143`.
2. Ship a compatible client via `docs/RELEASE_CHECKLIST.md`. Attach release
   follow-up `player-local-feedings-8am` to the first containing build.
3. Verify that exact installed binary, completed-dig hiding, local clock
   countdowns, and account timezone registration. Check old-client readiness
   before activating a schedule their sanitizer does not understand.
4. Done: activated immediately at Brian's subsequent request, before the
   compatible client release and before the weekly boundary. The compatibility
   findings and resulting limitations are recorded below. Do not treat this
   server setting change as completion of client release/device acceptance.
5. Observe the queued post-release checks once the containing public version
   is live. The schedule retains three daily Feedings and twelve civil hours
   open per day; existing reward amounts are preserved.

## Remaining acceptance detail

At activation, none of the 84 non-test profiles had registered a Feeding
timezone. Such profiles use **America/New_York**, so the server's local-zone
capability does not yet mean all players receive their own local hours.
Build 180 and older do not recognize `commuter_local` or register a zone;
their clocks can disagree with server eligibility. A compatible client remains
required. Existing diggers first registering under the now-active mode wait
until the next UTC Monday for their actual zone to take effect.

Ten players had a legacy schedule snapshot for cycle `20260907` (ending
2026-09-14 00:00 UTC). Those historical snapshots and existing dig records were
preserved. New digs use local IDs, so existing participants cannot complete a
legacy perfect-Feeding slate through new local digs during this transition
week. Race scores continue to count digs. The old clock was closed at the
pre-activation check; any remaining session with an old ID is rejected at
submission instead of receiving a second reward.

If rollback is requested, restore the previous uniform value using a
conditional update that still matches this activation's mode/timestamp.
Do not delete local dig or delivery records: they retain their namespaced IDs
and must continue preventing duplicate claims after any later reactivation.

A dig opened immediately before a pending timezone change takes effect can
be refused on submit after that change because the server re-evaluates the
current window. Keeping such a session would require extending the session
contract. Include this boundary in device acceptance and explain any refusal
without showing a false banked-reward receipt.

## Visual direction

Brian selected **Living Mud Patch**. The built-in imagegen explorations and
selected active/completed pair are documented in
[the design brief](../design/2026-09-12-living-mud-patch.md). The continuous,
tactile illustrated surface remains a concept, while the completion visibility
fix is implemented in the existing interface.

# Empty starter Barns — 2026-09-12

Requested behavior: everyone's Barn starts empty. The Warm Plank room shell
remains selected, with all six decoration positions empty. The four starter
designs remain owned so the player can choose where to place them. Welcome and
discovery copy explain this, and the local acceptance fixture matches it.

## Database rollout

Pending migration: `supabase/migrations/20260912153621_empty_starter_barns.sql`.
No linked database changes have been applied for this request. The read-only
migration list showed remote migrations applied through `20260912020000`.

Owner claim, authorized friend inspection, and eligible discovery use the same
empty-room initializer. It retains starter grant keys and prestige rewards.

The migration empties only legacy rooms at revision zero, with Warm Plank Barn,
exactly the original sketch/crock/rug placements, and no save receipt. Saved
layouts and all other arrangements remain intact. Ownership, grant receipts,
balances, and existing milestone rewards are retained. Converted rooms advance
revision, causing stale drafts to conflict. Saving the empty default earns no
customization reward; placing a starter decoration earns Apple Basket once.

`AGENTS.md` requires an explicit user go before a database push. Attach release
follow-up `empty-starter-barns` to the first distributable build containing this
change; store/device verification remains part of that build's release process.

## Verification

- Full disposable Postgres harness passed, including the new empty-starter smoke
  and existing habitat authorization, grant, receipt, and concurrency checks.
- All 26 Barn/habitat Jest suites passed: 183 tests. Existing Jest open-handle,
  React test-renderer act, and Watchman warnings remain.
- `npm run quality:check` passed; the quality watcher also passed during edits.
- Simulator local fixture reset confirmed no placed decor and a full-screen
  interior: [screenshot](../../artifacts/empty-starter-barn-2026-09-12/starter.png).
  Built-in shelving/cabinet are part of the room background art.

The earlier full-screen friend-visit and pig-border fixes remain in place.

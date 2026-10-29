# Reward and game-contract verification report — 2026-10-13

This report covers source inspection and model execution. It does not claim a working backend.

## Verified from current source

- `supabase/migrations/20260921150000_drum_draw.sql:1591` inserts `rooting_receipts(user_id, window_index, receipt)` with conflict protection and returns the stored receipt. The receipt is the durable successful-Dig authority, including crewless submissions; the UI is not.
- The same migration's `_monday_draw_balls` counts those receipts by receipt `created_at` inside the UTC draw week and caps them to expected feeding windows (`:283`). `_monday_draw_eligible` is at least one ball (`:304`).
- `draw_monday_purse()` (`:416`) authenticates from `auth.uid()`, takes a per-user advisory transaction lock, replays an existing `(user_id, iso_week)` draw, rejects zero balls, inserts the draw receipt, and pays through `apply_tickles`. Therefore “alongside an eligible Drum purse claim” means the successful draw transaction, not viewing eligibility.
- The current repository has no implemented card pack, inventory, foil-progress, or Hedge Run server contract. `reward-contract.md` is deliberately additive and requires a future migration.

## Model reproduction

Run `node scripts/prototypes/card-economy/simulate.mjs 10000`. On Node 22, the checked run produced 10,000 deterministic histories over 82 pack-eligible identities with the 12-card starter. Median completion was 48 packs (p10 26, p90 84); median repeats accumulated by completion were 170 (p10 60, p90 350).

The chance of any repeat in pack 1/5/10/15/20 was 0%/0.3%/5.1%/100%/100%; mean repeats were 0/0.00/0.06/3.07/4.79. At a ten-repeat foil cost, the first affordable foil arrived at median pack 15 and the tenth at median pack 34. These values use hypothetical 60/30/10 and 85/12/3 slot weights with unseen-first selection; they are sensitivity evidence, not approved odds.

The script also prints the semantic invariants that must be tested in the eventual server implementation: no selection banks credits, a selected goal does not change earning, changing targets preserves credits and copies, and claims debit exactly ten while carrying surplus.

## Not verified

- No transaction, concurrency, row-policy, failure injection, or cross-account test can pass until schema/RPC implementation exists.
- No odds, welcome tutorial-pack list, foil price, or activation date is approved by this report.
- No live player participation, unopened backlog, repeat sentiment, or 2–3 minute Hedge Run duration was measured.
- No database push or production mutation was performed.


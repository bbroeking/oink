# Spec 17 — The tickle breakdown: "how this pig earned its tickles"

**Decision trail:** founder calls 2026-07-17 — all three entry points; full
honest ledger (every lane labeled, including season-pass lumps). Read
docs/design/taste-standard.md; numbers are welcome here (Contend surface,
not a feelings surface). Any migration AUTHORED ONLY — never `db push`.

## What it is

A receipt-style sheet decomposing any player's season `tickles_earned` into
its real sources — self and others render identically (the total is already
public on the board). Transparency is the product: players see exactly what
the founder audit saw.

## Server — one read-only RPC (new migration; check `ls supabase/migrations
| tail` for the next slot; 20260746–20260752 are taken)

`tickle_breakdown(p_user uuid) → jsonb`, SECURITY DEFINER, granted to
authenticated. Season boundary = the active season's `starts_at` from
`seasons` (NOT a hard-coded timestamp). Lanes, all from existing ledgers:

- `home_taps` — RESIDUAL: `tickles_earned` minus every ledgered lane below
  (floor at 0). The balancing item; absorbs any legacy remainder.
- `visit_taps` — COUNT(barn_visits WHERE visitor_id = p_user AND created_at
  > boundary).
- `dig_finds` — COUNT(truffle_digs WHERE digger_id = p_user AND dug_at >
  boundary) × 5 (the dig_truffle credit; if you can read the 5 from the
  live function's constant lane cleanly, do; otherwise a commented literal
  matching dig_truffle is acceptable).
- `pass_tiers` — SUM of tickle-type rewards over user_tier_claims ×
  season_tiers for claims > boundary (reward_value keys: 'amount' or
  'tickles'; reward_type IN ('tickles','tickle')).
- `trades` — SUM(amount × 2) over tickle_trades WHERE target_id = p_user
  AND fulfilled_at > boundary.
- `lucky` — COUNT(daily_lucky_claims WHERE user_id = p_user AND claimed_at
  > boundary) × 5.
- NO trough lane — the reward is retired (spec 15) and clawed back; it must
  not appear as a source. Pre-push, any trough remainder lands in the
  residual silently.

Return the lanes + the total + the boundary. Harness smoke: seeded fixture
per lane sums exactly to total; unknown user returns zeros; RLS/definer
sanity.

## Client — TickleBreakdownSheet

- One sheet component, receipt voice: ledger rows with the shared icon
  column (mirror the dig receipt's row pattern in TrufflePatch), whimsy
  labels + real numbers: "tickled at home · N", "out visiting friends · N",
  "truffle digs · N", "season pass · N", "trades repaid · N", "lucky
  numbers · N". Omit zero rows. Total pinned at the bottom. Tokens only,
  NO emoji, Glyph/Icon for the icon column.
- It is an unmanaged native Modal → it MUST take the
  `useUnmanagedModalHold(open)` latch from spec 02 (components/ui/
  PopupQueue.tsx) like HoofprintsSheet does.
- Entry points (all three):
  1. Leaderboard rows — the tickle count becomes pressable (hit-slop
     generous, no layout change) → sheet for that pig.
  2. UserSheet — a quiet "how'd they earn it?" line near the keepsake
     cluster → sheet for that pig.
  3. Season screen — your own earned count gains the same affordance →
     sheet for self.
- Fail-soft: if the RPC is missing (un-pushed server), the sheet shows the
  total with a single "the pig keeps its secrets for now" line — never an
  error state.

## Verify

Unit tests: lane→row mapping, zero-row omission, residual floor. Harness
smoke wired per the run.sh arg pattern. Full suite + typecheck.

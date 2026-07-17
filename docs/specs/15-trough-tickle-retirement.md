# Spec 15 — Retire the trough tickle reward + claw back this season's grants

**Decision trail:** founder call 2026-07-17 (SKILL.md decision log). Troughs
no longer pay donors tickles at all — the reward lane is retired — and the
tickles already granted for troughs completed THIS season are removed
retroactively (both the spendable bank and the tiebreak stat). Migration
AUTHORED ONLY — never `db push`.

## Current mechanics (verified 2026-07-16/17)

- `donate_to_drive` computes `reward := floor(snouts / 10.0)` into
  `item_drive_donations.tickle_reward` (latest def carrying that logic:
  `20260627000000_trough_cooldown_per_drive_and_refund_fix.sql`; CHECK
  whether `20260633_trough_announcement_copy` / `20260635_trough_chip_feedback`
  / `20260647_mud_fights` carry a newer `donate_to_drive` body — carry the
  ALPHABETICALLY LATEST one verbatim; carry-latest-def footgun).
- `claim_drive_reward` (latest def `20260628_trough_reward_to_leaderboard.sql`)
  credits `profiles.counter += tickle_reward` AND
  `profiles.tickles_earned += tickle_reward`, stamps `reward_claimed_at`.
- `tickles_earned` is the season leaderboard tiebreak (Most-Tickles rule).
- The funded-drive announcement says "Claim your tickles!" (donate_to_drive's
  funded branch; copy may have moved in 20260633).
- Season-1 boundary: the season-0 finale ran **2026-07-12 00:10:39 UTC** and
  zeroed `tickles_earned` (see docs/specs/reports/07-tiebreak-postmortem.md).

## The change (one new migration — check `ls supabase/migrations | tail`
for the next free slot; 20260750000000 is taken)

1. **`donate_to_drive`** (carry latest body): `reward := 0` — new donations
   record no tickle_reward. Keep signature FROZEN (deployed builds call it).
   Update the funded-branch announcement copy to drop "Claim your tickles!"
   (celebrate the funded item instead — whimsy voice, INSERT stays inlined,
   EXCEPTION-wrapped as today).
2. **`claim_drive_reward`** (carry latest body): retire the payout — for any
   claim, return `{ok:false, reason:'retired'}` WITHOUT crediting anything
   or stamping. Keep the function + grant so deployed clients calling it get
   a clean refusal, not a 404.
3. **Zero pending bait:** `UPDATE item_drive_donations SET tickle_reward = 0
   WHERE reward_claimed_at IS NULL;` — nothing left to claim.
4. **Retroactive claw-back (this season only):** for each donor, subtract
   `SUM(tickle_reward)` over their donations with
   `reward_claimed_at > '2026-07-12 00:10:39+00'` from BOTH
   `profiles.counter` and `profiles.tickles_earned`, each floored at 0 via
   GREATEST. Comment the boundary constant clearly — the founder re-verifies
   the timestamp at push time. Do NOT touch claims from before the boundary
   (season 0 is settled and archived).

## Client

Find every claim affordance / "Claim your tickles"-style copy
(components/TroughSection.tsx and components/BountyCard.tsx both reference
claim_drive_reward or claimable state — read them) and remove/replace the
claim UI: a funded trough's receipt celebrates the item, no tickle claim
row. The client must stay tolerant of the un-pushed server (claim RPC still
succeeds server-side until push day → hide the affordance client-side
regardless of server response; and handle `reason:'retired'` gracefully if
an old build calls it post-push).

## Harness smoke

New smoke (next free 4x number; the 50–53 glob gap is real): donate → drive
funds → tickle_reward is 0 / claim returns retired / counter+tickles_earned
unchanged; plus a claw-back fixture: pre-seeded claimed donation after the
boundary gets subtracted with GREATEST floor; one before the boundary is
untouched.

## Verify

Full JS suite + typecheck + harness (run.sh needs the non-CHAIN migrations
passed as args — check how smokes 44/45/47/48 are invoked).

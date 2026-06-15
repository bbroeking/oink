---
title: "Review — Barn-visit visitor cash payout (20260648)"
type: lint
date: 2026-06-14
tags: [review, economy, barn-visiting, faucet, migration]
---

# Review — Barn-visit visitor cash payout (`20260648`)

Adversarial 4-lens review of `supabase/migrations/20260648000000_visit_tickles_to_visitor.sql` (the player-requested fix making barn visiting pay the *visitor* real spendable snouts). Run pre-push. **1 blocker fixed in-migration; 2 product decisions left open.** See [[barn-visiting]] / [[virality-and-growth-loops]].

## Verdicts

| Lens | Verdict |
|---|---|
| Economy-model correctness | ✅ Correct & symmetric — `counter`=spendable cash; visitor mirror of host is right; the 1739→1735 YOU-tally revert is genuinely fixed (tally reads `tickles_earned`, now credited + persisted). |
| Migration safety / carry-latest-def | ✅ Clean — body verbatim from `20260646` except the 4 intended deltas; nothing dropped (3h cooldown, 7/hr tired, host UPDATE, both `apply_happiness`, `barn_visits` INSERT, first-tap `shift_alignment`+inline announcement, `grant_season_xp`); signature/`SECURITY DEFINER`/`search_path`/GRANT preserved; filename sorts after `20260647`. Announcement correctly inlined (not `send_system_announcement`). |
| Faucet & abuse | ⛔ **BLOCKER (fixed)** — see below. |
| Triggers & side-effects | ⚠️ **HIGH (open decision)** — referral-gate interaction; achievements unaffected. |

## Blocker (fixed in-migration)

**Unbounded cash faucet.** The original header claimed visiting was bounded to "~7 snouts per 3h per barn" — **wrong**. The 3h cooldown filters `target_id <> p_target`, so it only blocks *switching* barns; re-tapping the **same** barn runs at the 7/hr tired ceiling with **no daily cap** (the old 5/day budget was removed in `20260605` and never replaced). Real exploit rates:
- Single account self-minting against one partner barn: **7 snouts/hr = ~168/day**, indefinitely (24× the header's claim).
- Two alt/colluding accounts tapping each other (the RPC has **no server-side friendship gate** — only self-check + profile-exists): each nets **+1 visitor +1 host = 14/hr = ~336/day**, free, forever — a paid Slop Club stipend (250) every ~18h, minted by a bot pair.

**Fix applied:** a per-visitor **`daily_cap = 20`** rewarded-tap ceiling, checked against `barn_visits` for the current UTC day, returning the existing `cooldown` refusal (→ client nap screen, no client change) with `next_at` = next day boundary. Bounds the mint (and the per-tap season-XP + happiness side-effects, which inflated under the same loop) to cozy levels. `daily_cap` is tunable.

## Product decisions

1. **Friendship gate — ✅ RESOLVED (friends-only).** `20260648` now gates `tickle_at_barn` on `are_friends(caller, target)` (server-authoritative) and `components/UserSheet.tsx` hides the Visit button unless `friendship_status === "friends"` (player decision once visiting minted real snouts). Cash/leaderboard can no longer be minted to/from strangers; a mutual-accept friend ring is the new collusion floor, bounded further by the 20/day cap.
2. **Referral "engaged" milestone — ⚠️ STILL OPEN.** Crediting the visitor's `tickles_earned` fires `profiles_referral_milestone_check` — the Sounder `tickles_earned>=50` gate (inviter +500, invitee +500 **snouts**) becomes reachable by barn-tapping rather than genuine home play (friends-only + 20/day-capped, so ≥3 days). Decide: let visit-taps count, or credit the visitor `counter` only and re-route the YOU tally off `tickles_earned`. (The host side already pumped `tickles_earned` per visit in shipped `20260646`, so this is a widening, not a brand-new hole.)

## Referral payout map (investigated per player "250 added to leaderboard" question)

Traced every payout across the four referral migrations: **no referral reward touches the leaderboard (`tickles_earned`) — all go to `counter` (spendable snouts).** There is no 250 referral payout (250 is the Slop Club monthly stipend, used only as a comparison in the faucet finding above).

| Reward | Field | Amount | Gate |
|---|---|---|---|
| Sounder `signup` (`attribute_referral`) | `counter` | +100 referrer / +100 referee (referrer capped 100 lifetime, `20260530`) | at attribution |
| Sounder `engaged` (`check_referral_milestones`) | `counter` | **+500 referrer / +500 referee** | referee `tickles_earned` crosses **50** (trigger) |
| Code redeem (`redeem_referral_code`) | `counter` | +50 referee | at signup |
| Code completion | `counter` | +100 inviter (+ Messenger Hat at 3) | referee `tickles_earned ≥ 100` + 3 active days |

`tickles_earned` (leaderboard) is only ever the **gate** for the engaged/completion milestones, never the **destination** of a payout. The only `tickles_earned` writes in these migrations are the normal home-tap (`+1`) and lucky-pig (`+5`) increments that share the RPC file — not referral rewards. So referral **does not add to the leaderboard**; the `20260648` visit credit is the only path by which visiting now feeds the 50-tickle engaged *gate*.

## Clean (negative results, recorded)

- **Achievements** — no achievement-grant trigger keys on `profiles.counter`/`tickles_earned`; no auto-grant/double-count from the visit reward.
- **Leaderboard passes** — `profiles_record_leaderboard_passes` now fires on visitor taps; intended (rank genuinely rises), bounded by 60s dedupe + LIMIT 25.

## Status

Migration hardened (daily cap **+ friends-only `are_friends` gate** added, client Visit button friend-gated, header math corrected, wiki reconciled). **Pending DB push** + one remaining decision (the referral engaged-gate interaction, #2 above). `tsc` clean.

---
title: Barn Visiting
aliases: [visit and tickle, visiting, tickle at barn]
tags: [system, social]
status: stable
sources:
  - code: components/BarnVisitModal.tsx
  - sql: supabase/migrations/20260646000000_visit_tickles_to_leaderboard.sql
  - sql: supabase/migrations/20260648000000_visit_tickles_to_visitor.sql
  - doc: docs/barn-visiting-design.md
  - doc: docs/social-layer-ideas.md
last_compiled: 2026-06-14
---

# Barn Visiting

Going to a friend's Barn to tap-tickle their pig *for* them — the social, in-person upgrade to the tickle trade, designed around the spine **visiting is GIVING, not earning** (`docs/barn-visiting-design.md` §0).

## How it works

You open a friend's Barn (`BarnVisitModal`) and see their pig wearing its full loadout over their chosen background (`components/BarnVisitModal.tsx:196-281`). Tapping **either** pig calls the `tickle_at_barn` RPC, which spends one tap from a shared visit budget and credits the host (`components/BarnVisitModal.tsx:288-315`).

The reward is symmetric and pro-social: both host and visitor gain **+1 snout** (`counter`) **+1 leaderboard** (`tickles_earned`) per tap (the 20260628 payout shape) — the host with a smaller (+25%) happiness bump, the visitor with the full happiness bump. Two heart tallies (YOU | host) — each seeded from that player's `tickles_earned` — tick up together by one on every tap with a shared heartbeat pulse, the "you both get a heart" payoff (`components/BarnVisitModal.tsx:135-138`, `227`, `439-465`). Hearts are mutual love (happiness); they are distinct from the tap you spend.

> ⚠️ **The visitor's payout was a client-only illusion until `20260648`.** The `20260646` rework credited only the *host's* leaderboard; the visitor was paid nothing, so the optimistic "YOU" tally (`setYouHearts`, `BarnVisitModal.tsx:299`) reverted to the real (unchanged) value on the next `home_stats` refresh after leaving — a player reported tapping to 1739, then dropping back to 1735 on exit ("a cash issue"). `20260648000000_visit_tickles_to_visitor.sql` gives the visitor the **same payout as the host — real spendable snouts (`counter`) + leaderboard (`tickles_earned`)** — per the player's clarification that "cash is the player's cash" (the reward must be spendable, not just a leaderboard count). Makes the tally real and banks cash for the visit. **Written, pending DB push.**

The host pig has an energy bar that drains over a per-visit **Tired cap** — a random 3-7 taps rolled on open (`components/BarnVisitModal.tsx:143`). When the cap (or the server's per-hour ceiling) is hit, both pigs nap and a "nap time" summary shows hearts shared this visit (`components/BarnVisitModal.tsx:283-305`, `561-597`). Visiting no longer spends your own tickle bank — the budget is the sleepy roll (server `20260646`).

Visits are rate-limited: a per-target **1h cooldown** (re-tickling the same barn) and a **5/day** visit budget, plus a one-friend-every-3h cross-barn lock surfaced by the `barn_visit_status` RPC (`components/BarnVisitModal.tsx:264-275`, design `docs/barn-visiting-design.md` §4). A buried truffle the host left can also be dug for snouts (see [[trough]]-adjacent loop in design §3b).

The **tap-juice** is reusable polish: a squish scale on both pigs, five flying hearts/sparkles, the heartbeat emblem, the "+1" rise, and a tired idle animation, all fired by `playTap()` (`components/BarnVisitModal.tsx:173-194`, `351-368`).

## Key files

- `components/BarnVisitModal.tsx` — full-screen visit overlay: pig diorama, tap-to-tickle, heart tallies, energy/Tired cap, nap summary, tap-juice, truffle dig.
- `docs/barn-visiting-design.md` — the depth design: giving-not-earning spine, gift loop, truffle, streaks, visit limits, staging.
- `docs/social-layer-ideas.md` — origin: barn visiting as the social primitive (built first), teams layered on later.

## Connects to

- [[core-loop-and-tickle-trade]] — visiting is the in-person upgrade to the abstract tickle trade.
- [[happiness-and-mood]] — a tap raises both pigs' happiness (host +25%, you full).
- [[friends-graph]] — entry points are friends/leaderboard rows; the economy lives inside the social graph.
- [[barn-and-habitat]] — the Barn (pig + loadout + background) is what you visit.
- [[alignment]] — design intends visiting to feed the generosity axis (alignment_score), the natural anti-farm.
- [[trough]] — design ties the truffle dig / chip-in loop into Trough funding.

## Open questions / risks

- The server economy is now in-repo and verified: `tickle_at_barn` (`20260646` + the `20260648` visitor-credit fix) pays leaderboard (`counter`/`tickles_earned`), applies happiness (host 0.25 / visitor 1.0), and bounds taps by a **7/hr per-barn** tired ceiling + a **one-friend-every-3h** cross-barn cooldown — note the live server caps differ from the older design's "5/day budget + 1h per-target" framing the modal comments still cite.
- **Faucet watch:** with the `20260648` fix each tap mints **+2 snouts** (`counter`, host +1 + visitor +1) **and +2 leaderboard** (`tickles_earned`) — a real *cash* faucet. An adversarial review (`outputs/lint`) found the original bound was wrong: the 3h cooldown only blocks *switching* barns, so re-tapping one barn ran at 7/hr with **no daily cap** = ~168 snouts/day solo, ~336/day for a 2-account collusion ring (no server-side friendship gate). `20260648` now adds **(a)** a **per-visitor 20/day mint cap** (reuses the `cooldown` refusal → existing nap screen, no client change) bounding the mint + the per-tap XP/happiness side-effects, and **(b)** a **friends-only gate** (`are_friends`, server-authoritative; `UserSheet` also hides the Visit button for non-friends) so cash/leaderboard can't be minted to or from strangers — a mutual-accept friend ring is now the collusion floor. **Still open** (one product decision): whether barn-visit `tickles_earned` should count toward the referral **"engaged"** +500/+500 milestone — it now *can* trip the gate, though referral *payouts* are all snouts (`counter`), never leaderboard. Track against the no-recurring-sink risk in [[virality-and-growth-loops]] / [[snouts-economy]].
- Several richer design layers (visit gift, guestbook, friendship streaks, barn passport, Trough chip-in) are specced in `docs/barn-visiting-design.md` (§3, §6) but not yet wired in `BarnVisitModal`.
- Stranger-vs-friend economy line is **resolved: friends-only** — `20260648` gates `tickle_at_barn` on `are_friends(caller, target)` and `components/UserSheet.tsx` hides the Visit button unless `friendship_status === "friends"` (player decision, once visiting began minting real snouts). Visiting a stranger's barn is no longer possible.

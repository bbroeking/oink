---
title: "Mud Wars — What's Next (reconcile designed vs built vs pushed)"
type: memo
date: 2026-07-01
tags: [mud-wars, rollout, status, planning, season-2]
status: draft
---

# Mud Wars — What's Next

> Reconciles the [[mud-wars-master-plan]] against the actual repo. Bottom line: **the game is built** — the whole client surface and a full "rhythm war" server stack are code-complete and dark behind the new `mud_wars` server flag. The master plan is stale: the team **pivoted away** from its four telephone co-op mechanics and shipped a different mechanic entirely. "What's next" is therefore *not* building mechanics — it's clearing four rollout preconditions, closing one UI gap, and (post-flip) the still-designed item economy + animation.
>
> Grounded in a 14-agent audit (2026-07-01) with an adversarial verification pass. Every build-status claim traces to a file:line; see §Confidence.

## The one big finding: the plan is stale, the game is built

The [[mud-wars-master-plan]] (dated 2026-06-14) describes the next work as choosing one of four **telephone co-op mechanics** — Slop Bucket / Mud Heap / Mud Fort / Truffle Hunt. **None of those were built.** Instead, migrations `20260665`–`20260672` implement a completely different **rhythm war**: a throw minigame, a daily-tug/rout rope, Fronts (Colonel-Blotto lane deploys), "Songs of the Bog" rhythm rounds with double-blind deploy, and barn-visit access fuel. `20260671_enable_rhythm.sql` flips `mud_rhythm_on() → true`. The whole client (`app/mud-war.tsx`, `clan-ladder`, `SounderCard`, `RhythmDefense`/`SlopToss`/`FrontBoard`, `MudWarResolvedModal`, `WarSpoilsSheet`, `useMudWar`/`useCrew`, `utils/mudWars.ts`) is wired end-to-end.

**Action:** confirm the rhythm war *is* the v1 mechanic before anyone touches Mud Heap/Fort — that's the biggest un-flagged divergence in the codebase.

## Current state

**Built + server-authoritative (dark only because the client is flag-gated):**
- Base crew/war stack — `crews`, `crew_members`, `crew_invites`, `mud_wars`, `mud_slings` + full lifecycle RPCs (`create_crew`, `invite_to_crew`, `challenge_house/crew`, `accept/decline_challenge`, `resolve_war`, `war_state`, `my_war`, `find_challengeable_crews`, `crew_leaderboard`). `20260647000000_mud_fights.sql`.
- War-spoils earning spine — 25 cost=0 cosmetics (`20260650`), `war_exclusive` backfill + `grant_war_spoils_on_resolve` trigger (`20260660`), `war_winner_regen` + `mud_champion/veteran/legend` titles.
- pg_cron sweep (`sweep_mud_wars`, `20260663`) + dev harness (`dev_end_war_now`, `20260664`).

**Built but dark / intended-unpushed:**
- The entire **client** Mud Wars surface (gated on `useFeatureFlag("mud_wars")`).
- The **rhythm-war** server pivot (`20260665`–`20260672`) — all carry "HELD FOR REVIEW".
- The **feature-flag infra itself** (`20260692`, this session) — seeded `mud_wars` global=FALSE, Brian override=TRUE.

**Designed-only (memo prose, no code):**
- The master plan's four co-op mechanics.
- The full **War Spoils economy** — `cosmetic_sets`, `set_id`/`war_season`/`evolve_stage`/`anim_*`, Mud Bucket gacha, War Pass, set capstones, loser/no-quorum consolation. Only the flat one-item win-drop shipped.
- **Phase-3 sprite-sheet animation** — `ANIMATED_ITEM_FRAMES`/`useFrameCycler` don't exist; `ITEM_PREBAKED` is empty. (`AnimatedCosmetic.tsx`/`cosmeticFx.ts` is a *separate* members-shop engine, not wired to war items.)

**One real code gap inside the built surface:** the leader **redeploy-a-member** picker. `redeploy_member` RPC (`20260667`) + `redeploy()` hook action (`hooks/useMudWar.ts:276`) exist, but no UI calls them — `FrontBoard.tsx:13-14` says it's "a follow-up (v1 self-commit only)". The one-per-war redeploy token is currently unspendable.

## What blocks flipping `mud_wars` on — all four preconditions OPEN

| # | Precondition | Status | Evidence |
|---|---|---|---|
| 1 | **Sounder→Drove naming rename** (BLOCKING) | OPEN | No rename migration; war crew still literally "Sounder" throughout `20260647`; `CONTEXT.md:11` unqualified |
| 2 | **Economy isolation (war-token wall)** | OPEN | `resolve_war` mints raw snouts into `profiles.counter` + writes `tickles_earned`/leaderboard (`20260647:676-678`, latest def `20260668:641-643`). No `war_tokens` anywhere |
| 3 | **Population flip-trigger metric** | OPEN | No readiness RPC/dashboard; prose-only |
| 4 | **Launch coupling** (Season-2 reset + Judgement-Day finale) | OPEN | `20260658` reschedules finale cron with zero `mud_wars` linkage; finale shape A/B/C undecided |

## Ordered next-features list

| # | Step | Effort | Depends on |
|---|---|---|---|
| 1 | ~~Confirm actual applied migration state on the live DB~~ **✅ DONE (2026-07-01).** `supabase migration list` shows **everything through `20260691` is already applied** — the entire base + rhythm stack (`20260647`–`20260672`), despite the stale "HELD FOR REVIEW" comment markers. The whole Mud Wars backend is LIVE server-side. | — | — |
| 2 | ~~Push the held flag migration + rhythm stack~~ **✅ DONE (2026-07-01).** Only `20260692` was pending; it's now pushed. `mud_wars` seeded global=FALSE, Brian override=TRUE. Backend is fully live; the game is dark **purely** because of the client flag. | — | 1 |
| 3 | **BLOCKING: Drove rename migration + CONTEXT.md SOUL/TRIBE/BANNER codification** so the war crew owns "Sounder". | S | 1 |
| 4 | **Founder decision: payout model — raw snouts vs war-token-from-flip** (plan recommends war-token). Forks step 5. | S | — |
| 5 | **Economy-isolation wall** — war-token column+redemption, or explicitly cap/counter-only the snout payout. Mind the carry-latest-def footgun (edit both `20260647` + `20260668` defs). | L | 4 |
| 6 | **Population flip-trigger instrumentation** — one `war_population_ready()` read (is_test-gated). | S | 1 |
| 7 | **Ship the leader redeploy-a-member picker** (`FrontBoard.tsx`, mirror the DeploySheet) — close the one real gap. | M | 2 |
| 8 | **Founder decision: confirm rhythm war is v1** (not the shelved co-ops) + **cadence 3 vs 7 days** (constants say 5/7, plan wanted 3). | S | — |
| 9 | **Launch-coupling sequencing** — bind the flip behind Season-2 reset + finale (after A/B/C picked). | M | 3,5,6 |
| 10 | **FLIP: widen `mud_wars` from Brian-only to a bounded cohort → then global.** The actual go-live. | S | 3,5,6,7,9 |
| 11 | **Phase 2 — War Spoils economy** (`cosmetic_sets` + `set_id`/`war_season`/`evolve_stage` + Mud Bucket gacha + consolation). Retention/virality depth. | L | 10 + crew-identity decision |
| 12 | **Phase 3 — animated apex tier** (sprite-sheet `ANIMATED_ITEM_FRAMES` + `useFrameCycler`, extends `SpritePig`). | L | 11 + animation-timing decision |

## Open founder decisions (each gates a step)

- **Payout: snouts-now vs war-token** → gates step 5 (highest leverage; precondition 2 is blocking and forks on it).
- **Crew identity: permanent clan vs per-war** (plan recommends permanent) → gates the whole Phase-2 set/evolve economy.
- **Rhythm war vs the plan's co-ops as v1** → gates whether any mechanic work happens at all (appears settled toward rhythm — `enable_rhythm` applied — but never written down).
- **Cadence 3 vs 5/7 days** → gates step 8 (constants `WAR_LENGTH_DAYS=5`/`_FRONTS=7`; RPCs inline 7-day intervals).
- **Judgement-Day finale shape (A/B/C)** → gates precondition 4.
- **Animation tech + Phase-2/3 timing** (sprite-sheet decided, Rive parked, Lottie rejected) → gates step 12.

## Confidence

Adversarially verified. All build-status claims **confirmed** against file:line. The one prior caveat — "push status is not knowable from the repo" — has since been **resolved by `supabase migration list` (2026-07-01): the entire base + rhythm stack (`20260647`–`20260691`) is already applied on the remote**, so the stale "HELD FOR REVIEW" comment markers were misleading. `20260692` (the flag) is now pushed too. The Mud Wars backend is fully live server-side; the season is dark **only** because of the client `mud_wars` flag (global=FALSE, Brian=TRUE). Everything else (client complete, four co-ops unbuilt, economy faucet open, redeploy UI missing, four rollout preconditions open, Phase-2/3 designed-only) is code-confirmed.

## Connects to
- [[mud-wars-master-plan]] — the (now-stale) source plan this reconciles against
- [[sounder-mud-fights]] — the system page

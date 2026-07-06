---
title: Wiki Index
type: meta
last_compiled: 2026-06-13
---

# Wiki Index — Tickle the Pig

The LLM-maintained catalog of every concept page in this wiki, grouped by the
category declared in each page's frontmatter. This file is regenerated whenever
a page is added, retitled, or recategorized — it is the table of contents for
the whole game-design bible. Start here, or jump straight to the
[[_topics]] taxonomy and [[_glossary]].

Each entry is `[[slug]] — one-line summary`. The maintenance log lives in
[[log]].

## Core Loop & Economy

- [[core-loop-and-tickle-trade]] — Tap Rosie to bank tickles for cosmetics, and the friends-only ask/fulfill Tickle Trade where the asker pockets 2N for free (no repay), making greed the profitable move that drives Season 0 alignment.
- [[happiness-and-mood]] — A pig's [20,80] care state driven mainly by your own tickling (friend-acts 25% as effective) that decays over time and multiplies tickle regen; its only readout is Mood — the sad/content/happy idle sprite, never a number.
- [[regen]] — How fast a pig's tickle counter refills, via regen_secs_for(uid): a VIP-tiered base multiplied by warm_tea, sluggish_snout, linear-alignment, happiness, and war_winner_regen factors, floored at 60s.
- [[streak-and-garden]] — Consecutive-engagement state on a rolling 36h window that multiplies tickle regen (linear cap at day 30 = 0.75×), read out via the Garden — a 5-stage growing Barn visual with no number; multiplier spec'd but currently headless/unbuilt.
- [[lucky-pig]] — A rare client-rolled trigger opens a 10-tickle window where 30% of tickles double, and 20% of triggers drop a rare folklore title.
- [[barn-and-habitat]] — The home-screen orchestrator (Barn.tsx) and its five hooks; the documented-but-unbuilt Exterior/Interior split and 6-slot Habitat.

## Social

- [[blessings-curses-effects]] — Season 0 friend-to-friend ritual system: sender-side blessings/curses (daily-rotating, alignment-shifting, anti-grief capped) land on receivers as timed active effects shown as "Hoofprints," cleansable for 5 snouts.
- [[friends-graph]] — The mutual-consent social graph (FriendshipStatus, 100-friend cap, username#1234 handles, six RPCs) of who you can bless, curse, trade with, and visit.
- [[referral-program]] — Invite-link referral program (snout rewards, engagement gate, milestone titles) — two systems coexist on referred_by, all UI dark-launched behind SOUNDER_VISIBLE, blocked on public launch.
- [[barn-visiting]] — Going to a friend's Barn to tap-tickle their pig for them — visiting is giving (not earning): host gains tickles + a smaller happiness bump, you gain tickles + full happiness, bounded by a 3-7 tap Tired cap, a per-target 1h cooldown, and a 5/day budget.
- [[trough]] — Communal gift fund: an opener seeds a drive for a Shop item, friends donate snouts, and on full funding the opener is granted the item while donors bank claimable 10:1 tickle rewards.

## Cosmetics & Progression

- [[shop-cosmetics-closet]] — Daily-rotating snout shop, typed-slot Closet for dressing up Rosie, rarities, and purchasable name titles.
- [[achievements-and-titles]] — Unified achievement catalog that auto-grants snouts/hats/titles at thresholds (with an infinite top-tier ladder and a reveal modal), plus the titles system: a per-user owned set, one equipped active_title_id, and a multi-source taxonomy.

## Season & Competitive

- [[alignment]] — A -100..+100 reputation score driven by trade and ritual behavior; labels you Goblin/Pilgrim/Angel at ±25 and grants real regen/blessing/curse "teeth."
- [[seasons-and-judgement-day]] — The season finale RPC finalize_season ranks everyone by alignment, grants tiered finale titles + snouts, then wipes all alignment to 0 — now fired by a live pg_cron job at noon UTC July 15.
- [[world-cup-allegiance]] — A time-boxed pick-a-side event where players back 1 of 47 World Cup countries; the flag flies on their pig and Barn. The first reusable event/Rivalry frame, with no real finale payoff yet.
- [[sounder-mud-fights]] — Optional weekly clan-war layer where a ≤5-friend "Sounder" fights on a buff-free, reset-to-zero field via a flat 20/day mud-sling, scored per-capita with quorum-2 — dark-launched behind MUD_FIGHTS_VISIBLE.

## Monetization & Economy

- [[snouts-economy]] — TTP's single soft currency (profiles.counter): many faucets, one cosmetic sink, with leaderboard rank tracked separately by tickles_earned.
- [[battle-pass-and-slop-club]] — The game's two monetization products: a per-season Battle/Season Pass unlocking the premium reward track, and Slop Club ("Pro"), a recurring subscription for QoL perks (2x regen, higher cap, more ritual casts, monthly snout stipend) — both currently kill-switched off.

## Infrastructure

- [[notifications]] — Best-effort Expo/APNs pushes fired from Postgres via pg_net, with the system_announcements table as a persistent backstop surfaced through the WhileAway launch modal.
- [[architecture-seams]] — The load-bearing boundaries decoupling TTP's client from Supabase/RevenueCat (RPC layer, effects layer, friendships, Barn orchestrator, IAP adapters, rarity tokens) plus the recurring SQL footguns.

## Design & Strategy

- [[identity-model]] — The proposed Soul/Tribe/Banner frame that reconciles TTP's four overlapping "pick-a-side" systems and resolves the live three-way "Sounder" word collision (war crew / friends graph / referral downline).
- [[design-system]] — TTP's cozy storybook UI — warm WHIMSY palette, two display fonts, and hard-shadowed paper Sticker cards; coherent at the token level but suffering application drift (dead RADII, near-unused Sticker primitive).
- [[virality-and-growth-loops]] — TTP's growth model: how a cozy single-player pig game spreads — seal the retention bucket first (make the [[streak-and-garden]] Garden visible), then ship the viral artifact (a Judgement Day "Verdict Card" identity share off the [[alignment]] axis); grounded in external viral-games research and mapped onto TTP's mostly-already-built systems.
- [[onboarding-and-guidance]] — how TTP teaches a new player its large feature surface (today: a 2-screen carousel covering ~10%). Six guidance approaches + the recommended stack (rewarded first-week checklist → just-in-time coachmarks → self-teaching empty states) and the client-presentation/server-rewards split. Onboarding = top of the retention funnel.

## Outputs / Memos

Filed query answers and analyses (see [[CLAUDE]] loop 3). Not concept pages —
they capture a point-in-time synthesis and are dated.

- [Future Direction — June 2026](outputs/memos/future-direction-2026-06.md) — multi-lens strategy analysis → prioritized roadmap; flags the destructive July-15 [[seasons-and-judgement-day]] cron, the three-way "Sounder" word collision, and the unblock-before-depth sequencing thesis.
- [UI Layout Audit — June 2026](outputs/memos/ui-layout-audit-2026-06.md) — per-page layout inventory → cross-page [[design-system]] spec; the token system is coherent, the drift is all spacing/headers/shadows.
- [Viral Games Research — June 2026](outputs/memos/viral-games-research-2026-06.md) — external, multi-source research on what actually makes games spread (growth math, 11 case studies, cozy/pet analogs, out-of-app shareability, the retention↔virality flywheel) with sourced URLs; the raw material behind the [[virality-and-growth-loops]] future-vision page.
- **Judgement Day — three rival finale plans** (authored + plan-optimized 2026-06-14, each grounded against the real `finalize_season` engine): [A — The Quiet Reckoning](outputs/memos/judgement-day-plan-a-quiet-reckoning.md) (cozy/personal/ship-now — score **93**), [B — The Great Schism](outputs/memos/judgement-day-plan-b-great-schism.md) (faction drama/post-launch — score **97**), [C — The Living Almanac](outputs/memos/judgement-day-plan-c-living-almanac.md) (a repeatable season engine — score **91**). See [[seasons-and-judgement-day]].
- ⭐ [Mud Wars — Master Plan](outputs/memos/mud-wars-master-plan.md) — **the single source of truth** for the async "telephone-type" clan war (plan-optimized to **98**): the loop in one picture, the 7 design principles, the four co-op mechanics, the War Spoils item economy, the rollout/gating, open decisions, and a phased build order. Consolidates the six sub-plans + two research briefs below. See [[sounder-mud-fights]].
- [Team / Clan / Mud Wars — Rollout Plan](outputs/memos/team-clan-mud-wars-plan.md) — the detailed rollout/gating companion to the master (Sounder naming collision, economy isolation, population flip-trigger, launch coupling); refreshed to the async pivot + plan-optimized to **95**. See [[sounder-mud-fights]].
- [Co-op Interaction Mechanics — Research (June 2026)](outputs/memos/coop-mechanics-research-2026-06.md) — sourced research on synchronized / shared-goal / pairwise co-op and fairness/anti-abuse in clan-war scoring; the design basis for the six mud-war co-op plans below.
- **Mud-war co-op mechanics — six plan-optimized options** (each a *capped co-op bonus on the flat sling*, war-isolated, cosmetic + capped-core rewards): [The Heave](outputs/memos/mudwar-coop-heave.md) (synchronized — **90**), [Rally Call](outputs/memos/mudwar-coop-rally-call.md) (synchronized + push — **91**), [Crew Truffle Hunt](outputs/memos/mudwar-coop-truffle-hunt.md) (shared-goal — **90**), [Build the Mud Fort](outputs/memos/mudwar-coop-mud-fort.md) (shared-goal, doubles as a cosmetic — **92**), [Wallow Buddies](outputs/memos/mudwar-coop-wallow-buddies.md) (pairwise — **92**), [Cover for a Crewmate](outputs/memos/mudwar-coop-cover.md) (asymmetric help — **90**). All grounded against the `20260647` mud-fights stack. See [[sounder-mud-fights]].
- [Telephone Co-op & War-Item Systems — Research (June 2026)](outputs/memos/coop-telephone-items-research-2026-06.md) — the **design pivot to ASYNC ("telephone-type") co-op** (no live/synchronized mechanics — Heave/Rally/Wallow are cut) + Miniclip/casual design + how to generate a *large* war-exclusive item pool (rarity ladders, recolors, themed sets, a War Pass, cozy gacha-with-pity, animated apex). 7 cross-cutting principles (parallelize-never-serialize, clock-not-slowest-human, low-floor/flat-ceiling, everyone-scores, reveal-is-the-reward, volume-from-multipliers, gift-not-guilt).
- **Async telephone mechanics + the item economy** (plan-optimized, grounded on `20260647`): [Pass the Slop Bucket](outputs/memos/mudwar-coop-slop-bucket.md) (async relay → parallel lap meter — **94**), [The Mud Heap](outputs/memos/mudwar-coop-mud-heap.md) (collaborative sculpture → shareable cosmetic — **95**), and [War Spoils](outputs/memos/mudwar-war-spoils-items.md) (the large war-exclusive cosmetic system: rarity tiers, sets, War Pass, gacha, animated apex — **95**). Kept async survivors: [[sounder-mud-fights|Truffle Hunt + Mud Fort]].

---
title: "Mud Wars — Master Plan"
type: plan
date: 2026-06-14
tags: [strategy, mud-wars, master, async, social, competitive]
status: draft
---

# Mud Wars — Master Plan

> A fully-optional async "telephone-type" clan war — invite ≤5 friends into a crew, challenge and accept another crew, cooperate over a ~3-day isolated war, win a pile of war-exclusive cosmetics plus a capped snout payout, rest a day, repeat — bolted onto the already-built-but-dark Sounder Mud Fights stack without ever reopening the anti-snowball spine that makes it fair.

This is the single source of truth that ties the rollout plan, the four co-op mechanics, the War Spoils item economy, and the two research briefs into one navigable picture. It is an **overview that consolidates and links** — each sub-plan keeps its own full detail; this page tells you what they are, how they fit, what order to build them, and what's still open. Everything is grounded in real TTP code: the base stack lives in `supabase/migrations/20260647000000_mud_fights.sql` — **built, dark behind `MUD_FIGHTS_VISIBLE=false` (`constants/featureFlags.ts`), and UNPUSHED**.

---

## The loop in one picture

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │  FORM CREW         CHALLENGE / ACCEPT      ~3 DAYS ON (async)         │
  │  invite ≤5 friends   leader posts, rival   each member slings on      │
  │  (are_friends-gated)  leader accepts;       their own clock; a CAPPED  │
  │  one crew/user        consensual, never     co-op bonus layers on the  │
  │                       forced; one war at a  flat-20 base sling via a   │
  │                       time + 24h cooldown   telephone co-op mechanic   │
  │                                                                        │
  │              RESOLVE (lazy, on first read after ends_at)               │
  │   per-capita-average + quorum-2 decides the winner (UNCHANGED);        │
  │   resolve_war pays own-mud + 50%-of-loser-pot + war_winner_regen       │
  │                                                                        │
  │              WAR SPOILS                     ~1 DAY OFF (rest war)       │
  │   MANY war-exclusive cosmetics              no war active = no grant   │
  │   (animated bg/hats via icon-gen) +         fires; a genuine           │
  │   a CAPPED core snout/tickle payout         forgiveness beat, free     │
  │                                                                        │
  │                          → repeat →                                    │
  └─────────────────────────────────────────────────────────────────────┘

  FULLY OPTIONAL. The cozy core game stands alone — collectors and
  dress-up players ignore the war entirely; it is the "actually try
  every week" progression layer for competitive players only.
```

The war is **fully isolated and reset-to-zero each war**: no core regen / blessing / alignment / VIP buff touches it; both crews start at zero with no carried advantage; a crew's ceiling is `members × 20 × days` — roster participation, never account strength (`20260647` header). The co-op bonus is **capped and layered on top** of the flat base sling, so the anti-snowball holds. This honors the resolved design from the founder grill: see [[team-clan-mud-wars-plan]] for the founder voice-memo decisions this serves.

---

## Design principles

The seven cross-cutting principles are the rubric every mechanic below is scored against. Principles 1-2 and 5-7 trace to the telephone/items brief ([[coop-telephone-items-research-2026-06]] — async failure modes, the reveal-as-reward, item-volume multipliers, gift-framing); principles 3-4 trace to the co-op-mechanics brief ([[coop-mechanics-research-2026-06]] — the per-capita anti-dominance spine, the binary participation floor, race-don't-duel):

1. **Parallelize, never serialize.** The fatal flaw of a "telephone" chain is the single blocker — one no-show freezes everyone downstream (Diplomacy, Draw Something). A 5-person crew has zero slack, so the war must be a collaborative artifact each member fills independently — **sum of parts, not a baton**.
2. **The clock advances the war, never the slowest human.** A fixed window resolves on schedule whether or not laggards respond; a missing member contributes 0 (graceful degradation). TTP's lazy `resolve_war` already does exactly this — no cron.
3. **Low floor, flat ceiling.** A low **binary** participation floor ("log ≥1 action this war") kills the pure free-rider; a **flat/capped** reward above it kills both the whale-snowball and the DKP-gap. Capping payout *is itself* the strongest anti-alt tool — it starves alt-funneling of payoff.
4. **Everyone scores, win or lose; race, don't duel.** Earn on a loss so casuals are never dead weight; a race softens matchmaking lopsidedness. Rewards decouple from the win/loss outcome via the participation floor.
5. **The reveal/artifact is the reward.** Authorship + surprise is the payoff — no win/lose pressure needed. The assembled artifact (the Heap, the Fort, the filled meter) *is* both the cosmetic and the shareable screenshot.
6. **Volume of items comes from multiplier mechanics, not more unique art.** Rarity ladders, recolor/chroma variants, themed sets, a War Pass, and seasonal vaulting turn a few dozen base assets into hundreds of SKUs — animation reserved for the apex.
7. **Gift-framing, not guilt.** Every payout reads as a gift the crew gives each other, never a debt the absent owe (the Snapchat-streak cautionary tale; the Duolingo/Kitfox antidote). No streak-broken red emoji; copy celebrates the crew, never shames a stall.

> **The one deliberate trade.** The co-op-mechanics brief's headline is "make togetherness *strictly better* via a **multiplicative** bonus." Every TTP mechanic below consciously **declines multiplicativity** — a multiplicative crew score is exactly the whale/big-crew snowball lever the founder grill ruled out. Each plan substitutes the *other* load-bearing levers (the binary floor, the distinct-human gate, the filling meter, the dual-track reward) and keeps the bonus **additive + capped**, with the per-capita base as the untouched fairness spine.

---

## The mechanics layer

Four interchangeable telephone co-op mechanics, each a **capped bonus layered on the flat base sling** that never touches the per-capita win math. They are alternatives competing for the same "shared crew artifact" slot — ship one (or a couple), not all four. Optimizer scores in parentheses.

- **[[mudwar-coop-slop-bucket]] (94) — async relay → parallel lap meter.** A shared slop bucket the whole crew fills on their own time: anyone scoops whenever they open the app, and a "lap" completes the instant *every active member has scooped* — a **parallel meter, not a baton**. A telephone *narration* (the "🪣 it's with you" nudge) rides on top for the open-loop pull, but it can never block a scoop. A scoop **is** a sling (rides the existing flat-20 verb), so there's nothing new to balance; lap completion pays a small flat capped bonus (`SLOP_LAP_BONUS=5`, capped 50/war). The sharpest resolution of Principle 1 — the single-blocker failure mode is designed out, not patched with a skip valve.

- **[[mudwar-coop-mud-heap]] (95) — async collaborative sculpture → shareable cosmetic.** Over the war the crew builds **one** goofy mud sculpture telephone-style — each member, on their own time, reacts to the previous piece and stacks the next from a small palette (base pieces + "reactor" pieces whose joke depends on what's underneath). One piece/member/day. At war's end the finished, crew-named Heap *becomes* the war cosmetic AND a shareable image. It is the literal telephone game wired into TTP's item system: the surprise reveal *is* the cosmetic, the cosmetic *is* the screenshot — one asset doing the co-op-hook, kept-cosmetic, and share-bait jobs (the **War Spoils item-generator**: a combinatorially-unique cosmetic per crew per war from one small art batch).

- **[[mudwar-coop-truffle-hunt]] (90) — async shared dig (N distinct crewmate digs).** A war-only buried truffle that needs **N digs from N distinct crewmates** to unearth. The first sling of the war by each distinct member counts as their dig (a savepoint-guarded side-effect of `sling_mud`); hitting `TRUFFLE_DIGGERS_NEEDED=3` (clamped to crew size) unearths a flat capped bonus (`TRUFFLE_BONUS=15`). The distinct-human requirement is simultaneously the co-op hook *and* the anti-abuse mechanism — one whale slinging 1000× contributes exactly 1 to the count. The **lowest-effort** option (reuses the existing `truffles`/`truffle_digs` dig stack re-pointed at a war).

- **[[mudwar-coop-mud-fort]] (92) — async staged collective build.** The crew's existing slings, re-read as construction: each sling lays a brick, the Fort climbs through staged cosmetic art (muddy lot → wall → ramparts → gate → flag-topped fort), and the winning crew keeps it forever as a war-tagged cosmetic. The Fort is a **derived view** of the same `mud_slings` data tiered **per-capita** (no new ledger, no new verb, no new table — just a `fort_stage` column + a tier helper). The **minimal-new-surface** option: building *is* slinging, so the hot path stays single-write.

> The Heap and the Fort are explicitly two designs for the *same* "kept crew cosmetic" slot — ship one. The Heap is the pick when the goal is the item-generator + virality (unique shareable artifacts); the Fort is the pick for minimal new surface. The Slop Bucket and the Truffle Hunt are lighter, additive bonuses that can coexist with either.

---

## The item economy

**[[mudwar-war-spoils-items]] (95) — the large war-exclusive item economy.** This is the headline reward system, not one item. Every Mud Fight should end with the crew opening the app to a *pile of mud* — a deep, war-only cosmetic vault obtainable no other way: animated bog backgrounds, hats that splatter over a season, themed "mud sets" with completion-only capstones, recolor floors, a Mud Bucket gacha with dupe insurance, named-season scarcity, evolving apex Heirlooms. The catalog must be **large** (hundreds of SKUs) yet cheap to author — recolor/theme multipliers over a few dozen anchors via the ChatGPT/`icon-gen` pipeline — durable (rarity ladder + scarcity protect value), and **fair** (server-authoritative, contribution-gated, capped, idempotent grants — the cash-faucet lesson).

The whole render/inventory/equip stack is **already built**: every War Spoils item is a normal `public.hats` row (so `PigStage`, the shop, the Closet, `user_hats` all resolve it for free), distinguished only by new metadata columns (`war_exclusive`, `war_season`, `set_id`, `anim_*`). The earning surface is the **existing** loop — `sling_mud` is the binary floor (logged ≥1 sling = eligible), `resolve_war`'s contribution-gated winner loop is where grants bolt on, each in its own savepoint. Three earning channels (the flat-sling floor, the win drop, the Mud Bucket gacha), each capped/idempotent; a no-quorum consolation + soft-pity catch-up close the stalled-chain hole.

**The rarity ladder** maps the research's 5 mud tiers onto the existing `hats.rarity` CHECK: Muddy `common` (recolor floor) → Caked `uncommon` → Prize `rare` (bespoke static) → Champion `epic` (animated) → Heirloom `legendary` (animated + evolving + set-capstone). **Animation is reserved for the top two tiers** ("put motion at the top — players can't fake it"). Themed **sets** (`cosmetic_sets` table + `set_id` FK) are the async-interdependence lever: no member can finish a multi-piece set alone in one war, so completion is paced across wars with the crew you keep winning with — the deliberate substitute for synchronous co-op. A **War Pass** (30-50 tiers, dual-track, identical rewards, premium = faster) carries the bulk, and a third **gacha** channel (the Mud Bucket) reskins the existing `grant_mystery_box` — both capped/idempotent, mechanics detailed in [[mudwar-war-spoils-items]].

**The static-Phase-1 / animated-Phase-2 cut is load-bearing.** Animation is a real tech gap (today every cosmetic is a static PNG; `CATEGORY_PERANIM_SHIFTS` in `constants/hats.ts` only nudges position per *pig* pose, it doesn't animate the item) — but the primitive already exists: `components/ui/SpritePig.tsx` is a working frame animator and `constants/prebaked.ts` proves the per-item multi-frame-strip swap. The decision is **sprite-sheet frames** (extend that primitive), with Rive parked and Lottie rejected — the *why* lives in [[mudwar-war-spoils-items]], not here. The point for this master is the **sequencing**: the fairness/anti-abuse spine ships **all-static in Phase 1** (the risky-to-get-wrong part, small and reversible), and the animated render path backfills behind it in **Phase 2** — animation never gates the launch.

---

## Rollout & sequencing

The gating preconditions (consolidated from [[team-clan-mud-wars-plan]], which is being refreshed to async in parallel) must land **before** `MUD_FIGHTS_VISIBLE` flips. Ordered by dependency:

1. **Resolve the "Sounder" naming collision first — BLOCKING.** The word names three shipped things: the friends graph (`CONTEXT.md`), the referral downline (`sounder_*` titles), and the war crew. Flipping a new social surface on top bakes the contradiction into the UI. Fix: a display-name-only migration renaming the referral-downline titles' player-facing copy to "the Drove" (leave `titles.id`/`source` untouched), plus a `CONTEXT.md` SOUL/TRIBE/BANNER codification so "Sounder" means exactly one thing (the war crew).
2. **Economy isolation.** Today `resolve_war` mints raw spendable snouts — a new uncapped faucet against the no-sink problem. Season 2 introduces a **war-only token** (`profiles.war_tokens` or a ledger) redeemable only for war-exclusive cosmetics + the regen buff, so the competitive layer can't flood the cozy core. (The capped core snout/tickle payout in the resolved design is the *bounded* faucet that survives; the war-token wall is the larger isolation.) Bot-bot wins grant cosmetic/title only — no token, no buff.
3. **Population flip-trigger (committed metric, not a date).** Flip only when post-launch metrics show **≥2 distinct non-bot crews, each ≥2 active members (quorum), ≥8 distinct active players combined**, holding ~3 consecutive days — then a founder judgment call. Until then `find_challengeable_crews` returns near-empty and the bot is the whole game (the wrong first impression for a clan war). Instrument with a one-query dashboard read.
4. **Launch coupling.** The war is the **Season 2** headline — it sits *behind* the public-launch package (leaderboard reset at the App Store cutover + beta-skin grant + beta-purchase reset). The war must not flip until the reset baseline is set, or early war winners get an unfair head start on the freshly-reset board. This also couples to the Judgement-Day season-finale decision: the SOUL finale and the war's leaderboard reset are two reset moments that must not collide — pick the finale shape first (see the three options [[judgement-day-plan-a-quiet-reckoning]] / [[judgement-day-plan-b-great-schism]] / [[judgement-day-plan-c-living-almanac]]), then sequence the war flip after it.
5. **MVP phasing.** Push `20260647` **dark** (schema live, flag false, pgTAP runs against the real DB) → internal test a real war + a bot war end-to-end → ship the chosen co-op mechanic + War Spoils Phase 1 (all-static) dark → flip once the population gate clears, with the war-token + cosmetic-tie shipped.

The **cadence change** (5→3 days on) is a small, mechanical swap: today the war length is a hard-coded `interval '5 days'` in exactly two writers — the bot-war `INSERT` in `challenge_house` and the `ends_at` `UPDATE` in `accept_challenge` (`challenge_crew` only creates a `pending` war and the `interval '24 hours'` there is the *rematch cooldown*, not the war clock). Lift both to one new `WAR_LENGTH_DAYS` constant (the `20260647` header already names it as the intended knob) so the cadence lives in one place, then set it to 3. The "1 day off" rest is **not** enforced for v1 (no season scheduler); the existing 24h rematch cooldown is the informal rest. A real on/off scheduler is a flagged follow-on. Crucially, the rest week needs **no special-casing in any grant logic** — a rest week is the *absence* of a `resolve_war` call, so no grant fires, a genuine forgiveness beat for free.

---

## Open decisions

The decisions that are not yet resolved and need a founder call before the relevant phase:

- **The payout cap.** Snouts-now vs war-token-from-day-one. Raw snouts are faster but open the faucet; the war-token economy is the cleaner Season-2 story but adds a migration + redemption surface. Recommendation across the plans: **war-token from the flip** (the flip is gated post-launch anyway, so no rush justifies opening the faucet). The exact bonus values (`SLOP_LAP_BONUS`/`TRUFFLE_BONUS`/`FORT_BONUS`/`HEAP_BONUS` ≈ 5-30, all `HOUSE_BONUS=25`-order) and whether they write `tickles_earned` (leaderboard) or `counter`-only are the live per-mechanic tuning knobs — conservative default is `counter`-only (off-leaderboard), matching the bot-stipend precedent.
- **Crew-vs-per-war identity.** The crew persists across wars today (one crew per user) — the durable-belonging TRIBE read, and what makes the cross-war **set-completion** pacing in War Spoils work. Confirm this permanent-clan shape before marketing "your clan." (Per-war crews would break set pacing and the cross-war Heirloom evolution.)
- **The animated-cosmetic tech choice.** Sprite-sheet frames for v1 (decided, extends `SpritePig`); **Rive parked** for the Heirloom marquee tier later; **Lottie rejected** (vector/raster mismatch). The open part is *when* Phase 2 lands and whether the apex ever justifies the Rive native-runtime bet.

Secondary open decisions live in the sub-plans: the mechanic threshold tuning (`TRUFFLE_DIGGERS_NEEDED`, the Fort tier curve, `HEAP_MIN_PIECES`), the open-challenge board (relaxing friend-gated discovery post-launch), and the two-season calendar.

---

## Consolidated build order

Phased so each push is small, reversible, and dark-launchable. The risky-to-get-wrong fairness spine ships first; the art-volume grind backfills behind it.

| Phase | What | Migration | Depends on |
|---|---|---|---|
| **0. Base live** | Resolve "Sounder" naming (display-name migration); push `20260647` **dark**; run pgTAP; internal-test a real + a bot war | `20260647` (push) + a small Drove-rename file | nothing (it's built) |
| **1. Mechanic** | Ship the chosen co-op mechanic (Heap *or* Fort for the kept-cosmetic slot; Slop Bucket / Truffle as light additive bonus) behind the same flag | `20260650000000_*.sql` (one follow-on) | Phase 0 |
| **2. War Spoils items** | The all-static economy: schema (`hats` columns + `cosmetic_sets` + `user_hats.evolve_stage`), the three grant RPCs, the `resolve_war` rewire, a static first-season pool | `20260650000000_war_spoils.sql` (or fold with Phase 1) | Phase 0; Phase 1 if the mechanic generates the cosmetic |
| **3. Animation** | `ANIMATED_ITEM_FRAMES` + `useFrameCycler` + Barn-bg cycler; promote apex tiers to `anim_kind='spritesheet'`; first animated bg + aura; evolving Heirlooms; Flashback | client-only + a catalog seed | Phase 2 (gated behind a low-end-device perf pass) |

Every follow-on migration **sorts after `20260649000000_onboarding_checklist.sql`** (the latest on disk) — i.e. `20260650000000+`. The war-token + cosmetic-tie (rollout items 2/C) land alongside Phase 1-2 before the public flip.

---

## Risks

The footguns that recur across every sub-plan, each with the documented fix:

- **Carry-latest-def (highest).** Every `CREATE OR REPLACE` of `resolve_war` / `war_state` / `war_side` / `sling_mud` must carry its body **verbatim from the latest `20260647` def**, adding only the new grant/bonus lines. Re-deriving from an older base silently deletes the bot-farm guard, the savepoint hardening, or the per-capita scoring (the build-93 referral-gate class of bug). **Diff line-for-line against `20260647` before any push.**
- **INLINE `system_announcements` only.** Every reveal/turn-prompt/drop is a direct `INSERT INTO system_announcements`. **Never `send_system_announcement`** — it's admin-gated, raises `admin_only`, and silently rolls back a non-admin's whole RPC (the documented `donate_to_drive` footgun).
- **Idempotent, capped, server-authoritative payouts.** All grants ride inside `resolve_war`'s `resolved_at`-guarded run-once body (or a per-mechanic `unearthed_at`/`last_paid_lap`-style stamp), each `ON CONFLICT DO NOTHING` + savepoint-guarded so a cosmetic fault can never roll back or double-pay the snout payout. No grant scales above the binary floor (anti-DKP, anti-whale, anti-alt). Bot wars grant **no** cosmetics (re-challengeable, fixed-pace — must never be a faucet).
- **Migration filename sort.** Must sort alphabetically after `20260649`; two files sharing a prefix collide on `schema_migrations.version` (PK). `20260647` is unpushed and owns `mud_wars`/`mud_slings`/`resolve_war` — it must apply **before** any follow-on that depends on it.
- **Flipping into a ghost town / the economy faucet / the naming collision** — the three rollout risks, each gated by a precondition above (population gate, war-token wall, the blocking Drove rename). DB pushes require an explicit user "go" — never autonomous.
- **The single-blocker stall** (design risk) — closed structurally by Principle 1 (parallel meter / per-day budget / distinct-digger set check, never a baton that one no-show freezes) plus the no-quorum consolation + soft-pity in War Spoils.

---

## Sub-plans & research

The optimized sub-plans (cite their scores; full detail lives in each — this master does not duplicate it):

- **[[team-clan-mud-wars-plan]]** — rollout/gating: the "Sounder" naming collision, economy isolation, the population flip-trigger, launch coupling. The founder voice-memo decisions are the source of truth. *(Being refreshed to async in parallel with this master.)*
- **[[mudwar-coop-slop-bucket]] (94)** — async relay reframed as a parallel lap meter; the sharpest single-blocker fix.
- **[[mudwar-coop-mud-heap]] (95)** — async collaborative sculpture → shareable combinatorial cosmetic; the War Spoils item-generator.
- **[[mudwar-coop-truffle-hunt]] (90)** — async shared dig requiring N distinct crewmate digs; the lowest-effort mechanic.
- **[[mudwar-coop-mud-fort]] (92)** — async staged collective build; the minimal-new-surface mechanic (building == slinging).
- **[[mudwar-war-spoils-items]] (95)** — the large war-exclusive item economy: rarity ladder, sets, War Pass, gacha, animated apex, the Phase-1/Phase-2 cut.

Research foundations:

- **[[coop-telephone-items-research-2026-06]]** — async/telephone mechanics, Miniclip casual design, item-systems volume, async fairness (the four lenses + the 7-principle TL;DR).
- **[[coop-mechanics-research-2026-06]]** — synchronized bursts, shared-goal contribution, pairwise help, and fairness/anti-abuse (the per-capita anti-dominance spine, the participation gate, the kept artifact).

Other co-op mechanic explorations in the same folder (`mudwar-coop-cover`, `mudwar-coop-heave`, `mudwar-coop-rally-call`, `mudwar-coop-wallow-buddies`) are alternative sketches superseded by the four scored plans above.

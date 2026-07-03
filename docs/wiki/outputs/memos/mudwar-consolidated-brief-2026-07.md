---
title: "Mud Wars — Consolidated Design Brief (all 23 docs)"
type: memo
date: 2026-07-01
tags: [mud-wars, season-2, design, ideation, consolidation]
status: draft
---


*Ground truth date 2026-07-01. Weighting rule: where docs conflict, `docs/wiki/outputs/memos/mudwar-whats-next-2026-07.md` (the adversarially-verified audit) beats the June plans, and shipped code/constants beat every doc.*

---

## 1. The canonical CURRENT design — what the rhythm war actually IS

The season that is **built, live-on-prod, and dark only at the client `mud_wars` flag** (`global=FALSE`, Brian=`TRUE`; `constants/featureFlags.ts`) is **"Songs of the Bog"** — a rhythm crew-war, designed in `docs/mudwar-rhythm-design.md`, sitting on the Fronts substrate (`docs/mudwar-clan-design.md`) which sits on the base clan-war spec (`docs/sounder-mud-fight-spec.md`, `docs/wiki/sounder-mud-fights.md`). Three flag-gated fold-modes coexist: **rhythm ⊃ fronts ⊃ classic**; the rhythm mirror-fold is what runs where `mud_rhythm_on()=true`.

**The isolation firewall (invariant from base spec → shipped, the anti-snowball spine).**
War scoring starts both crews at **zero** with **no buffs** — alignment, blessings, VIP regen, snout wealth never leak in. Contribution is its own verb, decoupled from the buffed core tickle loop. Rope moves **only** on normalized band-mud. Winning cosmetics are `cost=0`, unbuyable, un-Troughable by construction.

**Crew + lifecycle.**
- Crew ("Sounder" today, **rename to Drove pending** — §5) = ≤5 friends, `are_friends`-gated invites, one crew per user (`docs/wiki/sounder-mud-fights.md`).
- `challenge_crew` → `accept_challenge` (mutual-accept kills farm matchups). House bot **"The Mudlarks"** (`…0000b0`, `is_bot=true`) via `challenge_house` guarantees a war exists at 27 players; bot pace 12/day; beating it grants only a flat **HOUSE_BONUS=25** stipend + buff, **no** cosmetics/titles/leaderboard (anti-faucet, `docs/wiki/outputs/lint/2026-06-13-mud-fights-review.md`).
- **24h post-war cooldown** (`crews.next_war_at`, `WAR_COOLDOWN_HOURS=24`) via BEFORE-INSERT trigger on `mud_wars` — kills win-trade farming.
- Lazy idempotent `resolve_war` on first read after `ends_at` (FOR UPDATE + `resolved_at` guard, no cron; a `pg_cron sweep_mud_wars` also exists, `20260663`).

**The week (7-day clock; `BUILD_DAYS/WAR_DAYS = 2/5`, `WAR_LENGTH_DAYS_FRONTS=7` confirmed in `constants/mudFights.ts:20`).**
1. **Tend the Mire** (days 1–2): co-op build via the shipped 7-throw timing toss, no snouts spent.
2. **Loose the Horde** (end of day 2, re-choosable per Hold day): each crew secretly maps its 3 waves easy/med/hard **one-to-one onto the opponent's 3 areas** (`mud_war_deploys`, **leader-only**, fogged) — an active double-blind Colonel-Blotto.
3. **Hold the Line** (days 3–7): short rhythm runs.
4. **The Mire Settles** (day 7 or rout ±12).

**The skill core (Slop Toss + Rhythm run).**
- **Slop Toss** (Tend, the shipped timing minigame): hold the bucket, release as a goblin crosses the strike zone; whiff/weak/good/perfect → **0/1/2/3 mud**; **7 throws/day**, **21 mud/day cap**. Goblin archetypes grunt/scout/brute/warboss vary speed×value (art shipped, `docs/mudwar-goblins-brief.md`; 10-sprite horde wired into `SlopToss.tsx`).
- **Rhythm run** (Hold, the new skill core): ~12s runs of **3 scored notes** (`NOTES_PER_RUN=3`, `RUN_LENGTH_MS=12000`) tapped on the beat against the deployed wave; **RUNS_PER_DAY=2** (+1 access token). 2–3 members co-defend one area and their mud **SUMS under a 12-cap**.

**Scoring / fold (the mechanic-by-mechanic heart).**
- Per-capita active-average base with **quorum=2**: `SUM(mud)/COUNT(members WHERE mud>0)` — makes 5-crew vs 3-crew fair; alts/ghosts drag the average (self-defeating).
- **Super-additive concentration fold** — the single most-validated lever in the lineage: `effMud = Σ min(memberMud, 12)`; dispersion below hold-pressure banks nothing, concentration past it holds + a rout bonus. **`PER_AREA_CAP=12`** forces multi-body coordination (no lone ace solos a floor).
- **Areas** = 3, public values **V=[5,4,3]**; hidden fuzzy hold-pressure **P≈[26,22,18] ±20%**, revealed at rollover; **FRONT_SCALE=4** (`constants/mudFights.ts:34`).
- **Difficulty = HOLD-PRESSURE, not cosmetic** (the sim refuted "cosmetic-only"): a hit's *value* is always normalized (perfect=3 on any difficulty → flat floor + preserved skill ceiling); difficulty raises the bar to hold an area (`HOLD_COEF=0.78`, `PRESS = easy 0.80 / med 1.0 / hard 1.30`) and mildly tightens timing windows (`1.30/1.0/0.82`). So the deploy is a genuine resource-drain: aim your hard wave where they're thin, your easy wave is a cheap gift elsewhere.
- **Mirror fold** (`fold_rhythm_margin`, the integration-critical difference from head-to-head Fronts): each crew defends its **own** mud on each area vs the **opponent's** deployed hold-pressure; day margin = `challenger_held_V − defender_held_V`. Neutral-default deploy = med when unset (Tend days fold as gentle even pressure).
- Rope notch math: `base_notch = round(per_capita_margin/5)` clamp ±4; `coord_notch = clamp(round(front_margin/FRONT_SCALE), −2,+2)`; total clamp **±5**; **ROUT=12**.
- **Decision B (locked):** defender plays their area's own public light/medium/heavy song; the opponent's deployed difficulty is hidden pressure revealed only in the post-day recap — preserves the double-blind.

**Access fuel (the Connect hook).** A crewmate's **barn visit** mints a flat war-scoped token = **+1 short-song attempt** per recipient per Hold day (`ATTEMPT_TOKEN_CAP=1`, `grant_war_access`, `20260669`). Crew+war-scoped (not friends-graph), scores the **submitted** run (not best-of-N) — can't leak VIP-tickle wealth or be alt-farmed.

**Anti-cheat.** Wire stays band-enum-only; server regenerates the chart from `CHART_SEED = hashtext(war:day:area:diff:caller_id)` — folding `caller_id` defeats copy-a-perfect-array between co-defenders (exploit ceiling == skill ceiling). A hardening migration `20260672` closed a live REVOKE-FROM-PUBLIC hole (anon could tamper Elo / bypass fog). *[Correction 2026-07-03: code-verified during Option-C scoping — the `caller_id`-folded `CHART_SEED` never shipped server-side; pressure seeds are `hashtext(war:day:front)` (crew-independent) and charts are client-cosmetic with a bands-only wire. See [[mudwar-scope-c-hungers-hoard-2026-07]].]*

**Meta.** Seasonal **Elo clan ladder** (high-K provisional first 3 wars), scaled by |rope margin| (rout > squeaker), surfaced as `app/clan-ladder.tsx`. Weekly **siege modifier** is **stored + displayed only — gameplay effects NOT built**.

**Rewards, as actually shipped.** Winners: own war score 1:1 in snouts + **50% of loser's pot** (per-capita split) + `war_winner_regen` ×0.85/72h + `mud_champion/veteran/legend` titles (thresholds 1/5/25) + **one random war-exclusive cosmetic** from a 25-item pool (`grant_war_spoils_on_resolve`, `20260660`; art = `docs/openai-mud-war-items.md`, seed `20260650000000_mud_war_cosmetics.sql`, `war_season='s2_mud_derby'`).

**Client, code-complete:** `app/mud-war.tsx`, `app/clan-ladder.tsx`, `SounderCard`, `RhythmDefense.tsx`, `SlopToss.tsx`, `FrontBoard.tsx`, `MudWarResolvedModal`, `WarSpoilsSheet`, `useMudWar`/`useCrew`, `utils/mudWars.ts` (all gated on `useFeatureFlag('mud_wars')`).

**Sim validation (why to trust the fold):** rhythm 5-seed Monte-Carlo (`docs/mudwar-rhythm-design.md`) — coord>scatter 78–80%, skilled-scatter>unskilled-coord 86–93%, mirror draw 37–41%, deploy swings held-V by ~2.7 mean, 0 pure saddle points; Fronts substrate hit coord>scatter 96%.

**One real code gap inside the shipped surface:** the leader **redeploy-a-member picker**. `redeployMember` RPC (`20260667`) + `redeploy()` hook action (`hooks/useMudWar.ts:276`) exist and `FrontBoard.tsx:129` even renders "Redeploy token: 1 available (leader)" — but **no UI calls it**, so the one-per-war token is currently unspendable.

---

## 2. The IDEA BANK — shelved mechanics + item economy, framed as reusable grafts

None of this is pending work. It's a mine. Every item below is designed-only against the *base per-capita spec*; the graft note says how it attaches to the **shipped rhythm war**. All share one anti-abuse spine (§4) and one reuse toolkit (mud_slings day-bucket, lazy idempotent resolve, INLINE `system_announcements`, `send_push_to_user`, `user_hats` runtime grant, `cost=0`=unbuyable, mud_war-source titles, bot-war-grants-nothing).

**The four telephone co-op verbs** (`mud-wars-master-plan.md`; each has its own memo). They vary only in the co-op *verb* and its interdependence shape:
- **Mud Fort** (`mudwar-coop-mud-fort.md`) — the *cheapest* graft. A staged structure (lot→fence→wall→ramparts→gate→flag `FORT_TIERS=[0,3,12,24,40,54]`) that is a **pure derived view of the existing per-capita metric** — zero new table, verb, or RPC. Front-loaded tiers for fast early wins; mid-war rally-banner treat; cosmetic-at-any-win / bonus-at-completion split. On the rhythm war: re-key the stage curve off the rope/per-capita metric already returned by `war_side`.
- **Mud Heap** (`mudwar-coop-mud-heap.md`) — the *item-generator / virality* graft. Async telephone sculpture: each member stacks a piece (Base + **Reactor** pieces whose joke depends on the piece below), finished crew-named Heap becomes a **combinatorially-unique** cosmetic + shareable image from one small art batch. **Mutually exclusive with Fort** — same "kept crew cosmetic" slot, ship one.
- **Truffle Hunt** (`mudwar-coop-truffle-hunt.md`) — the *lowest-effort distinct-human* graft. A buried war-truffle needing **N distinct diggers** (`TRUFFLE_DIGGERS_NEEDED=3`); the first action of the war by each member = their dig. A composite `(truffle_id, digger_id)` PK makes `COUNT(*)` the distinct-participant count for free — a whale slinging 1000× counts as 1. Kept artifact = a permanent title surviving the war's cascade-reset.
- **Slop Bucket** (`mudwar-coop-slop-bucket.md`) — the *heartbeat-without-a-blocker* graft. The load-bearing **meter-vs-baton split**: the LAP is a parallel meter (completes when every active member has scooped, any order); the BATON is narration/push only and can **never block** a scoop. Uniquely **repeating** (`SLOP_LAP_BONUS=5`/lap capped 50/war) and **off-leaderboard** (counter-only). On the rhythm war: "a co-op action IS a throw" + a named-nudge push loop with no single-blocker.

**The four scored co-op sketches** (`coop-*` memos, answering Tension #1 / decision D6). Two pairwise, two crew-wide:
- **Heave** (`mudwar-coop-heave.md`) — the **only co-presence / live-window** sketch and self-billed **cheapest**. When **2+ crewmates sling inside a rolling 90s window** (`HEAVE_WINDOW_SECS=90`, `HEAVE_MIN_CREW=2`), the rope yanks harder and everyone in the window banks bonus mud (`HEAVE_COMBO_CAP=2.0`, `HEAVE_DAILY_CAP=15`). It is the direct ancestor of the shipped 2–3-defender concentration fold, and the closest existing design to *"add a live crew-burst moment to a Hold day."* Carries the **opener back-credit** primitive (§4). Needs the `last_sling_at` liveness fix (§6).
- **Rally Call** (`mudwar-coop-rally-call.md`) — **push-with-a-name** re-engagement pulse: a crewmate fires a timed 15-min rally, a push fans out ("Jen called a mud rally — pile on!"), breadth-scaled bonus `LEAST(3, 2+others)`. The caller banks the *smallest* (the reward is the gift to the table). Flags the recurring **`app/_layout.tsx` push-deep-link NET-NEW gap**.
- **Wallow Buddies** (`mudwar-coop-wallow-buddies.md`) — **server-assigned rotating pairwise bond** (Duolingo Friend Streak, gain-only, rotation = the anti-collusion valve). Carries the single cleanest resolution of the core tension: a **"multiplicative-FEELING but score-neutral" wallow-chain meter** — a per-war count rendered as a filling bar that gates a kept cosmetic while **never touching the rope**; and **record-the-event-even-when-reward-clamps** (write the combo row even when mud credit hits zero, so the social beat + cosmetic gate fire for maxed pairs).
- **Cover for a Crewmate** (`mudwar-coop-cover.md`) — asymmetric **help a genuinely-absent** (0-slings, ≥12h-stale) crewmate to a discounted capped floor (`COVER_RATE=0.5`); reward goes to the **helper**, gated on covering ≥K distinct absent slots. A direct answer to the rhythm war's self-flagged solo/thin-crew problem (a defender missing on a Hold day).

**The item economy** (`mudwar-war-spoils-items.md` = the system; `openai-mud-war-items.md` = the shipped art). Only the flat 25-item win-drop shipped; the rest is designed-only:
- **5-tier rarity ladder** on the existing `hats.rarity` CHECK: Muddy→Caked→Prize→Champion→Heirloom; **animation reserved for the top two tiers** ("put motion at the top — players can't fake it").
- **Themed sets** (`cosmetic_sets` + `set_id`) with **completion capstones you can't buy piecemeal** — the async-interdependence lever (no set completes in one war; pacing across the crew you keep winning with). Two sets are art-defined: **Swamp King** and **Mud Derby Festival**.
- **Mud Bucket gacha** (reskin of `grant_mystery_box`, Efraimidis-Spirakis pick), **evolving Heirlooms** (`evolve_stage` bumped per win), **named-season scarcity + Flashback**, **War Pass** (30–50 tiers, dual-track — note: only mentioned as a bucket-exclusion *filter*, the least-defined layer).
- **The catch-up / stall-valve family** (the levers that address §7 whitespace directly): no-quorum consolation (both crews, anyone ≥1 action gets a Muddy recolor); "earn on a loss" consolation (one Muddy-tier drop for losing contributors, capped 1/war); **soft-pity rarity floor** (≥uncommon after 2 losses/draws, ≥rare after 3, computed from a COUNT, no new column); dig-stamp **dupe-insurance** (after K dupes, next pull guarantees a missing set member).
- **Volume engine:** recolor 6 base anchors × 8 mud-tones = ~34 free SKUs (`scripts/recolor.py`, no ChatGPT quota); base × theme = 40/prompt.

**The alternate direction** (`the-mud-off.md`) is a *different concept*, not a co-op verb — see §3.

---

## 3. Alternate directions (the-mud-off)

`docs/explorations/design-compendium/the-mud-off.md` is the one **structurally different** concept in the corpus and was **not the direction shipped**. It's a **two-faction PASSIVE turf war** (Hilltoppers vs Valleyfolk), distinct from the shipped 5-person ACTIVE crew war on every axis:
- **Passive, zero-new-tap contribution:** rides the already-shipped monotonic `tickles_earned` counter — a lazy per-cycle base snapshot turns all subsequent earning into "muck" with no new write path (Trough live-delta pattern).
- **Belonging via a side you wear 2 weeks** (`faction_cycle_id`, lock-once, free re-pick each cycle) — a public persistent-world scoreboard you check with morning coffee, vs. a per-war 5-person crew.
- **Fairness engineering (the part worth mining even though the concept is shelved):** per-capita average + **quorum floor** (`QUORUM=8`), `is_test` excluded both sides; settlement tiebreak `avg_per_active DESC → active_members DESC` (**anti-cabal**) → `total_muck DESC` → earliest join; **true dead-heat = SHARED victory** (both get cosmetic + pit split); **both-below-quorum = pro-rata REFUND** to donors.
- **Pari-mutuel pit** = a non-inflationary snout SINK+transfer: donations pool into `pit_hill`/`pit_valley`, redistributed pro-rata to winners; `SNOUT_PER_MUCK=5` (deliberately worse than Trough — "boosts, never buys"); `DONATION_MUCK_CAP=200` is the **named load-bearing anti-whale lever** (a 600-muck donation flips an even matchup).
- **3-layer prize, effort > placement:** dated cosmetic (gated muck>0) + pit split + a personal effort ladder **5/15/30** paying **both sides**.
- Framed as the seed of a public **Schism Front (Generous/Greedy army)** meta by re-skinning the two factions onto the existing alignment axis — a way to make private alignment a *public team identity*.

`profiles.faction` was never migrated; the 20260624 slot it reserves is stale. Concept = shelved; the settlement math, passive-contribution trick, pari-mutuel sink, and public-alignment framing are unmined and high-value.

---

## 4. Design principles / rubric — the anti-snowball, anti-abuse spine (any new mechanic must pass)

Two research memos (both 2026-06-14) are the scorecard. The checklist at `coop-mechanics-research-2026-06.md` lines 116–155 is the literal scorecard.

**The nine load-bearing principles** (union of both memos):
1. **Async + local-time + fixed-clock resolution** — never a synchronous global-now siege. The clock advances the war, not the slowest human; a missing member contributes 0 (graceful degradation), no griefable hard auto-skip.
2. **Parallelize, never serialize** — a 5-person crew has zero slack; sum-of-parts artifact, never a baton (the single-blocker killed Diplomacy / Draw Something).
3. **Low binary participation floor + flat/capped ceiling** — the *one* lever that kills free-rider, whale-snowball, DKP-gap, and alt/collusion at once (cap-and-flatten starves the attack before any detection).
4. **Everyone scores win or lose — RACE not duel.** ("One person's prep is a gift to the table"; finishing 2nd of 5 feels fine, losing a duel feels bad.)
5. **Togetherness strictly-better via MULTIPLICATIVE not additive payoff — but never required.** (Note the deliberate tension with the shipped design: §6.)
6. **Render co-presence, don't infer it** (visible filling bar / gathered object).
7. **Leave a persistent, name-attributed artifact behind.**
8. **Gift-framing, not guilt** — Snapchat-streak obligation (~70% feel obligated; loss felt ~2× a gain) is the anti-pattern; Duolingo/Kitfox forgiveness is the antidote.
9. **Item volume from multiplier mechanics** (rarity + recolor + sets + gacha + vaulting), not more unique art; animation reserved for the apex tier.

**The reusable engineering primitives** (verb-independent, liftable wholesale onto the rhythm war):
- **Distinct-human count via composite PK** (Truffle) — strongest anti-alt primitive; `COUNT(*)` = distinct participants for free.
- **Real-vs-scored split in resolve_war** (Cover) — track `SUM(slings)` for quorum/active-count separately from a scored total that includes bonuses, so quorum stays honest while any bonus lifts per-capita.
- **Opener / first-mover back-credit on the quorum transition** (Heave + coop research principle 4) — when a crew crosses <2→≥2 in-window slingers, mint the bonus **retroactively to all distinct in-window members** so the *first* to show up is rewarded, not taxed. A concrete anti-first-mover-penalty pattern for any K-of-N bonus (the person who defends first shouldn't earn less than the latecomer who triggers the combo).
- **Meter-vs-baton split** (Slop) — decouple the completion condition (parallel set-check, never blocks) from the social nudge (a baton that steers "your turn" pushes but is load-bearing for nothing).
- **Multiplicative-FEELING, score-neutral cosmetic meter** (Wallow) — advance a *cosmetic* meter, not the rope; the cleanest resolution of "make coordination feel rewarding without reopening snowball."
- **Server-assigned rotating pairing** (Wallow) — rotation is the anti-collusion/anti-exclusion valve (player-chosen pairing is the alt-farm vector).
- **Legible-absence predicate** (Cover) — `0-action + ≥12h-stale` as a "genuinely away" test (don't punish someone who hasn't opened the app yet).
- **Breadth-scaled not volume-scaled bonus** (Rally) — `LEAST(MAX, BASE + others)` makes "more crewmates = more reward" without re-privileging the heavy slinger.
- **Push-with-a-name** (Rally / Wallow) — an attributed nudge re-engages ~2× harder than an anonymous bar.

**External empirical benchmarks** (`coop-telephone-items-research-2026-06.md`) that calibrate the principles and size the bets:
- Monopoly GO Tycoon Racers **+48.8% revenue / +71% ARPDAU** (top-5 monetization event in *all* mobile gaming) — the team-vs-team lever.
- Duolingo Friend Streaks **+22% daily-lesson completion / ~2× retention**; Snapchat streaks **~70% feel obligated** (defines the guilt boundary).
- Gym-buddy pairing **+35% attendance**; accountability **65%** (state a goal) → **95%** (scheduled partner check-ins).
- Push open rates **~20%** (10× email); best windows 8–9am / 6–8pm / 9pm–midnight; **emojis +20% / rich +25% / per-user send-time +40%**.
- Words With Friends async **+30% retention**; a guild-event autopsy where one author was **44% of guild score**; Draw Something **14.3M→10.4M** collapse (content-exhaustion death).

**Anti-patterns (the rubric's negative space):** per-capita average *without* quorum+floor (punishes below-mean participation); flat per-guild rewards (one carry funds the lurkers); steep DKP curves; detect-and-ban (converge-and-segregate instead); loss-framed obligation timers; volume via more unique art; one-slacker-tanks-the-team.

---

## 5. Open founder decisions

(Detail in `open_decisions`.) The four **rollout preconditions are all OPEN** and gate the flip: **(1) Sounder→Drove rename [BLOCKING]**, (2) war-token economy wall (`resolve_war` still mints raw snouts + writes leaderboard today), (3) population flip-trigger metric, (4) launch coupling to Season-2 reset + Judgement-Day finale (cron `0 12 15 7 *` = noon UTC 2026-07-15, currently un-linked). Plus: payout snouts-now-vs-war-token (highest leverage, gates precondition 2), crew identity permanent-vs-per-war (gates the whole sets/evolve economy), cadence 3-vs-5-vs-7 (the "5→3 swap" **never happened** — shipped is 5/7), which co-op mechanic (if any) to graft, the discovery axis (friend-gated→open-challenge board, D7), and confirming "rhythm war IS v1" in writing.

---

## 6. Contradictions / staleness across docs

(Detail in `contradictions`.) Headline: the two June plans (`mud-wars-master-plan.md`, `team-clan-mud-wars-plan.md`) describe the four telephone co-ops as the shipped cooperation answer — **never built**; the rhythm war shipped instead. Every co-op/spoils doc assumes `20260647` is *unpushed* and proposes a colliding `20260650` file, and every doc uses the retired `MUD_FIGHTS_VISIBLE` flag + pre-rename "Sounder" vocabulary — **all stale**. The base spec's "reclaim Sounder" naming call is contradicted by the still-OPEN Sounder→Drove rename. The "5→3 cadence swap" is asserted-locked in the plans but **never happened** (`WAR_LENGTH_DAYS=5`, `_FRONTS=7`). The shipped rhythm **mirror** fold silently replaced the Fronts **head-to-head** fold. Season tag mismatch: memo `mud_derby_s4` vs shipped `s2_mud_derby`. **Live strategic fork (not settled doctrine):** the shipped rhythm war IS a duel (crew vs crew), which sits in tension with the "RACE not duel" principle the rubric presents as spine — and the single highest-revenue lever in the corpus (Monopoly-GO team-vs-team, +71% ARPDAU) pulls *against* both "race not duel" and "cozy."

---

## 7. Whitespace for ideation

(Detail in `whitespace`.) The richest gaps: the barn-visit access token as a real Connect economy; a snout **SINK** (the pari-mutuel pit is the only designed one, and nothing in the shipped war removes currency); the solo/thin-crew problem the rhythm design self-flags (a solo dev *can't win* a bot rhythm war); the cosmetic **coffer** loss-aversion hook (designed, deferred, still client-side only); the redeploy picker as a whole bluff/counter-read layer left inert; a collusion-detection signal the shipped war could add *today*; and pulling non-warring friends into the war's social reach.


---

## Appendix A — Idea Bank (17, full)

**A1. Mud Fort — a kept crew cosmetic that is a PURE DERIVED VIEW of the existing per-capita/rope metric: a staged structure (FORT_TIERS=[0,3,12,24,40,54], lot→fence→wall→ramparts→gate→flag) with front-loaded early tiers, a mid-war rally-banner treat, and a cosmetic-at-any-win / bonus-at-completion split.**  *(effort S · docs/wiki/outputs/memos/mudwar-coop-mud-fort.md)*  
- *Why:* The single cheapest way to bolt a 'kept crew artifact' onto the live war — zero new table, zero new verb, zero new RPC, no new player action to teach. Front-loaded tiers give fast-early-win dopamine; per-capita tiering keeps it anti-snowball (a bigger roster reaches the same stage at the same per-head pace).  
- *Fit with shipped:* Re-key fort_stage_for(total,active) off the rope/per-capita margin already returned by war_side; the FrontBoard/RhythmDefense screens render the staged art locally, only a Fort-complete announcement fires at resolve. MUTUALLY EXCLUSIVE with Mud Heap for the same cosmetic slot — Fort dominates on effort.

**A2. Mud Heap — async telephone sculpture where each member stacks a piece (Base + Reactor pieces whose joke depends on the piece below), and the finished crew-named Heap becomes a combinatorially-unique cosmetic AND a shareable image from one small art batch.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-mud-heap.md)*  
- *Why:* One asset doing three jobs: co-op hook + kept cosmetic + share-bait. 'Volume from a multiplier, not more unique art' made concrete — expands War Spoils beyond the flat 25-item drop with near-zero new art. The Reactor-piece split is the cleanest way to make async 'append' feel like real telephone interdependence.  
- *Fit with shipped:* A per-(war,crew) ordered artifact granted at resolve; cold-start ordinal-0 seed so it's never empty; opponent teaser = count only. On the rhythm war it's an end-of-war crew artifact, orthogonal to the fold. MUTUALLY EXCLUSIVE with Mud Fort — Heap is the item-generator/virality pick, higher effort/higher upside.

**A3. Truffle Hunt — a buried war-truffle needing N DISTINCT diggers (TRUFFLE_DIGGERS_NEEDED=3, clamped to crew size); the first war-action by each member is their dig; a composite (truffle_id, digger_id) PK makes COUNT(*) the distinct-participant count for free. Kept artifact = a permanent title surviving the war's cascade-reset.**  *(effort S · docs/wiki/outputs/memos/mudwar-coop-truffle-hunt.md)*  
- *Why:* The strongest anti-alt/anti-whale primitive in the whole corpus — a whale acting 1000× counts as 1, so the prize is literally unreachable alone without any score multiplier. Lowest-effort of the four telephone verbs (re-points the existing truffles/truffle_digs stack; the dig is a zero-new-tap side effect of the base verb).  
- *Fit with shipped:* Re-point at a war instead of a barn host; the 'dig' becomes a savepoint-guarded side-effect of the first throw/rhythm-run of the war; surface via a correlated sub-SELECT in war_side so war_state is carried verbatim. Directly graftable as a 'N distinct crewmates each did X this war' capped bonus + kept title.

**A4. Slop Bucket's meter-vs-baton split — decouple the co-op COMPLETION condition (a parallel set-check that never blocks) from the SOCIAL NUDGE (a baton/holder that steers 'your turn' pushes but is load-bearing for nothing), plus a REPEATING off-leaderboard lap bonus (SLOP_LAP_BONUS=5, capped 50/war).**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-slop-bucket.md)*  
- *Why:* The single most graftable primitive for adding a heartbeat push loop to the live war WITHOUT introducing a single-blocker (the async lesson from Diplomacy/Draw Something). The repeating, counter-only bonus keeps a co-op loop alive the whole war and can't contaminate the leaderboard or be farmed for rank.  
- *Fit with shipped:* 'A scoop IS a sling' → 'a co-op action IS a throw'; the baton steers named 'your turn' pushes across Hold days without ever gating a run. Time-gated (not actor-gated) skip valve = async fairness with no griefable auto-skip.

**A5. The Heave — a rolling 90s co-presence window where 2+ crewmates acting inside the window yank the rope harder and everyone in the window banks bonus mud (HEAVE_COMBO_CAP=2.0, HEAVE_DAILY_CAP=15, HEAVE_MIN_CREW=2), multiplicative-on-the-bonus / additive-on-the-base.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-heave.md)*  
- *Why:* The ONLY sketch built on live co-presence (crewmates active in the same short window) rather than async accumulation — the whole synchronous-feeling-burst class of idea, and self-billed the cheapest of the cluster. It is the direct ancestor of the shipped super-additive concentration fold, so it's the closest existing design to 'add a live crew-burst moment to a Hold day.'  
- *Fit with shipped:* A Hold-day burst: when 2+ defenders submit runs inside a rolling window, add a bounded rope-yank + banner. Requires the last_sling_at liveness fix (created_at on an upsert-counter is frozen at first write) — a real hazard the shipped rhythm war's own co-presence surfaces would hit too.

**A6. Opener / first-mover back-credit on the quorum transition — when a crew crosses <2→≥2 in-window participants, mint the bonus RETROACTIVELY to all distinct in-window members, so the first person to show up is rewarded, not taxed.**  *(effort S · docs/wiki/outputs/memos/mudwar-coop-heave.md)*  
- *Why:* A concrete, reusable anti-first-mover-penalty pattern for ANY K-of-N co-op bonus — the person who tends the mire or defends first shouldn't earn less than the latecomer who triggers the combo. Solves a problem co-presence loops otherwise keep re-discovering; it's a specific design lever, not a mood.  
- *Fit with shipped:* Applies to any Hold-day K-of-N crew bonus (Heave-style burst, Rally, a co-defend combo). Mint the increment to all distinct in-window user_ids the tick quorum is first met.

**A7. Wallow Buddies' 'multiplicative-FEELING but score-neutral' cosmetic meter + record-the-event-even-when-reward-clamps: a per-war chain count rendered as a filling bar that gates a kept cosmetic while NEVER touching the rope; write the combo row even when mud credit clamps to zero, so the social beat + cosmetic gate still fire for maxed pairs.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-wallow-buddies.md)*  
- *Why:* Arguably the single cleanest resolution of the core Mud Wars tension — make coordination FEEL rewarding without reopening snowball, because it advances a COSMETIC meter, not the score. Decouples the social artifact from the economic payout entirely (zero ceiling-cost co-op pull).  
- *Fit with shipped:* A per-war 'wallow chain' meter fed by any co-op event (co-defends, buddy pairs) rendered as a bar gating a war-exclusive cosmetic; the rope stays byte-identical. Directly answers 'how do we make the rhythm war feel more coordinated' without touching the validated fold.

**A8. Server-assigned daily-rotating pairing (Wallow Buddies) as the anti-collusion/anti-exclusion valve — a deterministic circle round-robin keyed on war_day, byte-identical on server and client, with an odd-roster house-wallow fallback so no one is stranded.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-wallow-buddies.md)*  
- *Why:* Player-CHOSEN pairing is the alt-farm + exclusion vector; rotation over n-1 days gives everyone a named partner without letting anyone pin or farm. Captures the Duolingo Friend-Streak lift (+22% completion / ~2x retention) as gain-only rotation, avoiding the streak dark pattern.  
- *Fit with shipped:* Assign a rotating co-defend buddy per Hold day; the pairing is a pure function of (sorted text ids, integer day index) pinned by a shared fixture. Pairs naturally with the score-neutral chain meter above.

**A9. Cover for a Crewmate — once you've acted yourself, spend a dedicated daily cover pool to lift a genuinely-absent (0-action, ≥12h-stale) crewmate's slot to a discounted, capped floor (COVER_RATE=0.5); the reward goes to the HELPER, gated on covering ≥K distinct absent slots.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-cover.md)*  
- *Why:* 'One no-show never sinks the crew, and showing up for a friend is rewarded' — a strong, distinct answer to the rhythm war's self-flagged solo/thin-crew problem (a defender missing on a Hold day). The 12h-stale legible-absence predicate and helper-rewarded framing are directly graftable.  
- *Fit with shipped:* On a Hold day where an area's defender is 0-runs/≥12h-stale, let a present crewmate cover a discounted floor for that area; use the real-vs-scored split so cover lifts per-capita without minting a fake active head for quorum. Reward the real person (Mudguard cosmetic) on covering ≥K distinct absent slots.

**A10. Rally Call — a player-fired timed 15-min rally with a push-with-a-name fan-out ('Jen called a mud rally — pile on!'), breadth-scaled bonus LEAST(3, 2+others), where the caller banks the smallest per-answer bonus by design.**  *(effort M · docs/wiki/outputs/memos/mudwar-coop-rally-call.md)*  
- *Why:* Push-with-a-name is the strongest retention lever in the corpus — an attributed, opt-in-to-fire nudge re-engages ~2x harder than an anonymous bar and is structurally un-muteable (Duolingo friend-nudge). Breadth-scaled-not-volume-scaled keeps it snowball-safe. Anti-self-rally guard (pays the caller only once ≥1 OTHER member answers) kills the solo-alt loop.  
- *Fit with shipped:* Fire a rally on a Hold day; hook the existing throw/run write to detect in-window answers. NOTE the recurring NET-NEW gap: app/_layout.tsx has no mud-war push deep-link branch today — any new war push kind needs its own router branch (parallels the confirmed-missing redeploy UI).

**A11. 5-tier rarity ladder (Muddy→Caked→Prize→Champion→Heirloom on the existing hats.rarity CHECK) with animation reserved for the top two tiers, driven by a recolor multiplier (6 base anchors × 8 mud-tones = ~34 free SKUs; base × theme = 40/prompt).**  *(effort M · docs/wiki/outputs/memos/mudwar-war-spoils-items.md)*  
- *Why:* Turns the flat 25-item drop into a real progression economy with anti-devaluation built in ('put motion at the top — players can't fake it') and volume from cheap recolors, not ChatGPT quota. Reuses the shipped catalog/inventory/equip/render infra — only metadata columns are new.  
- *Fit with shipped:* grant_war_spoils_on_resolve already grants one hats row; add war_exclusive/war_season/set_id/anim_* metadata columns and weight the drop by tier. Phase 1 is all-static (zero client render change); animation backfills behind it.

**A12. Themed sets (cosmetic_sets + set_id) with completion capstones you can't buy piecemeal — the async-interdependence lever: no set completes in one war, pacing completion across several wars with the crew you keep winning with. Two are art-defined: Swamp King, Mud Derby Festival.**  *(effort M · docs/wiki/outputs/memos/mudwar-war-spoils-items.md)*  
- *Why:* A substitute for synchronous co-op that applies to the SHIPPED rhythm war — temporal + roster-based interdependence (the crew you keep) drives retention and the 'we got there together' capstone artifact. Players who hit ~50-60% of a set become determined to finish (research).  
- *Fit with shipped:* One guaranteed drop + one bucket pull per contributor per war, so no set finishes alone; grant_set_capstones fires the moment the last member lands. Read-only legibility surfaces (crew set-progress strip via COUNT DISTINCT) surface async contribution with no new write path.

**A13. The catch-up / stall-valve family: no-quorum consolation (both crews, anyone ≥1 action gets a Muddy recolor), 'earn on a loss' consolation (one Muddy drop for losing contributors, capped 1/war), soft-pity rarity floor (≥uncommon after 2 losses/draws, ≥rare after 3, from a COUNT with no new column), and dig-stamp dupe-insurance.**  *(effort M · docs/wiki/outputs/memos/mudwar-war-spoils-items.md)*  
- *Why:* The exact levers for the corpus's own whitespace — thin population, losers feeling nothing, shut-out chains. For a ~27-player beta where most wars are against the bot (which grants nothing), these are among the most immediately relevant unbuilt pieces; they make 'everyone scores win or lose' actually true.  
- *Fit with shipped:* All cosmetic-only and capped (can't become faucets), computed from COUNTs over existing tables inside resolve_war's contributor loop. Directly extends the shipped grant_war_spoils_on_resolve trigger to the loser/no-quorum branches.

**A14. Pari-mutuel pit as a non-inflationary snout SINK+transfer (from the Mud-Off): donations pool per side, redistributed pro-rata to winners, capped so it boosts-not-buys (SNOUT_PER_MUCK=5, DONATION_MUCK_CAP=200), with both-below-quorum pro-rata refund and shared-victory on dead-heat.**  *(effort L · docs/explorations/design-compendium/the-mud-off.md)*  
- *Why:* The corpus's only designed snout SINK — money only ever moves as transfers (never minted), directly relevant to the OPEN economy-wall precondition (resolve_war mints raw snouts today). The fairness engineering (anti-cabal tiebreak, donor refunds, boost-not-buy calibration) is exactly what makes a public wagering layer safe.  
- *Fit with shipped:* A war-token or side-pot wagering layer on top of the crew war: non-warring friends stake snouts on a crew; winners split the pot pro-rata to contribution. Reuses the shipped per-capita+quorum settlement shape. Note DONATION_MUCK_CAP is the load-bearing anti-whale lever.

**A15. Passive contribution off the monotonic tickles_earned counter with a lazy per-cycle base snapshot (the Mud-Off's Trough live-delta trick) — zero new tap-path writes turn any collect-loop into war fuel.**  *(effort L · docs/explorations/design-compendium/the-mud-off.md)*  
- *Why:* A very cheap way to let non-warring or between-war activity feed a war/faction layer without new instrumentation — the seed of a public Generous/Greedy Schism-Front army meta that makes the existing private alignment axis a public team identity (a whole Connect/identity surface).  
- *Fit with shipped:* A between-seasons or ambient faction layer that snapshots base_earned at first interaction; all subsequent core-loop earning becomes side-muck with no per-tap write. Sits alongside (not inside) the crew war's isolated field.

**A16. Collusion-detection signal: flag any crew pair hitting the rematch_cooldown reason ≥3× in a rolling 7 days (two crews farming each other).**  *(effort S · docs/wiki/outputs/memos/team-clan-mud-wars-plan.md)*  
- *Why:* A concrete anti-abuse DETECTION mechanic distinct from the cap-and-flatten principle, and cheap instrumentation the SHIPPED war could add today — the 24h cooldown already stamps the reason. Matters for the OPEN population-flip decision: you want to detect win-trading before widening the flag.  
- *Fit with shipped:* A one-query dashboard read over the cooldown-reason stamps already written by the BEFORE-INSERT trigger; no schema change. Add before flipping mud_wars past Brian-only.

**A17. The cosmetic snout_coffer firewall — a per-area coffer fed by difficulty-scaled hits and drained by leaks (clamped 0), giving the 'goblins steal your snouts' loss-aversion juice while NEVER being read by the fold.**  *(effort S · docs/mudwar-rhythm-design.md)*  
- *Why:* A Collect-pillar juice hook with zero balance risk — loss-aversion motivation ('they stole your snouts') decoupled from any real stakes. Designed in the shipped rhythm doc but DEFERRED (left client-side, never built server-side), so it's a ready-to-mine polish that fits the exact mechanic that shipped.  
- *Fit with shipped:* Add the snout_coffer table + read path the rhythm design already specced; render the drain/steal beat in RhythmDefense.tsx. Pure vanity by default (alt: tiny house-funded bonus). Off-rope and freely tunable (coffer value/leak e +2/-4, m +3/-6, h +4/-8).


---

## Appendix B — Open Decisions (10, full)

**B1. Sounder→Drove naming rename [BLOCKING rollout precondition #1]**  
- *Options:* Display-name-only migration renaming referral-downline titles' player-facing copy to 'the Drove', leaving titles.id/source untouched + a CONTEXT.md codification; the whole design corpus still uses 'Sounder'.  
- *Gates:* Must land FIRST before any flip. Blocks the entire minimal critical path. CONTEXT.md line 11 still carries unqualified 'Sounder'.

**B2. Payout: raw snouts now vs a war-only token from day one [economy-wall precondition #2]**  
- *Options:* Recommendation across docs = war-token from the flip (profiles.war_tokens or war_token_ledger that resolve_war mints instead of raw snouts; keep any core snout payout capped/contribution-gated; gate house-bot wins to cosmetic/title only). Today resolve_war mints raw snouts into counter + tickles_earned/leaderboard.  
- *Gates:* Highest-leverage decision — precondition 2 blocks and forks on it. Gates the 'what to build next' step. The faucet is REAL and live today, not hypothetical.

**B3. Crew identity: permanent clan vs per-war [precondition, gates the item economy]**  
- *Options:* Recommendation = permanent. Per-war would break set-completion pacing + Heirloom evolution (both need a crew you keep winning with).  
- *Gates:* Gates the whole Phase-2 set/evolve/War-Pass economy; must be confirmed before marketing 'your clan' or building sets.

**B4. Population flip-trigger metric [precondition #3]**  
- *Options:* Committed metric = ≥2 non-bot crews, each ≥2 active members (quorum), ≥8 distinct active players combined, holding ~3 consecutive days (alt: softer ≥40 DAU). Instrument via a one-query dashboard read.  
- *Gates:* A committed metric, not a date. Blocks the flip. Pairs with adding the collusion-detection signal before widening the flag.

**B5. Launch coupling to Season-2 reset + Judgement-Day finale [precondition #4]**  
- *Options:* Couple the flip to the public-launch package (leaderboard reset + beta-skin grant + beta-purchase reset) and re-anchor the Judgement-Day finale (cron 0 12 15 7 * = noon UTC 2026-07-15, currently zero mud_wars linkage) to launch week; pick finale shape A/B/C first.  
- *Gates:* War is the Season-2 headline, sequenced AFTER the launch package and AFTER the population gate. Finale shape must be picked first.

**B6. Cadence: 3 vs 5 vs 7 days (the '5→3 swap' never happened)**  
- *Options:* Shipped constants are WAR_LENGTH_DAYS=5 / _FRONTS=7 with RPCs inlining 7-day intervals; the June plans asserted a 3-day intent that was never built. Genuinely open.  
- *Gates:* Rides in with whichever change touches cadence; confirm before marketing a war length. Note the rhythm war's 2-day Tend + 5-day Hold assumes the 7-day clock.

**B7. Which co-op mechanic (if any) to graft onto the rhythm war**  
- *Options:* Ship at most one. Fort (cheapest, derived view) vs Heap (item-generator/virality) are mutually exclusive for the kept-cosmetic slot; Truffle (cheapest distinct-human) and Slop's meter-vs-baton (heartbeat) are additive; Heave (live co-presence burst) is the closest to the shipped fold; Cover/Wallow answer the thin-crew problem.  
- *Gates:* Confirm 'rhythm war IS v1' in writing before anyone touches Mud Heap/Fort. None is pending work — this is a fresh build decision, not a resumption.

**B8. Discovery / social reach: friend-gated matchmaking vs open-challenge board (D7)**  
- *Options:* find_challengeable_crews structurally requires a shared friend-edge with the OPPONENT crew, nudging 'fight your friend'. Resolution = keep friend-gated at beta scale, relax to an open-challenge board post-launch so players rally friends INTO a crew to fight STRANGERS.  
- *Gates:* Bears on the population-flip and on pulling non-warring friends in; relax only once the population outgrows the friend-graph discovery limit.

**B9. Build the missing leader-redeploy picker UI now, or defer**  
- *Options:* The redeployMember RPC (20260667) + redeploy() hook (hooks/useMudWar.ts:276) exist and FrontBoard shows '1 available (leader)', but no UI calls them — the token is unspendable. Build the picker to activate the bluff/counter-read layer, or leave self-commit-only.  
- *Gates:* The one real code gap inside the shipped surface. Cheap to close; unlocks the designed leader bluff/flex axis. Low risk vs the rollout preconditions.

**B10. Monetization-vs-tone fork: add real-time team-vs-team on top of the co-op war**  
- *Options:* Monopoly-GO team-vs-team is the +71% ARPDAU lever but pulls against 'race not duel' and 'cozy'; the shipped war is already a duel. Lean into the duel + a wagering pit (Mud-Off), or stay race-flavored and cozy.  
- *Gates:* A genuine strategic fork, not settled doctrine. The single highest-revenue lever in the corpus contradicts the rubric's spine — decide deliberately, don't let the rubric decide by default.


---

## Appendix C — Whitespace / ideation seeds (8, full)

**C1. A real snout SINK inside or around the war — nothing in the shipped war removes currency; resolve_war only MINTS.**  
- The economy-wall precondition exists precisely because resolve_war mints raw snouts + writes the leaderboard with no counterbalancing drain. The Mud-Off's pari-mutuel pit (non-inflationary transfer, capped boost-not-buy, donor refund below quorum) is the only designed sink in the corpus and is unmined; a wagering/side-pot layer would also pull non-warring friends into the war's social reach.

**C2. The barn-visit access token as a first-class Connect economy, not just a per-day roster-relief cap.**  
- The shipped token (crewmate barn-visit → +1 Hold-day attempt, ATTEMPT_TOKEN_CAP=1) is the one live Connect→war bridge and is deliberately minimal. It could carry richer 'a friend helped you defend' framing, or scale to a Slop-Bucket-style meter, without leaking wealth (it scores the submitted run, war-scoped, alt-proof). No doc explores expanding it.

**C3. The solo / thin-crew experience — the rhythm design self-flags that a solo dev CANNOT win a bot rhythm war (the 12-cap means one player can't clear marquee pressure).**  
- For a ~27-player beta most wars are against the bot; a crew that can't field 3 real defenders is structurally stuck. Cover-for-a-Crewmate (helper-rewarded, 12h-stale absence predicate) and the loss/no-quorum consolation valves are the designed answers — none built. This is the most immediately relevant gap for the current population.

**C4. Activate the redeploy token into a full bluff/counter-read layer.**  
- The RPC + hook exist and FrontBoard advertises the token, but no picker UI spends it, so the entire designed 'see your own build, then re-stamp one member' flex/counter-read axis is inert. Cheap to close and it deepens the double-blind Blotto that is the war's strategic core — a rare high-value, low-effort, already-scaffolded surface.

**C5. Loss-aversion juice with zero stakes — the cosmetic snout_coffer 'goblins steal your snouts' hook was designed in the shipped rhythm doc but deferred and left client-side.**  
- A Collect-pillar motivation lever ('they stole your snouts') fully firewalled from the scored economy — designed against the exact mechanic that shipped, freely tunable (off-rope), never built server-side. It's the cheapest way to add emotional stakes to a Hold day without touching fairness.

**C6. A between-wars / rest-week experience and a durable cross-war identity.**  
- The corpus notes a rest week is 'the absence of a resolve_war call' (a free forgiveness beat) but nothing fills the gap between wars. Themed sets (pacing completion across wars with the crew you keep) and a permanent clan identity are the designed retention answers, both blocked on the permanent-vs-per-war decision — and the Mud-Off's 2-week faction identity you 'wear' is an unmined alternative ambient layer.

**C7. Cheap collusion INSTRUMENTATION before the population flip.**  
- The 24h cooldown already stamps a rematch reason; a one-query signal (a crew pair hitting it ≥3× in 7 days) would detect win-trading before the flag widens past Brian-only. It's a distinct anti-abuse layer (detect) from the cap-and-flatten spine (prevent) and directly serves the OPEN population-flip decision — nothing in the shipped surface reads these stamps yet.

**C8. Pull non-warring friends INTO the war's social surface (spectators, wagerers, reinforcements).**  
- Matchmaking is friend-gated (find_challengeable_crews needs a shared friend-edge), so the war's reach is capped by the friend graph; the open-challenge-board evolution (D7) addresses fighting strangers but not spectating/backing friends. A pari-mutuel pit (back a crew you're not in) or a barn-visit-style reinforcement from outside the crew would grow the war's Connect footprint past the 5-member roster.


---

## Appendix D — Contradictions / staleness (10, full)

**D1. Shipped mechanic vs the plans' stated cooperation answer** — mud-wars-master-plan.md and team-clan-mud-wars-plan.md present the four telephone co-ops (Mud Heap/Fort/Slop Bucket/Truffle Hunt) as the RESOLVED cooperation answer and the thing to ship; the base system page defers cooperation to 'P3'. In reality the team pivoted to a rhythm war (throw minigame + Colonel-Blotto lane deploys + Songs-of-the-Bog rhythm rounds + barn-visit fuel).  
- *Resolution:* mudwar-whats-next-2026-07.md is ground truth: the four co-ops have ZERO implementing code; the rhythm war (migrations 20260665-20260672) is the de-facto shipped v1. Treat the co-ops as an idea bank, never as pending work.

**D2. Migration push state ('20260647 is unpushed')** — Every June co-op/spoils doc and both big plans assert 20260647 is unpushed and propose a follow-on 20260650000000_* file; the base spec and system page say 'not yet DB-pushed'.  
- *Resolution:* FALSE per ground truth: the entire base + rhythm stack (20260647 through 20260691) is applied on the remote, and 20260692 seeds the mud_wars flag. A new 20260650 file would now sort BEFORE applied migrations and collide on the schema_migrations PK. The 'follow-on vs fold-in' migration advice is moot; mechanics/numbers/reasoning are intact.

**D3. The gate flag name (MUD_FIGHTS_VISIBLE vs mud_wars)** — All older docs use a boolean MUD_FIGHTS_VISIBLE feature flag as the gate.  
- *Resolution:* Superseded by the client mud_wars feature flag (a staged-rollout override system: global=FALSE, Brian override=TRUE), confirmed in constants/featureFlags.ts. The gate is now a per-cohort override, not a repo boolean.

**D4. Naming: 'reclaim Sounder' vs Sounder→Drove rename** — sounder-mud-fight-spec.md Q1 locks 'reclaim Sounder as the player-facing crew word'; the whole corpus uses 'Sounder' throughout.  
- *Resolution:* Contradicted by ground truth: a Sounder→Drove rename is the still-OPEN, BLOCKING rollout precondition #1. The 'reclaim Sounder' decision is NOT settled; every doc's vocabulary is pre-rename.

**D5. Cadence: the '5→3 swap'** — Both June plans describe the 5→3-day cadence swap as intended/locked and specify the three literal sites to change.  
- *Resolution:* Never happened. Shipped constants are WAR_LENGTH_DAYS=5 / WAR_LENGTH_DAYS_FRONTS=7 (verified in constants/mudFights.ts) with RPCs inlining 7-day intervals. Cadence is genuinely open (3 vs 5 vs 7), not decided; the rhythm week assumes 7.

**D6. The scored fold: head-to-head Fronts vs rhythm mirror** — mudwar-clan-design.md's verdict table describes a head-to-head Blotto fold (both crews on shared fronts, more-effMud-wins) as the shipped mechanic; the synthesis glossed the rhythm fork as compatible.  
- *Resolution:* The rhythm fork (mudwar-rhythm-design.md) REPLACES the head-to-head fold with a MIRROR fold (fold_rhythm_margin: each crew defends its OWN mud vs the opponent's deployed hold-pressure) wherever mud_rhythm_on()=true — which is the live path. The doc flags the mismatch explicitly; the head-to-head fold is an off-path gated mode.

**D7. War Spoils depth: full economy vs flat one-item drop** — mudwar-war-spoils-items.md specs a full economy (5-tier ladder, cosmetic_sets + capstones, Mud Bucket gacha, evolving Heirlooms, named-season scarcity, catch-up pity, sprite-sheet animation); openai-mud-war-items.md's recolor-multiplier implies ~34 extra SKUs.  
- *Resolution:* Only a flat one-item cost=0 win-drop shipped (grant_war_spoils_on_resolve, exactly the 25-item batch from openai-mud-war-items.md). The sets/gacha/War-Pass/evolve/animation economy and the recolor multiplier are designed-only. Phase-3 sprite-sheet animation is designed-only (AnimatedCosmetic.tsx/cosmeticFx.ts is a SEPARATE members-shop engine, not the war-item path).

**D8. Season tag (mud_derby_s4 vs s2_mud_derby)** — The war-spoils memo's worked example uses war_season='mud_derby_s4'; the shipped seed uses 's2_mud_derby'.  
- *Resolution:* The shipped tag is s2_mud_derby (20260650000000_mud_war_cosmetics.sql). The memo's 's4' is illustrative/stale.

**D9. 'Race not duel' rubric vs the shipped duel + the +71% ARPDAU lever** — The research rubric (coop-*-research memos) presents 'everyone scores win or lose — RACE not duel' as spine; the brief-level framing treats it as settled doctrine. But the shipped rhythm war IS a head-to-head duel (crew vs crew), and the single highest-revenue lever in the corpus (Monopoly-GO real-time team-vs-team, +71% ARPDAU) pulls AGAINST both 'race not duel' and 'cozy'.  
- *Resolution:* This is a genuine UNRESOLVED strategic fork, not settled doctrine — the shipped design already violates the principle. Name it for ideation rather than treating the rubric as decided; the wagering-pit direction (Mud-Off) leans INTO the duel.

**D10. Deferred LOW review items — open vs already-fixed** — The 2026-06-13 mud-fights review deferred several LOW/coverage items (mud_wars not in realtime publication, hardcoded 5-day/72h/quorum-2/cap-5 magics, TOCTOU advisory-lock, untested tie/RLS/title paths) — but the review predates the rhythm stack (20260665-20260672).  
- *Resolution:* Treat the deferred LOW list as CANDIDATE live issues to re-verify against the current migrations, NOT confirmed-open — later migrations may have addressed some. The app/_layout.tsx push-deep-link gap flagged by Rally may still be a real gap (parallels the confirmed-missing redeploy UI).


## Connects to
- [[mud-wars-master-plan]] · [[mudwar-whats-next-2026-07]] · [[sounder-mud-fights]]

---
title: "Mud Wars — Option C scope: The Hunger's Hoard (research + build plan)"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, clan-wars, scoping, race, war-tokens, world-boss]
status: draft
---

# Option C — "The Hunger's Hoard": research + full scope

Scopes Option C from [[mudwar-challenge-options-2026-07]]: both clans **race** to carve tickles back from the Great Hunger's three hoard-hills against server-seeded PvE pressure; losers keep what they carved; payouts in a **Golden Tickles war token** (lands founder decision B2); optional opponent (ghost pace-hog); Hunger's Moods + Rally Snacks; Cover-for-a-Crewmate graft.

## 1. External research — what the precedents say

**Monopoly GO Tycoon Racers** (the +48.8% revenue / +71% ARPDAU event; top-5 monetization event in mobile two years running): 4-player teams, and — the detail that matters — the event is **three 1-day races, not one long bar**, with milestone rewards along the track and the final race paying **double medals**. Teams share one car (summed points) and power-ups earned by one member benefit the whole team. Matchmaking pairs teams of similar skill.
→ *Spec change C-1: structure the Carve as daily legs with a nightly standings beat and per-leg milestone token mints, and weight day 7 double — comeback drama is designed in, not hoped for.*

**Losers-keep vs winner-take-all** (GameRefinery race-event analysis; Clash Royale crown chests): race events that pay separate rewards by points gathered — everyone earns for participation — measurably retain better than podium-only structures; Clash Royale's earn-crowns-even-on-a-loss chest is the canonical earn-on-loss pattern.
→ *Spec change C-2: mint Golden Tickles at carve milestones DURING the week (continuous), not only at resolve. "Losers keep what they carved" becomes literal and visible daily.*

**Helldivers 2 Major Orders** (community-vs-villain): a shared narrative antagonist demonstrably drives participation, but two failure modes recur — (a) no in-game explanation of *why* a target matters, leaving casual players guessing; (b) community-scale thresholds make individual contribution feel like a rounding error, and players hate opaque/rigged-feeling goals.
→ *Spec change C-3: keep all goals crew-scaled per-capita (never server-global), show each hill's value + pressure + "what it takes to hold" plainly, and make the Hunger visibly react (the world answering your effort is the retention lever). The boss art states for this already exist (idle/waddle/gloat/slurp).*

**Clash of Clans League Medals** (war-token economy): a fully separate currency — can't be farmed outside war, spent only in a dedicated shop; **base payout for every roster member + placement bonus**; apex items (Magic Hammers) are **cooldown-limited, not priced out of reach**. Known mistake to avoid: the 2,500-medal cap converts overflow to gems at a punishing rate — a lossy auto-conversion players resent.
→ *Spec change C-4: base tokens for all contributors + winner bonus; cap the balance with a "spend first" nudge and NO auto-conversion; the Heirloom-tier redemption gets a per-season/cooldown limit instead of an absurd price.*

**Ghost/pace-setter tuning**: no strong published formula; rubber-band AI is the standard pattern and the consistent lesson is *transparency* — hidden rubber-banding reads as rigged.
→ *Spec change C-5: the ghost pace-hog is deterministic, per-capita (the shipped bot already is: `df_pc = 12/day`), and its pace is published in the war screen. A 2-person crew races a fair, visible ghost.*

## 2. Code-scoping ground truth (verified against shipped migrations)

- **The race fold is closer than the options memo assumed.** `rhythm_area_holds` (`20260668:146`) already contains the full PvE branch: in bot wars the pressure hitting the challenger comes from scripted `bot_deploy(rank)` — Option C is essentially "both crews get the bot-war treatment, cumulative instead of zero-sum."
- **PvE pressure is crew-independent by construction.** Area pressure = `band_base_p(p_band)` × jitter from `hashtext(war:day:front)` — no crew/caller in the seed. Both crews already face identical pressure on a shared board. **Correction to the consolidated brief:** no `CHART_SEED`-with-`caller_id` exists server-side; the rhythm chart is client-cosmetic and only band enums cross the wire (`submit_run` maps/clamps them; forged perfect == honest perfect). Nothing must change for fairness; nothing breaks anti-cheat.
- **The faucet to close** (`resolve_war`, latest def `20260668:640-646`): winners mint `own + share` raw snouts into `profiles.counter` + `tickles_earned`. This is the exact line the token ledger replaces.
- **Redemption-shop pattern exists**: `buy_hat` (latest def `20260688`) is the template — same guards, but decrement `profiles.war_tokens` against `hats.token_cost` instead of `counter` vs `cost`.
- **Moods plumbing is shared with Option A**: `weekly_modifier` is stored at war start (`pick_weekly_modifier`, display-only). Making stored modifiers *do* something is the same work A's Bog Weather needs — build once.
- **The redeploy-picker gap is moot in race mode** — there are no deploys. (Members still pick hills via `mud_war_plans`; a leader "move member" against *plans* is optional polish, not the shipped-RPC gap.)
- **Boss/creep art needs no new generation** — production cutting only: `great_hunger_action_sheet_v2.png` → in-app sprite frames; `hungerlings_hog_v2_rosie_1.png` → note-creep skins for RhythmDefense.

## 3. Build plan

### DB migrations (never pushed without explicit "go"; validate on the stubbed-Postgres harness)

| # | File | What | Days |
|---|---|---|---|
| M1 | `20260703300001_war_modes.sql` | `mud_wars.mode text NOT NULL DEFAULT 'rhythm' CHECK (mode IN ('classic','fronts','rhythm','race'))`, backfilled from the booleans (kept in sync for old readers); `mud_race_on()` flag fn; carry `challenge_house`/`accept_challenge` (from the **20260668 defs** — carry-latest footgun) to stamp mode. | 0.5–1 |
| M2 | `20260703300002_war_tokens.sql` | **Golden Tickles**: `war_token_ledger(id, user_id, delta, reason, war_id, created_at)` + cached `profiles.war_tokens` (ledger = audit trail); internal `mint_war_tokens()` (REVOKE PUBLIC); `hats.token_cost int`; `redeem_war_cosmetic(p_hat_id)` RPC cloned from `buy_hat`; balance cap ~500, mint clamps at cap (no conversion). | 1.5–2 |
| M3 | `20260703300003_race_fold.sql` | The core: `hunger_press(rank, mood)` (generalizes `bot_deploy`+`deploy_press`); `race_area_holds(war, day, front, crew)` (one-sided `rhythm_area_holds`); race branch in `score_mud_war_days` — per day each crew banks `carve = Σ held-V + per-capita base`, cumulative into new `mud_wars.challenger_carve`/`defender_carve`; `rope_pos` reused as the **gap** (rout ±12 = "drives the Hunger off early"); day-7 double weight (C-1); per-leg milestone mints (C-2); `resolve_war` race branch (from the 20260668 def): winner = higher per-capita carve, **both sides mint tokens ∝ own carve**, winner bonus + spoils trigger unchanged; `set_deploy` returns `mode_mismatch` in race mode. | 2–3 |
| M4 | `20260703300004_hunger_moods.sql` | `pick_weekly_modifier` rolls `('gluttonous','drowsy','greedy')` for race wars; Gluttonous = marquee pressure ×1.2, Drowsy = timing windows ×1.1 (client constant keyed off the stored mood), Greedy = −2 carve/day from zero-run hills (clamped ≥0, framed as the Hunger's mischief — never names a member). **Shared with A's Bog Weather plumbing.** | 1 |
| M5 | `20260703300005_rally_snacks.sql` | Trimmed v1: keep the shipped barn-visit run token; add ONE consumable (`double_carve`, 1/member/war) buyable with tokens via `mud_war_access.kind`. | 0.5–1 |
| M6 | `20260703300006_cover_crewmate.sql` | Cover graft: `cover_slot(war, absent)` — caller acted today; absentee = 0 actions + ≥12h stale; discounted floor at `COVER_RATE=0.5`; real-vs-scored split (covered mud counts in carve, never in quorum/active); Mudguard title at ≥K distinct covers. **Deferrable to post-v1.** | 1–1.5 |
| — | Harness validation + golden-output regression for the two old modes | | 1 |

Ghost pace-hog: free — race-mode `challenge_house` already gives the per-capita 12/day ghost; publish the pace in `war_state` (one jsonb key).

### Client surfaces

| Surface | What | Days |
|---|---|---|
| `app/mud-war.tsx` | Mode branch: **hoard meter** replaces the tug rope — two cumulative carve bars with the Hunger between them, boss sprite mood by standing (gloat when he's winning, slurp on Greedy steals, deflating waddle as carve grows). Reuses the `ropeAnim` spring pattern (`app/mud-war.tsx:446-500`). | 1–1.5 |
| `components/mudwar/HoardBoard.tsx` | Fork of FrontBoard minus deploy/redeploy sheet: hills show value, mood pressure, my crew's carve, "what it takes to hold". | 1.5–2 |
| `RhythmDefense.tsx` reskin | Waves become **hungerlings** (sprite cut from existing art); copy "the Hunger's wave", chart unchanged. | 1 (+0.5 art cutting) |
| Token economy UI | Balance chip + redemption shop band (clone the members-shop band pattern) + `token_cost` on item cards; redeem flow. | 1.5–2 |
| Moods chip | Header chip off stored `weekly_modifier` (display slot already exists in FrontBoard). | 0.25 |
| Cover UI | "Cover for them" on an absent crewmate's row on Hold days. Deferrable with M6. | 0.5–1 |

### What is NOT C-specific (shared preconditions, unchanged from [[clan-buildout-audit-2026-07]])
Drove rename (0.5–1d) · war/crew push deep-links, server emit + `notificationRouting` branch (1–1.5d) · leader controls rename/kick/transfer (1–1.5d). ≈ **3–4 days**, needed for A too.

### Totals & milestones

- **Build-during-A (do now):** M1 + M2 ≈ **2–3 days** — the mode column and the token ledger. Closes the live snout faucet early and makes A→C a flag flip later, not a rebuild.
- **C-specific core:** M3 + M4 + ghost + hoard meter + HoardBoard + reskin ≈ **7–9.5 days**.
- **C economy surface:** token shop UI + moods chip ≈ **2 days**.
- **Optional polish:** M5 + M6 + Cover UI ≈ **2–3.5 days**.
- **Grand total C-specific ≈ 11–15 solo dev-days** (+2–3 build-during-A, +3–4 shared preconditions).

Milestone order: M0 (during A: modes+tokens) → M1-dark (race fold live behind `mud_race_on()=false`, dev-harness wars via `dev_end_war_now`) → M2 (client hoard surface behind `mud_wars` flag + mode) → M3 (token shop) → flip for a bounded cohort mid-season.

## 4. A→C migration path (the "build it in C's shape" argument, made concrete)

1. **Mode column from day one (M1).** A ships as `mode='rhythm'`. C arrives as `mode='race'` — new wars stamp the new mode; in-flight wars finish under their stamped mode. No data migration, no cutover window.
2. **Token ledger during A (M2).** Swap `resolve_war`'s snout mint for token mint while A is live (one carried function edit from the 20260668 def). A's winners start earning Golden Tickles immediately; the redemption shop can trail by a build. Precondition 2 (economy wall) closes weeks before C ships.
3. **Moods = Bog Weather (M4).** A's weather table and C's moods are the same mechanism (stored `weekly_modifier` → fold/constants effects) with different rosters. Build the effect plumbing once during A; C re-rolls the table.
4. The rhythm fold, boards, RLS fog, budgets, spoils trigger, Elo, cooldown all carry unchanged — C touches only the fold branch, resolve payout, and the deploy step (removed).

## 5. Firewall & nine-principles check

- **Isolation firewall:** intact. Tokens mint only from carve; carve is bounded by the shipped daily budgets (21 mud/day/member, 12-cap/hill, V=[5,4,3]) → the token faucet has a hard war-length ceiling; tokens never convert to/from snouts; `token_cost` items are unbuyable with money by construction.
- Async ✓ · parallel-never-serial ✓ (no batons; Cover is opt-in help) · capped floor/ceiling ✓ (unchanged budgets) · **everyone-scores ✓ (the point of the option)** · multiplicative-feeling-score-safe ✓ (boss reactions + hoard meter are rendered, not multiplied) · render co-presence ✓ (hoard meter, co-defended hills) · kept artifact ✓ (tokens + spoils + Mudguard) · gift-not-guilt — **one watch item:** Greedy's steal is loss-framed; keep it small (−2), hill-scoped, and never attribute absence to a named member · volume-from-multipliers ✓ (token shop prices the existing 25-item pool + recolors; no new art).
- **Anti-abuse:** per-capita + quorum unchanged; ghost wars grant tokens at the same bounded rate as the bot's cosmetic-free stipend today — recommend ghost wars mint at 50% rate, no winner bonus (mirrors the shipped bot-grants-nothing doctrine).

## 6. Test/dev plan

Extend the golden-output regression (`scripts/golden_output.sql` pattern): resolve one classic + one fronts + one rhythm war and assert byte-identical results with `mode` backfilled — proves C's migrations are a strict superset. New race-war fixture on the stubbed-Postgres harness (Colima): 5v5, 5v2, vs-ghost, Greedy-mood, rout-by-gap, token mint totals vs the ceiling. Client: dev-preview chip (the `GreatHungerIntroModal` pattern) + `dev_end_war_now`/`dev_skip_to_hold` for phase QA.

## Connects to
- [[mudwar-challenge-options-2026-07]] — the option this scopes
- [[clan-buildout-audit-2026-07]] — shared preconditions
- [[world-boss-the-great-hunger-2026-07]] — the season narrative C folds into
- [[mudwar-consolidated-brief-2026-07]] — substrate (note the CHART_SEED correction in §2)

Sources: [GameRant Tycoon Racers guide](https://gamerant.com/monopoly-go-tycoon-racers-event-guide-flags-token-links-strategy/) · [dotesports Tycoon Racers explainer](https://dotesports.com/monopoly-go/news/tycoon-racers-monopoly-go-explained) · [Gamigion on Tycoon Racers results](https://www.gamigion.com/extraordinary-results-from-monopoly-gos-tycoon-racers-event/) · [AppMagic revenue analysis](https://appmagic.rocks/research/monopoly-go-revenue-spike) · [GameRefinery race events](https://www.gamerefinery.com/how-mobile-game-developers-are-driving-player-engagement-with-race-events/) · [GamesRadar Major Orders](https://www.gamesradar.com/helldivers-2-major-orders/) · [U4GM Major Order participation](https://www.u4gm.com/helldivers-2/blog-helldivers-2-inside-the-new-major-order) · [CoC League Medals (LDShop)](https://www.ldshop.gg/blog/clash-of-clans/how-to-get-league-medals.html) · [CoC CWL wiki](https://clashofclans.fandom.com/wiki/Clan_War_Leagues) · [TV Tropes Racing Ghost](https://tvtropes.org/pmwiki/pmwiki.php/Main/RacingGhost)

---
title: "Mud Wars Option B — The Rival's Gauntlet: research + build scope"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, clan-wars, gauntlet, scoping, research, founder-decision]
status: draft
---

# Option B — "The Rival's Gauntlet": research + scope

Scopes Option B from [[mudwar-challenge-options-2026-07]] (challenger stakes the week's terms: a war-song variant + 1 pinned modifier from a weekly hand of 3; defender sees terms, counter-pins 1, gets +1 redeploy token; variant stamps the spoils pool) against the shipped rhythm-war stack and outside precedent. Client gap context in [[clan-buildout-audit-2026-07]].

**TL;DR:** research says ship B in two stages — **pin/counter-pin modifiers on the Classic war first** (≈6.5 B-specific dev-days, and its modifier-effects work is 100% shared with Option A), **variants later** gated on `crew_ratings.wars_played ≥ 2`. Variant "fragmentation" is NOT a liquidity risk here (mutual-accept friend matchmaking has no blind queue) — it's a teachability/balance risk, which staging solves. Total B-specific ≈ 9.5 dev-days + ~5.5 shared-precondition days.

---

## 1. Research findings

**F1 — The challenge flow is proven; chess.com is the exact template.** Chess.com's friend challenge = challenger picks variant + time control + rated flag; the receiver sees all terms before accepting. It defaults to Standard with the variant picker one tap deep — default-first is what keeps a terms-rich challenge teachable. Casual-mobile analogues (8 Ball Pool table stakes, Golf Clash tours) show "stakes visible before you sit down" is mainstream-casual, and Golf Clash's progressive tour unlocks validate gating richer terms behind progression.
*Sources: [Chess.com variant challenges](https://support.chess.com/en/articles/8583983-how-do-i-play-chess-variants), [challenge time-control flow](https://www.chess.com/forum/view/help-support/how-to-specify-time-control-of-a-challenge), [Golf Clash UX analysis](https://www.gameanalytics.com/blog/golfclash-swing-success).*

**F2 — Mode fragmentation kills blind queues, not negotiated duels.** The multiplayer-design literature is unambiguous that "every playlist fragments the population" and small games must condense to few modes, often on a **rotational schedule** (one worked example needs 86,400 CCU for 3 modes × 10 skill bands to always match). But that math applies to *anonymous queue liquidity*. Mud Wars matchmaking is mutual-accept between friend-connected crews — there is no queue to fragment; both crews explicitly opt into the variant. The surviving risks are **teachability** (3 variants × a modifier draft is a lot for ~27 players) and **balance surface** (each variant needs its own sim confidence). That reframes "variants must wait" from population-math to onboarding-math.
*Sources: [What I've learned designing multiplayer games](https://www.gamedeveloper.com/design/what-i-ve-learned-about-designing-multiplayer-games-so-far), [Designing matchmaking for non-gigantic communities](http://joostdevblog.blogspot.com/2015/09/designing-matchmaking-for-smaller.html), [Requirements of good matchmaking](https://www.gamedeveloper.com/design/the-requirements-of-good-matchmaking).*

**F3 — Weekly rotation is the anti-solved-meta valve, and doubles as a lab.** Hearthstone's Tavern Brawl (new rules every Wednesday, week-long) shows weekly cadence keeps a twist fresh without exhausting content, and Blizzard explicitly uses it to **test mechanics before permanent modes** — our weekly hand-of-3 can play the same role for future permanent weather (feeding Option A's table). Dota 2's Mutation Mode rotated modifiers daily — too fast for a 7-day war; weekly matches our clock.
*Sources: [Tavern Brawl wiki](https://hearthstone.wiki.gg/wiki/Tavern_Brawl), [Dota 2 Mutation Mode](https://www.theflyingcourier.com/2018/5/10/17339344/dota-2-mutation-mode-battle-pass-ti8-custom-game-modifications).*

## 2. Recommended spec changes (vs the Option-B sketch)

1. **Stage the variants.** B-v1 = pin/counter-pin on the **Classic** war only + defender's +1 redeploy. Variants (Mudslide Derby / The Long Night) become B-v1.5, unlocked when a crew has `wars_played ≥ 2` (`crew_ratings.wars_played` already exists — zero new tracking). Progressive disclosure per F1/F2.
2. **No pin staked → fall back to the rolled modifier.** If the challenger skips the pick, the war rolls weather exactly like Option A (`pick_weekly_modifier` path). This makes **B a strict superset of A**: ship A's weather effects, then the draft is pure UI + validation on top. One effects codebase, two options.
3. **Keep the defender's +1 redeploy AND the counter-pin.** Counter-pin is an information advantage, the token is an agency advantage; together they compensate terms-setting without touching score (firewall-clean). Bot wars: the house never pins; challenger's pin applies alone (weather is symmetric anyway).
4. **Spoils stamping ships flat first.** True variant-themed drops need the Phase-2 `set_id` metadata (designed-only). B-v1: Derby wars weight the existing derby-flavored items (`mud_derby_bg`, `rosette_cap`, `prize_sash`, `festival_pennant`, `confetti_aura`) in the random pick — a WHERE-clause weight, no schema.

## 3. Build plan

### DB — three migrations (never `db push` without explicit go; validate on the stubbed plain-Postgres harness first)

**M1 `20260703200001_war_terms.sql` — terms + pins + effects (B-specific core; effects shared with A)**
- `ALTER TABLE mud_wars ADD COLUMN variant text NOT NULL DEFAULT 'classic' CHECK (variant IN ('classic','derby','long_night')), ADD COLUMN modifier_challenger text, ADD COLUMN modifier_defender text;` (discrete columns, NOT a `war_params` jsonb — the table already models per-war state as typed columns (`fronts_enabled`, `rhythm_enabled`, `build_ends_at`, `weekly_modifier`, `20260667:91-94`), CHECKs are free, and the fold functions read the row directly).
- `war_modifier_hand(p_week date) RETURNS text[]` — IMMUTABLE, hand of 3 drawn from the 6-modifier pool via `hashtext(week)` masked positive (mirror `pick_weekly_modifier`'s pattern, `20260667:193-197`, including the `& 2147483647` sign-mask trick). Deterministic from ISO week → **no cron**, client mirrors it exactly.
- `challenge_crew(p_target uuid, p_modifier text DEFAULT NULL)` — replace the 1-arg def (`20260647:403`); validate `p_modifier = ANY(war_modifier_hand(...))`; store pin; put the terms in the challenge announcement body ("…staked **Deep Mud**"). PostgREST callers passing only `p_target` resolve to the defaulted arg — old clients keep working.
- `accept_challenge(p_war uuid, p_modifier text DEFAULT NULL)` — **carry the FULL `20260668:950-997` def** (carry-latest-def footgun: it added the cooldown pre-check, `rhythm_enabled`, `build_ends_at`, the modifier roll — start from that text, not 20260647's). Add counter-pin validation + store; skip the `pick_weekly_modifier` roll when a pin exists (spec change 2).
- Modifier effects — small guarded branches reading the war row's pins, each in its latest-def home:
  | Modifier | Effect | Lands in |
  |---|---|---|
  | Deep Mud | marquee-area pressure ×1.15 | `rhythm_area_holds` (`20260668:146`) + `fold_front_outcome` (`20260667:213`) |
  | Loose Lids | Tend throws 7→8 | `throw_mud` (latest: `20260668:304`, budget inlined) |
  | Songbird's Gift | access-token cap 1→2 | `grant_war_access` (`20260668:1003`) |
  | Thick Fog | recap hides attacker difficulty until war end | `war_fronts_state` (`20260668:713`) masking |
  | Slick Rope | rout 12→10, day clamp ±5→±6 | `score_mud_war_days` (`20260668:221`, `c_rout`/`c_maxtotal`) + `resolve_war` (`20260668:576`) |
  | Echo Verse | perfect on a run's last note = +1 mud (still under caps) | `submit_run` (`20260668:399`) |

**M2 `20260703200002_redeploy_quota.sql` — booleans → quota ints (B-specific)**
- `redeploy_used_challenger/defender bool` (`20260667:93-94`) → `int` spend-counters via `ALTER … TYPE int USING (CASE WHEN … THEN 1 ELSE 0 END)`, plus `redeploy_quota_challenger int NOT NULL DEFAULT 1`, `redeploy_quota_defender int NOT NULL DEFAULT 1`. `accept_challenge` sets defender quota 2 when terms were staked. Update `redeploy_member` (`20260667:503-543`) to `spent < quota`. `war_fronts_state` returns spent/quota instead of the boolean.

**M3 `20260703200003_war_variants.sql` — variants (B-v1.5, staged)**
- `variant_params(p_variant text)` IMMUTABLE → `(build_days, war_days, throws_per_day, runs_per_day)`: classic (2,7,7,2) · derby (4,7,10,1) · long_night (1,7,4,3). Note the "Derby = 4 Tend + deploy day-5 + 2 Hold" sketch simplifies to build_ends_at = start+4d on the unchanged 7-day clock — deploy cadence is already per-Hold-day (`set_deploy` re-choosable until fold), so no cadence code changes.
- Plumb: `challenge_crew` stores variant; `accept_challenge`/`challenge_house` compute `build_ends_at` from `variant_params` instead of the inline `interval '2 days'` (`20260668:932,980`); `throw_mud`/`submit_run` read budgets from it instead of inlined 7/2; `war_state`/`war_fronts_state` report the variant. Unlock rule enforced server-side: variant ≠ classic requires both crews `wars_played ≥ 2`.
- Spoils weighting: in `grant_war_spoils_on_resolve` (`20260660:22`), bias `ORDER BY` toward the 5 derby-flavored ids on derby wars (flat version; real sets ride Phase 2).

### Client

| Surface | Change |
|---|---|
| `constants/mudFights.ts` | `GAUNTLET_MODIFIERS` (id → label + one-line description), client `modifierHand(weekStart)` mirror, `VARIANT_LABEL/PARAMS` mirror |
| `utils/mudWars.ts` | `challengeCrew(id, modifier?)`, `acceptChallenge(warId, counterPin?)`; `War`/`FrontsState` types gain `variant`, `modifierChallenger/Defender`, `redeploySpent/Quota` |
| `app/mud-war.tsx` | Challenge sheet: hand-of-3 picker (leader, one tap, skippable → "roll the weather"); `PendingWar` (~`:294-349`): render staked terms + counter-pin picker before Accept; `siegeDay` total from variant |
| `components/mudwar/FrontBoard.tsx` | Terms chips next to the existing weather chip (`:57-61`); **redeploy picker** (shared gap): member-select sheet mirroring `DeploySheet`, wired to `useMudWar.redeploy` (`hooks/useMudWar.ts:276`) + pass it from `app/mud-war.tsx:75` |
| Copy/art | Text chips only for v1; optional 6 modifier glyphs later (ChatGPT art, never emoji) |

### Shared preconditions (needed by ANY option — priced once, marked shared)

| Item | Effort | Note |
|---|---|---|
| Drove rename (29 strings / 7 files + announcement copy in new RPC defs) | 1d | shared — BLOCKING precondition #1; new M1 announcement copy must be born "Drove" |
| War/crew push deep-links (`utils/notificationRouting.ts` + `app/_layout.tsx` branch + `screen` field in war announcements) | 1.5d | shared — B's terms-staked challenge is exactly the push that must deep-link |
| Redeploy picker UI | 1d | shared (A wants it too) but **B-required** — the defender's compensation token is dead without it |
| Leader controls (kick/rename/transfer RPCs + UI) | 2d | shared — orthogonal to B |

## 4. Firewall + principles check

- **Isolation firewall: intact.** Every modifier is symmetric weather on war-scoped constants; the draft picks *which* weather, never *who benefits*. No snout/VIP/alignment leak. Defender compensation (counter-pin + token) is informational/agency, not score.
- **Informed consent:** terms visible pre-accept (F1); decline stays costless; mutual-accept unchanged. The 24h rematch cooldown + `find_challengeable_crews` friend-gate carry over untouched — no new collusion surface (pins can't be farmed; they're symmetric).
- **Solved-meta valve:** weekly deterministic hand rotation (F3) — a crew can't pin Deep Mud every war; the hand doubles as a live A/B lab for which weather graduates to Option A's permanent table.
- **Teachability:** progressive disclosure — v1 is "one chip on the challenge, one chip on accept"; variants unlock at `wars_played ≥ 2`; skipping the pick is always legal and falls back to rolled weather.
- **Race-not-duel (D9) / thin-crew (C3):** unaddressed by B — it deepens the duel. Consolation valves (A13) remain the mitigation; C remains the structural answer.

## 5. Test / dev plan

- Validate M1–M3 on the stubbed plain-Postgres Docker harness (local `supabase db reset` dies at pg_cron) before any push; push only on explicit "go".
- Dev harness: `dev_end_war_now` (`20260664`) covers resolution; add `dev_set_war_terms(war, variant, pin_ch, pin_df)` (is_test-gated) for fast-forwarding term states; `dev_skip_to_hold` (`20260670`) covers phase jumps.
- SQL regression: hand determinism across week boundary; pin-validation rejects out-of-hand ids; `accept_challenge` counter-pin idempotence under FOR UPDATE; fog unchanged under Thick Fog (extend `scripts/test_fog_rls.sql`); Slick-Rope rout at ±10; quota conversion preserves spent state.
- Jest: `modifierHand` client/server fixture parity (same pattern as the deploy-pairing fixture); challenge/pending-war UI snapshots.

## 6. Effort + milestones (solo dev-days)

| Milestone | Contents | B-specific | Shared |
|---|---|---|---|
| **B-v1 "The Pin"** (flippable with A's preconditions) | M1 terms+hand+signatures 1.5 · effects ×6 2.0 · M2 quota 0.5 · challenge/counter-pin UI 1.5 · dev+tests 1.0 | **6.5** | rename 1.0 · push links 1.5 · redeploy picker 1.0 |
| **B-v1.5 "The Songbook"** (post-flip, unlock-gated) | M3 variant params+plumbing 1.5 · client week display 0.5 · flat spoils weighting 0.5 · sim pass on derby/long-night budgets 0.5 | **3.0** | — |
| Ongoing | weekly hand needs no ops (deterministic); watch pin distribution before graduating weather to permanent | — | leader controls 2.0 (any option) |
| **Totals** | | **9.5** | **5.5** |

Sequencing note: because B-v1 ⊃ A (spec change 2), the decision "A vs B-v1" collapses to "ship the weather effects, then decide whether the draft UI ships dark or live" — the fork costs ~3 client days, not a rewrite.

## Connects to
- [[mudwar-challenge-options-2026-07]] — the option being scoped
- [[clan-buildout-audit-2026-07]] — the shared client gaps priced above
- [[mudwar-consolidated-brief-2026-07]] — substrate + principles
- [[mudwar-whats-next-2026-07]] — rollout preconditions

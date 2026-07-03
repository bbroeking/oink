---
title: "Scope — Option A: Songs of the Bog, Weathered (research + exact build plan)"
type: memo
date: 2026-07-03
tags: [mud-wars, season-2, scope, bog-weather, mud-fort, redeploy, consolation, founder-decision]
status: draft
---

# Scope — Option A: "Songs of the Bog, Weathered"

Research-backed, code-verified build plan for Option A of [[mudwar-challenge-options-2026-07]]: flip the shipped rhythm war + **Bog Weather** (the inert `weekly_modifier` becomes real) + **Mud Fort** (derived-view crew artifact) + **consolation valves** + the **redeploy picker**. Client gaps per [[clan-buildout-audit-2026-07]].

**Headline: ~6.5 solo dev-days Option-A-specific + ~5.5 shared preconditions ≈ 12 dev-days to a bounded-cohort flip. 2 new Option-A migrations (+3 shared). ~6 client surfaces + 1 new component.**

---

## 1. Research findings (what changes the spec)

1. **Restrictive modifiers breed resentment; additive ones don't.** Marvel Snap's Featured/Hot Locations — the closest live analog to a rotating twist — generated sustained player anger *specifically when the modifier warped how you were allowed to play* ("frustrating not playing the deck you wanted 3 days out of 7"); Second Dinner retreated (48h→24h, softer locations, fewer new ones) to broad relief. Lesson: **bias the Bog Weather pool toward modifiers that ADD options** (extra throw, extra token, bonus note) over ones that deny (fog, pressure spikes); keep denial-flavored weather rare.
2. **Predictability is a feature, not a spoiler.** Destiny 2's weekly reset works as a "maintenance session" habit anchor precisely because the rotation is known — players plan around it (fixed 60-week Nightfall order). Lesson: make the weather **global-per-week and pre-announced** (this week + next week visible), not a per-war secret roll.
3. **Shared visible team artifacts drive broad participation.** Clash of Clans' Clan Capital ties reward output to *everyone's* raids (medal totals scale with all members' attacks) with equal-access contribution regardless of individual progression — the design intent behind Mud Fort's per-capita staging is well-precedented.
4. Consolation-reward data specific to losing teams is thin in public sources; general team-event retention literature supports capped participation rewards. Keep the valves cheap, capped, cosmetic-only (as specced) — the corpus's own benchmarks ([[coop-mechanics-research-2026-06]]) remain the better calibration.

Sources: [Escapist — Snap's featured locations are anti-fun](https://www.escapistmagazine.com/marvel-snap-featured-locations-are-anti-fun/) · [Dexerto — Snap softens Featured/Hot](https://www.dexerto.com/marvel-snap/marvel-snap-makes-massive-change-to-featured-hot-locations-2081203/) · [Dexerto — players furious over restrictive locations](https://www.dexerto.com/marvel-snap/marvel-snap-players-are-furious-over-increasingly-restrictive-locations-2148730/) · [Destiny weekly reset guide](https://gamerant.com/destiny-2-weekly-reset-guide-nightfall-raid-rotations/) · [Destiny Nightfall fixed rotation](https://destiny.fandom.com/wiki/Weekly_Nightfall_Strike) · [Supercell — Clan Capital](https://support.supercell.com/clash-of-clans/en/articles/what-is-the-clan-capital-3.html) · [Clan Capital rewards analysis](https://www.ldshop.gg/blog/clash-of-clans/capital-guide.html)

### Recommended spec changes (from research + code reality)

| # | Change | Why |
|---|---|---|
| R1 | **Weather is global-per-ISO-week, not per-war.** Re-body `pick_weekly_modifier` to hash `to_char(now() AT TIME ZONE 'UTC','IYYY-IW')` (STABLE, not IMMUTABLE) so every war stamped that week shares weather; surface "next week's weather" in the client. | Destiny lesson (anticipation + watercooler); matches the "Bog Weather" fiction; zero call-site change (still stamped per-war at creation). |
| R2 | **v1 pool = `none` + 5 additive/mild modifiers; DEFER `slick_rope`.** Slick Rope (rout 12→10, clamp ±6) touches `score_mud_war_days` + `resolve_war` + `war_state` + client rope UI (4 carries for one modifier) and swingier wars punish thin crews. | Snap lesson (soft > warping); biggest carry risk for least cozy payoff. |
| R3 | **Keep legacy keys as no-ops.** Active wars may carry `marquee_double`/`fogged_gold`/`warboss_week`; keep their labels in `WEEKLY_MODIFIER_LABEL`, give them no server effect. | Live-data safety. |
| R4 | **Fort is client-only in v1** (render off `war_state`'s existing totals; celebration beat in the resolved modal). No fort table, no announcement migration. | A1's zero-new-surface promise, kept literally. |
| R5 | **Faucet note:** Loose Lids (+3/day cap) and Songbird's Gift (+1 run) mildly raise the snout mint (winner is paid own-score 1:1) — symmetric and ≤~15%/war, acceptable at beta scale, but **revisit both when the B2 war-token wall lands.** | Precondition-2 interaction, named now so it isn't rediscovered. |

---

## 2. Build plan

### Migration sequencing note
Applied head is `20260692000000`. The repo's `YYYYMM##`-style prefixes mean our `20260703…` files sort after it — but **every later migration must then be ≥ `20260704`** (a future "20260693" would sort before ours and collide with the alphabetical rule).

### M1 — Bog Weather (server): `20260703100001_bog_weather.sql`

One migration, carrying each function **from its latest applied definition** (the carry-latest-def footgun, [[project_carry_latest_def_footgun]]):

| Modifier (new key) | Effect | Function carried | Latest def lives in |
|---|---|---|---|
| — (the roll itself) | week-keyed pool draw (R1) | `pick_weekly_modifier` | `20260667:193` |
| `deep_mud` | rank-1 (marquee) area: P ×1.15 | `rhythm_area_holds` | `20260668:146` |
| `loose_lids` | throws 7→8, day cap 21→24 | `throw_mud` | `20260668:304` |
| `songbird_gift` | barn-visit token cap 1→2 | `grant_war_access` | `20260668:1003` |
| `thick_fog` | recap's `attackingMe` reads `'fogged'` until the war resolves | `war_fronts_state` | `20260668:713` |
| `echo_verse` | 3rd scored note `perfect` → +1 mud (still under day-cap 21 / area-cap 12) | `submit_run` | `20260668:399` |

Implementation notes:
- Each carried function already `SELECT * INTO w FROM mud_wars` — read `w.weekly_modifier` there; effects are `CASE`-gated one-liners, so the diffs against the carried bodies stay tiny and reviewable.
- `challenge_house`/`accept_challenge` (latest `20260668:904/950`) already stamp `weekly_modifier` at war creation — **no call-site change**.
- Announcement/copy in carried functions must stay emoji-free (the `20260662` strip trigger sanitizes anyway).
- Restate the `20260668/20260672` `REVOKE … FROM PUBLIC` lines for every carried SECURITY DEFINER function (`rhythm_area_holds`, `grant_war_access`, `war_fronts_state`) — the re-create resets ACLs.

### M2 — Bog Weather (client)
- `constants/mudFights.ts` — extend `WEEKLY_MODIFIER_LABEL` (keep legacy keys, R3) + new `WEEKLY_MODIFIER_DESC` one-liners.
- `components/mudwar/FrontBoard.tsx:57-61` — the existing weather chip gains the description line; add a "next week" whisper if we surface R1's preview (client can compute the next ISO-week key locally only if the pool/order is mirrored — simplest: a `next_weather()` field added to `war_fronts_state` in M1, one line).

### M3 — Mud Fort (client-only, R4)
- New `components/mudwar/MudFort.tsx` — staged render keyed off per-capita/rope already returned by `war_state` (`mine.total`, `mine.perCapita`, `rope_pos`); `FORT_TIERS = [0,3,12,24,40,54]` (per-capita, front-loaded per A1) added to `constants/mudFights.ts`.
- Mount in `app/mud-war.tsx` header zone (~`:530`, above `FrontBoard`).
- Fort-complete beat in `components/MudWarResolvedModal.tsx`.
- **Art (non-code):** 6 fort stage images via the ChatGPT art pipeline; game-look style anchor; no emojis.

### M4 — Redeploy picker (client-only; closes audit gap #1)
- `app/mud-war.tsx:75` — destructure `redeploy` from `useMudWar` (hook exists `hooks/useMudWar.ts:276`; RPC `redeploy_member` `20260667:503`); pass roster (already in `war_state.mine.members`) + `onRedeploy` into `FrontBoard`.
- `components/mudwar/FrontBoard.tsx` — leader-gated picker mirroring the existing `DeploySheet` pattern (`:186-297`): member chips × area chips, one confirm; flip the `:128-130` status text to reflect spend; server enforces one-per-war via `redeploy_used_*`.

### M5 — Consolation valves (server): `20260703100002_war_consolation.sql`
- Carry `grant_war_spoils_on_resolve` **from `20260660:22`** (verified: `20260662` did NOT redefine it — it only added a generic announcement-sanitizer trigger).
- Add two branches on the same resolved-transition guard: (a) **losing crew's** contributors (`SUM(slings) > 0`) each get one item from a fixed 3-common consolation pool (e.g. `muddy_cap`, `mud_pie`, `reed_hat`), capped 1/war; (b) **draw/no-winner**: both crews' ≥1-action members get the same. Skip rarity-ladder plumbing (A11 unbuilt) — a fixed pool constant in the function is v1.
- Inline `system_announcements` INSERT (never the admin-gated wrapper — [[project_admin_gated_announcement_footgun]]), exception-guarded like the win branch.
- Client: `components/MudWarResolvedModal.tsx` gains a "carried something home" line for losers/draws.

### Shared preconditions (NOT Option-A work — needed for any option; estimated once)

| Item | Work | Est |
|---|---|---|
| S1 Drove rename | The 29 crew-meaning UI strings across 7 files ([[clan-buildout-audit-2026-07]] §c) — NOT the referral/herd meanings; + `CONTEXT.md` codification | 1.0 d |
| S2 War push deep-links | `utils/notificationRouting.ts` + `app/_layout.tsx` war branch + server emit on resolve/challenge/invite (`20260703100004_war_push_screens.sql`) | 2.0 d |
| S3 Leader controls | `set_crew_name`/`kick_member`/`transfer_leader` RPCs (`20260703100003_crew_leader_controls.sql`) + `SounderCard` affordances | 1.5 d |
| S4 Flip instrumentation | `war_population_ready()` read + the A16 collusion signal (one query over cooldown stamps) | 1.0 d |

---

## 3. Firewall check (isolation invariant)

| Modifier | War-scoped? | Notes |
|---|---|---|
| deep_mud | ✅ fold input only | symmetric (both crews' marquee) |
| loose_lids | ✅ throw budget only | R5 faucet note; area cap 12 unchanged |
| songbird_gift | ✅ war-scoped tokens | crew-membership-gated mint unchanged |
| thick_fog | ✅ info only | zero score path |
| echo_verse | ✅ ≤ day-cap 21, ≤ area-cap 12 | tiny symmetric bump |
| slick_rope | ✅ but 4-function carry | **deferred (R2)** |

Nothing reads alignment, blessings, VIP, or snout wealth; nothing writes outside war tables except the existing (pre-existing) winner payout — unchanged by this scope.

## 4. Test / dev plan

- **Jest:** pure-helper pattern only (`__tests__/mudWars.test.ts` mocks the supabase chain) — add `fortStageFor(perCapita)`, modifier label/desc lookups, next-week key derivation.
- **Migration validation:** local `supabase db reset` dies at the pg_cron migration — use the stubbed plain-Postgres Docker harness ([[project_local_db_validation]]) to apply `20260703…` files against a schema snapshot.
- **E2E on dev (Brian-only flag):** `challenge_house()` → `dev_skip_to_hold` (`20260670`) → `submit_run` under each modifier → `dev_end_war_now` (`20260664`) → verify rope math, spoils + consolation grants, recap fog.
- **DB pushes only on an explicit user "go".**

## 5. Milestones + effort (solo dev-days)

| # | Milestone | Contents | Est |
|---|---|---|---|
| 1 | Client-only wins (no DB push) | M4 redeploy picker + M2 labels/desc + M3 fort shell w/ placeholder art | 2.0 |
| 2 | Bog Weather live on dev | M1 migration + validation harness + E2E | 2.5 |
| 3 | Consolation | M5 migration + resolved-modal line | 1.0 |
| 4 | Fort art + polish | 6 stage images (art pipeline) + resolved-modal beat | 1.0 (+art) |
| | **Option-A total** | | **~6.5** |
| 5 | Shared preconditions | S1–S4 | ~5.5 |
| 6 | **Flip** | readiness gate green → widen `mud_wars` to a bounded cohort | 0.5 |
| | **Grand total to cohort flip** | | **~12** |

## Connects to
- [[mudwar-challenge-options-2026-07]] — the option this scopes
- [[clan-buildout-audit-2026-07]] — the client gaps folded in
- [[mudwar-whats-next-2026-07]] — rollout preconditions
- [[mudwar-consolidated-brief-2026-07]] — substrate + idea bank

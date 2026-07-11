# Season 1 — the co-op dig (spec)

**Status:** adopted 2026-07-06 (grill session; decision logged in `SKILL.md`).
**Amended 2026-07-07:** the "no opposing Sounder, ever" clause is superseded by
the 24-hour Dig-Off (`docs/digoff-spec.md`) — a minimal versus layer on top of
this loop. Everything else here stands.
**Supersedes:** `docs/sounder-league-spec.md`, `docs/sounder-mud-fight-spec.md`,
`docs/sounder-games-plan.md` — the entire Sounder-vs-Sounder war/league stack.
Pre-teardown code is archived on branch `archive/sounder-league-2026-07-06`.

## The one sentence

**"Join a Sounder and dig at the Hungerer's feedings — the truffles are yours,
and every find starves him."**

There is no second sentence a player must learn. No opponent, no rope, no
fixtures, no ribbons, no mud.

## Why the war died

The versus stack accreted four generations of mechanics in three weeks (flat
slings → throw bands → fronts/Blotto → rhythm hold) plus a league layer
(weekly fixtures → no-draw tiebreaks → ribbon Elo). Named failures, from the
founder's own review: too many stacked systems; an illegible scoring chain
(dig → mud → rope → fixture → ribbons); a muddled fiction (pigs-vs-pigs,
joy-vs-the-Hungerer, county fair); and — at root — the wrong game shape for a
charter that says *"we'd rather a player feel invited than ranked."* Nothing
had shipped (the `mud_wars` flag never flipped), so the teardown was free.

## The design

1. **Shape: pure co-op vs the world.** The Sounder digs together against the
   Great Hungerer. No opposing Sounder exists anywhere in the design.
2. **Sounder's role: social multiplier + quiet milestones.** No weekly herd
   goals, no rendezvous obligations. The herd makes digging better, and
   accumulates *lifetime* milestones — passive accomplishment, never a chore
   clock.
3. **Season spine: the global hunger meter, story-only.** His six stages
   (gorged → famished) are the season's chapter beats: barnyard-wide
   celebration moments, not loot drops. Finale = the last feast (existing
   `finalize_season` pattern).
4. **Mud is dead.** A dig's finds ARE the score: truffles bank personally,
   and every credited find drains the meter. No intermediate unit.
5. **One dig game: Truffle Patch** (the founder-validated bake-off winner).
   Deep Root and Snout Hook retire to the lab; no rotation, no picker.
6. **Rewards: the Truffle Exchange is the single door.** The 25 war-spoils
   cosmetics remain its stock (`war_exclusive`-gated, earn-only); the
   resolve-time random grant and win-tickle payouts die with the war; the
   three war titles re-theme to herd dig milestones.
7. **No herd rankings anywhere.** League table, Spirit board, clan ladder —
   cut. Personal Global/Friends boards untouched. Herds accomplish; pigs
   compete.
8. **Herd juice (kept, celebrated harder):** crew echo (a mate digging the
   same feeding retro-gilds your truffle), co-op stir (+5 budget when a mate
   already dug), blessed dig, the Chorus. The redesign investment is making
   the echo *felt*: a named callout in the patch ("Jen dug this feeding —
   your truffle gilded") and a herd presence strip (who's dug this window).
9. **Dig access: Sounder-gated.** The season's verb requires a herd;
   join-first onboarding becomes "join → dig."
10. **Surfaces: the season tab is the one home.** Hungerer hero + meter
    (story), feeding/dig strip (verb), herd presence, herd milestones. The
    dig opens as the existing full-screen modal. SounderCard on Friends keeps
    roster/invites/join/leave. `/mud-war` and `/clan-ladder` are deleted.
11. **Fiction cleanup:** no "bog," no "scuffle," no "mud" in new copy. The
    place is the truffle patch at the Hungerer's feeding grounds — he gorges
    at his trough every 8 hours, distracted, and the herd sneaks digs.

## Mechanics

- **Feeding windows:** unchanged — every 8h, one dig per pig per window, the
  same seeded 6×5 board contract (`utils/rooting.ts` ↔ server parity; the
  pouch-normalization submit chokepoint stays).
- **Herd milestones:** lifetime herd finds at **150 / 600 / 1800** grant every
  current member a re-themed title (**Root Rustler / Truffle Baron /
  Hunger's Bane**) plus a snout purse, announced in-app. Idempotent per crew
  per threshold; earn-only.
- **Hunger meter:** denominated in finds (barnyard-wide), fed by
  `submit_rooting`. Thresholds are server-tunable; the display contract is
  unchanged (six stages, no countdown, no end date shown).
- **Truffle faucets:** dig finds (first-truffle, echo gild, blessed dig) and
  the barn-forage trickle. The war-era personal mud-milestone bonus
  (10/25/50 mud → bonus truffles) died with mud and is deliberately not
  re-expressed — fewer faucets, one legible loop. Revisit only if exchange
  prices prove too slow to reach.
- **Gating:** the rebuilt surfaces ride a new `coop_dig` server flag. The old
  `mud_wars` flag stays FALSE forever — old dark TestFlight builds gate dead
  war UI on it and must never light up.

## Server surface (contract)

- `open_rooting()` — no args; errors `no_crew`; returns `{ already,
  window_index, seed, opened_at, coop, blessed, crew_dug: [{user_id,
  display_name}] }`.
- `submit_rooting(p_finds text[], p_actions int)` — returns `{ credited,
  truffles, echo_names, drain_total, milestone: null | {threshold,
  title_id} }`.
- `hunger_meter()` — `{ available, total, stage, stage_index,
  next_threshold }`, finds-denominated.
- `feeding_state()` — `{ window_index, window_ends_at, dug, crew_dug }`.
- `crew_state()` and the join/leave/invite RPCs survive with all war fields
  and mid-war gates removed.
- Everything war/league is dropped: tables (`mud_wars`, `mud_slings`,
  `war_terms`, `term_fixtures`, `league_seasons`, `crew_ratings`,
  fronts/rhythm), their RPCs, triggers, and cron jobs. Migration:
  `20260714000000_coop_dig_rebuild.sql`.

## Charter check (the five questions)

1. **Pillar:** Cooperate (the only score is what the herd did together) +
   Connect (the herd exists to make a friend's dig felt — named echoes,
   presence, the Chorus) + Collect (dig → truffles → exchange, earn-only).
2. **Cozy, not grindy:** one optional dig per feeding; missing a window costs
   nothing and is never displayed as a deficit; milestones are lifetime, not
   weekly.
3. **Respects the player:** no rankings to fall down, no opponent to lose to,
   nothing buyable that plays for you.
4. **Honest about feelings:** the Hungerer's state is shown through his art
   and stage fiction; the meter has no countdown and the season no visible
   end date.
5. **Fair social loop:** minting stays server-side inside `submit_rooting` /
   `mint_truffles`; the dig is crew-gated but joining is free and join-first;
   echoes can't be farmed (one per mate per window, caps unchanged).

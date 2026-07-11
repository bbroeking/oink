# Sounder Mud Fights — clan-war plan (next season)

> **SUPERSEDED 2026-07-06** by `docs/season1-coop-dig-spec.md` — the entire
> war/league stack was removed in the first-principles co-op rebuild (see
> `SKILL.md` decision log; code archived at `archive/sounder-league-2026-07-06`).
> Kept for history only.

**Source:** 2026-06-13 voice brainstorm (sounder-off / barn-off) distilled, plus
the sim-verified scoring work harvested from
`docs/explorations/2026-06-08-pinned-design-teams-pageant-minigames.md` (the
Mud-Off per-capita + quorum results transfer directly). **Timing:** the
transcript pins this as the next-season headline, not a build-97 item.

## Locked by the conversation

| Decision | Call |
|---|---|
| Team formation | **Invite your friends** (full clan), NOT random assignment — "I'd be less likely to play if I had to randomly play against my wife." |
| Team size | **Cap 5.** "I even think 10 is too big right now" (27 players). Raise later. |
| Match model | One crew **challenges** another; the challenged crew **accepts** → war starts. |
| Duration | Recurring **weekly** cadence ("starting over every week, I have to actually try"). War window itself: 5 days + 2-day rest (see Q2). |
| Fairness | **Total isolation**: war scoring starts both teams at ZERO with NO buffs. Alignment, blessings, VIP regen — none of it may leak into war scoring. "Just because my sounder is all max generosity doesn't mean we get those buffs in the clan war." |
| Rewards exit, buffs don't enter | You earn rewards INSIDE the isolated event that pay OUT to the core game: snouts + a next-period regen buff. |
| Payout | Winners: own war score paid 1:1 in snouts **+ 50% of the losing team's pot**, split per-capita. Plus a **regen buff** for the next period (24h–1wk, see Q3). |
| Positioning | Optional competitive layer (Clash-of-Clans flavor). Collectors can ignore it entirely; competitive players NEED it to catch/hold leaderboard position — that's the anti-boredom valve for the core tap loop. |

## Design

### The fairness mechanism: flat daily mud, not buffed tickles

If war score counted your regular (buffed) tickles, VIP + blessings would leak
straight back in — violating the core ask. So war contribution is its own verb:

- **Mud slinging.** During a war, every member gets a **flat allotment of 20
  mud-slings per day** — identical for everyone, no modifiers, use-or-lose
  (no banking across days). Tap them in the war screen.
- Fairness is now **by construction**: a crew's ceiling is `members × 20 ×
  days`. Winning = roster participation + showing up daily. Nothing on the
  core account moves the needle.
- **Scoring: per-capita active average with a quorum floor** (the pinned
  Mud-Off result, sim R5) so a 5-crew vs a 3-crew is fair: `SUM(mud) /
  COUNT(members WHERE mud > 0)`, quorum 2. Alts/ghosts drag the average
  (sim-verified self-defeating).
- Cooperation hooks (v2): bonus mud for warring-crew-mate interactions
  (trade fulfilled, trough chip, visit) — capped, flat amounts.

### Entities (new, technical names)

- `crews` — id, name, leader_id, created_at. Player-facing word TBD (Q1 —
  "sounder" currently means the referral downline).
- `crew_members` — (crew_id, user_id) PK, cap-5 trigger, one crew per user.
- `crew_invites` — leader invites, accept/decline, expiry.
- `mud_wars` — challenger_crew_id, defender_crew_id, status
  (proposed→active→resolved/expired), starts_at, ends_at, scores, winner.
- `mud_slings` — (war_id, user_id, d) PK day-bucketed counter rows; the flat
  allotment is enforced here.

### Lifecycle (all SECURITY DEFINER RPCs, lazy resolution like the Trough)

1. `create_crew(name)` / `invite_to_crew` / `accept_crew_invite`.
2. `challenge_crew(target)` → inline announcement to the defender's members.
3. `accept_challenge` → war becomes `active`, window stamped.
4. `sling_mud(war_id, n)` — clamps to today's remaining allotment; counters
   only (no minting); both crews' bars update.
5. `resolve_war(war_id)` — lazy, first-reader-after-end (clone the
   `resolve_expired_drives` pattern; no cron): per-capita + quorum winner;
   payout = each winner's own mud 1:1 in snouts (`counter + tickles_earned`,
   the 20260628 leaderboard shape) + per-capita share of 50% of the loser
   pot; **regen buff** row for winners; inline announcements both sides.
   Both-below-quorum: no winner, no payout (mud was free — nothing to refund).
6. Rematch/next war: fresh rows, zero carry-over — by construction.

### The regen buff

Winner-crew members get `war_winner_regen` — reuse the **blessing
infrastructure** (`blessings` table, `warm_tea`-style ×0.85 for 72h — milder
and longer than warm_tea's ×0.5 so it stacks politely; `regen_secs_for`
already multiplies blessings in). One new kind string + one `regen_secs_for`
carry-forward (⚠️ carry the LATEST def — see the 20260624 regression).

### Anti-abuse (inherited from the sim work)

Flat allotment kills whales by construction; per-capita + quorum kills ghost
rosters and alt-stuffing; mutual accept kills farm-matchups (you can't force
a pushover to fight you); one-crew-per-user kills self-wars. Residual: collusive
50/50 trading of wins between two crews — bounded (the 50% transfer makes
throwing strictly lossy for the thrower) — monitor, don't pre-engineer.

### Client surface (P2)

- **Crew card** on Friends tab (form/invite/accept — gated behind the
  existing `SOUNDER_VISIBLE`-style feature flag until season 2).
- **War screen**: tug-of-war mud bar, both crews' per-capita scores, your
  remaining slings today, day countdown, roster participation pips.
- Popup-queue announcements: challenged / war started / daily "slings
  refreshed" nudge (push, once/day) / resolved (win + payout reveal modal).

## Phasing

- **P1 server** (~1 migration + 7 RPCs): entities + lifecycle + resolve +
  buff kind. No client; testable via SQL.
- **P2 client** (~3 components + flag): crew card, war screen, announcements.
- **P3 polish**: cooperation bonus mud, war history wall, crew titles
  (`titles.source = 'sounder'` rows already seeded!), season-2 launch ramp.

## Adjacent note from the same conversation (separate track)

Launch plan sentiment: reset the leaderboard at public launch, beta testers
keep nothing but get an exclusive beta skin. Not part of this spec — flagged
for the launch checklist.

## Questions

1. **Naming/entity:** new `crews` entity with "Sounder" as the player-facing
   word (and rename the referral downline to something else), or keep them
   distinct ("your Wallow"? "your Drove"? — `drove_captain` title exists)?
2. **War window:** 5 days + weekend rest, or full 7-day rolling?
3. **Buff:** ×0.85 regen for 72h OK, or stronger/shorter (×0.7 for 24h)?
4. **Daily allotment:** 20 slings/day — feel right? (At cap-5 × 5 days that's
   a 500-point ceiling per crew.)
5. **No opponent available** (27 players): allow a "ghost war" vs a
   house-bot crew with a fixed daily pace, or simply require two real crews
   and let wars be rare-but-special in beta?
6. **Build now behind a flag, or hold all of it for the season-2 branch?**

## Build status (2026-06-13) — P1 + P2 built, dark-launched

Decisions locked + implemented this session:

| Q | Decision |
|---|---|
| Q1 naming | **Reclaim "Sounder"** as the player-facing crew word. Tables stay `crews`/`mud_wars`/… Referral downline → backend-only (`SOUNDER_VISIBLE` now means the referral surfaces). |
| Q2 window | **5-day** active window (`WAR_LENGTH_DAYS`, one literal to make it 7). |
| Q3 buff | **×0.85 for 72h** (`war_winner_regen` blessing kind). |
| Q4 allotment | **20 slings/day** flat. |
| Q5 no opponent | **House-bot "ghost crew"** ("The Mudlarks", `challenge_house()`), pace 12/day, flat `HOUSE_BONUS` 25. |
| Q6 scope | **Full P1 + P2**, gated behind `MUD_FIGHTS_VISIBLE = false`. |

Shipped (not yet DB-pushed — awaiting explicit "push it now"):
- **Migration** `supabase/migrations/20260647000000_mud_fights.sql` — 5 tables, cap-5 trigger, one-crew index, RLS (recursion-safe via `is_crew_member`/`is_war_participant` SECURITY DEFINER helpers), seeded bot crew; ~14 RPCs incl. lazy idempotent `resolve_war`; `regen_secs_for` re-created from the 20260630 base + `war_winner_regen` factor; `blessings`-kind + `titles`-source CHECK extensions; `mud_champion`/`mud_veteran`/`mud_legend` titles; `profiles.war_wins`.
- **Client** — `constants/mudFights.ts`, `utils/mudWars.ts`, `hooks/useCrew.ts`, `hooks/useMudWar.ts`, `components/SounderCard.tsx` (Friends-hub "Sounder" segment), `app/mud-war.tsx` (tug-of-war + sling-mud tap juice), flag in `constants/featureFlags.ts`.
- **Reveal** rides the existing WhileAway path (mud-war `system_announcements` surface there automatically) + the on-screen resolved recap — no separate global modal.
- **Tests** — `__tests__/mudWars.test.ts` (pure helpers, green) + `supabase/tests/02_mud_fights.sql` (pgTAP end-to-end war; runs on `supabase test db` after the migration is applied).

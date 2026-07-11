# Sounder League — the Alignment slot becomes the clan ladder (spec)

> **SUPERSEDED 2026-07-06** by `docs/season1-coop-dig-spec.md` — the entire
> war/league stack was removed in the first-principles co-op rebuild (see
> `SKILL.md` decision log; code archived at `archive/sounder-league-2026-07-06`).
> Kept for history only.

**Status:** adopted 2026-07-05 (decision logged in `SKILL.md`), pending implementation. Cross-link from `docs/wiki/alignment.md` + `docs/wiki/sounder-mud-fights.md` when the wiki recompiles.

## What this is

Season 0's competitive axis was **the Alignment** — a per-player −100…+100 score with a two-sided leaderboard (`alignment_leaderboard`) and a Judgement Day finale. Season 1 (The Great Hunger) retires that board (already coded: `components/Leaderboard.tsx:241-247` swaps the `alignment` scope for `sounders` when `world_boss` flips; the alignment *score* survives only as the blessing/curse dial per the 2026-07-03 decision).

What fills the slot is **the Sounder League**: clans ranked the way Clash of Clans ranks clans in **Clan War League** — scheduled fixtures, a season table, divisions with promotion later. It **supersedes in part** the 2026-07-03 "Sounders rank by Spirit, per snout" decision: Spirit survives as the visible warmth stat and a tiebreak, and the ranked number is **Prize Ribbons** — a real Elo wearing county-fair clothes (2026-07-06 revision; the fair fiction matches the rosette/prize-sash war spoils). The W–L fixture record stays visible as the season's story; ribbons are its strength.

## The shape

- The season splits into **weekly war terms**. Each term, every Sounder has **one scheduled fixture** against another Sounder.
- **This season, rematches are allowed**: pairing prefers an opponent you haven't played, but once the pool is exhausted teams simply play each other again. Later seasons may be confined in term count and set so that all clans play each other exactly once (a strict round-robin).
- Each fixture resolves as a Mud Scuffle → a **win or a loss** on the season table (no draws). At season end the table finalizes and pays rewards by placement.
- After multiple seasons, the single table splits into **divisions** with promotion/relegation.

No personal trophy currency is needed in this model — the clan's score *is* its match record. Personal participation keeps paying through the existing channels (participation-scaled tickle wins, Spirit).

## War terms and fixtures

- **Terms are weekly** — a clean rhythm the player can hold ("new opponent every week"), independent of how many Sounders exist.
- **Pairing:** the schedule is regenerated at each term start — every eligible Sounder is paired, preferring an opponent it hasn't played yet; when everyone's been played, rematches are legal (least-recently-played first, so variety stays high).
- **Odd count / byes:** the seeded ghost crew (`crews.is_bot`) fills the odd slot, so nobody sits a term out staring at an empty bog.
- **Mid-season foundlings** enter the schedule at the next term start and simply play fewer fixtures (the table shows games played). Founding late costs standing this season, never access.
- **Scale path:** if the population grows large, split into **round-robin groups of ≤8** (exactly CoC CWL's group size), seeded by crew Elo — `crew_ratings` earns its keep as seeding, no longer a visible board. This is also the on-ramp to divisions and to the later strict all-play-all season shape.

## Scoring

- **The table ranks by Prize Ribbons** — the crew Elo (`crew_ratings` + `apply_crew_elo`, running since 20260667 as matchmaking plumbing) rebased to a trophy scale and made the celebrated number (migration `20260708000000`):
  - New Sounders arrive at the fair with **200 ribbons**; the floor is **0** (the fair doesn't repossess — mildly inflationary at the bottom, which trophy systems accept on purpose).
  - Classic Elo update: expected score over a 400-point curve; **K = 40** while provisional (< 3 rated scuffles, shown as "new banner"), then **24**; scaled by rope margin (a rout moves ~1.7× a squeaker). Beat a stronger Sounder, win more ribbons.
  - **Bot byes are ribbon-neutral** — the ghost crew is a participation filler; the W still lands on the record.
  - **The Chorus keeps paying +3 ribbons** (the 2026-07-03 "kindness stays tiny vs scuffle swings" rule, now visible on the board).
  - The same number still drives matchmaking/division seeding — one rating, no dual bookkeeping (Elo math only uses differences, so the −1000 rebase changes nothing).
- **Every fixture has a winner — no draws on the table.** If a scuffle's combined mud ties at term end, the fixture falls to the tiebreak (most active snouts → most digs → elder banner). Ribbons, though, score the *war* result — a dead-even rope pays half-ribbons each — because Elo measures the scuffle while the table records the fixture.
- **Yielding** (`forfeit_war`) = a normal loss, as it already is for Elo — the dignified exit keeps its price.
- **Unanswered fixture** (neither side slings all term): no result for either side. Absence isn't punished beyond not earning — no deductions, ever. (One side showing up alone resolves as a normal win for the active crew.)
- **Ranking order**: ribbons → wins → aggregate mud differential (total scuffle points for − against) → name. (**Spirit** as the final human tiebreak stays the season-end intent — lands with the finalize work.)
- Every fixture's effort still drains the Great Hungerer's season meter — the league and the world-boss arc stay one woven thing.

## Season end and rewards

**The season's end date is hidden in the UI.** No countdown, no "season ends in N days" — the finale simply arrives with the Great Hungerer arc (Gorged→Famished, the last feast). This extends the 2026-07-03 "no Judgement Day countdown looming over daily play" decision to the league. The *term* clock is different and fine to show — "3 days left this term" is a fixture deadline, a reason to rally, not doom.

Reuses the `finalize_season` → `my_finale_result` → modal pattern (idempotent per season key, service-role, cron).

- **Placement tiers** (every member of the Sounder gets the reward):
  - **Champion** (1st): dated title (the `halo_bearer_2026` pattern) + exclusive cosmetic + snout purse.
  - **Top 3:** cosmetic + snouts.
  - **Upper half:** snouts.
  - **Completion:** any Sounder that answered every fixture gets a small cosmetic stamp — showing up all season is worth celebrating regardless of the table.
- **Cosmetics + snouts only.** No Golden Truffles from the league — truffles stay war-dig-only (`mint_truffles` single-purpose invariant). All reward cosmetics are earn-only, covered by the broadened `pass_exclusive` audit so they can never leak into the shop.

## Divisions (future seasons)

After two-plus seasons (or as soon as the population forces groups), the table splits into named divisions with promotion/relegation between seasons — mud-fiction ladder, sticker-art emblems via the icon-gen pipeline (no emoji):

**Puddle → Wallow → Bog → Mire → Golden Trough → Crown of the Bog** (top division, the celebrated table).

Top 2 of a division promote, bottom 2 relegate. Not built for S1 — the S1 deliverable is one honest table.

## Clan functionality — CoC parity map

| CoC feature | TTP today | This spec |
|---|---|---|
| Clan size | `CREW_CAP = 5` (trigger `enforce_crew_cap`) | **Cap drops to 4.** Constant + trigger + copy ("five snouts" mentions). Any existing 5-member crew is grandfathered — never kick to enforce |
| Create clan (costs gold) | `create_crew`, free | Founding costs **500 snouts** — a speed bump that reinforces join-first (joining stays free) |
| Clan name / badge / description | Name only (1–24 chars), set once at founding | Add **crest** (sticker-art set, `crews.crest_id`), **motto** (`crews.motto`, ~80 chars), and **rename** (leader-only, free, once per war term, never mid-scuffle, announced to the league — decided 2026-07-06); all via one `set_crew_profile` RPC |
| Join types: Anyone Can Join / Invite Only / Closed | Open = "has a free slot" | `crews.join_type` enum — `open` (current behavior), `invite_only` (request → approve), `closed` |
| Required trophies to join | — | Deferred to the divisions era (no trophy number exists to gate on; a division-based gate is the natural version) |
| Roles: Leader / Co-Leader / Elder / Member | `leader` / `member` | Add **`elder`** (invite, accept join requests, kick members). Three roles fit a 4-cap crew; Co-Leader never (nothing left to delegate) |
| Kick / promote / demote | Kick + `transfer_crew_leadership` exist | Promote/demote to elder (leader-only); kicking an elder is leader-only |
| War log (public) | `crew_match_history` + "Past scuffles" | The fixture history *is* the war log — surface it on the Sounder's public standings row, always public |
| Clan chat | — | **Cut for now** (decided 2026-07-05). Blessings, the Chorus, and the fixture rendezvous carry the coordination signal; revisit with real usage data |
| Donations | Blessings/trades to crewmates feed Spirit | No new system — the analog exists and is counted |
| Clan XP / level / perks | — | **Sounder level** from fixtures answered + choruses rung; perks expression-only (crest variants, banner trim). Future-season texture |
| Clan leaderboards | `sounder_standings` global 50 by Spirit | The league table (this spec) + a "Friends' Sounders" filter via `friends_crews()`. No geo — TTP has no locations |
| Clan War Leagues | — | The war-term/round-robin system above *is* CWL, adapted |

## What each Alignment surface becomes

- **Leaderboard `sounders` scope** (`components/Leaderboard.tsx`): rows become table rows — position, crest, name, **ribbons** as the big number; subline `W–L · N snouts · X kind · Y fierce`. Remove the S0 two-sided alignment rendering path once the flag flips for good.
- **`app/clan-ladder.tsx`** → the **Sounder League** screen: tabs become **Table** (default: ribbons-ranked, subline `W–L · fixtures · mud ±X`, "new banner" while provisional, tap-to-expand rosters stay) and **Spirit** (the kindness board stays, celebrated but second). The raw Elo tab dies — the rating *is* the ribbons now, worn openly.
- **Season-tab placard** (`app/(tabs)/season.tsx`, the S0 Greedy◄─►Generous bar): becomes the **Sounder placard** — crest, name, record, table position, and the load-bearing line: *"This term: vs ⟨crest⟩ The Mud Maulers · 3 days left."* A scheduled opponent is the season tab's heartbeat. Tap → Sounder League screen.
- **UserSheet:** gains "rides with ⟨crest⟩ ⟨Sounder⟩ · 4th in the league" under the existing alignment dial (`AlignmentBar`/`AlignmentEmblem` stay — the dial survives S1).
- **`JudgementDayModal` pattern** → season-end table modal (same finale RPC/modal shape, new copy + art).

## Data model sketch

- `league_seasons(key, starts_at, ends_at)` (`ends_at` NULLable — this season's end is unannounced); `war_terms(id, season_key, term_no, starts_at, ends_at)`; `term_fixtures(term_id, crew_a, crew_b, war_id → mud_wars, result CHECK ('a','b','unanswered') NULL until resolved)`.
- Fixture results write **inside `resolve_war`/`forfeit_war`** — no client-callable scoring path, same closed-economy stance as `mint_truffles`. The no-draws tie rule (first-to-the-score) lives in `resolve_war`.
- `advance_war_term()` — service-role, idempotent, weekly pg_cron: closes the ending term (marks unanswered fixtures), generates the next term's pairings (prefer-unplayed, then least-recently-played rematches; ghost-crew bye).
- `sounder_league_standings(p_season)` — the table RPC (points, record, tiebreak fields, Spirit, roster). **Naming footgun:** the hidden referral feature already owns `sounder_leaderboard`; do not reuse.
- `crews`: `crest_id text`, `motto text`, `join_type CHECK ('open','invite_only','closed') DEFAULT 'open'`; `crew_members.role` CHECK widens to `('leader','elder','member')`; `CREW_CAP` 5 → 4 in the trigger + `utils/mudWars.ts`.
- New/changed RPCs: `request_to_join_crew` / `respond_join_request`, `set_crew_profile`, `promote_crew_member` / `demote_crew_member`, `finalize_league_season(season_key)`.
- Migration filenames must sort after the latest applied (`20260706…` taken through `…600000`).

## Charter check (the five questions)

1. **Pillar:** Cooperate (the ranked thing is answering your herd's fixtures together) + Connect (a named opponent and a term clock are a reason to rally your crew this week; crests/mottos make Sounders public identity) + Collect (placement cosmetics and titles, earned never bought).
2. **Cozy, not grindy:** one fixture per term is a rendezvous, not a chore-list; unanswered fixtures score 0 without deductions; the completion reward celebrates showing up, not just winning; yields stay dignified.
3. **Respects the player:** rewards earn-only and audit-enforced; founding cost is a speed bump, not a paywall; nothing on the table is purchasable.
4. **Honest about feelings:** match records are competition numbers and live on boards, like tickle counts always have; Rosie and the Barn stay number-free.
5. **Fair social loop:** results mint only inside `resolve_war` server-side; the schedule (not matchmaking) decides opponents, so there's nothing to snipe; byes go to the ghost crew; Spirit as final tiebreak keeps kindness load-bearing.

The tension worth naming: the charter says "we'd rather a player feel invited than ranked." A league table is ranking — but it ranks herds, not pigs; the fixture list is really an *invitation machine* ("we play the Trough Loyalists this week — be there"); and the completion stamp honors every Sounder that kept every date.

## Rollout

1. **Phase 1 — the league (S1 flip):** cap 5→4, `war_terms` + fixtures + `advance_war_term` cron, scoring in `resolve_war`, `sounder_league_standings`, Table/Spirit tabs, Leaderboard scope rows, Sounder placard on the season tab. Season-finale RPC in place.
2. **Phase 2 — clan profile:** crest / motto / join types + requests, elder role, founding cost, war log on the public row.
3. **Phase 3 — future seasons:** groups of ≤8 when the population demands, then divisions with promotion/relegation; strict all-play-all season shape; Sounder level + expression perks.

## Resolved decisions (2026-07-05 / -06)

All open questions from the draft were settled in review: crew cap **4**; terms are **weekly** with rematches allowed this season (strict round-robin deferred to later seasons); **no draws** on the table (activity tiebreak in the fixture trigger); rewards **cosmetics + snouts only**; **no Trough Board** for now; **season end date hidden** in the UI.

**2026-07-06 — the table ranks by Prize Ribbons, not raw wins.** Founder call ("it's not just wins, it's trophies — make it an Elo system, pig-themed"): the existing crew Elo is rebased to a 200-start/0-floor trophy scale and becomes the celebrated number; W–L demotes to the record subline. Migration `20260708000000_sounder_ribbons.sql`.

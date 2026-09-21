# The Season page, rewritten — no herd race, a Monday drum of lotto balls (spec, 2026-09-21)

> Status: **built 2026-09-21** (client on `main`; migration `20260921150000_drum_draw.sql` authored and harness-validated, **not pushed** — the founder's go). Originally a proposal from the same day's brief. Founder brief (2026-09-21): raising a Wallow rank seems to get stuck; the Season page is crowded, hard to read, has too many moving parts; it should be simpler and more deterministic. Three orders: (1) remove the herd race entirely; (2) Monday's randomization scales with digging — the more you dig, the more lotto balls you hold; (3) nothing about the randomization references the Sounder or any group.
>
> Resolved 2026-09-21 (the four questions at the end, answered at the founder's request; rationale in §8): **no Sounder door on the page · the drum pays tickles only · best-of-N · one dig number, the drum's.**
>
> Charter note: this retires the current reading of **Contend** in `SKILL.md` ("gives the herd a race to run — together"). Under this spec Contend is **the drum**: every snout's own week of digging against the odds, printed before Monday, no other pig in the formula. A `SKILL.md` decision-log entry is drafted at the end of this document and is appended only when this spec is accepted.

## One sentence

**Dig during the week, and every dig drops a ball in Monday's drum; on Monday the drum turns once for you, and the more balls you hold the better your purse tends to be — nobody else's week changes yours.**

## 1 · The page

The Almanac keeps its shape (`PageHeader` + a verb strip + one panel at a time, `docs/design/season-almanac-2026-09-16/SPEC.md`), but the strip goes from four cells to **three**, and every panel loses its group-shaped parts.

| cell | value it prints | gold (act-now) when | panel |
| --- | --- | --- | --- |
| **Feed** | `closes in 2h 9m` / `opens in 5h` / `Dug` | the patch is open and you haven't dug | the Hungerer hero, the stage meter, the one dig CTA, **the ball counter** (`3 balls this week · +1 if you dig now`) |
| **Draw** | `7 balls` (this week's count) / `Ready` (Monday's purse waits) / `Drawn · 60` | a purse is drawable and undrawn | the drum: this week's balls with the printed odds, last week's result or the draw button, when the drum next turns |
| **Pass** | `Tier 7` / `1 ready` | a tier is claimable, or the Wallow is ready | unchanged: three ladder rows, "See all tiers", weekly quests, the Wallow card, the Mote Machine card behind its flag |

One-hero rule (`utils/seasonHero.ts`) shrinks to three surfaces: `dig > claim > draw > browse` (`feeding | claim | draw | hunger`). The `join` branch and the `sounder` surface leave the page; `seasonPrimaryAction` loses `inCrew`.

**Header.** Unchanged (`day N of M · the Hungerer is <stage>`, the Hungerer sprite). The stage meter stays cooperative in fiction — every pig's finds starve him — but the page never says which pigs.

**Gone from the page.** The Herd cell and `HerdPanel` (roster rows, "Oink at the herd", `JoinableSounders`, the `SounderStepCard` funnel); the Race cell and `RacePanel` (the weekly Dig-Off board, the Monday spoils ladder, the herd-prize door, the "race is run" beat); the Feed panel's this-feeding avatar row (`useHerdFeeding` → `race_crew_detail`); the season-cumulative board; `SpoilsShowcase`; the Alignment placard's Season-0 path is untouched (it is not on this page in Season 1).

**Where the Sounder still lives.** Nowhere on this page — not a cell, not a row, not a one-line door (resolved, §8 Q1). The Friends tab's Sounder segment (roster, oink, join, leave, invites) is not this spec's subject and stays. The one Sounder-shaped fact that keeps touching the dig is invisible: crewed pigs still receive the same base board per window (`docs/specs/08-seeded-crew-boards.md`). Nothing on the Season page and nothing in the draw reads it.

## 2 · The drum — Monday's randomization

### Balls

- **One ball per dug feeding.** A dig is one `rooting_receipts` row (every submitted dig, since 2026-09-13; one per `(user, window_index)`, so one per feeding at most). What the dig found is irrelevant: a tied-off topsoil with nothing loose is a ball; an abandoned board with no submit is not. Practice digs never reach the server and never mint a ball.
- **No other source.** Not Troughs, not visits, not blessings, not membership, not rank, not the herd. The formula is `balls = digs this week`, and the page says it in those words.
- **The week.** Monday 00:00 UTC to the next Monday 00:00 UTC. The race's `race_cycle_at` was the clock; the draw gets its own copy, `draw_week_at(p_at)` (same math, owned by the draw, so the race can be dropped). A receipt belongs to the week its `created_at` falls in.
- **Cap.** `min(digs, my_windows_in_week)`. Feedings are player-local (`user_feeding_cycle_zones`, 2026-09-13), so the cap is **the snout's own** expected windows for the week — `user_draw_week_feeding_windows(user, week)`, the renamed `user_race_cycle_feeding_windows` — which is **21** on the default schedule (8h feedings, three a day). Derived from the live schedule, never a bare constant; a schedule change mid-week never truncates balls already minted.
- **The one dig number** (resolved, §8 Q4). The drum's `n of 21` is the week's only dig counter on the page and in the data. There is no "dig N feedings" weekly bounty to fold (the pool is `generous_hoof … curse_distinct`; none counts digs), so nothing is retired there. The one other weekly dig reader, the **`every_last_feeding` achievement** (`award_perfect_feeding_week`), today counts `race_digs` joined to non-bot crews on the race cycle; it is re-pointed to *balls == cap* on the draw week, so a perfect week is exactly a full drum, and the drum panel says so (`21 of 21 · every last feeding`).
- **Printed live.** `monday_draw_state()` returns `balls` for the running week and the drawable week; the client never counts locally. After a submitted dig the Feed panel may show `+1` optimistically until the next read.

### The turn

The drum pays **tickles only** (resolved, §8 Q2). Furnishings keep their two lanes — bought in the shop, or the Trough giver's weekly reward — and never ride the drum. The purse tiers stay exactly as tuned in `app_settings.monday_draw` (placeholders today):

| tier | tickles | base weight |
| --- | --- | --- |
| common | 20 | 60 |
| good | 60 | 28 |
| rare | 150 | 10 |
| jackpot | 400 | 2 |

**Model: best of N** (resolved, §8 Q3). On Monday the server rolls the tier table once **per ball** and pays the **best** tier rolled. Every ball is an independent draw of the same wheel; you keep the highest. That is the whole mechanism. The alternative — keeping `_monday_draw_multiplier` and scaling the rare + jackpot weights by balls — is not taken: it needs a cap and a step to tune, its odds line is a formula nobody can check in their head, and it is the pity machinery under a new name.

- With `p` = the base chance of rare-or-better per ball (12 / 100 today), the chance for `n` balls is `1 − (1 − p)^n`. Printed as `1 in N` where `N = round(1 / (1 − (1 − p)^n))`.
- The client mirror (`utils/mondayDraw.ts oddsOneIn(balls)`) and the server (`_monday_draw_odds_one_in(p_balls)`) compute the same closed form from the same tuning row, so the sheet can never quote odds the server won't honour.

Odds at today's placeholder weights:

| balls | rare-or-better | jackpot | note |
| --- | --- | --- | --- |
| 1 | 12 % (1 in 8) | 2 % | one dig, one spin |
| 3 | 32 % (1 in 3) | 6 % | a dig a day |
| 7 | 59 % | 13 % | one a day, every day |
| 14 | 83 % | 25 % | two a day |
| 21 | 93 % | 35 % | every feeding |

Tuning lives entirely in the row; if 21 balls should not reach a 35 % jackpot, the weights move, not the model. Expected purse per week rises monotonically with digs, which is order (2) exactly.

**What leaves the formula.** The catch-up streak (`mondays_since_rare`, `_monday_draw_streak_before`) and the herd bottom-half step (`_monday_draw_herd_bottom_half`, the join through `race_digs` → `_race_table`) are both removed. The first is a hidden moving part that made the same week draw differently for two pigs with the same digs; the second is the Sounder in the formula. If a pity floor is wanted later it is a **ball**, not a multiplier (e.g. "a rare-less Monday adds one ball to next week"), so it stays visible in the same counter. Not in this spec.

### Eligibility, claiming, lapsing

- `balls ≥ 1` in the ended week ⇒ a purse exists for that week; `balls = 0` ⇒ no purse, no row. The sheet for a ball-less week reads as an invitation ("dig once this week and you're in Monday's drum"), never as a loss.
- The purse is **drawable all the following week** (opening the app Wednesday is fine); after that it lapses with no back-pay, and the sheet only ever shows the current drawable week.
- `draw_monday_purse()` stays: one row per `(user, iso_week)`, per-user lock, server-side random, minted through `apply_tickles`, re-call returns the stored draw. It now records `balls` on the row.
- The reveal lives inside `MondayDrawSheet` (the purse disc; `DrawRevealSheet` is the Barn's shared *furnishing* reveal and stays with the Trough reward) and animates the drum: the balls drop, one comes up, the tier and amount land. The result is written before the animation starts, so a killed app re-opens onto the receipt.

### Determinism, stated for the player

The Draw panel prints three lines and nothing else moving: **`7 balls this week`** · **`rare or better: 1 in 2`** · **`the drum turns Monday 00:00 UTC (in 2d 5h)`**. The first two are pure functions of your own digs and the tuning row; the third is a clock. No standings, no other pigs, no herd flag, no streak.

## 3 · What happens when the Wallow rank changes

The brief's first pain is "when I raise my Wallow rank, it seems to get stuck." The survey of the current build found four ways a rank-up can look stuck without any server failure, and this spec closes each.

| symptom | cause today | rule in this spec |
| --- | --- | --- |
| The Season page's Wallow card keeps the old before/after | `handleWallow` (`app/(tabs)/season.tsx:1306`) awaits a separate `load()`; a stale `wallow_tuning` config cell (60 s throttle) prints old intervals | `wallow()` returns the complete post-state (`season_state` + `wallow_regen_seconds` + `wallow_count`) and the client **replaces** state from that return; the tuning cell is refreshed in the same call |
| The Me tab's rank row lags | `Account.tsx:442` reads `profiles.wallow_count` in its own focus effect | one source: `useSeason`'s state carries `wallow_count`; the Me row reads the same hook; `profiles.wallow_count` is the only number shown anywhere (the season-local `user_season_progress.wallow_count` is server bookkeeping and never rendered) |
| A claim after wallowing fails silently | claims send `expected_wallow_lap` from stale state → `pass_changed`, refreshed on that one reason only | every `pass_changed` and `claim_rewards_first` response re-syncs state, and the claim bar shows "the pass turned — tap again" |
| The rank-up gift never appears | `HabitatGiftReveal` renders only when `isFocused && wallowGiftAccount === uid && claimAllSummary === null && habitatJournal.supported` | the reveal is a **popup-queue slot** with one condition: a pending, unseen gift for this account (server flag, cleared on seen). It queues behind whatever is presented and fires when the page is quiet — never dropped |

**Rank and the drum.** A rank change never touches balls, odds, or the purse: rank is not in the formula, a Wallow mid-week does not reset the drum, and the Wallow reveal and the draw reveal are two queued popups with priorities (`draw` below `wallow`), never presented in the same commit (the popup queue's handoff gap applies).

## 4 · What is removed

**UI (client).** `components/season1/almanac/RacePanel.tsx`, `useRaceRun.ts` (+ the `race_seen` AsyncStorage key), `HerdPanel` and `useHerdFeeding.ts`'s `race_crew_detail` read, the `herd` and `race` members of `ALMANAC_TABS` with their `almanacValues` / `almanacTodo` branches and `AlmanacFacts.inCrew / dugCount / herdSize / raceRank / raceRun`, `components/season1/RaceSection.tsx`, `SpoilsShowcase.tsx`, `SounderHomeCard.tsx` (dead already), `app/race-standings.tsx`, `hooks/useRace.ts`, `utils/race.ts`, `hooks/useHerdPrize.ts`, `utils/barnDraw.ts`'s herd-prize half and `BarnRewardClaimSheet`'s herd-prize branch, `constants/dig.ts` `RACE_TRUFFLE_TABLE` + the quorum note, the race art in `utils/rewardArt.ts`, the `seasonHero` `join` branch and `sounder` surface, the Season guide's race pages (`SeasonGuideModal`), the "Race: Run" / bunting copy in `constants/release_notes.ts` is history and stays.

**Server (rewritten, not removed).** `award_perfect_feeding_week(p_cycle)` → reads `rooting_receipts` against `user_draw_week_feeding_windows` (no `race_digs`, no `crews` join — a crewless snout can earn it); `user_race_cycle_feeding_windows` → `user_draw_week_feeding_windows`, on `draw_week_at`.

**Server.** Tables `race_digs`, `cycle_payouts`, `cycle_notices`, `race_podium_queue`, `dig_offs`, `dig_off_digs`, `digoff_queue`, `herd_prize_seeds`, `herd_prize_draws`; functions `race_cycle_at`, `race_current_cycle`, `_race_table`, `_race_truffles_for_rank`, `race_standings`, `_race_pay_cycle`, `sweep_race`, `race_crew_detail`, `_herd_prize_resolve`, `herd_prize_state`, `_monday_draw_streak_before`, `_monday_draw_herd_bottom_half`, `_monday_draw_multiplier`; pg_cron jobs `race-sweep` and `digoff-sweep`; the race and herd-prize announcements (`20260767…`, `20260793…`, `20260917120000`); `submit_rooting*`'s `race_digs` insert; `_monday_draw_eligible`'s `race_digs` fallback. Golden Truffle and bunting payouts that rode `_race_pay_cycle` end with it (bunting already owned stays owned).

**Config.** `app_settings.monday_draw.catchup` (all four keys); `app_settings.barn_draw`'s herd-prize keys; the race's tuning rows. The Sounder League migration (`20260707000000`) and its cron are a separate legacy and are listed for a follow-up audit, not removed here.

**Notifications.** Race resolved / podium / spoils pushes and the herd-prize push retire. One Monday push remains, sent only to snouts with `balls ≥ 1`: *the drum turned — N balls in, see what you drew.* Its `screen` is `season`.

**Data kept on disk, not read.** Historic `monday_draws` rows keep their `mondays_since_rare_before` / `herd_bottom_half` columns as inert history; new rows write `balls`.

## 5 · What remains

- The Great Hunger arc, the header, the stage meter, and every Feed mechanic (`useFeedingCta`, Snout Deep, the classic patch, receipts, the feeding schedule from server config).
- The Monday tickle draw as a system: `app_settings.monday_draw` (tiers + weights; the `catchup` key removed), `monday_draws` (+ `balls`, `cap`, `rolls`), `monday_draw_state()`, `draw_monday_purse()`, `MondayDrawSheet`, `hooks/useMondayDraw.ts`, `utils/mondayDraw.ts`, `almanac/DrawPanel.tsx`. `DrawRevealSheet` stays as the Barn's furnishing reveal.
- The Pass panel whole: the ladder, claims, weekly quests (`my_weekly_bounties`), the Wallow (`wallow()`, the Prestige Path, the gifts and keepsakes — the *content* of a rank is the subject of `docs/design/2026-09-21-wallow-rethink.md`, not this spec), the Mote Machine card behind `MOTE_MACHINE_VISIBLE`.
- The Trough giver's weekly reward (`_barn_draw_pick`, the quarter rule) — it never touched the crew. It stays the only random furnishing lane.
- The `every_last_feeding` achievement, on the drum's count.
- The Sounder itself on the Friends tab, seeded shared boards, the Sounder Bonus on the dig. Out of scope here; nothing on the Season page references them.

## 6 · Edge cases

1. **Counting balls.** `balls(user, week) = min(cap, count(rooting_receipts where user_id = u and created_at ∈ [week.starts, week.ends)))`. `rooting_receipts` is unique per `(user, window_index)`, so a replayed or retried submit cannot double-count. `cap = count(user_draw_week_feeding_windows(u, week))` — the snout's own windows in their feeding time zone, computed at the week's open.
2. **A window straddling Monday.** The receipt's `created_at` decides the week. The Feed panel's `+1 if you dig now` uses the same clock, so a dig at 23:50 UTC Sunday shows as this week's ball, and one at 00:10 Monday as next week's.
3. **Schedule or time-zone shift mid-week.** The cap for a week is computed once at the week's open and stored with the draw row; balls already minted are never cut. The client prints `n of 21` only from the server's `cap` field. A snout whose zone change *adds* windows can dig them; the perfect-week test uses the stored cap.
4. **Zero balls.** No purse, no row, no push. The Draw cell prints `0 balls`; the panel is the invitation.
5. **Late claim.** Drawable until the next Monday 00:00 UTC; then gone. The reveal never shows two weeks; `drawn` for a lapsed week is neither true nor false — the week is simply not returned.
6. **Concurrent draws.** Per-user advisory lock inside `draw_monday_purse()`; the second caller reads the first's row. Two devices see the same receipt.
7. **A killed reveal.** The row is written before the animation; reopening shows the receipt title (`60 tickles, pocketed.`), the existing sheet's behaviour.
8. **Rank changes mid-week.** No effect on balls or odds (rank is not an input). The Wallow gift reveal and the draw reveal are two queue slots; a wallow and a Monday on the same day present in priority order with the handoff gap between.
9. **Rank-up during a claim.** `pass_changed` re-syncs and re-prompts; it is never swallowed.
10. **Rank-up appears stuck.** The `wallow()` return is the state; if the RPC fails the client keeps the pre-state and shows the failure reason (`claim_rewards_first` → "claim your ready tiers first", `not_ready` → the XP left). There is no path where the button is spent and nothing moves.
11. **The first Monday after ship.** Receipts already exist for the running week (since 2026-09-13), so the first turn of the drum pays on real digs. The ended week's `race_digs`-only digs (pre-receipt, before 2026-09-13) are older than any drawable week and need no fallback.
12. **A snout who leaves or joins a Sounder.** Nothing changes; the draw and the page never read membership. The shared-board seed follows crew membership at open, as today.
13. **Tuning changes.** A weights change applies to draws after the change; the printed odds re-read the row on the next `monday_draw_state()`. Balls are never tuned retroactively.
14. **Bots and test accounts.** `is_test` profiles draw like anyone; bot crews had no snouts of their own and vanish with the race.
15. **Dynamic Type / small phones.** Three cells instead of four gives the strip room at 200 % type on the SE; the drum panel is three lines and one button, so it fits the one-screen rule the Almanac spec set.

## 7 · Migration order

1. Ship the client that never renders Herd/Race and reads `balls` when present (tolerates its absence: prints the old odds line until the server lands).
2. **The last race week is not settled** (founder's call, 2026-09-21: "make sure nobody wins the race this week"). Unscheduling `race-sweep` ends `_race_pay_cycle` and `_herd_prize_resolve`, and the migration also replaces `sweep_race()` / `sweep_digoffs()` with no-ops so a stray call cannot pay the week either. The running cycle simply ends unpaid.
3. Push one migration (`20260921150000_drum_draw.sql`, harness-validated 2026-09-21): `draw_week_at`, `balls` / `cap` / `rolls` on `monday_draws`, the new `_monday_draw_odds_one_in(p_balls)`, `monday_draw_state()` + `draw_monday_purse()` rewritten to best-of-N, the crew and streak functions dropped, the race crons unscheduled, the race announcements retired with them, the perfect-week award re-pointed and on its own cron, the Monday drum push on its own cron. One seam the removal exposed: the only writer of `user_feeding_cycle_zones` (the per-player window slate the cap needs) was a trigger on `race_digs` that never fired for uncrewed diggers; the migration adds the same fail-soft capture on `rooting_receipts`, backfills existing receipts, and falls back to the live zone when no snapshot exists. Carry-latest-def rule applies to every `CREATE OR REPLACE` (the 2026-09 footgun); the two real `race_digs` writers were `_submit_rooting_reward_v1` and `_submit_rooting_deep_core`.
4. A second, later migration drops the race and herd-prize tables (and `_race_pay_cycle`, `_herd_prize_resolve`, the dead `user_race_cycle_feeding_windows`) once a week of `monday_draws.balls` rows exists and no shipped binary still calls the stub RPCs.
5. Flip nothing: there is no flag; the page is the build. Purses drawn before the push read `balls 0 · cap 0` in their receipt (history only).

## 8 · Resolved questions (2026-09-21)

Answered by Claude at the founder's request; each answer is applied above.

1. **Does the Sounder keep a door on the Season page?** **No.** The brief says the Sounder is conceptually gone from this page; a door is one more moving part that points at a concept the page no longer explains, and the Friends tab already owns the roster, oinks and joining. A newcomer reads three verbs and none of them asks them to belong to anything first.
2. **Tickles only, or a furnishing on the jackpot?** **Tickles only.** A furnishing prize drags in ownership re-rolls, a "you own the whole pool" fallback and a rotating collection — the moving parts the per-crew prize needed. One currency keeps the odds table one table and keeps the shop as the way a collection gets finished; the Trough reward already gives furnishings a random lane that never touches the crew.
3. **Best-of-N or a balls-scaled multiplier?** **Best-of-N.** It is the lotto the brief asked for, literally: each ball a spin, keep the best. Its odds are one closed form a player can check (`1 − (1 − p)^n`), it rises with every dig with no cap to tune, and it drops the multiplier/pity code instead of renaming it.
4. **Fold the "dig N feedings" quest into the drum's counter?** **One number, yes — and the premise was wrong.** No such weekly bounty exists (the pool counts blessings, curses, trades and visits, never digs), so nothing folds. The one weekly dig reader that does exist, the `every_last_feeding` achievement, is re-pointed from the race tables to the drum: a perfect week is a full drum, and the page prints one dig count.

## Draft decision-log entry for `SKILL.md` (append on acceptance)

- **2026-09-21 — The herd race retires; Contend is the drum.** The Season page keeps three verbs — Feed · Draw · Pass — and drops Herd and Race. Monday's purse is drawn from a drum of lotto balls, one ball per submitted dig that week (cap = the schedule's windows, 21 today), best-of-N over the same tier table, tickles only; no streak, no herd flag, no rank, no other pig in the formula. The odds are printed before Monday from the player's own count, which is also the page's one dig number (the perfect-week achievement reads it). The per-crew herd prize retires with the race; the Sounder keeps no door on the page. Serves **Contend** (a week you can win by digging, legible to the number) and **comprehension** (three lines that move, all yours); the Sounder stays a Connect surface on the Friends tab. Spec: `docs/design/2026-09-21-season-page-rewrite.md`.

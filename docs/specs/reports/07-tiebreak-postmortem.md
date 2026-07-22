# Spec 07 — Season-1 tiebreak post-mortem (GH #28)

**Status: RESOLVED — the correct tiebreak fired. No retroactive re-rank needed.**
Verification date: 2026-07-16. Read-only; no prod writes, no `db push`, no code
change.

## Bottom line

The feared "arbitrary UUID tiebreak" **did not happen**. Season-0's finale ran
with the **Most-Tickles** rule from PR #27 (`20260708300000`). The 9-way pack
tied at **+100** was split into the top-3 (halo_bearer, 500 snouts) and top-10
(gilded, 250 snouts) brackets **strictly by tickles earned**, on merit — not by
raw `id`. Issue #28 can be closed as resolved.

## Prod read lane

A non-interactive read lane exists and was used:
`npx supabase db query --linked "<SELECT>"` — routes through the **Management
API** using the CLI's cached access token (no DB password, no service-role key
required; psql is not installed). It is documented across the repo
(`scripts/simulate_rosie_vip.sql` header, multiple `docs/builds/*.md`). Every
query below was a plain `SELECT` / `pg_get_functiondef` — read-only.

## Verification queries & findings

### 1. `cron.job` — the judgement-day row
One live judgement job: **jobid 11, `judgement-day-season-0`**, command
`SELECT public.run_judgement_day_season0()`, schedule `0 0 12 7 *`
(00:00 UTC **Jul 12**). It targets the **season-0** function (not `season_1`) —
consistent with the `20260709` renumber lineage. No `season_1` judgement job and
no `run_judgement_day_season1` function exist.

### 2. `cron.job_run_details` — the actual run
**jobid 11 has ZERO run history.** No judgement-day job has ever fired via cron
(the only jobids that have ever run are 1, 4, 5, 7, 9, 10). Yet the finale *did*
happen (see #3), at **2026-07-12 00:10:39 UTC** — ~10 min after the 00:00 slot
and with no matching cron run. Most consistent with a **manual invocation** of
`run_judgement_day_season0()` / `finalize_season('season_0')` that night, not the
scheduled job. Either way the effect is identical; the tiebreak logic is the
same code path.

### 3. `season_finales` — the ±100 bracket ordering (the crux)
44 rows, all `season_key = 'season_0'`, all `finalized_at = 2026-07-12
00:10:39 UTC`. A **real 9-player tie at +100** existed (generous side,
side_rank 1–9): ranks 1–3 → `halo_bearer_2026` / top3 / 500 snouts; ranks 4–9 →
`gilded_2026` / top10 / 250 snouts; rank 10 dropped to score 98. So the tie had
a real reward consequence — the issue was **not** moot.

**The split followed tickles earned exactly.** Caveat that mattered:
`run_judgement_day_season0` *zeroes* `tickles_earned` after the finale (folding
it into `tickles_lifetime_base`), so `profiles.tickles_earned` read today is
post-reset re-accumulation and is **not** the tiebreak basis. The finale-time
counts were archived in `season0_tickle_standings`. Compared against those, the
recorded `side_rank` is a perfect match to `tickles_earned DESC`:

| side_rank | finale-time tickles | bracket |
|-----------|--------------------|---------|
| 1 | 4132 | top3 (500) |
| 2 | 4058 | top3 (500) |
| 3 | 3788 | top3 (500) |
| 4 | 3481 | top10 (250) |
| 5 | 3212 | top10 (250) |
| 6 | 3209 | top10 (250) |
| 7 | 3001 | top10 (250) |
| 8 | 2809 | top10 (250) |
| 9 | 2513 | top10 (250) |

Strictly monotonic — the `tickles_earned DESC` tiebreak from PR #27 was applied.
The greedy side's top-3 tie (two players at score −2, `goblin_king_2026`) is
also in tickles-DESC order (192 > 172). (Minor, immaterial: a gap at generous
side_rank 18 — one row absent between 17 and 19 — does not affect the ±100
brackets.)

### 4. Live function bodies (`pg_get_functiondef`)
`finalize_season` and `alignment_leaderboard` both currently order by
`alignment_score {DESC|ASC}, tickles_earned DESC, p.id` — an **exact match** to
`20260708300000` (PR #27). No out-of-repo hotfix or drift.
`run_judgement_day_season0` wraps `finalize_season('season_0')` +
`grant_beta_rewards()` + the tickle-board graduation. Migration
`20260708300000_leaderboard_tiebreak_most_tickles` is present in
`schema_migrations`.

## Repo vs prod discrepancies
- **None material.** Live code matches the repo's intended tiebreak.
- The scheduled cron (jobid 11) shows no run for the finale that clearly did
  occur — the finale was almost certainly triggered manually. Worth knowing for
  future seasons: don't rely on that job having auto-fired.
- The live schedule is `0 0 12 7 *` (Jul 12), not the Jul 13 the original issue
  cited — a product of the renumber + later reschedule migrations.

## Recommended disposition
**Close #28 as resolved.** The founder's chosen rule (Most Tickles / PR #27) was
live and correctly applied before the finale ran; the +100 pack was ranked on
merit. **No retroactive re-rank is warranted** — and per this spec that call is
the founder's, not this task's. This report acts, and STOPS.

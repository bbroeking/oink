# Spec 07 — Season-1 tiebreak post-mortem (GH #28): verify → report → PAUSE

**Source:** GitHub issue #28. **This spec produces a REPORT, not a code
change.** Absolutely no prod writes, no `db push`. Output:
`docs/specs/reports/07-tiebreak-postmortem.md` + a summary comment posted to
issue #28 via `gh issue comment` (do not close the issue — the founder
decides).

## What is already known (from repo archaeology, 2026-07-16)

The feared "arbitrary UUID tiebreak" was fixed BEFORE the cron fired —
`supabase/migrations/20260708300000_leaderboard_tiebreak_most_tickles.sql`
(merged via PR #27) is the latest `finalize_season`/`alignment_leaderboard`
definition: `ORDER BY alignment_score, tickles_earned DESC, id`. Cron
lineage: `20260704500000` scheduled `judgement-day-season-1` at 00:00 UTC
Jul 13 → `20260709000000_season_renumber.sql:113-120` unscheduled it and
scheduled `judgement-day-season-0` (same time) → `20260726000000` later
rescheduled it again. The open question is purely WHAT RAN IN PROD on
Jul 13.

## Verification steps (read-only)

Prod access: use the repo's established read lane (check how other sessions
query prod — e.g. `npx supabase` link or a psql read connection documented
in scripts/; if NO read path is available without credentials, STOP and
report that instead of guessing).

1. `cron.job` — the judgement-day row(s): confirm schedule + command that
   were live (season_0 vs season_1 function).
2. `cron.job_run_details` — the Jul-13 00:00 UTC run: status,
   return_message.
3. `season_finales` — spot-check the +100/−100 bracket ordering: did equal
   alignment scores rank by `tickles_earned DESC` (expected) — sample a few
   tied pairs.
4. Live function bodies (`pg_get_functiondef`) for `finalize_season` /
   `run_judgement_day_season0` — confirm they match `20260708300000` (no
   out-of-repo hotfix).

## Report contents

What ran, what tiebreak applied, whether any real player pair was affected
by a tie at all (if zero ties existed, say so — the issue may be moot),
any discrepancy between repo and prod, and a recommended disposition for
issue #28 (close as resolved / needs founder call). Then STOP — any
retroactive re-rank is the founder's decision, not this spec's.

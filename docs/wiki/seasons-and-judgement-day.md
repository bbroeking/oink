---
title: Seasons & Judgement Day
aliases: [judgement-day, finale, season-finale, finalize-season, season-1]
tags: [system, season, competitive, cron, destructive]
status: stable
sources:
  - sql: supabase/migrations/20260526000000_finale.sql
  - sql: supabase/migrations/20260579000000_judgement_day_cron.sql
  - doc: docs/season-1-implementation-log.md
last_compiled: 2026-06-13
---

# Seasons & Judgement Day

Judgement Day is the season finale: a single RPC, `finalize_season`, ranks every player by [[alignment]], hands out tiered titles + snouts, records the verdict, then wipes everyone's alignment back to 0 for the next season.

## How it works

`finalize_season(season_key default 'season_0')` loops over every named profile and buckets each by `alignment_score` sign — `generous` (>0), `greedy` (<0), or `neutral` (0). Within each side a `ROW_NUMBER()` window assigns `side_rank` (generous ranked by score DESC, greedy by score ASC) (`supabase/migrations/20260526000000_finale.sql`).

Rewards by bracket (same file):

- **top3** (`side_rank ≤ 3`): `halo_bearer_2026` (generous) / `goblin_king_2026` (greedy) title + **500 snouts**.
- **top10** (`side_rank ≤ 10`): `gilded_2026` title + **250 snouts**.
- **participant** (anyone else who picked a side): `schism_survivor` title + **100 snouts**.
- **neutral** (score 0): `calm_in_the_storm` title + **100 snouts**.

Each player's outcome is written to `season_finales` keyed by `(user_id, season_key)`; the title goes into `user_titles` and snouts are added to `profiles.counter`. The whole thing is **idempotent per `season_key`** — the insert is `ON CONFLICT (user_id, season_key) DO NOTHING`, and only rows that actually inserted (`IF FOUND`) get titles/snouts, so a re-fire is a safe no-op. Finally it does the destructive part: `UPDATE profiles SET alignment_score = 0` for everyone, resetting the season. The function is `SECURITY DEFINER` and **not granted to `authenticated`** — only service_role / SQL console can fire it.

The client never calls `finalize_season`. Instead `my_finale_result()` (granted to authenticated) returns the caller's latest unseen `season_finales` row so `JudgementDayModal` can show the verdict; `mark_finale_seen(season_key)` stamps `seen_at`.

**Automated, not manual.** First scheduled by `supabase/migrations/20260579000000_judgement_day_cron.sql` (noon UTC Jul 15), the job was **rescheduled to `0 0 13 7 *` = 00:00 UTC Jul 13 (8 PM ET Jul 12)** by `20260704500000_judgement_day_beta_grants.sql`, which also coupled it to `grant_beta_rewards()` + the `season1_finale` flag flip, and **renamed to `judgement-day-season-0`** running `run_judgement_day_season0()` (→ `finalize_season('season_0')`) by `20260709000000_season_renumber.sql`. The original migration deliberately does **not** re-run `CREATE EXTENSION pg_cron` (Supabase's after-create hook errors 2BP01 on the existing grant state).

## Key files

- `supabase/migrations/20260526000000_finale.sql` — `season_finales` table, 5 finale titles, `finalize_season`, `my_finale_result`, `mark_finale_seen`.
- `supabase/migrations/20260579000000_judgement_day_cron.sql` — schedules the destructive cron job (superseded schedule/name: see `20260704500000` + `20260709000000`).
- `docs/season-1-implementation-log.md` — Phase 4 build notes (Phase 4 still calls the cron "deferred"; the cron migration superseded that).
- `components/JudgementDayModal.tsx` — reads `my_finale_result`, renders the verdict.

## Connects to

- [[alignment]] — the score this finale ranks on and then wipes to 0.
- [[achievements-and-titles]] — finale rewards are `source='season'` titles in the shared title system.
- [[snouts-economy]] — bracket rewards add 100–500 snouts to `profiles.counter`.
- [[blessings-curses-effects]] — the rituals that move alignment during the season decide your bracket.
- [[world-cup-allegiance]] — the other big seasonal/competitive arc players opt into.
- [[notifications]] — the verdict surfaces via the modal on next foreground, not a push.

## Open questions / risks

- **Destructive + fully automated.** The cron will wipe all alignment at 00:00 UTC Jul 13 with no human in the loop. To cancel: `SELECT cron.unschedule('judgement-day-season-0')`.
- **Stale doc.** `docs/systems-overview.md` "Known gaps" (line 183) and `season-1-implementation-log.md` Phase 4 both still say finalize_season is a manual SQL call with no cron — wrong since the cron migration landed. Should be corrected.
- **Season 1 reuses the schedule.** The cron hardcodes `'season_0'`, so next July it re-fires `finalize_season('season_0')` — idempotent (no-op for already-finalized users), so it will NOT finalize a real Season 1. A future season needs its own job/key.
- **No `seraph_wings` / `cursed_crown` exclusive items** — finale grants titles + snouts only; cosmetic items deferred pending art (`season-1-implementation-log.md`).

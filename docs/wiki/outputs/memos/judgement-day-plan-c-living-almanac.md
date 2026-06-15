---
title: "Judgement Day Plan C — The Living Almanac"
type: plan
date: 2026-06-14
last_compiled: 2026-06-14
tags: [strategy, season, judgement-day, plan, infrastructure]
status: draft
---

# Judgement Day Plan C — The Living Almanac

> Treat the July 15 finale not as a one-off event but as the first instance of a repeatable **season engine** — build the machine (a new `judgement_seasons` table + generalized RPCs + one nightly cron), so Season 2 spins up automatically and there is never dead air. The player's felt moment on July 15 is **identical to Plan A's reveal**; Plan C's whole contribution is that the moment never has to be hand-rebuilt.

## Goal & exit conditions

**Goal.** Replace the hardcoded `finalize_season('season_1')` cron with a table-driven season engine so that (a) the July 15 finale still fires exactly as today, (b) Season 2 auto-starts the same night with a "slate is clean" announcement, and (c) past verdicts become a permanent, scrollable Almanac.

**Definition of done (MVP — the part that must land before July 15):**
1. `judgement_seasons` table exists, seeded with `season_1` (ends 2026-07-15 12:00 UTC) and `season_2` (starts then).
2. `finalize_season(text)` is generalized (no DEFAULT) and stamps `judgement_seasons.finalized_at`.
3. `start_season(text)` exists, fans out a per-user "Season 2 begins" announcement, stamps `started_at`.
4. `run_season_engine()` dispatcher + nightly cron `season-engine-nightly` replaces `judgement-day-season-1`.
5. **Proof gate:** `run_season_engine()` hand-run against a clone with a near-past `ends_at` finalizes correctly and is a no-op on re-run, BEFORE the live cron swap.

**Phase 2 (can land after the finale):** `my_finale_history()` RPC, `utils/seasons.ts`, `AlmanacSheet`, theme-parameterized Verdict Card.

**Owner:** solo dev. **Audience at risk if it breaks:** ~27 beta users (pre-public-launch) — small blast radius, but a botched finale is the single most-anticipated moment of the season, so the proof gate is non-negotiable.

## ⚠️ Two hard groundedness facts that reshape this plan

These were verified against the repo and **invalidate the naive version of this plan**. Read them first.

1. **`public.seasons` is ALREADY TAKEN.** `supabase/migrations/20260502010000_battle_pass.sql` defines `public.seasons` (PK `id text`, columns `name, starts_at, ends_at, total_tiers, xp_per_tier, premium_price_cents, …`) for the **Battle Pass / "Snout Season"** system, with `season_tiers`, `user_season_progress`, `user_tier_claims` FK-chained to it and an `active_season()` RPC. A `CREATE TABLE IF NOT EXISTS public.seasons (season_key …)` would **silently no-op** against that table — the `season_key`/`theme`/`finalized_at` columns would never exist, and every engine RPC would fail. **The new table MUST be named differently** — this plan uses `public.judgement_seasons`. There are now two orthogonal "season" concepts in TTP: *Snout Season* (battle pass progression) and the *Judgement / Goblins-vs-Angels* season (alignment finale). Keep them separate.
2. **`system_announcements` is PER-USER, not a broadcast channel.** `supabase/migrations/20260556000000_system_announcements.sql`: columns are `(id, user_id NOT NULL, kind, title, body, data, dispatched_at, seen_at)` — there is **no broadcast row**. Every announcement is fanned out one row per recipient (see the real INLINE example in `20260623000000_trough_nudge_and_brian_test.sql`). So `start_season` must **loop over named profiles and INSERT one row each** — it cannot insert a single broadcast row. The admin-gated `send_system_announcement()` is still off-limits (it `RAISE EXCEPTION 'admin_only'` unless `profiles.is_test`).

## The arc / rollout — the experience in phases

This plan is deliberately the **infrastructure-heavy sibling**. Plan A ([[judgement-day-plan-a-quiet-reckoning]]) and Plan B ([[judgement-day-plan-b-great-schism]]) are about *what the player feels* on July 15. Plan C is about *what happens on July 16, and every season after*.

- **Build-up (now → July 15).** Nothing player-facing changes. Alignment accrues over the season ([[alignment]]); the schism reveal already fired at ±25. The work here is invisible plumbing: a `judgement_seasons` table, a generalized `finalize_season`/`start_season`, and a single nightly cron that *reads the table* instead of hardcoding `season_1`.
- **The moment (noon UTC, July 15).** The nightly cron sees `season_1.ends_at` has passed and `finalized_at IS NULL` → calls `finalize_season('season_1')` (the same ranking/reward/wipe logic that exists today, generalized). Identical verdict math to Plan A.
- **The reveal (next foreground).** Unchanged. `my_finale_result()` returns the pending row, `JudgementDayModal` renders it (`components/JudgementDayModal.tsx`, read via `app/_layout.tsx`'s poll), dismiss calls `mark_finale_seen`. **This client path is reused verbatim.**
- **What's next / no dead air (same night).** The cron sees `season_2.starts_at` has passed and `started_at IS NULL` → calls `start_season('season_2')`, which stamps the start, **fans out** an INLINE `system_announcements` row per named profile ("Season 2 begins — the slate is clean"), and (optionally) seeds Season 2's finale titles.
- **The Almanac (Phase 2).** A new `my_finale_history()` RPC + a small client surface lets a player scroll *past verdicts* — their Season 1 Halo, their Season 2 Goblin Crown — turning `season_finales` from a one-shot reveal into a permanent trophy shelf ([[identity-model]]).

## Already built ✅

Cite-accurate inventory (do **not** rebuild these):

- **`finalize_season(season_key text DEFAULT 'season_1')`** — `supabase/migrations/20260526000000_finale.sql` (186 lines). Ranks every named profile (`profiles.username IS NOT NULL AND <> ''`) by `profiles.alignment_score`, buckets into `generous`(>0)/`greedy`(<0)/`neutral`(0), assigns `side_rank` via `ROW_NUMBER()`, grants tiered titles + snouts (top3=500, top10=250, participant/neutral=100). **"Snouts" are added to `profiles.counter`** (`UPDATE public.profiles SET counter = counter + snouts` — there is no `snouts` column on `profiles`; `counter` is the in-game currency surfaced by `hooks/useHomeStats.ts`). Writes to `season_finales` `ON CONFLICT (user_id, season_key) DO NOTHING`, grants only on `IF FOUND`. Then wipes `alignment_score = 0, alignment_updated_at = now()` for everyone with nonzero score. **Idempotent per `season_key`, `SECURITY DEFINER`, NOT granted to `authenticated`.** The signature already takes a key — it is *almost* generalized; it lacks a driving table and any notion of "which key is current."
- **`season_finales` table** — same migration. PK `(user_id, season_key)`, columns `final_score, side, side_rank, bracket, title_id, snouts, finalized_at, seen_at`. RLS "View own finale" (`auth.uid() = user_id`). Already a multi-season history table by construction — the Almanac just needs an RPC to read more than the latest unseen row.
- **`my_finale_result()`** — same migration, granted to `authenticated`. Returns the caller's most recent **unseen** (`seen_at IS NULL`) finale as jsonb (including a `title_name` looked up from `titles`). Reused unchanged.
- **`mark_finale_seen(target_season_key text)`** — same migration, granted to `authenticated`. Stamps `seen_at`. Reused unchanged.
- **5 finale titles** — seeded in `public.titles` with `source='season'` (the `titles_source_check` CHECK was extended to allow `'season'`): `halo_bearer_2026`, `goblin_king_2026`, `gilded_2026`, `schism_survivor`, `calm_in_the_storm`. `titles` has columns `id, name, placement('pre'|'post'), description, source, for_sale, display_order` (`supabase/migrations/20260511000000_titles.sql`). Titles flow into `user_titles` and equip via `profiles.active_title_id`. The `_2026` suffix bakes the year in — see Decisions.
- **`JudgementDayModal`** — `components/JudgementDayModal.tsx`. Reads `my_finale_result` via `app/_layout.tsx`'s poll on auth + foreground, renders side/bracket/rank/title/snouts, dismiss → `mark_finale_seen`. **Season-agnostic already** — keys off `result.season_key`. The engine swap requires zero modal changes.
- **The bespoke cron** — `supabase/migrations/20260579000000_judgement_day_cron.sql`. `cron.schedule('judgement-day-season-1', '0 12 15 7 *', $$SELECT public.finalize_season('season_1')$$)`. **Verified live: jobid 2, active** (per `docs/wiki/seasons-and-judgement-day.md`). **This is what Plan C replaces.** It hardcodes `season_1`, so next July it re-fires `finalize_season('season_1')` — a no-op for already-finalized users, so **it would NOT finalize a real Season 2.** It deliberately does NOT re-run `CREATE EXTENSION pg_cron` (Supabase's after-create hook errors `2BP01` on the existing grant state) — a footgun the replacement migration must respect identically.
- **The existing Battle-Pass `public.seasons`** — `supabase/migrations/20260502010000_battle_pass.sql`. **Unrelated to alignment; do not touch.** Named here only so the new table avoids the collision (fact #1 above).

## What's needed 🔨

### New table: `public.judgement_seasons`

The single source of truth the nightly cron reads. **Named `judgement_seasons` to avoid the `public.seasons` collision** (groundedness fact #1).

```sql
CREATE TABLE IF NOT EXISTS public.judgement_seasons (
    season_key   text        PRIMARY KEY,        -- 'season_1', 'season_2', … (matches season_finales.season_key)
    title        text        NOT NULL,           -- 'Goblins vs Angels'
    starts_at    timestamptz NOT NULL,           -- when start_season should fire
    ends_at      timestamptz NOT NULL,           -- when finalize_season should fire
    started_at   timestamptz,                    -- stamped by start_season (NULL = not started)
    finalized_at timestamptz,                    -- stamped by finalize_season (NULL = not finalized)
    next_key     text,                            -- successor key (FK added separately — see seed note)
    theme        jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- Verdict Card / title params (see Decisions)
    created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.judgement_seasons ENABLE ROW LEVEL SECURITY;
-- Public-read so the client can show "Season 2 starts in 3 days" countdowns.
DROP POLICY IF EXISTS "Anyone can read judgement seasons" ON public.judgement_seasons;
CREATE POLICY "Anyone can read judgement seasons"
    ON public.judgement_seasons FOR SELECT USING (true);
GRANT SELECT ON public.judgement_seasons TO authenticated, anon;
-- No INSERT/UPDATE/DELETE policy — writes go through SECURITY DEFINER RPCs only.

-- Seed season_2 FIRST so season_1.next_key can reference it (the self-FK below
-- would otherwise fail on a multi-row VALUES insert with forward references).
INSERT INTO public.judgement_seasons (season_key, title, starts_at, ends_at, next_key, theme) VALUES
  ('season_2', 'Season 2 (TBD)',     '2026-07-15T12:00:00Z', '2026-09-15T12:00:00Z', NULL,       '{}'),
  ('season_1', 'Goblins vs Angels',  '2026-05-20T00:00:00Z', '2026-07-15T12:00:00Z', 'season_2', '{}')
ON CONFLICT (season_key) DO NOTHING;

-- Add the self-FK only after both rows exist (avoids forward-ref failure).
ALTER TABLE public.judgement_seasons
  ADD CONSTRAINT judgement_seasons_next_key_fkey
  FOREIGN KEY (next_key) REFERENCES public.judgement_seasons(season_key);

-- Backfill the finished-state stamps for season_1 if it's already been finalized
-- by the old cron (so the engine never re-finalizes it). Safe: NULL until then.
-- (Run only if finalize ran before this migration; harmless otherwise.)
UPDATE public.judgement_seasons SET finalized_at = now()
  WHERE season_key = 'season_1'
    AND EXISTS (SELECT 1 FROM public.season_finales WHERE season_key = 'season_1');
```

> **Date note.** `2026-07-15T12:00:00Z` matches the live cron (`0 12 15 7 *`). The `season_1.starts_at` is illustrative (alignment has no hard start gate). `season_2`'s window is a **placeholder** — see Decisions ("Season cadence"); the entire engine hinges on these two timestamps being correct, and a bad `ends_at` is now a *same-day* footgun (see the sanity guard below).

### Generalized `finalize_season(season_key text)` — carry-latest-def

`CREATE OR REPLACE FUNCTION public.finalize_season(season_key text)` — **copy the LATEST 186-line definition from `20260526000000_finale.sql` verbatim** (the carry-latest-def footgun: re-creating from a stale base silently deletes the ranking/reward/wipe body — the class of bug that wiped the referral gate in build 93, restored in `20260644000000_restore_referral_gate.sql`). Changes, all additive:

1. Drop the `DEFAULT 'season_1'` — the cron always passes an explicit key.
2. **Sanity guard at the top** (addresses the daily-cron blast radius): refuse to finalize a season whose `ends_at` is absurdly far in the past (a typo guard), and short-circuit if already finalized:
   ```sql
   -- after DECLARE, before the ranking loop:
   PERFORM 1 FROM public.judgement_seasons
     WHERE season_key = finalize_season.season_key
       AND finalized_at IS NULL
       AND ends_at <= now()
       AND ends_at >= now() - interval '36 hours';
   IF NOT FOUND THEN
     RETURN jsonb_build_object('ok', false, 'reason', 'not_due_or_already_finalized', 'season_key', season_key);
   END IF;
   ```
   This makes the function safe to call standalone AND keeps the destructive `alignment_score = 0` wipe from firing on a bad/stale `ends_at`. (Qualify the column as `finalize_season.season_key` or rename the param to avoid the `WHERE season_key = season_key` always-true self-comparison — a real PL/pgSQL footgun.)
3. **At the end, after the wipe**, stamp the table:
   ```sql
   UPDATE public.judgement_seasons SET finalized_at = now()
     WHERE season_key = finalize_season.season_key AND finalized_at IS NULL;
   ```
4. Keep everything else byte-identical: the `ON CONFLICT (user_id, season_key) DO NOTHING` insert, the `IF FOUND` grant guard, `UPDATE profiles SET counter = counter + snouts`, the `alignment_score = 0` wipe, and the `RETURN jsonb_build_object('ok', true, 'granted', granted, 'season_key', season_key)` shape (the modal/clients depend on it).

Stays `SECURITY DEFINER`, NOT granted to `authenticated`.

### New: `start_season(season_key text)` — fan-out announcement

**Critical correction (groundedness fact #2):** `system_announcements` is per-user. `start_season` must **loop and INSERT one row per named profile** — it cannot insert a single broadcast row, and must NOT call `send_system_announcement` (admin-gated).

```sql
CREATE OR REPLACE FUNCTION public.start_season(p_season_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE s record; n int := 0;
BEGIN
  SELECT * INTO s FROM public.judgement_seasons
    WHERE season_key = p_season_key AND started_at IS NULL AND starts_at <= now();
  IF s IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_started_or_not_due');
  END IF;

  UPDATE public.judgement_seasons SET started_at = now() WHERE season_key = p_season_key;

  -- INLINE the announcement, one row per named profile (the table is per-user;
  -- there is no broadcast row, and send_system_announcement raises admin_only).
  -- Columns are (user_id, kind, title, body, data) per 20260556000000_system_announcements.sql.
  INSERT INTO public.system_announcements (user_id, kind, title, body, data)
    SELECT p.id, 'season',
           s.title || ' begins',
           'A new season. The slate is clean — alignment reset to Neutral.',
           jsonb_build_object('season_key', p_season_key)
    FROM public.profiles p
    WHERE p.username IS NOT NULL AND p.username <> '';
  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'season_key', p_season_key, 'announced', n);
END;
$fn$;
```
NOT granted to `authenticated` — cron/service-role only (same posture as `finalize_season`). Optional per-season title seeding (see Decisions) goes here as an idempotent `INSERT … ON CONFLICT (id) DO NOTHING` against `public.titles` before the announcement fan-out.

> **Push note:** this INLINE path writes the durable `system_announcements` rows that surface in WhileAway, but — unlike `send_system_announcement` — it does **not** fire `send_push_to_user`. That's acceptable (the row is the source of truth; the reveal is async on next foreground anyway). If a push is wanted, fire it best-effort per row inside the loop, wrapped in `BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END`.

### The nightly cron — replaces the bespoke job

A single dispatcher that reads `judgement_seasons` and fires the right RPC, replacing `judgement-day-season-1`. **Finalize before start**, so the season that ends and the season that begins on the same midnight are handled in the right order:

```sql
CREATE OR REPLACE FUNCTION public.run_season_engine()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE acted text[] := '{}'; r record;
BEGIN
  -- 1) Finalize any season whose end passed and isn't finalized.
  FOR r IN SELECT season_key FROM public.judgement_seasons
           WHERE ends_at <= now() AND finalized_at IS NULL
           ORDER BY ends_at LOOP
    PERFORM public.finalize_season(r.season_key);
    acted := acted || ('finalized:' || r.season_key);
  END LOOP;
  -- 2) Start any season whose start passed and isn't started.
  FOR r IN SELECT season_key FROM public.judgement_seasons
           WHERE starts_at <= now() AND started_at IS NULL
           ORDER BY starts_at LOOP
    PERFORM public.start_season(r.season_key);
    acted := acted || ('started:' || r.season_key);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'acted', acted);
END;
$fn$;
```

Migration to swap the schedule (respect the `2BP01` footgun — **do NOT** re-run `CREATE EXTENSION pg_cron`):

```sql
-- pg_cron already installed (verified pg_extension); CREATE EXTENSION re-fire
-- errors 2BP01. Do NOT re-run it. Scheduling/unscheduling alone is safe.
SELECT cron.unschedule('judgement-day-season-1');  -- retire the bespoke hardcoded job (jobid 2)
SELECT cron.schedule('season-engine-nightly', '5 12 * * *',  -- 12:05 UTC daily
  $$SELECT public.run_season_engine()$$);
```
Running daily at 12:05 UTC means the July 15 noon finale fires within ~5 min of the original moment (acceptable — the reveal is async on next foreground). The idempotency + sanity guards make a daily check a safe no-op every other day.

> **Rollback string (memorize before the swap):**
> `SELECT cron.schedule('judgement-day-season-1','0 12 15 7 *',$$SELECT public.finalize_season('season_1')$$);`
> If the engine misbehaves, unschedule `season-engine-nightly` and re-run the above to restore the verified-live job verbatim.

### Phase 2 — `my_finale_history()` for the Almanac

```sql
CREATE OR REPLACE FUNCTION public.my_finale_history()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'season_key', sf.season_key, 'season_title', js.title,
      'final_score', sf.final_score, 'side', sf.side, 'side_rank', sf.side_rank,
      'bracket', sf.bracket, 'title_id', sf.title_id, 'title_name', t.name,
      'snouts', sf.snouts, 'finalized_at', sf.finalized_at
    ) ORDER BY sf.finalized_at DESC)
    FROM public.season_finales sf
    LEFT JOIN public.titles t ON t.id = sf.title_id
    LEFT JOIN public.judgement_seasons js ON js.season_key = sf.season_key
    WHERE sf.user_id = caller_id
  ), '[]'::jsonb);
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.my_finale_history() TO authenticated;
```
(`season_finales` RLS already restricts to own rows; `SECURITY DEFINER` + explicit `user_id = caller_id` is belt-and-suspenders. `titles.name` and `judgement_seasons.title` are verified-real columns.)

### Client changes

- **`JudgementDayModal` — none.** Already season-agnostic; reads `my_finale_result` unchanged.
- **`utils/seasons.ts` (NEW)** — small client mirror: fetch the active Judgement season from `judgement_seasons` (public-read) for a "Season 2 starts in N days" countdown; `my_finale_history()` fetcher for the Almanac. **Name it to avoid confusion with the existing battle-pass season client code** — e.g. keep judgement-season helpers clearly distinct from `active_season()`/Snout Season state. Module name stays technical (`judgementSeasons`), player-facing words stay in UI copy.
- **`AlmanacSheet` (NEW)** — scrollable trophy shelf reading `my_finale_history()`. Reuse the verdict-card visual vocabulary from `JudgementDayModal` (the `Sticker` + reward rows). Surface from the profile/closet ([[achievements-and-titles]]) where titles already live.
- **Verdict Card (NEW, shared with Plan A/B)** — a theme-parameterized share template fed by `theme` jsonb on the season + the finale row. Plan C's contribution: `theme` lives on the `judgement_seasons` row so each season's card restyles without a code change ([[virality-and-growth-loops]]).

## Decisions to make

- **Year-baked title IDs.** `halo_bearer_2026` / `goblin_king_2026` / `gilded_2026` bake `2026` in. Season 2 (still 2026, Sept) can't reuse them (a player would own "2026" twice), and Season 3 (2027) needs new IDs. Options: (a) per-season title sets seeded by `start_season` from `judgement_seasons.theme` (clean, but more art); (b) generic season-agnostic IDs (`halo_bearer`, `goblin_king`) plus a per-season *suffix* shown only in the Almanac. **Recommend (a) for Season 2** to make the engine prove itself; the seeding INSERT goes inside `start_season` (INLINE, `ON CONFLICT (id) DO NOTHING`). Note: `finalize_season` hardcodes the title IDs (`'halo_bearer_2026'`, etc.) in its bracket logic — **per-season titles require the finalize body to read title IDs from `theme` too**, which is a non-trivial edit to the carried-verbatim body. Honest cost: option (a) means touching the one function we most want to leave byte-identical. Option (b) keeps `finalize_season` untouched and is the lower-risk first step.
- **Season cadence.** Season 1 alignment ran ~8 weeks to the July 15 finale. Is Season 2 the same length? The seed guesses 2 months — needs a real `ends_at`. The engine hinges on this timestamp being right (and now the 36-hour sanity guard depends on it being plausible).
- **Theme schema.** What lives in `judgement_seasons.theme`? At minimum: display title, Verdict Card palette/copy, and (if per-season titles) title IDs + names. Lock the shape before the Verdict Card or `start_season` seeding consumes it.
- **Daily-cron blast radius.** A nightly job that *can* fire a destructive `alignment_score = 0` wipe is more surface area than a once-a-year job. Mitigations already in this plan: the `finalized_at IS NULL AND ends_at <= now()` predicate, AND the new **36-hour `ends_at` sanity guard** inside `finalize_season` (a typo putting `ends_at` in the distant past no longer wipes alignment). Decide whether to additionally require a `confirmed boolean` flag on the row before the engine will finalize it.
- **Almanac placement + scope (Phase 2).** Profile tab, closet, or a dedicated sheet? And: only the caller's history, or also a friend's past verdicts (a flex surface)? `season_finales` RLS is own-rows-only, so a friend-view needs a new public-read RPC — defer.

## Effort + sequencing

**Overall: HIGH** (the "build the machine" plan — front-loads cost that pays off every season). Order:

1. **`judgement_seasons` table + seed + self-FK** (LOW) — table, RLS, seed `season_2` then `season_1`, add FK after, backfill `finalized_at`. No behavior change yet. *Gate: verify the table did not collide — `\d public.judgement_seasons` shows the new columns, and `public.seasons` is untouched.*
2. **Generalize `finalize_season` + sanity guard + `finalized_at` stamp** (LOW–MED, carry-latest-def discipline) — copy the latest 186-line body verbatim, append guard + stamp, qualify the `season_key` param to avoid self-comparison. *Gate: a hand-call against a past-`ends_at` clone season grants once and is a no-op on re-run.*
3. **`start_season` with per-user INLINE fan-out** (MED) — loop over named profiles, INSERT `(user_id, kind, title, body, data)` rows; idempotent `started_at` guard; optional per-season title seed. *Gate: hand-call inserts exactly one row per named profile; re-call inserts zero.*
4. **`run_season_engine` + cron swap** (MED) — unschedule `judgement-day-season-1`, schedule `season-engine-nightly`; respect the `2BP01` no-`CREATE EXTENSION` rule. **Highest-risk migration** — it retires the live July-15 job. *Gate: run `run_season_engine()` by hand on a staging clone with a near-future `ends_at` and confirm finalize+start+no-op behavior BEFORE swapping the live schedule. Keep the rollback string ready.*
5. **`my_finale_history()` + `utils/seasons.ts`** (LOW). *Phase 2.*
6. **`AlmanacSheet` client surface** (MED) — reuses modal visuals. *Phase 2.*
7. **Verdict Card from `theme`** (MED, shared with Plan A/B — coordinate so all three plans consume one template). *Phase 2.*

Steps 1–4 must land **before July 15** for the engine to own the finale. **If they slip, the existing `judgement-day-season-1` cron still fires Season 1 correctly** — so there is no hard-deadline risk to Season 1 itself, only to Season 2 auto-starting. That makes Step 4 deferrable: you can land 1–3, leave the old cron in place to fire the Season 1 finale, and swap to the engine *after* July 15 to own Season 2's start. This de-risks the most dangerous migration off the critical date.

## Risks / open questions

- **`public.seasons` name collision (mitigated).** The naive plan's `CREATE TABLE … public.seasons` would silently no-op against the battle-pass table. Mitigation: this plan uses `public.judgement_seasons` throughout. *Verify at step 1 that no migration anywhere else references `judgement_seasons` first.*
- **Per-user announcement fan-out, not broadcast (mitigated).** `system_announcements.user_id` is `NOT NULL`; `start_season` loops over named profiles. A single-row insert would violate NOT NULL and roll back. Verified against `20260556000000_system_announcements.sql` + the real example in `20260623000000_trough_nudge_and_brian_test.sql`.
- **Swapping a live destructive cron.** Step 4 unschedules verified-live jobid 2. If the replacement has a bug, the July-15 finale could silently not fire, or fire wrong. Mitigation: land 1–3 first; prove `run_season_engine()` by hand on a clone with a past `ends_at`; consider deferring the swap to after July 15 (above). Keep the rollback string memorized.
- **A daily destructive job is more dangerous than a yearly one (mitigated).** Every midnight it *could* wipe alignment if a row's `ends_at` is wrong. Guards: `finalized_at` (prevents re-wipes) + the 36-hour `ends_at` sanity window inside `finalize_season` (prevents a stale/typo timestamp from firing). Optional `confirmed` flag for further safety.
- **The alignment wipe is NOT season-keyed.** `finalize_season` wipes *all* alignment unconditionally, regardless of `season_key`. If two seasons had overlapping `ends_at`, the second finalize would wipe alignment the first already zeroed (harmless) — but only one season may be "active" at a time. The `next_key` chain + non-overlapping windows enforce this by convention; nothing in SQL prevents overlap. Consider a partial unique index ensuring at most one started-but-unfinalized season (`CREATE UNIQUE INDEX … WHERE started_at IS NOT NULL AND finalized_at IS NULL` — but note this also blocks the brief moment when season N is finalized and season N+1 starts in the same engine run; sequence finalize-before-start, as `run_season_engine` does).
- **Per-season titles vs the carried-verbatim body.** Option (a) in Decisions forces an edit to `finalize_season`'s hardcoded title IDs — the one function we most want untouched. Option (b) (generic IDs + Almanac suffix) keeps it byte-identical. Flagged so the cleaner-looking option isn't chosen blind.
- **Year-baked titles are real migration debt.** The engine eliminates *code* work per season, not *content* work — Season 2 still needs title art/IDs decided. Honest framing.
- **`pg_cron` 2BP01.** The replacement migration must not re-run `CREATE EXTENSION pg_cron` (even `IF NOT EXISTS`). Scheduling/unscheduling alone is safe.
- **DB push discipline.** All of this is migrations; per project rules, do not `db:push` autonomously — wait for explicit "push it now." Migration filenames must sort *after* `20260648000000`.

## Connects to

- [[seasons-and-judgement-day]] — the system this plan generalizes from one season into an engine.
- [[alignment]] — the score the engine ranks and (still destructively) wipes each finale.
- [[achievements-and-titles]] — finale titles are `source='season'`; the Almanac is a trophy shelf for them; year-baked IDs are the open content debt.
- [[snouts-economy]] — bracket rewards (100–500, paid into `profiles.counter`) remain a faucet; per-season repetition multiplies it, so model the recurring mint.
- [[battle-pass-and-slop-club]] — the *other*, unrelated season system (`public.seasons` / `active_season()`); the source of the name-collision constraint that forced `judgement_seasons`.
- [[virality-and-growth-loops]] — the Verdict Card / shareable-identity-artifact this plan makes theme-parameterized + recurring; "Season 2 starts now" replaces the share dead-end.
- [[identity-model]] — the Almanac turns past verdicts into a permanent part of who a player is.
- [[notifications]] — `start_season`'s per-user INLINE `system_announcements` rows are the "new season" beat (NOT `send_system_announcement`).
- [[judgement-day-plan-a-quiet-reckoning]] — the felt-moment sibling; Plan C reuses its reveal verbatim and adds the engine underneath.
- [[judgement-day-plan-b-great-schism]] — the high-drama sibling; Plan C's `judgement_seasons.theme` is what would let B's restyling ship per-season without code.
</content>
</invoke>

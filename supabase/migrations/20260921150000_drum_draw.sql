-- ═══════════════════════════════════════════════════════════════════════════
-- THE DRUM — Monday's purse is best-of-N, one lotto ball per dig
--
-- Spec: docs/design/2026-09-21-season-page-rewrite.md (§2 the drum, §4 what is
-- removed, §6 edge cases, §7 step 2), accepted 2026-09-21.
--
-- The herd race retires. Contend stops being a board other pigs stand on and
-- becomes each snout's own week against the odds: every submitted dig drops a
-- ball in Monday's drum, the drum rolls the tier table once per ball, and the
-- best roll is the purse. Nothing in the formula reads a Sounder, a streak, a
-- rank, or another pig — `balls = digs this week`, capped at the snout's own
-- expected feedings (21 on the default schedule), and the odds are one closed
-- form the player can check before Monday: 1 − (1 − p)^n.
--
-- What lands here:
--   1. draw_week_at(at) — the draw's OWN week clock (Monday 00:00 UTC → the
--      next Monday, cycle_key = that Monday as YYYYMMDD). The math is copied
--      from race_cycle_at (20260720000000) rather than called, so the race can
--      be dropped out from under it. _monday_draw_week reads it now.
--   2. draw_week_feeding_windows / user_draw_week_feeding_windows — the
--      renamed race_cycle_feeding_windows pair (20260913000000), same window
--      geometry, owned by the draw. The per-user CAP for a week is the count
--      of these windows — derived from the live schedule, never a constant.
--   3. A zone-capture seam of the draw's own. user_feeding_cycle_zones was fed
--      by an AFTER INSERT trigger on race_digs — which only ever fired for
--      CREWED diggers and stops firing entirely once §13 removes the race
--      insert. A matching trigger on rooting_receipts captures every digger's
--      zone, crewed or not, plus a backfill for receipts already on disk; and
--      user_draw_week_feeding_windows falls back to the snout's live zone +
--      schedule when no snapshot exists, so a cap is never silently 0.
--   4. monday_draws gains balls / cap / rolls. mondays_since_rare_before and
--      herd_bottom_half stay as inert history (spec §4, "data kept on disk").
--   5. Balls + eligibility on receipts alone: the race_digs fallback in
--      _monday_draw_eligible goes.
--   6. Best-of-N in draw_monday_purse(): one weighted roll per ball, every
--      roll stored, the best tier paid — through the same apply_tickles path,
--      the same per-user lock, the same (user_id, iso_week) idempotence.
--   7. _monday_draw_odds_one_in(balls) — round(1 / (1 − (1 − p)^n)), p =
--      (rare + jackpot weight) / total weight from the tuning row. The catch-up
--      multiplier, the rare-streak walk and the herd-bottom-half join are
--      dropped: a hidden moving part and the Sounder in the formula.
--   8. app_settings.monday_draw keeps its tiers EXACTLY and loses `catchup`.
--   9. monday_draw_state() is the one snapshot: the drawable week (balls, cap,
--      rolls, purse odds) and the week in progress (running_*), plus the next
--      turn of the drum. mondays_since_rare / herd_bottom_half /
--      next_rare_odds_one_in / catchup leave the payload.
--  10. award_perfect_feeding_week reads rooting_receipts against the draw
--      week's own windows — no race_digs, no crews join, so a crewless snout
--      can earn it. It used to ride the cycle_payouts trigger inside the race
--      sweep; with the sweep unscheduled it gets its own weekly cron.
--  11. The race stops: race-sweep and digoff-sweep unscheduled, and the two
--      dig paths stop writing race_digs. The race + herd-prize announcements
--      rode INSIDE those sweeps (_race_pay_cycle, _herd_prize_resolve) and
--      retire with them — neither is separately scheduled.
--  12. One Monday push survives the cull (spec §4, "Notifications"): the drum
--      turned, N balls in — sent only to snouts who held a ball, through the
--      same send_push_to_user the race pushes used, with a delivery table as
--      the per-(snout, week) send-once lock.
--  13. race_standings / race_crew_detail / herd_prize_state stay CALLABLE as
--      thin, honest stubs so a shipped binary that still asks for them gets an
--      empty answer instead of a red error.
--
-- NOT HERE: no table is dropped. race_digs, cycle_payouts, dig_offs, the
-- herd-prize tables and their functions stay on disk, unread and unwritten,
-- until the follow-up migration (spec §7 step 3) sweeps them.
--
-- CARRY-LATEST-DEF (the 2026-09 footgun) — the bases used, verbatim except the
-- documented delta:
--   • _submit_rooting_reward_v1(text[],int,text[]) ← the submit_rooting body in
--     20260799000000_server_clock_commuter_windows.sql (renamed by
--     20260913010000; nothing has replaced it since).
--   • _submit_rooting_deep_core(...) ← 20260917180000_snout_deep_attention_rules.sql
--     (the latest of six definitions).
--   Delta in both: the race-attribution INSERT INTO race_digs and the
--   race_cycle_at lookup that fed it are gone. Nothing else moves.
--   submit_rooting / submit_rooting_checked / submit_rooting_deep themselves
--   never touched race_digs — they are wrappers — so they are left alone.
--
-- Migrations are WRITTEN, NOT PUSHED — never `db push` without the founder's
-- explicit "go".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The draw's own week clock ─────────────────────────────────────────────
-- Monday 00:00 UTC → the next Monday 00:00 UTC. Identical math to
-- race_cycle_at (20260720000000), copied so the draw owns it outright.
CREATE OR REPLACE FUNCTION public.draw_week_at(p_at timestamptz)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	d       date := (p_at AT TIME ZONE 'UTC')::date;
	start_d date;
BEGIN
	start_d   := d - ((extract(isodow FROM d)::int - 1) % 7);   -- most recent Monday
	cycle_key := to_char(start_d, 'YYYYMMDD');
	starts_at := (start_d::timestamp AT TIME ZONE 'UTC');
	ends_at   := ((start_d + 7)::timestamp AT TIME ZONE 'UTC'); -- the following Monday
	RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public.draw_week_at(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_week_at(timestamptz) TO authenticated;

-- The DRAWABLE week for a clock reading: the week that just ended.
CREATE OR REPLACE FUNCTION public._monday_draw_week(p_at timestamptz)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
	SELECT * FROM public.draw_week_at(p_at - interval '7 days');
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_week(timestamptz) FROM PUBLIC, anon, authenticated;

-- ── 2. The week's expected feedings, owned by the draw ───────────────────────
-- race_cycle_feeding_windows(cycle, zone, schedule) VERBATIM from
-- 20260913000000_player_local_feeding_schedule.sql with ONE delta: the cycle
-- bounds come from draw_week_at, not race_cycle_at.
CREATE OR REPLACE FUNCTION public.draw_week_feeding_windows(p_week text, p_time_zone text, p_schedule jsonb)
RETURNS TABLE(window_index bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cycle_row record; mode_name text:=COALESCE(p_schedule->>'mode','uniform');
	zone_name text; anchor_hour int; local_day date; bucket_start int;
	opening timestamptz; legacy_window int; legacy_offset int; first_win bigint; last_win bigint; win bigint;
BEGIN
	IF p_week IS NULL OR p_week !~ '^[0-9]{8}$' OR NOT public._valid_feeding_time_zone(p_time_zone) THEN RETURN; END IF;
	SELECT * INTO cycle_row FROM public.draw_week_at(to_date(p_week,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
	IF cycle_row.cycle_key IS DISTINCT FROM p_week THEN RETURN; END IF;
	IF mode_name NOT IN ('commuter_eastern','commuter_local') THEN
		legacy_window:=COALESCE((p_schedule->>'window_secs')::int,28800);
		legacy_offset:=COALESCE((p_schedule->>'offset_secs')::int,7200);
		first_win:=floor((extract(epoch FROM cycle_row.starts_at)-legacy_offset)/legacy_window)::bigint-1;
		last_win:=floor((extract(epoch FROM cycle_row.ends_at)-legacy_offset)/legacy_window)::bigint+1;
		FOR win IN first_win..last_win LOOP
			opening:=to_timestamp(win*legacy_window+legacy_offset);
			IF opening>=cycle_row.starts_at AND opening<cycle_row.ends_at THEN window_index:=win; RETURN NEXT; END IF;
		END LOOP;
		RETURN;
	END IF;
	zone_name:=CASE WHEN mode_name='commuter_local' THEN p_time_zone ELSE 'America/New_York' END;
	anchor_hour:=CASE WHEN mode_name='commuter_local' THEN 8 ELSE 6 END;
	FOR local_day IN
		SELECT generate_series((cycle_row.starts_at AT TIME ZONE zone_name)::date-1,
			(cycle_row.ends_at AT TIME ZONE zone_name)::date+1,interval '1 day')::date
	LOOP
		FOREACH bucket_start IN ARRAY CASE WHEN mode_name='commuter_local'
			THEN ARRAY[0,480,960] ELSE ARRAY[0,360,660,900] END LOOP
			opening:=(local_day+make_interval(hours=>anchor_hour,mins=>bucket_start)) AT TIME ZONE zone_name;
			IF opening>=cycle_row.starts_at AND opening<cycle_row.ends_at THEN
				window_index:=(CASE WHEN mode_name='commuter_local' THEN
					1000000000::bigint+(local_day-date '1970-01-01')::bigint*3+
						CASE bucket_start WHEN 0 THEN 0 WHEN 480 THEN 1 ELSE 2 END
				ELSE (local_day-date '1970-01-01')::bigint*4+
					CASE bucket_start WHEN 0 THEN 0 WHEN 360 THEN 1 WHEN 660 THEN 2 ELSE 3 END END)::bigint;
				RETURN NEXT;
			END IF;
		END LOOP;
	END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION public.draw_week_feeding_windows(text,text,jsonb) FROM PUBLIC, anon, authenticated;

-- The snout's OWN expected feedings in a week. Preferred source is the zone
-- snapshot taken at the week's open (user_feeding_cycle_zones — so a zone or
-- schedule change mid-week can never re-cut a week already under way, spec
-- §6.3). With no snapshot the live zone + schedule answer, so a digger whose
-- week was never captured still gets a real cap instead of zero.
CREATE OR REPLACE FUNCTION public.user_draw_week_feeding_windows(p_user uuid, p_week text)
RETURNS TABLE(window_index bigint) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	zone_name text; sched jsonb; wk record;
BEGIN
	IF p_user IS NULL OR p_week IS NULL OR p_week !~ '^[0-9]{8}$' THEN RETURN; END IF;
	SELECT z.time_zone, z.feeding_schedule INTO zone_name, sched
		FROM public.user_feeding_cycle_zones z
		WHERE z.user_id = p_user AND z.cycle_key = p_week;
	IF zone_name IS NULL THEN
		SELECT * INTO wk FROM public.draw_week_at(to_date(p_week,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
		zone_name := COALESCE(public._feeding_zone_at(p_user, wk.starts_at), 'America/New_York');
		sched := COALESCE((SELECT value FROM public.app_settings WHERE key = 'feeding_schedule'), '{}'::jsonb);
	END IF;
	RETURN QUERY SELECT w.window_index
		FROM public.draw_week_feeding_windows(p_week, zone_name, COALESCE(sched, '{}'::jsonb)) w;
END;
$function$;
REVOKE ALL ON FUNCTION public.user_draw_week_feeding_windows(uuid,text) FROM PUBLIC, anon, authenticated;

-- ── 3. The draw's own zone-capture seam ──────────────────────────────────────
-- Fail-soft by construction: a zone snapshot must never be able to fail a dig.
CREATE OR REPLACE FUNCTION public.capture_draw_week_zone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk record; at_dug timestamptz := COALESCE(NEW.created_at, now());
BEGIN
	SELECT * INTO wk FROM public.draw_week_at(at_dug);
	INSERT INTO public.user_feeding_cycle_zones(user_id, cycle_key, time_zone, feeding_schedule)
	VALUES (NEW.user_id, wk.cycle_key,
		COALESCE(public._feeding_zone_at(NEW.user_id, at_dug), 'America/New_York'),
		COALESCE((SELECT value FROM public.app_settings WHERE key = 'feeding_schedule'), '{}'::jsonb))
	ON CONFLICT (user_id, cycle_key) DO NOTHING;
	RETURN NEW;
EXCEPTION WHEN OTHERS THEN
	RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.capture_draw_week_zone() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_draw_week_zone ON public.rooting_receipts;
CREATE TRIGGER capture_draw_week_zone AFTER INSERT ON public.rooting_receipts
	FOR EACH ROW EXECUTE FUNCTION public.capture_draw_week_zone();

-- Receipts already on disk (since 2026-09-13) predate the trigger.
INSERT INTO public.user_feeding_cycle_zones(user_id, cycle_key, time_zone, feeding_schedule)
SELECT DISTINCT r.user_id, w.cycle_key,
	COALESCE(public._feeding_zone_at(r.user_id, r.created_at), 'America/New_York'),
	COALESCE((SELECT value FROM public.app_settings WHERE key = 'feeding_schedule'), '{}'::jsonb)
FROM public.rooting_receipts r
CROSS JOIN LATERAL public.draw_week_at(r.created_at) w
ON CONFLICT (user_id, cycle_key) DO NOTHING;

-- ── 4. The receipt row learns the drum ───────────────────────────────────────
ALTER TABLE public.monday_draws
	ADD COLUMN IF NOT EXISTS balls int NOT NULL DEFAULT 0 CHECK (balls >= 0),
	ADD COLUMN IF NOT EXISTS cap   int NOT NULL DEFAULT 0 CHECK (cap >= 0),
	ADD COLUMN IF NOT EXISTS rolls text[];
COMMENT ON COLUMN public.monday_draws.balls IS
	'Lotto balls the drum turned on: LEAST(cap, digs in the week). One per submitted dig.';
COMMENT ON COLUMN public.monday_draws.cap IS
	'The snout''s own expected feedings that week (21 on the default schedule), stored so a later schedule change never re-cuts a settled week.';
COMMENT ON COLUMN public.monday_draws.rolls IS
	'Every tier rolled, one per ball, in roll order. The paid tier is the best of them.';
COMMENT ON COLUMN public.monday_draws.mondays_since_rare_before IS
	'INERT HISTORY (retired 2026-09-21): the catch-up streak the roll used before the drum.';
COMMENT ON COLUMN public.monday_draws.herd_bottom_half IS
	'INERT HISTORY (retired 2026-09-21): the herd-bottom-half flag the roll used before the drum.';

-- ── 5. Tuning: the tiers stay exactly, the catch-up curve goes ───────────────
-- utils/mondayDraw.ts MONDAY_DRAW_TUNING is the compiled fallback and MUST
-- mirror this row. EVERY NUMBER IS STILL A TUNING PLACEHOLDER.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'monday_draw',
	'{
		"tiers": [
			{"tier": "common",  "amount": 20,  "weight": 60},
			{"tier": "good",    "amount": 60,  "weight": 28},
			{"tier": "rare",    "amount": 150, "weight": 10},
			{"tier": "jackpot", "amount": 400, "weight": 2}
		],
		"balls_cap_source": "schedule"
	}'::jsonb,
	'placeholder'
)
ON CONFLICT (key) DO NOTHING;

UPDATE public.app_settings SET
	value = (value - 'catchup') || jsonb_build_object('balls_cap_source', 'schedule'),
	description = 'Monday drum (20260921150000): per-tier amount + base weight. One ball per dig that week, capped at the snout''s own expected feedings (balls_cap_source = the live feeding schedule, 21 today); the drum rolls this table once per ball and pays the BEST tier rolled. Rare-or-better for n balls = 1 - (1 - p)^n with p = (rare+jackpot weight)/total, printed as 1 in N. No catch-up, no streak, no herd. All numbers are tuning placeholders. utils/mondayDraw.ts MONDAY_DRAW_TUNING is the compiled fallback.',
	updated_at = now()
WHERE key = 'monday_draw';

-- The compiled fallback inside the database loses `catchup` too.
CREATE OR REPLACE FUNCTION public._monday_draw_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'monday_draw'),
		'{"tiers":[{"tier":"common","amount":20,"weight":60},{"tier":"good","amount":60,"weight":28},{"tier":"rare","amount":150,"weight":10},{"tier":"jackpot","amount":400,"weight":2}],"balls_cap_source":"schedule"}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_tuning() FROM PUBLIC, anon, authenticated;

-- ── 6. Balls, cap, eligibility ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._monday_draw_cap(p_user uuid, p_week text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((SELECT count(*)::int
		FROM public.user_draw_week_feeding_windows(p_user, p_week)), 0);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_cap(uuid,text) FROM PUBLIC, anon, authenticated;

-- One ball per submitted dig in the week, capped at the week's own feedings.
-- rooting_receipts is unique per (user, window_index), so a retried submit can
-- never double-count (spec §6.1). The receipt's created_at decides its week.
CREATE OR REPLACE FUNCTION public._monday_draw_balls(p_user uuid, p_week text)
RETURNS int LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk record; dug int; the_cap int;
BEGIN
	IF p_user IS NULL OR p_week IS NULL OR p_week !~ '^[0-9]{8}$' THEN RETURN 0; END IF;
	SELECT * INTO wk FROM public.draw_week_at(to_date(p_week,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
	SELECT count(*)::int INTO dug FROM public.rooting_receipts r
		WHERE r.user_id = p_user
		  AND r.created_at >= wk.starts_at AND r.created_at < wk.ends_at;
	the_cap := public._monday_draw_cap(p_user, p_week);
	RETURN GREATEST(0, LEAST(the_cap, COALESCE(dug, 0)));
END;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_balls(uuid,text) FROM PUBLIC, anon, authenticated;

-- Eligibility is the drum: at least one ball. (The race_digs fallback is gone;
-- the bounds arguments stay for the shipped call signature.)
CREATE OR REPLACE FUNCTION public._monday_draw_eligible(
	p_user uuid, p_week text, p_starts timestamptz, p_ends timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public._monday_draw_balls(p_user, p_week) >= 1;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_eligible(uuid, text, timestamptz, timestamptz)
	FROM PUBLIC, anon, authenticated;

-- ── 7. The odds, as one closed form ──────────────────────────────────────────
-- p = (rare + jackpot weight) / total weight; n balls → 1 − (1 − p)^n, printed
-- as "1 in N" with N = round(1/that), never below 1. At the placeholder
-- weights (p = 0.12): 1 ball → 1 in 8, 3 → 1 in 3, 7 → 1 in 2, 21 → 1 in 1.
-- utils/mondayDraw.ts oddsOneIn(balls) mirrors this exactly.
DROP FUNCTION IF EXISTS public._monday_draw_odds_one_in(numeric);
CREATE OR REPLACE FUNCTION public._monday_draw_odds_one_in(p_balls int)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH w AS (
		SELECT
			sum(CASE WHEN x ->> 'tier' IN ('rare', 'jackpot')
			         THEN (x ->> 'weight')::numeric ELSE 0 END) AS hot,
			sum((x ->> 'weight')::numeric)                      AS total
		FROM public._monday_draw_tuning() t, jsonb_array_elements(t -> 'tiers') x
	)
	SELECT CASE
		WHEN COALESCE(hot, 0) <= 0 OR COALESCE(total, 0) <= 0 THEN 2147483647
		ELSE GREATEST(1, round(1 / (1 - power(1 - hot / total,
			GREATEST(1, COALESCE(p_balls, 1))))))::int
	END
	FROM w;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_odds_one_in(int) FROM PUBLIC, anon, authenticated;

-- ── 8. The one snapshot both RPCs return ─────────────────────────────────────
-- `week` is the DRAWABLE week (the one that just ended) with its balls, cap,
-- rolls and purse odds; `running_*` is the week in progress; `next_turn_at` is
-- when the drum turns again. Nothing here reads another pig.
CREATE OR REPLACE FUNCTION public._monday_draw_snapshot(p_user uuid, p_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk        record;
	run       record;
	row_d     public.monday_draws%ROWTYPE;
	tuning    jsonb := public._monday_draw_tuning();
	n_balls   int   := 0;
	n_cap     int   := 0;
	rolls_j   jsonb := NULL;
	run_balls int   := 0;
	run_cap   int   := 0;
	odds      int   := NULL;
BEGIN
	SELECT * INTO wk  FROM public._monday_draw_week(p_at);
	SELECT * INTO run FROM public.draw_week_at(p_at);

	IF p_user IS NOT NULL THEN
		SELECT * INTO row_d FROM public.monday_draws
			WHERE user_id = p_user AND iso_week = wk.cycle_key;
		IF row_d.user_id IS NOT NULL THEN
			n_balls := row_d.balls;
			n_cap   := row_d.cap;
			rolls_j := CASE WHEN row_d.rolls IS NULL THEN NULL ELSE to_jsonb(row_d.rolls) END;
		ELSE
			n_balls := public._monday_draw_balls(p_user, wk.cycle_key);
			n_cap   := public._monday_draw_cap(p_user, wk.cycle_key);
		END IF;
		run_balls := public._monday_draw_balls(p_user, run.cycle_key);
		run_cap   := public._monday_draw_cap(p_user, run.cycle_key);
	END IF;

	IF n_balls > 0 THEN
		odds := public._monday_draw_odds_one_in(n_balls);
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'week', wk.cycle_key,
		'week_starts_at', wk.starts_at,
		'week_ends_at', wk.ends_at,
		'eligible', n_balls >= 1,
		'drawn', row_d.user_id IS NOT NULL,
		'amount', row_d.amount,
		'tier', row_d.tier,
		'balls', n_balls,
		'cap', n_cap,
		'rolls', rolls_j,
		'purse_odds_one_in', odds,
		'running_week', run.cycle_key,
		'running_starts_at', run.starts_at,
		'running_ends_at', run.ends_at,
		'running_balls', run_balls,
		'running_cap', run_cap,
		'running_odds_one_in', public._monday_draw_odds_one_in(GREATEST(1, run_balls)),
		'next_turn_at', run.ends_at,
		'tiers', tuning -> 'tiers');
END;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_snapshot(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── 9. The RPCs ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.monday_draw_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public._monday_draw_snapshot(auth.uid(), public._patch_now());
$function$;
REVOKE ALL ON FUNCTION public.monday_draw_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monday_draw_state() TO authenticated;

-- BEST OF N. One weighted roll of the tier table per ball; every roll is kept;
-- the best tier is the purse. One row per (user, iso_week) under a per-user
-- lock, minted through apply_tickles (the count + the snouts, never a bare
-- balance UPDATE). Re-calling returns the stored draw.
CREATE OR REPLACE FUNCTION public.draw_monday_purse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid       uuid := auth.uid();
	at_now    timestamptz := public._patch_now();
	wk        record;
	tuning    jsonb := public._monday_draw_tuning();
	existing  public.monday_draws%ROWTYPE;
	n_balls   int;
	n_cap     int;
	total     numeric := 0;
	roll      numeric;
	acc       numeric;
	t         jsonb;
	i         int;
	rolled    text[] := ARRAY[]::text[];
	hit_tier  text;
	hit_amt   int;
	best_tier text := NULL;
	best_amt  int := -1;
	snap      jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO wk FROM public._monday_draw_week(at_now);

	-- Serialize per snout: two taps can't both roll.
	PERFORM pg_advisory_xact_lock(hashtextextended('monday_draw:' || uid::text, 0));

	SELECT * INTO existing FROM public.monday_draws
		WHERE user_id = uid AND iso_week = wk.cycle_key;
	IF existing.user_id IS NOT NULL THEN
		RETURN public._monday_draw_snapshot(uid, at_now);
	END IF;

	n_balls := public._monday_draw_balls(uid, wk.cycle_key);
	n_cap   := public._monday_draw_cap(uid, wk.cycle_key);
	IF n_balls < 1 THEN
		RETURN public._monday_draw_snapshot(uid, at_now)
			|| jsonb_build_object('ok', false, 'reason', 'not_eligible');
	END IF;

	SELECT sum((x ->> 'weight')::numeric) INTO total
		FROM jsonb_array_elements(tuning -> 'tiers') x;
	IF COALESCE(total, 0) <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_tiers');
	END IF;

	FOR i IN 1..n_balls LOOP
		roll := random() * total;
		acc  := 0;
		hit_tier := NULL;
		FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
			acc := acc + (t ->> 'weight')::numeric;
			hit_tier := t ->> 'tier';
			hit_amt  := (t ->> 'amount')::int;
			EXIT WHEN roll < acc;
		END LOOP;
		IF hit_tier IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'no_tiers');
		END IF;
		rolled := rolled || hit_tier;
		IF hit_amt > best_amt THEN
			best_amt  := hit_amt;
			best_tier := hit_tier;
		END IF;
	END LOOP;

	-- The receipt first (the PK is the idempotence lock), then the mint.
	INSERT INTO public.monday_draws
		(user_id, iso_week, tier, amount, balls, cap, rolls, drawn_at)
	VALUES (uid, wk.cycle_key, best_tier, best_amt, n_balls, n_cap, rolled, at_now);

	PERFORM public.apply_tickles(uid, best_amt);

	snap := public._monday_draw_snapshot(uid, at_now);
	RETURN snap || jsonb_build_object('amount', best_amt, 'tier', best_tier);
END;
$function$;
REVOKE ALL ON FUNCTION public.draw_monday_purse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_monday_purse() TO authenticated;

-- ── 10. The retired moving parts ─────────────────────────────────────────────
-- The catch-up multiplier (a hidden part that made the same week draw
-- differently for two pigs with the same digs) and the herd-bottom-half join
-- (the Sounder in the formula). Nothing else calls either.
DROP FUNCTION IF EXISTS public._monday_draw_multiplier(int);
DROP FUNCTION IF EXISTS public._monday_draw_streak_before(uuid, text);
DROP FUNCTION IF EXISTS public._monday_draw_herd_bottom_half(uuid, text);

-- ── 11. The perfect week reads the drum ──────────────────────────────────────
-- A perfect week is a full drum: every expected feeding of the ended week dug.
-- No race_digs, no crews join — a crewless snout earns it. The is_test filter
-- stays. Awarding is unchanged and one-time (user_achievements' PK).
CREATE OR REPLACE FUNCTION public.award_perfect_feeding_week(p_cycle text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	week_row record; achievement_row record; candidate record;
	expected_windows int; expected_ids bigint[]; actual_windows int; inserted int; awarded int:=0;
BEGIN
	IF p_cycle IS NULL OR p_cycle !~ '^[0-9]{8}$' THEN RETURN 0; END IF;
	SELECT * INTO week_row FROM public.draw_week_at(
		to_date(p_cycle,'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
	IF week_row.cycle_key IS DISTINCT FROM p_cycle OR week_row.ends_at>now() THEN RETURN 0; END IF;
	SELECT * INTO achievement_row FROM public.achievements WHERE id='every_last_feeding';
	IF achievement_row.id IS NULL THEN RETURN 0; END IF;

	FOR candidate IN
		SELECT DISTINCT r.user_id FROM public.rooting_receipts r
		JOIN public.profiles p ON p.id=r.user_id AND p.is_test=false
		WHERE r.created_at>=week_row.starts_at AND r.created_at<week_row.ends_at
	LOOP
		SELECT array_agg(window_index),count(*)::int INTO expected_ids,expected_windows
		FROM public.user_draw_week_feeding_windows(candidate.user_id,p_cycle);
		IF COALESCE(expected_windows,0)<=0 THEN CONTINUE; END IF;
		SELECT count(DISTINCT r.window_index)::int INTO actual_windows
		FROM public.rooting_receipts r
		WHERE r.user_id=candidate.user_id
			AND r.created_at>=week_row.starts_at AND r.created_at<week_row.ends_at
			AND r.window_index=ANY(expected_ids);
		IF actual_windows<>expected_windows THEN CONTINUE; END IF;

		INSERT INTO public.user_achievements(user_id,achievement_id,claimed_at,progress,level)
		VALUES(candidate.user_id,achievement_row.id,now(),expected_windows,0)
		ON CONFLICT(user_id,achievement_id) DO NOTHING;
		GET DIAGNOSTICS inserted=ROW_COUNT;
		IF inserted=0 THEN CONTINUE; END IF;
		IF achievement_row.reward_title_id IS NOT NULL THEN
			INSERT INTO public.user_titles(user_id,title_id)
			VALUES(candidate.user_id,achievement_row.reward_title_id) ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_item_id IS NOT NULL THEN
			INSERT INTO public.user_hats(user_id,hat_id)
			VALUES(candidate.user_id,achievement_row.reward_item_id) ON CONFLICT DO NOTHING;
		END IF;
		IF achievement_row.reward_snouts>0 THEN
			UPDATE public.profiles SET counter=counter+achievement_row.reward_snouts
			WHERE id=candidate.user_id;
		END IF;
		awarded:=awarded+1;
	END LOOP;
	RETURN awarded;
END;
$function$;
REVOKE ALL ON FUNCTION public.award_perfect_feeding_week(text) FROM PUBLIC, anon, authenticated;

-- It used to ride the cycle_payouts trigger inside the race sweep. With the
-- sweep unscheduled it needs its own beat: Monday 00:20 UTC, for the week that
-- ended twenty minutes earlier. Tolerate pg_cron being absent (the
-- plain-Postgres harness stubs cron.*).
DO $schedule_perfect_week$
BEGIN
	PERFORM cron.schedule('perfect-week-award', '20 0 * * 1',
		'SELECT public.award_perfect_feeding_week(to_char(((now() AT TIME ZONE ''UTC'')::date - 7), ''YYYYMMDD''))');
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'perfect-week-award cron was not scheduled in this environment: %', SQLERRM;
END;
$schedule_perfect_week$;

-- ── 12. The one Monday push that survives ────────────────────────────────────
-- Spec §4: the race resolved / podium / spoils pushes and the herd-prize push
-- retire; ONE Monday push remains, and only for a snout who actually held a
-- ball. Same pipeline the race pushes used — send_push_to_user (pg_net → Expo),
-- fail-soft, never send_system_announcement (that raises admin_only from a cron
-- role and would roll the send back). The delivery table is the send-once lock,
-- the feeding_push_deliveries pattern from 20260826020000: claim the row first,
-- send second, release the claim if the send never left.
CREATE TABLE IF NOT EXISTS public.drum_push_deliveries (
	user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	-- The drawable week the push announced (its Monday, YYYYMMDD).
	iso_week   text        NOT NULL,
	balls      int         NOT NULL DEFAULT 0 CHECK (balls >= 0),
	queued_at  timestamptz NOT NULL DEFAULT now(),
	request_id bigint,
	PRIMARY KEY (user_id, iso_week)
);
ALTER TABLE public.drum_push_deliveries ENABLE ROW LEVEL SECURITY;   -- server-only
REVOKE ALL ON public.drum_push_deliveries FROM PUBLIC, anon, authenticated;

-- "The drum turned · 7 balls in — see what you drew." One per snout per week.
-- p_week defaults to the week that just ended, which is what the cron wants.
CREATE OR REPLACE FUNCTION public.push_drum_turned(p_week text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk      record;
	target  record;
	n_balls int;
	claimed text;
	res     jsonb;
	queued  int := 0;
	skipped int := 0;
BEGIN
	IF p_week IS NULL THEN
		SELECT * INTO wk FROM public._monday_draw_week(public._patch_now());
	ELSE
		IF p_week !~ '^[0-9]{8}$' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_week');
		END IF;
		SELECT * INTO wk FROM public.draw_week_at(
			to_date(p_week, 'YYYYMMDD')::timestamp AT TIME ZONE 'UTC');
		IF wk.cycle_key IS DISTINCT FROM p_week THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_week');
		END IF;
	END IF;
	-- A week still running has no result to look at.
	IF wk.ends_at > now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'week_running', 'week', wk.cycle_key);
	END IF;

	FOR target IN
		SELECT DISTINCT r.user_id
		FROM public.rooting_receipts r
		JOIN public.profiles p ON p.id = r.user_id AND p.is_test = false
		WHERE r.created_at >= wk.starts_at AND r.created_at < wk.ends_at
	LOOP
		n_balls := public._monday_draw_balls(target.user_id, wk.cycle_key);
		IF n_balls < 1 THEN skipped := skipped + 1; CONTINUE; END IF;

		-- Claim the (snout, week) slot BEFORE sending: a re-run finds it taken
		-- and sends nothing.
		claimed := NULL;
		INSERT INTO public.drum_push_deliveries (user_id, iso_week, balls)
			VALUES (target.user_id, wk.cycle_key, n_balls)
			ON CONFLICT (user_id, iso_week) DO NOTHING
			RETURNING iso_week INTO claimed;
		IF claimed IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;

		BEGIN
			res := public.send_push_to_user(
				target.user_id,
				'The drum turned',
				n_balls || CASE WHEN n_balls = 1 THEN ' ball in' ELSE ' balls in' END
					|| ' — see what you drew.',
				jsonb_build_object(
					'kind', 'monday_draw',
					'screen', 'season',
					'week', wk.cycle_key,
					'balls', n_balls));
			IF COALESCE((res ->> 'ok')::boolean, false) THEN
				UPDATE public.drum_push_deliveries
					SET request_id = NULLIF(res ->> 'request_id', '')::bigint
					WHERE user_id = target.user_id AND iso_week = wk.cycle_key;
				queued := queued + 1;
			ELSE
				-- No token, or Expo refused it: release the claim, count it quiet.
				DELETE FROM public.drum_push_deliveries
					WHERE user_id = target.user_id AND iso_week = wk.cycle_key;
				skipped := skipped + 1;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			DELETE FROM public.drum_push_deliveries
				WHERE user_id = target.user_id AND iso_week = wk.cycle_key;
			skipped := skipped + 1;
		END;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'week', wk.cycle_key,
		'queued', queued, 'skipped', skipped);
END;
$function$;
REVOKE ALL ON FUNCTION public.push_drum_turned(text) FROM PUBLIC, anon, authenticated;

-- Monday 00:25 UTC — five minutes behind perfect-week-award, so the week's
-- achievement has landed before the phone buzzes about the week.
DO $schedule_drum_push$
BEGIN
	PERFORM cron.schedule('drum-turned-push', '25 0 * * 1',
		'SELECT public.push_drum_turned()');
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'drum-turned-push cron was not scheduled in this environment: %', SQLERRM;
END;
$schedule_drum_push$;

-- ── 13. The race stops ───────────────────────────────────────────────────────
-- The sweeps are the only callers of _race_pay_cycle and _herd_prize_resolve,
-- so the race_result / herd_prize announcements and their pushes retire with
-- them. Neither is separately scheduled. No function or table is dropped here
-- — the follow-up migration (spec §7 step 3) does that once a week of
-- monday_draws.balls rows exists.
DO $unschedule_race$ BEGIN
	BEGIN PERFORM cron.unschedule('race-sweep'); EXCEPTION WHEN OTHERS THEN NULL; END;
	BEGIN PERFORM cron.unschedule('digoff-sweep'); EXCEPTION WHEN OTHERS THEN NULL; END;
EXCEPTION WHEN OTHERS THEN NULL; END $unschedule_race$;

-- ── 14. The dig stops feeding the race ───────────────────────────────────────
-- CARRY-LATEST-DEF. Both functions are their newest live definitions, verbatim
-- but for ONE delta each: the race-attribution INSERT (and the race_cycle_at
-- lookup that fed it) is gone. Everything else — the drain, the crew
-- lifetime_finds roll-up, the milestones, the echo, the carry, the receipt —
-- is untouched.
--   • _submit_rooting_reward_v1 (the classic patch) ← the submit_rooting body
--     in 20260799000000_server_clock_commuter_windows.sql, renamed in place by
--     20260913010000_durable_rooting_receipts.sql. Nothing replaced it since.
--   • _submit_rooting_deep_core (Snout Deep) ← the definition in
--     20260917180000_snout_deep_attention_rules.sql, the latest of six.
-- submit_rooting / submit_rooting_checked / submit_rooting_deep are wrappers
-- that never wrote the race themselves, so they are deliberately NOT
-- re-created here. v_cycle stays declared (unused) in both, so the diff
-- against each base is exactly the removed block.
-- NOTE: the race's AFTER INSERT trigger was the only writer of
-- user_feeding_cycle_zones; §3 above replaces that seam on rooting_receipts.

CREATE OR REPLACE FUNCTION public._submit_rooting_reward_v1(p_finds text[], p_actions int, p_missed text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	clock       record;
	win         bigint;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	n_credited  int := 0;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[];
	drain_total bigint;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
	v_cycle     text;
	claimed_unique boolean := false;   -- did the payload validly claim the relic?
	uniq_new    boolean := false;      -- first catch (fresh Book entry)?
	uniq_count  int := 0;              -- found_count after this catch
	unique_found jsonb := NULL;
	-- ── carry-over locals ────────────────────────────────────────────────────
	the_carry     record;             -- the caller's carry slot before this dig
	missed_clean  text[];             -- validated, claimed-subtracted p_missed
	m             text;
	carry_gild    int := 0;           -- gild the carried find pays this dig, if caught
	carry_caught  jsonb := NULL;      -- {kind, gild} when the carried find was claimed
	carry_next    jsonb := NULL;      -- {kind, gild} when a new miss takes/bumps the slot
	best_miss     text;               -- the best carry-eligible miss (unique>truffle)
	new_gild      int;
BEGIN
	SELECT * INTO clock FROM public._patch_clock(v_now);
	win := clock.window_index;
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');
	END IF;

	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_actions');
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win FOR UPDATE;
	IF row_r.user_id IS NULL THEN
		-- Also the stale-session path: a dig opened in a PREVIOUS window refuses
		-- here because win moved on (unchanged pre-phase behavior).
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;

	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		-- 'unique' is valid ONLY when this board actually carries a relic; the
		-- board's rooting_finds() (seed-derived) never contains 'unique', so it is
		-- validated against the row's unique_id here instead.
		IF f = 'unique' THEN
			IF row_r.unique_id IS NULL THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			claimed_unique := true;
		ELSIF NOT (f = ANY (valid)) THEN
			-- Still pre-write: a forged find rejects the whole submit, no side effects.
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	-- Every claimed find (truffles, shimmer, junk, AND the relic) counts toward
	-- the meter drain — the relic is a credited find like any other.
	n_credited := COALESCE(array_length(claimed, 1), 0);

	-- ── p_missed validation (still pre-write) ────────────────────────────────
	-- A miss must be a carry-eligible id (truffle_l/truffle_d/unique), actually on
	-- THIS board (a truffle is always present; 'unique' only when unique_id set),
	-- and NOT also in `claimed` (a claimed find is caught, not missed). A forged
	-- miss is silently dropped (not a submit-killer — the miss is advisory presence
	-- state, not a scored find), so an old or buggy client can't wedge a valid dig.
	missed_clean := ARRAY[]::text[];
	IF p_missed IS NOT NULL THEN
		FOREACH m IN ARRAY p_missed LOOP
			IF m = ANY (claimed) THEN CONTINUE; END IF;                 -- caught, not missed
			IF m = 'unique' THEN
				IF row_r.unique_id IS NOT NULL AND NOT (m = ANY (missed_clean)) THEN
					missed_clean := missed_clean || m;
				END IF;
			ELSIF m IN ('truffle_l', 'truffle_d') THEN
				IF NOT (m = ANY (missed_clean)) THEN missed_clean := missed_clean || m; END IF;
			END IF;
			-- anything else (shimmer/junk/stone/forged) is dropped: never carries.
		END LOOP;
	END IF;

	-- The caller's carry slot BEFORE this dig (drives the catch/keep decision).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = caller_id;

	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'dig', NULL);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'dig_echo', NULL);
			my_echo := true;
		END IF;
		IF blessed THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'blessed_dig', NULL);
		END IF;
	END IF;

	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE user_id = r.user_id AND window_index = win;
		BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;

	IF minted > 0 THEN
		BEGIN PERFORM public.try_claim_achievements(caller_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	-- ── UNIQUE CATCH ─────────────────────────────────────────────────────────
	-- Light the Burrow Book: first catch inserts (new=true), a dupe bumps count.
	IF claimed_unique THEN
		INSERT INTO public.user_uniques (user_id, unique_id, found_count, first_found_at)
			VALUES (caller_id, row_r.unique_id, 1, v_now)
			ON CONFLICT (user_id, unique_id)
			DO UPDATE SET found_count = public.user_uniques.found_count + 1
			RETURNING (xmax = 0) AS was_insert, found_count INTO uniq_new, uniq_count;
		unique_found := jsonb_build_object(
			'id', row_r.unique_id, 'new', uniq_new, 'found_count', uniq_count);
	END IF;

	-- ── THE ONE THAT GOT AWAY — carry resolution ─────────────────────────────
	-- (1) CAUGHT: the carried find was claimed this dig. The gild pays extra
	--     drain (NEVER minted truffles), records best_gild for a relic, and the
	--     carry slot clears. A truffle carry is caught when EITHER truffle cluster
	--     is claimed (the miss is a truffle — the one you almost had); a unique
	--     carry is caught when THIS board's relic (which open_rooting re-buried to
	--     the carried one) is claimed.
	IF the_carry.kind IS NOT NULL THEN
		IF (the_carry.kind IN ('truffle_l', 'truffle_d')
			AND ('truffle_l' = ANY (claimed) OR 'truffle_d' = ANY (claimed)))
		   OR (the_carry.kind = 'unique' AND claimed_unique
			AND row_r.unique_id = the_carry.unique_id)
		THEN
			carry_gild := the_carry.gild;
			IF the_carry.kind = 'unique' AND claimed_unique THEN
				UPDATE public.user_uniques
					SET best_gild = GREATEST(best_gild, the_carry.gild)
					WHERE user_id = caller_id AND unique_id = row_r.unique_id;
			END IF;
			DELETE FROM public.user_patch_carry WHERE user_id = caller_id;
			carry_caught := jsonb_build_object('kind', the_carry.kind, 'gild', the_carry.gild);
		END IF;
	END IF;

	-- (2) NEXT: pick the best NEW miss (unique beats a truffle). If the slot is
	--     empty (or was just cleared by a catch), take it; if the same kind is
	--     re-missed, bump gild (cap 3). A different-kind miss when the slot is
	--     occupied does NOT displace it (newest wins only when empty or same-kind).
	IF array_length(missed_clean, 1) IS NOT NULL THEN
		IF 'unique' = ANY (missed_clean) THEN best_miss := 'unique';
		ELSIF 'truffle_l' = ANY (missed_clean) THEN best_miss := 'truffle_l';
		ELSIF 'truffle_d' = ANY (missed_clean) THEN best_miss := 'truffle_d';
		END IF;

		IF best_miss IS NOT NULL THEN
			-- Re-read the slot: a catch above may have cleared it this same dig.
			SELECT kind, unique_id, gild INTO the_carry
				FROM public.user_patch_carry WHERE user_id = caller_id;
			IF the_carry.kind IS NULL THEN
				-- Empty slot → take this miss at gild 1.
				INSERT INTO public.user_patch_carry (user_id, kind, unique_id, gild, updated_at)
					VALUES (caller_id, best_miss,
						CASE WHEN best_miss = 'unique' THEN row_r.unique_id ELSE NULL END,
						1, v_now);
				carry_next := jsonb_build_object('kind', best_miss, 'gild', 1);
			ELSIF the_carry.kind = best_miss THEN
				-- Same kind re-missed → bump gild (cap 3), refresh updated_at. For a
				-- unique, keep it pinned to THIS board's relic (the one re-missed).
				new_gild := LEAST(3, the_carry.gild + 1);
				UPDATE public.user_patch_carry
					SET gild = new_gild,
					    unique_id = CASE WHEN best_miss = 'unique' THEN row_r.unique_id ELSE NULL END,
					    updated_at = v_now
					WHERE user_id = caller_id;
				carry_next := jsonb_build_object('kind', best_miss, 'gild', new_gild);
			END IF;
			-- Occupied by a DIFFERENT kind → leave it (newest wins only if empty/same).
		END IF;
	END IF;

	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- ── DRAIN ────────────────────────────────────────────────────────────────
	-- Instant drain. A caught carry's gild adds EXTRA drain (value, not
	-- currency) on top of the credited finds. The race attribution that stood
	-- here retired 2026-09-21: the drum counts receipts now.
	UPDATE public.hunger_drain SET total = total + n_credited + carry_gild WHERE id = true
		RETURNING total INTO drain_total;

	SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = my_crew FOR UPDATE;
	old_life := COALESCE(old_life, 0);
	new_life := old_life + n_credited;
	UPDATE public.crews SET lifetime_finds = new_life WHERE id = my_crew;

	FOR t IN SELECT * FROM (VALUES
		(150,  'mud_champion', 200,  'Root Rustler'),
		(600,  'mud_veteran',  1000, 'Truffle Baron'),
		(1800, 'mud_legend',   2000, 'Hunger''s Bane')
	) AS v(thresh, title_id, purse, title_name)
	LOOP
		IF old_life < t.thresh AND new_life >= t.thresh THEN
			INSERT INTO public.crew_milestones (crew_id, threshold)
				VALUES (my_crew, t.thresh) ON CONFLICT DO NOTHING;
			GET DIAGNOSTICS landed = ROW_COUNT;
			IF landed > 0 THEN
				FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
					INSERT INTO public.user_titles (user_id, title_id)
						VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
					UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
					BEGIN
						INSERT INTO public.system_announcements (user_id, kind, title, body, data)
						VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
							'Your Sounder has rooted ' || t.thresh ||
							' truffles out from under the Great Hungerer. The title "' ||
							t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
							jsonb_build_object('crew_id', my_crew, 'threshold', t.thresh, 'title_id', t.title_id));
					EXCEPTION WHEN OTHERS THEN NULL; END;
				END LOOP;
				milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
			END IF;
		END IF;
	END LOOP;

	UPDATE public.war_rootings SET
		submitted_at    = v_now,
		finds           = claimed,
		actions         = p_actions,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited
		WHERE user_id = caller_id AND window_index = win;

	PERFORM public.grant_season_xp(caller_id, 20);

	-- DIFF from the carried body: 'echo' (my_echo) and 'blessed' (blessed) added
	-- so the receipt can account for the crew-echo +1 and the blessing +1.
	RETURN jsonb_build_object(
		'ok',           true,
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'echo',         my_echo,
		'blessed',      blessed,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', unique_found,
		'carry_caught', carry_caught,
		'carry_next',   carry_next);
END;
$function$;
REVOKE ALL ON FUNCTION public._submit_rooting_reward_v1(text[],int,text[])
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._submit_rooting_deep_core(
	p_user_id uuid, p_window_index bigint, p_actions text[], p_layer smallint,
	p_finds text[], p_missed text[], p_things text[], p_close boolean
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	prior_sniffs int := 0;
	sniff_layer int := 0;   -- the layer prior_sniffs counts; reset on descent
	-- >>> rules 2 (the wake meter, §1)
	attention   int := 0;      -- the meter, in 120ths; reset per board under scope 'board'
	sleep_depth int := NULL;   -- T — his depth on the board the dig is on
	board_layer int := 0;      -- the layer the meter's T was drawn for
	di          int := 0;      -- draws consumed: board entries AND actions
	wm          jsonb;         -- the row's wake-meter stamp (never today's config)
	m_lo        int;
	m_hi        int;
	m_scope     text;
	-- <<< rules 2
	v_now       timestamptz := public._patch_now();
	prior       jsonb;
	row_r       record;
	crewed      boolean;
	log         text[] := COALESCE(p_actions, ARRAY[]::text[]);
	n           int;
	i           int;
	e           text;
	lyr         int;
	verb        text;
	last_layer  int := 0;
	seen        text[] := ARRAY[]::text[];
	draws       int[];
	thr         int;
	v_woke        boolean := false;
	v_woke_on     text := NULL;
	woke_layer  int := NULL;
	tied_layer  int;
	end_reason  text;
	valid       text[];
	claimed     text[] := ARRAY[]::text[];
	f           text;
	k           text;
	lost        text := NULL;           -- the truffle he took on a wake
	lost_id     text := NULL;           -- as the client named it
	missed_clean text[] := ARRAY[]::text[];
	m           text;
	things_clean text[];
	-- the loose pouch (2026-09-14)
	consumable_kinds text[] := ARRAY['boom','pouch','apple','shimmer','acorn','tea','scroll','charm'];
	collection_kinds text[] := ARRAY['junk','relic','furnishing','bow'];
	banked_things text[] := ARRAY[]::text[];   -- consumable ids the tie banked, client order
	lost_things   text[] := ARRAY[]::text[];   -- consumable ids lost with the pouch on a wake
	kept_things   text[] := ARRAY[]::text[];   -- collection ids, kept either way
	-- crewed economy (carried from _submit_rooting_reward_v1)
	prior_cnt   int := 0;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[] := ARRAY[]::text[];
	n_credited  int := 0;
	drain_total bigint := NULL;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
	v_cycle     text;
	the_carry   record;
	carry_gild  int := 0;
	carry_caught jsonb := NULL;
	carry_next  jsonb := NULL;
	best_miss   text;
	new_gild    int;
	-- the tally (2026-09-13): every find's tickles, applied once
	tickle_rows   jsonb := '[]'::jsonb;
	tickle_total  int := 0;
	tickled_before int := 0;
	tickled_now   int := 0;
	find_id     text;
	find_kind   text;
	find_tix    int;
	result      jsonb;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text||':'||p_window_index::text,0));
	SELECT receipt INTO prior FROM public.rooting_receipts
		WHERE user_id = p_user_id AND window_index = p_window_index;
	IF prior IS NOT NULL THEN RETURN prior; END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = p_user_id AND window_index = p_window_index FOR UPDATE;
	IF row_r.user_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.mode <> 'snout_deep' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'wrong_mode');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;
	crewed := row_r.crew_id IS NOT NULL;

	-- ── validate the log (pre-write: a bad log rejects with no side effects) ──
	n := COALESCE(array_length(log, 1), 0);
	IF n > 45 OR p_layer IS NULL OR p_layer < 0 OR p_layer > 2 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
	END IF;
	FOR i IN 1..n LOOP
		e := log[i];
		IF e IS NULL OR e !~ '^[srh][0-2]:([0-9]|[12][0-9])$' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
		END IF;
		lyr := substr(e, 2, 1)::int;
		IF lyr < last_layer THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
		END IF;
		last_layer := lyr;
		IF substr(e, 1, 1) = 's' THEN
			k := substr(e, 2);   -- "2:14" — one sniff per (layer, tile)
			IF k = ANY (seen) THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
			END IF;
			seen := seen || k;
		END IF;
	END LOOP;
	IF p_layer < last_layer THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_log');
	END IF;

	-- >>> rules 2 (the wake meter, §1)
	-- The tuning THIS dig was opened under. A rule-1 row has no stamp and never
	-- reads these; the fallback is the live row only so a stampless rule-2 row
	-- (there should be none) still plays a sane band instead of no band at all.
	wm      := COALESCE(row_r.wake_meter, public._snout_deep_wake_meter());
	m_lo    := COALESCE((wm ->> 'lo')::int, 50);
	m_hi    := COALESCE((wm ->> 'hi')::int, 110);
	m_scope := COALESCE(wm ->> 'scope', 'board');
	-- <<< rules 2

	-- ── replay the wake stream: the k-th entry takes the k-th draw ────────────
	IF n > 0 THEN
		draws := public._snout_deep_wake_draws(row_r.seed, n + 3);
		-- >>> rules 2 (the wake meter, §1)
		-- A board is ENTERED before anything happens on it, and the entry draws
		-- his sleep depth off the same stream: topsoil's T is the FIRST draw,
		-- taken BEFORE the first action, exactly where the kernel's initialState
		-- takes it. Three entries at most, hence n + 3 above.
		IF row_r.rules >= 2 THEN
			di := di + 1;
			sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);
		END IF;
		-- <<< rules 2
		FOR i IN 1..n LOOP
			e := log[i];
			lyr := substr(e, 2, 1)::int;
			verb := substr(e, 1, 1);
			-- The sniff budget (20260917130000), per BOARD (20260917150000):
			-- the k-th sniff past the budget draws his attention. prior_sniffs
			-- counts THIS LAYER's sniffs BEFORE this entry, the way the
			-- client's sniffCount(actions, layer) does — it refills on descent.
			IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;
			-- >>> rules 2 (the wake meter, §1)
			-- A descent enters a NEW board: one draw per layer entered (the
			-- kernel's descend() takes one), and under scope 'board' the meter
			-- starts again from 0 on it — the descent is quiet, which is what
			-- makes topsoil truly safe. Under scope 'dig' there is ONE T, taken
			-- at open, and the meter carries all the way down: no redraw, no
			-- reset. Then the action consumes its own draw — it decides nothing
			-- under the meter, but the stream has to advance exactly as the
			-- phone's wakeIndex does or a later board's T lands on the wrong
			-- number.
			IF row_r.rules >= 2 AND m_scope = 'board' THEN
				WHILE board_layer < lyr LOOP
					board_layer := board_layer + 1;
					di := di + 1;
					sleep_depth := m_lo + ((draws[di] * (m_hi - m_lo + 1)) / 120);
					attention := 0;
				END LOOP;
			END IF;
			IF row_r.rules >= 2 THEN di := di + 1; END IF;
			-- <<< rules 2
			-- The wake table IS the loudness under rule 2 (§1): one table, one
			-- tuning, read the same way by both rules.
			thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);
			IF verb = 's' THEN prior_sniffs := prior_sniffs + 1; END IF;
			-- >>> rules 2 (the wake meter, §1)
			-- The loudness LANDS first, then the compare: he wakes on the action
			-- that carries the meter to T or past it. No roll — draws[i] is not
			-- even read on this branch.
			IF row_r.rules >= 2 THEN
				attention := attention + thr;
				IF attention >= sleep_depth THEN
					v_woke := true;
					v_woke_on := e;
					woke_layer := lyr;
					log := log[1:i];   -- the waking action is IN the log; nothing after it
					n := i;
					EXIT;
				END IF;
			-- <<< rules 2
			ELSIF draws[i] < thr THEN
				v_woke := true;
				v_woke_on := e;
				woke_layer := lyr;
				log := log[1:i];   -- the waking action is IN the log; nothing after it
				n := i;
				EXIT;
			END IF;
		END LOOP;
	END IF;
	tied_layer := CASE WHEN v_woke THEN woke_layer ELSE p_layer::int END;
	end_reason := CASE WHEN v_woke THEN 'wake' WHEN p_close THEN 'close' ELSE 'tie' END;

	-- ── finds: the BANKED list — truffles against the board's parity set, ─────
	--    consumables by kind. Nothing banks without a tie: on a wake every
	--    consumable claimed is forced into the lost pouch (the loose pouch,
	--    2026-09-14), as the current layer's truffle is forced out below.
	valid := public.rooting_finds(row_r.seed);
	FOREACH f IN ARRAY COALESCE(p_finds, ARRAY[]::text[]) LOOP
		k := split_part(regexp_replace(f, '^l[0-2]:', ''), ':', 1);
		IF k IN ('truffle_d', 'truffle_l') THEN
			IF NOT (k = ANY (valid)) THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			-- A layer's truffle can only have banked once the dig reached that layer.
			IF k = 'truffle_l' AND tied_layer < 1 THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF NOT (k = ANY (claimed)) THEN claimed := claimed || k; END IF;
		ELSIF k = ANY (consumable_kinds) THEN
			-- Board-shaped ("l1:acorn" · "l0:boom"), from a layer the dig reached.
			IF f !~ '^l[0-2]:[a-z_]+(:[0-9]+)?$' THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF substr(f, 2, 1)::int > tied_layer THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			IF v_woke THEN
				IF NOT (f = ANY (lost_things)) THEN lost_things := lost_things || f; END IF;
			ELSIF NOT (f = ANY (banked_things)) THEN
				banked_things := banked_things || f;
			END IF;
		ELSE
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
	END LOOP;
	-- A wake takes the CURRENT layer's loose truffle: not credited, carried gilded.
	IF v_woke THEN
		k := CASE woke_layer WHEN 0 THEN 'truffle_d' WHEN 1 THEN 'truffle_l' ELSE NULL END;
		IF k IS NOT NULL AND k = ANY (claimed) THEN
			claimed := array_remove(claimed, k);
			lost := k;
		END IF;
	END IF;
	-- p_missed: truffles never something that was banked (carried def's rule);
	-- consumables only on a wake — the pouch he took (a tie banked everything
	-- loose, so a consumable missed on a tie is dropped).
	FOREACH m IN ARRAY COALESCE(p_missed, ARRAY[]::text[])
		|| CASE WHEN lost IS NULL THEN ARRAY[]::text[] ELSE ARRAY[lost] END LOOP
		k := split_part(regexp_replace(m, '^l[0-2]:', ''), ':', 1);
		IF k IN ('truffle_l', 'truffle_d') AND NOT (k = ANY (claimed))
		   AND NOT (k = ANY (missed_clean)) THEN
			missed_clean := missed_clean || k;
		ELSIF k = ANY (consumable_kinds) AND v_woke AND m ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$' THEN
			IF substr(m, 2, 1)::int <= tied_layer AND NOT (m = ANY (lost_things)) THEN
				lost_things := lost_things || m;
			END IF;
		END IF;
	END LOOP;
	-- Things: sanitised to board-shaped ids from a layer the dig reached, in
	-- the order the client sent them (the order they surfaced — the tally
	-- lands them in that order), deduped. Then sorted BY KIND, never by the
	-- list they arrived in: a collection thing is kept; a consumable joins the
	-- banked / lost lane; anything else is dropped.
	SELECT COALESCE(array_agg(x ORDER BY ord), ARRAY[]::text[]) INTO things_clean
		FROM (
			SELECT DISTINCT ON (x) x, ord
			FROM unnest(COALESCE(p_things, ARRAY[]::text[])) WITH ORDINALITY AS u(x, ord)
			WHERE x ~ '^l[0-2]:[a-z_]+(:[0-9]+)?$'
			  AND CASE WHEN x ~ '^l[0-2]:' THEN substr(x, 2, 1)::int ELSE 9 END <= tied_layer
			ORDER BY x, ord
		) AS firsts;
	FOREACH f IN ARRAY things_clean LOOP
		k := split_part(regexp_replace(f, '^l[0-2]:', ''), ':', 1);
		IF k = ANY (collection_kinds) THEN
			IF NOT (f = ANY (kept_things)) THEN kept_things := kept_things || f; END IF;
		ELSIF k = ANY (consumable_kinds) THEN
			IF v_woke THEN
				IF NOT (f = ANY (lost_things)) THEN lost_things := lost_things || f; END IF;
			ELSIF NOT (f = ANY (banked_things)) THEN
				banked_things := banked_things || f;
			END IF;
		END IF;
	END LOOP;
	things_clean := kept_things;

	-- The caller's carry slot BEFORE this dig (drives the catch/keep decision).
	SELECT kind, unique_id, gild INTO the_carry
		FROM public.user_patch_carry WHERE user_id = p_user_id;

	IF crewed THEN
		SELECT count(*) INTO prior_cnt FROM public.war_rootings
			WHERE crew_id = row_r.crew_id AND window_index = p_window_index
			  AND user_id <> p_user_id AND submitted_at IS NOT NULL;
		blessed := EXISTS (SELECT 1 FROM public.blessings
			WHERE receiver_id = p_user_id AND cleared_at IS NULL AND expires_at > v_now);

		-- Mints by layers banked (spec §4): 'dig' for the topsoil truffle,
		-- 'dig_deep' for the mud's, 'dig_root' when the mud truffle banked AND
		-- the dig tied at the root (the root has no truffle of its own).
		IF 'truffle_d' = ANY (claimed) THEN
			minted := minted + public.mint_truffles(p_user_id, 1, 'dig', NULL);
		END IF;
		IF 'truffle_l' = ANY (claimed) THEN
			minted := minted + public.mint_truffles(p_user_id, 1, 'dig_deep', NULL);
		END IF;
		IF 'truffle_l' = ANY (claimed) AND tied_layer = 2 AND NOT v_woke THEN
			-- >>> rules 2 (the wake meter, doc §5.3)
			-- Under a per-board meter the descent is SILENT, so tying the moment
			-- you arrive at the root would be a free +1 for walking downstairs.
			-- The stamp's dig_root_gt decides — default 0, withheld. A rule-1 row
			-- has no stamp and mints it exactly as it always did, and the client's
			-- gtReasons reads the same stamp, so the tie button's "+N Golden
			-- Truffles" and this mint never disagree.
			IF row_r.rules < 2 OR COALESCE((row_r.wake_meter ->> 'dig_root_gt')::int, 1) = 1 THEN
			-- <<< rules 2
				minted := minted + public.mint_truffles(p_user_id, 1, 'dig_root', NULL);
			-- >>> rules 2
			END IF;
			-- <<< rules 2
		END IF;
		-- Sounder Bonus + blessed dig: as the classic submit — a dig that banked
		-- a truffle gets +1 'dig_echo' when a crewmate submitted first, and +1
		-- 'blessed_dig' under an active blessing.
		IF array_length(claimed, 1) >= 1 THEN
			IF prior_cnt >= 1 THEN
				minted := minted + public.mint_truffles(p_user_id, 1, 'dig_echo', NULL);
				my_echo := true;
			END IF;
			IF blessed THEN
				minted := minted + public.mint_truffles(p_user_id, 1, 'blessed_dig', NULL);
			END IF;
		END IF;

		-- Pay back the earlier crewmates (either order): every submitted,
		-- minting, not-yet-echoed row in the crew this window.
		FOR r IN SELECT user_id FROM public.war_rootings
			WHERE crew_id = row_r.crew_id AND window_index = p_window_index
			  AND user_id <> p_user_id AND submitted_at IS NOT NULL
			  AND echo_credited = false AND truffles_minted >= 1
		LOOP
			PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
			UPDATE public.war_rootings SET echo_credited = true,
				truffles_minted = truffles_minted + 1
				WHERE user_id = r.user_id AND window_index = p_window_index;
			BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;

		IF minted > 0 THEN
			BEGIN PERFORM public.try_claim_achievements(p_user_id, 'truffles_dug');
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END IF;

		n_credited := COALESCE(array_length(claimed, 1), 0);   -- truffles only
	END IF;

	-- ── THE ONE THAT GOT AWAY — carry resolution (truffles; both modes) ───────
	-- (1) CAUGHT: a carried truffle is caught when either truffle banked this
	--     dig; its gild pays extra drain (crewed) and the slot clears.
	IF the_carry.kind IS NOT NULL THEN
		IF the_carry.kind IN ('truffle_l', 'truffle_d')
			AND ('truffle_l' = ANY (claimed) OR 'truffle_d' = ANY (claimed)) THEN
			carry_gild := the_carry.gild;
			DELETE FROM public.user_patch_carry WHERE user_id = p_user_id;
			carry_caught := jsonb_build_object('kind', the_carry.kind, 'gild', the_carry.gild);
		END IF;
	END IF;
	-- (2) NEXT: the best new miss (the fat one beats the domino) takes an
	--     empty slot at gild 1, or bumps a same-kind slot (cap 3).
	IF array_length(missed_clean, 1) IS NOT NULL THEN
		IF 'truffle_l' = ANY (missed_clean) THEN best_miss := 'truffle_l';
		ELSIF 'truffle_d' = ANY (missed_clean) THEN best_miss := 'truffle_d';
		END IF;
		IF best_miss IS NOT NULL THEN
			SELECT kind, unique_id, gild INTO the_carry
				FROM public.user_patch_carry WHERE user_id = p_user_id;
			IF the_carry.kind IS NULL THEN
				INSERT INTO public.user_patch_carry (user_id, kind, unique_id, gild, updated_at)
					VALUES (p_user_id, best_miss, NULL, 1, v_now);
				carry_next := jsonb_build_object('kind', best_miss, 'gild', 1);
			ELSIF the_carry.kind = best_miss THEN
				new_gild := LEAST(3, the_carry.gild + 1);
				UPDATE public.user_patch_carry
					SET gild = new_gild, unique_id = NULL, updated_at = v_now
					WHERE user_id = p_user_id;
				carry_next := jsonb_build_object('kind', best_miss, 'gild', new_gild);
			END IF;
		END IF;
	END IF;

	IF crewed THEN
		SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
			FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
			WHERE r2.crew_id = row_r.crew_id AND r2.window_index = p_window_index
			  AND r2.user_id <> p_user_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

		-- ── DRAIN (crewed only; truffles are the herd's) ─────────────────────
		-- The race attribution that stood here retired 2026-09-21: the drum
		-- counts receipts now.
		UPDATE public.hunger_drain SET total = total + n_credited + carry_gild WHERE id = true
			RETURNING total INTO drain_total;

		SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = row_r.crew_id FOR UPDATE;
		old_life := COALESCE(old_life, 0);
		new_life := old_life + n_credited;
		UPDATE public.crews SET lifetime_finds = new_life WHERE id = row_r.crew_id;

		FOR t IN SELECT * FROM (VALUES
			(150,  'mud_champion', 200,  'Root Rustler'),
			(600,  'mud_veteran',  1000, 'Truffle Baron'),
			(1800, 'mud_legend',   2000, 'Hunger''s Bane')
		) AS v(thresh, title_id, purse, title_name)
		LOOP
			IF old_life < t.thresh AND new_life >= t.thresh THEN
				INSERT INTO public.crew_milestones (crew_id, threshold)
					VALUES (row_r.crew_id, t.thresh) ON CONFLICT DO NOTHING;
				GET DIAGNOSTICS landed = ROW_COUNT;
				IF landed > 0 THEN
					FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = row_r.crew_id LOOP
						INSERT INTO public.user_titles (user_id, title_id)
							VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
						UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
						BEGIN
							INSERT INTO public.system_announcements (user_id, kind, title, body, data)
							VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
								'Your Sounder has rooted ' || t.thresh ||
								' truffles out from under the Great Hungerer. The title "' ||
								t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
								jsonb_build_object('crew_id', row_r.crew_id, 'threshold', t.thresh, 'title_id', t.title_id));
						EXCEPTION WHEN OTHERS THEN NULL; END;
					END LOOP;
					milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
				END IF;
			END IF;
		END LOOP;
	END IF;

	-- ── THE TALLY — every BANKED find pays tickles (§2), both modes ──────────
	-- Rows: the truffle he took (0 — it reads "his"), the consumables lost
	-- with the pouch (0 — they read "lost"), the banked truffles, the banked
	-- consumables, then the collection things — paid when the dig tied, kept
	-- at 0 when he woke (they read "kept"). The sum lands through
	-- apply_tickles: the count and the snouts, never the bank (§4).
	SELECT COALESCE(tickles_earned, 0) INTO tickled_before
		FROM public.profiles WHERE id = p_user_id;
	tickled_before := COALESCE(tickled_before, 0);
	IF lost IS NOT NULL THEN
		SELECT x INTO lost_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = lost LIMIT 1;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(lost_id, lost), 'kind', lost, 'tickles', 0, 'lost', true);
	END IF;
	FOREACH find_id IN ARRAY lost_things LOOP
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', find_id, 'kind', find_kind, 'tickles', 0, 'lost', true);
	END LOOP;
	FOREACH find_kind IN ARRAY claimed LOOP
		SELECT x INTO find_id FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x
			WHERE regexp_replace(x, '^l[0-2]:', '') = find_kind LIMIT 1;
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', COALESCE(find_id, find_kind), 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	FOREACH find_id IN ARRAY banked_things LOOP
		-- "l1:acorn" → acorn · "l0:boom" → boom (the catch-up's amount)
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
		tickle_total := tickle_total + find_tix;
		tickle_rows := tickle_rows || jsonb_build_object(
			'id', find_id, 'kind', find_kind, 'tickles', find_tix);
	END LOOP;
	FOREACH find_id IN ARRAY things_clean LOOP
		find_kind := split_part(regexp_replace(find_id, '^l[0-2]:', ''), ':', 1);
		IF v_woke THEN
			-- Kept — a Barn piece is a Barn piece — but its tickles rode the tie.
			tickle_rows := tickle_rows || jsonb_build_object(
				'id', find_id, 'kind', find_kind, 'tickles', 0, 'kept', true);
		ELSE
			find_tix := GREATEST(0, COALESCE(public._dig_find_tickles(p_user_id, find_kind), 0));
			tickle_total := tickle_total + find_tix;
			tickle_rows := tickle_rows || jsonb_build_object(
				'id', find_id, 'kind', find_kind, 'tickles', find_tix);
		END IF;
	END LOOP;
	tickled_now := public.apply_tickles(p_user_id, tickle_total);

	UPDATE public.war_rootings SET
		submitted_at    = v_now,
		finds           = claimed,
		actions         = n,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited,
		action_log      = log,
		layer_tied      = tied_layer,
		woke            = v_woke,
		woke_on         = v_woke_on
		WHERE user_id = p_user_id AND window_index = p_window_index;

	-- +20 Pass XP on every submitted dig, tied or woken, crewed or not.
	PERFORM public.grant_season_xp(p_user_id, 20);

	result := jsonb_build_object(
		'ok',           true,
		'mode',         'snout_deep',
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'echo',         my_echo,
		'blessed',      blessed,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', NULL,
		'carry_caught', carry_caught,
		'carry_next',   carry_next,
		'layer_tied',   tied_layer,
		'woke',         v_woke,
		'woke_on',      v_woke_on,
		'things',       things_clean,
		'actions',      n,
		'end_reason',   end_reason,
		'uncrewed',     NOT crewed,
		'closed',       p_close,
		-- the tally (2026-09-13)
		'tickles',        tickle_rows,
		'tickles_total',  tickle_total,
		-- >>> rules 2 (the wake meter, §1): the meter as the dig left it and the
		-- last board's T — the woke line reads "pushed the root on a rub at 84".
		-- 0 / NULL on a rule-1 row, which has no meter.
		'attention',      attention,
		'sleep_depth',    sleep_depth,
		-- <<< rules 2
		'tickled_before', tickled_before,
		'tickled_now',    tickled_now,
		-- the loose pouch (2026-09-14)
		'banked_things',  banked_things,
		'lost_things',    lost_things);
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt)
		VALUES (p_user_id, p_window_index, result)
		ON CONFLICT (user_id, window_index) DO NOTHING;
	SELECT receipt INTO result FROM public.rooting_receipts
		WHERE user_id = p_user_id AND window_index = p_window_index;
	RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public._submit_rooting_deep_core(uuid, bigint, text[], smallint, text[], text[], text[], boolean)
	FROM PUBLIC, anon, authenticated;

-- ── 15. Three doors left unlocked for shipped binaries ───────────────────────
-- A build already on a phone still asks for these. Each becomes a thin, honest
-- stub: an ok payload in the shape the client's defensive parser accepts, with
-- nothing in it. No standings, no ledger, no herd prize — because there is no
-- race. (utils/race.ts parseRaceStandings / parseRaceCrewDetail and
-- utils/barnDraw.ts parseHerdPrizeState are the parsers these shapes answer.)

CREATE OR REPLACE FUNCTION public.race_standings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk record;
BEGIN
	SELECT * INTO wk FROM public.draw_week_at(public._patch_now());
	RETURN jsonb_build_object(
		'cycle', jsonb_build_object('key', wk.cycle_key,
			'starts_at', wk.starts_at, 'ends_at', wk.ends_at),
		'ranked', '[]'::jsonb,
		'unranked', '[]'::jsonb,
		'mine', NULL,
		'last', NULL,
		'season', '[]'::jsonb,
		'mine_season', NULL,
		'retired', true,
		'prizes', jsonb_build_object(
			'tickles', jsonb_build_object('first', 0, 'second', 0, 'third', 0,
				'upper', 0, 'field', 0, 'participation', 0),
			'truffles', jsonb_build_object('first', 0, 'second', 0, 'third', 0,
				'upper', 0, 'field', 0),
			'furnishings', jsonb_build_object('all_who_dug', NULL, 'first', NULL)));
END;
$function$;
REVOKE ALL ON FUNCTION public.race_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_standings() TO authenticated;

CREATE OR REPLACE FUNCTION public.race_crew_detail(p_crew_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk    record;
	nm    text;
BEGIN
	IF p_crew_id IS NULL THEN RETURN NULL; END IF;
	SELECT c.name INTO nm FROM public.crews c WHERE c.id = p_crew_id;
	IF nm IS NULL THEN RETURN NULL; END IF;
	SELECT * INTO wk FROM public.draw_week_at(public._patch_now());
	RETURN jsonb_build_object(
		'cycle_key', wk.cycle_key,
		'crew_id', p_crew_id,
		'name', nm,
		'members', '[]'::jsonb,
		'retired', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_crew_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_crew_detail(uuid) TO authenticated;

-- `last` null reads to the client as "no herd prize has ever been drawn",
-- which is the honest line now that the per-crew prize has retired.
CREATE OR REPLACE FUNCTION public.herd_prize_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk record;
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO wk FROM public.draw_week_at(public._patch_now());
	RETURN jsonb_build_object(
		'ok', true,
		'week', jsonb_build_object('cycle_key', wk.cycle_key, 'seed_hash', NULL),
		'last', NULL,
		'retired', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.herd_prize_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.herd_prize_state() TO authenticated;

COMMENT ON FUNCTION public.draw_week_at(timestamptz) IS
	'The drum''s week: Monday 00:00 UTC to the next Monday, cycle_key = that Monday as YYYYMMDD. The draw''s own clock (spec docs/design/2026-09-21-season-page-rewrite.md §2).';
COMMENT ON FUNCTION public.monday_draw_state() IS
	'The drum, in one read: the drawable week (balls, cap, rolls, purse odds, the draw if taken) and the week in progress, plus when the drum next turns.';
COMMENT ON FUNCTION public.draw_monday_purse() IS
	'Turns the drum once for the caller: one weighted roll per ball, the best tier paid through apply_tickles. One row per (user, iso_week); re-calling returns the stored draw.';

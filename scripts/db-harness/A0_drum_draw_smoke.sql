-- The drum (20260921150000_drum_draw.sql): one lotto ball per submitted dig,
-- capped at the snout's own expected feedings; best-of-N over the tier table;
-- the odds as one closed form; the snapshot's exact shape; a ball-less week
-- refuses; and the perfect week reads receipts against the draw week's own
-- windows (no race_digs, no crew); and the one Monday push that survives.
\set ON_ERROR_STOP on

DO $drum_draw$
DECLARE
	d1 uuid := '00000000-0000-0000-0000-0000000a0001';  -- 7 digs
	d2 uuid := '00000000-0000-0000-0000-0000000a0002';  -- 25 digs (over the cap)
	d3 uuid := '00000000-0000-0000-0000-0000000a0003';  -- 0 digs
	d4 uuid := '00000000-0000-0000-0000-0000000a0004';  -- a perfect week (21 of 21)
	d5 uuid := '00000000-0000-0000-0000-0000000a0005';  -- 20 of 21 — nearly
	d6 uuid := '00000000-0000-0000-0000-0000000a0006';  -- 1 dig, no captured zone
	d7 uuid := '00000000-0000-0000-0000-0000000a0007';  -- is_test, dug all week
	wk        text := '20260316';                       -- Mon 2026-03-16 → 03-23
	wk_start  timestamptz := '2026-03-16 00:00+00';
	run_wk    text := '20260323';
	sched     jsonb := '{"mode":"commuter_local"}'::jsonb;
	st jsonb; res jsonb; again jsonb;
	before_t int; after_t int; before_c int; after_c int;
	ids bigint[]; k int; n_rolls int; best int; awarded int;
BEGIN
	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (d1),(d2),(d3),(d4),(d5),(d6),(d7) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,tickles_earned,counter,is_test) VALUES
		(d1,'drum-1',0,0,false),(d2,'drum-2',0,0,false),(d3,'drum-3',0,0,false),
		(d4,'drum-4',0,0,false),(d5,'drum-5',0,0,false),(d6,'drum-6',0,0,false)
		ON CONFLICT(id) DO UPDATE SET tickles_earned=0, counter=0, is_test=false;
	-- d7 is a test account (a profile row may already exist from the auth
	-- fixture, so the flag is set explicitly).
	INSERT INTO public.profiles(id,username,tickles_earned,counter,is_test)
		VALUES (d7,'drum-7',0,0,true)
		ON CONFLICT(id) DO UPDATE SET username='drum-7', is_test=true;
	-- Everyone but d6 has the week's zone captured (UTC, three feedings a day).
	INSERT INTO public.user_feeding_cycle_zones(user_id,cycle_key,time_zone,feeding_schedule)
	VALUES (d1,wk,'UTC',sched),(d2,wk,'UTC',sched),(d3,wk,'UTC',sched),
	       (d4,wk,'UTC',sched),(d5,wk,'UTC',sched),(d7,wk,'UTC',sched)
	ON CONFLICT DO NOTHING;
	-- d6's zone is NOT captured — the live-zone fallback must still find a cap.
	UPDATE public.profiles SET feeding_time_zone='UTC' WHERE id=d6;

	-- ── the draw's own week clock ───────────────────────────────────────────
	IF (SELECT cycle_key FROM public.draw_week_at('2026-03-16 00:00+00')) <> wk
	   OR (SELECT cycle_key FROM public.draw_week_at('2026-03-22 23:59+00')) <> wk
	   OR (SELECT cycle_key FROM public.draw_week_at('2026-03-23 00:00+00')) <> run_wk
	   OR (SELECT starts_at FROM public.draw_week_at('2026-03-18 09:00+00')) <> wk_start
	   OR (SELECT ends_at FROM public.draw_week_at('2026-03-18 09:00+00')) <> '2026-03-23 00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'draw_week_at drifted from Monday-to-Monday UTC';
	END IF;
	-- The DRAWABLE week is the one that just ended.
	IF (SELECT cycle_key FROM public._monday_draw_week('2026-03-24 12:00+00')) <> wk THEN
		RAISE EXCEPTION 'the drawable week should be the week that just ended';
	END IF;

	-- ── the cap is the snout's own feedings: 21 on the default schedule ─────
	IF public._monday_draw_cap(d1,wk) <> 21 THEN
		RAISE EXCEPTION 'cap should be 21, got %', public._monday_draw_cap(d1,wk); END IF;
	IF public._monday_draw_cap(d6,wk) <> 21 THEN
		RAISE EXCEPTION 'an uncaptured week must fall back to the live zone, got %',
			public._monday_draw_cap(d6,wk); END IF;

	-- ── the odds, printed from the tuning row (p = 12/100) ──────────────────
	IF public._monday_draw_odds_one_in(1) <> 8 OR public._monday_draw_odds_one_in(3) <> 3
	   OR public._monday_draw_odds_one_in(7) <> 2 OR public._monday_draw_odds_one_in(21) <> 1
	   OR public._monday_draw_odds_one_in(0) <> 8 THEN
		RAISE EXCEPTION 'odds drifted: % % % %', public._monday_draw_odds_one_in(1),
			public._monday_draw_odds_one_in(3), public._monday_draw_odds_one_in(7),
			public._monday_draw_odds_one_in(21);
	END IF;

	-- ── digs → balls ────────────────────────────────────────────────────────
	FOR k IN 1..7 LOOP
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d1, 700000+k, '{"ok":true}'::jsonb, wk_start + make_interval(hours=>k*4))
		ON CONFLICT DO NOTHING;
	END LOOP;
	FOR k IN 1..25 LOOP
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d2, 800000+k, '{"ok":true}'::jsonb, wk_start + make_interval(hours=>k*6))
		ON CONFLICT DO NOTHING;
	END LOOP;
	INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d6, 900001, '{"ok":true}'::jsonb, wk_start + interval '3 hours')
		ON CONFLICT DO NOTHING;
	FOR k IN 1..5 LOOP
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d7, 950000+k, '{"ok":true}'::jsonb, wk_start + make_interval(hours=>k*9))
		ON CONFLICT DO NOTHING;
	END LOOP;
	-- A dig ten minutes the wrong side of Monday belongs to the NEXT week.
	INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d1, 700099, '{"ok":true}'::jsonb, '2026-03-23 00:10+00')
		ON CONFLICT DO NOTHING;

	IF public._monday_draw_balls(d1,wk) <> 7 THEN
		RAISE EXCEPTION 'd1 should hold 7 balls, got %', public._monday_draw_balls(d1,wk); END IF;
	IF public._monday_draw_balls(d2,wk) <> 21 THEN
		RAISE EXCEPTION 'balls must cap at the week''s feedings, got %',
			public._monday_draw_balls(d2,wk); END IF;
	IF public._monday_draw_balls(d3,wk) <> 0 OR public._monday_draw_balls(d1,run_wk) <> 1 THEN
		RAISE EXCEPTION 'the receipt''s created_at decides its week'; END IF;
	-- The receipt trigger captured the running week's zone by itself.
	IF NOT EXISTS (SELECT 1 FROM public.user_feeding_cycle_zones
	               WHERE user_id=d1 AND cycle_key=run_wk) THEN
		RAISE EXCEPTION 'a receipt should capture its week''s zone'; END IF;

	-- Tuesday after the week: the purse is for the week that ended.
	PERFORM set_config('ttp.fake_now','2026-03-24 12:00+00',true);

	-- ── the snapshot, exactly ───────────────────────────────────────────────
	PERFORM set_config('smoke.uid', d1::text, true);
	st := public.monday_draw_state();
	IF st->>'week' <> wk OR (st->>'week_starts_at')::timestamptz <> wk_start
	   OR (st->>'week_ends_at')::timestamptz <> '2026-03-23 00:00+00'::timestamptz
	   OR NOT (st->>'eligible')::boolean OR (st->>'drawn')::boolean
	   OR st->>'amount' IS NOT NULL OR st->>'tier' IS NOT NULL
	   OR (st->>'balls')::int <> 7 OR (st->>'cap')::int <> 21
	   OR st->>'rolls' IS NOT NULL
	   OR (st->>'purse_odds_one_in')::int <> 2
	   OR st->>'running_week' <> run_wk
	   OR (st->>'running_balls')::int <> 1 OR (st->>'running_cap')::int <> 21
	   OR (st->>'running_odds_one_in')::int <> 8
	   OR (st->>'next_turn_at')::timestamptz <> '2026-03-30 00:00+00'::timestamptz
	   OR (st->>'next_turn_at')::timestamptz <> (st->>'running_ends_at')::timestamptz
	   OR jsonb_array_length(st->'tiers') <> 4 THEN
		RAISE EXCEPTION 'snapshot wrong: %', st;
	END IF;
	IF st ? 'mondays_since_rare' OR st ? 'herd_bottom_half'
	   OR st ? 'next_rare_odds_one_in' OR st ? 'catchup' THEN
		RAISE EXCEPTION 'the retired keys should be gone: %', st; END IF;
	IF (SELECT provolatile FROM pg_proc WHERE proname='monday_draw_state'
	    AND pronamespace='public'::regnamespace) <> 's' THEN
		RAISE EXCEPTION 'monday_draw_state must stay STABLE'; END IF;
	-- A ball-less week reads as an invitation, never a loss.
	PERFORM set_config('smoke.uid', d3::text, true);
	st := public.monday_draw_state();
	IF (st->>'eligible')::boolean OR (st->>'balls')::int <> 0
	   OR st->>'purse_odds_one_in' IS NOT NULL OR (st->>'running_odds_one_in')::int <> 8 THEN
		RAISE EXCEPTION 'a ball-less week: %', st; END IF;

	-- ── zero balls refuses, writes nothing, mints nothing ───────────────────
	res := public.draw_monday_purse();
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_eligible' THEN
		RAISE EXCEPTION 'a ball-less draw should refuse: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.monday_draws WHERE user_id=d3)
	   OR (SELECT tickles_earned FROM public.profiles WHERE id=d3) <> 0 THEN
		RAISE EXCEPTION 'a refused draw must not write or mint'; END IF;

	-- ── best of N ───────────────────────────────────────────────────────────
	PERFORM set_config('smoke.uid', d2::text, true);
	SELECT tickles_earned, counter INTO before_t, before_c FROM public.profiles WHERE id=d2;
	res := public.draw_monday_purse();
	IF NOT (res->>'ok')::boolean OR NOT (res->>'drawn')::boolean
	   OR (res->>'balls')::int <> 21 OR (res->>'cap')::int <> 21 THEN
		RAISE EXCEPTION 'd2 draw shape wrong: %', res; END IF;
	SELECT jsonb_array_length(res->'rolls') INTO n_rolls;
	IF n_rolls <> 21 THEN
		RAISE EXCEPTION 'the drum should roll once per ball, got %', n_rolls; END IF;
	-- The purse is the BEST tier rolled — read the amounts straight from tuning.
	SELECT max((t->>'amount')::int) INTO best
		FROM jsonb_array_elements(res->'rolls') r
		JOIN LATERAL jsonb_array_elements(public._monday_draw_tuning()->'tiers') t
			ON t->>'tier' = r #>> '{}';
	IF (res->>'amount')::int <> best THEN
		RAISE EXCEPTION 'the drum must pay the best roll (% vs %): %',
			res->>'amount', best, res->'rolls'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.monday_draws
	               WHERE user_id=d2 AND iso_week=wk AND balls=21 AND cap=21
	                 AND array_length(rolls,1)=21 AND amount=best) THEN
		RAISE EXCEPTION 'the receipt row should carry balls/cap/rolls'; END IF;
	SELECT tickles_earned, counter INTO after_t, after_c FROM public.profiles WHERE id=d2;
	IF after_t - before_t <> best OR after_c - before_c <> best THEN
		RAISE EXCEPTION 'the purse must land through apply_tickles: % → % / % → %',
			before_t, after_t, before_c, after_c; END IF;

	-- ── idempotent: a second tap echoes the first and mints nothing ─────────
	again := public.draw_monday_purse();
	IF again->>'tier' <> res->>'tier' OR (again->>'amount')::int <> (res->>'amount')::int
	   OR again->'rolls' <> res->'rolls' OR NOT (again->>'drawn')::boolean THEN
		RAISE EXCEPTION 'the second tap must echo the first: % vs %', again, res; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id=d2) <> after_t
	   OR (SELECT count(*) FROM public.monday_draws WHERE user_id=d2) <> 1 THEN
		RAISE EXCEPTION 'the second tap double-minted'; END IF;
	st := public.monday_draw_state();
	IF NOT (st->>'drawn')::boolean OR (st->>'amount')::int <> best
	   OR (st->>'balls')::int <> 21 OR st->'rolls' <> res->'rolls' THEN
		RAISE EXCEPTION 'the state should echo the stored draw: %', st; END IF;

	-- One ball, one spin, and the tuning row is the authority.
	PERFORM set_config('smoke.uid', d6::text, true);
	res := public.draw_monday_purse();
	IF NOT (res->>'ok')::boolean OR (res->>'balls')::int <> 1
	   OR jsonb_array_length(res->'rolls') <> 1
	   OR res->>'tier' <> (res->'rolls'->>0) THEN
		RAISE EXCEPTION 'one ball should roll once and pay it: %', res; END IF;

	-- ── the perfect week is a full drum ─────────────────────────────────────
	SELECT array_agg(window_index) INTO ids
		FROM public.user_draw_week_feeding_windows(d4, wk);
	IF array_length(ids,1) <> 21 THEN
		RAISE EXCEPTION 'the week should expect 21 feedings, got %', array_length(ids,1); END IF;
	FOR k IN 1..21 LOOP
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d4, ids[k], '{"ok":true}'::jsonb, wk_start + make_interval(hours=>k*7))
		ON CONFLICT DO NOTHING;
	END LOOP;
	FOR k IN 1..20 LOOP
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (d5, ids[k], '{"ok":true}'::jsonb, wk_start + make_interval(hours=>k*7))
		ON CONFLICT DO NOTHING;
	END LOOP;
	SELECT public.award_perfect_feeding_week(wk) INTO awarded;
	IF awarded < 1 THEN
		RAISE EXCEPTION 'a full drum should earn every_last_feeding, awarded %', awarded; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_achievements
	               WHERE user_id=d4 AND achievement_id='every_last_feeding') THEN
		RAISE EXCEPTION 'd4 dug every feeding and should be awarded'; END IF;
	IF EXISTS (SELECT 1 FROM public.user_achievements
	           WHERE user_id=d5 AND achievement_id='every_last_feeding') THEN
		RAISE EXCEPTION '20 of 21 is not a full drum'; END IF;
	IF EXISTS (SELECT 1 FROM public.user_achievements
	           WHERE user_id IN (d1,d2,d3,d6) AND achievement_id='every_last_feeding') THEN
		RAISE EXCEPTION 'only a covered week earns it'; END IF;
	-- One-time: a second sweep of the same week awards nobody twice.
	SELECT public.award_perfect_feeding_week(wk) INTO awarded;
	IF awarded <> 0 THEN
		RAISE EXCEPTION 'the perfect week should award once, got % on the re-run', awarded; END IF;
	-- A week still running awards nobody.
	IF public.award_perfect_feeding_week(to_char((now() AT TIME ZONE 'UTC')::date,'YYYYMMDD')) <> 0 THEN
		RAISE EXCEPTION 'an unfinished week must not award'; END IF;

	-- ── the one Monday push: one per snout who held a ball ──────────────────
	-- (send_push_to_user is the harness stand-in from 00j_feeding_push_prep,
	-- which records into smoke_push_calls — the same seam the race pushes used.)
	DELETE FROM public.smoke_push_calls WHERE target_user_id IN (d1,d2,d3,d4,d5,d6,d7);
	res := public.push_drum_turned(wk);
	IF NOT (res->>'ok')::boolean OR res->>'week' <> wk THEN
		RAISE EXCEPTION 'the drum push should run for an ended week: %', res; END IF;
	-- d1 (7), d2 (21), d4 (21), d5 (20), d6 (1) held balls; d3 held none and
	-- d7 is a test account.
	IF (SELECT count(*) FROM public.smoke_push_calls
	    WHERE target_user_id IN (d1,d2,d3,d4,d5,d6,d7)) <> 5 THEN
		RAISE EXCEPTION 'one push per ball-holding snout, got % (res=%)',
			(SELECT count(*) FROM public.smoke_push_calls
			 WHERE target_user_id IN (d1,d2,d3,d4,d5,d6,d7)), res; END IF;
	IF EXISTS (SELECT 1 FROM public.smoke_push_calls WHERE target_user_id IN (d3,d7)) THEN
		RAISE EXCEPTION 'a ball-less week and a test account get no push'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.smoke_push_calls
	               WHERE target_user_id=d1 AND push_title='The drum turned'
	                 AND push_body='7 balls in — see what you drew.'
	                 AND push_data->>'screen'='season' AND push_data->>'kind'='monday_draw'
	                 AND push_data->>'week'=wk AND (push_data->>'balls')::int=7) THEN
		RAISE EXCEPTION 'd1''s push copy/payload wrong: %',
			(SELECT jsonb_build_object('t',push_title,'b',push_body,'d',push_data)
			 FROM public.smoke_push_calls WHERE target_user_id=d1); END IF;
	-- The singular reads "1 ball in", never "1 balls in".
	IF NOT EXISTS (SELECT 1 FROM public.smoke_push_calls
	               WHERE target_user_id=d6 AND push_body='1 ball in — see what you drew.') THEN
		RAISE EXCEPTION 'one ball should read singular: %',
			(SELECT push_body FROM public.smoke_push_calls WHERE target_user_id=d6); END IF;
	IF (SELECT count(*) FROM public.drum_push_deliveries
	    WHERE iso_week=wk AND user_id IN (d1,d2,d3,d4,d5,d6,d7)) <> 5
	   OR NOT EXISTS (SELECT 1 FROM public.drum_push_deliveries
	                  WHERE user_id=d1 AND iso_week=wk AND balls=7 AND request_id IS NOT NULL) THEN
		RAISE EXCEPTION 'the delivery table should hold one receipted row per push'; END IF;
	-- A second run sends nothing at all.
	res := public.push_drum_turned(wk);
	IF NOT (res->>'ok')::boolean OR (res->>'queued')::int <> 0
	   OR (SELECT count(*) FROM public.smoke_push_calls
	       WHERE target_user_id IN (d1,d2,d3,d4,d5,d6,d7)) <> 5 THEN
		RAISE EXCEPTION 'a re-run must never double-send: %', res; END IF;
	-- The week in progress has nothing to announce.
	res := public.push_drum_turned(to_char((now() AT TIME ZONE 'UTC')::date,'YYYYMMDD'));
	IF (res->>'ok')::boolean OR res->>'reason' NOT IN ('week_running','bad_week') THEN
		RAISE EXCEPTION 'an unfinished week must not push: %', res; END IF;

	-- ── no dig writes the race any more ─────────────────────────────────────
	-- A catalog sweep, not a spot check: if ANY function still inserts
	-- race_digs, the follow-up table drop would break it.
	IF EXISTS (
		SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
		WHERE n.nspname = 'public' AND p.prosrc LIKE '%INSERT INTO public.race_digs%'
	) THEN
		RAISE EXCEPTION 'still writing race_digs: %', (
			SELECT string_agg(p.proname, ', ') FROM pg_proc p
			JOIN pg_namespace n ON n.oid = p.pronamespace
			WHERE n.nspname='public' AND p.prosrc LIKE '%INSERT INTO public.race_digs%');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
	               WHERE n.nspname='public' AND p.proname='_submit_rooting_reward_v1')
	   OR NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
	                  WHERE n.nspname='public' AND p.proname='_submit_rooting_deep_core') THEN
		RAISE EXCEPTION 'the carried dig functions should still exist'; END IF;
	-- The retired moving parts are gone.
	IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
	           WHERE n.nspname='public' AND p.proname IN
	             ('_monday_draw_multiplier','_monday_draw_streak_before','_monday_draw_herd_bottom_half')) THEN
		RAISE EXCEPTION 'the catch-up helpers should be dropped'; END IF;
	IF (SELECT value FROM public.app_settings WHERE key='monday_draw') ? 'catchup' THEN
		RAISE EXCEPTION 'the catchup tuning key should be gone'; END IF;
	IF jsonb_array_length((SELECT value->'tiers' FROM public.app_settings WHERE key='monday_draw')) <> 4 THEN
		RAISE EXCEPTION 'the tiers must survive untouched'; END IF;

	-- ── the race's doors answer, empty ──────────────────────────────────────
	PERFORM set_config('smoke.uid', d1::text, true);
	st := public.race_standings();
	IF jsonb_array_length(st->'ranked') <> 0 OR jsonb_array_length(st->'season') <> 0
	   OR st->>'mine' IS NOT NULL OR (st->'prizes'->'tickles'->>'first')::int <> 0 THEN
		RAISE EXCEPTION 'race_standings should answer empty: %', st; END IF;
	st := public.herd_prize_state();
	IF NOT (st->>'ok')::boolean OR st->>'last' IS NOT NULL THEN
		RAISE EXCEPTION 'herd_prize_state should answer empty: %', st; END IF;

	PERFORM set_config('ttp.fake_now','',true);
	RAISE NOTICE 'chk drum: balls + cap + best-of-N + odds + perfect week + the Monday push OK';
END
$drum_draw$;

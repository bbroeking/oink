-- Season 2, "The Feast" (20261029190000_season_2_the_feast.sql): the season is
-- seeded dark; active_season()'s season_preview replaces the world_boss pin;
-- flip_season_2() hands over, baselines the meter and the Board, archives then
-- zeroes the tickle bank / snouts / Satchel per the scope row, turns Leftovers
-- on; a second flip is a no-op; unflip_season_2() restores everything exactly
-- (additively); both are service-role only.
\set ON_ERROR_STOP on

DO $season2$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000b0001';  -- the founder (preview)
	u2 uuid := '00000000-0000-0000-0000-0000000b0002';  -- a player with a bank, snouts, a Satchel
	u3 uuid := '00000000-0000-0000-0000-0000000b0003';  -- a friend (gave u2 a find)
	u4 uuid := '00000000-0000-0000-0000-0000000b0004';  -- a leftover but no digs
	u5 uuid := '00000000-0000-0000-0000-0000000b0005';  -- a giver who deletes their account
	u6 uuid := '00000000-0000-0000-0000-0000000b0006';  -- world_boss only (the old pin)
	u7 uuid := '00000000-0000-0000-0000-0000000b0007';  -- previews a season already live
	wk_a text := '20260406'; wk_b text := '20260413'; wk_c text := '20260420';
	sched jsonb := '{"mode":"commuter_local"}'::jsonb;
	real_tuning jsonb;
	res jsonb; st jsonb; m jsonb;
	id_a bigint; id_b bigint; id_c bigint;
	k int;
	n_bag int;
BEGIN
	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (u1),(u2),(u3),(u4),(u5),(u6),(u7) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id, username, tickles_earned, counter, is_test, feature_overrides) VALUES
		(u1, 'feast-founder', 100, 10, false, '{"world_boss": true, "season_preview": "snout_season_2"}'),
		(u2, 'feast-2',       900, 300, false, '{}'),
		(u3, 'feast-3',       400, 0,   false, '{}'),
		(u4, 'feast-4',       0,   0,   false, '{}'),
		(u5, 'feast-5',       0,   0,   false, '{}'),
		(u6, 'feast-6',       0,   0,   false, '{"world_boss": true}'),
		(u7, 'feast-7',       0,   0,   false, '{"season_preview": "snout_season_1"}')
	ON CONFLICT (id) DO UPDATE SET tickles_earned = EXCLUDED.tickles_earned,
		counter = EXCLUDED.counter, feature_overrides = EXCLUDED.feature_overrides, is_test = false;
	UPDATE public.profiles SET golden_truffles = 4, wallow_count = 2 WHERE id = u2;
	INSERT INTO public.user_items(user_id, item_count, last_increment) VALUES
		(u2, 7, now()), (u3, 3, now())
	ON CONFLICT (user_id) DO UPDATE SET item_count = EXCLUDED.item_count, last_increment = now(), regen_progress = 0;
	INSERT INTO public.user_hats(user_id, hat_id) VALUES (u2, 'muddy_cap') ON CONFLICT DO NOTHING;
	INSERT INTO public.satchel_items(user_id, find_id, source) VALUES (u2, 'river_pebble', 'dig') RETURNING id INTO id_a;
	INSERT INTO public.satchel_items(user_id, find_id, source, from_user_id) VALUES (u2, 'marble', 'swap', u3) RETURNING id INTO id_b;
	INSERT INTO public.satchel_items(user_id, find_id, source, from_user_id) VALUES (u2, 'old_key', 'gift', u5) RETURNING id INTO id_c;
	INSERT INTO public.satchel_met(user_id, find_id) VALUES (u2, 'river_pebble') ON CONFLICT DO NOTHING;
	-- S1 live now, S2 dark (the stub's dates are older than this suite); the
	-- fixture seasons earlier smokes left running are parked in the past.
	UPDATE public.seasons SET starts_at = now() - interval '200 days', ends_at = now() - interval '150 days'
		WHERE id NOT IN ('snout_season_0', 'snout_season_1', 'snout_season_2') AND ends_at > now();
	UPDATE public.seasons SET starts_at = now() - interval '100 days', ends_at = now() + interval '30 days'
		WHERE id = 'snout_season_1';
	UPDATE public.hunger_drain SET total = 2000 WHERE id = true;
	INSERT INTO public.user_feeding_cycle_zones(user_id, cycle_key, time_zone, feeding_schedule)
	VALUES (u2, wk_a, 'UTC', sched), (u2, wk_b, 'UTC', sched), (u2, wk_c, 'UTC', sched),
	       (u3, wk_a, 'UTC', sched), (u4, wk_b, 'UTC', sched), (u4, wk_c, 'UTC', sched)
	ON CONFLICT DO NOTHING;
	SELECT value INTO real_tuning FROM public.app_settings WHERE key = 'monday_draw';

	-- ── seeded dark ─────────────────────────────────────────────────────────
	IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id = 'snout_season_2' AND name = 'The Feast'
	               AND starts_at > now() + interval '50 years') THEN
		RAISE EXCEPTION 'snout_season_2 must be seeded at the far-future placeholder'; END IF;
	IF (SELECT count(*) FROM public.season_tiers WHERE season_id = 'snout_season_2') <> 28
	   OR (SELECT count(*) FROM public.season_tiers WHERE season_id = 'snout_season_2' AND track = 'premium'
	       AND reward_type IN ('tickles', 'boost')) <> 0
	   OR (SELECT count(*) FROM public.season_tiers WHERE season_id = 'snout_season_2' AND track = 'premium'
	       AND reward_value ->> 'hat_id' IN ('ganache_truffle_crown','slop_pail_topper','truffle_medal_held',
	         'drip_glaze_aura','spa_wallow_bg','cocoa_sheen_specs','caramel_drip_bow','corn_on_the_cob',
	         'slop_club_signet_crown')) <> 9 THEN
		RAISE EXCEPTION 'the Feast track is wrong'; END IF;
	IF (SELECT count(*) FROM public.titles WHERE id IN ('trencherman','of_the_long_table','larder_keeper',
	    'second_helpings','the_well_rested','feast_bringer') AND source = 'season' AND NOT for_sale) <> 6 THEN
		RAISE EXCEPTION 'the six Feast titles are missing'; END IF;
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), true) THEN
		RAISE EXCEPTION 'season2_flipped must be seeded false'; END IF;

	-- ── active_season(): preview, no pin ────────────────────────────────────
	PERFORM set_config('smoke.uid', u2::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_1' THEN
		RAISE EXCEPTION 'a player should be in Season 1 before the flip, got % (seasons: %)',
			(SELECT id FROM public.active_season()),
			(SELECT jsonb_agg(jsonb_build_object('id', id, 's', starts_at, 'e', ends_at)) FROM public.seasons); END IF;
	PERFORM set_config('smoke.uid', u1::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_2' THEN
		RAISE EXCEPTION 'the founder should preview Season 2 while dates say Season 1'; END IF;
	PERFORM set_config('smoke.uid', u7::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_1' THEN
		RAISE EXCEPTION 'a preview of a live season falls back to the dates'; END IF;
	PERFORM set_config('smoke.uid', u6::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_1' THEN
		RAISE EXCEPTION 'world_boss alone should read the dates'; END IF;
	PERFORM set_config('smoke.uid', '', true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_1' THEN
		RAISE EXCEPTION 'an anonymous caller reads the dates'; END IF;

	-- ── the meter and the Board before the flip ─────────────────────────────
	m := public.hunger_meter();
	IF (m ->> 'total')::int <> 2000 OR m ->> 'stage' <> 'full' THEN
		RAISE EXCEPTION 'pre-flip meter wrong: %', m; END IF;
	IF (SELECT season_tickles_earned FROM public.profiles WHERE id = u2) <> 900 THEN
		RAISE EXCEPTION 'before the flip the season column equals the lifetime one'; END IF;

	-- ── Leftovers are dark: a below-rare purse leaves nothing ──────────────
	UPDATE public.app_settings SET value = '{"tiers":[{"tier":"common","amount":20,"weight":100}]}'::jsonb
		WHERE key = 'monday_draw';
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt, created_at)
	VALUES (u3, 910101, '{"ok":true}'::jsonb, '2026-04-07 09:00+00') ON CONFLICT DO NOTHING;
	PERFORM set_config('ttp.fake_now', '2026-04-14 12:00+00', true);
	PERFORM set_config('smoke.uid', u3::text, true);
	res := public.draw_monday_purse();
	IF res ->> 'tier' <> 'common' OR EXISTS (SELECT 1 FROM public.monday_draw_leftovers WHERE user_id = u3) THEN
		RAISE EXCEPTION 'Leftovers must stay off before the flip: %', res; END IF;
	-- the 20 tickles just paid
	UPDATE public.profiles SET counter = 0, tickles_earned = 400 WHERE id = u3;

	-- ── service-role only ───────────────────────────────────────────────────
	IF has_function_privilege('authenticated', 'public.flip_season_2(timestamptz,int)', 'EXECUTE')
	   OR has_function_privilege('anon', 'public.flip_season_2(timestamptz,int)', 'EXECUTE')
	   OR has_function_privilege('authenticated', 'public.unflip_season_2()', 'EXECUTE')
	   OR has_function_privilege('anon', 'public.unflip_season_2()', 'EXECUTE')
	   OR NOT has_function_privilege('service_role', 'public.flip_season_2(timestamptz,int)', 'EXECUTE')
	   OR NOT has_function_privilege('service_role', 'public.unflip_season_2()', 'EXECUTE') THEN
		RAISE EXCEPTION 'flip/unflip must be service-role only'; END IF;

	-- ── THE FLIP ────────────────────────────────────────────────────────────
	PERFORM set_config('smoke.uid', '', true);
	res := public.flip_season_2(now(), 8);
	IF NOT (res ->> 'ok')::boolean OR (res ->> 'already_flipped')::boolean THEN
		RAISE EXCEPTION 'flip failed: %', res; END IF;
	IF NOT (SELECT enabled FROM public.app_config WHERE key = 'season2_flipped') THEN
		RAISE EXCEPTION 'the guard should be set'; END IF;

	PERFORM set_config('smoke.uid', u2::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_2' THEN
		RAISE EXCEPTION 'a player should be in Season 2 after the flip'; END IF;
	PERFORM set_config('smoke.uid', u6::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_2' THEN
		RAISE EXCEPTION 'the old world_boss pin must not strand anyone in Season 1'; END IF;
	PERFORM set_config('smoke.uid', u1::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_2' THEN
		RAISE EXCEPTION 'the founder should be in Season 2 after the flip'; END IF;
	IF (SELECT ends_at - starts_at FROM public.seasons WHERE id = 'snout_season_2') <> interval '56 days' THEN
		RAISE EXCEPTION 'Season 2 should run eight weeks'; END IF;

	-- The meter starts at zero, then fills; thresholds tune only a live meter.
	m := public.hunger_meter();
	IF (m ->> 'total')::int <> 0 OR m ->> 'stage' <> 'gorged' OR (m ->> 'next_threshold')::int <> 600 THEN
		RAISE EXCEPTION 'post-flip meter should be baselined: %', m; END IF;
	UPDATE public.hunger_drain SET total = 2700 WHERE id = true;
	m := public.hunger_meter();
	IF (m ->> 'total')::int <> 700 OR m ->> 'stage' <> 'stuffed' THEN
		RAISE EXCEPTION 'meter should read total - baseline: %', m; END IF;
	UPDATE public.app_settings SET value = value || '{"thresholds":[100,200,300,400,500]}'::jsonb
		WHERE key = 'season_meter';
	m := public.hunger_meter();
	IF m ->> 'stage' <> 'famished' OR m ->> 'next_threshold' IS NOT NULL THEN
		RAISE EXCEPTION 'tuned thresholds should apply: %', m; END IF;
	UPDATE public.app_settings SET value = value || '{"thresholds":[5,4,3,2,1]}'::jsonb
		WHERE key = 'season_meter';
	m := public.hunger_meter();
	IF m ->> 'stage' <> 'stuffed' THEN
		RAISE EXCEPTION 'malformed thresholds must fall back: %', m; END IF;
	UPDATE public.app_settings SET value = value || '{"thresholds":[100,200,300,400,500]}'::jsonb
		WHERE key = 'season_meter';

	-- The Board: the season column restarts; the lifetime number is untouched.
	IF (SELECT season_tickles_earned FROM public.profiles WHERE id = u2) <> 0
	   OR (SELECT tickles_earned FROM public.profiles WHERE id = u2) <> 900
	   OR (SELECT value ->> 'column' FROM public.app_settings WHERE key = 'board_sort_column') <> 'season_tickles_earned'
	   OR (SELECT tickles_earned FROM public.season1_tickle_standings WHERE user_id = u2) <> 900
	   OR (SELECT rank FROM public.season1_tickle_standings WHERE user_id = u2)
	      >= (SELECT rank FROM public.season1_tickle_standings WHERE user_id = u3) THEN
		RAISE EXCEPTION 'the Board baseline / S1 standings are wrong'; END IF;

	-- The full fresh start: archived, then zeroed.
	IF (SELECT item_count FROM public.user_items WHERE user_id = u2) <> 0
	   OR public.tickle_balance(u2) <> 0
	   OR (SELECT counter FROM public.profiles WHERE id = u2) <> 0
	   OR EXISTS (SELECT 1 FROM public.satchel_items WHERE user_id = u2) THEN
		RAISE EXCEPTION 'the bank, snouts and Satchel should be zeroed'; END IF;
	IF (SELECT (payload ->> 'balance')::int FROM public.season_reset_archive
	    WHERE user_id = u2 AND season_id = 'snout_season_2' AND kind = 'tickle_bank') <> 7
	   OR (SELECT (payload ->> 'counter')::int FROM public.season_reset_archive
	    WHERE user_id = u2 AND season_id = 'snout_season_2' AND kind = 'snouts') <> 300
	   OR (SELECT jsonb_array_length(payload) FROM public.season_reset_archive
	    WHERE user_id = u2 AND season_id = 'snout_season_2' AND kind = 'satchel') <> 3 THEN
		RAISE EXCEPTION 'the archive should hold the pre-flip values'; END IF;
	-- Kept: cosmetics, Golden Truffles, Wallow rank, discovery, lifetime.
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u2 AND hat_id = 'muddy_cap')
	   OR (SELECT golden_truffles FROM public.profiles WHERE id = u2) <> 4
	   OR (SELECT wallow_count FROM public.profiles WHERE id = u2) <> 2
	   OR NOT EXISTS (SELECT 1 FROM public.satchel_met WHERE user_id = u2 AND find_id = 'river_pebble') THEN
		RAISE EXCEPTION 'the flip must keep what it promised to keep'; END IF;

	-- The fresh-start receipt: only the caller's own non-zero buckets.
	PERFORM set_config('smoke.uid', u2::text, true);
	res := public.my_season_reset();
	IF res ->> 'season_id' <> 'snout_season_2'
	   OR res -> 'kinds' <> '["satchel", "snouts", "tickle_bank"]'::jsonb THEN
		RAISE EXCEPTION 'u2 should see all three buckets: %', res; END IF;
	PERFORM set_config('smoke.uid', u4::text, true);
	res := public.my_season_reset();
	IF res -> 'kinds' <> '[]'::jsonb THEN
		RAISE EXCEPTION 'a pig with nothing to reset sees nothing: %', res; END IF;
	IF has_function_privilege('anon', 'public.my_season_reset()', 'EXECUTE') THEN
		RAISE EXCEPTION 'my_season_reset is for signed-in pigs only'; END IF;

	-- A second flip is a no-op.
	PERFORM set_config('smoke.uid', '', true);
	UPDATE public.profiles SET counter = 5 WHERE id = u2;
	res := public.flip_season_2(now(), 8);
	IF NOT (res ->> 'already_flipped')::boolean OR (SELECT counter FROM public.profiles WHERE id = u2) <> 5 THEN
		RAISE EXCEPTION 'a second flip must change nothing: %', res; END IF;
	UPDATE public.profiles SET counter = 0 WHERE id = u2;

	-- ── Leftovers, live ─────────────────────────────────────────────────────
	FOR k IN 1..3 LOOP
		INSERT INTO public.rooting_receipts(user_id, window_index, receipt, created_at)
		VALUES (u2, 920000 + k, '{"ok":true}'::jsonb, '2026-04-06 00:00+00'::timestamptz + make_interval(hours => k * 8))
		ON CONFLICT DO NOTHING;
	END LOOP;
	PERFORM set_config('ttp.fake_now', '2026-04-14 12:00+00', true);
	PERFORM set_config('smoke.uid', u2::text, true);
	res := public.draw_monday_purse();
	IF res ->> 'tier' <> 'common' OR (res ->> 'balls')::int <> 3 OR (res ->> 'leftover_balls')::int <> 0
	   OR jsonb_array_length(res -> 'rolls') <> 3 THEN
		RAISE EXCEPTION 'week A draw wrong: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.monday_draw_leftovers
	               WHERE user_id = u2 AND from_week = wk_a AND to_week = wk_b) THEN
		RAISE EXCEPTION 'a below-rare purse should leave a ball for next week'; END IF;
	IF (res ->> 'running_leftover_balls')::int <> 1
	   OR (res ->> 'running_odds_one_in')::int <> public._monday_draw_odds_one_in(2) THEN
		RAISE EXCEPTION 'the running week should show the leftover: %', res; END IF;
	-- u4 holds a leftover for week B but never digs in it.
	INSERT INTO public.monday_draw_leftovers(user_id, from_week, to_week) VALUES (u4, wk_a, wk_b)
		ON CONFLICT DO NOTHING;

	FOR k IN 1..2 LOOP
		INSERT INTO public.rooting_receipts(user_id, window_index, receipt, created_at)
		VALUES (u2, 930000 + k, '{"ok":true}'::jsonb, '2026-04-13 00:00+00'::timestamptz + make_interval(hours => k * 8))
		ON CONFLICT DO NOTHING;
	END LOOP;
	PERFORM set_config('ttp.fake_now', '2026-04-21 12:00+00', true);
	st := public.monday_draw_state();
	IF st ->> 'week' <> wk_b OR (st ->> 'balls')::int <> 2 OR (st ->> 'leftover_balls')::int <> 1
	   OR (st ->> 'purse_odds_one_in')::int <> public._monday_draw_odds_one_in(3) THEN
		RAISE EXCEPTION 'week B state should count the leftover beside the digs: %', st; END IF;
	res := public.draw_monday_purse();
	IF (res ->> 'balls')::int <> 2 OR (res ->> 'leftover_balls')::int <> 1
	   OR jsonb_array_length(res -> 'rolls') <> 3
	   OR (SELECT leftover_balls FROM public.monday_draws WHERE user_id = u2 AND iso_week = wk_b) <> 1 THEN
		RAISE EXCEPTION 'the leftover should roll as one more ball: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.monday_draw_leftovers WHERE user_id = u2 AND to_week = wk_c) THEN
		RAISE EXCEPTION 'another below-rare purse leaves another (single) ball'; END IF;
	PERFORM set_config('smoke.uid', u4::text, true);
	st := public.monday_draw_state();
	IF (st ->> 'eligible')::boolean OR (st ->> 'leftover_balls')::int <> 0 THEN
		RAISE EXCEPTION 'a leftover alone is not a draw: %', st; END IF;
	UPDATE public.app_settings SET value = real_tuning WHERE key = 'monday_draw';
	PERFORM set_config('ttp.fake_now', '', true);

	-- Season-2 earnings after the flip: 2 x 20 tickles.
	IF (SELECT counter FROM public.profiles WHERE id = u2) <> 40
	   OR (SELECT season_tickles_earned FROM public.profiles WHERE id = u2) <> 40
	   OR (SELECT tickles_earned FROM public.profiles WHERE id = u2) <> 940 THEN
		RAISE EXCEPTION 'post-flip earnings wrong: counter %, season %, lifetime %',
			(SELECT counter FROM public.profiles WHERE id = u2),
			(SELECT season_tickles_earned FROM public.profiles WHERE id = u2),
			(SELECT tickles_earned FROM public.profiles WHERE id = u2); END IF;
	-- A find dug after the flip stays when the old bag comes back.
	INSERT INTO public.satchel_items(user_id, find_id, source) VALUES (u2, 'pinecone', 'dig');
	-- The giver of one archived find deletes their account in between.
	DELETE FROM auth.users WHERE id = u5;
	-- (receipts drop finds into the bag too; count what is there now)
	SELECT count(*) INTO n_bag FROM public.satchel_items WHERE user_id = u2;

	-- ── THE UNFLIP ──────────────────────────────────────────────────────────
	PERFORM set_config('smoke.uid', '', true);
	res := public.unflip_season_2();
	IF NOT (res ->> 'ok')::boolean OR (res ->> 'already_unflipped')::boolean THEN
		RAISE EXCEPTION 'unflip failed: %', res; END IF;
	IF (SELECT enabled FROM public.app_config WHERE key = 'season2_flipped') THEN
		RAISE EXCEPTION 'the guard should be cleared'; END IF;

	PERFORM set_config('smoke.uid', u2::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_1' THEN
		RAISE EXCEPTION 'unflip should hand a player back to Season 1'; END IF;
	PERFORM set_config('smoke.uid', u1::text, true);
	IF (SELECT id FROM public.active_season()) <> 'snout_season_2' THEN
		RAISE EXCEPTION 'after unflip the founder previews Season 2 again'; END IF;
	IF (SELECT starts_at FROM public.seasons WHERE id = 'snout_season_2') < now() + interval '50 years'
	   OR (SELECT ends_at FROM public.seasons WHERE id = 'snout_season_1') < now() + interval '29 days' THEN
		RAISE EXCEPTION 'unflip should restore both windows'; END IF;

	m := public.hunger_meter();
	IF (m ->> 'total')::int <> 2700 OR m ->> 'stage' <> 'full' OR (m ->> 'next_threshold')::int <> 3600 THEN
		RAISE EXCEPTION 'unflip should drop the baseline (and park the tuned thresholds): %', m; END IF;

	IF (SELECT season_tickles_earned FROM public.profiles WHERE id = u2) <> 940
	   OR EXISTS (SELECT 1 FROM public.season1_tickle_standings)
	   OR (SELECT value ->> 'column' FROM public.app_settings WHERE key = 'board_sort_column') <> 'tickles_earned' THEN
		RAISE EXCEPTION 'unflip should restore the Board'; END IF;

	IF (SELECT item_count FROM public.user_items WHERE user_id = u2) <> 7
	   OR (SELECT item_count FROM public.user_items WHERE user_id = u3) <> 3 THEN
		RAISE EXCEPTION 'unflip should add the archived bank back: %',
			(SELECT item_count FROM public.user_items WHERE user_id = u2); END IF;
	IF (SELECT counter FROM public.profiles WHERE id = u2) <> 340
	   OR (SELECT counter FROM public.profiles WHERE id = u1) <> 10 THEN
		RAISE EXCEPTION 'unflip should add the archived snouts back: %',
			(SELECT counter FROM public.profiles WHERE id = u2); END IF;
	IF (SELECT count(*) FROM public.satchel_items WHERE user_id = u2) <> n_bag + 3
	   OR NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = id_a AND user_id = u2 AND find_id = 'river_pebble')
	   OR NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = id_b AND from_user_id = u3 AND source = 'swap')
	   OR NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = id_c AND from_user_id IS NULL AND source = 'gift') THEN
		RAISE EXCEPTION 'unflip should return the same finds, same ids: % (a=%, b=%, c=%)',
			(SELECT jsonb_agg(to_jsonb(si)) FROM public.satchel_items si WHERE si.user_id = u2), id_a, id_b, id_c; END IF;
	IF EXISTS (SELECT 1 FROM public.season_reset_archive WHERE season_id = 'snout_season_2') THEN
		RAISE EXCEPTION 'unflip should consume the archive'; END IF;
	PERFORM set_config('smoke.uid', u2::text, true);
	res := public.my_season_reset();
	IF res ->> 'season_id' <> 'snout_season_1' OR res -> 'kinds' <> '[]'::jsonb THEN
		RAISE EXCEPTION 'after unflip there is no fresh start to tell: %', res; END IF;
	PERFORM set_config('smoke.uid', '', true);
	IF public._monday_draw_leftovers_on() OR public._monday_draw_leftover(u2, wk_c) <> 0 THEN
		RAISE EXCEPTION 'unflip should turn Leftovers off'; END IF;

	res := public.unflip_season_2();
	IF NOT (res ->> 'already_unflipped')::boolean OR (SELECT counter FROM public.profiles WHERE id = u2) <> 340 THEN
		RAISE EXCEPTION 'a second unflip must change nothing: %', res; END IF;

	-- ── a second round trip archives afresh ─────────────────────────────────
	res := public.flip_season_2(now(), 8);
	IF (res ->> 'already_flipped')::boolean
	   OR (SELECT (payload ->> 'counter')::int FROM public.season_reset_archive
	       WHERE user_id = u2 AND season_id = 'snout_season_2' AND kind = 'snouts') <> 340 THEN
		RAISE EXCEPTION 're-flip should archive the current values: %', res; END IF;
	-- Scope is read at flip time: a narrowed scope leaves that bucket alone.
	res := public.unflip_season_2();
	UPDATE public.app_settings SET value = '{"tickle_bank": false, "snouts": true, "satchel": false}'::jsonb
		WHERE key = 'season2_reset_scope';
	SELECT count(*) INTO n_bag FROM public.satchel_items WHERE user_id = u2;
	res := public.flip_season_2(now(), 8);
	IF (SELECT item_count FROM public.user_items WHERE user_id = u2) <> 7
	   OR (SELECT count(*) FROM public.satchel_items WHERE user_id = u2) <> n_bag
	   OR (SELECT counter FROM public.profiles WHERE id = u2) <> 0 THEN
		RAISE EXCEPTION 'the scope row should decide what is wiped'; END IF;
	res := public.unflip_season_2();
	IF (SELECT counter FROM public.profiles WHERE id = u2) <> 340 THEN
		RAISE EXCEPTION 'narrow-scope unflip should restore snouts'; END IF;
	UPDATE public.app_settings SET value = '{"tickle_bank": true, "snouts": true, "satchel": true}'::jsonb
		WHERE key = 'season2_reset_scope';

	RAISE NOTICE 'chk season2 feast: dark seed, preview, flip, meter, board, leftovers, reset archive, unflip round trip OK';
END
$season2$;

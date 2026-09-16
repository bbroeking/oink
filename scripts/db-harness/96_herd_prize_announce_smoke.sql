-- 96 — the Barn Draw tells the crew (20260917120000_herd_prize_announce.sql).
-- Rides 93's fixture: crews HA (h1, h2 dig; h3 sleeps), HB (h4 alone),
-- HC (nobody digs), HD (h6 owns everything → purse). 93 resolved 20260406
-- and committed 20260413's seed; this smoke digs the next week and resolves it.
\echo chk 96 herd prize announce
DO $$
DECLARE
	h1 uuid := '00000000-0000-0000-0000-000000093001';
	h2 uuid := '00000000-0000-0000-0000-000000093002';
	h3 uuid := '00000000-0000-0000-0000-000000093003';
	h4 uuid := '00000000-0000-0000-0000-000000093004';
	h5 uuid := '00000000-0000-0000-0000-000000093005';
	h6 uuid := '00000000-0000-0000-0000-000000093006';
	ha uuid := '00000000-0000-0000-0000-000000093010';
	hb uuid := '00000000-0000-0000-0000-000000093011';
	hc uuid := '00000000-0000-0000-0000-000000093012';
	hd uuid := '00000000-0000-0000-0000-000000093013';
	wk2      text := '20260413';
	win      uuid;
	win_name text;
	n        int;
	drew     int;
BEGIN
	INSERT INTO public.race_digs(cycle_key,user_id,window_index,crew_id,finds) VALUES
		(wk2,h1,9302,ha,2),(wk2,h2,9302,ha,1),(wk2,h4,9302,hb,1),(wk2,h6,9302,hd,1)
		ON CONFLICT DO NOTHING;
	DELETE FROM public.system_announcements WHERE kind = 'herd_prize';
	-- 00j re-pointed send_push_to_user at smoke_push_calls; assert there.
	DELETE FROM public.smoke_push_calls WHERE push_data->>'kind' = 'herd_prize';

	drew := public._herd_prize_resolve(wk2);
	IF drew < 3 THEN RAISE EXCEPTION 'expected three drawing herds, got %', drew; END IF;

	-- HA: all three on the roster hear it — the sleeper included, never named.
	SELECT winner_user_id INTO win FROM public.herd_prize_draws WHERE iso_week = wk2 AND crew_id = ha;
	SELECT username INTO win_name FROM public.profiles WHERE id = win;
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'herd_prize' AND data->>'cycle_key' = wk2 AND (data->>'crew_id')::uuid = ha;
	IF n <> 3 THEN RAISE EXCEPTION 'HA should get three lines (one per member), got %', n; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.system_announcements
		WHERE kind = 'herd_prize' AND user_id = win AND data->>'cycle_key' = wk2
		  AND body LIKE 'Your crew''s Monday draw came up you%' AND body LIKE '%Hang it in the Barn.') THEN
		RAISE EXCEPTION 'the winner''s line should be theirs'; END IF;
	IF (SELECT count(*) FROM public.system_announcements
		WHERE kind = 'herd_prize' AND user_id <> win AND (data->>'crew_id')::uuid = ha
		  AND data->>'cycle_key' = wk2 AND body LIKE win_name || ' drew the %in the herd''s Monday draw.') <> 2 THEN
		RAISE EXCEPTION 'the two others should hear who drew'; END IF;
	IF EXISTS (SELECT 1 FROM public.system_announcements WHERE kind = 'herd_prize' AND body ILIKE '%slept%') THEN
		RAISE EXCEPTION 'nothing names who slept'; END IF;
	IF (SELECT data->>'screen' FROM public.system_announcements WHERE kind = 'herd_prize' AND user_id = win AND data->>'cycle_key' = wk2) <> 'season' THEN
		RAISE EXCEPTION 'the line should deep-link to season'; END IF;

	-- HB: a crew of one hears "came up you".
	IF (SELECT count(*) FROM public.system_announcements
		WHERE kind = 'herd_prize' AND user_id = h4 AND data->>'cycle_key' = wk2
		  AND body LIKE 'Your crew''s Monday draw came up you%') <> 1 THEN
		RAISE EXCEPTION 'HB''s one member should hear it as theirs'; END IF;

	-- HC: nobody dug → a 'none' row and silence.
	IF EXISTS (SELECT 1 FROM public.system_announcements
		WHERE kind = 'herd_prize' AND user_id = h5 AND data->>'cycle_key' = wk2) THEN
		RAISE EXCEPTION 'a herd where nobody dug hears nothing'; END IF;

	-- HD: the purse fallback says a purse, not a design.
	IF NOT EXISTS (SELECT 1 FROM public.system_announcements
		WHERE kind = 'herd_prize' AND user_id = h6 AND data->>'cycle_key' = wk2
		  AND body LIKE '%a purse of % tickles%' AND data->>'kind' = 'tickles') THEN
		RAISE EXCEPTION 'HD''s line should be the purse'; END IF;

	-- One push per line, same deep link.
	SELECT count(*) INTO n FROM public.smoke_push_calls
		WHERE push_data->>'kind' = 'herd_prize' AND push_data->>'cycle_key' = wk2 AND push_data->>'screen' = 'season';
	IF n <> 5 THEN RAISE EXCEPTION 'expected five pushes (3 HA + 1 HB + 1 HD), got %', n; END IF;

	-- A second resolve tells nobody twice.
	IF public._herd_prize_resolve(wk2) <> 0 THEN RAISE EXCEPTION 'second resolve must draw nothing'; END IF;
	IF (SELECT count(*) FROM public.system_announcements WHERE kind = 'herd_prize' AND data->>'cycle_key' = wk2) <> 5 THEN
		RAISE EXCEPTION 'second resolve must not announce again'; END IF;

	RAISE NOTICE 'chk 96 ok: crew-wide lines, winner''s own, sleeper unnamed, none-crew silent, purse worded, pushes 5, idempotent';
END $$;

DO $smoke$
DECLARE
	c record;
	base_win bigint;
BEGIN
	UPDATE public.app_settings
	SET value = '{"mode":"commuter_eastern","time_zone":"America/New_York","anchor_min":360,"bucket_starts":[0,360,660,900],"open_mins":[240,120,180,120]}'::jsonb
	WHERE key = 'feeding_schedule';

	SELECT * INTO c FROM public._patch_clock('2026-07-16 10:00:00+00');
	base_win := c.window_index;
	IF c.phase_open IS NOT TRUE
		OR c.phase_ends_at <> '2026-07-16 14:00:00+00'::timestamptz
		OR c.opens_at <> '2026-07-16 16:00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'bad morning commuter clock: %', row_to_json(c);
	END IF;

	SELECT * INTO c FROM public._patch_clock('2026-07-16 16:00:00+00');
	IF c.window_index <> base_win + 1 OR c.phase_open IS NOT TRUE
		OR c.phase_ends_at <> '2026-07-16 18:00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'bad lunch commuter clock: %', row_to_json(c);
	END IF;

	SELECT * INTO c FROM public._patch_clock('2026-07-17 03:00:00+00');
	IF c.phase_open IS NOT FALSE
		OR c.opens_at <> '2026-07-17 10:00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'bad overnight gorge: %', row_to_json(c);
	END IF;

	-- PostgreSQL's IANA zone owns DST: 06:00 Eastern is 11:00Z before the
	-- spring transition and 10:00Z afterward.
	SELECT * INTO c FROM public._patch_clock('2026-03-09 10:00:00+00');
	IF c.phase_open IS NOT TRUE
		OR c.phase_ends_at <> '2026-03-09 14:00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'bad DST commuter clock: %', row_to_json(c);
	END IF;

	IF has_function_privilege('anon', 'public._patch_clock(timestamptz)', 'EXECUTE') THEN
		RAISE EXCEPTION 'anon can execute _patch_clock';
	END IF;
	RAISE NOTICE 'commuter clock chk ok';
END;
$smoke$;

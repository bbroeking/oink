-- Happiness rebalance. The old curve was punishing: decay 1.5/hr (=36 pts/day)
-- vastly outran the achievable gain (~15 per 4h window, shrinking near the top),
-- so 90% of live players sat in the Sad band and NO pig had ever reached Happy
-- (top stored happiness was ~56). Fix both sides:
--   • decay 1.5 -> 0.5/hr  → a healthy pig takes ~3 days of neglect to fall to
--     Sad (was <1 day), and daily play now nets positive. (Lowering the rate also
--     recomputes everyone's live happiness_now upward immediately on deploy.)
--   • window cap 15 -> 25 and full-strength gains until ~h50 (taper only near the
--     80 ceiling) so an engaged day or two actually reaches Happy / recovers Sad
--     pigs to mid.
-- Bands unchanged: Sad 20-37, Content 38-62, Happy 63-80. See docs/happiness-spec.md.

-- 1. On-read decay: 1.5 -> 0.5 /hr.
CREATE OR REPLACE FUNCTION public.happiness_now(uid uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(20, LEAST(80,
		happiness - EXTRACT(EPOCH FROM (now() - happiness_updated_at)) / 3600.0 * 0.5
	))
	FROM public.profiles WHERE id = uid;
$function$;

-- 2. Gain application: slower decay, bigger window, gentler near-top taper.
CREATE OR REPLACE FUNCTION public.apply_happiness(uid uuid, raw_gain numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cur numeric; upd timestamptz; wstart timestamptz; wgain numeric;
	decayed numeric; eff numeric; allowed numeric;
	window_cap   constant numeric := 25;    -- was 15 — let an engaged session climb
	decay_per_hr constant numeric := 0.5;   -- was 1.5 — ~3 days neglect -> Sad
BEGIN
	SELECT happiness, happiness_updated_at, happiness_window_start, happiness_window_gain
		INTO cur, upd, wstart, wgain
		FROM public.profiles WHERE id = uid FOR UPDATE;
	IF cur IS NULL THEN RETURN; END IF;

	-- 1. decay since last touch
	decayed := GREATEST(20, cur - EXTRACT(EPOCH FROM (now() - upd)) / 3600.0 * decay_per_hr);

	-- 2. reset the gain window every 4h
	IF now() - wstart > INTERVAL '4 hours' THEN
		wstart := now(); wgain := 0;
	END IF;

	-- 3. full-strength gains until ~h50, taper only near the 80 ceiling, then cap
	--    to what's left in the window.
	eff := raw_gain * GREATEST(0, LEAST(1, (80 - decayed) / 30.0));
	allowed := GREATEST(0, window_cap - wgain);
	eff := LEAST(eff, allowed);

	UPDATE public.profiles
	SET happiness              = LEAST(80, decayed + eff),
	    happiness_updated_at   = now(),
	    happiness_window_start = wstart,
	    happiness_window_gain  = wgain + eff
	WHERE id = uid;
END;
$function$;

-- Happiness numeric bloat.
--
-- apply_happiness does unrounded numeric math (decay = epoch-seconds/3600 * rate,
-- taper = raw_gain * ((80 - decayed) / 30)) and writes the raw results straight
-- back. Over many touches the fractional tails compound — prod rows carry
-- ~990-digit numerics in happiness_window_gain, which bloat every row read and
-- serialize into home_stats() for nothing. Round both stored assignments to 4
-- decimals (well below any band boundary or display resolution) and scrub the
-- rows that already bloated.
--
-- CARRY-LATEST-DEF: this apply_happiness body is verbatim from 20260612
-- (happiness_rebalance — the newest def; 20260621's floor is a one-time data op,
-- not a redefinition) with round(...) wrapping the two UPDATE assignments. Every
-- other line is unchanged.

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

	-- Round the stored values to 4 decimals — the unrounded numeric tails were
	-- compounding into ~990-digit bloat across many touches (well below any band
	-- boundary or display resolution).
	UPDATE public.profiles
	SET happiness              = round(LEAST(80, decayed + eff), 4),
	    happiness_updated_at   = now(),
	    happiness_window_start = wstart,
	    happiness_window_gain  = round(wgain + eff, 4)
	WHERE id = uid;
END;
$function$;

-- One-time cleanup of the rows that already bloated.
UPDATE public.profiles
	SET happiness             = round(happiness, 4),
	    happiness_window_gain = round(happiness_window_gain, 4)
	WHERE scale(happiness) > 4 OR scale(happiness_window_gain) > 4;

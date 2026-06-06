-- Happiness — self-driven pig care state on [20,80], lazy decay + per-tickle
-- gain, multiplies regen symmetrically. See docs/happiness-spec.md + ADR 0004.
-- The sprite is the only readout (no number shown); this migration is the engine.

-- ── Columns ────────────────────────────────────────────────────────
-- New pigs start 60 (top of Content); existing players backfill to 50.
-- Window columns enforce "spreading > dumping": gains are capped per ~4h window.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS happiness              numeric     NOT NULL DEFAULT 60,
	ADD COLUMN IF NOT EXISTS happiness_updated_at   timestamptz NOT NULL DEFAULT now(),
	ADD COLUMN IF NOT EXISTS happiness_window_start timestamptz NOT NULL DEFAULT now(),
	ADD COLUMN IF NOT EXISTS happiness_window_gain  numeric     NOT NULL DEFAULT 0;

UPDATE public.profiles SET happiness = 50 WHERE happiness = 60;  -- existing → Content

-- ── happiness_now: decayed value, read-only (for display + regen) ──
CREATE OR REPLACE FUNCTION public.happiness_now(uid uuid)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(20, LEAST(80,
		happiness - EXTRACT(EPOCH FROM (now() - happiness_updated_at)) / 3600.0 * 1.5
	))
	FROM public.profiles WHERE id = uid;
$function$;
GRANT EXECUTE ON FUNCTION public.happiness_now(uuid) TO authenticated;

-- ── apply_happiness: decay → window-capped, top-diminished gain → persist ──
CREATE OR REPLACE FUNCTION public.apply_happiness(uid uuid, raw_gain numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	cur numeric; upd timestamptz; wstart timestamptz; wgain numeric;
	decayed numeric; eff numeric; allowed numeric;
	window_cap   constant numeric := 15;   -- ~one mood band per window
	decay_per_hr constant numeric := 1.5;
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

	-- 3. diminish gain as we near 80, then cap to what's left in the window
	eff := raw_gain * GREATEST(0, (80 - decayed) / 60.0);
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
-- internal reward plumbing; not granted to clients.

-- ── Wire into the regen rate (joins VIP/warm_tea/sluggish/alignment) ──
-- Symmetric: 1.15× at sad-20 → 0.85× at happy-80. Body mirrors
-- 20260581_alignment_teeth with the happiness factor appended.
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		(CASE WHEN COALESCE(
			(SELECT is_vip FROM public.profiles WHERE id = uid), false)
		 THEN 1800 ELSE 3600 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'warm_tea'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		* (CASE
			WHEN COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) >= 25 THEN 0.9
			WHEN COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) <= -25 THEN 1.1
			ELSE 1 END)
		-- Happiness: 1.15× (sad) → 0.85× (happy), linear.
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
	)::int);
$function$;

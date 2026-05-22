-- Season Pass + Slop Club — Phase 1 (DB).
-- See docs/pass-and-slop-club-spec.md.
--
-- Season Pass: a one-time per-season entitlement. The existing
-- user_season_progress.premium_unlocked flag already IS the
-- per-(user,season) entitlement, so no new table — grant_season_pass
-- flips it for the active season, has_season_pass reads it. (The dev
-- RPC dev_unlock_premium stays for testing.)
--
-- Slop Club: the membership (the is_vip flag, rebranded UI-side).
-- Adds the monthly snout stipend — profiles.last_stipend_month gates
-- one claim per UTC calendar month. Stipend = 250 snouts.

-- ── Season Pass ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.grant_season_pass()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season    public.seasons;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;
	INSERT INTO public.user_season_progress (user_id, season_id, premium_unlocked)
		VALUES (caller_id, season.id, true)
	ON CONFLICT (user_id, season_id)
		DO UPDATE SET premium_unlocked = true;
	RETURN jsonb_build_object('ok', true, 'season_id', season.id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.grant_season_pass() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_season_pass()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT p.premium_unlocked
		   FROM public.user_season_progress p
		   JOIN public.active_season() s ON s.id = p.season_id
		  WHERE p.user_id = auth.uid()),
		false
	);
$function$;

GRANT EXECUTE ON FUNCTION public.has_season_pass() TO authenticated;

-- ── Slop Club — monthly snout stipend ──────────────────────────────

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS last_stipend_month text;

CREATE OR REPLACE FUNCTION public.claim_slop_stipend()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid    := auth.uid();
	member    boolean;
	last_m    text;
	this_m    text    := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
	stipend   int     := 250;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT COALESCE(is_vip, false), last_stipend_month
		INTO member, last_m
		FROM public.profiles WHERE id = caller_id;
	IF NOT member THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
	END IF;
	IF last_m IS NOT DISTINCT FROM this_m THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;
	UPDATE public.profiles
		SET counter = counter + stipend,
		    last_stipend_month = this_m
		WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true, 'granted', stipend);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_slop_stipend() TO authenticated;

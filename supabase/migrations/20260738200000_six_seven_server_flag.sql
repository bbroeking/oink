-- "6 7!" celebration → once per ACCOUNT, not once per device.
--
-- The Barn dialog fired whenever profiles.counter crossed an x67 milestone,
-- gated only by an AsyncStorage key (seen_67) — per-device, so a reinstall or
-- a second device re-fired the whole thing. Move the "already saw it" flag
-- server-side (profiles.seen_67_at) and surface it through home_stats() so the
-- client can suppress the egg across devices. AsyncStorage stays as a local
-- fast-path dedupe (no round trip needed to skip a re-prompt in the same
-- session); the server flag is the durable authority.

-- 1. The server-side "saw the six-seven" stamp.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS seen_67_at timestamptz;

-- 2. Backfill: every player already past 67 has (by definition) had every
--    chance to see it — stamp them so nobody who's been playing gets a
--    surprise egg on their next launch after this ships.
UPDATE public.profiles
	SET seen_67_at = now()
	WHERE counter >= 67 AND seen_67_at IS NULL;

-- 3. mark_67_seen() — the client stamps the flag when the egg fires (or is
--    dismissed). Idempotent: only writes if still null, so a tap-storm or a
--    re-fire on a stale client can't churn the timestamp.
CREATE OR REPLACE FUNCTION public.mark_67_seen()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	UPDATE public.profiles
		SET seen_67_at = now()
		WHERE id = caller_id AND seen_67_at IS NULL;

	RETURN jsonb_build_object('ok', true);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.mark_67_seen() TO authenticated;

-- 4. Surface seen_67_at through home_stats(). CARRY-LATEST-DEF: this body is
--    verbatim from 20260643 (the newest home_stats def, which added
--    regen_seconds) with a single additive key — old clients ignore it.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof      record;
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id, active_glasses_id,
		active_mask_id, active_neck_id, active_aura_id, active_background_id,
		active_held_id, active_tickle_particle_id, active_flag_id, seen_67_at
		INTO prof
		FROM public.profiles
		WHERE id = caller_id;

	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',                  true,
		'counter',             COALESCE(prof.counter, 0),
		'tickles_earned',      COALESCE(prof.tickles_earned, 0),
		'happiness',           public.happiness_now(caller_id),
		'active_hat_id',       prof.active_hat_id,
		'active_hat',          (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_hat_id),
		'active_glasses_id',   prof.active_glasses_id,
		'active_glasses',      (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_glasses_id),
		'active_mask_id',      prof.active_mask_id,
		'active_mask',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_mask_id),
		'active_neck_id',      prof.active_neck_id,
		'active_neck',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_neck_id),
		'active_aura_id',      prof.active_aura_id,
		'active_aura',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_aura_id),
		'active_background_id', prof.active_background_id,
		'active_background',   (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_background_id),
		'active_held_id',      prof.active_held_id,
		'active_held',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_held_id),
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle',    (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_tickle_particle_id),
		'active_flag_id',      prof.active_flag_id,
		'active_flag',         (SELECT jsonb_build_object('id', h.id,
			'category', h.category, 'emoji', h.emoji)
			FROM public.hats h WHERE h.id = prof.active_flag_id),
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		-- TRUE per-tickle regen period after every modifier (VIP, warm_tea,
		-- sluggish_snout, alignment, happiness) — regen_secs_for is the one
		-- source of truth; clients stop hardcoding "every hour".
		'regen_seconds',       public.regen_secs_for(caller_id),
		-- Server-side "already saw the 6 7 egg" stamp — null until first sight,
		-- then the client suppresses the celebration across devices.
		'seen_67_at',          prof.seen_67_at,
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

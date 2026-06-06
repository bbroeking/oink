-- home_stats(): surface the new equip slots (glasses / mask / neck) so the pig
-- renders them alongside the hat. Same NULL-safe scalar-subquery pattern as
-- 20260588; just adds the three split-out slots.

set check_function_bodies = off;

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
		active_held_id, active_tickle_particle_id, active_flag_id
		INTO prof
		FROM public.profiles
		WHERE id = caller_id;

	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',                  true,
		'counter',             COALESCE(prof.counter, 0),
		'tickles_earned',      COALESCE(prof.tickles_earned, 0),
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
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

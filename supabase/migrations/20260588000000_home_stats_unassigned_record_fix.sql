-- Fix: home_stats() throws 'record "held" is not assigned yet' for any user
-- who has an empty cosmetic slot.
--
-- Root cause: plpgsql binds EVERY record field reference in the RETURN
-- jsonb_build_object as a query parameter, including the branches the CASE
-- won't use. The per-slot records (hat/aura/bg/held/tp/flag) are only assigned
-- inside `IF active_*_id IS NOT NULL THEN SELECT ... INTO <rec>`, so when a slot
-- is empty the record is never assigned — and binding <rec>.category as a
-- parameter raises "record not assigned yet" regardless of the CASE guard.
-- (The data is clean — no dangling references; it's purely the empty-slot path.)
--
-- Fix: drop the record variables + IF blocks and read each slot with a NULL-safe
-- scalar subquery. A NULL active id (or an id missing from hats) yields no row →
-- the scalar subquery returns NULL → that slot is simply null. Same output shape
-- as before; the per-slot records are gone, so the bug class is gone.

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

	SELECT counter, tickles_earned, active_hat_id,
		active_aura_id, active_background_id, active_held_id,
		active_tickle_particle_id, active_flag_id
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

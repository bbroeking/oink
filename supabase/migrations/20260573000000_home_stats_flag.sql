-- home_stats(): surface the equipped country flag (active_flag_id) so the
-- Barn pig renders it. Same shape as the other active_* slots; rebuilt from
-- 20260549000000_tickle_particles.sql with the flag field added.

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
	hat       record;
	aura      record;
	bg        record;
	held      record;
	tp        record;
	flag      record;
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

	IF prof.active_hat_id IS NOT NULL THEN
		SELECT category, emoji INTO hat
			FROM public.hats WHERE id = prof.active_hat_id;
	END IF;
	IF prof.active_aura_id IS NOT NULL THEN
		SELECT category, emoji INTO aura
			FROM public.hats WHERE id = prof.active_aura_id;
	END IF;
	IF prof.active_background_id IS NOT NULL THEN
		SELECT category, emoji INTO bg
			FROM public.hats WHERE id = prof.active_background_id;
	END IF;
	IF prof.active_held_id IS NOT NULL THEN
		SELECT category, emoji INTO held
			FROM public.hats WHERE id = prof.active_held_id;
	END IF;
	IF prof.active_tickle_particle_id IS NOT NULL THEN
		SELECT category, emoji INTO tp
			FROM public.hats WHERE id = prof.active_tickle_particle_id;
	END IF;
	IF prof.active_flag_id IS NOT NULL THEN
		SELECT category, emoji INTO flag
			FROM public.hats WHERE id = prof.active_flag_id;
	END IF;

	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',                  true,
		'counter',             COALESCE(prof.counter, 0),
		'tickles_earned',      COALESCE(prof.tickles_earned, 0),
		'active_hat_id',       prof.active_hat_id,
		'active_hat',          CASE
			WHEN prof.active_hat_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_hat_id,
				'category', hat.category, 'emoji', hat.emoji)
		END,
		'active_aura_id',      prof.active_aura_id,
		'active_aura',         CASE
			WHEN prof.active_aura_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_aura_id,
				'category', aura.category, 'emoji', aura.emoji)
		END,
		'active_background_id', prof.active_background_id,
		'active_background',    CASE
			WHEN prof.active_background_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_background_id,
				'category', bg.category, 'emoji', bg.emoji)
		END,
		'active_held_id',      prof.active_held_id,
		'active_held',         CASE
			WHEN prof.active_held_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_held_id,
				'category', held.category, 'emoji', held.emoji)
		END,
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle',    CASE
			WHEN prof.active_tickle_particle_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_tickle_particle_id,
				'category', tp.category, 'emoji', tp.emoji)
		END,
		'active_flag_id',      prof.active_flag_id,
		'active_flag',         CASE
			WHEN prof.active_flag_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_flag_id,
				'category', flag.category, 'emoji', flag.emoji)
		END,
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

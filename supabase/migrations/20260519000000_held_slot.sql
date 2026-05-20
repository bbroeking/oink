-- Multi-slot equipment, round 2: split `held` items (sword, wand, mug,
-- etc.) out of `active_hat_id` so users can wear a hat AND hold an
-- item simultaneously. Mirrors the 20260514 aura/background split.
--
-- Render z-order at the SwipeElement layer (back to front):
--   active_background_id      → page backdrop
--   active_aura_id            → behind pig
--   pig sprite                → center
--   active_hat_id (front)     → hat/glasses/mask/bow on the head
--   active_held_id            → grip-anchored item in the right hand

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_held_id
		text REFERENCES public.hats(id) ON DELETE SET NULL;

-- Migrate users who currently have a held item equipped via the legacy
-- `active_hat_id` column into the new slot, then clear the legacy slot.
-- This is the same pattern the aura/background migration used.
UPDATE public.profiles p
SET active_held_id = h.id,
	active_hat_id = NULL
FROM public.hats h
WHERE p.active_hat_id = h.id
	AND h.category = 'held';

-- ── Refresh home_stats() to return the new slot ────────────────────
-- Adds active_held_id + active_held jsonb alongside the existing
-- active_hat / active_aura / active_background fields. Same shape.
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
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id,
		active_aura_id, active_background_id, active_held_id
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
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

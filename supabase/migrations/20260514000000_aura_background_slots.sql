-- Multi-slot equipment: split aura + background out of the single
-- `active_hat_id` slot so they can be equipped alongside a hat/scarf/
-- mask/etc. (and alongside each other). Items in the `aura` and
-- `background` categories now route to their dedicated columns;
-- everything else stays on `active_hat_id` for now.
--
-- Z-order at render time (back to front):
--   active_background_id  → deepest layer, fills the card
--   active_aura_id        → next layer, fills the card with effect
--   pig sprite            → center
--   cape (when behind)    → still routes through active_hat_id today
--   active_hat_id (front items) → top layer

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_aura_id
		text REFERENCES public.hats(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS active_background_id
		text REFERENCES public.hats(id) ON DELETE SET NULL;

-- Migrate any user who currently has an aura/background equipped via
-- the legacy `active_hat_id` column into the new slot, then clear the
-- legacy slot for them so the next render picks up the right routing.
UPDATE public.profiles p
SET active_aura_id = h.id,
	active_hat_id = NULL
FROM public.hats h
WHERE p.active_hat_id = h.id
	AND h.category = 'aura';

UPDATE public.profiles p
SET active_background_id = h.id,
	active_hat_id = NULL
FROM public.hats h
WHERE p.active_hat_id = h.id
	AND h.category = 'background';

-- ── Refresh home_stats() to return both new slots + their meta. ──
-- Same shape as before for the legacy `active_hat` field; adds
-- `active_aura` and `active_background` jsonb blobs alongside.
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
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id,
		active_aura_id, active_background_id
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
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

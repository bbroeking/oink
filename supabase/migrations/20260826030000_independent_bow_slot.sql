-- Hat and Bow are independent wearable slots. Existing players keep any bow
-- they were wearing: rows whose active_hat_id points at a bow move to the new
-- column before the equip RPC begins routing future bow changes there.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_bow_id text;

DO $block$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'profiles_active_bow_id_fkey'
			AND conrelid = 'public.profiles'::regclass
	) THEN
		ALTER TABLE public.profiles
			ADD CONSTRAINT profiles_active_bow_id_fkey
			FOREIGN KEY (active_bow_id) REFERENCES public.hats(id)
			ON DELETE SET NULL;
	END IF;
END
$block$;

UPDATE public.profiles AS p
SET active_bow_id = COALESCE(p.active_bow_id, p.active_hat_id),
	active_hat_id = NULL
FROM public.hats AS h
WHERE h.id = p.active_hat_id
	AND h.category = 'bow';

CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_item_id text, p_category text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	v_category text;
	v_column   text;
	v_update   jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	IF p_item_id IS NULL THEN
		v_category := p_category;
	ELSE
		SELECT category INTO v_category FROM public.hats WHERE id = p_item_id;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
		END IF;
		IF NOT EXISTS (
			SELECT 1 FROM public.user_hats
			WHERE user_id = caller_id AND hat_id = p_item_id
		) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
		END IF;
	END IF;

	v_column := CASE v_category
		WHEN 'hat'             THEN 'active_hat_id'
		WHEN 'bow'             THEN 'active_bow_id'
		WHEN 'glasses'         THEN 'active_glasses_id'
		WHEN 'mask'            THEN 'active_mask_id'
		WHEN 'scarf'           THEN 'active_neck_id'
		WHEN 'necklace'        THEN 'active_neck_id'
		WHEN 'aura'            THEN 'active_aura_id'
		WHEN 'held'            THEN 'active_held_id'
		WHEN 'background'      THEN 'active_background_id'
		WHEN 'flag'            THEN 'active_flag_id'
		WHEN 'tickle_particle' THEN 'active_tickle_particle_id'
		ELSE NULL
	END;
	IF v_column IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_category');
	END IF;

	IF p_item_id IS NULL THEN
		EXECUTE format('UPDATE public.profiles SET %I = NULL WHERE id = $1', v_column)
			USING caller_id;
		RETURN jsonb_build_object(
			'ok', true,
			'update', jsonb_build_object(v_column, NULL)
		);
	END IF;

	IF v_category = 'glasses' THEN
		UPDATE public.profiles
			SET active_glasses_id = p_item_id, active_mask_id = NULL
			WHERE id = caller_id;
		v_update := jsonb_build_object('active_glasses_id', p_item_id, 'active_mask_id', NULL);
	ELSIF v_category = 'mask' THEN
		UPDATE public.profiles
			SET active_mask_id = p_item_id, active_glasses_id = NULL
			WHERE id = caller_id;
		v_update := jsonb_build_object('active_mask_id', p_item_id, 'active_glasses_id', NULL);
	ELSE
		EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', v_column)
			USING p_item_id, caller_id;
		v_update := jsonb_build_object(v_column, p_item_id);
	END IF;

	RETURN jsonb_build_object('ok', true, 'update', v_update);
END;
$function$;

REVOKE ALL ON FUNCTION public.equip_cosmetic(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(text, text) TO authenticated;

-- Keep the Barn's one-round-trip payload complete: clients need both worn
-- records to render them together without a follow-up catalog query.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof record;
	tickle jsonb;
	season jsonb;
	sponsor_balance integer;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT counter, tickles_earned, active_hat_id, active_bow_id, active_glasses_id,
		active_mask_id, active_neck_id, active_aura_id, active_background_id,
		active_held_id, active_tickle_particle_id, active_flag_id, seen_67_at
	INTO prof FROM public.profiles WHERE id = caller_id;
	tickle := public.tickle_info(caller_id);
	season := public.season_state();
	SELECT sponsor_tickle_count INTO sponsor_balance
	FROM public.user_items WHERE user_id = caller_id;

	RETURN jsonb_build_object(
		'ok', true,
		'counter', COALESCE(prof.counter, 0),
		'tickles_earned', COALESCE(prof.tickles_earned, 0),
		'happiness', public.happiness_now(caller_id),
		'active_hat_id', prof.active_hat_id,
		'active_hat', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_hat_id),
		'active_bow_id', prof.active_bow_id,
		'active_bow', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_bow_id),
		'active_glasses_id', prof.active_glasses_id,
		'active_glasses', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_glasses_id),
		'active_mask_id', prof.active_mask_id,
		'active_mask', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_mask_id),
		'active_neck_id', prof.active_neck_id,
		'active_neck', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_neck_id),
		'active_aura_id', prof.active_aura_id,
		'active_aura', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_aura_id),
		'active_background_id', prof.active_background_id,
		'active_background', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_background_id),
		'active_held_id', prof.active_held_id,
		'active_held', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_held_id),
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_tickle_particle_id),
		'active_flag_id', prof.active_flag_id,
		'active_flag', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_flag_id),
		'balance', COALESCE((tickle->>'balance')::int, 0) + COALESCE(sponsor_balance, 0),
		'sponsor_balance', COALESCE(sponsor_balance, 0),
		'cap', COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds', tickle->'next_regen_seconds',
		'regen_seconds', public.regen_secs_for(caller_id),
		'seen_67_at', prof.seen_67_at,
		'current_tier', COALESCE((season->>'current_tier')::int, 1),
		'total_tiers', COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.home_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

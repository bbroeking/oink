-- Full costumes on every pig (Halloween 2026): the costume skins are drawn
-- per pig now (assets/images/sprites/costumes/<slug>/<pig>/, manifest
-- constants/costumeFrames.generated.ts), so the server stops refusing a
-- costume on a pig other than Rosie.
--
-- equip_cosmetic(text, text): CARRIED from 20261029240000_halloween_costumes.
-- sql (its latest def; nothing later redefines it: 20261029250000 ..
-- 20261029270000 do not touch it). One change: the costume_rosie_only check
-- (and the v_pig_id it read) is removed. Everything else is verbatim:
-- unauthenticated / no_such_item / not_owned / bad_category in the same order,
-- the costume slot ('costume' -> active_costume_id), the glasses/mask swap, a
-- costume clearing no other slot, the {ok, update} shape, REVOKE / GRANT.
--
-- Which pig a costume can be WORN on is a client rule now: a (costume, pig)
-- pair is wearable when this binary carries that pair's complete skin
-- (utils/costumeFit.ts). The server only checks ownership. A pig with no skin
-- for the saved costume is drawn in its ordinary outfit, never in another
-- pig's skin, so a saved costume on an unskinned pig is harmless.
--
-- OLD BINARIES: build 199 (and 198) carry their own client-side Rosie-only
-- check (utils/costumeCopy.ts costumeEquipRefusal) and draw a costume on Rosie
-- only, so they stay consistent after this lands: they never send a non-Rosie
-- costume equip, and a costume another binary saved on a non-Rosie pig draws
-- as that pig's plain outfit there.
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).

-- Fail fast rather than queue behind live traffic.
SET LOCAL lock_timeout = '5s';

-- equip_cosmetic(): carried from 20261029240000_halloween_costumes.sql minus
-- the Rosie-only equip rule.
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
		WHEN 'costume'         THEN 'active_costume_id'
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
		-- Includes 'costume': one column, every other slot left as it is.
		EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', v_column)
			USING p_item_id, caller_id;
		v_update := jsonb_build_object(v_column, p_item_id);
	END IF;

	RETURN jsonb_build_object('ok', true, 'update', v_update);
END;
$function$;

REVOKE ALL ON FUNCTION public.equip_cosmetic(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(text, text) TO authenticated;

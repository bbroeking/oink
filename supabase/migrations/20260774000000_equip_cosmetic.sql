-- equip_cosmetic — the cosmetic "wear this / take it off" rule, moved SERVER-SIDE.
--
-- WHY SERVER-SIDE NOW (issue #35): the equip write used to be a client-only,
-- RLS-scoped UPDATE on profiles.active_*_id (utils/cosmetics.equipCosmetic). Two
-- pressures make that no longer enough:
--   1. Members-only wearables — the catalog now carries members_only cosmetics; a
--      trustworthy "you may wear this" gate has to run where the client can't lie.
--   2. Unowned-equip hardening — RLS let the client write ANY item id into its own
--      active-slot column, including items it never owned. This function refuses an
--      equip the caller doesn't own (user_hats), so an unowned id can't be worn.
-- The category on an EQUIP is read from the CATALOG ROW here, never trusted from
-- the client, so a mislabeled client category can't route an item to the wrong slot.
--
-- The RLS direct-write path is DELIBERATELY NOT revoked: shipped builds still write
-- profiles.active_*_id directly (utils/cosmetics keeps that as a fallback for
-- un-migrated / offline clients). Revoking the direct UPDATE would break those
-- builds — it's a future forced-upgrade decision, not this migration's job.
--
-- COLUMN SET MUST STAY IN SYNC with constants/slots.ts (SLOT_COLUMN +
-- columnForCategory). The CASE below is the server mirror of columnForCategory:
-- glasses→active_glasses_id, mask→active_mask_id, everything else → its slot's
-- column. If you add a category/column in constants/slots.ts, add it here too.
-- The Face-slot exclusivity invariant (glasses + masks share one player-facing
-- Face chip → equipping one clears the other) also mirrors utils/cosmetics.computeEquip.
--
-- Contract (jsonb, never RAISE — all refusals are plain {ok:false} returns):
--   equip:   equip_cosmetic(p_item_id => 'tophat')            -- category from catalog
--   unequip: equip_cosmetic(p_item_id => NULL, p_category => 'hat')
-- Returns on success: { ok:true, update: { <column>: <value-or-null>, ... } }
--   so the client can patch its active-id map straight from the server's answer.
-- Refusals: unauthenticated | no_such_item | not_owned | bad_category.

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

	-- Resolve the category. On an EQUIP it comes from the catalog row (never the
	-- client); on an UNEQUIP the client names the slot to clear.
	IF p_item_id IS NULL THEN
		v_category := p_category;
	ELSE
		SELECT category INTO v_category FROM public.hats WHERE id = p_item_id;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
		END IF;
		-- Ownership is unconditional: every equippable item is granted into
		-- user_hats (the default backdrop 'homestead_barn' too — seeded at signup +
		-- backfilled in 20260515010000), so there is no free/default equip bypass.
		IF NOT EXISTS (
			SELECT 1 FROM public.user_hats
			WHERE user_id = caller_id AND hat_id = p_item_id
		) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
		END IF;
	END IF;

	-- Mirror of constants/slots.ts columnForCategory. Unknown category → refuse.
	v_column := CASE v_category
		WHEN 'hat'             THEN 'active_hat_id'
		WHEN 'bow'             THEN 'active_hat_id'
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

	-- UNEQUIP: clear just this slot's own column (siblings untouched).
	IF p_item_id IS NULL THEN
		EXECUTE format('UPDATE public.profiles SET %I = NULL WHERE id = $1', v_column)
			USING caller_id;
		RETURN jsonb_build_object(
			'ok', true,
			'update', jsonb_build_object(v_column, NULL)
		);
	END IF;

	-- EQUIP with Face-slot exclusivity applied in the SAME update: equipping
	-- glasses clears any mask and vice versa (they share one player-facing chip).
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

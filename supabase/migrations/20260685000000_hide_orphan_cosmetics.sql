-- Hide ALL orphaned cosmetics: catalog items with no HAT_IMAGES art, which
-- render a wrong/generic category fallback (the tiny_umbrella → magic-wand bug,
-- ×33). Pull them from the shop (cost = 0) and unequip them from every slot so
-- no pig shows the wrong art. Closet visibility is handled client-side
-- (HIDDEN_CLOSET_IDS in ClosetView). Country flags are NOT here — they render
-- via WORLD_CUP_FLAG_IMAGES, not HAT_IMAGES.
--
-- Fully reversible: re-add a cost + the art per item in the art pass
-- (see docs/art-pass-todo.md). Includes tiny_umbrella (already pulled in 20260684).

DO $$
DECLARE
	orphans text[] := ARRAY[
		'acorn_bow','bell_collar','bone_necklace','bumblebee_bow','charm_necklace',
		'choker','diamond_pendant','emerald_pendant','ermine_cape','firefly_lantern',
		'fur_cape','gas_mask','gold_chain','hero_cape','jam_jar_lenses','leather_cape',
		'library_nook','locket','magician_cape','moth_waltz','mushroom_cap','neckwarmer',
		'paper_boat','particle_bubble','pearl_necklace','pumpkin_patch','ribbon_choker',
		'royal_cape','short_cape','silk_cape','star_cape','tiny_umbrella','vampire_cape'
	];
BEGIN
	-- Out of the shop: daily_shop() only draws cost > 0, buy_hat() rejects cost <= 0.
	UPDATE public.hats SET cost = 0 WHERE id = ANY(orphans);

	-- Unequip from every slot column. An item lives in exactly one column, but
	-- running all is safe — each UPDATE NULLs only rows where the id matches.
	UPDATE public.profiles SET active_hat_id             = NULL WHERE active_hat_id             = ANY(orphans);
	UPDATE public.profiles SET active_glasses_id         = NULL WHERE active_glasses_id         = ANY(orphans);
	UPDATE public.profiles SET active_mask_id            = NULL WHERE active_mask_id            = ANY(orphans);
	UPDATE public.profiles SET active_neck_id            = NULL WHERE active_neck_id            = ANY(orphans);
	UPDATE public.profiles SET active_aura_id            = NULL WHERE active_aura_id            = ANY(orphans);
	UPDATE public.profiles SET active_held_id            = NULL WHERE active_held_id            = ANY(orphans);
	UPDATE public.profiles SET active_tickle_particle_id = NULL WHERE active_tickle_particle_id = ANY(orphans);
	UPDATE public.profiles SET active_background_id      = NULL WHERE active_background_id      = ANY(orphans);
	UPDATE public.profiles SET active_flag_id            = NULL WHERE active_flag_id            = ANY(orphans);
END $$;

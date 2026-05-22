-- Remove the necklace cosmetics from the game.
--
-- The necklace art never sat right on the pig — it didn't read as
-- "around the neck" given the pig's anatomy, and the category had
-- already been hidden from the shop. This deletes the 10 catalog
-- rows outright. Regenerate the set later with art tuned to the
-- pig's neck (see the TODO in constants/hats.ts).
--
-- Order matters: un-equip, then drop ownership, then the catalog
-- rows — otherwise FK references would block the delete.

-- 1. Un-equip any necklace worn in the main cosmetic slot.
UPDATE public.profiles SET active_hat_id = NULL
	WHERE active_hat_id IN (
		SELECT id FROM public.hats WHERE category = 'necklace'
	);

-- 2. Drop ownership rows for necklaces.
DELETE FROM public.user_hats
	WHERE hat_id IN (
		SELECT id FROM public.hats WHERE category = 'necklace'
	);

-- 3. Delete the necklace catalog rows (bone/charm/pearl necklace,
--    gold chain, locket, diamond/emerald pendant, choker, bell
--    collar, ribbon choker).
DELETE FROM public.hats WHERE category = 'necklace';

-- Remove the cape cosmetics from the game.
--
-- Same story as necklaces — the cape art never sat right on the pig.
-- Capes wrap the body, so front-only art looks broken when the pig
-- leans; the category had already been hidden from the shop. This
-- deletes the 10 catalog rows outright. Regenerate later with art
-- tuned to the pig (see the TODO in constants/hats.ts).
--
-- `cape_scarf` is category 'scarf', NOT 'cape' — it stays.
--
-- Order: un-equip, drop ownership, then delete the catalog rows.

UPDATE public.profiles SET active_hat_id = NULL
	WHERE active_hat_id IN (
		SELECT id FROM public.hats WHERE category = 'cape'
	);

DELETE FROM public.user_hats
	WHERE hat_id IN (
		SELECT id FROM public.hats WHERE category = 'cape'
	);

DELETE FROM public.hats WHERE category = 'cape';

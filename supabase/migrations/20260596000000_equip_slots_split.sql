-- Multi-slot cosmetics: split the shared "main" slot (active_hat_id, which held
-- hat/glasses/mask/scarf/necklace) into anchor-based slots so a player can wear,
-- e.g., a hat AND glasses at once. New slots: Eyes (glasses), Face (mask), Neck
-- (scarf/necklace). Head (hat/bow) stays in active_hat_id. Aura/Held/Background/
-- Flag already had their own columns. See constants/slots.ts.
--
-- Existing equips are MOVED to the right slot so nobody loses what they wear.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_glasses_id text REFERENCES public.hats(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS active_mask_id    text REFERENCES public.hats(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS active_neck_id    text REFERENCES public.hats(id) ON DELETE SET NULL;

-- Move whatever currently sits in active_hat_id to its real slot by category.
UPDATE public.profiles p
SET active_glasses_id = p.active_hat_id, active_hat_id = NULL
FROM public.hats h
WHERE h.id = p.active_hat_id AND h.category = 'glasses';

UPDATE public.profiles p
SET active_mask_id = p.active_hat_id, active_hat_id = NULL
FROM public.hats h
WHERE h.id = p.active_hat_id AND h.category = 'mask';

UPDATE public.profiles p
SET active_neck_id = p.active_hat_id, active_hat_id = NULL
FROM public.hats h
WHERE h.id = p.active_hat_id AND h.category IN ('scarf', 'necklace');

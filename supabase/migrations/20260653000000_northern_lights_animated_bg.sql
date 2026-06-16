-- Northern Lights becomes an animated BACKGROUND (was a legendary aura, 20260632).
-- The client renders it via constants/animatedBackgrounds.ts (a cross-fading
-- frame loop); here we just move it to the background slot/category so it
-- equips as a background and shows in the Backgrounds shop section.
UPDATE public.hats SET category = 'background' WHERE id = 'northern_lights';

-- Anyone who already had it equipped in the aura slot: clear that slot, since
-- it's no longer an aura (the FK stays valid; this just unequips it there).
UPDATE public.profiles SET active_aura_id = NULL WHERE active_aura_id = 'northern_lights';

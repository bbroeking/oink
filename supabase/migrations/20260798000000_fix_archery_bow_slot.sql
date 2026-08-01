-- The Archery Bow is gripped in Rosie's right hand, but its original catalog
-- row classified it as a decorative `bow`. That category routes through the
-- hat slot, so equipping the bow replaced the player's hat even though the
-- renderer correctly anchored the art to the hand.
UPDATE public.hats
SET category = 'held'
WHERE id = 'archery_bow';

-- Preserve the intent of players who already have the bow equipped. A correct
-- equip would have replaced their held item and left the hat slot empty.
UPDATE public.profiles
SET active_held_id = 'archery_bow',
	active_hat_id = NULL
WHERE active_hat_id = 'archery_bow';

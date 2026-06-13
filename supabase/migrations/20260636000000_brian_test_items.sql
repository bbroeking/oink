-- Brian test-account tweaks (same pattern as 20260623 §3):
-- 1. Grant the new legendary aura 'northern_lights' (20260632 batch) so it's
--    testable equipped/in the Closet on his account.
-- 2. Re-lock 'coffee_mug' (common held) so the buy / open-a-Trough flows have
--    a fresh unowned item to exercise (cowboy was consumed by the last round
--    of Trough testing). He re-earns it by buying/funding — that's the point.

INSERT INTO public.user_hats (user_id, hat_id)
SELECT id, 'northern_lights' FROM public.profiles WHERE username = 'Brian'
ON CONFLICT (user_id, hat_id) DO NOTHING;

DELETE FROM public.user_hats
WHERE hat_id = 'coffee_mug'
  AND user_id = (SELECT id FROM public.profiles WHERE username = 'Brian');

-- If the mug is currently equipped in the held slot, unequip it so the
-- profile doesn't reference an unowned item.
UPDATE public.profiles
   SET active_held_id = NULL
 WHERE username = 'Brian' AND active_held_id = 'coffee_mug';

-- 1. Make every flag equippable by everyone: grant all flag-category items to
--    all existing users, so each flag shows as owned + equippable in the Closet
--    (and the Barn picker already lets anyone choose any flag). Idempotent.
INSERT INTO public.user_hats (user_id, hat_id)
SELECT p.id, h.id
FROM public.profiles p
CROSS JOIN public.hats h
WHERE h.category = 'flag'
ON CONFLICT (user_id, hat_id) DO NOTHING;

-- 2. Unlock + EQUIP the Northern Lights animated background on the test accounts
--    so the new AnimatedBackground can be seen immediately on the Barn.
INSERT INTO public.user_hats (user_id, hat_id)
SELECT id, 'northern_lights' FROM public.profiles
WHERE lower(username) IN ('callmemaybe', 'brian')
ON CONFLICT (user_id, hat_id) DO NOTHING;

UPDATE public.profiles
SET active_background_id = 'northern_lights'
WHERE lower(username) IN ('callmemaybe', 'brian');

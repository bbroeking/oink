-- Smoke for 20261004231000_catalog_copy_polish.sql (after 00z2_catalog_copy_prep.sql).
DO $$ BEGIN
	ASSERT NOT EXISTS (SELECT 1 FROM public.titles WHERE description LIKE '%—%'), 'no em dash left in titles';
	ASSERT (SELECT description FROM public.titles WHERE id = 'wc_civ') = 'World Cup 2026: represent Côte d''Ivoire.', 'world cup colon';
	ASSERT (SELECT description FROM public.titles WHERE id = 'crown_hog') = 'The big boar: fifty recruits.', 'crown hog';
	ASSERT (SELECT description FROM public.titles WHERE id = 'worldbringer') = 'Brought 1,000 friends into the world.', 'thousands in titles';
	ASSERT (SELECT description FROM public.achievements WHERE id = 'hog_of_hearts') = 'Fulfill 1,000 trades.', 'thousands in achievements';
	ASSERT (SELECT description FROM public.achievements WHERE id = 'every_last_feeding') = 'Dig in every Feeding of one week.', 'perfect week';
	ASSERT (SELECT description FROM public.achievements WHERE id = 'small_sounder') = 'Make 5 friends.', 'friends are friends';
	ASSERT (SELECT description FROM public.titles WHERE id = 'full_sounder') = 'A hundred friends.', 'title friend count';
	ASSERT (SELECT description FROM public.titles WHERE id = 'reworded') = 'Someone already fixed this.', 'untouched row stays';
	ASSERT (SELECT name FROM public.titles WHERE id = 'full_sounder') = 'Full Sounder', 'names never change';
END $$;
SELECT 'catalog copy smoke: ok' AS result;

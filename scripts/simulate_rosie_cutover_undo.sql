-- ============================================================================
-- UNDO the scoped demo_rosie cutover (scripts/simulate_rosie_cutover.sql).
-- Restores her Board from the archive, removes the grant, clears her recap flag,
-- and deletes her archive row so tonight's REAL run re-archives her fresh.
-- Note: her tickle BANK is left at 10 (it regenerates; a test account, harmless).
-- ============================================================================
DO $$
DECLARE
	rosie    uuid;
	archived bigint;
BEGIN
	SELECT id INTO rosie FROM public.profiles WHERE lower(username) = 'demo_rosie' LIMIT 1;
	IF rosie IS NULL THEN RAISE EXCEPTION 'demo_rosie not found'; END IF;

	SELECT tickles_earned INTO archived
	  FROM public.season0_tickle_standings WHERE user_id = rosie;

	-- restore lifetime tickles
	UPDATE public.profiles SET tickles_earned = COALESCE(archived, tickles_earned) WHERE id = rosie;

	-- remove the beta grant + its effects
	DELETE FROM public.beta_reward_grants WHERE user_id = rosie;
	DELETE FROM public.user_titles WHERE user_id = rosie AND title_id = 'beta_founding_herd';
	DELETE FROM public.user_hats   WHERE user_id = rosie AND hat_id   = 'beta_founder_ribbon';
	UPDATE public.profiles SET counter = GREATEST(0, counter - 250) WHERE id = rosie;
	DELETE FROM public.system_announcements
	 WHERE user_id = rosie AND title = 'Thank you, Founding Herd';

	-- clear the per-user recap flag
	UPDATE public.profiles SET feature_overrides = feature_overrides - 'season1_finale' WHERE id = rosie;

	-- drop her archive row so the real graduate re-snapshots her tonight
	DELETE FROM public.season0_tickle_standings WHERE user_id = rosie;

	RAISE NOTICE 'demo_rosie cutover reverted (tickles restored to %).', archived;
END $$;

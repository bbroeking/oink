-- ============================================================================
-- SCOPED FINALE CUTOVER — demo_rosie ONLY.  Dress rehearsal for tonight.
-- Run in the Supabase SQL editor (service-role). Reverse with
-- scripts/simulate_rosie_cutover_undo.sql. Touches NO other account.
--
-- Mimics, for one user, what run_judgement_day_season0() does for everyone:
--   1. archive her Board standing   2. grant the Founding-Herd beta reward
--   3. zero her Board  4. bank -> 10  5. reveal the recap for HER ONLY.
-- After running, reload the app as demo_rosie: Board 0, bank 10, ribbon in
-- closet, inbox note, and the season-end recap auto-plays.
-- ============================================================================
DO $$
DECLARE
	rosie        uuid;
	orig_tickles bigint;
	her_rank     int;
BEGIN
	SELECT id, COALESCE(tickles_earned, 0)
	  INTO rosie, orig_tickles
	  FROM public.profiles
	 WHERE lower(username) = 'demo_rosie'
	 LIMIT 1;
	IF rosie IS NULL THEN
		RAISE EXCEPTION 'demo_rosie not found — check the username';
	END IF;

	her_rank := (SELECT count(*) + 1 FROM public.profiles p2
	             WHERE p2.username IS NOT NULL AND p2.username <> ''
	               AND NOT p2.hide_from_leaderboard
	               AND COALESCE(p2.tickles_earned, 0) > orig_tickles);

	-- 1. Archive her final standing (create the table if the graduate migration
	--    isn't pushed yet — same shape; IF NOT EXISTS so tonight's run is a no-op).
	CREATE TABLE IF NOT EXISTS public.season0_tickle_standings (
		user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
		username       text,
		tickles_earned bigint NOT NULL,
		rank           int,
		hidden         boolean NOT NULL DEFAULT false,
		snapshotted_at timestamptz NOT NULL DEFAULT now()
	);
	INSERT INTO public.season0_tickle_standings (user_id, username, tickles_earned, rank, hidden)
		SELECT rosie, username, orig_tickles, her_rank, false
		  FROM public.profiles WHERE id = rosie
		ON CONFLICT (user_id) DO NOTHING;

	-- 2. Founding-Herd beta reward (rank > 10 tier): title + ribbon + 250 snouts
	--    + the inline inbox note. Exactly the grant_beta_rewards() slice.
	INSERT INTO public.beta_reward_grants (user_id, rank, tier, title_id, snouts)
		VALUES (rosie, her_rank, 'founding_herd', 'beta_founding_herd', 250)
		ON CONFLICT (user_id) DO NOTHING;
	INSERT INTO public.user_titles (user_id, title_id)
		VALUES (rosie, 'beta_founding_herd') ON CONFLICT DO NOTHING;
	INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (rosie, 'beta_founder_ribbon') ON CONFLICT DO NOTHING;
	UPDATE public.profiles SET counter = counter + 250 WHERE id = rosie;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (rosie, 'season', 'Thank you, Founding Herd',
			'The season has settled. You were here before the gates opened — Founding Herd, a ribbon, and 250 snouts are yours.',
			jsonb_build_object('screen', 'season', 'tier', 'founding_herd'));

	-- 3. Graduate her Board + bank
	UPDATE public.profiles  SET tickles_earned = 0 WHERE id = rosie;
	UPDATE public.user_items SET item_count = 10, last_increment = now() WHERE user_id = rosie;

	-- 4. Reveal the recap for HER ONLY (per-user flag override wins over global).
	UPDATE public.profiles
	   SET feature_overrides = feature_overrides || '{"season1_finale": true}'::jsonb
	 WHERE id = rosie;

	RAISE NOTICE 'demo_rosie cutover applied — was % tickles (rank %), now 0, bank 10, Founding Herd granted.',
		orig_tickles, her_rank;
END $$;

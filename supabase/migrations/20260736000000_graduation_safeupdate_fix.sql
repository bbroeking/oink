-- HOTFIX: the graduation block died on the DB's safeupdate rule ("UPDATE
-- requires a WHERE clause") — the fresh-season bank reset was a bare UPDATE.
-- Probe surfaced it 2026-07-11 (see 20260735). Engine + probe carried
-- VERBATIM from 20260726/20260735 with ONLY the WHERE delta, so the 00:00 UTC
-- cron rerun is also correct.
CREATE OR REPLACE FUNCTION public.run_judgement_day_season0()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
	BEGIN
		PERFORM public.finalize_season('season_0');
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: finalize_season failed: %', SQLERRM;
	END;

	BEGIN
		PERFORM public.grant_beta_rewards();
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: grant_beta_rewards failed: %', SQLERRM;
	END;

	-- Graduate the tickle Board: archive final standings, then zero the live
	-- column. Once-only (app_config guard). AFTER beta rewards (ranks read tickles).
	BEGIN
		IF NOT COALESCE(
			(SELECT enabled FROM public.app_config WHERE key = 'season0_graduated'),
			false)
		THEN
			INSERT INTO public.season0_tickle_standings
				(user_id, username, tickles_earned, rank, hidden)
			SELECT p.id, p.username, p.tickles_earned,
				RANK() OVER (
					ORDER BY (p.is_test OR p.hide_from_leaderboard), p.tickles_earned DESC),
				(p.is_test OR p.hide_from_leaderboard)
			FROM public.profiles p
			WHERE p.username IS NOT NULL AND p.username <> ''
			ON CONFLICT (user_id) DO NOTHING;

			UPDATE public.profiles SET tickles_earned = 0 WHERE tickles_earned <> 0;

			-- Fresh-season starting balance: every player's tickle bank -> 10,
			-- regen clock reset so it counts up from the finale moment.
			UPDATE public.user_items SET item_count = 10, last_increment = now()
				WHERE user_id IS NOT NULL; -- safeupdate: bare UPDATE is rejected

			UPDATE public.app_config
			   SET enabled = TRUE, updated_at = now()
			 WHERE key = 'season0_graduated';
		END IF;
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'judgement-day: graduate board failed: %', SQLERRM;
	END;

	-- Legacy key on purpose: build <=103 clients gate the recap on it.
	UPDATE public.app_config
	   SET enabled = TRUE, updated_at = now()
	 WHERE key = 'season1_finale';
END;
$$;
REVOKE ALL ON FUNCTION public.run_judgement_day_season0() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.graduate_season0_probe()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season0_graduated'), false) THEN
		RETURN 'already graduated';
	END IF;
	INSERT INTO public.season0_tickle_standings (user_id, username, tickles_earned, rank, hidden)
	SELECT p.id, p.username, p.tickles_earned,
		RANK() OVER (ORDER BY (p.is_test OR p.hide_from_leaderboard), p.tickles_earned DESC),
		(p.is_test OR p.hide_from_leaderboard)
	FROM public.profiles p
	WHERE p.username IS NOT NULL AND p.username <> ''
	ON CONFLICT (user_id) DO NOTHING;
	UPDATE public.profiles SET tickles_earned = 0 WHERE tickles_earned <> 0;
	UPDATE public.user_items SET item_count = 10, last_increment = now()
	WHERE user_id IS NOT NULL; -- safeupdate
	UPDATE public.app_config SET enabled = TRUE, updated_at = now() WHERE key = 'season0_graduated';
	RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
	RETURN 'ERROR: ' || SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.graduate_season0_probe() FROM PUBLIC, anon, authenticated;

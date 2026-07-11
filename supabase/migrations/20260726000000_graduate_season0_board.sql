-- HELD FOR REVIEW — push only on Brian's explicit "go".
--
-- "Graduate" the Season-0 tickle Board.
--
-- WHY: the live client (components/Leaderboard.tsx) reads profiles.tickles_earned
-- DIRECTLY and sorts by it — there is no leaderboard RPC to redirect. So the only
-- way to give the app already on players' phones a fresh Season-1 Board, with no
-- new build, is to archive the final standings and zero the live column.
--
-- WHAT THIS DOES, in one guarded once-only step folded into the finale engine:
--   1. Snapshots every named player's final Season-0 tickle standing into a
--      permanent hall-of-fame table (season0_tickle_standings) — the "save".
--   2. Zeros profiles.tickles_earned so the Board restarts at 0 for Season 1.
--   3. Sets every player's spendable tickle bank (user_items.item_count) to 10 —
--      a flat fresh-season starting balance so they can play immediately. Bank is
--      one-row-per-user, no item_id, so a plain UPDATE is safe. last_increment is
--      reset to now() so regen starts clean from the finale moment.
-- Guarded by app_config 'season0_graduated' so it can NEVER run twice (a second
-- run days later would wipe real Season-1 progress).
--
-- SAFETY (verified against 20260677 try_claim_achievements):
--   Zeroing tickles_earned fires the achievement/referral/pass triggers, but each
--   no-ops on a DECREASE: try_claim_achievements EXITs at `current_progress < first
--   threshold` before touching any user_achievements row, the referral check needs a
--   49->50 UP-crossing, and record_leaderboard_passes returns early when NEW <= OLD.
--   => No dupe snout payouts, no revoked titles/badges/levels. The ONLY effect is
--   cosmetic: achievement progress bars + the home "lifetime tickles" number read
--   live from tickles_earned, so they display 0 after the wipe (claims are kept).
--   If that lifetime-display reset is unwanted, use the "preserve-lifetime" variant
--   (add a lifetime_tickles column + redirect my_achievements/home_stats RPCs) —
--   also pure-DB, no build. This file is the hard-reset variant Brian described.
--
-- ORDERING: must run AFTER grant_beta_rewards() (founder ranks read tickles_earned).
-- Folded in below, after the beta grant and before the reveal flag.

-- ── 1. Hall-of-fame archive (the "save") ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.season0_tickle_standings (
	user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	username       text,
	tickles_earned bigint NOT NULL,
	rank           int,
	hidden         boolean NOT NULL DEFAULT false,
	snapshotted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.season0_tickle_standings ENABLE ROW LEVEL SECURITY;

-- Public read so a future "Season 1 hall of fame" surface can show it; writes are
-- service-role only (the finale engine is SECURITY DEFINER).
DROP POLICY IF EXISTS season0_standings_read ON public.season0_tickle_standings;
CREATE POLICY season0_standings_read ON public.season0_tickle_standings
	FOR SELECT TO authenticated USING (true);

-- ── 2. Once-only guard flag ─────────────────────────────────────────────────
-- 'season0_graduated' → set true once the Board has been archived + zeroed;
-- guards the graduate step against ever re-running. (key,enabled) form only,
-- so this never depends on the app_config.description column existing.
INSERT INTO public.app_config (key, enabled)
VALUES ('season0_graduated', false)
ON CONFLICT (key) DO NOTHING;

-- ── 3. Carry run_judgement_day_season0() VERBATIM (20260709000000) + graduate ─
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
			UPDATE public.user_items SET item_count = 10, last_increment = now();

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

-- ── 4. Re-time the cron: 8:00 PM ET Jul 11 == 00:00 UTC Jul 12 ───────────────
-- Was '0 0 13 7 *' (8 PM ET Jul 12). Moving one day earlier per Brian.
SELECT cron.unschedule('judgement-day-season-0')
	WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'judgement-day-season-0');
SELECT cron.schedule(
	'judgement-day-season-0',
	'0 0 12 7 *', -- 00:00 UTC Jul 12 == 8:00 PM ET Jul 11, 2026
	$$SELECT public.run_judgement_day_season0()$$
);

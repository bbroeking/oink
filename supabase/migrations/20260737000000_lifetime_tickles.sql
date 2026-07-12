-- HELD FOR REVIEW — push only on Brian's explicit "go".
--
-- Lifetime tickles = ALL-TIME across seasons, unified in the DB.
--
-- WHY: tonight's Season-0 graduation (20260726 + the 20260736 safeupdate hotfix)
-- archived every player's final tickles into season0_tickle_standings and ZEROED
-- profiles.tickles_earned so the live Board restarts at 0 for Season 1. That means
-- profiles.tickles_earned is now a SEASON column, not a lifetime one — every
-- "lifetime tickles" surface would read 0 after the wipe.
--
-- DESIGN (locked): profiles.tickles_lifetime_base holds the SUM of every ARCHIVED
-- season's tickles. Displayed lifetime is computed at READ:
--     lifetime = tickles_lifetime_base + tickles_earned   (base + live season)
-- One write per season graduation (add-to-base then zero); no dual-write, no drift.
--
-- PATTERN RULE FOR FUTURE SEASON RESETS: every future graduation MUST, inside its
-- once-only guarded block and BEFORE zeroing tickles_earned:
--     UPDATE profiles SET tickles_lifetime_base = tickles_lifetime_base + tickles_earned
--       WHERE tickles_earned <> 0;
-- i.e. ADD-TO-BASE, THEN ZERO. The guard flag makes this idempotent — it can never
-- double-count. Skip it and lifetime silently loses that season's tickles.
--
-- SAFEUPDATE: this DB enforces a safeupdate rule — bare UPDATEs (no WHERE) are
-- rejected. Every UPDATE below carries a WHERE, same as 20260736.

-- ── 1. The base column ──────────────────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS tickles_lifetime_base bigint NOT NULL DEFAULT 0;

-- ── 2. One-time backfill from the Season-0 archive ──────────────────────────
-- The graduation already happened (20260736 zeroed the live column), so the base
-- has to be seeded from the archive rather than the now-zero live column. Guarded
-- by `tickles_lifetime_base = 0` so a re-run can't stack a second season's total
-- onto an already-seeded row. The WHERE also satisfies safeupdate.
UPDATE public.profiles p
	SET tickles_lifetime_base = s.tickles_earned
	FROM public.season0_tickle_standings s
	WHERE s.user_id = p.id
	  AND p.tickles_lifetime_base = 0;

-- ── 3. Future-proofing: carry the graduation engine + probe VERBATIM from
-- 20260736, adding ONE delta each — add-to-base BEFORE the zero, inside the same
-- season0_graduated guard so it can never double-run. (For Season 0 the guard is
-- already flipped true, so this branch is inert now; it's here so the CANONICAL
-- definition of these functions carries the pattern for the next season.) ──────
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

	-- Graduate the tickle Board: archive final standings, add-to-base, then zero
	-- the live column. Once-only (app_config guard). AFTER beta rewards (ranks
	-- read tickles).
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

			-- LIFETIME: fold this season's tickles into the all-time base BEFORE
			-- the zero. Guarded by season0_graduated, so it can never double-run.
			UPDATE public.profiles
			   SET tickles_lifetime_base = tickles_lifetime_base + tickles_earned
			 WHERE tickles_earned <> 0;

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
	-- LIFETIME: add-to-base before the zero (see run_judgement_day_season0).
	UPDATE public.profiles
	   SET tickles_lifetime_base = tickles_lifetime_base + tickles_earned
	 WHERE tickles_earned <> 0;
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

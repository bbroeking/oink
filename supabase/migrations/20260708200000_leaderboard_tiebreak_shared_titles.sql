-- Leaderboard tiebreak — OPTION 2 of 3: "Co-champions — ties share the title."
--
-- Problem being fixed: at season end a pack sits tied at +100 (and -100), and
-- both the live board and finalize_season break that tie by p.id (raw UUID),
-- so only 3 arbitrary UUIDs get the top-3 finale title + 500 snouts and the
-- next 7 get gilded + 250 — even though everyone in the pack has an identical,
-- maxed score.
--
-- This option removes the arbitrary tiebreak entirely. Rank becomes DENSE_RANK
-- over the score alone, so EVERYONE tied at the same score shares one rank:
-- all +100s are rank 1, the next distinct score is rank 2, and so on. Bracket
-- thresholds are unchanged (rank <= 3 -> top3 title + 500; rank <= 10 -> gilded
-- + 250). The effect: the whole maxed pack are co-champions and all receive the
-- top-3 finale title + 500 snouts.
--
-- ⚠️ SNOUT-BUDGET NOTE (read before choosing this option): brackets are now by
-- DISTINCT SCORE, not by head count. If N players are tied at +100, ALL N get
-- the 500-snout top-3 grant (not just 3). That is the intent of "everyone tied
-- at the top gets the title," but it makes the finale snout outlay scale with
-- the size of the maxed pack. Sizing that against the current pack is worth a
-- look before Judgement Day. Flagged for the reviewer.
--
-- No schema change. Client is unaffected: the RPC signature is unchanged and
-- Leaderboard.tsx already renders side_rank as-is (duplicate ranks display
-- fine). finalize_season stays cron/service-role only.

-- 1. finalize_season: DENSE_RANK by score alone (drop the p.id tiebreak).
--    Carried VERBATIM from 20260704600000_finalize_season_ambiguity_fix.sql
--    (incl. the ON CONSTRAINT season_finales_pkey fix); ONLY the two side_rank
--    windows change from ROW_NUMBER(... , p.id) to DENSE_RANK() over score.
CREATE OR REPLACE FUNCTION public.finalize_season(season_key text DEFAULT 'season_1')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r            record;
	bracket      text;
	title_id     text;
	snouts       int;
	granted      int := 0;
BEGIN
	FOR r IN
		SELECT
			p.id,
			p.alignment_score AS score,
			CASE
				WHEN p.alignment_score >  0 THEN 'generous'
				WHEN p.alignment_score <  0 THEN 'greedy'
				ELSE 'neutral'
			END AS side,
			CASE
				WHEN p.alignment_score > 0 THEN
					DENSE_RANK() OVER (PARTITION BY (p.alignment_score > 0)
						ORDER BY p.alignment_score DESC)
				WHEN p.alignment_score < 0 THEN
					DENSE_RANK() OVER (PARTITION BY (p.alignment_score < 0)
						ORDER BY p.alignment_score ASC)
				ELSE NULL
			END AS side_rank
		FROM public.profiles p
		WHERE p.username IS NOT NULL AND p.username <> ''
	LOOP
		IF r.side = 'neutral' THEN
			bracket := 'neutral'; title_id := 'calm_in_the_storm'; snouts := 100;
		ELSIF r.side_rank <= 3 THEN
			bracket := 'top3';
			title_id := CASE r.side WHEN 'generous' THEN 'halo_bearer_2026'
			                        ELSE 'goblin_king_2026' END;
			snouts := 500;
		ELSIF r.side_rank <= 10 THEN
			bracket := 'top10'; title_id := 'gilded_2026'; snouts := 250;
		ELSE
			bracket := 'participant'; title_id := 'schism_survivor'; snouts := 100;
		END IF;

		INSERT INTO public.season_finales
			(user_id, season_key, final_score, side, side_rank, bracket, title_id, snouts)
			VALUES (r.id, season_key, r.score, r.side, r.side_rank, bracket, title_id, snouts)
			ON CONFLICT ON CONSTRAINT season_finales_pkey DO NOTHING;

		IF FOUND THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (r.id, title_id) ON CONFLICT DO NOTHING;
			UPDATE public.profiles SET counter = counter + snouts WHERE id = r.id;
			granted := granted + 1;
		END IF;
	END LOOP;

	UPDATE public.profiles
		SET alignment_score = 0, alignment_updated_at = now()
		WHERE alignment_score <> 0;

	RETURN jsonb_build_object('ok', true, 'granted', granted, 'season_key', season_key);
END;
$function$;

-- 2. alignment_leaderboard (live display): mirror the shared-rank semantics so
--    the board shows co-champions all at the same #. Carried from
--    20260586000000_hide_from_leaderboard.sql; side_rank becomes DENSE_RANK
--    over score. Display order still uses p.id only as a STABLE final sort so
--    the list doesn't shuffle between calls — it no longer affects rank.
CREATE OR REPLACE FUNCTION public.alignment_leaderboard(per_side int DEFAULT 20)
RETURNS TABLE (
	user_id         uuid,
	username        text,
	active_hat_id   text,
	active_flag_id  text,
	alignment_score int,
	side            text,
	side_rank       int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'generous'::text AS side,
			DENSE_RANK() OVER (ORDER BY p.alignment_score DESC)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score > 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score DESC, p.id
		LIMIT per_side
	)
	UNION ALL
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'greedy'::text AS side,
			DENSE_RANK() OVER (ORDER BY p.alignment_score ASC)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score < 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score ASC, p.id
		LIMIT per_side
	);
$$;

GRANT EXECUTE ON FUNCTION public.alignment_leaderboard(int) TO authenticated;

-- Leaderboard tiebreak — OPTION 3 of 3: "Most tickles breaks the tie."
--
-- Problem being fixed: at season end a pack sits tied at +100 (and -100), and
-- both the live board and finalize_season break that tie by p.id (raw UUID) —
-- rewarding nothing the player did. This option breaks the tie by effort:
-- among players with an equal alignment score, whoever EARNED THE MOST TICKLES
-- ranks higher, so the top-3 finale title + 500 snouts and the top-10 gilded
-- tier go to the busiest givers in the maxed pack.
--
-- ⚠️ SCOPE CAVEAT (read before choosing this option): profiles.tickles_earned
-- is a lifetime-cumulative counter (bigint, never reset — verified: no
-- season-boundary reset exists, and finalize_season wipes only alignment_score).
-- For Season 1 (the first season) lifetime == season, so this is exact today.
-- For Season 2+ it would rank by ALL-TIME tickles unless we snapshot/reset the
-- counter at each finale. If you like this option, we should add a
-- season-scoped tickle count before Season 2's finale. Flagged for the reviewer.
--
-- No schema change. Client unaffected (RPC signature unchanged).
-- finalize_season stays cron/service-role only.

-- 1. finalize_season: add tickles_earned DESC as the tiebreak before p.id.
--    Carried VERBATIM from 20260704600000_finalize_season_ambiguity_fix.sql
--    (incl. the ON CONSTRAINT season_finales_pkey fix); ONLY the two side_rank
--    ORDER BY clauses gain `p.tickles_earned DESC` before p.id.
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
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score > 0)
						ORDER BY p.alignment_score DESC, p.tickles_earned DESC, p.id)
				WHEN p.alignment_score < 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score < 0)
						ORDER BY p.alignment_score ASC, p.tickles_earned DESC, p.id)
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

-- 2. alignment_leaderboard (live display): mirror the tiebreak so the board
--    previews the finale payout. Carried from
--    20260586000000_hide_from_leaderboard.sql; ONLY the ORDER BY clauses gain
--    `p.tickles_earned DESC` before p.id.
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
			ROW_NUMBER() OVER (ORDER BY p.alignment_score DESC, p.tickles_earned DESC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score > 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score DESC, p.tickles_earned DESC, p.id
		LIMIT per_side
	)
	UNION ALL
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'greedy'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score ASC, p.tickles_earned DESC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score < 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score ASC, p.tickles_earned DESC, p.id
		LIMIT per_side
	);
$$;

GRANT EXECUTE ON FUNCTION public.alignment_leaderboard(int) TO authenticated;

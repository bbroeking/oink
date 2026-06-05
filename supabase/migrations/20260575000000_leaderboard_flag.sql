-- alignment_leaderboard: also return active_flag_id so the board can show a
-- small country-flag chip next to each name (World Cup). Adding a column to
-- a RETURNS TABLE requires DROP + CREATE (signature change).

DROP FUNCTION IF EXISTS public.alignment_leaderboard(int);

CREATE FUNCTION public.alignment_leaderboard(per_side int DEFAULT 20)
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
			ROW_NUMBER() OVER (ORDER BY p.alignment_score DESC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score > 0
		  AND p.username IS NOT NULL AND p.username <> ''
		ORDER BY p.alignment_score DESC, p.id
		LIMIT per_side
	)
	UNION ALL
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'greedy'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score ASC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score < 0
		  AND p.username IS NOT NULL AND p.username <> ''
		ORDER BY p.alignment_score ASC, p.id
		LIMIT per_side
	);
$$;

GRANT EXECUTE ON FUNCTION public.alignment_leaderboard(int) TO authenticated;

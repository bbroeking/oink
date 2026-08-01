-- Enemy ranking directions — show who cursed whom inside each rivalry.
--
-- The pair_bonds curse total remains the ranking source. Directional counts
-- come from the durable curses ledger so no additional counter can drift.

CREATE OR REPLACE FUNCTION public.enemy_leaderboard(p_limit int DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_limit   int  := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
	v_rows    jsonb;
	v_you     jsonb;
	v_in_top  boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	WITH ranked AS (
		SELECT
			pb.user_a, pb.user_b, pb.curses,
			row_number() OVER (ORDER BY pb.curses DESC, pb.user_a, pb.user_b) AS rnk
		FROM public.pair_bonds pb
		WHERE pb.curses > 0
	),
	top AS (
		SELECT * FROM ranked WHERE rnk <= v_limit
	)
	SELECT jsonb_agg(
		jsonb_build_object(
			'rank', t.rnk,
			'user_a', t.user_a,
			'user_b', t.user_b,
			'name_a', pa.username,
			'name_b', pb2.username,
			'curses', t.curses,
			'curses_a_to_b', (
				SELECT count(*)::int FROM public.curses c
				WHERE c.sender_id = t.user_a AND c.receiver_id = t.user_b
			),
			'curses_b_to_a', (
				SELECT count(*)::int FROM public.curses c
				WHERE c.sender_id = t.user_b AND c.receiver_id = t.user_a
			),
			'is_self', (caller_id = t.user_a OR caller_id = t.user_b)
		)
		ORDER BY t.rnk
	)
	INTO v_rows
	FROM top t
	JOIN public.profiles pa  ON pa.id  = t.user_a
	JOIN public.profiles pb2 ON pb2.id = t.user_b;

	SELECT EXISTS (
		SELECT 1 FROM jsonb_array_elements(COALESCE(v_rows, '[]'::jsonb)) e
		WHERE (e->>'is_self')::boolean
	) INTO v_in_top;

	IF NOT v_in_top THEN
		WITH ranked AS (
			SELECT
				pb.user_a, pb.user_b, pb.curses,
				row_number() OVER (ORDER BY pb.curses DESC, pb.user_a, pb.user_b) AS rnk
			FROM public.pair_bonds pb
			WHERE pb.curses > 0
		),
		mine AS (
			SELECT * FROM ranked
			WHERE user_a = caller_id OR user_b = caller_id
			ORDER BY rnk
			LIMIT 1
		)
		SELECT jsonb_build_object(
			'rank', m.rnk,
			'user_a', m.user_a,
			'user_b', m.user_b,
			'name_a', pa.username,
			'name_b', pb2.username,
			'curses', m.curses,
			'curses_a_to_b', (
				SELECT count(*)::int FROM public.curses c
				WHERE c.sender_id = m.user_a AND c.receiver_id = m.user_b
			),
			'curses_b_to_a', (
				SELECT count(*)::int FROM public.curses c
				WHERE c.sender_id = m.user_b AND c.receiver_id = m.user_a
			),
			'is_self', true
		)
		INTO v_you
		FROM mine m
		JOIN public.profiles pa  ON pa.id  = m.user_a
		JOIN public.profiles pb2 ON pb2.id = m.user_b;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'enemies', COALESCE(v_rows, '[]'::jsonb),
		'you', v_you
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.enemy_leaderboard(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enemy_leaderboard(int) TO authenticated;

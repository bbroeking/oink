-- Enemy rankings — lifetime rivalries measured by curses exchanged.
--
-- Pair bonds already canonicalize every unordered player pair. Add a separate
-- curse counter to that ledger without changing `bond`: friendship remains the
-- sum of trades + blessings + visits, while rivalry is curses alone.

ALTER TABLE public.pair_bonds
	ADD COLUMN IF NOT EXISTS curses int NOT NULL DEFAULT 0;

ALTER TABLE public.pair_bonds
	DROP CONSTRAINT IF EXISTS pair_bonds_curses_nonnegative;
ALTER TABLE public.pair_bonds
	ADD CONSTRAINT pair_bonds_curses_nonnegative CHECK (curses >= 0);

CREATE INDEX IF NOT EXISTS pair_bonds_curses_desc_idx
	ON public.pair_bonds (curses DESC);

CREATE OR REPLACE FUNCTION public.bump_pair_enemy(p_x uuid, p_y uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	lo uuid;
	hi uuid;
BEGIN
	IF p_x IS NULL OR p_y IS NULL OR p_x = p_y THEN
		RETURN;
	END IF;
	IF p_x < p_y THEN lo := p_x; hi := p_y; ELSE lo := p_y; hi := p_x; END IF;

	INSERT INTO public.pair_bonds (user_a, user_b, curses)
		VALUES (lo, hi, 1)
		ON CONFLICT (user_a, user_b) DO UPDATE
		SET curses = public.pair_bonds.curses + 1, updated_at = now();
END;
$function$;

-- Rivalry bookkeeping must never make the underlying curse fail.
CREATE OR REPLACE FUNCTION public.pair_enemy_on_curse()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		PERFORM public.bump_pair_enemy(NEW.sender_id, NEW.receiver_id);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pair_enemy_curse_trig ON public.curses;
CREATE TRIGGER pair_enemy_curse_trig
	AFTER INSERT ON public.curses
	FOR EACH ROW
	EXECUTE FUNCTION public.pair_enemy_on_curse();

-- Open with the complete historical rivalry record.
INSERT INTO public.pair_bonds (user_a, user_b, curses)
SELECT
	LEAST(sender_id, receiver_id),
	GREATEST(sender_id, receiver_id),
	count(*)::int
FROM public.curses
WHERE sender_id IS NOT NULL
  AND receiver_id IS NOT NULL
  AND sender_id <> receiver_id
GROUP BY 1, 2
ON CONFLICT (user_a, user_b) DO UPDATE
SET curses = EXCLUDED.curses,
	updated_at = now();

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

REVOKE ALL ON FUNCTION public.bump_pair_enemy(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pair_enemy_on_curse() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enemy_leaderboard(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enemy_leaderboard(int) TO authenticated;

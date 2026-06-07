-- Truffle burying v2: let the host choose how much to bury (the stake becomes
-- the shared pot), and add truffle_status() so the host can "check on" their
-- buried truffle — how much is left and who's been digging.
-- See docs/barn-visiting-design.md §3b.

-- 1. bury_truffle(p_amount): stake one of {10,20,50} snouts. The amount is both
--    the cost and the pot (reward = remaining = amount). Replaces the old
--    no-arg, fixed-20 version.
DROP FUNCTION IF EXISTS public.bury_truffle();
CREATE OR REPLACE FUNCTION public.bury_truffle(p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	have_active boolean;
	paid        int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_amount NOT IN (10, 20, 50) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
	END IF;

	SELECT EXISTS (
		SELECT 1 FROM public.truffles WHERE host_id = caller_id AND dug_at IS NULL
	) INTO have_active;
	IF have_active THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_buried');
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO paid;
	IF paid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	INSERT INTO public.truffles (host_id, reward, remaining) VALUES (caller_id, p_amount, p_amount);
	RETURN jsonb_build_object('ok', true, 'reward', p_amount, 'balance', paid);
END;
$function$;

-- 2. truffle_status(): the caller's own active truffle — total pot, how much is
--    left, and the list of visitors who've dug (most recent first). SECURITY
--    DEFINER so the host can read truffle_digs for their own truffle without a
--    broader RLS policy. Returns buried=false when nothing is buried.
CREATE OR REPLACE FUNCTION public.truffle_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_id        bigint;
	v_total     int;
	v_remaining int;
	v_diggers   jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	SELECT id, reward, remaining INTO v_id, v_total, v_remaining
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', true, 'buried', false);
	END IF;

	SELECT COALESCE(jsonb_agg(
		jsonb_build_object(
			'username', COALESCE(p.username, 'someone'),
			'amount',   d.amount,
			'dug_at',   d.dug_at
		) ORDER BY d.dug_at DESC), '[]'::jsonb)
	INTO v_diggers
	FROM public.truffle_digs d
	LEFT JOIN public.profiles p ON p.id = d.digger_id
	WHERE d.truffle_id = v_id;

	RETURN jsonb_build_object(
		'ok', true, 'buried', true,
		'total', v_total, 'remaining', v_remaining, 'diggers', v_diggers
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.bury_truffle(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.truffle_status() TO authenticated;

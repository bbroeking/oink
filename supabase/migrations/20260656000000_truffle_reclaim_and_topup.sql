-- Give the host two actions on their own buried truffle (the "check on it"
-- sheet was read-only): reclaim the unspent remainder, and top up the pot.
--
-- Mechanics recap: bury_truffle stakes snouts that become a shared pot visitors
-- dig (40% of remaining each, 3h re-dig cooldown); one active truffle per host
-- (enforced by the partial unique index on truffles(host_id) WHERE dug_at NULL).
-- Already-dug snouts have left with visitors and are NOT recoverable — only the
-- live `remaining` is the host's to reclaim.

-- 1. reclaim_truffle(): close the caller's active truffle (frees the one-per-host
--    slot) and refund whatever is still unspent. The dig-style FOR UPDATE lock
--    serialises against a visitor digging at the same instant, so the refund and
--    a concurrent dig can't both spend the same snout.
CREATE OR REPLACE FUNCTION public.reclaim_truffle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_id        bigint;
	v_remaining int;
	v_balance   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	SELECT id, remaining INTO v_id, v_remaining
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL
	FOR UPDATE;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- Close it (dug_at set → slot freed, no longer diggable) and refund the rest.
	UPDATE public.truffles
		SET remaining = 0, dug_at = now()
		WHERE id = v_id;

	UPDATE public.profiles
		SET counter = counter + v_remaining
		WHERE id = caller_id
		RETURNING counter INTO v_balance;

	RETURN jsonb_build_object('ok', true, 'refunded', v_remaining, 'balance', v_balance);
END;
$function$;

-- 2. top_up_truffle(p_amount): add one of {10,20,50} more snouts to the active
--    truffle — both the displayed total and the live remaining grow by p_amount.
--    Charge is atomic (UPDATE ... WHERE counter >= p_amount) like bury_truffle.
CREATE OR REPLACE FUNCTION public.top_up_truffle(p_amount int)
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
	v_balance   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_amount NOT IN (10, 20, 50) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'bad_amount');
	END IF;

	SELECT id INTO v_id
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL
	FOR UPDATE;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO v_balance;
	IF v_balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	UPDATE public.truffles
		SET reward = reward + p_amount, remaining = remaining + p_amount
		WHERE id = v_id
		RETURNING reward, remaining INTO v_total, v_remaining;

	RETURN jsonb_build_object('ok', true, 'total', v_total, 'remaining', v_remaining, 'balance', v_balance);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reclaim_truffle() TO authenticated;
GRANT EXECUTE ON FUNCTION public.top_up_truffle(int) TO authenticated;

-- Cap the buried-truffle pot at 50 snouts. top_up_truffle now rejects any add
-- that would push the live pot (remaining) past 50; the initial bury stake is
-- already capped at 50 by the {10,20,50} whitelist. `reward` is kept as the
-- high-water mark (<= 50) so the "X of Y left" bar stays sensible. CREATE OR
-- REPLACE — same signature as 20260656.
CREATE OR REPLACE FUNCTION public.top_up_truffle(p_amount int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	pot_cap     constant int := 50;
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

	SELECT id, reward, remaining INTO v_id, v_total, v_remaining
	FROM public.truffles
	WHERE host_id = caller_id AND dug_at IS NULL
	FOR UPDATE;

	IF v_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'none');
	END IF;

	-- Pot cap: never let the live pot exceed 50 snouts. Checked BEFORE charging.
	IF v_remaining + p_amount > pot_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'max_reached', 'cap', pot_cap, 'remaining', v_remaining);
	END IF;

	UPDATE public.profiles
		SET counter = counter - p_amount
		WHERE id = caller_id AND counter >= p_amount
		RETURNING counter INTO v_balance;
	IF v_balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', p_amount);
	END IF;

	UPDATE public.truffles
		SET remaining = v_remaining + p_amount,
		    reward    = GREATEST(reward, v_remaining + p_amount)
		WHERE id = v_id
		RETURNING reward, remaining INTO v_total, v_remaining;

	RETURN jsonb_build_object('ok', true, 'total', v_total, 'remaining', v_remaining, 'balance', v_balance);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.top_up_truffle(int) TO authenticated;

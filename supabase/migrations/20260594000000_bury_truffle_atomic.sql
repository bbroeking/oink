-- Harden bury_truffle: the previous version deducted snouts BEFORE inserting,
-- so a lost unique-index race (double-tap / two devices) could charge the host
-- without leaving a truffle, and raised a raw unique_violation (500).
--
-- Fix: claim the single-active-truffle slot FIRST via the partial unique index
-- (catch unique_violation → already_buried, no charge), THEN charge; if they
-- can't afford it, undo the truffle. No double-charge, no money loss, no 500.

CREATE OR REPLACE FUNCTION public.bury_truffle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost   constant int := 20;
	reward constant int := 20;
	paid int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	-- Atomically claim the one active-truffle slot (truffles_one_active_per_host).
	BEGIN
		INSERT INTO public.truffles (host_id, reward) VALUES (caller_id, reward);
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'error', 'already_buried');
	END;

	-- Charge for the treat; if they can't afford it, undo the truffle.
	UPDATE public.profiles
		SET counter = counter - cost
		WHERE id = caller_id AND counter >= cost
		RETURNING counter INTO paid;

	IF paid IS NULL THEN
		DELETE FROM public.truffles WHERE host_id = caller_id AND dug_at IS NULL;
		RETURN jsonb_build_object('ok', false, 'error', 'too_poor', 'cost', cost);
	END IF;

	RETURN jsonb_build_object('ok', true, 'reward', reward, 'balance', paid);
END;
$function$;

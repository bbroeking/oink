-- Lucky Pig bonus tickle.
--
-- Client-rolled lucky window: on a regular tickle, the client rolls a
-- 5% die. On a hit, the user enters a "lucky window" of 10 future
-- tickles. Each subsequent tickle (during the window) rolls another
-- 30% die — on a hit, the client calls `lucky_bonus_tickle()` which
-- adds +1 to the counter WITHOUT consuming a tickle from the bank.
-- The regular `update_profile_and_item_count` still runs alongside it.
--
-- Trust model: the rolls happen client-side (user-chosen trade-off:
-- simpler + the stakes are low; a determined modder could fake the
-- bonus but the upside is small). This RPC is therefore intentionally
-- granular — one bonus per call — so a runaway client can only spam
-- +1's at network rate, not loot a huge sum.

CREATE OR REPLACE FUNCTION public.lucky_bonus_tickle()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	new_count  integer;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	UPDATE public.profiles
		SET counter = counter + 1,
		    tickles_earned = tickles_earned + 1
		WHERE id = caller_id
		RETURNING counter INTO new_count;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
	END IF;

	RETURN jsonb_build_object('ok', true, 'new_counter', new_count);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lucky_bonus_tickle() TO authenticated;

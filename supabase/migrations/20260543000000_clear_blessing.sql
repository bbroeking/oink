-- clear_blessing: receiver-initiated cancel of an active blessing.
--
-- Restores the "your next lucky pig" semantics for sun_beam: the
-- Barn calls this when a lucky pig actually fires, marking the
-- active sun_beam row as cleared_at = now() so the boost stops
-- applying immediately. Without this, the 4h timed window would
-- continue boosting subsequent lucky-pig rolls — which is too
-- generous given the design intent.
--
-- The RPC is general (takes a kind text) — usable by any future
-- "consume on event" blessing without a new migration. Only the
-- caller (receiver) can clear their own active blessings; sender
-- has no role in this flow.

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.clear_blessing(target_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rows_updated int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	UPDATE public.blessings
	SET cleared_at = now()
	WHERE receiver_id = caller_id
	  AND kind = target_kind
	  AND cleared_at IS NULL
	  AND (expires_at IS NULL OR expires_at > now());
	GET DIAGNOSTICS rows_updated = ROW_COUNT;

	RETURN jsonb_build_object('ok', true, 'cleared', rows_updated);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.clear_blessing(text) TO authenticated;

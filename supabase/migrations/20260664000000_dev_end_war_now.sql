-- DEV/TEST harness — fast-forward a war to resolution so the full arc
-- (slinging -> resolve -> payout -> war-spoils -> the win modal) is testable in
-- minutes instead of waiting out the 5-day timer. This is the verification loop
-- a feel-dependent feature (the mud minigame) needs.
--
-- Admin-gated on profiles.is_test (the same gate as admin_tickle_overview /
-- send_system_announcement), so a normal player can never call it; and Mud Wars
-- is dark-launched behind MUD_FIGHTS_VISIBLE anyway. It sets ends_at to the past
-- and resolves immediately (resolve_war is idempotent + fires the war-spoils
-- trigger). Non-prod-breaking.

CREATE OR REPLACE FUNCTION public.dev_end_war_now(p_war uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_is_test boolean;
	w record;
BEGIN
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_active'); END IF;

	UPDATE public.mud_wars SET ends_at = now() - interval '1 second' WHERE id = p_war;
	RETURN public.resolve_war(p_war);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_end_war_now(uuid) TO authenticated;

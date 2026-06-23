-- DEV/TEST harness — fast-forward a RHYTHM war from Tend into the HOLD phase so the
-- rhythm core (the Hold runs, the leader deploy, the mirror fold + recap) is testable
-- in minutes instead of waiting out the 2-day Tend timer. Pairs with dev_end_war_now:
--   challenge house -> (Tend) -> dev_skip_to_hold -> play Hold runs + deploy ->
--   dev_end_war_now -> the rhythm fold + recap + payout fire.
--
-- Admin-gated on profiles.is_test (same gate as dev_end_war_now); Mud Wars is also
-- dark-launched behind MUD_FIGHTS_VISIBLE + mud_rhythm_on(). It only backdates the
-- Tend->Hold boundary (build_ends_at); started_at/ends_at are untouched so the siege
-- day, the 7-day timer, and the per-day fold math stay coherent, and dev_end_war_now
-- still folds today's Hold pushes through fold_rhythm_margin. Non-prod-breaking.

CREATE OR REPLACE FUNCTION public.dev_skip_to_hold(p_war uuid)
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
	IF w.status <> 'active' OR NOT COALESCE(w.rhythm_enabled, false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_rhythm_active');
	END IF;

	UPDATE public.mud_wars SET build_ends_at = now() - interval '1 second' WHERE id = p_war;
	RETURN jsonb_build_object('ok', true, 'phase', 'war');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_skip_to_hold(uuid) TO authenticated;

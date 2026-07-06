-- Rename a crew — the leader changes the Sounder's name.
-- HELD FOR REVIEW; push only on go.
--
-- WHY: leaders can create / kick / transfer / disband, but couldn't rename the
-- Sounder after founding it. This adds the last crew-admin verb. Requested
-- 2026-07-06 (rounds out the crew-management set alongside kick_crew_member +
-- transfer_crew_leadership + disband_crew).
--
-- Name rules mirror create_crew (latest def 20260706600000): btrim, 1–24 chars,
-- else 'bad_name' — same CHECK the crews table enforces. Leader-only. NOT blocked
-- during a scuffle: a rename is cosmetic and never shifts the roster, unlike
-- kick/disband.

CREATE OR REPLACE FUNCTION public.set_crew_name(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	clean_name text := btrim(COALESCE(p_name, ''));
	my_crew    uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF char_length(clean_name) < 1 OR char_length(clean_name) > 24 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_name');
	END IF;
	SELECT c.id INTO my_crew FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;

	UPDATE public.crews SET name = clean_name WHERE id = my_crew;
	RETURN jsonb_build_object('ok', true, 'name', clean_name);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_crew_name(text) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RENAME CREW — leader-only rename so Sounders can differentiate themselves
-- after founding (founder ask 2026-07-07). Mirrors create_crew's name rules
-- EXACTLY (btrim, 1..24 chars) so the two paths can never disagree on what a
-- valid name is. One-Sounder invariant means the leader lookup returns at
-- most one crew. rpcAction envelope ({ok, reason}) like every action RPC.
-- New function — no carry-latest-def concerns.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rename_crew(p_name text)
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
	SELECT crew_id INTO my_crew FROM public.crew_members
		WHERE user_id = caller_id AND role = 'leader';
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_leader');
	END IF;
	UPDATE public.crews SET name = clean_name WHERE id = my_crew;
	RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.rename_crew(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_crew(text) TO authenticated;

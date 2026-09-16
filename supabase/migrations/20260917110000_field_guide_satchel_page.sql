-- The Field Guide gains its ninth page: the Satchel (2026-09-16 — finds swap
-- in the barn, docs/satchel-spec.md). The server whitelist in
-- unlock_field_guide_page() is the only door into field_guide_pages, so the
-- id must be added here; until this is applied the client's local mirror
-- carries the page (fail-soft by design). Carried from the LATEST definition
-- (20260915000000_weekday_rituals.sql) — the only change is the one id.
--
-- Authored for review; do not push without Brian's explicit "go".

CREATE OR REPLACE FUNCTION public.unlock_field_guide_page(p_page text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN; -- unauthenticated: silent no-op
	END IF;
	IF p_page NOT IN (
		'truffle', 'golden_truffle', 'lucky_number', 'trough',
		'mud_wrap', 'rituals', 'snouts', 'exchange', 'feeding_windows',
		'satchel'
	) THEN
		RAISE EXCEPTION 'unknown field guide page: %', p_page
			USING ERRCODE = 'check_violation';
	END IF;
	INSERT INTO public.field_guide_pages (user_id, page_id)
		VALUES (auth.uid(), p_page)
		ON CONFLICT (user_id, page_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.unlock_field_guide_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_field_guide_page(text) TO authenticated;

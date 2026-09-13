-- Harness-only stand-in for the production grant_tickles() helper from
-- 20260580000000_settle_tickles.sql. The full historical Tickle regen chain is
-- outside this focused database harness; the Mote smoke needs only the helper's
-- over-cap additive contract.
CREATE OR REPLACE FUNCTION public.grant_tickles(uid uuid, n int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	new_count int;
BEGIN
	UPDATE public.user_items
	SET item_count = item_count + GREATEST(n, 0)
	WHERE user_id = uid
	RETURNING item_count INTO new_count;
	IF new_count IS NULL THEN
		RAISE EXCEPTION 'No user_items row for user %', uid;
	END IF;
	RETURN new_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.grant_tickles(uuid, int) FROM PUBLIC, anon, authenticated;


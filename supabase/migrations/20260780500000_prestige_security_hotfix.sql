-- PRESTIGE SECURITY HOTFIX
--
-- 1. grant_season_xp is an implementation helper, not a client RPC. PostgreSQL
--    grants EXECUTE to PUBLIC by default, and the original migration also
--    granted authenticated explicitly. Keep it owner-callable for SECURITY
--    DEFINER functions while removing it from the PostgREST client surface.
-- 2. ALTER FUNCTION ... RENAME preserves privileges. Hide every implementation
--    function introduced by the prestige and visit-emote wrapper chains.
-- 3. Serialize Barn tickles per visitor so concurrent requests cannot all pass
--    the shared three-distinct-Barn budget check before any visit is inserted.

REVOKE ALL ON FUNCTION public.grant_season_xp(uuid, int)
	FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public._season_state_before_wallow_tuning()
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._wallow_before_tuning()
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tickle_at_barn_before_prestige_window(uuid)
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._barn_visit_status_before_prestige_window(uuid)
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._tickle_at_barn_before_visit_emotes(uuid)
	FROM PUBLIC, anon, authenticated;

-- Preserve the complete visit-emote implementation behind one final wrapper.
-- The transaction-level advisory lock is keyed by visitor, so separate users
-- remain independent while all budget checks for one visitor are serialized.
ALTER FUNCTION public.tickle_at_barn(uuid)
	RENAME TO _tickle_at_barn_before_security_lock;

REVOKE ALL ON FUNCTION public._tickle_at_barn_before_security_lock(uuid)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
	RETURN public._tickle_at_barn_before_security_lock(p_target);
END;
$function$;

REVOKE ALL ON FUNCTION public.tickle_at_barn(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

-- barn_visit_status is also an authenticated, user-scoped RPC. Its previous
-- CREATE omitted the default-PUBLIC revoke.
REVOKE ALL ON FUNCTION public.barn_visit_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;

-- Fail the migration atomically if a future privilege/default change leaves
-- any implementation helper exposed.
DO $block$
DECLARE
	signature text;
BEGIN
	FOREACH signature IN ARRAY ARRAY[
		'public.grant_season_xp(uuid,integer)',
		'public._season_state_before_wallow_tuning()',
		'public._wallow_before_tuning()',
		'public._tickle_at_barn_before_prestige_window(uuid)',
		'public._barn_visit_status_before_prestige_window(uuid)',
		'public._tickle_at_barn_before_visit_emotes(uuid)',
		'public._tickle_at_barn_before_security_lock(uuid)'
	]
	LOOP
		IF has_function_privilege('anon', signature, 'EXECUTE')
		   OR has_function_privilege('authenticated', signature, 'EXECUTE') THEN
			RAISE EXCEPTION 'client role still has EXECUTE on %', signature;
		END IF;
	END LOOP;

	IF has_function_privilege('anon', 'public.tickle_at_barn(uuid)', 'EXECUTE')
	   OR NOT has_function_privilege(
			'authenticated',
			'public.tickle_at_barn(uuid)',
			'EXECUTE'
	   ) THEN
		RAISE EXCEPTION 'tickle_at_barn client privileges are incorrect';
	END IF;

	IF has_function_privilege('anon', 'public.barn_visit_status(uuid)', 'EXECUTE')
	   OR NOT has_function_privilege(
			'authenticated',
			'public.barn_visit_status(uuid)',
			'EXECUTE'
	   ) THEN
		RAISE EXCEPTION 'barn_visit_status client privileges are incorrect';
	END IF;
END;
$block$;

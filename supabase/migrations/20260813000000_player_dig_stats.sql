-- Player-facing lifetime Truffle Patch stats. This is a personal record, not a
-- ranking: every authenticated pig may view the same four public game totals on
-- their own profile or another pig's profile.
--
-- Canonical counting contract:
--   digs    = submitted rootings only (opening and abandoning does not count)
--   finds   = SUM(credited_finds), the server's all-find counter
--   motes   = submitted rootings where the claimed finds include shimmer
--   echoes  = submitted rootings whose Sounder echo was credited
--
-- Authored only. Applying this migration still requires the founder's explicit
-- database-push "go".
CREATE OR REPLACE FUNCTION public.player_dig_stats(
	p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	target_id uuid := COALESCE(p_user_id, caller_id);
	result jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	IF target_id IS NULL OR NOT EXISTS (
		SELECT 1 FROM public.profiles
		WHERE id = target_id AND username IS NOT NULL
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;

	-- A block hides the profile's game record in either direction, matching the
	-- rest of the player-profile surfaces.
	IF target_id <> caller_id AND public.are_blocked(caller_id, target_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;

	SELECT jsonb_build_object(
		'ok', true,
		'user_id', target_id,
		'digs', count(*) FILTER (WHERE r.submitted_at IS NOT NULL),
		'finds', COALESCE(sum(r.credited_finds) FILTER (
			WHERE r.submitted_at IS NOT NULL
		), 0),
		'motes', count(*) FILTER (
			WHERE r.submitted_at IS NOT NULL
				AND 'shimmer' = ANY (COALESCE(r.finds, ARRAY[]::text[]))
		),
		'echoes', count(*) FILTER (
			WHERE r.submitted_at IS NOT NULL AND r.echo_credited
		)
	)
	INTO result
	FROM public.war_rootings r
	WHERE r.user_id = target_id;

	RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.player_dig_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_dig_stats(uuid) TO authenticated;

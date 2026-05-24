-- Enforce a 100-friend cap on accepted relationships.
--
-- Rationale: the Friends UI lists every accepted friend in a single
-- scrollable surface; past ~100 the list slows and the social loop
-- (asks, blessings, curses) loses signal as the sounder dilutes.
-- 100 is a soft target — high enough that almost no one hits it,
-- low enough that the list and the bless/curse cooldowns stay
-- meaningful.
--
-- Enforcement points:
--   • send_friend_request: caller's accepted count must be < 100.
--     Target's count is NOT checked — they can still receive a
--     pending request and decide. A request lingering against a
--     full inbox is a no-op until they free a slot.
--   • accept_friend_request: BOTH sides' counts must be < 100. By
--     the time accept fires it'd push both sides over, so this is
--     the right gate.
--
-- Return shape: existing {ok: bool, reason?: text}. New reason
-- 'at_cap' carries {cap, count} so the client can render a
-- precise message ("You're at the 100-friend cap").

set check_function_bodies = off;

-- ── Helper: count accepted friendships for a user. ─────────────
CREATE OR REPLACE FUNCTION public.accepted_friend_count(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COUNT(*)::int
	FROM public.friendships
	WHERE status = 'accepted'
	  AND (requester_id = uid OR receiver_id = uid);
$function$;

GRANT EXECUTE ON FUNCTION public.accepted_friend_count(uuid) TO authenticated;

-- ── send_friend_request: gate on caller count. ─────────────────
-- Keeps the discriminator extension from the 20260520 migration.
DROP FUNCTION IF EXISTS public.send_friend_request(text, text);

CREATE OR REPLACE FUNCTION public.send_friend_request(
	target_username text,
	target_discriminator text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	target_id uuid;
	existing record;
	caller_count int;
	cap constant int := 100;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	-- Cap check first — cheaper than the username lookup and gives
	-- the client a precise message even when the target doesn't exist.
	caller_count := public.accepted_friend_count(caller_id);
	IF caller_count >= cap THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'at_cap',
			'cap', cap,
			'count', caller_count
		);
	END IF;

	IF target_discriminator IS NULL THEN
		SELECT id INTO target_id
		FROM public.profiles
		WHERE username = target_username
		LIMIT 1;
	ELSE
		SELECT id INTO target_id
		FROM public.profiles
		WHERE username = target_username
		  AND discriminator = target_discriminator
		LIMIT 1;
	END IF;

	IF target_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_user');
	END IF;
	IF target_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;

	-- Existing relationship in either direction
	SELECT * INTO existing FROM public.friendships
	WHERE (requester_id = caller_id AND receiver_id = target_id)
	   OR (requester_id = target_id AND receiver_id = caller_id);

	IF existing.requester_id IS NOT NULL THEN
		IF existing.status = 'accepted' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'already_friends');
		ELSIF existing.requester_id = target_id THEN
			-- They already sent us a request; auto-accept. Re-check
			-- the cap because accepting pushes us one closer; and
			-- check the target's count too since this counts for them.
			IF public.accepted_friend_count(target_id) >= cap THEN
				RETURN jsonb_build_object(
					'ok', false,
					'reason', 'target_at_cap',
					'cap', cap
				);
			END IF;
			UPDATE public.friendships
			SET status = 'accepted', updated_at = now()
			WHERE requester_id = target_id AND receiver_id = caller_id;
			RETURN jsonb_build_object('ok', true, 'state', 'accepted');
		ELSE
			RETURN jsonb_build_object('ok', false, 'reason', 'pending');
		END IF;
	END IF;

	INSERT INTO public.friendships (requester_id, receiver_id)
	VALUES (caller_id, target_id);
	RETURN jsonb_build_object('ok', true, 'state', 'pending');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(text, text) TO authenticated;

-- ── accept_friend_request: gate on BOTH counts. ────────────────
CREATE OR REPLACE FUNCTION public.accept_friend_request(other_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rows_updated int;
	caller_count int;
	other_count int;
	cap constant int := 100;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	-- Both sides must have room. Accepting pushes both counts by 1,
	-- so reject if either is already at the cap.
	caller_count := public.accepted_friend_count(caller_id);
	IF caller_count >= cap THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'at_cap',
			'cap', cap,
			'count', caller_count
		);
	END IF;
	other_count := public.accepted_friend_count(other_user_id);
	IF other_count >= cap THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'target_at_cap',
			'cap', cap
		);
	END IF;

	UPDATE public.friendships
	SET status = 'accepted', updated_at = now()
	WHERE requester_id = other_user_id
	  AND receiver_id = caller_id
	  AND status = 'pending';
	GET DIAGNOSTICS rows_updated = ROW_COUNT;

	IF rows_updated = 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_pending_request');
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

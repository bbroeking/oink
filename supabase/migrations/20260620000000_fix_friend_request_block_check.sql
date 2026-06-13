-- Fix: block enforcement on friend requests was dead code in production.
--
-- 20260565000000 added the block check (`are_blocked` → reason 'blocked') by
-- CREATE OR REPLACE on the SINGLE-arg send_friend_request(target_username text).
-- But 20260541000000 had already created a TWO-arg overload
-- send_friend_request(target_username text, target_discriminator text DEFAULT
-- NULL) carrying the 100-friend cap + discriminator lookup. CREATE OR REPLACE on
-- the 1-arg signature did NOT drop the 2-arg one, so both overloads stayed live.
-- The client always calls rpc("send_friend_request", { target_username,
-- target_discriminator }) (utils/friendships.ts), so PostgREST routes every real
-- request to the 2-arg overload — the one WITHOUT the block check. Net effect: a
-- blocked user could still send friend requests to the person who blocked them
-- (an Apple Guideline 1.2 moderation bypass that "worked" only if someone called
-- the 1-arg form, which the app never does).
--
-- Fix: add the are_blocked check to the 2-arg overload (the live client path),
-- preserving the cap + discriminator logic, and DROP the now-redundant 1-arg
-- overload so exactly one signature remains callable.

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

	-- Moderation: refuse if a block exists in either direction. (This is the
	-- check that 20260565 intended but applied to the unused 1-arg overload.)
	IF public.are_blocked(caller_id, target_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
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

-- Drop the orphaned 1-arg overload so only one signature is callable. (It held
-- the block check but lacked the cap + discriminator logic, and the client never
-- invoked it.)
DROP FUNCTION IF EXISTS public.send_friend_request(text);

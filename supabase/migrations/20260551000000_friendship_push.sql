-- Push delivery for the friendship lifecycle.
--
-- Mirrors ritual_push_notify (20260528000000): an AFTER INSERT/UPDATE
-- trigger that fires a fire-and-forget push so each side learns about
-- the request lifecycle without polling.
--
-- Two events:
--   • INSERT status=pending      → push the RECEIVER  ("X sent you a friend request")
--   • UPDATE pending→accepted    → push the REQUESTER ("X accepted your friend request")
--
-- The receiver already sees the pending row in the Inbox actionable
-- band; this just gets it onto the device. The requester had ZERO
-- surface before this — accept-side was completely silent.

CREATE OR REPLACE FUNCTION public.friendship_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name      text;
	target_user_id  uuid;
	push_title      text;
	push_body       text;
	push_kind       text;
BEGIN
	-- INSERT: new pending request. Actor = requester. Target = receiver.
	IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
		target_user_id := NEW.receiver_id;
		push_title := COALESCE(actor_name, 'Someone') || ' wants to be friends';
		push_body  := 'Tap to accept or decline.';
		push_kind  := 'friend_requested';

	-- UPDATE pending → accepted: receiver said yes. Actor = receiver.
	-- Target of the push = requester (the one who originally sent it).
	ELSIF TG_OP = 'UPDATE'
	      AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.receiver_id;
		target_user_id := NEW.requester_id;
		push_title := COALESCE(actor_name, 'A friend') || ' accepted your request';
		push_body  := 'You''re now in the same sounder.';
		push_kind  := 'friend_accepted';

	ELSE
		RETURN NEW;
	END IF;

	-- Fire-and-forget; a push failure must never roll back the
	-- friendship row (push is best-effort, friendship state is the
	-- source of truth).
	BEGIN
		PERFORM public.send_push_to_user(
			target_user_id,
			push_title,
			push_body,
			jsonb_build_object(
				'kind', push_kind,
				'screen', 'friends'
			)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS friendships_push ON public.friendships;
CREATE TRIGGER friendships_push
	AFTER INSERT OR UPDATE ON public.friendships
	FOR EACH ROW EXECUTE FUNCTION public.friendship_push_notify();

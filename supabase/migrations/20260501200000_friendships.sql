-- Mutual friendships: requester sends, receiver accepts.
-- One canonical row per relationship; queries OR on (requester, receiver).

CREATE TABLE public.friendships (
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, receiver_id),
  CHECK (requester_id <> receiver_id)
);

CREATE INDEX friendships_receiver_idx ON public.friendships (receiver_id) WHERE status = 'pending';
CREATE INDEX friendships_accepted_idx ON public.friendships (requester_id, receiver_id) WHERE status = 'accepted';

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- See rows where you're either side
CREATE POLICY "View own friendships"
  ON public.friendships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = receiver_id);

-- Delete only via RPCs (functions run with SECURITY DEFINER), so block direct writes.
-- (No INSERT/UPDATE/DELETE policies = blocked for users.)

-- ---------- RPCs ----------

set check_function_bodies = off;

-- Send a friend request by target username
CREATE OR REPLACE FUNCTION public.send_friend_request(target_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  target_id uuid;
  existing record;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO target_id FROM public.profiles WHERE username = target_username;
  IF target_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_such_user');
  END IF;
  IF target_id = caller_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;

  -- If a row already exists in either direction, surface its state
  SELECT * INTO existing FROM public.friendships
  WHERE (requester_id = caller_id AND receiver_id = target_id)
     OR (requester_id = target_id AND receiver_id = caller_id);

  IF existing.requester_id IS NOT NULL THEN
    IF existing.status = 'accepted' THEN
      RETURN jsonb_build_object('ok', false, 'reason', 'already_friends');
    ELSIF existing.requester_id = target_id THEN
      -- They already sent us a request; auto-accept
      UPDATE public.friendships SET status = 'accepted', updated_at = now()
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

-- Accept a pending request from another user
CREATE OR REPLACE FUNCTION public.accept_friend_request(other_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  rows_updated int;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
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

-- Decline a pending request OR unfriend (deletes the row regardless of direction)
CREATE OR REPLACE FUNCTION public.remove_friendship(other_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.friendships
  WHERE (requester_id = caller_id AND receiver_id = other_user_id)
     OR (requester_id = other_user_id AND receiver_id = caller_id);

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- Get the caller's accepted-friend user IDs (for client-side leaderboard filter)
CREATE OR REPLACE FUNCTION public.friend_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE WHEN requester_id = auth.uid() THEN receiver_id ELSE requester_id END
  FROM public.friendships
  WHERE status = 'accepted'
    AND (requester_id = auth.uid() OR receiver_id = auth.uid());
$function$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friendship(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.friend_ids() TO authenticated;

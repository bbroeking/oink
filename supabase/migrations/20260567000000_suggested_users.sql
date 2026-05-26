-- Suggested users — for the Friends > Add tab's "suggestions" row.
--
-- Returns up to N random profiles the caller is not already friends
-- with and has no pending friendship request to/from. Excludes the
-- caller themselves and profiles with no username (still in signup).
-- Ordered random so the row feels fresh each open.

CREATE OR REPLACE FUNCTION public.suggested_users(limit_n int DEFAULT 3)
RETURNS TABLE (
	id              uuid,
	username        text,
	discriminator   text,
	tickles_earned  int,
	active_hat_id   text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	SELECT p.id, p.username, p.discriminator, p.tickles_earned, p.active_hat_id
	FROM public.profiles p
	WHERE p.id <> auth.uid()
	  AND p.username IS NOT NULL
	  AND NOT EXISTS (
	    SELECT 1 FROM public.friendships f
	    WHERE (f.requester_id = auth.uid() AND f.receiver_id = p.id)
	       OR (f.receiver_id  = auth.uid() AND f.requester_id = p.id)
	  )
	ORDER BY random()
	LIMIT GREATEST(1, LEAST(20, COALESCE(limit_n, 3)));
$$;

GRANT EXECUTE ON FUNCTION public.suggested_users(int) TO authenticated;

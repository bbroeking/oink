-- Leaderboard pass events.
--
-- When a user's tickles_earned crosses above one of their friends' totals,
-- we record a row in leaderboard_events. The client polls the unseen rows
-- (via the unseen_pass_events RPC) on the home tab and surfaces them as
-- the existing rose-sticker toast: "Oink! <Brian> just trotted past you."
--
-- Scope: friends-only. The trigger inserts events ONLY for accepted-friends
-- of the updating user, which keeps event volume bounded and matches the
-- friends-scope leaderboard most users actually look at.
--
-- Dedupe: at most one event per (passer_id, passed_id) per 60s window so a
-- rapid burst of tickles doesn't fire a string of toasts.

-- ── table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leaderboard_events (
	id              bigserial    PRIMARY KEY,
	passer_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	passed_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	passer_tickles  bigint       NOT NULL,
	passed_tickles  bigint       NOT NULL,
	created_at      timestamptz  NOT NULL DEFAULT now(),
	seen_at         timestamptz,
	CHECK (passer_id <> passed_id)
);

CREATE INDEX IF NOT EXISTS leaderboard_events_passed_unseen_idx
	ON public.leaderboard_events (passed_id, created_at DESC)
	WHERE seen_at IS NULL;

-- One dedupe row per (passer, passed) inside the 60s window — enforced
-- in the trigger below rather than as a constraint because the window is
-- time-based.

ALTER TABLE public.leaderboard_events ENABLE ROW LEVEL SECURITY;

-- The user who got passed can read their own events.
DROP POLICY IF EXISTS "Read own pass events" ON public.leaderboard_events;
CREATE POLICY "Read own pass events"
	ON public.leaderboard_events FOR SELECT
	USING (auth.uid() = passed_id);

-- Inserts only happen through the SECURITY DEFINER trigger — block direct
-- writes by leaving no INSERT/UPDATE/DELETE policy for authenticated users.

-- ── trigger: detect passes on profiles.tickles_earned update ──────
CREATE OR REPLACE FUNCTION public.record_leaderboard_passes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	friend_row record;
BEGIN
	-- Only fire when tickles_earned actually went up.
	IF NEW.tickles_earned IS NULL
	   OR OLD.tickles_earned IS NULL
	   OR NEW.tickles_earned <= OLD.tickles_earned THEN
		RETURN NEW;
	END IF;

	-- Find every accepted-friend whose current tickles_earned sits in the
	-- (OLD, NEW] window — that's exactly the set of friends NEW.id just
	-- crossed past.
	FOR friend_row IN
		WITH friend_ids AS (
			SELECT CASE WHEN requester_id = NEW.id THEN receiver_id ELSE requester_id END AS uid
			FROM public.friendships
			WHERE status = 'accepted'
			  AND (requester_id = NEW.id OR receiver_id = NEW.id)
		)
		SELECT p.id AS friend_id, p.tickles_earned AS friend_tickles
		FROM public.profiles p
		JOIN friend_ids f ON f.uid = p.id
		WHERE p.tickles_earned >  OLD.tickles_earned
		  AND p.tickles_earned <= NEW.tickles_earned
		  AND p.id <> NEW.id
		LIMIT 25
	LOOP
		-- Dedupe: skip if we already inserted a pass event for this pair
		-- in the last 60 seconds.
		IF EXISTS (
			SELECT 1 FROM public.leaderboard_events
			WHERE passer_id = NEW.id
			  AND passed_id = friend_row.friend_id
			  AND created_at > now() - interval '60 seconds'
		) THEN
			CONTINUE;
		END IF;

		INSERT INTO public.leaderboard_events
			(passer_id, passed_id, passer_tickles, passed_tickles)
		VALUES
			(NEW.id, friend_row.friend_id, NEW.tickles_earned, friend_row.friend_tickles);
	END LOOP;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_record_leaderboard_passes ON public.profiles;
CREATE TRIGGER profiles_record_leaderboard_passes
	AFTER UPDATE OF tickles_earned ON public.profiles
	FOR EACH ROW
	EXECUTE FUNCTION public.record_leaderboard_passes();

-- ── RPC: fetch unseen pass events for the caller ──────────────────
-- Joined with the passer's username + active title so the client can render
-- the friendly toast without a second round-trip.
CREATE OR REPLACE FUNCTION public.unseen_pass_events()
RETURNS TABLE (
	id              bigint,
	passer_id       uuid,
	passer_username text,
	passer_tickles  bigint,
	passed_tickles  bigint,
	created_at      timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT e.id,
	       e.passer_id,
	       p.username,
	       e.passer_tickles,
	       e.passed_tickles,
	       e.created_at
	FROM public.leaderboard_events e
	LEFT JOIN public.profiles p ON p.id = e.passer_id
	WHERE e.passed_id = auth.uid()
	  AND e.seen_at IS NULL
	ORDER BY e.created_at DESC
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.unseen_pass_events() TO authenticated;

-- ── RPC: mark an event seen ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_pass_event_seen(event_id bigint)
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
	UPDATE public.leaderboard_events
		SET seen_at = now()
		WHERE id = event_id
		  AND passed_id = caller_id
		  AND seen_at IS NULL;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_pass_event_seen(bigint) TO authenticated;

-- ── RPC: mark all unseen events seen (used when user opens leaderboard) ──
CREATE OR REPLACE FUNCTION public.mark_all_pass_events_seen()
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
	UPDATE public.leaderboard_events
		SET seen_at = now()
		WHERE passed_id = caller_id
		  AND seen_at IS NULL;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_all_pass_events_seen() TO authenticated;

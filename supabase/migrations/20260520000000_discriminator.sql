-- Discord-style discriminators: `username#1234`.
--
-- Existing UNIQUE on profiles.username is replaced with a composite
-- UNIQUE on (username, discriminator) so multiple users can share a
-- username (e.g. two "Brian"s) but each (username, discriminator) pair
-- is global. A trigger auto-assigns a random 4-digit code on signup;
-- on username change, it's re-rolled only if the existing discriminator
-- collides with the new username's discriminator set.
--
-- The discriminator is otherwise hidden in the UI — see the new Friends
-- screen + the Account "your code" card. Day-to-day display stays
-- username-only; the `#` only surfaces where ambiguity matters.

-- ── helper: pick a random unused 4-digit code for a given username ──
CREATE OR REPLACE FUNCTION public.generate_unique_discriminator(target_username text)
RETURNS text
LANGUAGE plpgsql
AS $function$
DECLARE
	candidate text;
	attempts  int := 0;
BEGIN
	IF target_username IS NULL THEN RETURN NULL; END IF;
	LOOP
		candidate := lpad(floor(random() * 10000)::int::text, 4, '0');
		IF NOT EXISTS (
			SELECT 1 FROM public.profiles
			WHERE username = target_username AND discriminator = candidate
		) THEN
			RETURN candidate;
		END IF;
		attempts := attempts + 1;
		IF attempts > 256 THEN
			-- Pathological: same username taken 10k+ times. Pad space.
			RAISE EXCEPTION 'Could not allocate discriminator for username %', target_username;
		END IF;
	END LOOP;
END;
$function$;

-- ── add the column ────────────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS discriminator text
		CHECK (discriminator IS NULL OR discriminator ~ '^\d{4}$');

-- ── backfill existing rows that have a username but no discriminator
-- One UPDATE per row so the helper's collision check sees every
-- already-assigned discriminator from prior rows.
DO $$
DECLARE
	r record;
BEGIN
	FOR r IN
		SELECT id, username FROM public.profiles
		WHERE username IS NOT NULL AND discriminator IS NULL
	LOOP
		UPDATE public.profiles
			SET discriminator = public.generate_unique_discriminator(r.username)
			WHERE id = r.id;
	END LOOP;
END;
$$;

-- ── swap the uniqueness constraint ────────────────────────────────
-- Old: UNIQUE (username). New: UNIQUE (username, discriminator).
-- Profiles with NULL username (early-onboarding state) are excluded
-- from the constraint by NULL semantics.
ALTER TABLE public.profiles
	DROP CONSTRAINT IF EXISTS profiles_username_key;
DROP INDEX IF EXISTS public.profiles_username_key;

ALTER TABLE public.profiles
	ADD CONSTRAINT profiles_handle_key UNIQUE (username, discriminator);

-- Username prefix index for autocomplete (case-insensitive).
CREATE INDEX IF NOT EXISTS profiles_username_lower_idx
	ON public.profiles (lower(username));

-- ── trigger: auto-assign on insert + on username change ────────────
CREATE OR REPLACE FUNCTION public.profiles_assign_discriminator()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	-- Brand new username being set, or username changed and the
	-- current discriminator now collides with another user under the
	-- new username — re-roll.
	IF NEW.username IS NOT NULL AND (
		NEW.discriminator IS NULL
		OR (
			TG_OP = 'UPDATE' AND NEW.username IS DISTINCT FROM OLD.username
			AND EXISTS (
				SELECT 1 FROM public.profiles
				WHERE username = NEW.username
				  AND discriminator = NEW.discriminator
				  AND id <> NEW.id
			)
		)
	) THEN
		NEW.discriminator := public.generate_unique_discriminator(NEW.username);
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_assign_discriminator ON public.profiles;
CREATE TRIGGER profiles_assign_discriminator
	BEFORE INSERT OR UPDATE OF username, discriminator ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_assign_discriminator();

-- ── send_friend_request now takes a handle (username + discriminator)
-- Old signature kept for migration compat: if discriminator is NULL,
-- behaves like the original lookup-by-unique-username.
DROP FUNCTION IF EXISTS public.send_friend_request(text);

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
	caller_id  uuid := auth.uid();
	target_id  uuid;
	match_count int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	IF target_discriminator IS NULL THEN
		-- Legacy / disambiguated-by-unique path: only matches when
		-- exactly ONE user has that username. Surface the dup case so
		-- the UI can re-prompt with #-code.
		SELECT COUNT(*) INTO match_count
			FROM public.profiles WHERE username = target_username;
		IF match_count = 0 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
		END IF;
		IF match_count > 1 THEN
			RETURN jsonb_build_object(
				'ok', false, 'reason', 'discriminator_required',
				'matches', match_count
			);
		END IF;
		SELECT id INTO target_id
			FROM public.profiles WHERE username = target_username;
	ELSE
		SELECT id INTO target_id
			FROM public.profiles
			WHERE username = target_username
			  AND discriminator = target_discriminator;
	END IF;

	IF target_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF target_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;

	-- Idempotent insert — if a pending request already exists either
	-- direction, treat as success.
	INSERT INTO public.friendships (requester_id, receiver_id, status)
		VALUES (caller_id, target_id, 'pending')
		ON CONFLICT DO NOTHING;

	RETURN jsonb_build_object('ok', true, 'target_id', target_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_friend_request(text, text) TO authenticated;

-- ── cancel_friend_request: caller-initiated cancel of an outgoing pending
CREATE OR REPLACE FUNCTION public.cancel_friend_request(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	deleted   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	DELETE FROM public.friendships
		WHERE requester_id = caller_id
		  AND receiver_id = target_user_id
		  AND status = 'pending';
	GET DIAGNOSTICS deleted = ROW_COUNT;

	RETURN jsonb_build_object('ok', true, 'cancelled', deleted);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_friend_request(uuid) TO authenticated;

-- ── search_users: prefix autocomplete for the Add Friend UI ────────
-- Case-insensitive username prefix match. Excludes the caller and
-- anyone already in a (pending or accepted) friendship with them so
-- the autocomplete only surfaces "addable" candidates.
CREATE OR REPLACE FUNCTION public.search_users(
	prefix text,
	max_results int DEFAULT 10
)
RETURNS TABLE (
	id            uuid,
	username      text,
	discriminator text,
	tickles_earned int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT p.id, p.username, p.discriminator, p.tickles_earned
		FROM public.profiles p
		WHERE p.username IS NOT NULL
		  AND p.id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000')
		  AND lower(p.username) LIKE lower(prefix) || '%'
		  AND NOT EXISTS (
			SELECT 1 FROM public.friendships f
			WHERE (
				(f.requester_id = auth.uid() AND f.receiver_id = p.id)
				OR (f.receiver_id = auth.uid() AND f.requester_id = p.id)
			)
			AND f.status IN ('pending','accepted')
		  )
		ORDER BY length(p.username), lower(p.username)
		LIMIT GREATEST(1, LEAST(max_results, 25));
$function$;

GRANT EXECUTE ON FUNCTION public.search_users(text, int) TO authenticated;

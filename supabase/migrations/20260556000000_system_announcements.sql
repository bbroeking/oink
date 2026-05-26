-- Persistent system-announcement channel.
--
-- Pushes are best-effort and only reach users who've granted push
-- permission + registered a token. A brand-new player gets ZERO
-- surface from a send_push_to_user call. This table is the
-- backstop: every system message gets a row that persists until
-- the user dismisses it from the WhileAway modal.
--
-- Use cases:
--   • Welcome gift on signup (+10 tickles)
--   • Tournament / event reward acknowledgements
--   • Apology bonuses after an outage
--   • Season finale or pre-season "starts Friday" beats
--   • Anything where the message must reach the user reliably,
--     even without push permission.
--
-- Sender path: send_system_announcement(uid, kind, title, body, data)
--   → INSERT system_announcements row
--   → fire send_push_to_user (best-effort, swallowed on failure)
--
-- Receiver path: _layout.tsx polls my_unseen_announcements() in the
-- "while you were away" pass; modal renders them as cream cards;
-- mark_announcement_seen fires on dismiss.

CREATE TABLE IF NOT EXISTS public.system_announcements (
	id            bigserial    PRIMARY KEY,
	user_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	kind          text         NOT NULL,
	title         text         NOT NULL,
	body          text         NOT NULL,
	data          jsonb        NOT NULL DEFAULT '{}'::jsonb,
	dispatched_at timestamptz  NOT NULL DEFAULT now(),
	seen_at       timestamptz
);

CREATE INDEX IF NOT EXISTS system_announcements_user_unseen_idx
	ON public.system_announcements (user_id, dispatched_at DESC)
	WHERE seen_at IS NULL;

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own announcements" ON public.system_announcements;
CREATE POLICY "View own announcements"
	ON public.system_announcements FOR SELECT
	USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies. Writes go through the
-- SECURITY DEFINER RPCs below.

-- ── send_system_announcement ──────────────────────────────────────
-- Admin-only (gated on caller is_test=true) sender. Inserts the row
-- AND fires send_push_to_user so untokened users still get the row
-- (which surfaces via WhileAway) while tokened users get both
-- channels. Push failure is swallowed; the row is the source of
-- truth.
CREATE OR REPLACE FUNCTION public.send_system_announcement(
	target_user_id uuid,
	kind  text,
	title text,
	body  text,
	data  jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	caller_is_test boolean;
	new_id         bigint;
BEGIN
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (target_user_id, kind, title, body, data)
		RETURNING id INTO new_id;

	-- Best-effort push. Untokened users miss this but still see the
	-- row in WhileAway on next launch.
	BEGIN
		PERFORM public.send_push_to_user(
			target_user_id,
			title,
			body,
			data || jsonb_build_object('kind', kind, 'announcement_id', new_id::text)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN jsonb_build_object('ok', true, 'id', new_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_system_announcement(uuid, text, text, text, jsonb) TO authenticated;

-- ── my_unseen_announcements ──────────────────────────────────────
-- Caller's unseen system announcements, newest first.
CREATE OR REPLACE FUNCTION public.my_unseen_announcements()
RETURNS TABLE (
	id            bigint,
	kind          text,
	title         text,
	body          text,
	data          jsonb,
	dispatched_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT id, kind, title, body, data, dispatched_at
	FROM public.system_announcements
	WHERE user_id = auth.uid() AND seen_at IS NULL
	ORDER BY dispatched_at DESC
	LIMIT 20;
$function$;

GRANT EXECUTE ON FUNCTION public.my_unseen_announcements() TO authenticated;

-- ── mark_announcement_seen ───────────────────────────────────────
-- Called once per row on WhileAwayModal dismiss. Scoped to caller —
-- you can only mark your own. Idempotent (no-op if already seen).
CREATE OR REPLACE FUNCTION public.mark_announcement_seen(announcement_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	UPDATE public.system_announcements
		SET seen_at = now()
		WHERE id = announcement_id
		  AND user_id = auth.uid()
		  AND seen_at IS NULL;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_announcement_seen(bigint) TO authenticated;

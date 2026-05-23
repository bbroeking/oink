-- my_active_effects now also returns who LEFT each effect on you.
--
-- Redesign Phase 4 — the receiver panel ("Hoofprints on you") gives
-- each blessing/curse an attributable hand: "millie blessed you",
-- "ren cursed you". Until now my_active_effects only carried the
-- source ("blessing"|"curse") + the kind + when it expires; this
-- adds sender_id + sender_username via a LEFT JOIN against profiles
-- so the client doesn't need a second round-trip per row.
--
-- Pure additive: the prior columns (source, kind, expires_at) stay
-- first, so any other caller is unaffected; new columns trail.

DROP FUNCTION IF EXISTS public.my_active_effects();

CREATE OR REPLACE FUNCTION public.my_active_effects()
RETURNS TABLE (
	source           text,
	kind             text,
	expires_at       timestamptz,
	sender_id        uuid,
	sender_username  text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	SELECT 'blessing'::text, b.kind, b.expires_at, b.sender_id, p.username
		FROM public.blessings b
		LEFT JOIN public.profiles p ON p.id = b.sender_id
		WHERE b.receiver_id = auth.uid()
		  AND b.cleared_at IS NULL
		  AND b.expires_at IS NOT NULL
		  AND b.expires_at > now()
	UNION ALL
	SELECT 'curse'::text, c.kind, c.expires_at, c.sender_id, p.username
		FROM public.curses c
		LEFT JOIN public.profiles p ON p.id = c.sender_id
		WHERE c.receiver_id = auth.uid()
		  AND c.cleared_at IS NULL
		  AND c.expires_at IS NOT NULL
		  AND c.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.my_active_effects() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Storybook-seen server mirror (issue #11 — reinstall flow, Part B).
--
-- The first-run storybook Onboarding ("Hi, I'm Rosie!") is gated ONLY on the
-- local `seen_onboarding` AsyncStorage flag. A reinstall wipes AsyncStorage, so
-- a veteran with a real account replays the whole storybook. This adds a
-- server-authoritative mirror the client consults when the local flag is absent.
--
-- DISTINCT from the first-week checklist (onboarding_progress / claim_onboarding,
-- migration 20260649): that lane grants snouts per milestone; this is the single
-- "has this account ever finished the storybook" bit.
--
-- Client is fail-soft: it works against today's prod schema (no column, no
-- RPCs) — get_storybook_seen() missing → rpc() maps PGRST202 → null → treated
-- as "unknown" → local flag decides. All additive: no CREATE OR REPLACE over an
-- existing definition, so no carry-latest-def footgun.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Column ────────────────────────────────────────────────────────────────
-- Default false: every existing row reads "not seen server-side", which is
-- harmless — current veterans keep their LOCAL flag, which short-circuits the
-- gate before any server read. The mirror only starts mattering after the next
-- storybook completion writes it (or for reinstalls that never had it).
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS storybook_seen boolean NOT NULL DEFAULT false;

-- ── 2. get_storybook_seen — read own mirror ──────────────────────────────────
-- SECURITY DEFINER so it can read past profiles RLS, but scoped to auth.uid()
-- so a caller only ever sees their own bit. COALESCE guards a missing row.
CREATE OR REPLACE FUNCTION public.get_storybook_seen()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT p.storybook_seen FROM public.profiles p WHERE p.id = auth.uid()),
		false
	);
$function$;

-- ── 3. mark_storybook_seen — stamp own mirror ────────────────────────────────
-- Idempotent set-to-true for the calling user. No-op when unauthenticated
-- (auth.uid() null matches no row).
CREATE OR REPLACE FUNCTION public.mark_storybook_seen()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	UPDATE public.profiles SET storybook_seen = true WHERE id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.get_storybook_seen() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_storybook_seen() TO authenticated;

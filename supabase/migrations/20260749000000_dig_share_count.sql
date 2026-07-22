-- ════════════════════════════════════════════════════════════════════════
-- Dig-share tap counter (wedge 5b / spec 09 — the share-rate measurement lane).
--
-- The text-grid share on the dig receipt needs a share-rate signal, and the app
-- has NO general analytics lane. Per spec 09 the sanctioned fallback is a
-- fail-soft RPC counter: a single global daily tally the client bumps
-- fire-and-forget. The client (utils/digShare.bumpDigShareCount) is built to run
-- with or WITHOUT this migration — rpc() maps the missing function (PGRST202,
-- migration unpushed) to a null + warn breadcrumb, so the share works fully
-- offline / against today's prod. This is authored, NOT auto-pushed.
--
-- Privacy-light: no user id, no dig contents — just "a share button was tapped
-- on day D, N times". All additive (new table + new function), so there is no
-- CREATE OR REPLACE over an existing definition and no carry-latest-def footgun.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. The daily tally ───────────────────────────────────────────────────────
-- One row per UTC day; taps accumulates. PK on the day makes the bump an upsert.
CREATE TABLE IF NOT EXISTS public.dig_share_taps (
	day  date   PRIMARY KEY DEFAULT (now() AT TIME ZONE 'utc')::date,
	taps bigint NOT NULL DEFAULT 0
);

-- RPC-only table: no policies (SECURITY DEFINER function is the sole writer, and
-- nothing reads it from the client), matching the Den's zero-policy posture.
ALTER TABLE public.dig_share_taps ENABLE ROW LEVEL SECURITY;

-- ── 2. bump_dig_share_count — fire-and-forget increment ──────────────────────
-- SECURITY DEFINER so it writes past the table's RLS. No args, no return payload
-- the client reads — it's a best-effort counter. Idempotent-per-call upsert:
-- first tap of the day inserts, every later tap bumps.
CREATE OR REPLACE FUNCTION public.bump_dig_share_count()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	INSERT INTO public.dig_share_taps AS t (day, taps)
	VALUES ((now() AT TIME ZONE 'utc')::date, 1)
	ON CONFLICT (day) DO UPDATE SET taps = t.taps + 1;
$function$;

GRANT EXECUTE ON FUNCTION public.bump_dig_share_count() TO authenticated;

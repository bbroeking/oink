-- Prep for 20260746000000_trough_nudge_supersede.sql (spec 04 / issue #10 A).
--
-- nudge_trough's body reads/writes tables + a function the plain-Postgres stub
-- doesn't carry (they live in the unchained trough migrations 20260604/20260623
-- in prod). check_function_bodies validates the redefined body at CREATE, so
-- these must exist AHEAD of the migration ($@). Minimal shapes — only the
-- columns/signatures the function touches. 44_trough_nudge_supersede_smoke.sql
-- re-declares them IF NOT EXISTS for clarity and seeds its own rows.

-- item_drives — the Trough. nudge_trough reads id/opener_user_id/status/
-- closes_at/last_nudge_at/item_id and stamps last_nudge_at.
CREATE TABLE IF NOT EXISTS public.item_drives (
	id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	opener_user_id uuid,
	item_id        text,
	status         text        NOT NULL DEFAULT 'open',
	closes_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
	last_nudge_at  timestamptz
);

-- system_announcements: the stub omits seen_at (the real 20260556 table has it).
-- The supersede path marks UNSEEN rows seen, so add it.
ALTER TABLE public.system_announcements
	ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- hats: nudge_trough reads hats.name for the announcement copy; the stub's
-- minimal hats has no name column.
ALTER TABLE public.hats
	ADD COLUMN IF NOT EXISTS name text;

-- are_blocked(a,b): the function skips nudging a blocked friend. Stub returns
-- false (no blocks) so the smoke exercises the happy path.
CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid) RETURNS boolean
LANGUAGE sql AS $$ SELECT false $$;

-- Pin the current Feeding for the Sounder-message smoke. The production RPCs
-- still consume the real server-owned _patch_clock; this harness stand-in makes
-- state-aware availability deterministic regardless of wall-clock test time.
CREATE OR REPLACE FUNCTION public._patch_clock(p_at timestamptz)
RETURNS TABLE(
	window_index bigint,
	dig_day date,
	phase_open boolean,
	phase_ends_at timestamptz,
	opens_at timestamptz,
	window_ends_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT
		680001::bigint,
		date '2026-08-26',
		true,
		timestamptz '2026-08-26 18:00:00+00',
		timestamptz '2026-08-26 14:00:00+00',
		timestamptz '2026-08-26 20:00:00+00';
$function$;

-- The stable harness base supplies a no-block are_blocked() stand-in but not
-- its backing table. Restore the production-shaped moderation pair so the
-- Sounder smoke can prove blocked recipients are filtered.
CREATE TABLE IF NOT EXISTS public.user_blocks (
	blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (blocker_id, blocked_id)
);

CREATE OR REPLACE FUNCTION public.are_blocked(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.user_blocks
		WHERE (blocker_id = a AND blocked_id = b)
			OR (blocker_id = b AND blocked_id = a)
	);
$function$;

-- Phase 1 of Season 1: track when a user has "seen the schism."
--
-- When a user's alignment_score first crosses ±25 (toward angel or
-- goblin), we show them the one-time AlignmentSchismModal. After
-- that we never show that same crossing again — even if their score
-- yo-yos in and out.
--
-- Two columns instead of one because the user CAN see both schisms
-- in a long-running account (cross +25 generous, drift back, cross
-- -25 greedy). Each is independently "seen once."
--
-- The +25 threshold (not the +34 label threshold) is intentional —
-- the schism reveal is the "you're STARTING to show this side"
-- moment that happens BEFORE you firmly land in the angel/goblin
-- bucket. It's a foreshadowing beat, not a labeling beat.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS schism_seen_angel_at  timestamptz,
	ADD COLUMN IF NOT EXISTS schism_seen_goblin_at timestamptz;

-- ── check_schism_status: client polls this on focus. Returns the
-- side that's pending (or 'none' if no unseen schism applies).
-- Fast: indexed PK lookup + two boolean checks.
CREATE OR REPLACE FUNCTION public.check_schism_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	row_score   int;
	angel_seen  timestamptz;
	goblin_seen timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('side', 'none');
	END IF;

	SELECT alignment_score, schism_seen_angel_at, schism_seen_goblin_at
		INTO row_score, angel_seen, goblin_seen
		FROM public.profiles WHERE id = caller_id;

	IF row_score >= 25 AND angel_seen IS NULL THEN
		RETURN jsonb_build_object('side', 'angel', 'score', row_score);
	END IF;
	IF row_score <= -25 AND goblin_seen IS NULL THEN
		RETURN jsonb_build_object('side', 'goblin', 'score', row_score);
	END IF;
	RETURN jsonb_build_object('side', 'none');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.check_schism_status() TO authenticated;

-- ── mark_schism_seen: client calls this on modal dismiss.
-- Idempotent: re-calling does nothing destructive.
CREATE OR REPLACE FUNCTION public.mark_schism_seen(side text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF side NOT IN ('angel', 'goblin') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_side');
	END IF;

	IF side = 'angel' THEN
		UPDATE public.profiles SET schism_seen_angel_at = now()
			WHERE id = caller_id AND schism_seen_angel_at IS NULL;
	ELSE
		UPDATE public.profiles SET schism_seen_goblin_at = now()
			WHERE id = caller_id AND schism_seen_goblin_at IS NULL;
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_schism_seen(text) TO authenticated;

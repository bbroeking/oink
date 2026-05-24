-- Extend the one-time AlignmentSchismModal to fire at ±50 and ±100
-- (the "Deeply Generous/Greedy" and "Saint/Goblin King" milestones)
-- in addition to the existing ±25 first-crossing.
--
-- The alignment_notifications trigger (20260536000000) already
-- pushes for all 8 milestones (±10, ±25, ±50, ±100). The modal
-- has been firing for ±25 only — leaving the most dramatic
-- thresholds (Goblin King, Saint of the Sounder) as push-only.
--
-- Schema: replace the per-side schism_seen_*_at columns with a
-- (user_id, side, milestone) table. Composite PK lets each
-- (side, milestone) be marked-seen independently.

-- ── 1. New table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_schism_seen (
	user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	side      text        NOT NULL CHECK (side IN ('angel', 'goblin')),
	milestone int         NOT NULL CHECK (milestone IN (25, 50, 100)),
	seen_at   timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, side, milestone)
);

ALTER TABLE public.user_schism_seen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own schism seen" ON public.user_schism_seen;
CREATE POLICY "View own schism seen"
	ON public.user_schism_seen FOR SELECT
	USING (auth.uid() = user_id);

-- ── 2. Backfill from legacy columns ───────────────────────────────
-- Existing schism_seen_angel_at / schism_seen_goblin_at columns
-- only ever held the 25-milestone marker. Carry that history
-- into the new table so users who've already seen the ±25 modal
-- don't get it again.
INSERT INTO public.user_schism_seen (user_id, side, milestone, seen_at)
SELECT id, 'angel', 25, schism_seen_angel_at
	FROM public.profiles WHERE schism_seen_angel_at IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.user_schism_seen (user_id, side, milestone, seen_at)
SELECT id, 'goblin', 25, schism_seen_goblin_at
	FROM public.profiles WHERE schism_seen_goblin_at IS NOT NULL
ON CONFLICT DO NOTHING;

-- The legacy columns are kept so older client builds don't crash
-- reading them; the new table is the source of truth.

-- ── 3. check_schism_status — returns highest UNSEEN milestone ─────
-- Returns the most-impressive milestone the user is currently at
-- or past that they haven't dismissed yet. If a user blasts from
-- 0 to +60 in one session, they see the +50 modal (skipping the
-- +25 — the higher one supersedes since it implies the lower).
-- The milestone they ALREADY would have been shown at (the +25)
-- isn't re-shown if they've moved past it.
CREATE OR REPLACE FUNCTION public.check_schism_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	row_score int;
	angel_ms  int;
	goblin_ms int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('side', 'none');
	END IF;

	SELECT alignment_score INTO row_score
		FROM public.profiles WHERE id = caller_id;

	-- For each side, find the highest milestone reached AND not yet
	-- seen. NULL if none qualifies.
	angel_ms := (
		SELECT MAX(m) FROM (VALUES (25), (50), (100)) AS thresholds(m)
		WHERE row_score >= m
		  AND NOT EXISTS (
		    SELECT 1 FROM public.user_schism_seen s
		    WHERE s.user_id = caller_id
		      AND s.side = 'angel'
		      AND s.milestone = m
		  )
	);
	goblin_ms := (
		SELECT MAX(m) FROM (VALUES (25), (50), (100)) AS thresholds(m)
		WHERE row_score <= -m
		  AND NOT EXISTS (
		    SELECT 1 FROM public.user_schism_seen s
		    WHERE s.user_id = caller_id
		      AND s.side = 'goblin'
		      AND s.milestone = m
		  )
	);

	-- Prefer the side they're CURRENTLY tipped toward — if they've
	-- yo-yo'd past both sides in the past, the active one wins.
	IF angel_ms IS NOT NULL AND row_score > 0 THEN
		RETURN jsonb_build_object(
			'side', 'angel',
			'milestone', angel_ms,
			'score', row_score
		);
	END IF;
	IF goblin_ms IS NOT NULL AND row_score < 0 THEN
		RETURN jsonb_build_object(
			'side', 'goblin',
			'milestone', goblin_ms,
			'score', row_score
		);
	END IF;
	-- Tie-breaker for score=0: angel if pending, else goblin if pending.
	IF angel_ms IS NOT NULL THEN
		RETURN jsonb_build_object('side', 'angel', 'milestone', angel_ms, 'score', row_score);
	END IF;
	IF goblin_ms IS NOT NULL THEN
		RETURN jsonb_build_object('side', 'goblin', 'milestone', goblin_ms, 'score', row_score);
	END IF;
	RETURN jsonb_build_object('side', 'none');
END;
$function$;

-- ── 4. mark_schism_seen — now takes (side, milestone) ─────────────
-- Old 1-arg signature (just `side`) kept around for transition;
-- defaults to milestone=25 so older client builds still mark the
-- right row. New client passes milestone explicitly.
CREATE OR REPLACE FUNCTION public.mark_schism_seen(side text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	RETURN public.mark_schism_seen(side, 25);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_schism_seen(side text, milestone int)
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
	IF milestone NOT IN (25, 50, 100) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_milestone');
	END IF;

	INSERT INTO public.user_schism_seen (user_id, side, milestone)
		VALUES (caller_id, side, milestone)
		ON CONFLICT DO NOTHING;

	-- Keep the legacy columns in sync at the 25 milestone so any
	-- old code path still reading them gets the right answer.
	IF milestone = 25 THEN
		IF side = 'angel' THEN
			UPDATE public.profiles SET schism_seen_angel_at = COALESCE(schism_seen_angel_at, now())
				WHERE id = caller_id;
		ELSE
			UPDATE public.profiles SET schism_seen_goblin_at = COALESCE(schism_seen_goblin_at, now())
				WHERE id = caller_id;
		END IF;
	END IF;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_schism_seen(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_schism_seen(text, int) TO authenticated;

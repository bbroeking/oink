-- Barn: per-friend (pairwise) lock probe for the friends list.
--
-- The friends list already reads barn_visit_status ONCE to gate every row on
-- the window-global budget (3 distinct barns / 3h). That's the GLOBAL gate.
-- This adds the PER-PAIR gate: a friend you've already tickled out (the pair's
-- 24h pairwise lock is live and its tap cap is spent) should read as "tickled
-- out" on the row itself, so the player never taps into the locked "Tickled!"
-- arrival screen.
--
-- barn_pair_locks(p_targets) computes, for many targets at once, THE SAME
-- pairwise lock the newest barn_visit_status def (20260691) computes for a
-- single target — same source rows (barn_visits latest per pair by created_at),
-- same window (24h pairwise), same tap-cap arithmetic — so the row and the modal
-- can never disagree. It does NOT compute the window-global budget lock; that
-- stays the list's single barn_visit_status probe (the global gate).
--
-- One set-based query, no per-target loop: DISTINCT ON (target_id) ... ORDER BY
-- created_at DESC picks each pair's newest visit row (mirrors the scalar def's
-- "ORDER BY created_at DESC LIMIT 1"), a correlated count() tallies taps in that
-- live session (visit_started_at = the picked start), and the locked/taps_left/
-- next_at outputs are derived with the same expressions the scalar def uses.

CREATE OR REPLACE FUNCTION public.barn_pair_locks(p_targets uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	pair_cooldown constant interval := '24 hours';  -- must match barn_visit_status
	max_targets   constant int := 100;              -- cap the fan-out
	v_targets     uuid[];
	v_pairs       jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	-- Sanitize: drop nulls + self, dedupe, cap the array. An empty/garbage
	-- input still returns ok with an empty pairs list.
	SELECT array_agg(DISTINCT t)
	INTO v_targets
	FROM (
		SELECT unnest(COALESCE(p_targets, ARRAY[]::uuid[])) AS t
	) s
	WHERE t IS NOT NULL AND t <> caller_id
	LIMIT max_targets;

	IF v_targets IS NULL OR array_length(v_targets, 1) IS NULL THEN
		RETURN jsonb_build_object('ok', true, 'pairs', '[]'::jsonb);
	END IF;

	-- One set-based pass. `latest` = each pair's newest visit row (mirrors the
	-- scalar def's ORDER BY created_at DESC LIMIT 1). taps_this_visit counts the
	-- taps in that live session (visit_started_at = the picked start), exactly
	-- like barn_visit_status. locked / taps_left / next_at reuse its expressions.
	WITH latest AS (
		SELECT DISTINCT ON (bv.target_id)
			bv.target_id,
			bv.visit_started_at,
			bv.visit_cap
		FROM public.barn_visits bv
		WHERE bv.visitor_id = caller_id
		  AND bv.target_id = ANY (v_targets)
		ORDER BY bv.target_id, bv.created_at DESC
	),
	scored AS (
		SELECT
			l.target_id,
			l.visit_started_at,
			l.visit_cap,
			(
				SELECT count(*)
				FROM public.barn_visits bv2
				WHERE bv2.visitor_id = caller_id
				  AND bv2.target_id = l.target_id
				  AND bv2.visit_started_at = l.visit_started_at
			) AS taps_this_visit
		FROM latest l
	)
	SELECT jsonb_agg(
		jsonb_build_object(
			'target_id', t.target_id,
			'locked', t.locked,
			'taps_left', t.taps_left,
			'next_at', t.next_at
		)
	)
	INTO v_pairs
	FROM (
		SELECT
			target_id,
			-- Pairwise lock: visited within 24h → locked for the whole window
			-- (leaving forfeits unused taps). Same test as barn_visit_status.
			(visit_started_at IS NOT NULL AND visit_started_at > now() - pair_cooldown) AS locked,
			CASE
				WHEN visit_started_at IS NOT NULL AND visit_started_at > now() - pair_cooldown
					THEN GREATEST(0, visit_cap - taps_this_visit)
				ELSE NULL
			END AS taps_left,
			CASE
				WHEN visit_started_at IS NOT NULL AND visit_started_at > now() - pair_cooldown
					THEN visit_started_at + pair_cooldown
				ELSE NULL
			END AS next_at
		FROM scored
	) t;

	RETURN jsonb_build_object(
		'ok', true,
		'pairs', COALESCE(v_pairs, '[]'::jsonb)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.barn_pair_locks(uuid[]) TO authenticated;

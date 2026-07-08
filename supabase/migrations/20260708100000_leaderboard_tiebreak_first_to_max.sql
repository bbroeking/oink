-- Leaderboard tiebreak — OPTION 1 of 3: "First to the cap wins."
--
-- Problem being fixed: at season end a large pack sits tied at +100 (and a
-- pack at -100). Both the live board (alignment_leaderboard) and the reward
-- dispersal (finalize_season) currently break that tie by p.id — the raw
-- UUID — so the top-3 finale titles (halo_bearer_2026 / goblin_king_2026,
-- +500 snouts) and the top-10 gilded tier (+250) are handed out in
-- lexicographic-UUID order. That is deterministic but arbitrary: it rewards
-- nothing a player did.
--
-- This option ranks tied players by WHO REACHED THE EXTREME FIRST. It adds a
-- first-reach timestamp captured at the exact ±100 crossing.
--
-- ⚠️ BACKFILL CAVEAT (read before choosing this option): players who were
-- ALREADY at ±100 before this migration lands have no recorded crossing
-- event, so we backfill their alignment_maxed_at from alignment_updated_at —
-- their LAST alignment action, not their first reach. For the current
-- season's already-maxed pack this ordering is therefore approximate (it
-- skews toward "least-recently-active among the maxed"). Going forward it is
-- exact. If precise first-reach for the current pack matters, we'd need an
-- alignment history/event log, which we don't have. Flagged for the reviewer.

-- 1. First-reach timestamp column.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS alignment_maxed_at timestamptz;

-- 2. Backfill current extreme-holders (approximate — see caveat above).
UPDATE public.profiles
	SET alignment_maxed_at = alignment_updated_at
	WHERE abs(alignment_score) = 100
	  AND alignment_maxed_at IS NULL;

-- 3. shift_alignment: stamp alignment_maxed_at at the ±100 crossing. Carried
--    VERBATIM from 20260536000000_alignment_notifications.sql; the ONLY change
--    is the new stamp block just before RETURN. The milestone ratchet
--    (alignment_max_pos/neg) already fires at most once per side, so the
--    stamp records first-reach and never drifts on later same-side taps.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.shift_alignment(
	target_user_id uuid,
	delta int
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	new_score      int;
	old_max_pos    int;
	old_max_neg    int;
	hit_milestone  int := 0;
	push_title     text;
	push_body      text;
BEGIN
	SELECT alignment_max_pos, alignment_max_neg
		INTO old_max_pos, old_max_neg
		FROM public.profiles WHERE id = target_user_id;

	UPDATE public.profiles
		SET alignment_score      = GREATEST(-100, LEAST(100, alignment_score + delta)),
		    alignment_updated_at = now()
		WHERE id = target_user_id
		RETURNING alignment_score INTO new_score;

	IF new_score > old_max_pos THEN
		hit_milestone := CASE
			WHEN new_score >= 100 AND old_max_pos < 100 THEN 100
			WHEN new_score >=  50 AND old_max_pos <  50 THEN  50
			WHEN new_score >=  25 AND old_max_pos <  25 THEN  25
			WHEN new_score >=  10 AND old_max_pos <  10 THEN  10
			ELSE 0
		END;
		UPDATE public.profiles
			SET alignment_max_pos = new_score
			WHERE id = target_user_id;
	ELSIF new_score < old_max_neg THEN
		hit_milestone := CASE
			WHEN new_score <= -100 AND old_max_neg > -100 THEN -100
			WHEN new_score <=  -50 AND old_max_neg >  -50 THEN  -50
			WHEN new_score <=  -25 AND old_max_neg >  -25 THEN  -25
			WHEN new_score <=  -10 AND old_max_neg >  -10 THEN  -10
			ELSE 0
		END;
		UPDATE public.profiles
			SET alignment_max_neg = new_score
			WHERE id = target_user_id;
	END IF;

	IF hit_milestone <> 0 THEN
		push_title := CASE hit_milestone
			WHEN   10 THEN 'Generosity is showing'
			WHEN   25 THEN 'You crossed into Generous'
			WHEN   50 THEN 'Deeply Generous'
			WHEN  100 THEN 'Saint of the Sounder'
			WHEN  -10 THEN 'Greed is creeping in'
			WHEN  -25 THEN 'You crossed into Greedy'
			WHEN  -50 THEN 'Deeply Greedy'
			WHEN -100 THEN 'Goblin King'
		END;
		push_body := CASE hit_milestone
			WHEN   10 THEN 'Friends are noticing the way you give.'
			WHEN   25 THEN 'The schism tipped — you''re a Giver now.'
			WHEN   50 THEN 'The sounder remembers what you''ve given.'
			WHEN  100 THEN 'Pure light. Nowhere further to give.'
			WHEN  -10 THEN 'You''ve been taking more than giving.'
			WHEN  -25 THEN 'The goblin grin shows — the sounder sees.'
			WHEN  -50 THEN 'Friends step lightly when you ask.'
			WHEN -100 THEN 'Pure greed. Nowhere further to fall.'
		END;
		BEGIN
			PERFORM public.send_push_to_user(
				target_user_id,
				push_title,
				push_body,
				jsonb_build_object(
					'kind', 'alignment',
					'milestone', hit_milestone,
					'screen', 'friends'
				)
			);
		EXCEPTION WHEN OTHERS THEN
			NULL;
		END;
	END IF;

	-- NEW: stamp the first time this player reaches an extreme (±100).
	IF hit_milestone = 100 OR hit_milestone = -100 THEN
		UPDATE public.profiles
			SET alignment_maxed_at = now()
			WHERE id = target_user_id;
	END IF;

	RETURN new_score;
END;
$function$;

-- 4. finalize_season: tiebreak by first-reach. Carried VERBATIM from
--    20260704600000_finalize_season_ambiguity_fix.sql (incl. the
--    ON CONSTRAINT season_finales_pkey fix); ONLY the two side_rank ORDER BY
--    clauses gain `alignment_maxed_at ASC NULLS LAST` before p.id.
CREATE OR REPLACE FUNCTION public.finalize_season(season_key text DEFAULT 'season_1')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r            record;
	bracket      text;
	title_id     text;
	snouts       int;
	granted      int := 0;
BEGIN
	FOR r IN
		SELECT
			p.id,
			p.alignment_score AS score,
			CASE
				WHEN p.alignment_score >  0 THEN 'generous'
				WHEN p.alignment_score <  0 THEN 'greedy'
				ELSE 'neutral'
			END AS side,
			CASE
				WHEN p.alignment_score > 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score > 0)
						ORDER BY p.alignment_score DESC, p.alignment_maxed_at ASC NULLS LAST, p.id)
				WHEN p.alignment_score < 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score < 0)
						ORDER BY p.alignment_score ASC, p.alignment_maxed_at ASC NULLS LAST, p.id)
				ELSE NULL
			END AS side_rank
		FROM public.profiles p
		WHERE p.username IS NOT NULL AND p.username <> ''
	LOOP
		IF r.side = 'neutral' THEN
			bracket := 'neutral'; title_id := 'calm_in_the_storm'; snouts := 100;
		ELSIF r.side_rank <= 3 THEN
			bracket := 'top3';
			title_id := CASE r.side WHEN 'generous' THEN 'halo_bearer_2026'
			                        ELSE 'goblin_king_2026' END;
			snouts := 500;
		ELSIF r.side_rank <= 10 THEN
			bracket := 'top10'; title_id := 'gilded_2026'; snouts := 250;
		ELSE
			bracket := 'participant'; title_id := 'schism_survivor'; snouts := 100;
		END IF;

		INSERT INTO public.season_finales
			(user_id, season_key, final_score, side, side_rank, bracket, title_id, snouts)
			VALUES (r.id, season_key, r.score, r.side, r.side_rank, bracket, title_id, snouts)
			ON CONFLICT ON CONSTRAINT season_finales_pkey DO NOTHING;

		IF FOUND THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (r.id, title_id) ON CONFLICT DO NOTHING;
			UPDATE public.profiles SET counter = counter + snouts WHERE id = r.id;
			granted := granted + 1;
		END IF;
	END LOOP;

	UPDATE public.profiles
		SET alignment_score = 0, alignment_updated_at = now()
		WHERE alignment_score <> 0;

	RETURN jsonb_build_object('ok', true, 'granted', granted, 'season_key', season_key);
END;
$function$;

-- 5. alignment_leaderboard (live display): mirror the tiebreak so the board
--    players SEE previews the finale payout. Carried from
--    20260586000000_hide_from_leaderboard.sql; ONLY the ORDER BY clauses gain
--    `p.alignment_maxed_at ASC NULLS LAST` before p.id.
CREATE OR REPLACE FUNCTION public.alignment_leaderboard(per_side int DEFAULT 20)
RETURNS TABLE (
	user_id         uuid,
	username        text,
	active_hat_id   text,
	active_flag_id  text,
	alignment_score int,
	side            text,
	side_rank       int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'generous'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score DESC, p.alignment_maxed_at ASC NULLS LAST, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score > 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score DESC, p.alignment_maxed_at ASC NULLS LAST, p.id
		LIMIT per_side
	)
	UNION ALL
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'greedy'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score ASC, p.alignment_maxed_at ASC NULLS LAST, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score < 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score ASC, p.alignment_maxed_at ASC NULLS LAST, p.id
		LIMIT per_side
	);
$$;

GRANT EXECUTE ON FUNCTION public.alignment_leaderboard(int) TO authenticated;
-- finalize_season stays NOT granted to authenticated (cron / service role only);
-- CREATE OR REPLACE preserves the existing ACL.

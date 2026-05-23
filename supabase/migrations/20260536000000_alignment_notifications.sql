-- Alignment notifications + threshold unification.
--
-- Two changes that go together:
--
--   1. Unify the Pilgrim → Greedy/Generous label threshold with the
--      schism reveal at ±25. Before: schism fired at ±25 but the
--      label stayed "Pilgrim" until ±34 — three different "your side
--      shifted" moments (leaderboard at >0, schism at ±25, label at
--      ±34). Now schism + label-flip are the same beat.
--
--   2. Push notifications at milestone crossings ±10, ±25, ±50, ±100.
--      Tracked per side via two ratchet columns (alignment_max_pos /
--      alignment_max_neg) so each milestone fires AT MOST ONCE per
--      side. Oscillating within a band doesn't re-notify; moving
--      back toward 0 doesn't notify either — only new EXTREMES do.
--
-- Mirrors ritual_push: fire-and-forget send_push_to_user inside a
-- BEGIN/EXCEPTION block — a push failure must never roll back a
-- score update.

-- ── 1. Unify the label threshold ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.alignment_label(score int)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
	SELECT CASE
		WHEN score >=  25 THEN 'angel'
		WHEN score <= -25 THEN 'goblin'
		ELSE 'neutral'
	END;
$$;

-- ── 2. Per-side milestone ratchets ─────────────────────────────────

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS alignment_max_pos int NOT NULL DEFAULT 0,
	ADD COLUMN IF NOT EXISTS alignment_max_neg int NOT NULL DEFAULT 0;

-- Backfill from current alignment_score — so a player already at
-- +50 doesn't get spammed with +10/+25/+50 pushes on the first shift
-- after this migration lands.
UPDATE public.profiles
	SET alignment_max_pos = GREATEST(alignment_max_pos, alignment_score),
	    alignment_max_neg = LEAST(alignment_max_neg, alignment_score);

-- ── 3. shift_alignment rebuilt — adds the milestone push ───────────
--
-- Rebuilt from the live definition (verified via pg_get_functiondef);
-- the score update is byte-identical, only the milestone detection +
-- push are new.

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
	-- Snapshot the ratchets BEFORE updating, so we can detect new
	-- crossings. Then update score + advance the relevant ratchet.
	SELECT alignment_max_pos, alignment_max_neg
		INTO old_max_pos, old_max_neg
		FROM public.profiles WHERE id = target_user_id;

	UPDATE public.profiles
		SET alignment_score      = GREATEST(-100, LEAST(100, alignment_score + delta)),
		    alignment_updated_at = now()
		WHERE id = target_user_id
		RETURNING alignment_score INTO new_score;

	-- Hit a new positive milestone?
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
	-- Or a new negative milestone?
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

	-- Fire the milestone push, if we crossed one.
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

	RETURN new_score;
END;
$function$;

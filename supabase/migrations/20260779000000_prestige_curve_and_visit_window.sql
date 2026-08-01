-- PRESTIGE CURVE + VISIT CADENCE
--
-- #48/#49: W1/W2 grant +25% regen each; W3+ grant +5% to a 70% cap
-- (W6). The shared 3-Barn visit budget refreshes in max(3, 8-rank) hours.
-- Parameters live in app_settings.wallow_tuning; every SQL helper has the same
-- compiled fallback as utils/wallow.ts.
--
-- Existing large functions are preserved behind wrappers instead of being
-- stale-copied: rename the latest live definition once, call it, and override
-- only the new contract fields/gates.

INSERT INTO public.app_settings (key, value, description)
VALUES (
	'wallow_tuning',
	'{
		"major_ranks": 2,
		"major_step_pct": 25,
		"minor_step_pct": 5,
		"regen_cap_pct": 70,
		"visit_base_hours": 8,
		"visit_step_hours": 1,
		"visit_min_hours": 3
	}'::jsonb,
	'Prestige tuning: regen curve and the shared 3-Barn visit-budget window.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._wallow_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'wallow_tuning'),
		'{
			"major_ranks": 2,
			"major_step_pct": 25,
			"minor_step_pct": 5,
			"regen_cap_pct": 70,
			"visit_base_hours": 8,
			"visit_step_hours": 1,
			"visit_min_hours": 3
		}'::jsonb
	);
$function$;
REVOKE ALL ON FUNCTION public._wallow_tuning() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._wallow_regen_percent(p_wallow_count int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH tuning AS (SELECT public._wallow_tuning() AS v),
	safe AS (SELECT GREATEST(0, COALESCE(p_wallow_count, 0))::numeric AS rank, v FROM tuning)
	SELECT LEAST(
		COALESCE((v->>'regen_cap_pct')::numeric, 70),
		LEAST(rank, COALESCE((v->>'major_ranks')::numeric, 2))
			* COALESCE((v->>'major_step_pct')::numeric, 25)
		+ GREATEST(0, rank - COALESCE((v->>'major_ranks')::numeric, 2))
			* COALESCE((v->>'minor_step_pct')::numeric, 5)
	)
	FROM safe;
$function$;
REVOKE ALL ON FUNCTION public._wallow_regen_percent(int)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._wallow_visit_hours(p_wallow_count int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH tuning AS (SELECT public._wallow_tuning() AS v)
	SELECT GREATEST(
		COALESCE((v->>'visit_min_hours')::numeric, 3),
		COALESCE((v->>'visit_base_hours')::numeric, 8)
			- GREATEST(0, COALESCE(p_wallow_count, 0))
				* COALESCE((v->>'visit_step_hours')::numeric, 1)
	)
	FROM tuning;
$function$;
REVOKE ALL ON FUNCTION public._wallow_visit_hours(int)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._regen_secs_for_wallow(uid uuid, p_wallow_count int)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		3600
		* (1.0 - public._wallow_regen_percent(p_wallow_count) / 100.0)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind IN ('warm_tea', 'mud_wrap', 'chorus_glow')
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;
REVOKE ALL ON FUNCTION public._regen_secs_for_wallow(uuid, int)
	FROM PUBLIC, anon, authenticated;

-- Server-listed exclusive wearable per rank. Content rows are seeded below once
-- their assets are registered; future ranks require only data, not function edits.
ALTER TABLE public.hats
	ADD COLUMN IF NOT EXISTS prestige_exclusive boolean NOT NULL DEFAULT false;

INSERT INTO public.hats
	(id, name, emoji, cost, display_order, category, rarity, description, prestige_exclusive)
VALUES
	('wallow_rookie_cap', 'Rookie Wallow Cap', NULL, 0, 501, 'hat', 'common',
	 'A muddy first-rank cap with a lucky Golden Truffle pin.', true),
	('wallow_bronze_specs', 'Bronze Wallow Specs', NULL, 0, 502, 'glasses', 'uncommon',
	 'Warm bronze lenses earned by returning to the Wallow.', true),
	('wallow_marsh_crown', 'Marsh Crown', NULL, 0, 503, 'hat', 'rare',
	 'Reeds, mud, and three bright truffles woven into a crown.', true),
	('wallow_gilded_bow', 'Gilded Wallow Bow', NULL, 0, 504, 'bow', 'epic',
	 'A velvet bow for pigs who have made prestige a habit.', true),
	('wallow_golden_trowel', 'Golden Wallow Trowel', NULL, 0, 505, 'held', 'legendary',
	 'A ceremonial golden trowel reserved for seasoned rooters.', true),
	('wallow_sovereign_crown', 'Wallow Sovereign Crown', NULL, 0, 506, 'hat', 'legendary',
	 'The mud-and-gold crown at the top of the Wallow ladder.', true)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	cost = EXCLUDED.cost,
	display_order = EXCLUDED.display_order,
	category = EXCLUDED.category,
	rarity = EXCLUDED.rarity,
	description = EXCLUDED.description,
	prestige_exclusive = true;

CREATE TABLE IF NOT EXISTS public.wallow_rank_rewards (
	rank int PRIMARY KEY CHECK (rank >= 1),
	hat_id text NOT NULL REFERENCES public.hats(id)
);
ALTER TABLE public.wallow_rank_rewards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
	CREATE POLICY "Wallow rewards public" ON public.wallow_rank_rewards
		FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT ON public.wallow_rank_rewards TO authenticated, anon;

INSERT INTO public.wallow_rank_rewards (rank, hat_id) VALUES
	(1, 'wallow_rookie_cap'),
	(2, 'wallow_bronze_specs'),
	(3, 'wallow_marsh_crown'),
	(4, 'wallow_gilded_bow'),
	(5, 'wallow_golden_trowel'),
	(6, 'wallow_sovereign_crown')
ON CONFLICT (rank) DO UPDATE SET hat_id = EXCLUDED.hat_id;

ALTER FUNCTION public.season_state()
	RENAME TO _season_state_before_wallow_tuning;

CREATE OR REPLACE FUNCTION public.season_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	base jsonb := public._season_state_before_wallow_tuning();
	rank int := COALESCE((base->>'wallow_count')::int, 0);
BEGIN
	IF NOT COALESCE((base->>'active')::boolean, false) THEN RETURN base; END IF;
	RETURN base || jsonb_build_object(
		'wallow_power_level', LEAST(6, rank),
		'wallow_regen_percent', public._wallow_regen_percent(rank),
		'wallow_next_regen_percent', public._wallow_regen_percent(rank + 1),
		'wallow_regen_seconds', public._regen_secs_for_wallow(auth.uid(), rank),
		'wallow_next_regen_seconds', public._regen_secs_for_wallow(auth.uid(), rank + 1),
		'wallow_visit_hours', public._wallow_visit_hours(rank),
		'wallow_next_visit_hours', public._wallow_visit_hours(rank + 1)
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.season_state() TO authenticated, anon;

ALTER FUNCTION public.wallow()
	RENAME TO _wallow_before_tuning;

CREATE OR REPLACE FUNCTION public.wallow()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	result jsonb := public._wallow_before_tuning();
	earned_rank int;
	reward_id text;
BEGIN
	IF NOT COALESCE((result->>'ok')::boolean, false) THEN RETURN result; END IF;
	earned_rank := COALESCE((result->>'wallow_count')::int, 0);

	SELECT rewards.hat_id INTO reward_id
	FROM public.wallow_rank_rewards AS rewards
	WHERE rewards.rank = earned_rank;
	IF reward_id IS NOT NULL THEN
		INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (auth.uid(), reward_id) ON CONFLICT DO NOTHING;
	END IF;

	RETURN result || jsonb_build_object(
		'power_level', LEAST(6, earned_rank),
		'regen_percent', public._wallow_regen_percent(earned_rank),
		'regen_seconds', public._regen_secs_for_wallow(auth.uid(), earned_rank),
		'visit_hours', public._wallow_visit_hours(earned_rank),
		'cosmetic_hat_id', reward_id
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.wallow() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallow() TO authenticated;

-- Preserve the latest tickle_at_barn implementation (including forage + XP)
-- and place the prestige-scaled shared-budget gate in front of it.
ALTER FUNCTION public.tickle_at_barn(uuid)
	RENAME TO _tickle_at_barn_before_prestige_window;

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rank int := COALESCE((SELECT wallow_count FROM public.profiles WHERE id = caller_id), 0);
	window_hours numeric := public._wallow_visit_hours(rank);
	window_span interval := make_interval(secs => (window_hours * 3600)::int);
	recent int;
	oldest timestamptz;
	result jsonb;
BEGIN
	SELECT count(DISTINCT target_id), min(visit_started_at)
	INTO recent, oldest
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND visit_started_at > now() - window_span;

	IF COALESCE(recent, 0) >= 3
	   AND NOT EXISTS (
			SELECT 1 FROM public.barn_visits
			WHERE visitor_id = caller_id AND target_id = p_target
			  AND visit_started_at > now() - interval '24 hours'
	   ) THEN
		RETURN jsonb_build_object(
			'ok', false,
			'error', 'cooldown',
			'reason_detail', 'budget',
			'budget', 3,
			'visits_left', 0,
			'visit_window_hours', window_hours,
			'visits_refresh_at', oldest + window_span,
			'next_at', oldest + window_span
		);
	END IF;

	result := public._tickle_at_barn_before_prestige_window(p_target);
	SELECT count(DISTINCT target_id), min(visit_started_at)
	INTO recent, oldest
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND visit_started_at > now() - window_span;
	RETURN result || jsonb_build_object(
		'visits_left', GREATEST(0, 3 - COALESCE(recent, 0)),
		'visit_window_hours', window_hours,
		'visits_refresh_at', oldest + window_span
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

ALTER FUNCTION public.barn_visit_status(uuid)
	RENAME TO _barn_visit_status_before_prestige_window;

CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rank int := COALESCE((SELECT wallow_count FROM public.profiles WHERE id = caller_id), 0);
	window_hours numeric := public._wallow_visit_hours(rank);
	window_span interval := make_interval(secs => (window_hours * 3600)::int);
	recent int;
	oldest timestamptz;
	refresh_at timestamptz;
	base jsonb := public._barn_visit_status_before_prestige_window(p_target);
	base_next timestamptz;
BEGIN
	SELECT count(DISTINCT target_id), min(visit_started_at)
	INTO recent, oldest
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND visit_started_at > now() - window_span;
	refresh_at := CASE WHEN oldest IS NULL THEN NULL ELSE oldest + window_span END;
	base_next := NULLIF(base->>'next_at', '')::timestamptz;

	RETURN base || jsonb_build_object(
		'locked', COALESCE((base->>'locked')::boolean, false) OR COALESCE(recent, 0) >= 3,
		'next_at', CASE
			WHEN COALESCE((base->>'locked')::boolean, false)
				THEN GREATEST(base_next, refresh_at)
			WHEN COALESCE(recent, 0) >= 3 THEN refresh_at
			ELSE base_next
		END,
		'visits_left', GREATEST(0, 3 - COALESCE(recent, 0)),
		'visit_budget', 3,
		'visit_window_hours', window_hours,
		'visits_refresh_at', refresh_at
	);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;

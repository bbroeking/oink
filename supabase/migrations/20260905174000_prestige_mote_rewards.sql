-- Five additional earned Motes per prestige lap, starting at permanent Wallow
-- Rank 3. Existing players can claim reached tiers in their CURRENT lap.
-- Completed historical laps are not backfilled; the original five rewards stay.
-- The catalog's minimum rank is shared by reads, claims, sweeps and rollover.
-- Granting and spending serialize on profiles before user_season_progress.

ALTER TABLE public.wallow_tiers
  ADD COLUMN min_wallow_rank int NOT NULL DEFAULT 0 CHECK (min_wallow_rank >= 0);
ALTER TABLE public.wallow_tiers DROP CONSTRAINT wallow_tiers_reward_type_check;
ALTER TABLE public.wallow_tiers ADD CONSTRAINT wallow_tiers_reward_type_check
  CHECK (reward_type IN ('snouts', 'golden_truffle', 'mystery_box', 'motes'));
ALTER TABLE public.wallow_tiers ADD CONSTRAINT wallow_tiers_mote_amount_check
  CHECK (reward_type <> 'motes' OR (
    jsonb_typeof(reward_value->'amount') = 'number'
    AND (reward_value->>'amount')::numeric > 0
    AND (reward_value->>'amount')::numeric = trunc((reward_value->>'amount')::numeric)
    AND (reward_value->>'amount')::numeric <= 2147483647
  ) IS TRUE);

INSERT INTO public.wallow_tiers (tier, reward_type, reward_value, display_label, min_wallow_rank)
VALUES (3, 'motes', '{"amount":1}', '1 Mote', 3),
       (8, 'motes', '{"amount":1}', '1 Mote', 3),
       (13, 'motes', '{"amount":1}', '1 Mote', 3),
       (18, 'motes', '{"amount":1}', '1 Mote', 3),
       (23, 'motes', '{"amount":1}', '1 Mote', 3);

-- Internal, caller-derived catalog. The permanent rank cannot change during
-- a lap except through wallow(), which holds the same profile/progress locks.
CREATE FUNCTION public._eligible_wallow_tiers()
RETURNS SETOF public.wallow_tiers
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT wt.* FROM public.wallow_tiers wt
  WHERE wt.min_wallow_rank <= COALESCE(
    (SELECT p.wallow_count FROM public.profiles p WHERE p.id = auth.uid()), 0);
$function$;
REVOKE ALL ON FUNCTION public._eligible_wallow_tiers() FROM PUBLIC, anon, authenticated;

-- Carry the base reader from 20260769 under its CURRENT internal name. The
-- public season_state wrapper from 20260779 still owns the six-rank tuning.
-- Changes: eligible catalog, total-tier bound, and authoritative wallet balance.
CREATE OR REPLACE FUNCTION public._season_state_before_wallow_tuning()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season public.seasons;
	progress public.user_season_progress;
	current_tier int;
	caller_is_vip boolean := false;
	caller_wallow_count int := 0;
	cycle_xp int;
	visible_xp int;
BEGIN
	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('active', false);
	END IF;

	IF caller_id IS NOT NULL THEN
		SELECT * INTO progress
		FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
		SELECT COALESCE(is_vip, false), COALESCE(wallow_count, 0)
		INTO caller_is_vip, caller_wallow_count
		FROM public.profiles WHERE id = caller_id;
	END IF;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	visible_xp := GREATEST(
		0,
		COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp
	);
	current_tier := LEAST(
		season.total_tiers,
		GREATEST(1, visible_xp / season.xp_per_tier + 1)
	);
	IF visible_xp >= cycle_xp THEN
		current_tier := season.total_tiers;
	END IF;

	RETURN jsonb_build_object(
		'active', true,
		'season', to_jsonb(season),
		'tiers', (
			SELECT jsonb_agg(to_jsonb(t) ORDER BY t.tier, t.track)
			FROM public.season_tiers t
			WHERE t.season_id = season.id
		),
		-- xp is deliberately lap-local for the existing client progress bar.
		'xp', visible_xp,
		'lifetime_season_xp', COALESCE(progress.xp, 0),
		'current_tier', current_tier,
		'premium_unlocked', (COALESCE(progress.premium_unlocked, false) OR caller_is_vip),
		'premium_plus_unlocked', COALESCE(progress.premium_plus_unlocked, false),
		'wallow_count', caller_wallow_count,
		'motes', COALESCE((SELECT mote_balance FROM public.profiles WHERE id = caller_id), 0),
		'season_wallow_count', COALESCE(progress.wallow_count, 0),
		'can_wallow', visible_xp >= cycle_xp,
		'wallow_power_level', LEAST(2, caller_wallow_count),
		'wallow_regen_percent', LEAST(2, caller_wallow_count) * 25,
		'wallow_next_regen_percent', LEAST(2, caller_wallow_count + 1) * 25,
		'wallow_regen_seconds', public._regen_secs_for_wallow(caller_id, caller_wallow_count),
		'wallow_next_regen_seconds', public._regen_secs_for_wallow(caller_id, caller_wallow_count + 1),
		'wallow_tiers', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'tier', wt.tier,
				'track', 'free',
				'reward_type', wt.reward_type,
				'reward_value', wt.reward_value,
				'display_label', wt.display_label
			) ORDER BY wt.tier)
			FROM public._eligible_wallow_tiers() wt
			WHERE wt.tier <= season.total_tiers
		), '[]'::jsonb),
		'wallow_claims', COALESCE((
			SELECT jsonb_agg(jsonb_build_object('tier', c.tier, 'track', 'free'))
			FROM public.user_wallow_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.wallow_lap = COALESCE(progress.wallow_count, 0)
		), '[]'::jsonb),
		'claims', COALESCE((
			SELECT jsonb_agg(jsonb_build_object('tier', tier, 'track', track))
			FROM public.user_tier_claims
			WHERE user_id = caller_id AND season_id = season.id
		), '[]'::jsonb)
	);
END;
$function$;
REVOKE ALL ON FUNCTION public._season_state_before_wallow_tuning() FROM PUBLIC, anon, authenticated;

-- Carry the base rollover under its current internal name. Keep the rank hats
-- and tuning in the existing public wrapper. Only catalog and lock order change.
CREATE OR REPLACE FUNCTION public._wallow_before_tuning()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season public.seasons;
	progress public.user_season_progress;
	caller_is_vip boolean := false;
	cycle_xp int;
	visible_xp int;
	unclaimed int;
	new_count int;
	lifetime_count int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	-- Same lock order as Mote claims and the machine spend.
	PERFORM 1 FROM public.profiles WHERE id = caller_id FOR UPDATE;

	SELECT * INTO progress
	FROM public.user_season_progress
	WHERE user_id = caller_id AND season_id = season.id
	FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_ready');
	END IF;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	visible_xp := GREATEST(0, progress.xp - progress.wallow_count * cycle_xp);
	IF visible_xp < cycle_xp THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'not_ready',
			'xp_needed', cycle_xp - visible_xp
		);
	END IF;

	SELECT COALESCE(is_vip, false) INTO caller_is_vip
	FROM public.profiles WHERE id = caller_id;

	-- Do not roll a lap while one of its rewards is waiting. The first climb
	-- checks the original free/unlocked-premium pass; later climbs check only the
	-- eligible rewards belonging to that exact Wallow lap.
	IF progress.wallow_count = 0 THEN
		SELECT count(*) INTO unclaimed
		FROM public.season_tiers t
		WHERE t.season_id = season.id
		  AND (
			t.track = 'free'
			OR (
				t.track = 'premium'
				AND (progress.premium_unlocked OR caller_is_vip)
			)
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.tier = t.tier
			  AND c.track = t.track
		  );
	ELSE
		SELECT count(*) INTO unclaimed
		FROM public._eligible_wallow_tiers() wt
		WHERE wt.tier <= season.total_tiers
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_wallow_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.wallow_lap = progress.wallow_count
			  AND c.tier = wt.tier
		  );
	END IF;
	IF unclaimed > 0 THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'claim_rewards_first',
			'unclaimed', unclaimed
		);
	END IF;

	UPDATE public.user_season_progress
	SET wallow_count = wallow_count + 1
	WHERE user_id = caller_id AND season_id = season.id
	RETURNING wallow_count INTO new_count;

	UPDATE public.profiles
	SET wallow_count = wallow_count + 1
	WHERE id = caller_id
	RETURNING wallow_count INTO lifetime_count;

	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			caller_id,
			'wallow',
			'The mud remembers',
			'You wallowed, your tickle power grew, and the season climb began again.',
			jsonb_build_object(
				'wallow_count', lifetime_count,
				'season_wallow_count', new_count,
				'power_level', LEAST(2, lifetime_count),
				'regen_percent', LEAST(2, lifetime_count) * 25
			)
		);
	EXCEPTION WHEN OTHERS THEN NULL;
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'wallow_count', lifetime_count,
		'season_wallow_count', new_count,
		'power_level', LEAST(2, lifetime_count),
		'regen_percent', LEAST(2, lifetime_count) * 25,
		'regen_seconds', public._regen_secs_for_wallow(caller_id, lifetime_count),
		'xp', GREATEST(0, visible_xp - cycle_xp)
	);
END;
$function$;
REVOKE ALL ON FUNCTION public._wallow_before_tuning() FROM PUBLIC, anon, authenticated;

-- Preserve the current claimer, including 20260784's Golden Truffle overflow
-- recovery. Original rewards delegate to it; only Mote grants are new.
ALTER FUNCTION public.claim_wallow_tier(int) RENAME TO _claim_wallow_tier_before_motes;
REVOKE ALL ON FUNCTION public._claim_wallow_tier_before_motes(int) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.claim_wallow_tier(target_tier int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  season public.seasons;
  progress public.user_season_progress;
  reward public.wallow_tiers;
  current_tier int;
  amount int;
  balance int;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
  END IF;
  SELECT * INTO season FROM public.active_season();
  IF season.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
  END IF;
  PERFORM 1 FROM public.profiles WHERE id = caller_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_wallow');
  END IF;
  SELECT * INTO progress FROM public.user_season_progress
    WHERE user_id = caller_id AND season_id = season.id FOR UPDATE;
  IF NOT FOUND OR progress.wallow_count < 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_in_wallow');
  END IF;
  SELECT * INTO reward FROM public._eligible_wallow_tiers() WHERE tier = target_tier;
  IF NOT FOUND OR target_tier > season.total_tiers THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
  END IF;
  IF reward.reward_type <> 'motes' THEN
    RETURN public._claim_wallow_tier_before_motes(target_tier);
  END IF;
  current_tier := LEAST(season.total_tiers, GREATEST(1,
    GREATEST(0, progress.xp - progress.wallow_count *
      GREATEST(1, season.total_tiers * season.xp_per_tier)) / season.xp_per_tier + 1));
  IF current_tier < target_tier THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'tier_locked', 'current_tier', current_tier);
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_wallow_tier_claims c
    WHERE c.user_id = caller_id AND c.season_id = season.id
      AND c.wallow_lap = progress.wallow_count AND c.tier = target_tier) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;
  amount := (reward.reward_value->>'amount')::int;
  -- Wallet and claim receipt commit together or both roll back.
  INSERT INTO public.user_wallow_tier_claims (user_id, season_id, wallow_lap, tier)
    VALUES (caller_id, season.id, progress.wallow_count, target_tier);
  UPDATE public.profiles SET mote_balance = mote_balance + amount
    WHERE id = caller_id RETURNING mote_balance INTO balance;
  RETURN jsonb_build_object('ok', true, 'reward_type', 'motes',
    'reward_value', reward.reward_value, 'motes_granted', amount,
    'motes_balance', balance, 'wallow_lap', progress.wallow_count, 'tier', target_tier);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_wallow_tier(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_wallow_tier(int) TO authenticated;

-- Carry both routing functions from 20260773. Lock before resolving the lap so
-- a concurrent rollover cannot send a claim to a different reward path.
-- Optional expected context protects updated clients from a retry crossing a
-- season/lap boundary. Older JSON/SQL callers can omit these defaulted fields.
ALTER FUNCTION public.claim_season_tier(int, text) RENAME TO _claim_season_tier_before_mote_context;
REVOKE ALL ON FUNCTION public._claim_season_tier_before_mote_context(int, text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.claim_season_tier(target_tier int, target_track text DEFAULT NULL, expected_season_id text DEFAULT NULL, expected_wallow_lap int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	season         public.seasons;
	progress       public.user_season_progress;
	caller_is_vip  boolean := false;
	is_prestige    boolean := false;
	resolved_track text;
	cycle_xp       int;
	visible_xp     int;
	current_tier   int;
	result         jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	PERFORM 1 FROM public.profiles WHERE id = caller_id FOR UPDATE;
	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id FOR UPDATE;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;

	IF (expected_season_id IS NOT NULL AND expected_season_id <> season.id)
	   OR (expected_wallow_lap IS NOT NULL AND expected_wallow_lap <> COALESCE(progress.wallow_count, 0)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pass_changed');
	END IF;

	is_prestige := COALESCE(progress.wallow_count, 0) >= 1;

	-- current_tier — lap-local in prestige, absolute otherwise (mirrors season_state).
	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	IF is_prestige THEN
		visible_xp := GREATEST(0, COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp);
	ELSE
		visible_xp := COALESCE(progress.xp, 0);
	END IF;
	current_tier := LEAST(season.total_tiers, GREATEST(1, visible_xp / season.xp_per_tier + 1));
	IF visible_xp >= cycle_xp THEN current_tier := season.total_tiers; END IF;

	IF is_prestige THEN
		-- Wallow tiers are free-track only; the wallow-aware claimer ignores track.
		result := public.claim_wallow_tier(target_tier);
	ELSE
		resolved_track := COALESCE(
			target_track,
			CASE WHEN (COALESCE(progress.premium_unlocked, false) OR caller_is_vip)
				THEN 'premium' ELSE 'free' END
		);
		result := public.claim_tier_reward(target_tier, resolved_track);
	END IF;

	-- Superset: guarantee current_tier is present. `||` right side wins, but neither
	-- claimer sets current_tier on success and claim_wallow_tier's tier_locked value
	-- equals ours, so this only ever adds/echoes the same number.
	RETURN result || jsonb_build_object('current_tier', current_tier);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_season_tier(int, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_season_tier(int, text, text, int) TO authenticated;

-- Sweep the same eligible catalog; add a Mote tally and authoritative balance.
-- Optional expected context protects updated clients from a retry crossing a
-- season/lap boundary. Older JSON/SQL callers can omit these defaulted fields.
ALTER FUNCTION public.claim_ready_tiers(text) RENAME TO _claim_ready_tiers_before_mote_context;
REVOKE ALL ON FUNCTION public._claim_ready_tiers_before_mote_context(text) FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.claim_ready_tiers(target_track text DEFAULT NULL, expected_season_id text DEFAULT NULL, expected_wallow_lap int DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	season         public.seasons;
	progress       public.user_season_progress;
	caller_is_vip  boolean := false;
	is_prestige    boolean := false;
	resolved_track text;
	cycle_xp       int;
	visible_xp     int;
	current_tier   int;
	rec            record;
	claim_res      jsonb;
	claimed_count  int := 0;
	failed         int := 0;
	tickles        int := 0;
	motes          int := 0;
	items          jsonb := '[]'::jsonb;
	mysteries      jsonb := '[]'::jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	PERFORM 1 FROM public.profiles WHERE id = caller_id FOR UPDATE;
	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id FOR UPDATE;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;

	IF (expected_season_id IS NOT NULL AND expected_season_id <> season.id)
	   OR (expected_wallow_lap IS NOT NULL AND expected_wallow_lap <> COALESCE(progress.wallow_count, 0)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pass_changed');
	END IF;

	is_prestige := COALESCE(progress.wallow_count, 0) >= 1;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	IF is_prestige THEN
		visible_xp := GREATEST(0, COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp);
	ELSE
		visible_xp := COALESCE(progress.xp, 0);
	END IF;
	current_tier := LEAST(season.total_tiers, GREATEST(1, visible_xp / season.xp_per_tier + 1));
	IF visible_xp >= cycle_xp THEN current_tier := season.total_tiers; END IF;

	IF is_prestige THEN
		-- Wallow lap: free-track only, wallow_tiers catalog, current-lap claim ledger.
		resolved_track := 'free';
	ELSE
		resolved_track := COALESCE(
			target_track,
			CASE WHEN (COALESCE(progress.premium_unlocked, false) OR caller_is_vip)
				THEN 'premium' ELSE 'free' END
		);
		-- Premium-under-glass: a non-premium caller asking for premium gets nothing.
		IF resolved_track = 'premium'
		   AND NOT (COALESCE(progress.premium_unlocked, false) OR caller_is_vip) THEN
			RETURN jsonb_build_object(
				'ok', true, 'claimed_count', 0, 'failed', 0,
				'tickles', 0, 'items', '[]'::jsonb, 'mysteries', '[]'::jsonb
			);
		END IF;
	END IF;

	IF is_prestige THEN
		FOR rec IN
			SELECT wt.tier, lower(wt.reward_type) AS reward_type, wt.reward_value, wt.display_label
			FROM public._eligible_wallow_tiers() wt
			WHERE wt.tier <= season.total_tiers
			  AND wt.tier <= current_tier
			  AND NOT EXISTS (
				SELECT 1 FROM public.user_wallow_tier_claims c
				WHERE c.user_id = caller_id AND c.season_id = season.id
				  AND c.wallow_lap = progress.wallow_count AND c.tier = wt.tier
			  )
			ORDER BY wt.tier
		LOOP
			BEGIN
				claim_res := public.claim_wallow_tier(rec.tier);
			EXCEPTION WHEN OTHERS THEN
				claim_res := jsonb_build_object('ok', false, 'reason', 'error');
			END;

			IF COALESCE((claim_res->>'ok')::boolean, false) THEN
				claimed_count := claimed_count + 1;
				IF rec.reward_type = 'motes' THEN
					motes := motes + (claim_res->>'motes_granted')::int;
				ELSIF rec.reward_type = 'tickles' THEN
					tickles := tickles + COALESCE(
						(rec.reward_value->>'amount')::int, (rec.reward_value->>'count')::int, 0);
				ELSE
					items := items || to_jsonb(rec.display_label);
				END IF;
				IF (claim_res ? 'granted_hat_id') OR (claim_res ? 'fallback_snouts') THEN
					mysteries := mysteries || jsonb_build_array(claim_res);
				END IF;
			ELSE
				failed := failed + 1;
			END IF;
		END LOOP;
	ELSE
		FOR rec IN
			SELECT t.tier, lower(t.reward_type) AS reward_type, t.reward_value, t.display_label
			FROM public.season_tiers t
			WHERE t.season_id = season.id
			  AND t.track = resolved_track
			  AND t.tier <= current_tier
			  AND NOT EXISTS (
				SELECT 1 FROM public.user_tier_claims c
				WHERE c.user_id = caller_id AND c.season_id = season.id
				  AND c.tier = t.tier AND c.track = resolved_track
			  )
			ORDER BY t.tier
		LOOP
			BEGIN
				claim_res := public.claim_tier_reward(rec.tier, resolved_track);
			EXCEPTION WHEN OTHERS THEN
				claim_res := jsonb_build_object('ok', false, 'reason', 'error');
			END;

			IF COALESCE((claim_res->>'ok')::boolean, false) THEN
				claimed_count := claimed_count + 1;
				IF rec.reward_type = 'tickles' THEN
					tickles := tickles + COALESCE(
						(rec.reward_value->>'amount')::int, (rec.reward_value->>'count')::int, 0);
				ELSE
					items := items || to_jsonb(rec.display_label);
				END IF;
				IF (claim_res ? 'granted_hat_id') OR (claim_res ? 'fallback_snouts') THEN
					mysteries := mysteries || jsonb_build_array(claim_res);
				END IF;
			ELSE
				failed := failed + 1;
			END IF;
		END LOOP;
	END IF;

	-- Keep the legacy items list truthful, including on older clients.
	IF motes > 0 THEN
		items := jsonb_build_array(motes::text || CASE WHEN motes = 1 THEN ' Mote' ELSE ' Motes' END) || items;
	END IF;
	RETURN jsonb_build_object(
		'ok', true,
		'motes', motes,
		'motes_balance', (SELECT mote_balance FROM public.profiles WHERE id = caller_id),
		'claimed_count', claimed_count,
		'failed', failed,
		'tickles', tickles,
		'items', items,
		'mysteries', mysteries
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_ready_tiers(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ready_tiers(text, text, int) TO authenticated;

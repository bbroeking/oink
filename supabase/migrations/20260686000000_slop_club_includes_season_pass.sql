-- Slop Club INCLUDES the season pass. An active Slop Club member (is_vip —
-- whether paid sub OR referral-granted) gets the premium reward track unlocked
-- for the CURRENT season automatically, every season, with no separate grant.
-- The one-time Season Pass (grant_season_pass → user_season_progress
-- .premium_unlocked) still works independently for non-subscribers.
--
-- Computed at read/claim time (premium = stored premium_unlocked OR is_vip) so
-- there's no grant-timing gap: a subscriber who's mid-subscription when a new
-- season starts is premium immediately, and a referral-granted member is too.
--
-- Both functions carried VERBATIM from their latest defs (season_state
-- 20260502010000, claim_tier_reward 20260659) with only the is_vip addition.

CREATE OR REPLACE FUNCTION public.season_state()
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
BEGIN
  SELECT * INTO season FROM public.active_season();
  IF season.id IS NULL THEN
    RETURN jsonb_build_object('active', false);
  END IF;

  IF caller_id IS NOT NULL THEN
    SELECT * INTO progress
    FROM public.user_season_progress
    WHERE user_id = caller_id AND season_id = season.id;
    SELECT COALESCE(is_vip, false) INTO caller_is_vip
    FROM public.profiles WHERE id = caller_id;
  END IF;

  current_tier := LEAST(season.total_tiers, GREATEST(1, COALESCE(progress.xp, 0) / season.xp_per_tier + 1));
  -- if xp >= total_tiers * xp_per_tier, current_tier = total_tiers (capped)
  IF COALESCE(progress.xp, 0) >= season.total_tiers * season.xp_per_tier THEN
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
    'xp', COALESCE(progress.xp, 0),
    'current_tier', current_tier,
    -- Slop Club (is_vip) includes the season pass — premium is unlocked if the
    -- one-time pass was bought OR the player is a member.
    'premium_unlocked', (COALESCE(progress.premium_unlocked, false) OR caller_is_vip),
    'premium_plus_unlocked', COALESCE(progress.premium_plus_unlocked, false),
    'claims', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('tier', tier, 'track', track))
      FROM public.user_tier_claims
      WHERE user_id = caller_id AND season_id = season.id
    ), '[]'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.season_state() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.claim_tier_reward(target_tier int, target_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	season         public.seasons;
	progress       public.user_season_progress;
	reward         public.season_tiers;
	reward_type_lc text;
	reward_value   jsonb;
	current_tier   int;
	item_id        text;
	title_display  text;
	title_slug     text;
	extra_payload  jsonb := '{}'::jsonb;
	caller_is_vip  boolean := false;
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
	SELECT COALESCE(is_vip, false) INTO caller_is_vip
		FROM public.profiles WHERE id = caller_id;
	current_tier := LEAST(
		season.total_tiers,
		GREATEST(1, COALESCE(progress.xp, 0) / season.xp_per_tier + 1)
	);
	IF COALESCE(progress.xp, 0) >= season.total_tiers * season.xp_per_tier THEN
		current_tier := season.total_tiers;
	END IF;

	IF current_tier < target_tier THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'tier_not_reached');
	END IF;

	-- Slop Club members claim premium rewards without the one-time pass.
	IF target_track = 'premium'
	   AND NOT COALESCE(progress.premium_unlocked, false)
	   AND NOT caller_is_vip THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'premium_locked');
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.user_tier_claims
		WHERE user_id = caller_id AND season_id = season.id
		  AND tier = target_tier AND track = target_track
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	SELECT * INTO reward FROM public.season_tiers
		WHERE season_id = season.id
		  AND tier = target_tier
		  AND track = target_track;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
	END IF;

	reward_type_lc := lower(reward.reward_type);
	reward_value   := reward.reward_value;

	IF reward_type_lc = 'tickles' THEN
		UPDATE public.profiles
			SET tickles_earned = tickles_earned + (reward_value->>'amount')::int,
			    counter        = counter        + (reward_value->>'amount')::int
			WHERE id = caller_id;

	ELSIF reward_type_lc IN (
		'hat', 'background', 'aura', 'cape',
		'scarf', 'mask', 'necklace', 'glasses', 'bow', 'held'
	) THEN
		item_id := COALESCE(
			reward_value->>'hat_id',
			reward_value->>'bg_id',
			reward_value->>'aura_id',
			reward_value->>'cape_id',
			reward_value->>'item_id'
		);
		IF item_id IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_item_data');
		END IF;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (caller_id, item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

	ELSIF reward_type_lc = 'title' THEN
		title_display := reward_value->>'title';
		IF title_display IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_title_data');
		END IF;
		title_slug := public.title_id_from_name(title_display);
		IF EXISTS (SELECT 1 FROM public.titles WHERE id = title_slug) THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (caller_id, title_slug)
				ON CONFLICT (user_id, title_id) DO NOTHING;
		END IF;

	ELSIF reward_type_lc = 'mystery_box' THEN
		extra_payload := public.grant_mystery_box(
			caller_id, COALESCE(reward_value->>'box_kind', 'hat')
		);

	ELSE
		-- boost / pig_skin / cap_increase still stubbed.
		NULL;
	END IF;

	IF reward_value ? 'tickles' THEN
		UPDATE public.profiles
			SET tickles_earned = tickles_earned + (reward_value->>'tickles')::int,
			    counter        = counter        + (reward_value->>'tickles')::int
			WHERE id = caller_id;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object('ok', true, 'reward_type', reward_type_lc) || extra_payload;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

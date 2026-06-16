-- Fix: tier 30 (free) finale promised "Season 1 Veteran title + 500 tickles" but
-- only the title was granted — its reward_type is 'title', so claim_tier_reward
-- never paid the 500 tickles (those lived only in the display_label text).
--
-- season_tiers PK is (season_id, tier, track) → one reward row per tier+track, so
-- we can't add a second 'tickles' row. Instead: let ANY reward bundle a bonus
-- tickle payout via a 'tickles' key in reward_value, then add that key to tier 30.
--
-- claim_tier_reward is carried VERBATIM from the latest def (20260631 mystery box)
-- — the ONLY change is the new bonus-tickles block before the claim INSERT.

-- 1. claim_tier_reward — add the generic bonus-tickles grant.
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
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
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

	IF target_track = 'premium' AND NOT COALESCE(progress.premium_unlocked, false) THEN
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

	-- NEW: bonus tickles bundled onto ANY reward type (e.g. the tier-30 finale
	-- title also pays out 500 tickles). Separate from the 'tickles' reward_type
	-- (which keys off 'amount') so a title/item reward can carry a tickle payout
	-- in the same row.
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

-- 2. Bundle the 500 tickles onto tier 30 (free) so claims now pay them out.
UPDATE public.season_tiers
	SET reward_value = reward_value || '{"tickles": 500}'::jsonb,
	    display_label = 'Title: Season 1 Veteran + 500 tickles'
	WHERE season_id = 'snout_season_1' AND tier = 30 AND track = 'free';

-- 3. Back-fill: anyone who already claimed tier 30 (free) before this fix got the
-- title but never the 500 tickles. Pay them now (runs once, on this migration).
UPDATE public.profiles p
	SET tickles_earned = tickles_earned + 500,
	    counter        = counter        + 500
	WHERE EXISTS (
		SELECT 1 FROM public.user_tier_claims c
		WHERE c.user_id = p.id
		  AND c.season_id = 'snout_season_1'
		  AND c.tier = 30 AND c.track = 'free'
	);

-- Season-pass tickle rewards are applied immediately; they are not spendable
-- tickles added to user_items.item_count. A claimed tickle represents the same
-- result as a successful home tickle: +1 season tickle and +1 snout, without
-- consuming or refilling the player's tickle bank.
--
-- Carry-latest-def: claim_tier_reward from
-- 20260686000000_slop_club_includes_season_pass.sql. The only behavioral
-- change is to collect every tickle amount into applied_tickles, apply it once
-- directly to profiles, and report tickles_applied in the response. Both the
-- dedicated `tickles` reward type and a bundled reward_value.tickles bonus use
-- this path. No grant_tickles()/user_items write is permitted here.

CREATE OR REPLACE FUNCTION public.claim_tier_reward(target_tier int, target_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id       uuid := auth.uid();
	season          public.seasons;
	progress        public.user_season_progress;
	reward          public.season_tiers;
	reward_type_lc  text;
	reward_value    jsonb;
	current_tier    int;
	item_id         text;
	title_display   text;
	title_slug      text;
	extra_payload   jsonb := '{}'::jsonb;
	caller_is_vip   boolean := false;
	applied_tickles int := 0;
	reward_tickles  int;
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
		reward_tickles := COALESCE((reward_value->>'amount')::int, 0);
		IF reward_tickles <= 0 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tickle_data');
		END IF;
		applied_tickles := applied_tickles + reward_tickles;
	END IF;

	IF reward_value ? 'tickles' THEN
		reward_tickles := COALESCE((reward_value->>'tickles')::int, 0);
		IF reward_tickles <= 0 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tickle_data');
		END IF;
		applied_tickles := applied_tickles + reward_tickles;
	END IF;

	IF reward_type_lc IN (
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

	-- Auto-apply: deliberately bypass the spendable tickle bank. Updating
	-- tickles_earned also preserves the existing leaderboard, achievement, and
	-- referral triggers attached to applied tickles.
	IF applied_tickles > 0 THEN
		UPDATE public.profiles
		SET tickles_earned = tickles_earned + applied_tickles,
		    counter = counter + applied_tickles
		WHERE id = caller_id;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object(
		'ok', true,
		'reward_type', reward_type_lc,
		'tickles_applied', applied_tickles
	) || extra_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_tier_reward(int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

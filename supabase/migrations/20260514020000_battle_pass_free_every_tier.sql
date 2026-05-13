-- Beef up the free battle pass track and fix the broken claim function.
--
-- Two problems addressed:
--   1. The free track only had rewards at 15/30 tiers. Empty tiers
--      meant most levels weren't worth claiming. Now every tier (1-30)
--      has a free reward from the backlog of unused backgrounds, auras,
--      and capes (plus tickle bundles).
--   2. The claim_tier_reward function from migration 20260511 references
--      a nonexistent `season_rewards` table and a missing
--      `progress.current_tier` field — every claim would 404 silently.
--      This migration rewrites it against the real schema.
--
-- Reward-type taxonomy: any item that lives in `public.hats` (regardless
-- of category) goes through ONE grant path (insert into user_hats). We
-- still surface the category in `reward_type` so the UI can show the
-- right icon/label, but the actual fulfillment is identical for hats,
-- backgrounds, auras, capes, scarves, masks, necklaces, etc.

-- ── 1. Rewrite claim_tier_reward against the actual schema ─────────
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
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	-- Compute current_tier from xp (mirrors season_state). The
	-- user_season_progress table doesn't store current_tier directly.
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

	-- All items that live in the hats table share one grant path,
	-- regardless of category. Legacy seeds used different key names
	-- (bg_id, aura_id, cape_id); fall back across all of them.
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

	ELSE
		-- boost / pig_skin / cap_increase / mystery_box still stubbed.
		-- Claim is still recorded so the UI marks it done; awarding
		-- happens (or doesn't) elsewhere.
		NULL;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object('ok', true, 'reward_type', reward_type_lc);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;


-- ── 2. Normalize legacy bg_id seeds to use hat_id keys ─────────────
-- Backgrounds in the original seed used reward_value {"bg_id": "..."};
-- the new unified grant path looks for hat_id (or any other variant).
-- Update in place so existing claims don't silently NULL.
UPDATE public.season_tiers
SET reward_value = jsonb_build_object('hat_id', reward_value->>'bg_id')
WHERE season_id = 'snout_season_1'
  AND reward_type = 'background'
  AND reward_value ? 'bg_id'
  AND NOT (reward_value ? 'hat_id');


-- ── 3. Add free rewards at every empty tier ────────────────────────
-- Existing free tiers: 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 22, 24, 26, 28, 30
-- Filling the gaps: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 23, 25, 27, 29
-- Mix of backgrounds + auras + capes from the unused content backlog,
-- plus a couple tickle bundles for variety.
INSERT INTO public.season_tiers
	(season_id, tier, track, reward_type, reward_value, display_label)
VALUES
	('snout_season_1',  2, 'free', 'aura',       '{"hat_id": "pink_glow"}',      'Pink Glow aura'),
	('snout_season_1',  4, 'free', 'background', '{"hat_id": "forest_grove"}',   'Forest Grove background'),
	('snout_season_1',  6, 'free', 'aura',       '{"hat_id": "sparkle_aura"}',   'Sparkle aura'),
	('snout_season_1',  8, 'free', 'tickles',    '{"amount": 100}',              '100 tickles'),
	('snout_season_1', 10, 'free', 'cape',       '{"hat_id": "silk_cape"}',      'Silk cape'),
	('snout_season_1', 12, 'free', 'background', '{"hat_id": "jungle"}',         'Jungle background'),
	('snout_season_1', 14, 'free', 'aura',       '{"hat_id": "rainbow_aura"}',   'Rainbow aura'),
	('snout_season_1', 16, 'free', 'tickles',    '{"amount": 200}',              '200 tickles'),
	('snout_season_1', 18, 'free', 'background', '{"hat_id": "underwater"}',     'Coral Reef background'),
	('snout_season_1', 20, 'free', 'cape',       '{"hat_id": "royal_cape"}',     'Royal cape'),
	('snout_season_1', 21, 'free', 'aura',       '{"hat_id": "gold_aura"}',      'Gold aura'),
	('snout_season_1', 23, 'free', 'background', '{"hat_id": "desert_dunes"}',   'Desert Dunes background'),
	('snout_season_1', 25, 'free', 'aura',       '{"hat_id": "holy_aura"}',      'Holy aura'),
	('snout_season_1', 27, 'free', 'cape',       '{"hat_id": "hero_cape"}',      'Hero cape'),
	('snout_season_1', 29, 'free', 'background', '{"hat_id": "mountain_top"}',   'Mountain Top background')
ON CONFLICT (season_id, tier, track) DO NOTHING;

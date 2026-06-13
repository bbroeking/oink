-- Mystery Hat Box — implement the tier-15 'mystery_box' reward (tracker #6).
--
-- The snout_season_1 seed put a 'mystery_box' {"box_kind": "hat"} reward on
-- tier 15 (both tracks), but claim_tier_reward's ELSE stub (20260514020000)
-- only RECORDED the claim — nothing was ever granted. Players who claimed
-- tier 15 got a "claimed" checkmark and an empty box.
--
-- Three parts:
--   1. grant_mystery_box(target_user, box_kind) — internal helper that grants
--      ONE random hat the user doesn't own, rarity-weighted
--      60/25/10/4/1 (common/uncommon/rare/epic/legendary). Only
--      category-appropriate wearables are eligible (box_kind 'hat' → category
--      'hat'); cost=0 season-pass exclusives (20260544) and denylisted/hidden
--      categories (scarf/cape/necklace per HIDDEN_CATEGORIES, flag per the
--      World Cup shop) are excluded. If the user already owns every eligible
--      hat, the box pays +150 snouts instead (counter arithmetic).
--   2. claim_tier_reward — latest def (20260514020000) carried verbatim,
--      with the mystery_box branch wired to the helper. The success payload
--      ADDITIVELY gains granted_hat_id/_name/_emoji/_rarity (or
--      fallback_snouts); the existing {ok, reward_type} shape is preserved.
--   3. Retro-grant: every user with an existing tier-15 claim on
--      snout_season_1 (either track, deduped per user) gets the same weighted
--      grant NOW, plus an INLINE system_announcements row naming the hat (or
--      the snout fallback) so the reveal lands in their WhileAway feed.
--      INLINE because send_system_announcement is admin-gated (admin_only →
--      whole-transaction rollback for non-admins — the 20260618/20260619
--      footgun); migrations and SECURITY DEFINER RPCs write the row directly.

-- ── 1. grant_mystery_box — weighted random unowned-hat grant ────────
-- Internal-only: called by claim_tier_reward (SECURITY DEFINER) and by this
-- migration's retro-grant block. Not callable from the client (revoked below).
--
-- Weighted pick: each eligible hat gets weight = bucket_weight / bucket_size
-- (bucket = rarity), then one Efraimidis–Spirakis key sort
-- (-ln(1-random()) / weight) picks the winner. That lands in a rarity bucket
-- with probability proportional to 60/25/10/4/1 — renormalized across the
-- buckets that still HAVE unowned hats — and uniform within the bucket.
-- 1-random() (not random()) because ln(0) raises in Postgres and random()'s
-- range is [0,1).
CREATE OR REPLACE FUNCTION public.grant_mystery_box(target_user uuid, box_kind text DEFAULT 'hat')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_hat_id     text;
	v_hat_name   text;
	v_hat_emoji  text;
	v_hat_rarity text;
BEGIN
	SELECT e.id, e.name, e.emoji, e.rarity
		INTO v_hat_id, v_hat_name, v_hat_emoji, v_hat_rarity
	FROM (
		SELECT h.id, h.name, h.emoji, h.rarity,
			(CASE h.rarity
				WHEN 'common'    THEN 60.0
				WHEN 'uncommon'  THEN 25.0
				WHEN 'rare'      THEN 10.0
				WHEN 'epic'      THEN  4.0
				WHEN 'legendary' THEN  1.0
				ELSE 0.0
			END) / COUNT(*) OVER (PARTITION BY h.rarity) AS pick_weight
		FROM public.hats h
		WHERE h.category = box_kind
		  -- Defensive denylist: scarf/cape/necklace are client-hidden
		  -- (HIDDEN_CATEGORIES), flag is World Cup shop only. A no-op while
		  -- box_kind = 'hat', load-bearing if a future box names a category.
		  AND h.category NOT IN ('scarf', 'cape', 'necklace', 'flag')
		  -- cost = 0 marks season-pass exclusives (20260544) — a mystery box
		  -- must not hand out another tier's reward.
		  AND h.cost > 0
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_hats uh
			WHERE uh.user_id = target_user AND uh.hat_id = h.id
		  )
	) e
	WHERE e.pick_weight > 0
	ORDER BY -ln(1.0 - random()) / e.pick_weight
	LIMIT 1;

	-- Owns every eligible hat → the box pays snouts instead.
	IF v_hat_id IS NULL THEN
		UPDATE public.profiles SET counter = counter + 150
			WHERE id = target_user;
		RETURN jsonb_build_object('fallback_snouts', 150);
	END IF;

	INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (target_user, v_hat_id)
		ON CONFLICT (user_id, hat_id) DO NOTHING;

	RETURN jsonb_build_object(
		'granted_hat_id',     v_hat_id,
		'granted_hat_name',   v_hat_name,
		'granted_hat_emoji',  v_hat_emoji,
		'granted_hat_rarity', v_hat_rarity
	);
END;
$function$;

-- Internal helper — not a client RPC. SECURITY DEFINER functions get EXECUTE
-- for PUBLIC by default (the 20260538 lesson), so revoke all three surfaces.
REVOKE EXECUTE ON FUNCTION public.grant_mystery_box(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_mystery_box(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.grant_mystery_box(uuid, text) FROM authenticated;

-- ── 2. claim_tier_reward — wire the mystery_box branch ─────────────
-- Latest def (20260514020000_battle_pass_free_every_tier.sql) carried
-- verbatim apart from: the mystery_box ELSIF, the extra_payload declaration,
-- and `|| extra_payload` on the success return (empty object for every other
-- reward type, so the existing shape is unchanged).
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

	-- Mystery box: one weighted-random unowned wearable of the box's
	-- category (box_kind 'hat' → category 'hat'), or +150 snouts when the
	-- caller owns everything eligible. The grant result rides the success
	-- payload so the client can stage the big reveal.
	ELSIF reward_type_lc = 'mystery_box' THEN
		extra_payload := public.grant_mystery_box(
			caller_id, COALESCE(reward_value->>'box_kind', 'hat')
		);

	ELSE
		-- boost / pig_skin / cap_increase still stubbed.
		-- Claim is still recorded so the UI marks it done; awarding
		-- happens (or doesn't) elsewhere.
		NULL;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object('ok', true, 'reward_type', reward_type_lc) || extra_payload;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

-- ── 3. Retro-grant for the stub-era tier-15 claims ──────────────────
-- Everyone who already "claimed" the Mystery Hat Box got nothing. Open the
-- box for them now — one grant per user even when both tracks were claimed
-- (DISTINCT user_id) — and tell them via an inline system_announcements row
-- (kind 'mystery_box_opened') that surfaces in the WhileAway feed.
DO $$
DECLARE
	claimer    record;
	grant_res  jsonb;
	body_text  text;
	n_granted  int := 0;
BEGIN
	FOR claimer IN
		SELECT DISTINCT utc.user_id
		FROM public.user_tier_claims utc
		WHERE utc.season_id = 'snout_season_1'
		  AND utc.tier = 15
		  -- Re-run guard: the announcement row doubles as the "this user's
		  -- box was already opened" marker, so reapplying the migration
		  -- (db reset repair, manual replay) can't grant twice.
		  AND NOT EXISTS (
			SELECT 1 FROM public.system_announcements sa
			WHERE sa.user_id = utc.user_id
			  AND sa.kind = 'mystery_box_opened'
		  )
	LOOP
		grant_res := public.grant_mystery_box(claimer.user_id, 'hat');
		IF grant_res ? 'granted_hat_id' THEN
			body_text := format(
				'Inside: %s (%s). It''s yours — wear it in the Closet.',
				grant_res->>'granted_hat_name',
				grant_res->>'granted_hat_rarity'
			);
		ELSE
			body_text :=
				'You already owned every hat it could hold, so 150 snouts spilled out instead.';
		END IF;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				claimer.user_id,
				'mystery_box_opened',
				'Your Mystery Hat Box creaked open…',
				body_text,
				grant_res || jsonb_build_object('season_id', 'snout_season_1', 'tier', 15)
			);
		n_granted := n_granted + 1;
	END LOOP;
	RAISE NOTICE 'mystery_hat_box retro-grant: opened % boxes', n_granted;
END $$;

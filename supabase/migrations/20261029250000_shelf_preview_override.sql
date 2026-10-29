-- Shelf preview: one account sees a dark Pop-up Stall as open, and can buy
-- from it, for the founder's testing (feature_overrides.shelf_preview).
--
-- The rule: when the caller's profiles.feature_overrides->>'shelf_preview'
-- names a seasonal_shelves key, and that shelf has NEVER OPENED (the DARK
-- rule of 20261029220000: opens_at NULL, or closes_at NULL, or opens_at still
-- in the future), the shelf is OPEN for that caller only:
--   * seasonal_shelf() returns it (ahead of any really open shelf) with
--     status 'open', a synthetic window
--       opens_at  = now() - 1 day
--       closes_at = the real closes_at when set and in the future,
--                   else now() + 14 days
--     and an additive `preview: true` key (old clients ignore it);
--   * buy_hat() sells that shelf's 'new' pieces to that caller.
-- Once the shelf really opens, the override retires itself (the
-- season_preview precedent, 20261029190000): the caller sees the real window,
-- then the real boarded tail, and buys nothing new after the real close.
-- Every other caller: identical behavior and an identical payload (no
-- `preview` key at all).
--
-- daily_shop() and grant_mystery_box() are NOT touched: a previewed piece
-- never enters the daily drop (nor a Trough) or a mystery box. The
-- seasonal_shelves RLS policy is not touched either (clients never read the
-- table directly; seasonal_shelf() is SECURITY DEFINER).
--
-- What this migration does:
--   1. seasonal_shelf(): CARRIED VERBATIM from
--      20261029220000_seasonal_shelves.sql (its only def; nothing after it
--      redefines it). Delta: the preview branch before the open / boarded
--      selection, the synthetic window, and `preview: true` on that payload.
--   2. buy_hat(text): CARRIED VERBATIM from
--      20261029220000_seasonal_shelves.sql (the alphabetically-latest def;
--      20261029230000 / 20261029240000 do not redefine it). Delta: the
--      not_in_window refusal also skips a 'new' piece of the shelf the caller
--      previews (same never-opened test as seasonal_shelf()).
--   3. Sets shelf_preview = 'halloween_2026' for the founder only, merged into
--      the existing overrides (world_boss and season_preview stay).
--   No signature or return-type change; grants re-issued exactly as before.
--
-- To end the preview early:
--   UPDATE public.profiles SET feature_overrides = feature_overrides - 'shelf_preview'
--   WHERE username = 'Brian' AND discriminator = '4075' AND is_test = true;
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).

SET LOCAL lock_timeout = '5s';

-- 1. seasonal_shelf(): carried VERBATIM from 20261029220000_seasonal_shelves.sql
--    + the caller's previewed shelf shows as open, to that caller only.
CREATE OR REPLACE FUNCTION public.seasonal_shelf()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();   -- NULL (no auth) -> every owned flag false
	v_shelf public.seasonal_shelves%ROWTYPE;
	v_status text;
	v_items jsonb;
	v_item_count integer;
	v_owned_count integer;
	v_preview boolean := false;
	v_result jsonb;
BEGIN
	-- Preview (feature_overrides.shelf_preview): a shelf that has never opened
	-- shows as open to this caller only, on a synthetic window. A shelf that
	-- has opened for real falls through to the rule everyone gets.
	IF caller_id IS NOT NULL THEN
		SELECT s.* INTO v_shelf
		FROM public.profiles p
		JOIN public.seasonal_shelves s ON s.key = p.feature_overrides ->> 'shelf_preview'
		WHERE p.id = caller_id
			AND NOT (s.opens_at IS NOT NULL AND s.closes_at IS NOT NULL AND s.opens_at <= now());
		IF FOUND THEN
			v_preview := true;
			v_status := 'open';
			v_shelf.opens_at := now() - interval '1 day';
			v_shelf.closes_at := CASE
				WHEN v_shelf.closes_at > now() THEN v_shelf.closes_at
				ELSE now() + interval '14 days'
			END;
		END IF;
	END IF;

	IF NOT v_preview THEN
		-- An open shelf first; the latest opens_at wins.
		SELECT s.* INTO v_shelf
		FROM public.seasonal_shelves s
		WHERE s.opens_at IS NOT NULL
			AND s.closes_at IS NOT NULL
			AND s.opens_at <= now()
			AND now() < s.closes_at
		ORDER BY s.opens_at DESC, s.key
		LIMIT 1;
		IF FOUND THEN
			v_status := 'open';
		ELSE
			-- Else the most recently closed shelf still inside its 3-day boarded tail.
			SELECT s.* INTO v_shelf
			FROM public.seasonal_shelves s
			WHERE s.opens_at IS NOT NULL
				AND s.closes_at IS NOT NULL
				AND s.closes_at <= now()
				AND now() < s.closes_at + interval '3 days'
			ORDER BY s.closes_at DESC, s.key
			LIMIT 1;
			IF NOT FOUND THEN
				RETURN NULL;
			END IF;
			v_status := 'boarded';
		END IF;
	END IF;

	SELECT
		COALESCE(
			jsonb_agg(
				jsonb_build_object(
					'id', i.id,
					'name', i.name,
					'cost', i.cost,
					'rarity', i.rarity,
					'category', i.category,
					'emoji', i.emoji,
					'image_path', i.image_path,
					'description', i.description,
					'display_order', i.display_order,
					'pass_exclusive', i.pass_exclusive,
					'members_only', i.members_only,
					'shelf_lane', i.shelf_lane,
					'owned', i.owned
				)
				ORDER BY i.lane_rank, i.display_order, i.id
			),
			'[]'::jsonb
		),
		count(*),
		count(*) FILTER (WHERE i.owned)
	INTO v_items, v_item_count, v_owned_count
	FROM (
		SELECT
			h.*,
			CASE WHEN h.shelf_lane = 'new' THEN 0 ELSE 1 END AS lane_rank,
			EXISTS (
				SELECT 1 FROM public.user_hats uh
				WHERE uh.user_id = caller_id AND uh.hat_id = h.id
			) AS owned
		FROM public.hats h
		WHERE h.shelf_key = v_shelf.key
	) i;

	v_result := jsonb_build_object(
		'key', v_shelf.key,
		'title', v_shelf.title,
		'kicker', v_shelf.kicker,
		'opens_at', v_shelf.opens_at,
		'closes_at', v_shelf.closes_at,
		'status', v_status,
		'backdrop_hat_id', v_shelf.backdrop_hat_id,
		'theme', v_shelf.theme,
		'now', now(),
		'item_count', v_item_count,
		'owned_count', v_owned_count,
		'items', v_items
	);
	-- Additive, preview payload only: everyone else's payload has no such key.
	IF v_preview THEN
		v_result := v_result || jsonb_build_object('preview', true);
	END IF;
	RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.seasonal_shelf() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seasonal_shelf() TO authenticated;

-- 2. buy_hat(): carried VERBATIM from 20261029220000_seasonal_shelves.sql
--    + the caller's previewed shelf sells its 'new' pieces to that caller.
CREATE OR REPLACE FUNCTION public.buy_hat(target_hat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	hat_cost integer;
	hat_pass_only boolean;
	hat_members_only boolean;
	hat_shelf_lane text;
	hat_shelf_key text;
	caller_is_member boolean;
	current_counter bigint;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT cost, pass_exclusive, members_only, shelf_lane, shelf_key
		INTO hat_cost, hat_pass_only, hat_members_only, hat_shelf_lane, hat_shelf_key
	FROM public.hats WHERE id = target_hat_id;
	IF hat_cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_hat');
	END IF;
	-- Battle-pass exclusives are earn-only (claim_tier_reward), regardless of
	-- price. Checked BEFORE the cost guard so the reason is specific.
	IF hat_pass_only THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pass_exclusive');
	END IF;
	-- Seasonal debuts ('new' lane) sell only while their shelf is open; a
	-- missing / dark / boarded / closed shelf refuses. 'returning' and untagged
	-- items fall through unchanged. Exception: the shelf this caller previews
	-- (feature_overrides.shelf_preview) while it has never opened, the same
	-- test seasonal_shelf() uses to show it as open.
	IF hat_shelf_lane = 'new' AND NOT public.seasonal_shelf_is_open(hat_shelf_key)
		AND NOT EXISTS (
			SELECT 1
			FROM public.profiles p
			JOIN public.seasonal_shelves s ON s.key = p.feature_overrides ->> 'shelf_preview'
			WHERE p.id = caller_id
				AND s.key = hat_shelf_key
				AND NOT (s.opens_at IS NOT NULL AND s.closes_at IS NOT NULL AND s.opens_at <= now())
		)
	THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_window');
	END IF;
	-- Members-only cosmetics: buyable only by Slop Club members (is_vip).
	IF hat_members_only THEN
		SELECT COALESCE(is_vip, false) INTO caller_is_member
		FROM public.profiles WHERE id = caller_id;
		IF NOT caller_is_member THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'members_only');
		END IF;
	END IF;
	-- Other not-for-sale items (war spoils, referral grants) carry cost = 0.
	IF hat_cost <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_for_sale');
	END IF;

	IF EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = caller_id AND hat_id = target_hat_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
	END IF;

	SELECT counter INTO current_counter FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF current_counter IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
	END IF;
	IF current_counter < hat_cost THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient',
			'have', current_counter, 'need', hat_cost
		);
	END IF;

	UPDATE public.profiles SET counter = counter - hat_cost WHERE id = caller_id;
	INSERT INTO public.user_hats (user_id, hat_id) VALUES (caller_id, target_hat_id);

	RETURN jsonb_build_object('ok', true, 'remaining', current_counter - hat_cost);
END;
$function$;
GRANT EXECUTE ON FUNCTION public.buy_hat(text) TO authenticated;

-- 3. The founder previews the Halloween 2026 stall (world_boss and
--    season_preview stay: jsonb || merges keys).
UPDATE public.profiles
	SET feature_overrides = COALESCE(feature_overrides, '{}'::jsonb)
		|| '{"shelf_preview": "halloween_2026"}'::jsonb
	-- One account, never a namesake: (username, discriminator) is the unique key
	-- (20260520000000); the 20260604000000 / 20261029190000 precedent.
	WHERE username = 'Brian' AND discriminator = '4075' AND is_test = true;

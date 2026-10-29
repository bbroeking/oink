-- Seasonal shelves: a dated, themed shelf in the shop (server half).
--
-- A seasonal shelf is a catalog of items tagged onto public.hats by shelf_key,
-- each in one of two lanes:
--   * 'new'       : debuts with the shelf; sold ONLY while the shelf is open,
--                   never rolls into the random daily drop (nor a Trough,
--                   which open_item_drive gates on daily_shop()), and never
--                   comes out of a mystery box.
--   * 'returning' : an older item the shelf features; still sold and still
--                   eligible for the daily drop exactly as before.
-- Untagged items (shelf_key / shelf_lane NULL) behave exactly as before.
--
-- Window rule (seasonal_shelf_is_open):
--   OPEN     : opens_at IS NOT NULL AND closes_at IS NOT NULL
--              AND opens_at <= now() AND now() < closes_at
--   BOARDED  : opens_at IS NOT NULL AND closes_at <= now()
--              AND now() < closes_at + 3 days (shown, nothing new for sale)
--   DARK     : opens_at NULL (or closes_at NULL), or not yet opened.
--
-- What this migration does:
--   1. public.seasonal_shelves (key, title, kicker, opens_at, closes_at,
--      backdrop_hat_id, theme, created_at). Read-only to clients like the hats
--      catalog (20260501210000_hats_shop.sql), except the SELECT policy hides
--      dark / not-yet-open shelves.
--   2. hats.shelf_key (FK -> seasonal_shelves.key) + hats.shelf_lane
--      ('new' | 'returning'), plus a partial index on shelf_key.
--   3. public.seasonal_shelf_is_open(text) helper (the OPEN rule above).
--   4. public.seasonal_shelf() RPC: the one shelf to show (open first, latest
--      opens_at wins; else the most recently closed boarded shelf; else NULL)
--      with its items, lanes and the caller's owned flags.
--   5. daily_shop(): CARRIED VERBATIM from
--      20261029170000_halloween_weekend_shelf.sql (the alphabetically-latest
--      def, Halloween weekend CASE ordering intact). ONLY change: the WHERE
--      gains `AND h.shelf_lane IS DISTINCT FROM 'new'`.
--   6. buy_hat(text): CARRIED VERBATIM from
--      20260688000000_members_only_cosmetics.sql (the alphabetically-latest
--      def). ONLY change: it also reads shelf_lane + shelf_key, and a 'new'
--      lane item whose shelf is not OPEN (shelf_key NULL / shelf missing /
--      dark / boarded / closed) returns {ok:false, reason:'not_in_window'};
--      checked right after pass_exclusive, before members_only.
--   7. grant_mystery_box(uuid, text): CARRIED VERBATIM from
--      20260631000000_mystery_hat_box.sql (its only def; season-pass claims
--      call it). ONLY change: the candidate set gains
--      `AND h.shelf_lane IS DISTINCT FROM 'new'`, so a box never hands out a
--      seasonal debut. Same signature, same revokes (internal helper).
--   No existing function signature changes (old binaries keep working; an old
--   binary shows 'not_in_window' through its generic "Couldn't buy" toast).
--
-- Contract: 20261029230000_halloween_2026_catalog.sql inserts the
-- seasonal_shelves row and tags hats rows against exactly these names.
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).

-- 1. The shelf table ---------------------------------------------------------
CREATE TABLE public.seasonal_shelves (
	key             text PRIMARY KEY,
	title           text NOT NULL,
	kicker          text,
	opens_at        timestamptz,
	closes_at       timestamptz,
	backdrop_hat_id text REFERENCES public.hats(id),
	theme           jsonb NOT NULL DEFAULT '{}'::jsonb,
	created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seasonal_shelves ENABLE ROW LEVEL SECURITY;
-- Dark (NULL opens_at) and not-yet-open shelves stay invisible to clients.
CREATE POLICY "Seasonal shelves public once opened" ON public.seasonal_shelves
	FOR SELECT USING (opens_at IS NOT NULL AND opens_at <= now());
GRANT SELECT ON public.seasonal_shelves TO authenticated, anon;

-- 2. Tag items onto a shelf ---------------------------------------------------
ALTER TABLE public.hats ADD COLUMN shelf_key text REFERENCES public.seasonal_shelves(key);
ALTER TABLE public.hats ADD COLUMN shelf_lane text CHECK (shelf_lane IN ('new', 'returning'));
CREATE INDEX hats_shelf_key_idx ON public.hats (shelf_key) WHERE shelf_key IS NOT NULL;

-- 3. The OPEN rule, one place --------------------------------------------------
CREATE OR REPLACE FUNCTION public.seasonal_shelf_is_open(p_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
	SELECT EXISTS (
		SELECT 1
		FROM public.seasonal_shelves s
		WHERE s.key = p_key
			AND s.opens_at IS NOT NULL
			AND s.closes_at IS NOT NULL
			AND s.opens_at <= now()
			AND now() < s.closes_at
	);
$function$;
REVOKE ALL ON FUNCTION public.seasonal_shelf_is_open(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seasonal_shelf_is_open(text) TO authenticated;

-- 4. seasonal_shelf(): the one shelf to show, with its items -------------------
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
BEGIN
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

	RETURN jsonb_build_object(
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
END;
$function$;
REVOKE ALL ON FUNCTION public.seasonal_shelf() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seasonal_shelf() TO authenticated;

-- 5. daily_shop(): carried VERBATIM from 20261029170000_halloween_weekend_shelf.sql
--    + 'new' lane items never roll into the drop (they live on their shelf).
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT h.*
	FROM public.hats h
	WHERE h.category NOT IN ('cape', 'flag', 'scarf', 'necklace')
		AND h.cost > 0
		AND NOT h.pass_exclusive   -- battle-pass rewards are earned, never sold
		AND NOT h.members_only      -- members items live in the Members section
		AND h.shelf_lane IS DISTINCT FROM 'new'   -- seasonal debuts live on their shelf
	ORDER BY
		-- Halloween weekend shelf: these four lead the drop, 10-30 .. 11-02 UTC.
		CASE
			WHEN current_date BETWEEN DATE '2026-10-30' AND DATE '2026-11-02'
				AND h.id IN ('skull_mask', 'pumpkin_patch', 'firefly_lantern', 'candyland')
			THEN 0 ELSE 1
		END,
		-- Deterministic-per-UTC-day RNG order.
		abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;
GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- 6. buy_hat(): carried VERBATIM from 20260688000000_members_only_cosmetics.sql
--    + a 'new' lane item sells only while its shelf is open.
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
	-- items fall through unchanged.
	IF hat_shelf_lane = 'new' AND NOT public.seasonal_shelf_is_open(hat_shelf_key) THEN
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

-- 7. grant_mystery_box(): carried VERBATIM from 20260631000000_mystery_hat_box.sql
--    (its only def) + a mystery box never hands out a 'new' lane piece.
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
		  -- Seasonal debuts ('new' lane) are sold on their shelf, never boxed.
		  AND h.shelf_lane IS DISTINCT FROM 'new'
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

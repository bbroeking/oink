-- Add the 5 hat rows that the snout_season_1 seed references but
-- never created.
--
-- Season-pass tiers 7, 18, 22 reward hats by id (bunny_ears,
-- leaf_crown, devil_horns, cat_ears, astronaut). The seed inserted
-- the tier rows but the matching public.hats catalog rows were
-- never added — so claim_tier_reward's INSERT INTO user_hats hit
-- a FK violation on user_hats.hat_id, the function threw, and the
-- whole claim silently failed. (User caught this trying to claim
-- tier 7's 'Bunny ears'.)
--
-- These items are season-pass exclusives — they should NOT show
-- up in the daily shop or be buyable for snouts. The catalog has
-- no "season_pass_only" flag, so we mark them with cost = 0 and
-- patch the two public surfaces that touch the catalog:
--
--   • daily_shop()  — exclude cost <= 0 items from the rotation
--   • buy_hat()     — reject cost <= 0 with 'not_for_sale'
--
-- After this migration, claim_tier_reward works for the 5 affected
-- tiers, and the new items stay invisible in the shop until/unless
-- a future migration prices them. Image assets for these items are
-- still missing (assets/images/hats/{bunny_ears,leaf_crown,…}.png)
-- and need to be authored separately — but the claim itself
-- succeeds, the user_hats row lands, and the inventory tracks it.

INSERT INTO public.hats
	(id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('bunny_ears',  'Bunny ears',       NULL, 0, 9000, 'hat', 'rare', 'Spring-step ears — fluffy enough to twitch.'),
	('leaf_crown',  'Crown of leaves',  NULL, 0, 9001, 'hat', 'epic', 'A wreath for hogs who tend the grove.'),
	('devil_horns', 'Devil horns',      NULL, 0, 9002, 'hat', 'epic', 'Just a little mischief — no commitment.'),
	('cat_ears',    'Cat ears',         NULL, 0, 9003, 'hat', 'rare', 'Snout aside, the resemblance is uncanny.'),
	('astronaut',   'Astronaut helmet', NULL, 0, 9004, 'hat', 'epic', 'Honk to depressurize. Tickle in zero-G.')
ON CONFLICT (id) DO NOTHING;

-- ── daily_shop: skip cost <= 0 (season-pass exclusives) ──────────
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH
		today_seed AS (SELECT current_date::text AS d),
		candidates AS (
			SELECT h.*,
				abs(hashtext(h.id || (SELECT d FROM today_seed))) AS rnk
			FROM public.hats h
			LEFT JOIN public.user_hats uh
				ON uh.hat_id = h.id AND uh.user_id = auth.uid()
			WHERE uh.hat_id IS NULL
			  AND h.cost > 0   -- exclude season-pass exclusives
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- ── buy_hat: reject cost <= 0 with a clean 'not_for_sale' reason ─
CREATE OR REPLACE FUNCTION public.buy_hat(target_hat_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	hat_cost integer;
	current_counter bigint;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT cost INTO hat_cost FROM public.hats WHERE id = target_hat_id;
	IF hat_cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_hat');
	END IF;
	-- Season-pass exclusives carry cost = 0 — block the buy path so
	-- they can only be obtained via claim_tier_reward.
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

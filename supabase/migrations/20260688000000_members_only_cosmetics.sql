-- Members-only cosmetics infrastructure for the Slop Club shop section.
-- Mirrors the fully-enforced pass_exclusive precedent (20260675): a hats flag
-- + gates in daily_shop() (members items never appear in the random Today drop;
-- they live only in the dedicated Collectibles "Members" section) and buy_hat()
-- (only is_vip members can buy them). Items themselves (the 75-item catalog)
-- are seeded in a follow-up once their art is generated, so this is infra only.
--
-- CARRY-LATEST-DEF: daily_shop()/buy_hat() bodies are copied VERBATIM from the
-- active definition (20260675000000_battle_pass_shop_exclusion.sql) with only
-- the members_only additions, so pass_exclusive / cost>0 / h.* are preserved.

ALTER TABLE public.hats
	ADD COLUMN IF NOT EXISTS members_only boolean NOT NULL DEFAULT false;

-- daily_shop() — carried from 20260675 + exclude members_only from the drop.
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT h.*
	FROM public.hats h
	WHERE h.category NOT IN ('cape', 'flag')
		AND h.cost > 0
		AND NOT h.pass_exclusive   -- battle-pass rewards are earned, never sold
		AND NOT h.members_only      -- members items live in the Members section
	-- Deterministic-per-UTC-day RNG order.
	ORDER BY abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;
GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- buy_hat() — carried from 20260675 + reject members_only for non-members.
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
	caller_is_member boolean;
	current_counter bigint;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT cost, pass_exclusive, members_only
		INTO hat_cost, hat_pass_only, hat_members_only
	FROM public.hats WHERE id = target_hat_id;
	IF hat_cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_hat');
	END IF;
	-- Battle-pass exclusives are earn-only (claim_tier_reward), regardless of
	-- price. Checked BEFORE the cost guard so the reason is specific.
	IF hat_pass_only THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pass_exclusive');
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

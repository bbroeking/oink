-- Battle-pass cosmetics must NEVER be buyable in the shop — they are earned
-- only by claiming season tiers. Until now this leaned on the cost = 0 "not for
-- sale" sentinel, which is a per-item manual convention: a future pass hat added
-- with a stray price would leak into the daily drop / Browse grid. This makes the
-- separation STRUCTURAL and self-maintaining for every future season:
--
--   • hats.pass_exclusive — a flag, like war_exclusive, that marks a hat as a
--     battle-pass reward.
--   • a trigger on season_tiers keeps it in sync: any hat granted by a tier
--     (reward_type='hat') is flagged automatically, so a new season's rewards are
--     excluded the moment they're seeded — no per-item bookkeeping.
--   • daily_shop() and buy_hat() exclude / reject pass_exclusive hats regardless
--     of price, so even a mispriced reward can't be drawn or bought.
--
-- Independent of the existing cost > 0 guard (kept) — belt and suspenders.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. The flag
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hats
	ADD COLUMN IF NOT EXISTS pass_exclusive boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Keep it in sync with the season-pass catalog (current + all future seasons)
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_pass_exclusive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	-- Only tier rewards that grant a SPECIFIC hat mark that hat. Mystery-box
	-- tiers (random pool) and non-hat rewards don't pin an id.
	IF NEW.reward_type = 'hat' AND (NEW.reward_value ? 'hat_id') THEN
		UPDATE public.hats
		SET pass_exclusive = true
		WHERE id = NEW.reward_value->>'hat_id';
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS season_tiers_sync_pass_exclusive ON public.season_tiers;
CREATE TRIGGER season_tiers_sync_pass_exclusive
	AFTER INSERT OR UPDATE ON public.season_tiers
	FOR EACH ROW EXECUTE FUNCTION public.sync_pass_exclusive();

-- Backfill every hat already granted by an existing season tier.
UPDATE public.hats h
SET pass_exclusive = true
WHERE EXISTS (
	SELECT 1 FROM public.season_tiers t
	WHERE t.reward_type = 'hat'
		AND (t.reward_value ? 'hat_id')
		AND t.reward_value->>'hat_id' = h.id
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. daily_shop() — carried from 20260673 (h.*, war_exclusive self-heal) +
--    the pass_exclusive exclusion. (carry-latest-def: this is the new latest.)
-- ────────────────────────────────────────────────────────────────────────────
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
	-- Deterministic-per-UTC-day RNG order.
	ORDER BY abs(hashtext(h.id || current_date::text))
	LIMIT 8;
$function$;
GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. buy_hat() — carried from 20260544 + reject pass_exclusive regardless of
--    price (so a mispriced reward still can't be purchased).
-- ────────────────────────────────────────────────────────────────────────────
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
	current_counter bigint;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	SELECT cost, pass_exclusive INTO hat_cost, hat_pass_only
	FROM public.hats WHERE id = target_hat_id;
	IF hat_cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_hat');
	END IF;
	-- Battle-pass exclusives are earn-only (claim_tier_reward), regardless of
	-- price. Checked BEFORE the cost guard so the reason is specific.
	IF hat_pass_only THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pass_exclusive');
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

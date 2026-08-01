-- A full Golden Truffle pouch must never make a Wallow reward unclaimable.
--
-- claim_wallow_tier() historically treated its Golden Truffle bundle as
-- all-or-nothing: if all two truffles would not fit beneath the 999 pouch cap,
-- the claim returned `truffle_cap` and did not enter the claim ledger. Because
-- wallow() requires every reward in the current lap to be claimed, a player
-- with a permanently full pouch (including a player who owns the whole finite
-- Exchange) could be locked out of Wallow forever.
--
-- Keep the pouch cap. Mint the portion that fits and bank the remainder in an
-- owner-readable, server-write-only overflow balance. The claim is then safely
-- recorded, so progression cannot deadlock. A later Exchange/Wallet tranche
-- can surface and drain this recoverable balance without changing claim
-- history or inventing a lossy conversion.

CREATE TABLE public.golden_truffle_overflow (
	user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	amount int NOT NULL DEFAULT 0 CHECK (amount >= 0),
	updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.golden_truffle_overflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own Golden Truffle overflow"
	ON public.golden_truffle_overflow
	FOR SELECT
	USING (auth.uid() = user_id);

GRANT SELECT ON public.golden_truffle_overflow TO authenticated;

-- Preserve the last shipped implementation as an internal compatibility
-- helper. The wrapper below changes only the one result that caused the
-- progression deadlock. Function renames retain ACLs, so revoke explicitly.
ALTER FUNCTION public.claim_wallow_tier(int)
	RENAME TO _claim_wallow_tier_cap_limited_20260784;

REVOKE ALL ON FUNCTION public._claim_wallow_tier_cap_limited_20260784(int)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_wallow_tier(target_tier int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	result jsonb;
	season public.seasons;
	progress public.user_season_progress;
	reward public.wallow_tiers;
	amount int;
	minted int;
	overflowed int;
BEGIN
	result := public._claim_wallow_tier_cap_limited_20260784(target_tier);

	IF COALESCE(result->>'reason', '') <> 'truffle_cap' THEN
		RETURN result;
	END IF;

	-- The internal claimer returns truffle_cap only after authentication,
	-- active-season, progress/lap, tier, duplicate, and unlock checks have all
	-- passed. Its FOR UPDATE locks remain held for this transaction.
	SELECT * INTO season FROM public.active_season();
	SELECT * INTO progress
	FROM public.user_season_progress
	WHERE user_id = caller_id AND season_id = season.id;
	SELECT * INTO reward
	FROM public.wallow_tiers
	WHERE tier = target_tier AND reward_type = 'golden_truffle';

	IF caller_id IS NULL OR season.id IS NULL OR progress.user_id IS NULL
	   OR reward.tier IS NULL THEN
		-- Defensive only: preserve the original failure if the state changed in
		-- an unexpected way after the locked internal check.
		RETURN result;
	END IF;

	amount := GREATEST(0, COALESCE((reward.reward_value->>'amount')::int, 0));
	minted := public.mint_truffles(caller_id, amount, 'wallow_pass', NULL);
	overflowed := GREATEST(0, amount - minted);

	IF overflowed > 0 THEN
		INSERT INTO public.golden_truffle_overflow (user_id, amount)
		VALUES (caller_id, overflowed)
		ON CONFLICT (user_id) DO UPDATE
		SET amount = public.golden_truffle_overflow.amount + EXCLUDED.amount,
		    updated_at = now();
	END IF;

	INSERT INTO public.user_wallow_tier_claims
		(user_id, season_id, wallow_lap, tier)
	VALUES (caller_id, season.id, progress.wallow_count, target_tier);

	RETURN jsonb_build_object(
		'ok', true,
		'reward_type', reward.reward_type,
		'wallow_lap', progress.wallow_count,
		'tier', target_tier,
		'golden_truffles', minted,
		'golden_truffle_overflow', overflowed
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_wallow_tier(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_wallow_tier(int) TO authenticated;


-- Beginner's snout — a one-time real Golden Truffle for a player's FIRST
-- practice dig, so the onboarding "you'd have kept N truffles" promise starts
-- with something real in the pouch instead of a hypothetical.
--
-- The season-tab onboarding lets a crewless player TASTE the dig in practice
-- mode (nothing banks). The first time that practice dig completes, the client
-- fire-and-forgets claim_beginners_snout() — a tiny once-per-account grant of
-- +1 golden_truffles so the Exchange preview isn't empty.
--
-- New fn — nothing to carry (no prior definition). SECURITY DEFINER, auth
-- caller, idempotent per account via profiles.beginners_snout_at. Cap-aware
-- via the existing mint_truffles helper (never lossy, never over 999).
--   {ok:true, granted:int, balance:int}    on the first claim
--   {ok:false, reason:'not_authed'}         no auth.uid()
--   {ok:false, reason:'already_claimed'}    the snout was already spent

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS beginners_snout_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_beginners_snout()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_granted int;
	v_balance int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authed');
	END IF;

	-- Stamp the snout once. The WHERE guard means a second caller (or a race)
	-- updates zero rows → already_claimed, so the grant can never double-mint.
	UPDATE public.profiles
	SET beginners_snout_at = now()
	WHERE id = caller_id AND beginners_snout_at IS NULL;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	-- Cap-aware +1 (the pouch tops out at 999; mint returns what it actually
	-- added). Reuses the same mint the dig uses so the gift obeys the same cap.
	v_granted := public.mint_truffles(caller_id, 1, 'beginners_snout', NULL);
	SELECT golden_truffles INTO v_balance FROM public.profiles WHERE id = caller_id;

	RETURN jsonb_build_object('ok', true, 'granted', v_granted, 'balance', v_balance);
END $function$;

GRANT EXECUTE ON FUNCTION public.claim_beginners_snout() TO authenticated;

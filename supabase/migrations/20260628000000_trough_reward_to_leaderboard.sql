-- Trough rewards: pay to the SCORE, not the bank (live-play feedback).
--
-- claim_drive_reward paid the reward into the tickle BANK (grant_tickles,
-- over-cap). A banked tickle isn't 1 snout — it's a TAP: each spend also mints
-- +3 season XP, rolls lucky-pig, bumps the GLOBAL daily lucky counter, and
-- pumps happiness. A 180-tickle trough claim therefore compounded into ~540
-- season XP (5+ pass tiers), 180 lucky rolls, and a distorted communal lucky
-- counter — per-tap rewards were tuned for 1/hr-regen earned taps, not granted
-- bursts.
--
-- Fix: credit the reward DIRECTLY as what a tap converts to — +1 counter
-- (snouts) and +1 tickles_earned (the leaderboard) per reward tickle — with
-- none of the per-tap side effects. Value-equivalent, exploit-free, and the
-- payoff is instantly visible on the leaderboard instead of demanding 180
-- taps of busywork. Body otherwise verbatim from 20260583; return shape
-- unchanged (client just refetches).

CREATE OR REPLACE FUNCTION public.claim_drive_reward(donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	don       public.item_drive_donations;
	drive_status text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO don FROM public.item_drive_donations
		WHERE id = donation_id FOR UPDATE;
	IF don.id IS NULL OR don.donor_user_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF don.reward_claimed_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	SELECT status INTO drive_status FROM public.item_drives WHERE id = don.drive_id;
	IF drive_status <> 'funded' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_funded');
	END IF;

	-- Tap-equivalent credit: snouts + leaderboard, no per-tap side effects
	-- (no XP, no lucky rolls, no bank — see header).
	UPDATE public.profiles
		SET counter        = counter + don.tickle_reward,
		    tickles_earned = tickles_earned + don.tickle_reward
		WHERE id = caller_id;

	UPDATE public.item_drive_donations SET reward_claimed_at = now()
		WHERE id = donation_id;

	RETURN jsonb_build_object('ok', true, 'tickles', don.tickle_reward);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_drive_reward(uuid) TO authenticated;

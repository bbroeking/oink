-- Barn-visit payout fix (player report): "I visited Jen's barn and tapped 4
-- times — my count went up to 1739, but when I left I was back to 1735."
--
-- Root cause: the visit screen shows TWO leaderboard tallies, YOU and the
-- host, both seeded from each player's `tickles_earned` and both optimistically
-- ticked +1 per tap (BarnVisitModal `setYouHearts`/`setFriendHearts`). But
-- 20260646 only credited the HOST's leaderboard (counter + tickles_earned);
-- the VISITOR was paid nothing. So the visitor's "YOU" tally was a client-only
-- optimism that the next `home_stats` refresh on exit overwrote with the real
-- (unchanged) value — the 1739 -> 1735 "lost cash" the player saw.
--
-- Fix: the visitor now earns the SAME payout as the host — counter (spendable
-- snouts) + tickles_earned (leaderboard) — so the visit screen's two tallies
-- are genuinely symmetric ("you both get a heart"), the YOU number persists
-- after leaving, AND the player banks real cash for visiting. Per the player
-- follow-up ("cash is the player's cash"): the reward must be spendable snouts,
-- not just a leaderboard count.
--
-- ANTI-FAUCET (added after adversarial review): crediting the visitor real
-- snouts opened an UNBOUNDED cash faucet. The 3h cooldown only blocks switching
-- to a DIFFERENT barn (target_id <> p_target), so re-tapping the SAME barn ran
-- at 7/hr with no daily cap = ~168 snouts/day solo, ~336/day for a 2-account
-- collusion ring (there is still no server-side friendship gate). This def adds
-- a per-visitor DAILY tap cap (daily_cap) that bounds the mint — and the per-tap
-- season-XP + happiness side-effects — to cozy levels (the old 5/day budget,
-- removed in 20260605, was never replaced). PLUS a friends-only gate
-- (are_friends) so cash/leaderboard can't be minted to or from strangers
-- (player decision) — a mutual-accept friend ring is now the floor for any
-- collusion, not a bare alt-account pair. STILL OPEN, flagged for a product
-- decision: the referral "engaged" milestone — the visitor's tickles_earned
-- credit now feeds the tickles_earned>=50 +500/+500 gate via visiting (one-time
-- per referral; the daily cap + friends-only force a real multi-day friended
-- account, but it lowers the genuine-play bar). NB referral payouts themselves
-- are ALL to counter (snouts), never tickles_earned — visiting does NOT add to
-- any referral leaderboard payout; it only feeds the tickles_earned>=50 GATE.
--
-- Body is verbatim from 20260646 (the latest tickle_at_barn def) with: the
-- visitor counter+tickles_earned UPDATE, the daily-cap guard, the
-- visitor_reward/daily_cap constants, and a 'visitor_tickles' return field added
-- — carry-latest-def discipline (do NOT rebuild from a stale base).

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id      uuid := auth.uid();
	host_reward    constant int := 1;
	visitor_reward constant int := 1;  -- visitor's own snouts + leaderboard (this fix)
	tired_cap      constant int := 7;
	daily_cap      constant int := 20; -- max rewarded visit taps per visitor per day (anti-faucet; tunable)
	visit_cooldown constant interval := '3 hours';
	taps_this_hour int;
	visits_today   int;
	last_other_at  timestamptz;
	visitor_name   text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_target');
	END IF;

	-- Friends-only (player decision): no cash/leaderboard mint to or from
	-- strangers. This is the authoritative gate — UserSheet also hides the Visit
	-- button for non-friends, but the server check is what actually stops a
	-- collusion ring from minting without a real bidirectional friend accept.
	-- Reuses the canonical are_friends() helper (same check as blessings/curses/
	-- trades/trough). The client treats an unhandled 'not_friends' as a no-op,
	-- which only occurs on an unfriend-mid-visit race (button is already hidden).
	IF NOT public.are_friends(caller_id, p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'not_friends');
	END IF;

	-- One person every 3 hours: if you've tickled a DIFFERENT barn inside the
	-- cooldown, you can't start on this one yet. Re-tapping the same barn is ok.
	SELECT max(created_at) INTO last_other_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id <> p_target;
	IF last_other_at IS NOT NULL AND last_other_at > now() - visit_cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown', 'next_at', last_other_at + visit_cooldown
		);
	END IF;

	-- Per-barn tired ceiling: at most tired_cap taps/hour on the same barn.
	SELECT count(*) INTO taps_this_hour
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target
	  AND created_at > now() - INTERVAL '1 hour';
	IF taps_this_hour >= tired_cap THEN
		RETURN jsonb_build_object('ok', false, 'error', 'tired');
	END IF;

	-- Per-visitor DAILY cap: bounds the snout mint (and the per-tap XP/happiness
	-- side-effects) so visiting can't be farmed for cash by re-tapping one barn
	-- 7/hr indefinitely. Reuses the 'cooldown' refusal so the existing client
	-- nap/lock screen shows a "come back" timer with NO client change; next_at is
	-- the next UTC day boundary.
	SELECT count(*) INTO visits_today
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND created_at >= date_trunc('day', now());
	IF visits_today >= daily_cap THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown',
			'next_at', date_trunc('day', now()) + INTERVAL '1 day'
		);
	END IF;

	-- The given tickle lands on the host's LEADERBOARD (counter +
	-- tickles_earned, the 20260628 payout shape) — not their bank.
	UPDATE public.profiles
	SET counter = counter + host_reward,
	    tickles_earned = tickles_earned + host_reward
	WHERE id = p_target;

	-- The visitor earns the SAME as the host: real spendable snouts (counter) +
	-- leaderboard (tickles_earned). This banks cash for the visit (player
	-- request: "cash is the player's cash") AND makes the optimistic "YOU"
	-- tally — which reads tickles_earned — true so it survives the next
	-- home_stats refresh on exit (the 1739 -> 1735 revert).
	UPDATE public.profiles
	SET counter = counter + visitor_reward,
	    tickles_earned = tickles_earned + visitor_reward
	WHERE id = caller_id;

	-- Both pigs get happier (yours full, theirs 25%, both window-capped).
	PERFORM public.apply_happiness(caller_id, 1.0);
	PERFORM public.apply_happiness(p_target, 0.25);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, host_reward);

	-- First tap of the session: generosity + notify (once).
	IF taps_this_hour = 0 THEN
		PERFORM public.shift_alignment(caller_id, 1);
		SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			p_target, 'barn_visit', 'Someone visited your Barn!',
			COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!',
			'{}'::jsonb
		);
	END IF;

	PERFORM public.grant_season_xp(caller_id, 5);

	RETURN jsonb_build_object(
		'ok', true,
		'tickles', host_reward,
		'visitor_tickles', visitor_reward,
		'taps_left', tired_cap - taps_this_hour - 1
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

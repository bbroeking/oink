-- The Trough — quarter cap + 3-day window + revived tickle reward.
--
-- TICKLE REWARD REVIVED (founder 2026-07-20, SKILL.md decision log): donations
-- pay the donor 1 tickle per 100 snouts spent (floor), credited IMMEDIATELY at
-- donation time. This SUPERSEDES spec 15's "zero forever" for NEW donations going
-- forward — the live rate history is 10:1 (20260628) → 0 (spec 15) → 1:100 now.
-- The claim lane (claim_drive_reward) stays retired, and spec 15's clawback of the
-- old 10:1-era grants is unchanged. See the reward block in donate_to_drive below.
--
-- Founder call 2026-07-20 (SKILL.md decision log): two rules for item_drives.
--   1. QUARTER CAP. No single pig may contribute more than 25% of a Trough's
--      target, CUMULATIVE per donor per drive. cap = ceil(target * 0.25). A
--      donor's incoming chip is clamped to their remaining headroom; a donor
--      with no headroom left is refused ({ok:false, reason:'donor_cap'}) BEFORE
--      any charge. This holds for the opener too — see the opener-seed note.
--   2. 3-DAY WINDOW. Troughs stay open 72 hours (was 48). The refund machinery
--      (resolve_expired_drives) already keys off closes_at, so it needs NO
--      change — a Trough that fills gets granted, one that doesn't gets every
--      donor + the opener's seed refunded, same as today, just three days out.
--
-- OPENER-SEED DECISION (>>> FOUNDER-REVIEWABLE <<<): the opener is a pig too, so
-- the 25% cap applies to their seed. But we CLAMP their seed to ceil(cost*0.25)
-- rather than refuse — it's their own Trough they're opening, and a friendly
-- clamp beats a wall. In practice the client seeds only ceil(cost*0.10) (10%),
-- well under the cap, so this clamp only ever bites a hand-rolled/future client;
-- it's a floor-of-safety, not a behaviour the UI can reach today.
--
-- Carried bases (CARRY-LATEST-DEF footgun — each carried VERBATIM from its
-- alphabetically-latest def, then the two rules layered on):
--   • donate_to_drive  ← 20260751000000_retire_trough_tickle_reward.sql
--                        (reward was retired to 0; now REVIVED to floor(snouts/100),
--                        credited immediately — see the header + reward block)
--   • open_item_drive  ← 20260639000000_trough_requires_shop_item.sql
--                        (in-shop gate + post-spend balance return)
--   • resolve_expired_drives — NOT redefined (unchanged; keys off closes_at)
--
-- Migration AUTHORED ONLY — never `db push` autonomously; the founder pushes.

-- ── 1. donate_to_drive — cumulative 25%-per-donor cap + revived reward ─────────
-- Body carried VERBATIM from 20260751000000, plus the quarter cap and the revived
-- floor(snouts/100) reward (see header — supersedes spec 15's reward := 0):
-- prior chips are summed per (donor, drive), a no-headroom donor is refused
-- before charging, and the accepted chip is clamped into the LEAST() alongside
-- the remaining-gap clamp. Every existing guard (12h-per-drive cooldown,
-- already_funded, insufficient, first-chip-of-day XP, chip + funded
-- announcements, funding grant) is intact and in the same order.
CREATE OR REPLACE FUNCTION public.donate_to_drive(drive_id uuid, snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	d           public.item_drives;
	bal         bigint;
	reward      int;
	now_raised  int;
	item_name   text;
	op_name     text;
	donor_row   record;
	first_today boolean;
	cap         int;
	prior_sum   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount');
	END IF;

	SELECT * INTO d FROM public.item_drives WHERE id = drive_id FOR UPDATE;
	IF d.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_drive');
	END IF;
	IF d.status <> 'open' OR d.closes_at <= now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'drive_closed');
	END IF;
	IF d.opener_user_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');  -- opener seeds via open
	END IF;
	-- Sounder-scoped: only the opener's friends can donate.
	IF NOT public.are_friends(caller_id, d.opener_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- Donating cooldown: once every 12 hours PER DRIVE (was global across all
	-- drives — chipping into one friend's Trough locked out every other
	-- friend's for 12h). dd. alias is load-bearing: unqualified drive_id here
	-- is ambiguous against the function parameter (the 20260626 42702 bug).
	IF EXISTS (
		SELECT 1 FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id
		  AND dd.drive_id = d.id
		  AND dd.created_at > now() - interval '12 hours'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donate_cooldown');
	END IF;

	-- Quarter cap (founder 2026-07-20): no single pig funds more than 25% of the
	-- target, cumulative across their chips into THIS drive. cap = ceil(target *
	-- 0.25); headroom = cap - what they've already chipped. No headroom → refuse
	-- BEFORE charging; otherwise the incoming chip is clamped to fit inside it.
	cap := CEIL(d.target_snouts * 0.25);
	SELECT COALESCE(SUM(dd.snouts), 0) INTO prior_sum
		FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id AND dd.drive_id = d.id;
	IF cap - prior_sum <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donor_cap');
	END IF;

	-- Never take more than the remaining gap, nor more than the donor's headroom.
	snouts := LEAST(snouts, d.target_snouts - d.raised_snouts, cap - prior_sum);
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_funded');
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', snouts);
	END IF;

	-- First donation of the UTC day? (checked before this donation's row exists)
	SELECT NOT EXISTS (
		SELECT 1 FROM public.item_drive_donations
		WHERE donor_user_id = caller_id
		  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	UPDATE public.profiles SET counter = counter - snouts WHERE id = caller_id;

	-- Trough tickle reward REVIVED (founder 2026-07-20): pay the donor 1 tickle per
	-- 100 snouts actually taken (floor). Computed AFTER the clamps above, so it pays
	-- on the snouts really deducted (quarter cap + remaining-target), never the
	-- requested amount. This amends spec 15's "zero forever" for NEW donations going
	-- forward; the old 10:1-era clawback (20260751) stands untouched.
	-- Credit is IMMEDIATE, at donation time — the claim lane (claim_drive_reward)
	-- stays retired. Per the 20260628 tap-equivalent rationale, one reward tickle is
	-- credited as what a tap converts to: +1 counter (snouts) and +1 tickles_earned
	-- (leaderboard), with NONE of the per-tap side effects (no XP, no lucky rolls,
	-- no bank).
	reward := floor(snouts / 100.0);
	IF reward > 0 THEN
		UPDATE public.profiles
			SET counter        = counter + reward,
			    tickles_earned = tickles_earned + reward
			WHERE id = caller_id;
	END IF;
	INSERT INTO public.item_drive_donations (drive_id, donor_user_id, snouts, tickle_reward)
		VALUES (drive_id, caller_id, snouts, reward);

	now_raised := d.raised_snouts + snouts;
	UPDATE public.item_drives SET raised_snouts = now_raised WHERE id = drive_id;

	-- Opener-side feedback: every chip-in drops a note into the opener's
	-- WhileAway feed ("Jen chipped in 25 — 1,775 to go"). Funded chips skip
	-- this — the funded announcement below already covers the moment.
	-- (Inline INSERT, never send_system_announcement: admin-gated rollback.)
	IF now_raised < d.target_snouts THEN
		SELECT username INTO op_name FROM public.profiles WHERE id = caller_id;
		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_chip',
			COALESCE(op_name, 'A friend') || ' chipped in!',
			COALESCE(op_name, 'A friend') || ' put ' || snouts || ' snouts in your '
				|| COALESCE(item_name, 'item') || ' Trough — '
				|| (d.target_snouts - now_raised) || ' to go.',
			jsonb_build_object('drive_id', drive_id));
	END IF;

	-- Funded → grant the item to the opener; tell the opener + every donor.
	-- (Inline INSERTs, not send_system_announcement, which is admin-gated and
	-- would roll back the donation for non-admins.) No tickle claim anymore —
	-- the donor note celebrates the item landing (spec 15, whimsy voice).
	IF now_raised >= d.target_snouts THEN
		UPDATE public.item_drives
			SET status = 'funded', granted_at = now() WHERE id = drive_id;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (d.opener_user_id, d.item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		SELECT username INTO op_name FROM public.profiles WHERE id = d.opener_user_id;

		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_funded',
			'Your Trough filled!',
			'Your Sounder came through — the ' || COALESCE(item_name, 'item')
				|| ' is yours!',
			jsonb_build_object('drive_id', drive_id));

		FOR donor_row IN
			SELECT DISTINCT dd.donor_user_id FROM public.item_drive_donations dd
			WHERE dd.drive_id = d.id
		LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				donor_row.donor_user_id, 'trough_funded',
				'You helped land it!',
				'Thanks to you, ' || COALESCE(op_name, 'a friend') || ' got the '
					|| COALESCE(item_name, 'item') || '. That''s the herd coming through!',
				jsonb_build_object('drive_id', drive_id));
		END LOOP;
	END IF;

	-- Reward the donor's engagement: +5 season XP on the first donation of the day.
	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 5); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', reward,
		'raised', now_raised, 'target', d.target_snouts,
		'funded', now_raised >= d.target_snouts,
		'xp', CASE WHEN first_today THEN 5 ELSE 0 END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

-- ── 2. open_item_drive — 72h window + opener seed clamped to the quarter cap ──
-- Body carried VERBATIM from 20260639000000 (in-shop gate + post-spend balance),
-- with two changes: closes_at is now + 72 hours (was 48), and the opener's seed
-- is clamped down to ceil(cost * 0.25) if it exceeds the quarter cap (see the
-- FOUNDER-REVIEWABLE opener-seed note in the header — clamp, don't refuse).
CREATE OR REPLACE FUNCTION public.open_item_drive(target_item_id text, seed_snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost      int;
	item_cat  text;
	min_seed  int;
	seed_cap  int;
	bal       bigint;
	new_bal   bigint;
	new_id    uuid;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT hats.cost, hats.category INTO cost, item_cat
	FROM public.hats WHERE id = target_item_id;
	IF cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
	END IF;
	IF cost <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');  -- exclusives
	END IF;

	-- In-shop gate: must be in today's rotation. (item_cat read above is
	-- kept for future category gates; flags never reach here anyway —
	-- daily_shop() excludes them and they're allegiance picks, not buys.)
	IF NOT EXISTS (
		SELECT 1 FROM public.daily_shop() ds WHERE ds.id = target_item_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_shop');
	END IF;

	-- One Trough per opener every 3 days.
	IF EXISTS (
		SELECT 1 FROM public.item_drives
		WHERE opener_user_id = caller_id AND opens_at > now() - interval '3 days'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'opener_cooldown');
	END IF;

	min_seed := CEIL(cost * 0.10);
	IF seed_snouts < min_seed THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'seed_too_low', 'min_seed', min_seed);
	END IF;
	IF seed_snouts > cost THEN
		seed_snouts := cost;  -- can't over-seed past the price
	END IF;
	-- Quarter cap (founder 2026-07-20): the opener is a pig too — no single pig
	-- funds more than 25% of the target. CLAMP rather than refuse (it's their own
	-- Trough opening; friendlier than a wall). seed_cap = ceil(cost * 0.25); the
	-- client seeds only ceil(cost*0.10), so this only bites a future/hand client.
	seed_cap := CEIL(cost * 0.25);
	IF seed_snouts > seed_cap THEN
		seed_snouts := seed_cap;
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < seed_snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', seed_snouts);
	END IF;

	UPDATE public.profiles SET counter = counter - seed_snouts
	WHERE id = caller_id
	RETURNING counter INTO new_bal;

	INSERT INTO public.item_drives
		(item_id, opener_user_id, target_snouts, raised_snouts, closes_at)
		VALUES (target_item_id, caller_id, cost, seed_snouts, now() + interval '72 hours')
		RETURNING id INTO new_id;

	RETURN jsonb_build_object('ok', true, 'drive_id', new_id,
		'target', cost, 'raised', seed_snouts, 'balance', new_bal);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_item_drive(text, int) TO authenticated;

-- ── 3. resolve_expired_drives — NO CHANGE ────────────────────────────────────
-- It selects `WHERE status = 'open' AND closes_at <= now()` and refunds each
-- donor their SUM of chips + the opener's seed (20260627). Because it keys off
-- closes_at (not a hardcoded window), the 48h→72h change flows through with no
-- edit here. Left untouched deliberately.

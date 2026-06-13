-- Over-cap display fix: pay down the read/write-path debt flagged in
-- 20260580_settle_tickles (header NOTE, lines 18-21): "display RPCs that
-- recompute the balance inline (home_stats, admin_tickle_overview) still
-- clamp with LEAST — they should get the same GREATEST fix when the first
-- over-cap grant ships, so over-cap users see the true number."
--
-- That first over-cap grant has now shipped: build 92's Trough rework
-- (20260622_trough_clarity_and_xp) pays donors floor(snouts / 10) tickles
-- (the 10:1 payout) via claim_drive_reward → grant_tickles, which
-- deliberately adds WITHOUT clamping. A donor at 25/25 who claims a
-- 5-tickle reward really holds 30 — but any path still clamping with plain
-- LEAST displays (or worse, writes back) 25, so the player reads "tickles
-- stuck at 25/25" even though the balance is correct underneath. This
-- migration makes the over-cap balance VISIBLE so that report reads right.
--
-- Audit of every balance-recomputing function's LATEST definition:
--   * tickle_balance / tickle_info — fixed by 20260580 itself.
--   * home_stats (latest def, 20260599) — delegates to tickle_info and
--     passes 'balance' through by name, so the player home read-path is
--     already over-cap-correct. Deliberately NOT touched: clients
--     destructure its jsonb fields ('balance'/'cap'/'next_regen_seconds')
--     by name and the shape must not drift.
--   * update_profile_and_item_count — latest def is 20260624 (applied
--     immediately before this file) and already uses the GREATEST math.
--     NOT touched here.
--   * tickle_at_barn (20260613), barn_visit_status (20260608),
--     settle_tickles / grant_tickles (20260580) — already canonical.
--
-- Two functions still clamp with the OLD plain LEAST; both get the
-- canonical swap
--   LEAST(cap, item_count + regen)
--   → GREATEST(item_count, LEAST(cap, item_count + regen))
-- (over-cap preserved, regen still capped at cap, wasted-tickle banking
-- unaffected). Bodies otherwise byte-identical to their latest defs:
--
--   1. admin_tickle_overview (20260555) — READ path: over-cap users pin at
--      cap/cap on the admin dashboard. next_regen_secs already NULLs
--      at/over cap, so only balance_now changes.
--   2. fulfill_tickle_trade (20260562) — WRITE path: clamped the balance
--      to cap BEFORE deducting, silently confiscating any over-cap surplus
--      when an over-cap user fulfills a trade (30 @ cap 25, fulfill 2 →
--      wrote 23; now writes 28).
--
-- Signatures and return shapes are unchanged, so CREATE OR REPLACE
-- suffices (no DROP) and existing ACLs persist; GRANTs restated per repo
-- convention.

set check_function_bodies = off;

-- ── admin_tickle_overview — balance_now preserves over-cap ─────────────
CREATE OR REPLACE FUNCTION public.admin_tickle_overview()
RETURNS TABLE (
	user_id          uuid,
	username         text,
	discriminator    text,
	tickles_earned   bigint,
	balance_raw      int,
	balance_now      int,
	cap              int,
	regen_secs       int,
	next_regen_secs  int,
	alignment_score  int,
	active_hat_id    text,
	active_hat_name  text,
	last_increment   timestamp,
	is_test          boolean,
	created_at       timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_is_test boolean;
BEGIN
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	RETURN QUERY
	SELECT
		p.id AS user_id,
		p.username,
		p.discriminator,
		p.tickles_earned,
		ui.item_count AS balance_raw,
		GREATEST(
			ui.item_count,
			LEAST(
				CASE WHEN p.is_vip THEN 50 ELSE 25 END,
				ui.item_count + GREATEST(0, FLOOR(
					EXTRACT(EPOCH FROM (now() - ui.last_increment))
					/ public.regen_secs_for(p.id)
				)::int)
			)
		) AS balance_now,
		(CASE WHEN p.is_vip THEN 50 ELSE 25 END)::int AS cap,
		public.regen_secs_for(p.id)::int AS regen_secs,
		CASE
			WHEN ui.item_count >= (CASE WHEN p.is_vip THEN 50 ELSE 25 END) THEN NULL
			ELSE (
				public.regen_secs_for(p.id)
				- (EXTRACT(EPOCH FROM (now() - ui.last_increment))::int
				   % public.regen_secs_for(p.id))
			)::int
		END AS next_regen_secs,
		p.alignment_score,
		p.active_hat_id,
		h.name AS active_hat_name,
		ui.last_increment,
		COALESCE(p.is_test, false) AS is_test,
		u.created_at
	FROM public.profiles p
	LEFT JOIN public.user_items ui ON ui.user_id = p.id
	LEFT JOIN public.hats h        ON h.id = p.active_hat_id
	LEFT JOIN auth.users u         ON u.id = p.id
	ORDER BY p.tickles_earned DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_tickle_overview() TO authenticated;

-- ── fulfill_tickle_trade — over-cap surplus survives fulfillment ───────
CREATE OR REPLACE FUNCTION public.fulfill_tickle_trade(trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	trade        record;
	raw_count    int;
	last_inc     timestamptz;
	cap          int;
	regen_secs   int;
	current_bal  int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO trade FROM public.tickle_trades
		WHERE id = trade_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF trade.target_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_target');
	END IF;
	IF trade.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	-- Lock the user_items row and compute the regen-adjusted balance.
	-- Mirror the math in public.tickle_balance() exactly so the
	-- number we check against matches what the UI shows.
	SELECT item_count, last_increment INTO raw_count, last_inc
		FROM public.user_items WHERE user_id = caller_id FOR UPDATE;
	IF raw_count IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;

	SELECT CASE WHEN COALESCE(is_vip, false) THEN 50 ELSE 25 END INTO cap
		FROM public.profiles WHERE id = caller_id;
	regen_secs := public.regen_secs_for(caller_id);

	current_bal := GREATEST(
		raw_count,
		LEAST(
			cap,
			raw_count + GREATEST(0, FLOOR(
				EXTRACT(EPOCH FROM (now() - last_inc)) / regen_secs
			)::int)
		)
	);

	IF current_bal < trade.amount THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient_bank',
			'balance', current_bal, 'needed', trade.amount
		);
	END IF;

	-- Atomic update: bake regen catch-up into item_count, deduct
	-- the trade amount, reset last_increment so the next regen
	-- cycle starts from now. Single UPDATE so no other writer can
	-- interleave between read and write.
	UPDATE public.user_items
		SET item_count    = current_bal - trade.amount,
		    last_increment = now()
		WHERE user_id = caller_id;

	UPDATE public.profiles
		SET counter        = counter        + trade.amount * 2,
		    tickles_earned = tickles_earned + trade.amount * 2
		WHERE id = trade.requester_id;

	UPDATE public.tickle_trades
		SET status = 'fulfilled', fulfilled_at = now()
		WHERE id = trade.id;

	RETURN jsonb_build_object(
		'ok', true,
		'trade_id', trade.id,
		'new_bank', current_bal - trade.amount,
		'asker_gained', trade.amount * 2
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.fulfill_tickle_trade(uuid) TO authenticated;

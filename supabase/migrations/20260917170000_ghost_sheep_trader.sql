-- The Ghost Sheep Trader — a hooded wandering trader who turns up at the
-- hedge ONCE A DAY, for six hours, at an hour that is random per pig, and takes
-- finds out of the Satchel for tickles.
-- Founder ask 2026-09-17: "a wandering trader that pops up at random times as
-- an option in the bottom right hand menu … trade some of your materials for
-- tickles", then "the sheep visits once a day for 6 hours, random per user".
-- Supersedes the deferred Stranger's presence rule
-- (docs/design/2026-09-16-finds-swaps-and-the-stranger.md §3.4: appear when a
-- set completes) and its "three of a kind" — the shipped bag holds six.
--
-- Amends the 2026-09-14 "given, never sold" ruling the way the Stranger spec
-- proposed (§0): a find handed to the trader pays APPLIED tickles
-- (apply_tickles: tickles_earned + counter — the same score-not-bank number a
-- dig find has paid since 2026-09-13), never Snouts, never Golden Truffles,
-- never the bank. The find is CONSUMED — the only place a find leaves the world
-- for a number — so the ledger row is the audit trail.
--
-- What / why, section by section:
--   1. Tuning — app_settings.trader_tuning (merge, never clobber): how long he
--      stays, the local-time window his arrival is drawn from, the price per
--      rarity, the day's want multiplier, and the finds-per-visit cap.
--   2. trader_visits — ONE row per pig per LOCAL day (UNIQUE (user_id, day)).
--      The visit is a pure function of (pig, day): a seeded draw places the
--      arrival inside the window (in the pig's feeding time zone, the clock
--      the Truffle Patch already keeps) and the stay is fixed, so every device
--      sees one truth, a test can pin it, and no cron is needed — the row is
--      materialised lazily by the first read of that day. A day the pig never
--      looks in is simply missed: no carry-over, that is the wandering.
--   3. trader_sales — the ledger: which bag row went, for how many tickles,
--      under which nonce (the client's idempotency key: a replay answers the
--      ORIGINAL receipt and never takes a second find).
--   4. trader_status() — the read: is he here, until when, what he wants,
--      what each rarity pays, how many finds he still takes this visit; and
--      when he is NOT here, when he next arrives (today's, or tomorrow's once
--      today's has ended) so the yard can pop him up on the minute.
--   5. trade_with_trader(p_item_id, p_nonce) — the sale. Under an advisory
--      lock per pig: not_here · had_enough · not_in_bag, else the row is
--      deleted, the ledger written, the tickles applied and the tally
--      returned with the WHOLE bag (the swap's F2 rule: never trim by count).
--   5b. dev_summon_trader() — DEV ONLY (profiles.is_test, the dev_end_war_now
--      gate): starts a visit for the caller right now, replacing today's roll,
--      so the fan row and the sheet can be seen without waiting for the hour.
--   6. tickle_breakdown — carried VERBATIM from the LATEST def
--      (20260917100000_satchel_swaps.sql); the only change is a `trader`
--      lane and its place in the residual.
--   7. unlock_field_guide_page — carried from 20260917110000; adds 'trader'.
--
-- Every RPC is fail-closed and answers {ok:false, reason} rather than raising
-- (a raise inside a SECURITY DEFINER RPC is a silent rollback to the client).
-- The testable clock is _patch_now() (ttp.fake_now-aware, 20260721).
-- Tuned by tools/balance_trader.py (2026-09-17): a 6 h stay inside a 08–22
-- local window means a once-a-day pig catches him roughly every other day and
-- his payout saturates near 6 tickles/day whatever the prices (the dig faucet
-- is the supply).
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
UPDATE public.app_settings
SET value = '{"stay_hours": 6,
              "window": {"start_hour": 8, "end_hour": 22},
              "prices": {"common": 3, "uncommon": 8, "rare": 20},
              "want_multiplier": 2,
              "finds_per_visit": 6}'::jsonb || value,
    description = 'The Ghost Sheep Trader (20260917170000): hours he stays (one visit per pig per local day), the local-time window [start_hour, end_hour) his arrival is drawn from, tickles per find by rarity, the multiplier on the find he fancies, finds he takes per visit.'
WHERE key = 'trader_tuning';

INSERT INTO public.app_settings (key, value, description)
SELECT 'trader_tuning',
	'{"stay_hours": 6,
	  "window": {"start_hour": 8, "end_hour": 22},
	  "prices": {"common": 3, "uncommon": 8, "rare": 20},
	  "want_multiplier": 2,
	  "finds_per_visit": 6}'::jsonb,
	'The Ghost Sheep Trader (20260917170000): hours he stays (one visit per pig per local day), the local-time window [start_hour, end_hour) his arrival is drawn from, tickles per find by rarity, the multiplier on the find he fancies, finds he takes per visit.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'trader_tuning');

CREATE OR REPLACE FUNCTION public._trader_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'trader_tuning'),
		'{"stay_hours": 6, "window": {"start_hour": 8, "end_hour": 22},
		  "prices": {"common": 3, "uncommon": 8, "rare": 20},
		  "want_multiplier": 2, "finds_per_visit": 6}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._trader_tuning() FROM PUBLIC, anon, authenticated;

-- ── 2. The visits ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trader_visits (
	id            bigserial PRIMARY KEY,
	user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	-- The pig's LOCAL day the visit belongs to (one per day, seeded from it).
	day           date NOT NULL,
	arrives_at    timestamptz NOT NULL,
	leaves_at     timestamptz NOT NULL,
	want_find_id  text NOT NULL REFERENCES public.satchel_finds(id),
	sold          int NOT NULL DEFAULT 0 CHECK (sold >= 0),
	tickles       int NOT NULL DEFAULT 0 CHECK (tickles >= 0),
	-- A dev summon replaced the day's roll (audit only).
	summoned      boolean NOT NULL DEFAULT false,
	created_at    timestamptz NOT NULL DEFAULT now(),
	CHECK (leaves_at > arrives_at),
	UNIQUE (user_id, day)
);
CREATE INDEX IF NOT EXISTS trader_visits_user_idx ON public.trader_visits (user_id, arrives_at DESC);
ALTER TABLE public.trader_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trader_visits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.trader_visits_id_seq FROM PUBLIC, anon, authenticated;

-- ── 3. The ledger ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trader_sales (
	id          bigserial PRIMARY KEY,
	nonce       uuid NOT NULL UNIQUE,
	user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_id    bigint NOT NULL REFERENCES public.trader_visits(id) ON DELETE CASCADE,
	item_id     bigint NOT NULL,
	find_id     text NOT NULL REFERENCES public.satchel_finds(id),
	tickles     int NOT NULL CHECK (tickles >= 0),
	was_want    boolean NOT NULL DEFAULT false,
	created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trader_sales_user_idx ON public.trader_sales (user_id, created_at DESC);
ALTER TABLE public.trader_sales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trader_sales FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.trader_sales_id_seq FROM PUBLIC, anon, authenticated;

-- A unit draw in [0, 1) that is a pure function of its key — the seed every
-- per-(pig, day) decision shares, so a test can pin it and every device agrees.
CREATE OR REPLACE FUNCTION public._trader_unit(p_key text)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT (abs(('x' || substr(md5(p_key), 1, 8))::bit(32)::bigint) % 1000000)::numeric / 1000000;
$function$;
REVOKE ALL ON FUNCTION public._trader_unit(text) FROM PUBLIC, anon, authenticated;

-- The find he fancies on a given (pig, day) — seeded, weighted toward commons
-- so a bag can actually hold it, never the same as the day before.
CREATE OR REPLACE FUNCTION public._trader_want_for(p_user uuid, p_day date, p_not text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT f.id
	FROM public.satchel_finds f
	WHERE f.id IS DISTINCT FROM p_not
	ORDER BY public._trader_unit(p_user::text || ':' || p_day::text || ':' || f.id)
		* (CASE f.rarity WHEN 'common' THEN 70 WHEN 'uncommon' THEN 25 ELSE 5 END) DESC,
		f.sort
	LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public._trader_want_for(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- The visit for one (pig, local day), computed — never stored here. Arrival is
-- a seeded hour inside [start_hour, end_hour - stay] of that day IN THE PIG'S
-- FEEDING TIME ZONE (the clock the Truffle Patch keeps; ET when unset); the
-- stay is fixed. A window too narrow for the stay collapses to start_hour.
CREATE OR REPLACE FUNCTION public._trader_visit_for(p_user uuid, p_day date, p_zone text)
RETURNS TABLE (arrives_at timestamptz, leaves_at timestamptz, want_find_id text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._trader_tuning();
	stay numeric := LEAST(GREATEST(COALESCE((t->>'stay_hours')::numeric, 6), 0.25), 24);
	win_start numeric := LEAST(GREATEST(COALESCE((t->'window'->>'start_hour')::numeric, 8), 0), 24);
	win_end numeric := LEAST(GREATEST(COALESCE((t->'window'->>'end_hour')::numeric, 22), 0), 24);
	span numeric;
	at_hour numeric;
	local_arrival timestamp;
BEGIN
	span := GREATEST(0, win_end - stay - win_start);
	at_hour := win_start + span * public._trader_unit(p_user::text || ':' || p_day::text || ':arrival');
	local_arrival := p_day::timestamp + make_interval(mins => FLOOR(at_hour * 60)::int);
	arrives_at := local_arrival AT TIME ZONE p_zone;
	leaves_at := arrives_at + make_interval(mins => FLOOR(stay * 60)::int);
	want_find_id := public._trader_want_for(p_user, p_day,
		public._trader_want_for(p_user, p_day - 1, NULL));
	RETURN NEXT;
END;
$function$;
REVOKE ALL ON FUNCTION public._trader_visit_for(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- Materialise one (pig, day) row from the computed visit; idempotent.
CREATE OR REPLACE FUNCTION public._trader_materialise(p_user uuid, p_day date, p_zone text)
RETURNS public.trader_visits LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v public.trader_visits%ROWTYPE;
	c record;
BEGIN
	SELECT * INTO v FROM public.trader_visits WHERE user_id = p_user AND day = p_day;
	IF FOUND THEN RETURN v; END IF;
	SELECT * INTO c FROM public._trader_visit_for(p_user, p_day, p_zone);
	INSERT INTO public.trader_visits (user_id, day, arrives_at, leaves_at, want_find_id)
		VALUES (p_user, p_day, c.arrives_at, c.leaves_at, c.want_find_id)
		ON CONFLICT (user_id, day) DO NOTHING;
	SELECT * INTO v FROM public.trader_visits WHERE user_id = p_user AND day = p_day;
	RETURN v;
END;
$function$;
REVOKE ALL ON FUNCTION public._trader_materialise(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- The pig's current-or-next visit: today's (in the pig's zone) while it has
-- not ended, else tomorrow's. Callers hold the pig's advisory lock.
CREATE OR REPLACE FUNCTION public._trader_ensure_visit(p_user uuid)
RETURNS public.trader_visits LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v_now timestamptz := public._patch_now();
	zone text := public._feeding_zone_at(p_user, v_now);
	today date := (v_now AT TIME ZONE zone)::date;
	v public.trader_visits%ROWTYPE;
BEGIN
	v := public._trader_materialise(p_user, today, zone);
	IF v.leaves_at > v_now THEN
		RETURN v;
	END IF;
	RETURN public._trader_materialise(p_user, today + 1, zone);
END;
$function$;
REVOKE ALL ON FUNCTION public._trader_ensure_visit(uuid) FROM PUBLIC, anon, authenticated;

-- The prices, as the client parses them.
CREATE OR REPLACE FUNCTION public._trader_prices_json(t jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT jsonb_build_object(
		'common',   GREATEST(0, COALESCE((t->'prices'->>'common')::int, 3)),
		'uncommon', GREATEST(0, COALESCE((t->'prices'->>'uncommon')::int, 8)),
		'rare',     GREATEST(0, COALESCE((t->'prices'->>'rare')::int, 20)));
$function$;
REVOKE ALL ON FUNCTION public._trader_prices_json(jsonb) FROM PUBLIC, anon, authenticated;

-- The status payload for one pig (the read RPC and the dev summon share it).
CREATE OR REPLACE FUNCTION public._trader_status_json(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 6));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	v public.trader_visits%ROWTYPE;
	present boolean;
	sales int;
BEGIN
	v := public._trader_ensure_visit(p_user);
	present := v.arrives_at <= v_now AND v.leaves_at > v_now;
	SELECT COUNT(*)::int INTO sales FROM public.trader_sales s WHERE s.user_id = p_user;
	RETURN jsonb_build_object(
		'ok', true,
		'present', present,
		'now', v_now,
		'visit', jsonb_build_object(
			'id', v.id,
			'day', v.day,
			'arrives_at', v.arrives_at,
			'leaves_at', v.leaves_at,
			-- What he fancies is his to say: only once he is here.
			'want_find_id', CASE WHEN present THEN v.want_find_id ELSE NULL END,
			'sold', v.sold,
			'tickles', v.tickles,
			'finds_left', GREATEST(0, per_visit - v.sold)),
		'prices', public._trader_prices_json(t),
		'want_multiplier', mult,
		'finds_per_visit', per_visit,
		'met', sales > 0,
		'sales', sales);
END;
$function$;
REVOKE ALL ON FUNCTION public._trader_status_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── 4. trader_status ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trader_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);
	RETURN public._trader_status_json(uid);
END;
$function$;
REVOKE ALL ON FUNCTION public.trader_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trader_status() TO authenticated;

-- ── 5. trade_with_trader ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trade_with_trader(p_item_id bigint, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 6));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	prices jsonb := public._trader_prices_json(t);
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	rarity text;
	was_want boolean;
	price int;
	before_count int;
	after_count int;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay: the original receipt, never a second find.
	SELECT * INTO prior FROM public.trader_sales WHERE nonce = p_nonce;
	IF FOUND THEN
		IF prior.user_id <> uid THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
		END IF;
		SELECT * INTO v FROM public.trader_visits WHERE id = prior.visit_id;
		SELECT COALESCE(tickles_earned, 0) INTO after_count FROM public.profiles WHERE id = uid;
		RETURN jsonb_build_object(
			'ok', true,
			'replay', true,
			'find_id', prior.find_id,
			'tickles', prior.tickles,
			'was_want', prior.was_want,
			'before', GREATEST(0, COALESCE(after_count, 0) - prior.tickles),
			'after', COALESCE(after_count, 0),
			'finds_left', GREATEST(0, per_visit - COALESCE(v.sold, per_visit)),
			'visit_tickles', COALESCE(v.tickles, 0),
			'bag', public._satchel_bag_json(uid));
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);

	-- 1. He has to be here.
	v := public._trader_ensure_visit(uid);
	IF NOT (v.arrives_at <= v_now AND v.leaves_at > v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_here',
			'arrives_at', CASE WHEN v.arrives_at > v_now THEN v.arrives_at ELSE NULL END);
	END IF;
	SELECT * INTO v FROM public.trader_visits WHERE id = v.id FOR UPDATE;

	-- 2. He only takes so many a visit.
	IF v.sold >= per_visit THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'had_enough', 'leaves_at', v.leaves_at);
	END IF;

	-- 3. The find, locked, from THIS bag.
	SELECT * INTO item FROM public.satchel_items
		WHERE id = p_item_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_bag',
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 4. The price: by rarity, doubled for the find he fancies.
	SELECT f.rarity INTO rarity FROM public.satchel_finds f WHERE f.id = item.find_id;
	price := GREATEST(0, COALESCE((prices->>COALESCE(rarity, 'common'))::int, 0));
	was_want := item.find_id = v.want_find_id;
	IF was_want THEN
		price := FLOOR(price * mult)::int;
	END IF;

	-- 5. The find leaves the world; the ledger remembers; the tickles land.
	SELECT COALESCE(tickles_earned, 0) INTO before_count FROM public.profiles WHERE id = uid;
	DELETE FROM public.satchel_items WHERE id = item.id;
	INSERT INTO public.trader_sales (nonce, user_id, visit_id, item_id, find_id, tickles, was_want)
		VALUES (p_nonce, uid, v.id, item.id, item.find_id, price, was_want);
	UPDATE public.trader_visits SET sold = sold + 1, tickles = tickles + price WHERE id = v.id
		RETURNING * INTO v;
	after_count := public.apply_tickles(uid, price);

	RETURN jsonb_build_object(
		'ok', true,
		'replay', false,
		'find_id', item.find_id,
		'tickles', price,
		'was_want', was_want,
		'before', COALESCE(before_count, 0),
		'after', COALESCE(after_count, 0),
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;
REVOKE ALL ON FUNCTION public.trade_with_trader(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_with_trader(bigint, uuid) TO authenticated;

-- ── 5b. dev_summon_trader — DEV ONLY ─────────────────────────────────────────
-- Gated on profiles.is_test (dev_end_war_now's gate): a normal player gets
-- admin_only. Starts a fresh visit for the caller right now — today's row is
-- rewritten (arrives now, leaves after the tuned stay, count reset, marked
-- `summoned`) and the status answered, so the fan row and the sheet can be
-- seen without waiting for the day's hour.
CREATE OR REPLACE FUNCTION public.dev_summon_trader()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	caller_is_test boolean;
	t jsonb := public._trader_tuning();
	stay numeric := LEAST(GREATEST(COALESCE((t->>'stay_hours')::numeric, 6), 0.25), 24);
	v_now timestamptz := public._patch_now();
	zone text;
	today date;
	yesterday_want text;
BEGIN
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = uid;
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);
	zone := public._feeding_zone_at(uid, v_now);
	today := (v_now AT TIME ZONE zone)::date;
	yesterday_want := public._trader_want_for(uid, today - 1, NULL);
	INSERT INTO public.trader_visits (user_id, day, arrives_at, leaves_at, want_find_id, summoned)
		VALUES (uid, today, v_now, v_now + make_interval(mins => FLOOR(stay * 60)::int),
		        public._trader_want_for(uid, today, yesterday_want), true)
		ON CONFLICT (user_id, day) DO UPDATE
			SET arrives_at = EXCLUDED.arrives_at,
			    leaves_at = EXCLUDED.leaves_at,
			    sold = 0, tickles = 0, summoned = true;
	-- A materialised tomorrow (today's had ended) would shadow nothing — the
	-- read prefers today's row while it has not ended — but drop it so the
	-- yard's next-edge timer aims at this visit's leaving, not tomorrow's arrival.
	DELETE FROM public.trader_visits WHERE user_id = uid AND day = today + 1 AND sold = 0;
	RETURN public._trader_status_json(uid);
END;
$function$;
REVOKE ALL ON FUNCTION public.dev_summon_trader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_summon_trader() TO authenticated;

-- ── 6. The glass box gets its trader lane ────────────────────────────────────
-- Carried VERBATIM from the LATEST definition, 20260917100000_satchel_swaps.sql
-- (the carry-latest-def footgun). The ONLY change is the `trader` lane and
-- its place in the residual.
CREATE OR REPLACE FUNCTION public.tickle_breakdown(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_boundary timestamptz;
	v_total bigint;
	v_ads bigint;
	v_visit bigint;
	v_dig bigint;
	v_pass bigint;
	v_trades bigint;
	v_lucky bigint;
	v_swaps bigint;
	v_trader bigint;
	v_home bigint;
BEGIN
	SELECT starts_at INTO v_boundary FROM public.active_season();
	SELECT COALESCE(tickles_earned, 0) INTO v_total
		FROM public.profiles WHERE id = p_user;
	v_total := COALESCE(v_total, 0);

	IF v_boundary IS NULL THEN
		RETURN jsonb_build_object(
			'total', v_total, 'boundary', NULL,
			'home_taps', v_total, 'ads', 0, 'visit_taps', 0, 'dig_finds', 0,
			'pass_tiers', 0, 'trades', 0, 'lucky', 0, 'swaps', 0, 'trader', 0);
	END IF;

	SELECT count(*) INTO v_ads FROM public.rewarded_ad_consumptions
		WHERE user_id = p_user AND consumed_at > v_boundary;
	SELECT count(*) INTO v_visit FROM public.barn_visits
		WHERE visitor_id = p_user AND created_at > v_boundary;
	SELECT count(*) * 5 INTO v_dig FROM public.truffle_digs
		WHERE digger_id = p_user AND dug_at > v_boundary;
	SELECT COALESCE(SUM(COALESCE(
			(st.reward_value->>'amount')::int,
			(st.reward_value->>'tickles')::int, 0)), 0)
		INTO v_pass
		FROM public.user_tier_claims utc
		JOIN public.season_tiers st
			ON st.season_id = utc.season_id
			AND st.tier = utc.tier
			AND st.track = utc.track
		WHERE utc.user_id = p_user
			AND utc.claimed_at > v_boundary
			AND st.reward_type IN ('tickles', 'tickle');
	SELECT COALESCE(SUM(amount * 2), 0) INTO v_trades
		FROM public.tickle_trades
		WHERE requester_id = p_user AND fulfilled_at > v_boundary;
	SELECT count(*) * 5 INTO v_lucky FROM public.daily_lucky_claims
		WHERE user_id = p_user AND claimed_at > v_boundary;
	-- The Satchel's hand-offs pay both sides the same flat amount; the row
	-- records what was actually paid (0 once a daily cap is spent).
	SELECT COALESCE(SUM(tickles), 0) INTO v_swaps
		FROM public.satchel_swaps
		WHERE (giver_id = p_user OR host_id = p_user) AND created_at > v_boundary;
	-- The trader's ledger records exactly what each find paid.
	SELECT COALESCE(SUM(tickles), 0) INTO v_trader
		FROM public.trader_sales
		WHERE user_id = p_user AND created_at > v_boundary;

	v_home := GREATEST(
		0,
		v_total - (v_ads + v_visit + v_dig + v_pass + v_trades + v_lucky + v_swaps + v_trader)
	);
	RETURN jsonb_build_object(
		'total', v_total,
		'boundary', v_boundary,
		'home_taps', v_home,
		'ads', v_ads,
		'visit_taps', v_visit,
		'dig_finds', v_dig,
		'pass_tiers', v_pass,
		'trades', v_trades,
		'lucky', v_lucky,
		'swaps', v_swaps,
		'trader', v_trader);
END;
$function$;
REVOKE ALL ON FUNCTION public.tickle_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickle_breakdown(uuid) TO authenticated;

-- ── 7. The Field Guide learns the trader ─────────────────────────────────────
-- Carried from the LATEST definition (20260917110000_field_guide_satchel_page.sql);
-- the only change is the one id.
CREATE OR REPLACE FUNCTION public.unlock_field_guide_page(p_page text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN; -- unauthenticated: silent no-op
	END IF;
	IF p_page NOT IN (
		'truffle', 'golden_truffle', 'lucky_number', 'trough',
		'mud_wrap', 'rituals', 'snouts', 'exchange', 'feeding_windows',
		'satchel', 'trader'
	) THEN
		RAISE EXCEPTION 'unknown field guide page: %', p_page
			USING ERRCODE = 'check_violation';
	END IF;
	INSERT INTO public.field_guide_pages (user_id, page_id)
		VALUES (auth.uid(), p_page)
		ON CONFLICT (user_id, page_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.unlock_field_guide_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_field_guide_page(text) TO authenticated;

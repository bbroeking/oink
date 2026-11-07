-- Stand-alone prep for C4_market_sets_sheep_smoke.sql: the Ghost Sheep's
-- tables and the trader helpers 20261107120000 calls but does not carry,
-- verbatim from their latest migrations, on top of 00x_market_prep.sql and
-- the four market migrations (see that file's header). The functions
-- 20261107120000 replaces (_satchel_bag_json, _trader_want_for,
-- _trader_status_json, trade_with_trader, trade_up_with_trader) are loaded
-- here at their pre-migration defs, so the smoke can read "before" too:
--
--   createdb market && psql -d market -v ON_ERROR_STOP=1 \
--     -f scripts/db-harness/00x_market_prep.sql \
--     -f supabase/migrations/20261031100000_bullions_market.sql \
--     -f supabase/migrations/20261031110000_market_followups.sql \
--     -f supabase/migrations/20261101150000_bullion_board.sql \
--     -f supabase/migrations/20261102200000_market_launch_fixes.sql \
--     -f scripts/db-harness/00x2_market_trader_prep.sql \
--     -f scripts/db-harness/C4_market_sets_sheep_before.sql \
--     -f supabase/migrations/20261107120000_market_sets_and_sheep_found_double.sql \
--     -f scripts/db-harness/C4_market_sets_sheep_smoke.sql
--
-- The pig's feeding zone is stubbed to America/New_York (the trader's
-- default clock); trader_tuning is 00x_market_prep's prices-only row, so
-- every other knob is the functions' compiled default (x2, pairs x1.5, nine a
-- visit, trade-ups of three, a 6 h stay inside 08:00-22:00).
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public._feeding_zone_at(p_user uuid, p_at timestamptz)
RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'America/New_York'::text $$;

CREATE TABLE IF NOT EXISTS public.trader_visits (
	id            bigserial PRIMARY KEY,
	user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	day           date NOT NULL,
	arrives_at    timestamptz NOT NULL,
	leaves_at     timestamptz NOT NULL,
	want_find_id  text NOT NULL REFERENCES public.satchel_finds(id),
	sold          int NOT NULL DEFAULT 0 CHECK (sold >= 0),
	tickles       int NOT NULL DEFAULT 0 CHECK (tickles >= 0),
	summoned      boolean NOT NULL DEFAULT false,
	created_at    timestamptz NOT NULL DEFAULT now(),
	CHECK (leaves_at > arrives_at),
	UNIQUE (user_id, day)
);
CREATE TABLE IF NOT EXISTS public.trader_sales (
	id          bigserial PRIMARY KEY,
	nonce       uuid NOT NULL UNIQUE,
	user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_id    bigint NOT NULL REFERENCES public.trader_visits(id) ON DELETE CASCADE,
	item_id     bigint NOT NULL,
	find_id     text NOT NULL REFERENCES public.satchel_finds(id),
	tickles     int NOT NULL CHECK (tickles >= 0),
	was_want    boolean NOT NULL DEFAULT false,
	created_at  timestamptz NOT NULL DEFAULT now(),
	kind        text NOT NULL DEFAULT 'sale' CHECK (kind IN ('sale', 'trade_up')),
	pair_bonus  int NOT NULL DEFAULT 0,
	item_ids    bigint[],
	got_find_id text REFERENCES public.satchel_finds(id),
	got_item_id bigint,
	new_to_bag  boolean NOT NULL DEFAULT false,
	CHECK (pair_bonus >= 0 AND pair_bonus <= tickles)
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tickles_earned int NOT NULL DEFAULT 0;

-- 20260917170000_ghost_sheep_trader.sql
CREATE OR REPLACE FUNCTION public._trader_unit(p_key text)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT (abs(('x' || substr(md5(p_key), 1, 8))::bit(32)::bigint) % 1000000)::numeric / 1000000;
$function$;

-- 20260917170000_ghost_sheep_trader.sql
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

-- 20260917170000_ghost_sheep_trader.sql
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

-- 20260917170000_ghost_sheep_trader.sql
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

-- 20260917170000_ghost_sheep_trader.sql
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

-- 20260917170000_ghost_sheep_trader.sql
CREATE OR REPLACE FUNCTION public._trader_prices_json(t jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT jsonb_build_object(
		'common',   GREATEST(0, COALESCE((t->'prices'->>'common')::int, 3)),
		'uncommon', GREATEST(0, COALESCE((t->'prices'->>'uncommon')::int, 8)),
		'rare',     GREATEST(0, COALESCE((t->'prices'->>'rare')::int, 20)));
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public._trader_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'trader_tuning'),
		'{"stay_hours": 6, "window": {"start_hour": 8, "end_hour": 22},
		  "prices": {"common": 3, "uncommon": 8, "rare": 20},
		  "want_multiplier": 2, "finds_per_visit": 9,
		  "pair_multiplier": 1.5, "trade_up": true, "trade_up_count": 3}'::jsonb);
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public._trader_trade_up_pick(p_user uuid, p_day date, p_rarity text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT f.id
	FROM public.satchel_finds f
	WHERE f.rarity = p_rarity
	ORDER BY public._trader_unit(p_user::text || ':' || p_day::text || ':up:' || f.id), f.sort
	LIMIT 1;
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public._trader_next_rarity(p_rarity text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE p_rarity WHEN 'common' THEN 'uncommon' WHEN 'uncommon' THEN 'rare' ELSE NULL END;
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public._trader_status_json(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	pair_mult numeric := GREATEST(1, COALESCE((t->>'pair_multiplier')::numeric, 1.5));
	up_on boolean := COALESCE((t->>'trade_up')::boolean, true);
	up_count int := GREATEST(2, COALESCE((t->>'trade_up_count')::int, 3));
	v public.trader_visits%ROWTYPE;
	present boolean;
	sales int;
	unpaired jsonb := '[]'::jsonb;
	ups jsonb := '{}'::jsonb;
BEGIN
	v := public._trader_ensure_visit(p_user);
	present := v.arrives_at <= v_now AND v.leaves_at > v_now;
	SELECT COUNT(*)::int INTO sales FROM public.trader_sales s WHERE s.user_id = p_user;
	IF present THEN
		-- Finds sold an odd number of times this visit: the next one makes a pair.
		SELECT COALESCE(jsonb_agg(x.find_id ORDER BY x.find_id), '[]'::jsonb) INTO unpaired
		FROM (
			SELECT s.find_id FROM public.trader_sales s
			WHERE s.visit_id = v.id AND s.kind = 'sale'
			GROUP BY s.find_id HAVING COUNT(*) % 2 = 1
		) x;
		IF up_on THEN
			ups := jsonb_strip_nulls(jsonb_build_object(
				'common', public._trader_trade_up_pick(p_user, v.day, 'uncommon'),
				'uncommon', public._trader_trade_up_pick(p_user, v.day, 'rare')));
		END IF;
	END IF;
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
			'finds_left', GREATEST(0, per_visit - v.sold),
			'unpaired', unpaired,
			'trade_ups', ups),
		'prices', public._trader_prices_json(t),
		'want_multiplier', mult,
		'finds_per_visit', per_visit,
		'pair_multiplier', pair_mult,
		'trade_up', up_on,
		'trade_up_count', up_count,
		'met', sales > 0,
		'sales', sales);
END;
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public.trade_with_trader(p_item_id bigint, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	mult numeric := GREATEST(1, COALESCE((t->>'want_multiplier')::numeric, 2));
	pair_mult numeric := GREATEST(1, COALESCE((t->>'pair_multiplier')::numeric, 1.5));
	prices jsonb := public._trader_prices_json(t);
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	rarity text;
	was_want boolean;
	price int;
	bonus int := 0;
	prior_n int;
	prior_base int;
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
		IF prior.user_id <> uid OR prior.kind <> 'sale' THEN
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
			'pair', prior.pair_bonus > 0,
			'pair_bonus', prior.pair_bonus,
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

	-- 4b. The pair (20261029210000): one sale of this find already sits
	-- unpaired in this visit's ledger, so this one completes a pair and the
	-- two together pay half again. The unpaired sale is the latest of them
	-- (an odd count means the last one opened a pair); its base price is what
	-- it paid less any bonus it carried.
	IF pair_mult > 1 THEN
		SELECT COUNT(*)::int,
		       (array_agg(s.tickles - s.pair_bonus ORDER BY s.id DESC))[1]
			INTO prior_n, prior_base
			FROM public.trader_sales s
			WHERE s.visit_id = v.id AND s.kind = 'sale' AND s.find_id = item.find_id;
		IF COALESCE(prior_n, 0) % 2 = 1 THEN
			bonus := GREATEST(0, FLOOR((COALESCE(prior_base, 0) + price) * (pair_mult - 1))::int);
		END IF;
	END IF;
	price := price + bonus;

	-- 5. The find leaves the world; the ledger remembers; the tickles land.
	SELECT COALESCE(tickles_earned, 0) INTO before_count FROM public.profiles WHERE id = uid;
	DELETE FROM public.satchel_items WHERE id = item.id;
	INSERT INTO public.trader_sales (nonce, user_id, visit_id, item_id, find_id, tickles, was_want, kind, pair_bonus)
		VALUES (p_nonce, uid, v.id, item.id, item.find_id, price, was_want, 'sale', bonus);
	UPDATE public.trader_visits SET sold = sold + 1, tickles = tickles + price WHERE id = v.id
		RETURNING * INTO v;
	-- Tickles, never Snouts (20260920100000): apply_tickles() is the "applied
	-- tickle" — a count AND a snout, the tap's own rule — and the trader is not
	-- a tap. He pays the count alone; the bank and the snouts stay untouched.
	UPDATE public.profiles
	SET tickles_earned = COALESCE(tickles_earned, 0) + price
	WHERE id = uid
	RETURNING tickles_earned INTO after_count;

	RETURN jsonb_build_object(
		'ok', true,
		'replay', false,
		'find_id', item.find_id,
		'tickles', price,
		'was_want', was_want,
		'pair', bonus > 0,
		'pair_bonus', bonus,
		'before', COALESCE(before_count, 0),
		'after', COALESCE(after_count, 0),
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;

-- 20261029210000_trader_sets_and_trade_ups.sql
CREATE OR REPLACE FUNCTION public.trade_up_with_trader(p_find_id text, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._trader_tuning();
	v_now timestamptz := public._patch_now();
	per_visit int := GREATEST(0, COALESCE((t->>'finds_per_visit')::int, 9));
	up_on boolean := COALESCE((t->>'trade_up')::boolean, true);
	up_count int := GREATEST(2, COALESCE((t->>'trade_up_count')::int, 3));
	prior public.trader_sales%ROWTYPE;
	v public.trader_visits%ROWTYPE;
	from_rarity text;
	to_rarity text;
	pick text;
	taken bigint[];
	got_id bigint;
	is_new boolean;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay: the original receipt, never a second hand.
	SELECT * INTO prior FROM public.trader_sales WHERE nonce = p_nonce;
	IF FOUND THEN
		IF prior.user_id <> uid OR prior.kind <> 'trade_up' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
		END IF;
		SELECT * INTO v FROM public.trader_visits WHERE id = prior.visit_id;
		RETURN jsonb_build_object(
			'ok', true,
			'replay', true,
			'gave_find_id', prior.find_id,
			'count', COALESCE(array_length(prior.item_ids, 1), up_count),
			'got_find_id', prior.got_find_id,
			'got_item_id', prior.got_item_id,
			'new_to_bag', prior.new_to_bag,
			'finds_left', GREATEST(0, per_visit - COALESCE(v.sold, per_visit)),
			'visit_tickles', COALESCE(v.tickles, 0),
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 1. Is there anything above it (and is he trading up at all)?
	SELECT f.rarity INTO from_rarity FROM public.satchel_finds f WHERE f.id = p_find_id;
	to_rarity := public._trader_next_rarity(from_rarity);
	IF NOT up_on OR from_rarity IS NULL OR to_rarity IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_trade_up');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('trader:' || uid::text)::bigint);

	-- 2. He has to be here.
	v := public._trader_ensure_visit(uid);
	IF NOT (v.arrives_at <= v_now AND v.leaves_at > v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_here',
			'arrives_at', CASE WHEN v.arrives_at > v_now THEN v.arrives_at ELSE NULL END);
	END IF;
	SELECT * INTO v FROM public.trader_visits WHERE id = v.id FOR UPDATE;

	-- 3. The three count against what he takes this visit.
	IF v.sold + up_count > per_visit THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'had_enough', 'leaves_at', v.leaves_at,
			'finds_left', GREATEST(0, per_visit - v.sold));
	END IF;

	-- 4. Three of that find, locked, from THIS bag. Dug ones go first, so a
	-- friend's gift is the last thing a trade-up spends.
	taken := ARRAY(
		SELECT s.id
		FROM public.satchel_items s
		WHERE s.user_id = uid AND s.find_id = p_find_id
		ORDER BY (s.source IN ('swap', 'gift', 'migrated_shelf')), s.created_at, s.id
		LIMIT up_count
		FOR UPDATE);
	IF COALESCE(array_length(taken, 1), 0) < up_count THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_enough',
			'bag', public._satchel_bag_json(uid));
	END IF;

	-- 5. His pick of the next rarity, seeded for the day.
	pick := public._trader_trade_up_pick(uid, v.day, to_rarity);
	IF pick IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_trade_up');
	END IF;

	-- 6. Three go into his satchel; one comes back. No tickles move.
	is_new := NOT EXISTS (
		SELECT 1 FROM public.satchel_items s WHERE s.user_id = uid AND s.find_id = pick);
	DELETE FROM public.satchel_items WHERE id = ANY (taken);
	INSERT INTO public.satchel_items (user_id, find_id, source, created_at)
		VALUES (uid, pick, 'trader', v_now)
		RETURNING id INTO got_id;
	INSERT INTO public.satchel_met (user_id, find_id)
		VALUES (uid, pick) ON CONFLICT DO NOTHING;
	INSERT INTO public.trader_sales
		(nonce, user_id, visit_id, item_id, find_id, tickles, was_want, kind,
		 item_ids, got_find_id, got_item_id, new_to_bag)
		VALUES (p_nonce, uid, v.id, taken[1], p_find_id, 0, false, 'trade_up',
		        taken, pick, got_id, is_new);
	UPDATE public.trader_visits SET sold = sold + up_count WHERE id = v.id
		RETURNING * INTO v;

	RETURN jsonb_build_object(
		'ok', true,
		'replay', false,
		'gave_find_id', p_find_id,
		'count', up_count,
		'got_find_id', pick,
		'got_item_id', got_id,
		'new_to_bag', is_new,
		'finds_left', GREATEST(0, per_visit - v.sold),
		'visit_tickles', v.tickles,
		'bag', public._satchel_bag_json(uid));
END;
$function$;

-- 20260917100000_satchel_swaps.sql
CREATE OR REPLACE FUNCTION public._satchel_bag_json(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((
		SELECT jsonb_agg(jsonb_build_object('id', s.id, 'find_id', s.find_id, 'source', s.source)
		                 ORDER BY s.created_at, s.id)
		FROM public.satchel_items s WHERE s.user_id = p_user), '[]'::jsonb);
$function$;

-- 20260917170000_ghost_sheep_trader.sql
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

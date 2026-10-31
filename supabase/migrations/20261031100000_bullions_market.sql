-- Bullion's Market: one price, two ways to trade (2026-10-31).
--
-- Design: the round-4 playable prototype "Bullion's Market"
-- (https://claude.ai/artifact/P1zcYweBHJbd4XYJtUi9dA, engine.js), spec
-- docs/design/market-2026-10-31/bullions-market.md. SKILL.md decision
-- 2026-10-31 "Bullion's Market".
--
-- One sentence: every find has ONE price per set; Bullion the bull always
-- buys and sells a set at a cut around it (Part 1, the Counter), and pigs
-- trade sets with each other on the Noticeboard at their own price, or swap
-- them straight up (Part 2).
--
-- The rules, verbatim from the prototype (TUNING lives in
-- app_settings.market_tuning; the per-find base price is the Ghost Sheep's,
-- read from trader_tuning, so the two can never drift apart):
--   * U, the usual price of a set = the Sheep's price for one find x the set
--     size (four of a common, three of anything else). P, the price, is a
--     float kept in [0.85 U, 1.15 U].
--   * Bullion SELLS at max(U + 1, ceil(1.2 P)) and BUYS at
--     min(U, floor(0.8 P)). Each set bought at the counter pushes P up 3% of
--     U; each set sold pulls it down 3%.
--   * Every tick (30 minutes) the townsfolk wiggle P by up to 1% of U and it
--     drifts 5% of the way home. The wiggle is a pure function of
--     (find, tick) (md5-seeded), so the price walk is reproducible and is
--     materialised LAZILY by the first read or write after a tick (no cron:
--     the trader idiom). A long-quiet market catches up over at most the last
--     three days of ticks (0.95^144 ~ 0.0006: the start no longer matters).
--     A townsfolk "print" on the tape is one of those small trades.
--   * Noticeboard: For sale (the set leaves the bag while pinned), Wanted (not
--     set aside: the tickles must be ready for all your wanted ads when you
--     post, and the ad lapses if a seller comes and they are not), and
--     Straight-up swaps (a set for 1..set-size of one other find; no tickles,
--     the price stays put). To everyone or to ONE friend. A pig sale moves P a
--     third of the way to what was paid. Up to 4 listings up, 30 posts a day,
--     24 hours each.
--   * The counter keeps the board honest: a listing at or under Bullion's
--     buying price sells to him at once (at HIS price); a wanted ad at or over
--     his selling price buys from him at once (at his price). A new sell
--     listing takes the better of the best wanted ad it meets and the counter
--     (a tie goes to the pig); likewise a new wanted ad.
--   * Counter caps per pig per day are a valve (null = off, the default).
--
-- The currency is the TICKLE BANK (user_items.item_count, "tickles ready"):
-- buying spends it (settle_tickles first, the canonical regen checkpoint),
-- selling grants into it through grant_tickles, which may bank past the cap
-- ("sales may bank past it"). Never snouts, never the earned count. Finds are
-- satchel_items rows: a set sold leaves the world (Bullion) or moves bags (a
-- pig); a set bought from Bullion is minted (source 'market'). Each bag row
-- learns a cost basis (`market_cost`, null = dug up/given/swapped) so the
-- receipts can say "paid 13 · sold for 14 · up 1".
--
-- Shape:
--   1. market_tuning + satchel_items.market_cost + source 'market'.
--   2. Tables (RLS on, no policies: every read/write is an RPC below):
--      market_prices · market_price_points · market_offers · market_trades ·
--      market_ledgers · market_notices · market_requests (nonce replays).
--   3. Pure helpers: tick, set size, usual, ask, bid, clamp, seeded unit.
--   4. Bag + bank helpers: take units (newest first, so a set just bought is
--      the set sold next), give units, spend, pay.
--   5. Settlement: counter sell / counter buy / pig sale, each recording the
--      trade, the move, the ledgers and the poster's notice.
--   6. _market_advance(): the lazy tick (price walk + prints), expiry (a set
--      on offer comes home), and the counter crossing resting listings.
--   7. RPCs: market_state · market_find · market_counter · market_post ·
--      market_take · market_cancel. Fail-closed {ok:false, reason}, never a
--      raise; writes idempotent on a nonce.
--
-- Concurrency: every market write takes ONE transaction-scoped advisory lock
-- ('market'). Trades are low-volume and touch shared prices, crossing and two
-- bags at once; serialising them is the simplest deadlock-free order. Reads
-- take it only when a tick is due (or a listing has expired).
--
-- Privacy: other pigs are "a pig" (null name) on the board and the tape
-- unless they are your friend; a listing sent to one friend is visible only
-- to that friend; blocked pairs never see each other's listings.
--
-- Testable clock: _patch_now() (ttp.fake_now-aware). Validated on a stubbed
-- local Postgres: scripts/db-harness/C1_bullions_market_smoke.sql.
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning and the bag's cost basis ───────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'market_tuning',
	'{"enabled": true,
	  "set_size": {"common": 4, "uncommon": 3, "rare": 3},
	  "list_multiple": 3,
	  "open_offers": 4,
	  "daily_posts": 30,
	  "offer_hours": 24,
	  "tick_minutes": 30,
	  "catch_up_ticks": 144,
	  "price": {"lo": 0.85, "hi": 1.15, "sell_factor": 1.2, "buy_factor": 0.8,
	            "impact": 0.03, "pig_pull": 0.3333333333, "wiggle": 0.01, "home": 0.05},
	  "print_chance": {"common": 0.2, "uncommon": 0.1, "rare": 0.03},
	  "counter_caps": null}'::jsonb,
	'Bullion''s Market (20261031100000): set sizes by rarity, a listing''s price band (1..list_multiple x the usual price), listings up at a time, posts a day, listing hours, the tick, catch-up ticks, the price rules (band, Bullion''s cut, impact per counter set, pig pull, wiggle, drift home), the townsfolk print chance per tick, and per-pig daily counter caps ({sell, buy} or null = off). The per-find base price is trader_tuning.prices.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'market_tuning');

CREATE OR REPLACE FUNCTION public._market_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT '{"enabled": true,
	         "set_size": {"common": 4, "uncommon": 3, "rare": 3},
	         "list_multiple": 3, "open_offers": 4, "daily_posts": 30,
	         "offer_hours": 24, "tick_minutes": 30, "catch_up_ticks": 144,
	         "price": {"lo": 0.85, "hi": 1.15, "sell_factor": 1.2, "buy_factor": 0.8,
	                   "impact": 0.03, "pig_pull": 0.3333333333, "wiggle": 0.01, "home": 0.05},
	         "print_chance": {"common": 0.2, "uncommon": 0.1, "rare": 0.03},
	         "counter_caps": null}'::jsonb
		|| COALESCE((SELECT value FROM public.app_settings WHERE key = 'market_tuning'), '{}'::jsonb)
		|| jsonb_build_object('base', COALESCE(
			(SELECT value->'prices' FROM public.app_settings WHERE key = 'trader_tuning'),
			'{"common": 3, "uncommon": 8, "rare": 20}'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public._market_tuning() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.satchel_items
	ADD COLUMN IF NOT EXISTS market_cost numeric;

-- Carried from 20261029210000_trader_sets_and_trade_ups.sql (the latest); + 'market'.
ALTER TABLE public.satchel_items
	DROP CONSTRAINT IF EXISTS satchel_items_source_check;
ALTER TABLE public.satchel_items
	ADD CONSTRAINT satchel_items_source_check
	CHECK (source IN ('dig', 'swap', 'gift', 'migrated_shelf', 'errand', 'trader', 'market'));

-- ── 2. Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_prices (
	find_id text PRIMARY KEY REFERENCES public.satchel_finds(id),
	price numeric NOT NULL,
	-- The last tick the walk was materialised to.
	tick bigint NOT NULL,
	-- The tick of the last trade that moved the price ("quiet for").
	last_active_tick bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS public.market_price_points (
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	tick bigint NOT NULL,
	-- The last P of that tick.
	price numeric NOT NULL,
	PRIMARY KEY (find_id, tick)
);

CREATE TABLE IF NOT EXISTS public.market_offers (
	id bigserial PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	side text NOT NULL CHECK (side IN ('sell', 'buy', 'swap')),
	-- Per set; null on a swap.
	price int CHECK (price IS NULL OR price >= 1),
	qty int NOT NULL CHECK (qty >= 1),
	-- One friend only, or null for everyone.
	target_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
	want_find_id text REFERENCES public.satchel_finds(id),
	want_qty int CHECK (want_qty IS NULL OR want_qty >= 1),
	-- The set on offer, one cost per unit (null = dug up / given / swapped).
	-- Empty for a wanted ad (not set aside).
	escrow jsonb NOT NULL DEFAULT '[]'::jsonb,
	status text NOT NULL DEFAULT 'open'
		CHECK (status IN ('open', 'filled', 'crossed', 'cancelled', 'expired', 'lapsed')),
	created_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	closed_at timestamptz,
	trade_id bigint,
	CHECK ((side = 'swap') = (want_find_id IS NOT NULL)),
	CHECK ((side = 'swap') = (price IS NULL))
);
CREATE INDEX IF NOT EXISTS market_offers_open_idx
	ON public.market_offers (find_id, side, price, id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS market_offers_user_idx
	ON public.market_offers (user_id, created_at);
CREATE INDEX IF NOT EXISTS market_offers_expiry_idx
	ON public.market_offers (expires_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.market_trades (
	id bigserial PRIMARY KEY,
	kind text NOT NULL CHECK (kind IN ('counter', 'pig', 'swap', 'print')),
	-- counter: 'buy' (a pig bought from Bullion) | 'sell'; print: null.
	side text,
	-- counter | crossed | listing | wanted (how it came about).
	how text,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	qty int NOT NULL,
	price int,
	seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	buyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
	from_price numeric,
	to_price numeric,
	bid int,
	ask int,
	-- The seller's cost basis for the set (null when all of it was dug up).
	cost int,
	paid_units int,
	dug int,
	listed int,
	offer_id bigint,
	target_id uuid,
	poster_id uuid,
	want_find_id text REFERENCES public.satchel_finds(id),
	want_qty int,
	give_val numeric,
	want_val numeric,
	gave_cost int,
	-- A print: which townsfolk, and which way the wiggle went.
	who text,
	other text,
	dir text,
	tick bigint NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS market_trades_find_idx ON public.market_trades (find_id, id DESC);
CREATE INDEX IF NOT EXISTS market_trades_tick_idx ON public.market_trades (tick);
CREATE INDEX IF NOT EXISTS market_trades_seller_idx ON public.market_trades (seller_id) WHERE seller_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS market_trades_buyer_idx ON public.market_trades (buyer_id) WHERE buyer_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.market_ledgers (
	user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	spent int NOT NULL DEFAULT 0,
	took_in int NOT NULL DEFAULT 0
);

-- Things that happened to your listings while you were away (filled,
-- crossed, expired, lapsed, swapped) and offers sent to you (for_you).
-- market_state hands each over once.
CREATE TABLE IF NOT EXISTS public.market_notices (
	id bigserial PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	kind text NOT NULL CHECK (kind IN ('filled', 'crossed', 'expired', 'lapsed', 'swapped', 'for_you')),
	offer jsonb,
	trade_id bigint,
	created_at timestamptz NOT NULL DEFAULT now(),
	delivered_at timestamptz
);
CREATE INDEX IF NOT EXISTS market_notices_pending_idx
	ON public.market_notices (user_id, id) WHERE delivered_at IS NULL;

CREATE TABLE IF NOT EXISTS public.market_requests (
	nonce uuid PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	result jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_prices FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_price_points ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_price_points FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_offers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_offers FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_trades FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_ledgers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_ledgers FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_notices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_notices FROM PUBLIC, anon, authenticated;
ALTER TABLE public.market_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.market_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.market_offers_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.market_trades_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.market_notices_id_seq FROM PUBLIC, anon, authenticated;

-- ── 3. Pure helpers ──────────────────────────────────────────────────────────
-- A seeded uniform in [0, 1): the first 32 bits of md5(seed).
CREATE OR REPLACE FUNCTION public._market_unit(p_seed text)
RETURNS double precision LANGUAGE sql IMMUTABLE
AS $function$
	SELECT (('x' || substr(md5(p_seed), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
$function$;

CREATE OR REPLACE FUNCTION public._market_tick(p_at timestamptz, p_t jsonb)
RETURNS bigint LANGUAGE sql IMMUTABLE
AS $function$
	SELECT FLOOR(EXTRACT(EPOCH FROM p_at) / (GREATEST(1, COALESCE((p_t->>'tick_minutes')::int, 30)) * 60))::bigint;
$function$;

CREATE OR REPLACE FUNCTION public._market_rarity(p_find text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT rarity FROM public.satchel_finds WHERE id = p_find;
$function$;

CREATE OR REPLACE FUNCTION public._market_set_size(p_find text, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT GREATEST(1, COALESCE((p_t->'set_size'->>public._market_rarity(p_find))::int,
		CASE WHEN public._market_rarity(p_find) = 'common' THEN 4 ELSE 3 END));
$function$;

-- The usual price of a set: the Sheep's price for one find x the set size.
CREATE OR REPLACE FUNCTION public._market_usual(p_find text, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT GREATEST(1, COALESCE((p_t->'base'->>public._market_rarity(p_find))::int, 3))
		* public._market_set_size(p_find, p_t);
$function$;

CREATE OR REPLACE FUNCTION public._market_clamp(p_u int, p_price numeric, p_t jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT GREATEST((p_t->'price'->>'lo')::numeric * p_u,
	       LEAST((p_t->'price'->>'hi')::numeric * p_u, p_price));
$function$;

-- What Bullion charges for a set at price P (never below the usual price + 1).
CREATE OR REPLACE FUNCTION public._market_ask(p_u int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT GREATEST(p_u + 1, CEIL((p_t->'price'->>'sell_factor')::numeric * p_price - 0.000000001)::int);
$function$;

-- What Bullion pays for a set at price P (never above the usual price).
CREATE OR REPLACE FUNCTION public._market_bid(p_u int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT LEAST(p_u, FLOOR((p_t->'price'->>'buy_factor')::numeric * p_price + 0.000000001)::int);
$function$;

REVOKE ALL ON FUNCTION public._market_unit(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_tick(timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_rarity(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_set_size(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_usual(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_clamp(int, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_ask(int, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_bid(int, numeric, jsonb) FROM PUBLIC, anon, authenticated;

-- Move a find's price (clamped) and stamp the tick's point.
CREATE OR REPLACE FUNCTION public._market_set_price(p_find text, p_price numeric, p_tick bigint, p_active boolean, p_t jsonb)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	np numeric := public._market_clamp(public._market_usual(p_find, p_t), p_price, p_t);
BEGIN
	UPDATE public.market_prices
	SET price = np,
	    tick = GREATEST(tick, p_tick),
	    last_active_tick = CASE WHEN p_active THEN p_tick ELSE last_active_tick END
	WHERE find_id = p_find;
	INSERT INTO public.market_price_points (find_id, tick, price) VALUES (p_find, p_tick, np)
	ON CONFLICT (find_id, tick) DO UPDATE SET price = EXCLUDED.price;
	RETURN np;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_set_price(text, numeric, bigint, boolean, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 4. Bags and the bank ─────────────────────────────────────────────────────
-- Take n units of a find out of a bag, newest first (a set you just bought is
-- the set you sell next). Returns the per-unit costs, or NULL (and takes
-- nothing) when the bag holds fewer than n.
CREATE OR REPLACE FUNCTION public._market_take_units(p_user uuid, p_find text, p_n int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	ids bigint[];
	costs jsonb;
BEGIN
	SELECT array_agg(x.id), jsonb_agg(to_jsonb(x.market_cost))
	INTO ids, costs
	FROM (
		SELECT s.id, s.market_cost FROM public.satchel_items s
		WHERE s.user_id = p_user AND s.find_id = p_find
		ORDER BY s.created_at DESC, s.id DESC
		LIMIT p_n
		FOR UPDATE
	) x;
	IF COALESCE(array_length(ids, 1), 0) < p_n THEN
		RETURN NULL;
	END IF;
	DELETE FROM public.satchel_items WHERE id = ANY (ids);
	RETURN costs;
END;
$function$;

-- Put units in a bag, one row per cost (a json array of numbers or nulls).
CREATE OR REPLACE FUNCTION public._market_give_units(p_user uuid, p_find text, p_costs jsonb, p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
	INSERT INTO public.satchel_items (user_id, find_id, source, created_at, market_cost)
	SELECT p_user, p_find, 'market', p_at,
	       CASE WHEN jsonb_typeof(c.v) = 'number' THEN (c.v #>> '{}')::numeric ELSE NULL END
	FROM jsonb_array_elements(COALESCE(p_costs, '[]'::jsonb)) AS c(v);
	INSERT INTO public.satchel_met (user_id, find_id) VALUES (p_user, p_find) ON CONFLICT DO NOTHING;
END;
$function$;

-- n units at one total cost, spread evenly.
CREATE OR REPLACE FUNCTION public._market_costs(p_n int, p_total numeric)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT COALESCE(jsonb_agg(CASE WHEN p_total IS NULL THEN 'null'::jsonb ELSE to_jsonb(p_total / p_n) END), '[]'::jsonb)
	FROM generate_series(1, GREATEST(0, p_n));
$function$;

-- {cost (rounded, null when nothing in it was paid for), paid_units, dug}.
CREATE OR REPLACE FUNCTION public._market_lots_cost(p_costs jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT jsonb_build_object(
		'cost', CASE WHEN COUNT(*) FILTER (WHERE jsonb_typeof(c.v) = 'number') > 0
			THEN ROUND(SUM((c.v #>> '{}')::numeric) FILTER (WHERE jsonb_typeof(c.v) = 'number'))::int END,
		'paid_units', COUNT(*) FILTER (WHERE jsonb_typeof(c.v) = 'number'),
		'dug', COUNT(*) FILTER (WHERE jsonb_typeof(c.v) IS DISTINCT FROM 'number'))
	FROM jsonb_array_elements(COALESCE(p_costs, '[]'::jsonb)) AS c(v);
$function$;

-- Spend from the tickle bank. False (and nothing spent) when it is short.
CREATE OR REPLACE FUNCTION public._market_spend(p_user uuid, p_n int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	bal int;
BEGIN
	IF p_n <= 0 THEN RETURN true; END IF;
	bal := public.settle_tickles(p_user);
	IF bal < p_n THEN RETURN false; END IF;
	UPDATE public.user_items SET item_count = bal - p_n WHERE user_id = p_user;
	RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public._market_ledger(p_user uuid, p_spent int, p_took int)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	INSERT INTO public.market_ledgers (user_id, spent, took_in) VALUES (p_user, p_spent, p_took)
	ON CONFLICT (user_id) DO UPDATE
	SET spent = market_ledgers.spent + EXCLUDED.spent, took_in = market_ledgers.took_in + EXCLUDED.took_in;
$function$;

CREATE OR REPLACE FUNCTION public._market_offer_json(o public.market_offers)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
	SELECT jsonb_build_object(
		'id', o.id, 'find_id', o.find_id, 'side', o.side, 'price', o.price, 'qty', o.qty,
		'target_id', o.target_id, 'want_find_id', o.want_find_id, 'want_qty', o.want_qty,
		'created_at', o.created_at, 'expires_at', o.expires_at, 'status', o.status);
$function$;

CREATE OR REPLACE FUNCTION public._market_notice(p_user uuid, p_kind text, p_offer public.market_offers, p_trade bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	INSERT INTO public.market_notices (user_id, kind, offer, trade_id)
	VALUES (p_user, p_kind, CASE WHEN p_offer.id IS NULL THEN NULL ELSE public._market_offer_json(p_offer) END, p_trade);
$function$;

-- Close an open listing; a set on offer comes home.
CREATE OR REPLACE FUNCTION public._market_close(p_offer public.market_offers, p_status text, p_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
	UPDATE public.market_offers SET status = p_status, closed_at = p_at WHERE id = p_offer.id;
	IF jsonb_array_length(p_offer.escrow) > 0 THEN
		PERFORM public._market_give_units(p_offer.user_id, p_offer.find_id, p_offer.escrow, p_at);
	END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._market_take_units(uuid, text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_give_units(uuid, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_costs(int, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_lots_cost(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_spend(uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_ledger(uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_offer_json(public.market_offers) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_notice(uuid, text, public.market_offers, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_close(public.market_offers, text, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── 5. Settlement ────────────────────────────────────────────────────────────
-- The trade as the client reads it (names resolved for the viewer).
CREATE OR REPLACE FUNCTION public._market_trade_json(tr public.market_trades)
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
	SELECT jsonb_strip_nulls(jsonb_build_object(
		'id', tr.id, 'kind', tr.kind, 'side', tr.side, 'how', tr.how, 'find_id', tr.find_id,
		'qty', tr.qty, 'price', tr.price, 'seller_id', tr.seller_id, 'buyer_id', tr.buyer_id,
		'from', tr.from_price, 'to', tr.to_price, 'bid', tr.bid, 'ask', tr.ask,
		'cost', tr.cost, 'paid_units', tr.paid_units, 'dug', tr.dug, 'listed', tr.listed,
		'offer_id', tr.offer_id, 'target_id', tr.target_id, 'poster_id', tr.poster_id,
		'want_find_id', tr.want_find_id, 'want_qty', tr.want_qty,
		'give_val', tr.give_val, 'want_val', tr.want_val, 'gave_cost', tr.gave_cost,
		'who', tr.who, 'other', tr.other, 'dir', tr.dir, 'tick', tr.tick, 'at', tr.created_at));
$function$;
REVOKE ALL ON FUNCTION public._market_trade_json(public.market_trades) FROM PUBLIC, anon, authenticated;

-- Bullion buys a pig's set at his buying price; the price drops 3% of U.
-- p_costs is the set (already out of the bag or out of escrow).
CREATE OR REPLACE FUNCTION public._market_counter_sell(p_user uuid, p_find text, p_costs jsonb, p_how text,
	p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	u int := public._market_usual(p_find, p_t);
	sz int := public._market_set_size(p_find, p_t);
	p numeric;
	bid int;
	ask int;
	np numeric;
	lc jsonb := public._market_lots_cost(p_costs);
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	bid := public._market_bid(u, p, p_t);
	ask := public._market_ask(u, p, p_t);
	PERFORM public.grant_tickles(p_user, bid);
	PERFORM public._market_ledger(p_user, 0, bid);
	np := public._market_set_price(p_find, p - (p_t->'price'->>'impact')::numeric * u, p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, seller_id, from_price, to_price,
		bid, ask, cost, paid_units, dug, listed, offer_id, tick, created_at)
	VALUES ('counter', 'sell', p_how, p_find, sz, bid, p_user, p, np, bid, ask,
		(lc->>'cost')::int, (lc->>'paid_units')::int, (lc->>'dug')::int, p_offer.price, p_offer.id, p_tick, v_now)
	RETURNING * INTO tr;
	IF p_offer.id IS NOT NULL THEN
		UPDATE public.market_offers SET status = 'crossed', closed_at = v_now, trade_id = tr.id WHERE id = p_offer.id;
		PERFORM public._market_notice(p_user, 'crossed', p_offer, tr.id);
	END IF;
	RETURN tr;
END;
$function$;

-- Bullion sells a pig a set at his selling price; the price rises 3% of U.
-- The caller has already checked (and this spends) the tickles.
CREATE OR REPLACE FUNCTION public._market_counter_buy(p_user uuid, p_find text, p_how text,
	p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	u int := public._market_usual(p_find, p_t);
	sz int := public._market_set_size(p_find, p_t);
	p numeric;
	bid int;
	ask int;
	np numeric;
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	bid := public._market_bid(u, p, p_t);
	ask := public._market_ask(u, p, p_t);
	IF NOT public._market_spend(p_user, ask) THEN
		RAISE EXCEPTION 'market: counter buy without the tickles';
	END IF;
	PERFORM public._market_ledger(p_user, ask, 0);
	PERFORM public._market_give_units(p_user, p_find, public._market_costs(sz, ask), v_now);
	np := public._market_set_price(p_find, p + (p_t->'price'->>'impact')::numeric * u, p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, buyer_id, from_price, to_price,
		bid, ask, listed, offer_id, tick, created_at)
	VALUES ('counter', 'buy', p_how, p_find, sz, ask, p_user, p, np, bid, ask, p_offer.price, p_offer.id, p_tick, v_now)
	RETURNING * INTO tr;
	IF p_offer.id IS NOT NULL THEN
		UPDATE public.market_offers SET status = 'crossed', closed_at = v_now, trade_id = tr.id WHERE id = p_offer.id;
		PERFORM public._market_notice(p_user, 'crossed', p_offer, tr.id);
	END IF;
	RETURN tr;
END;
$function$;

-- One pig sells another a set; the price moves a third of the way to what was
-- paid. The caller has checked the buyer can pay (this spends it). p_offer is
-- the listing taken (its poster gets the notice), or a NULL row.
CREATE OR REPLACE FUNCTION public._market_settle_pig(p_seller uuid, p_buyer uuid, p_find text, p_price int,
	p_costs jsonb, p_how text, p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	u int := public._market_usual(p_find, p_t);
	sz int := public._market_set_size(p_find, p_t);
	p numeric;
	np numeric;
	lc jsonb := public._market_lots_cost(p_costs);
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	IF NOT public._market_spend(p_buyer, p_price) THEN
		RAISE EXCEPTION 'market: pig sale without the tickles';
	END IF;
	PERFORM public.grant_tickles(p_seller, p_price);
	PERFORM public._market_ledger(p_buyer, p_price, 0);
	PERFORM public._market_ledger(p_seller, 0, p_price);
	PERFORM public._market_give_units(p_buyer, p_find, public._market_costs(sz, p_price), v_now);
	np := public._market_set_price(p_find, p + (p_price - p) * (p_t->'price'->>'pig_pull')::numeric, p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, how, find_id, qty, price, seller_id, buyer_id, from_price, to_price,
		bid, ask, cost, paid_units, dug, offer_id, target_id, poster_id, tick, created_at)
	VALUES ('pig', p_how, p_find, sz, p_price, p_seller, p_buyer, p, np,
		public._market_bid(u, p, p_t), public._market_ask(u, p, p_t),
		(lc->>'cost')::int, (lc->>'paid_units')::int, (lc->>'dug')::int,
		p_offer.id, p_offer.target_id, p_offer.user_id, p_tick, v_now)
	RETURNING * INTO tr;
	IF p_offer.id IS NOT NULL THEN
		UPDATE public.market_offers SET status = 'filled', closed_at = v_now, trade_id = tr.id WHERE id = p_offer.id;
		PERFORM public._market_notice(p_offer.user_id, 'filled', p_offer, tr.id);
	END IF;
	RETURN tr;
END;
$function$;

REVOKE ALL ON FUNCTION public._market_counter_sell(uuid, text, jsonb, text, public.market_offers, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_counter_buy(uuid, text, text, public.market_offers, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_settle_pig(uuid, uuid, text, int, jsonb, text, public.market_offers, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Counter caps (a valve; null = off): has this pig used today's sells/buys?
CREATE OR REPLACE FUNCTION public._market_counter_open(p_user uuid, p_side text, p_tick bigint, p_t jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caps jsonb := p_t->'counter_caps';
	per_day int := (24 * 60) / GREATEST(1, COALESCE((p_t->>'tick_minutes')::int, 30));
	day0 bigint := (p_tick / per_day) * per_day;
	n int;
BEGIN
	IF caps IS NULL OR jsonb_typeof(caps) <> 'object' OR caps->>p_side IS NULL THEN
		RETURN true;
	END IF;
	SELECT COUNT(*)::int INTO n FROM public.market_trades tr
	WHERE tr.kind = 'counter' AND tr.side = p_side AND tr.tick >= day0
	  AND (CASE WHEN p_side = 'sell' THEN tr.seller_id ELSE tr.buyer_id END) = p_user;
	RETURN n < (caps->>p_side)::int;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_counter_open(uuid, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 6. The lazy tick ─────────────────────────────────────────────────────────
-- Catch every find's price up to now (the townsfolk's wiggle + the drift
-- home, a print now and then), expire listings past their 24 hours (a set on
-- offer comes home), then let the counter cross any resting listing that its
-- prices have reached. Returns the current tick. Callers inside a market write
-- already hold the market lock; a read takes it only when there is work.
CREATE OR REPLACE FUNCTION public._market_advance()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint := public._market_tick(v_now, t);
	catch_up int := GREATEST(1, COALESCE((t->>'catch_up_ticks')::int, 144));
	keep_ticks int := 7 * (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	print_window int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	townsfolk text[] := ARRAY['the Miller', 'the Baker''s boy', 'Old Mrs Hedge', 'the Tinker', 'Farmer Bramble', 'the Postmistress'];
	f record;
	o public.market_offers;
	u int;
	sz int;
	p numeric;
	w double precision;
	tk bigint;
	a int;
	b int;
	bid int;
	ask int;
BEGIN
	-- Nothing due? (No lock, no writes: the common read.)
	IF NOT EXISTS (SELECT 1 FROM public.satchel_finds sf
	               LEFT JOIN public.market_prices mp ON mp.find_id = sf.id
	               WHERE mp.find_id IS NULL OR mp.tick < now_t)
	   AND NOT EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'open' AND expires_at <= v_now) THEN
		RETURN now_t;
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);

	-- 0. A find with no price yet starts near its usual price.
	INSERT INTO public.market_prices (find_id, price, tick, last_active_tick)
	SELECT sf.id,
	       public._market_clamp(public._market_usual(sf.id, t),
	           public._market_usual(sf.id, t) * (0.97 + 0.06 * public._market_unit('p0:' || sf.id))::numeric, t),
	       now_t, now_t
	FROM public.satchel_finds sf
	WHERE NOT EXISTS (SELECT 1 FROM public.market_prices mp WHERE mp.find_id = sf.id)
	ON CONFLICT (find_id) DO NOTHING;
	INSERT INTO public.market_price_points (find_id, tick, price)
	SELECT mp.find_id, mp.tick, mp.price FROM public.market_prices mp
	ON CONFLICT (find_id, tick) DO NOTHING;

	-- 1. Quiet hours: every tick, the wiggle and the drift home.
	FOR f IN SELECT mp.find_id, mp.price, mp.tick FROM public.market_prices mp
	         WHERE mp.tick < now_t ORDER BY mp.find_id FOR UPDATE LOOP
		u := public._market_usual(f.find_id, t);
		sz := public._market_set_size(f.find_id, t);
		p := f.price;
		FOR tk IN GREATEST(f.tick + 1, now_t - catch_up + 1) .. now_t LOOP
			w := 2 * public._market_unit('w:' || f.find_id || ':' || tk) - 1;
			p := p + u * (t->'price'->>'wiggle')::numeric * w::numeric;
			p := p + (t->'price'->>'home')::numeric * (u - p);
			p := public._market_clamp(u, p, t);
			INSERT INTO public.market_price_points (find_id, tick, price) VALUES (f.find_id, tk, p)
			ON CONFLICT (find_id, tick) DO UPDATE SET price = EXCLUDED.price;
			-- A print on the tape is one of those small trades (only the last day's).
			IF tk > now_t - print_window
			   AND public._market_unit('pr:' || f.find_id || ':' || tk)
			       < COALESCE((t->'print_chance'->>public._market_rarity(f.find_id))::double precision, 0) THEN
				a := FLOOR(public._market_unit('pa:' || f.find_id || ':' || tk) * array_length(townsfolk, 1))::int;
				b := (a + 1 + FLOOR(public._market_unit('pb:' || f.find_id || ':' || tk)
				      * (array_length(townsfolk, 1) - 1))::int) % array_length(townsfolk, 1);
				INSERT INTO public.market_trades (kind, find_id, qty, price, dir, who, other, tick, created_at)
				VALUES ('print', f.find_id, sz, ROUND(p)::int, CASE WHEN w >= 0 THEN 'up' ELSE 'down' END,
				        townsfolk[a + 1], townsfolk[b + 1], tk,
				        to_timestamp(tk * GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30)) * 60));
			END IF;
		END LOOP;
		UPDATE public.market_prices SET price = p, tick = now_t WHERE find_id = f.find_id;
	END LOOP;
	DELETE FROM public.market_price_points WHERE tick < now_t - keep_ticks;
	DELETE FROM public.market_trades WHERE kind = 'print' AND tick < now_t - keep_ticks;

	-- 2. Listings older than 24 hours lapse; a set on offer comes home.
	FOR o IN SELECT * FROM public.market_offers
	         WHERE status = 'open' AND expires_at <= v_now ORDER BY id FOR UPDATE LOOP
		PERFORM public._market_close(o, 'expired', v_now);
		PERFORM public._market_notice(o.user_id, 'expired', o, NULL);
	END LOOP;

	-- 3. The counter keeps the board honest. Each crossing moves the price, so
	-- every listing is judged against the price as it stands when its turn comes.
	FOR o IN SELECT * FROM public.market_offers
	         WHERE status = 'open' AND side IN ('sell', 'buy') ORDER BY id FOR UPDATE LOOP
		u := public._market_usual(o.find_id, t);
		SELECT price INTO p FROM public.market_prices WHERE find_id = o.find_id;
		bid := public._market_bid(u, p, t);
		ask := public._market_ask(u, p, t);
		IF o.side = 'sell' AND o.price <= bid AND public._market_counter_open(o.user_id, 'sell', now_t, t) THEN
			PERFORM public._market_counter_sell(o.user_id, o.find_id, o.escrow, 'crossed', o, now_t, t);
		ELSIF o.side = 'buy' AND o.price >= ask AND public._market_counter_open(o.user_id, 'buy', now_t, t) THEN
			IF public.tickle_balance(o.user_id) < ask THEN
				PERFORM public._market_close(o, 'lapsed', v_now);
				PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
			ELSE
				PERFORM public._market_counter_buy(o.user_id, o.find_id, 'crossed', o, now_t, t);
			END IF;
		END IF;
	END LOOP;

	RETURN now_t;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_advance() FROM PUBLIC, anon, authenticated;

-- ── 7. Reads ─────────────────────────────────────────────────────────────────
-- A pig as the viewer may see it: you, a friend (named), or "a pig" (null).
CREATE OR REPLACE FUNCTION public._market_who(p_viewer uuid, p_pig uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE
		WHEN p_pig IS NULL THEN NULL
		WHEN p_pig = p_viewer THEN jsonb_build_object('id', p_pig, 'you', true)
		WHEN public.are_friends(p_viewer, p_pig) THEN (
			SELECT jsonb_build_object('id', pr.id, 'name', pr.username, 'pig_id', pr.active_pig_id, 'friend', true)
			FROM public.profiles pr WHERE pr.id = p_pig)
		ELSE jsonb_build_object('id', p_pig, 'friend', false)
	END;
$function$;
REVOKE ALL ON FUNCTION public._market_who(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- A trade on the tape, with its pigs resolved for the viewer.
CREATE OR REPLACE FUNCTION public._market_tape_json(p_viewer uuid, tr public.market_trades)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public._market_trade_json(tr) || jsonb_strip_nulls(jsonb_build_object(
		'seller', public._market_who(p_viewer, tr.seller_id),
		'buyer', public._market_who(p_viewer, tr.buyer_id)));
$function$;
REVOKE ALL ON FUNCTION public._market_tape_json(uuid, public.market_trades) FROM PUBLIC, anon, authenticated;

-- What you hold of every find: held, cost basis, and what is pinned up.
CREATE OR REPLACE FUNCTION public._market_holdings(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(jsonb_object_agg(sf.id, jsonb_build_object(
		'held', COALESCE(h.held, 0),
		'paid', COALESCE(h.paid, 0),
		'paid_units', COALESCE(h.paid_units, 0),
		'on_offer', COALESCE(e.on_offer, 0))), '{}'::jsonb)
	FROM public.satchel_finds sf
	LEFT JOIN (
		SELECT s.find_id, COUNT(*)::int AS held,
		       ROUND(COALESCE(SUM(s.market_cost), 0))::int AS paid,
		       COUNT(s.market_cost)::int AS paid_units
		FROM public.satchel_items s WHERE s.user_id = p_user GROUP BY s.find_id
	) h ON h.find_id = sf.id
	LEFT JOIN (
		SELECT o.find_id, SUM(jsonb_array_length(o.escrow))::int AS on_offer
		FROM public.market_offers o WHERE o.user_id = p_user AND o.status = 'open' GROUP BY o.find_id
	) e ON e.find_id = sf.id;
$function$;
REVOKE ALL ON FUNCTION public._market_holdings(uuid) FROM PUBLIC, anon, authenticated;

-- Can this viewer see (and take) this listing?
CREATE OR REPLACE FUNCTION public._market_visible(p_viewer uuid, o public.market_offers)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT o.user_id = p_viewer
	    OR ((o.target_id IS NULL OR o.target_id = p_viewer) AND NOT public.are_blocked(p_viewer, o.user_id));
$function$;
REVOKE ALL ON FUNCTION public._market_visible(uuid, public.market_offers) FROM PUBLIC, anon, authenticated;

-- The whole market as the caller sees it: the counter (every find's price,
-- Bullion's two prices, the day's sparkline), your bank, ledger, bag and
-- listings, the noticeboard, the tape, your undelivered notices (handed over
-- once), yesterday's busiest find, and your friends (for "who sees it").
CREATE OR REPLACE FUNCTION public.market_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	per_day int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	day0 bigint;
	cap_val int;
	finds jsonb;
	board jsonb;
	mine jsonb;
	tape jsonb;
	notices jsonb;
	friends jsonb;
	led public.market_ledgers%ROWTYPE;
	posts int;
	yest jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'closed');
	END IF;
	now_t := public._market_advance();
	day0 := (now_t / per_day) * per_day;

	SELECT jsonb_agg(jsonb_build_object(
		'id', sf.id,
		'rarity', sf.rarity,
		'size', public._market_set_size(sf.id, t),
		'usual', public._market_usual(sf.id, t),
		'price', mp.price,
		'ask', public._market_ask(public._market_usual(sf.id, t), mp.price, t),
		'bid', public._market_bid(public._market_usual(sf.id, t), mp.price, t),
		'prev', COALESCE((SELECT pp.price FROM public.market_price_points pp
		                  WHERE pp.find_id = sf.id AND pp.tick <= now_t - per_day
		                  ORDER BY pp.tick DESC LIMIT 1),
		                 (SELECT pp.price FROM public.market_price_points pp
		                  WHERE pp.find_id = sf.id ORDER BY pp.tick LIMIT 1)),
		'quiet_for', now_t - mp.last_active_tick,
		'spark', (SELECT COALESCE(jsonb_agg(jsonb_build_array(x.tick, ROUND(x.price, 3)) ORDER BY x.tick), '[]'::jsonb)
		          FROM (SELECT pp.tick, pp.price FROM public.market_price_points pp
		                WHERE pp.find_id = sf.id AND pp.tick >= now_t - per_day ORDER BY pp.tick) x))
		ORDER BY sf.sort)
	INTO finds
	FROM public.satchel_finds sf JOIN public.market_prices mp ON mp.find_id = sf.id;

	SELECT COALESCE(jsonb_agg(public._market_offer_json(o) ORDER BY o.id), '[]'::jsonb) INTO mine
	FROM public.market_offers o WHERE o.user_id = uid AND o.status = 'open';

	SELECT COALESCE(jsonb_agg(public._market_offer_json(o) || jsonb_build_object(
		'poster', public._market_who(uid, o.user_id),
		'for_you', o.target_id IS NOT DISTINCT FROM uid,
		'poster_coin_ok', CASE WHEN o.side = 'buy' THEN public.tickle_balance(o.user_id) >= o.price END)
		ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC), '[]'::jsonb) INTO board
	FROM (SELECT * FROM public.market_offers o
	      WHERE o.status = 'open' AND o.user_id <> uid AND public._market_visible(uid, o)
	      ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC LIMIT 80) o;

	SELECT COALESCE(jsonb_agg(public._market_tape_json(uid, x) ORDER BY x.id DESC), '[]'::jsonb) INTO tape
	FROM (SELECT * FROM public.market_trades tr ORDER BY tr.id DESC LIMIT 24) x;

	WITH pending AS (
		UPDATE public.market_notices SET delivered_at = v_now
		WHERE id IN (SELECT n.id FROM public.market_notices n
		             WHERE n.user_id = uid AND n.delivered_at IS NULL ORDER BY n.id LIMIT 20)
		RETURNING *)
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'id', n.id, 'kind', n.kind, 'offer', n.offer,
		'trade', (SELECT public._market_tape_json(uid, tr) FROM public.market_trades tr WHERE tr.id = n.trade_id))
		ORDER BY n.id), '[]'::jsonb) INTO notices
	FROM pending n;

	SELECT COALESCE(jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.username, 'pig_id', pr.active_pig_id)
		ORDER BY lower(pr.username)), '[]'::jsonb) INTO friends
	FROM (SELECT pr.* FROM public.friendships fs
	      JOIN public.profiles pr ON pr.id = CASE WHEN fs.requester_id = uid THEN fs.receiver_id ELSE fs.requester_id END
	      WHERE fs.status = 'accepted' AND (fs.requester_id = uid OR fs.receiver_id = uid)
	      ORDER BY lower(pr.username) LIMIT 24) pr;

	SELECT * INTO led FROM public.market_ledgers WHERE user_id = uid;
	SELECT COUNT(*)::int INTO posts FROM public.market_offers o
	WHERE o.user_id = uid AND public._market_tick(o.created_at, t) >= day0;

	-- Yesterday's busiest find (counter + pig sales), with its price range.
	SELECT jsonb_build_object('find_id', x.find_id, 'sets', x.n,
		'lo', (SELECT MIN(pp.price) FROM public.market_price_points pp
		       WHERE pp.find_id = x.find_id AND pp.tick >= day0 - per_day AND pp.tick < day0),
		'hi', (SELECT MAX(pp.price) FROM public.market_price_points pp
		       WHERE pp.find_id = x.find_id AND pp.tick >= day0 - per_day AND pp.tick < day0))
	INTO yest
	FROM (SELECT tr.find_id, COUNT(*)::int AS n FROM public.market_trades tr
	      WHERE tr.kind IN ('counter', 'pig') AND tr.tick >= day0 - per_day AND tr.tick < day0
	      GROUP BY tr.find_id ORDER BY COUNT(*) DESC, tr.find_id LIMIT 1) x;

	cap_val := CASE WHEN COALESCE((SELECT is_vip FROM public.profiles WHERE id = uid), false) THEN 50 ELSE 25 END;

	RETURN jsonb_build_object(
		'ok', true,
		'now', v_now,
		'tick', now_t,
		'tuning', jsonb_build_object(
			'set_size', t->'set_size', 'base', t->'base', 'price', t->'price',
			'list_multiple', t->'list_multiple', 'open_offers', t->'open_offers',
			'daily_posts', t->'daily_posts', 'offer_hours', t->'offer_hours',
			'tick_minutes', t->'tick_minutes', 'counter_caps', t->'counter_caps'),
		'finds', COALESCE(finds, '[]'::jsonb),
		'me', jsonb_build_object(
			'id', uid,
			'coin', public.tickle_balance(uid),
			'cap', cap_val,
			'spent', COALESCE(led.spent, 0),
			'took_in', COALESCE(led.took_in, 0),
			'posts_today', posts,
			'holdings', public._market_holdings(uid),
			'offers', mine),
		'board', board,
		'tape', tape,
		'notices', notices,
		'friends', friends,
		'yesterday', yest);
END;
$function$;
REVOKE ALL ON FUNCTION public.market_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_state() TO authenticated;

-- One find up close: two days of price, every trade on the chart, the last
-- ten trades, today's counts.
CREATE OR REPLACE FUNCTION public.market_find(p_find text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	now_t bigint;
	per_day int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	t0 bigint;
	hist jsonb;
	marks jsonb;
	recent jsonb;
	today jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_finds WHERE id = p_find) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_find');
	END IF;
	now_t := public._market_advance();
	t0 := now_t - 2 * per_day;

	SELECT COALESCE(jsonb_agg(jsonb_build_array(pp.tick, ROUND(pp.price, 3)) ORDER BY pp.tick), '[]'::jsonb) INTO hist
	FROM public.market_price_points pp WHERE pp.find_id = p_find AND pp.tick >= t0;

	SELECT COALESCE(jsonb_agg(jsonb_build_array(tr.tick, tr.kind, tr.price) ORDER BY tr.id), '[]'::jsonb) INTO marks
	FROM (SELECT * FROM public.market_trades tr
	      WHERE tr.find_id = p_find AND tr.tick >= t0 AND tr.kind IN ('counter', 'pig', 'print')
	      ORDER BY tr.id DESC LIMIT 120) tr;

	SELECT COALESCE(jsonb_agg(public._market_tape_json(uid, x) ORDER BY x.id DESC), '[]'::jsonb) INTO recent
	FROM (SELECT * FROM public.market_trades tr
	      WHERE (tr.find_id = p_find OR tr.want_find_id = p_find)
	      ORDER BY tr.id DESC LIMIT 10) x;

	SELECT jsonb_build_object(
		'counter_buys', COUNT(*) FILTER (WHERE kind = 'counter' AND side = 'buy'),
		'counter_sells', COUNT(*) FILTER (WHERE kind = 'counter' AND side = 'sell'),
		'pig_sales', COUNT(*) FILTER (WHERE kind = 'pig'),
		'swaps', COUNT(*) FILTER (WHERE kind = 'swap'),
		'prints', COUNT(*) FILTER (WHERE kind = 'print'))
	INTO today
	FROM public.market_trades
	WHERE find_id = p_find AND tick >= (now_t / per_day) * per_day;

	RETURN jsonb_build_object('ok', true, 'find_id', p_find, 'tick', now_t,
		'hist', hist, 'marks', marks, 'recent', recent, 'today', today);
END;
$function$;
REVOKE ALL ON FUNCTION public.market_find(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_find(text) TO authenticated;

-- ── 8. Writes ────────────────────────────────────────────────────────────────
-- A replayed nonce answers its original result.
CREATE OR REPLACE FUNCTION public._market_replay(p_user uuid, p_nonce uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE WHEN r.user_id = p_user THEN r.result || '{"replay": true}'::jsonb
	            ELSE '{"ok": false, "reason": "bad_nonce"}'::jsonb END
	FROM public.market_requests r WHERE r.nonce = p_nonce;
$function$;
REVOKE ALL ON FUNCTION public._market_replay(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._market_done(p_user uuid, p_nonce uuid, p_result jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	out jsonb := p_result || jsonb_build_object('replay', false, 'coin', public.tickle_balance(p_user));
BEGIN
	INSERT INTO public.market_requests (nonce, user_id, result) VALUES (p_nonce, p_user, out);
	RETURN out;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_done(uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- Part 1: the counter. p_side 'buy' (buy a set from Bullion) or 'sell'.
-- p_limit guards the price: a buy fails price_moved if he now charges more, a
-- sale if he now pays less (the confirm sheet showed a number; that number holds).
CREATE OR REPLACE FUNCTION public.market_counter(p_find text, p_side text, p_limit int, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	now_t bigint;
	u int;
	sz int;
	p numeric;
	bid int;
	ask int;
	bal int;
	costs jsonb;
	none public.market_offers;
	tr public.market_trades;
	prior jsonb;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
	IF p_nonce IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce'); END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN RETURN jsonb_build_object('ok', false, 'reason', 'closed'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_finds WHERE id = p_find) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_find');
	END IF;
	IF p_side IS NULL OR p_side NOT IN ('buy', 'sell') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_side');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	prior := public._market_replay(uid, p_nonce);
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	now_t := public._market_advance();

	IF NOT public._market_counter_open(uid, p_side, now_t, t) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'counter_limit', 'side', p_side);
	END IF;
	u := public._market_usual(p_find, t);
	sz := public._market_set_size(p_find, t);
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find;
	bid := public._market_bid(u, p, t);
	ask := public._market_ask(u, p, t);

	IF p_side = 'buy' THEN
		IF p_limit IS NOT NULL AND ask > p_limit THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', ask);
		END IF;
		bal := public.settle_tickles(uid);
		IF bal < ask THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', ask);
		END IF;
		tr := public._market_counter_buy(uid, p_find, 'counter', none, now_t, t);
	ELSE
		IF p_limit IS NOT NULL AND bid < p_limit THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', bid);
		END IF;
		costs := public._market_take_units(uid, p_find, sz);
		IF costs IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set',
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = p_find),
				'set_size', sz);
		END IF;
		tr := public._market_counter_sell(uid, p_find, costs, 'counter', none, now_t, t);
	END IF;
	RETURN public._market_done(uid, p_nonce,
		jsonb_build_object('ok', true, 'via', 'counter', 'trade', public._market_tape_json(uid, tr)));
END;
$function$;
REVOKE ALL ON FUNCTION public.market_counter(text, text, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_counter(text, text, int, uuid) TO authenticated;

-- Part 2: post a listing. p_side 'sell' | 'buy' (price per set) | 'swap'
-- (p_want_find, p_want_qty). p_target: one friend, or null for everyone.
-- A sell that meets a wanted ad (or the counter's buying price) sells at once,
-- and a wanted ad that meets a listing (or the counter's selling price) buys
-- at once — the better of the two, a tie to the pig. Answers
-- {ok, filled, via ('pig' | 'counter'), trade} or {ok, filled:false, offer}.
CREATE OR REPLACE FUNCTION public.market_post(p_side text, p_find text, p_price int, p_want_find text,
	p_want_qty int, p_target uuid, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	per_day int := (24 * 60) / GREATEST(1, COALESCE((t->>'tick_minutes')::int, 30));
	u int;
	sz int;
	p numeric;
	bid int;
	ask int;
	bal int;
	held int;
	open_n int;
	posts int;
	buy_total int;
	costs jsonb;
	w public.market_offers;
	s public.market_offers;
	newo public.market_offers;
	none public.market_offers;
	tr public.market_trades;
	prior jsonb;
	exp timestamptz;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
	IF p_nonce IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce'); END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN RETURN jsonb_build_object('ok', false, 'reason', 'closed'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_finds WHERE id = p_find) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_find');
	END IF;
	IF p_side IS NULL OR p_side NOT IN ('sell', 'buy', 'swap') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_side');
	END IF;
	IF p_target IS NOT NULL AND (p_target = uid OR NOT public.are_friends(uid, p_target) OR public.are_blocked(uid, p_target)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_a_friend');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	prior := public._market_replay(uid, p_nonce);
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	now_t := public._market_advance();

	u := public._market_usual(p_find, t);
	sz := public._market_set_size(p_find, t);
	exp := v_now + make_interval(hours => GREATEST(1, COALESCE((t->>'offer_hours')::int, 24)));
	SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = p_find;
	IF p_side IN ('sell', 'swap') AND held < sz THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'held', held, 'set_size', sz);
	END IF;
	SELECT COUNT(*)::int INTO open_n FROM public.market_offers WHERE user_id = uid AND status = 'open';
	SELECT COUNT(*)::int INTO posts FROM public.market_offers o
	WHERE o.user_id = uid AND public._market_tick(o.created_at, t) >= (now_t / per_day) * per_day;
	IF posts >= COALESCE((t->>'daily_posts')::int, 30) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_many_today');
	END IF;

	-- Straight up: the set is pinned, nothing else happens.
	IF p_side = 'swap' THEN
		IF open_n >= COALESCE((t->>'open_offers')::int, 4) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'too_many_offers');
		END IF;
		IF p_want_find IS NULL OR p_want_find = p_find
		   OR NOT EXISTS (SELECT 1 FROM public.satchel_finds WHERE id = p_want_find) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_want');
		END IF;
		IF p_want_qty IS NULL OR p_want_qty < 1 OR p_want_qty > public._market_set_size(p_want_find, t) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_want', 'max', public._market_set_size(p_want_find, t));
		END IF;
		costs := public._market_take_units(uid, p_find, sz);
		INSERT INTO public.market_offers (user_id, find_id, side, qty, target_id, want_find_id, want_qty, escrow, created_at, expires_at)
		VALUES (uid, p_find, 'swap', sz, p_target, p_want_find, p_want_qty, costs, v_now, exp)
		RETURNING * INTO newo;
		IF p_target IS NOT NULL THEN PERFORM public._market_notice(p_target, 'for_you', newo, NULL); END IF;
		RETURN public._market_done(uid, p_nonce,
			jsonb_build_object('ok', true, 'filled', false, 'offer', public._market_offer_json(newo)));
	END IF;

	IF p_price IS NULL OR p_price < 1 OR p_price > COALESCE((t->>'list_multiple')::int, 3) * u THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_price', 'min', 1,
			'max', COALESCE((t->>'list_multiple')::int, 3) * u);
	END IF;
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find;
	bid := public._market_bid(u, p, t);
	ask := public._market_ask(u, p, t);

	IF p_side = 'sell' THEN
		-- The best wanted ad paying at least our price whose pig can pay
		-- (ads whose pig can't pay lapse on the way).
		LOOP
			SELECT * INTO w FROM public.market_offers o
			WHERE o.status = 'open' AND o.side = 'buy' AND o.find_id = p_find AND o.user_id <> uid
			  AND o.price >= p_price AND public._market_visible(uid, o)
			  AND (p_target IS NULL OR o.user_id = p_target)
			ORDER BY o.price DESC, o.id
			LIMIT 1 FOR UPDATE;
			EXIT WHEN NOT FOUND;
			EXIT WHEN public.tickle_balance(w.user_id) >= w.price;
			PERFORM public._market_close(w, 'lapsed', v_now);
			PERFORM public._market_notice(w.user_id, 'lapsed', w, NULL);
			w := NULL;
		END LOOP;
		IF w.id IS NOT NULL AND (w.price >= bid OR p_price > bid) THEN
			costs := public._market_take_units(uid, p_find, sz);
			INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, status, created_at, expires_at, closed_at)
			VALUES (uid, p_find, 'sell', p_price, sz, p_target, 'filled', v_now, exp, v_now);
			tr := public._market_settle_pig(uid, w.user_id, p_find, w.price, costs, 'wanted', w, now_t, t);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', true, 'filled', true, 'via', 'pig',
				'trade', public._market_tape_json(uid, tr)));
		END IF;
		IF p_price <= bid AND public._market_counter_open(uid, 'sell', now_t, t) THEN
			costs := public._market_take_units(uid, p_find, sz);
			INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, status, created_at, expires_at, closed_at)
			VALUES (uid, p_find, 'sell', p_price, sz, p_target, 'crossed', v_now, exp, v_now);
			tr := public._market_counter_sell(uid, p_find, costs, 'crossed', none, now_t, t);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', true, 'filled', true, 'via', 'counter',
				'trade', public._market_tape_json(uid, tr)));
		END IF;
		IF open_n >= COALESCE((t->>'open_offers')::int, 4) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'too_many_offers');
		END IF;
		costs := public._market_take_units(uid, p_find, sz);
		INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, escrow, created_at, expires_at)
		VALUES (uid, p_find, 'sell', p_price, sz, p_target, costs, v_now, exp)
		RETURNING * INTO newo;
		IF p_target IS NOT NULL THEN PERFORM public._market_notice(p_target, 'for_you', newo, NULL); END IF;
		RETURN public._market_done(uid, p_nonce,
			jsonb_build_object('ok', true, 'filled', false, 'offer', public._market_offer_json(newo)));
	END IF;

	-- Wanted: not set aside, but the tickles must be ready for all your wanted ads.
	bal := public.settle_tickles(uid);
	SELECT COALESCE(SUM(price), 0)::int INTO buy_total FROM public.market_offers
	WHERE user_id = uid AND status = 'open' AND side = 'buy';
	IF bal < buy_total + p_price THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', buy_total + p_price);
	END IF;
	SELECT * INTO s FROM public.market_offers o
	WHERE o.status = 'open' AND o.side = 'sell' AND o.find_id = p_find AND o.user_id <> uid
	  AND o.price <= p_price AND public._market_visible(uid, o)
	  AND (p_target IS NULL OR o.user_id = p_target)
	ORDER BY o.price, o.id
	LIMIT 1 FOR UPDATE;
	IF s.id IS NOT NULL AND (s.price <= ask OR p_price < ask) THEN
		INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, status, created_at, expires_at, closed_at)
		VALUES (uid, p_find, 'buy', p_price, sz, p_target, 'filled', v_now, exp, v_now);
		tr := public._market_settle_pig(s.user_id, uid, p_find, s.price, s.escrow, 'listing', s, now_t, t);
		RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', true, 'filled', true, 'via', 'pig',
			'trade', public._market_tape_json(uid, tr)));
	END IF;
	IF p_price >= ask AND public._market_counter_open(uid, 'buy', now_t, t) THEN
		INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, status, created_at, expires_at, closed_at)
		VALUES (uid, p_find, 'buy', p_price, sz, p_target, 'crossed', v_now, exp, v_now);
		tr := public._market_counter_buy(uid, p_find, 'crossed', none, now_t, t);
		RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', true, 'filled', true, 'via', 'counter',
			'trade', public._market_tape_json(uid, tr)));
	END IF;
	IF open_n >= COALESCE((t->>'open_offers')::int, 4) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_many_offers');
	END IF;
	INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, created_at, expires_at)
	VALUES (uid, p_find, 'buy', p_price, sz, p_target, v_now, exp)
	RETURNING * INTO newo;
	IF p_target IS NOT NULL THEN PERFORM public._market_notice(p_target, 'for_you', newo, NULL); END IF;
	RETURN public._market_done(uid, p_nonce,
		jsonb_build_object('ok', true, 'filled', false, 'offer', public._market_offer_json(newo)));
END;
$function$;
REVOKE ALL ON FUNCTION public.market_post(text, text, int, text, int, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_post(text, text, int, text, int, uuid, uuid) TO authenticated;

-- Take a listing off the board: buy a for-sale set, fill a wanted ad, or take
-- a swap. p_limit guards a purchase's price (the listing's price is fixed, so
-- this only matters to a replayed screen).
CREATE OR REPLACE FUNCTION public.market_take(p_offer_id bigint, p_limit int, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	o public.market_offers;
	sz int;
	bal int;
	held int;
	costs jsonb;
	tr public.market_trades;
	prior jsonb;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
	IF p_nonce IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce'); END IF;
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN RETURN jsonb_build_object('ok', false, 'reason', 'closed'); END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	prior := public._market_replay(uid, p_nonce);
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	now_t := public._market_advance();

	SELECT * INTO o FROM public.market_offers WHERE id = p_offer_id FOR UPDATE;
	IF NOT FOUND OR o.status <> 'open' OR NOT public._market_visible(uid, o) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF o.user_id = uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'own_offer');
	END IF;
	sz := public._market_set_size(o.find_id, t);

	IF o.side = 'sell' THEN
		IF p_limit IS NOT NULL AND o.price > p_limit THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', o.price);
		END IF;
		bal := public.settle_tickles(uid);
		IF bal < o.price THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', o.price);
		END IF;
		tr := public._market_settle_pig(o.user_id, uid, o.find_id, o.price, o.escrow, 'listing', o, now_t, t);
	ELSIF o.side = 'buy' THEN
		SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = o.find_id;
		IF held < sz THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'held', held, 'set_size', sz);
		END IF;
		IF public.tickle_balance(o.user_id) < o.price THEN
			PERFORM public._market_close(o, 'lapsed', v_now);
			PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', false, 'reason', 'lapsed'));
		END IF;
		costs := public._market_take_units(uid, o.find_id, sz);
		tr := public._market_settle_pig(uid, o.user_id, o.find_id, o.price, costs, 'wanted', o, now_t, t);
	ELSE
		-- Straight up: both sides move at once; no tickles; a swapped find
		-- carries no cost; the price stays put.
		SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = o.want_find_id;
		IF held < o.want_qty THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'held', held, 'needed', o.want_qty);
		END IF;
		costs := public._market_take_units(uid, o.want_find_id, o.want_qty);
		PERFORM public._market_give_units(uid, o.find_id, public._market_costs(o.qty, NULL), v_now);
		PERFORM public._market_give_units(o.user_id, o.want_find_id, public._market_costs(o.want_qty, NULL), v_now);
		INSERT INTO public.market_trades (kind, find_id, qty, seller_id, buyer_id, want_find_id, want_qty,
			give_val, want_val, cost, gave_cost, offer_id, target_id, poster_id, tick, created_at)
		VALUES ('swap', o.find_id, o.qty, o.user_id, uid, o.want_find_id, o.want_qty,
			(SELECT price FROM public.market_prices WHERE find_id = o.find_id),
			(SELECT price FROM public.market_prices WHERE find_id = o.want_find_id)
				/ public._market_set_size(o.want_find_id, t) * o.want_qty,
			(public._market_lots_cost(o.escrow)->>'cost')::int,
			(public._market_lots_cost(costs)->>'cost')::int,
			o.id, o.target_id, o.user_id, now_t, v_now)
		RETURNING * INTO tr;
		UPDATE public.market_offers SET status = 'filled', closed_at = v_now, trade_id = tr.id WHERE id = o.id;
		PERFORM public._market_notice(o.user_id, 'swapped', o, tr.id);
	END IF;
	RETURN public._market_done(uid, p_nonce,
		jsonb_build_object('ok', true, 'trade', public._market_tape_json(uid, tr)));
END;
$function$;
REVOKE ALL ON FUNCTION public.market_take(bigint, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_take(bigint, int, uuid) TO authenticated;

-- Take your own listing down; a set on offer comes home. Idempotent: a
-- listing already closed answers not_found and nothing moves.
CREATE OR REPLACE FUNCTION public.market_cancel(p_offer_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	o public.market_offers;
BEGIN
	IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated'); END IF;
	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	SELECT * INTO o FROM public.market_offers WHERE id = p_offer_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND OR o.status <> 'open' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	PERFORM public._market_close(o, 'cancelled', public._patch_now());
	RETURN jsonb_build_object('ok', true, 'offer_id', o.id,
		'returned', CASE WHEN jsonb_array_length(o.escrow) > 0 THEN 'find' ELSE 'nothing' END,
		'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = o.find_id));
END;
$function$;
REVOKE ALL ON FUNCTION public.market_cancel(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_cancel(bigint) TO authenticated;

-- ── 9. The Barn fan's peek ───────────────────────────────────────────────────
-- Read-only (no tick, no hand-over): is the market open, and is anything
-- waiting for you there — notices not yet handed over, listings sent to you.
-- The fan row reads this so it never consumes market_state's notices.
CREATE OR REPLACE FUNCTION public.market_ping()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE WHEN auth.uid() IS NULL THEN jsonb_build_object('ok', false, 'reason', 'not_authenticated')
	ELSE jsonb_build_object(
		'ok', true,
		'open', COALESCE((public._market_tuning()->>'enabled')::boolean, true),
		'notices', (SELECT COUNT(*) FROM public.market_notices n
		            WHERE n.user_id = auth.uid() AND n.delivered_at IS NULL),
		'for_you', (SELECT COUNT(*) FROM public.market_offers o
		            WHERE o.target_id = auth.uid() AND o.status = 'open' AND o.expires_at > public._patch_now()),
		'listings', (SELECT COUNT(*) FROM public.market_offers o
		             WHERE o.user_id = auth.uid() AND o.status = 'open'))
	END;
$function$;
REVOKE ALL ON FUNCTION public.market_ping() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_ping() TO authenticated;

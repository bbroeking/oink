-- Bullion's Market launch fixes (2026-11-02), on top of
-- 20261031100000_bullions_market.sql (M), 20261031110000_market_followups.sql
-- (F) and 20261101150000_bullion_board.sql (B). All three are applied on
-- production, so every change lands here, forward only.
--
-- From the 2026-11-02 server audit (each finding reproduced on Postgres 16;
-- the proofs are now assertions in
-- scripts/db-harness/C3_market_launch_fixes_smoke.sql):
--
--   1. HIGH. A one-friend listing whose friend deletes their account took the
--      poster's held set with it (target_id ON DELETE CASCADE). The FK is now
--      ON DELETE SET NULL, and a BEFORE UPDATE trigger closes an open listing
--      whose target turns NULL as 'cancelled', gives its held set back and
--      leaves a notice. It never becomes a public listing.
--   2. HIGH. A set-size change minted or destroyed finds on open listings.
--      A listing keeps the size it was pinned at: settlement delivers the
--      units actually held (the escrow, or the wanted ad's own qty), and
--      Bullion prices a crossing by the listing's qty (_market_bid_n /
--      _market_ask_n: the set's prices scaled to n units; n = the set size is
--      the set itself, to the tickle). A new post only meets resting listings
--      of the current size. Swaps hand over what was held.
--   3. MEDIUM. market_tuning is validated. _market_tuning() deep-merges every
--      object over the compiled defaults (a partial "price" keeps the rest),
--      coerces and clamps every number, falls back to the default band and
--      cut if the fairness invariant (sell_factor x lo > buy_factor x hi)
--      fails, keeps impact under half the ride limit, makes every count a
--      whole number, daily_listings 0..6, and PINS tick_minutes at 30 (a
--      change would orphan every stored tick). Any error answers the
--      defaults. Every quote (counter and shelf) is at least 1;
--      _market_spend refuses an amount <= 0. Bullion's shelf builder answers
--      an empty shelf on any error instead of failing market_state.
--   4. MEDIUM. enabled=false stranded held sets. Closed, market_state still
--      runs time (expiry brings sets home; nothing crosses) and answers
--      {ok:false, reason:'closed', me:{offers, holdings}} so a pig can take
--      its own listings down (market_cancel already ignored the switch).
--      market_find honours the switch like the other RPCs.
--   5. MEDIUM. One pig could buy the whole daily shelf. bullion_board.per_pig
--      (default 1; null = off) caps a pig's shelf buys per UTC day; refusal
--      {ok:false, reason:'shelf_limit', limit}. market_state adds
--      me.shelf_today and tuning.bullion_board so the client can say so first.
--   6. MEDIUM. At a tick boundary every queued read redid the advance. Under
--      the lock _market_advance checks again that work is due (_market_due)
--      and leaves if another read already did it.
--   7. LOW. Housekeeping, inside the day's first advance (stateless: the walk
--      last reached an earlier UTC day), bounded to 5000 rows a table:
--      delivered notices, nonce replays and closed listings (never a 'reset'
--      one: an undone flip gives its set back from the row) older than 30
--      days, and trades older than 30 days that nothing still points at (an
--      undelivered or recent notice, Bullion's shelf). Prints already go at
--      seven days; the charts read price points (seven days) and two days of
--      trades; the ledger is a running total. Never fails a read.
--   8. TIME-CRITICAL (before Mon Nov 9). flip_season_2 does not take the
--      market lock and stamps ran_at with now() (its transaction's START), so
--      a listing pinned in the flip's own window survived the reset (its held
--      set would come home into the Season 2 bag). The pg_cron job
--      season2-flip (20261029260000: '0 0 9 11 *', p_at 2026-11-09 00:00,
--      the 2026-11-10 date guard, then cron.unschedule) is re-scheduled in
--      place to call _season2_flip_market_locked(p_at): the market lock, then
--      flip_season_2(p_at) unchanged, then, still under the lock, every
--      listing still open ends as the market's guard would ('reset', the set
--      does not come home, an unflip gives it back). Left alone when pg_cron
--      is absent (the harness), when Season 2 has already flipped, or when
--      the job is not scheduled. A manual flip should call the wrapper too.
--   9. LOW, Connect. Pushes (send_push_to_user, data {kind:'market',
--      screen:'market'}, EXCEPTION-guarded so a push never rolls back a
--      trade): an offer pinned for you, and your listing filled, crossed or
--      swapped. Never to the pig whose call it is. Strangers are "A pig".
--  10. Balance (founder: "balance the game for fun"; within the design, see
--      docs/design/market-2026-10-31/balance-pass-2026-11-02.md): impact
--      0.03 -> 0.05, wiggle 0.01 -> 0.02, offer_hours 24 -> 48, merged into
--      app_settings.market_tuning (no other key touched) and the compiled
--      defaults. Set sizes and the Ghost Sheep are untouched (they wait on
--      the founder). The invariant is asserted below: 1.2 x 0.85 = 1.02 >
--      0.8 x 1.15 = 0.92, and impact 0.05 < the 0.425 ride limit.
--
-- Carry-latest-def (each CREATE OR REPLACE starts from its latest definition
-- across all migrations, changing only what the fix needs):
--   _market_tuning ........ M (now plpgsql: validated; new defaults)
--   _market_ask, _market_bid, _market_spend ........................... M
--   _market_notice ........ M (now plpgsql: + the push)
--   _market_counter_sell, _market_counter_buy, _market_settle_pig ..... M
--   _market_advance ....... F
--   market_state .......... B
--   market_find, market_post .......................................... M
--   market_take ........... B
--   _market_bullion_price, _market_bullion_board, _market_bullion_take  B
-- New: _market_jsonb_merge, _market_num, _market_int, _market_clamp_num,
-- _market_bid_n, _market_ask_n, _market_due, _market_prune,
-- _market_find_plural, _market_push, _market_offers_target_gone (trigger),
-- _season2_flip_market_locked. Not touched: flip_season_2, unflip_season_2,
-- market_cancel, market_counter, market_ping.
--
-- Client contract changes (client agent): market_state when closed (fix 4),
-- me.shelf_today + tuning.bullion_board (fix 5), reason 'shelf_limit' (fix
-- 5), a target-gone take-down arrives as an 'expired' notice whose offer
-- carries ended:'target_left' (fix 1), listings now last 48 hours (fix 10).
--
-- Validated on a stubbed local Postgres 16: prep -> M -> F -> B -> this ->
-- C1 -> C2 -> C3 (scripts/db-harness/00x_market_prep.sql header).
--
-- Authored for review; do not push without Brian's explicit "go".

SET LOCAL lock_timeout = '5s';

-- ── 1. A one-friend listing outlives its friend's account ─────────────────────
-- The FK action (SET NULL) is an UPDATE of target_id, so this BEFORE trigger
-- sees it. It sets NEW's status rather than calling _market_close (which would
-- UPDATE the same row from inside its own trigger), and gives the set back
-- with the same helper and the same season-reset rule. It never blocks an
-- account deletion: a failed give-back is a WARNING, the listing still comes
-- down and its escrow stays on the row for a hand repair. No market lock: the
-- row lock orders it against a concurrent cancel or crossing.
CREATE OR REPLACE FUNCTION public._market_offers_target_gone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v_now timestamptz := public._patch_now();
BEGIN
	IF OLD.status <> 'open' OR OLD.target_id IS NULL OR NEW.target_id IS NOT NULL THEN
		RETURN NEW;
	END IF;
	NEW.status := 'cancelled';
	NEW.closed_at := v_now;
	BEGIN
		IF jsonb_array_length(OLD.escrow) > 0 AND NOT public._market_pre_reset(OLD, public._market_reset_at()) THEN
			PERFORM public._market_give_units(OLD.user_id, OLD.find_id, OLD.escrow, v_now);
		END IF;
		-- 'expired' is the take-down every client already renders ("came
		-- home"); ended says why.
		INSERT INTO public.market_notices (user_id, kind, offer)
		VALUES (OLD.user_id, 'expired',
			public._market_offer_json(NEW) || jsonb_build_object('status', 'expired', 'ended', 'target_left'));
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'market: listing % lost its friend; giving its set back failed: %', OLD.id, SQLERRM;
	END;
	RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_offers_target_gone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS market_offers_target_gone ON public.market_offers;
CREATE TRIGGER market_offers_target_gone
	BEFORE UPDATE OF target_id ON public.market_offers
	FOR EACH ROW EXECUTE FUNCTION public._market_offers_target_gone();

-- Whatever the constraint is called, drop the target's FK and add it back
-- with ON DELETE SET NULL.
DO $target_fk$
DECLARE
	c record;
BEGIN
	FOR c IN SELECT con.conname FROM pg_constraint con
	         WHERE con.conrelid = 'public.market_offers'::regclass AND con.contype = 'f'
	           AND con.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
	                                   WHERE a.attrelid = 'public.market_offers'::regclass
	                                     AND a.attname = 'target_id')]::smallint[] LOOP
		EXECUTE format('ALTER TABLE public.market_offers DROP CONSTRAINT %I', c.conname);
	END LOOP;
END
$target_fk$;
ALTER TABLE public.market_offers
	ADD CONSTRAINT market_offers_target_id_fkey
	FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Tuning, validated ─────────────────────────────────────────────────────
-- A number from a tuning value: a JSON number, or a string that is plainly
-- one; NULL otherwise.
CREATE OR REPLACE FUNCTION public._market_num(p_v jsonb)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE jsonb_typeof(p_v)
		WHEN 'number' THEN (p_v #>> '{}')::numeric
		WHEN 'string' THEN CASE WHEN btrim(p_v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
		                        THEN btrim(p_v #>> '{}')::numeric END
	END;
$function$;

-- A number kept in [lo, hi]; the default when it is not a number.
CREATE OR REPLACE FUNCTION public._market_clamp_num(p_v jsonb, p_def numeric, p_lo numeric, p_hi numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE WHEN public._market_num(p_v) IS NULL THEN p_def
	            ELSE LEAST(p_hi, GREATEST(p_lo, public._market_num(p_v))) END;
$function$;

-- A whole number (rounded down) kept in [lo, hi]; the default when it is not
-- a number.
CREATE OR REPLACE FUNCTION public._market_int(p_v jsonb, p_def int, p_lo int, p_hi int)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE WHEN public._market_num(p_v) IS NULL THEN p_def
	            ELSE LEAST(p_hi, GREATEST(p_lo, FLOOR(public._market_num(p_v))))::int END;
$function$;

-- b over a, key by key, all the way down (an object in b merges into a's
-- object; anything else in b replaces). plpgsql: it calls itself.
CREATE OR REPLACE FUNCTION public._market_jsonb_merge(p_a jsonb, p_b jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	k text;
	v jsonb;
	res jsonb;
BEGIN
	IF p_b IS NULL THEN RETURN p_a; END IF;
	IF jsonb_typeof(p_a) IS DISTINCT FROM 'object' OR jsonb_typeof(p_b) <> 'object' THEN RETURN p_b; END IF;
	res := p_a;
	FOR k, v IN SELECT e.key, e.value FROM jsonb_each(p_b) e LOOP
		res := res || jsonb_build_object(k, public._market_jsonb_merge(p_a -> k, v));
	END LOOP;
	RETURN res;
END;
$function$;

REVOKE ALL ON FUNCTION public._market_num(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_clamp_num(jsonb, numeric, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_int(jsonb, int, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_jsonb_merge(jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- The tuning every market function reads. app_settings.market_tuning is merged
-- over the compiled defaults key by key, then every value is made safe: a bad
-- edit degrades to the default for that value, never a failed read. The
-- per-find base price is still the Ghost Sheep's (trader_tuning.prices).
CREATE OR REPLACE FUNCTION public._market_tuning()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	d jsonb := '{"enabled": true,
	             "set_size": {"common": 4, "uncommon": 3, "rare": 3},
	             "list_multiple": 3, "open_offers": 4, "daily_posts": 30,
	             "offer_hours": 48, "tick_minutes": 30, "catch_up_ticks": 144,
	             "price": {"lo": 0.85, "hi": 1.15, "sell_factor": 1.2, "buy_factor": 0.8,
	                       "impact": 0.05, "pig_pull": 0.3333333333, "wiggle": 0.02, "home": 0.05},
	             "print_chance": {"common": 0.2, "uncommon": 0.1, "rare": 0.03},
	             "counter_caps": null,
	             "bullion_board": {"daily_listings": 3, "per_pig": 1}}'::jsonb;
	base_d jsonb := '{"common": 3, "uncommon": 8, "rare": 20}'::jsonb;
	raw jsonb;
	t jsonb;
	x jsonb;
	lo numeric;
	hi numeric;
	sf numeric;
	bf numeric;
	caps jsonb;
BEGIN
	BEGIN
		SELECT value INTO raw FROM public.app_settings WHERE key = 'market_tuning';
		IF jsonb_typeof(raw) IS DISTINCT FROM 'object' THEN raw := '{}'::jsonb; END IF;
		t := public._market_jsonb_merge(d, raw);

		-- The band and Bullion's cut: each in range, and together fair (his
		-- lowest selling price above his highest buying price), or all four
		-- go back to the defaults. Impact stays under half the ride limit
		-- (a set bought and sold straight back can't ride the cut:
		-- impact < (sell_factor - buy_factor) x lo / buy_factor).
		x := t->'price';
		lo := public._market_num(x->'lo');
		hi := public._market_num(x->'hi');
		sf := public._market_num(x->'sell_factor');
		bf := public._market_num(x->'buy_factor');
		IF lo IS NULL OR lo <= 0 OR lo >= 1 THEN lo := 0.85; END IF;
		IF hi IS NULL OR hi <= 1 OR hi > 3 THEN hi := 1.15; END IF;
		IF sf IS NULL OR sf <= 1 OR sf > 3 THEN sf := 1.2; END IF;
		IF bf IS NULL OR bf <= 0 OR bf >= 1 THEN bf := 0.8; END IF;
		IF sf * lo <= bf * hi THEN
			lo := 0.85; hi := 1.15; sf := 1.2; bf := 0.8;
		END IF;
		t := t || jsonb_build_object('price', jsonb_build_object(
			'lo', lo, 'hi', hi, 'sell_factor', sf, 'buy_factor', bf,
			'impact', LEAST(public._market_clamp_num(x->'impact', 0.05, 0, 0.2), 0.5 * (sf - bf) * lo / bf),
			'pig_pull', public._market_clamp_num(x->'pig_pull', 0.3333333333, 0, 1),
			'wiggle', public._market_clamp_num(x->'wiggle', 0.02, 0, 0.1),
			'home', public._market_clamp_num(x->'home', 0.05, 0, 0.5)));

		x := t->'set_size';
		t := t || jsonb_build_object('set_size', jsonb_build_object(
			'common', public._market_int(x->'common', 4, 1, 20),
			'uncommon', public._market_int(x->'uncommon', 3, 1, 20),
			'rare', public._market_int(x->'rare', 3, 1, 20)));

		x := t->'print_chance';
		t := t || jsonb_build_object('print_chance', jsonb_build_object(
			'common', public._market_clamp_num(x->'common', 0.2, 0, 1),
			'uncommon', public._market_clamp_num(x->'uncommon', 0.1, 0, 1),
			'rare', public._market_clamp_num(x->'rare', 0.03, 0, 1)));

		-- Counter caps: {sell, buy} whole numbers >= 0 (0 = none today), or
		-- null (off).
		x := t->'counter_caps';
		caps := NULL;
		IF jsonb_typeof(x) = 'object' THEN
			caps := jsonb_strip_nulls(jsonb_build_object(
				'sell', CASE WHEN public._market_num(x->'sell') IS NOT NULL THEN public._market_int(x->'sell', 0, 0, 1000) END,
				'buy', CASE WHEN public._market_num(x->'buy') IS NOT NULL THEN public._market_int(x->'buy', 0, 0, 1000) END));
			IF caps = '{}'::jsonb THEN caps := NULL; END IF;
		END IF;

		-- Bullion's shelf: 0..6 a day; per pig a day, null = off.
		x := t->'bullion_board';
		t := t || jsonb_build_object(
			'counter_caps', caps,
			'bullion_board', jsonb_build_object(
				'daily_listings', public._market_int(x->'daily_listings', 3, 0, 6),
				'per_pig', CASE WHEN jsonb_typeof(x->'per_pig') = 'null' THEN NULL
				                ELSE public._market_int(x->'per_pig', 1, 0, 6) END),
			'enabled', CASE
				WHEN jsonb_typeof(t->'enabled') = 'boolean' THEN (t->>'enabled')::boolean
				WHEN lower(btrim(t->>'enabled')) IN ('true', 'false') THEN lower(btrim(t->>'enabled'))::boolean
				ELSE true END,
			'list_multiple', public._market_int(t->'list_multiple', 3, 1, 10),
			'open_offers', public._market_int(t->'open_offers', 4, 0, 20),
			'daily_posts', public._market_int(t->'daily_posts', 30, 0, 500),
			'offer_hours', public._market_int(t->'offer_hours', 48, 1, 168),
			-- Pinned: every stored tick (prices, points, prints, the day's
			-- counts) is a 30-minute tick. A change would orphan them all.
			'tick_minutes', 30,
			'catch_up_ticks', public._market_int(t->'catch_up_ticks', 144, 1, 336));

		SELECT value->'prices' INTO x FROM public.app_settings WHERE key = 'trader_tuning';
		RETURN t || jsonb_build_object('base', jsonb_build_object(
			'common', public._market_int(x->'common', 3, 1, 1000),
			'uncommon', public._market_int(x->'uncommon', 8, 1, 1000),
			'rare', public._market_int(x->'rare', 20, 1, 1000)));
	EXCEPTION WHEN OTHERS THEN
		RAISE WARNING 'market: market_tuning unreadable, using the defaults: %', SQLERRM;
		RETURN d || jsonb_build_object('base', base_d);
	END;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_tuning() FROM PUBLIC, anon, authenticated;

-- What Bullion charges for a set at price P (never below the usual price + 1,
-- never below 1).
CREATE OR REPLACE FUNCTION public._market_ask(p_u int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT GREATEST(1, p_u + 1, CEIL((p_t->'price'->>'sell_factor')::numeric * p_price - 0.000000001)::int);
$function$;

-- What Bullion pays for a set at price P (never above the usual price, never
-- below 1: a set is never sold to him for nothing).
CREATE OR REPLACE FUNCTION public._market_bid(p_u int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT GREATEST(1, LEAST(p_u, FLOOR((p_t->'price'->>'buy_factor')::numeric * p_price + 0.000000001)::int));
$function$;

-- Spend from the tickle bank. False (and nothing spent) when it is short, and
-- for an amount <= 0 (no market price is ever free).
CREATE OR REPLACE FUNCTION public._market_spend(p_user uuid, p_n int)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	bal int;
BEGIN
	IF p_n IS NULL OR p_n <= 0 THEN RETURN false; END IF;
	bal := public.settle_tickles(p_user);
	IF bal < p_n THEN RETURN false; END IF;
	UPDATE public.user_items SET item_count = bal - p_n WHERE user_id = p_user;
	RETURN true;
END;
$function$;

-- Bullion's prices for n units of a find: a set's prices with the usual
-- price and P scaled to n (base x n, P x n / set size). n = the set size is
-- the set itself, exactly. A listing keeps the size it was pinned at, so it
-- is priced by its own qty if set sizes change while it is up.
CREATE OR REPLACE FUNCTION public._market_bid_n(p_find text, p_n int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE WHEN p_n = s.sz THEN public._market_bid(s.u, p_price, p_t)
	            ELSE public._market_bid((s.u / s.sz) * p_n, p_price * p_n / s.sz, p_t) END
	FROM (SELECT public._market_usual(p_find, p_t) AS u, public._market_set_size(p_find, p_t) AS sz) s;
$function$;

CREATE OR REPLACE FUNCTION public._market_ask_n(p_find text, p_n int, p_price numeric, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE WHEN p_n = s.sz THEN public._market_ask(s.u, p_price, p_t)
	            ELSE public._market_ask((s.u / s.sz) * p_n, p_price * p_n / s.sz, p_t) END
	FROM (SELECT public._market_usual(p_find, p_t) AS u, public._market_set_size(p_find, p_t) AS sz) s;
$function$;
REVOKE ALL ON FUNCTION public._market_bid_n(text, int, numeric, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._market_ask_n(text, int, numeric, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 10. The balance pass (merged, nothing else touched) ──────────────────────
UPDATE public.app_settings
SET value = value || jsonb_build_object(
		'offer_hours', 48,
		'price', CASE WHEN jsonb_typeof(value->'price') = 'object' THEN value->'price' ELSE '{}'::jsonb END
			|| '{"impact": 0.05, "wiggle": 0.02}'::jsonb),
	updated_at = now()
WHERE key = 'market_tuning';

DO $balance$
DECLARE
	t jsonb := public._market_tuning();
	lo numeric := (t->'price'->>'lo')::numeric;
	hi numeric := (t->'price'->>'hi')::numeric;
	sf numeric := (t->'price'->>'sell_factor')::numeric;
	bf numeric := (t->'price'->>'buy_factor')::numeric;
	impact numeric := (t->'price'->>'impact')::numeric;
BEGIN
	IF impact <> 0.05 OR (t->'price'->>'wiggle')::numeric <> 0.02 OR (t->>'offer_hours')::int <> 48 THEN
		RAISE EXCEPTION 'market balance pass did not land: %', t;
	END IF;
	IF NOT (sf * lo > bf * hi) THEN
		RAISE EXCEPTION 'market fairness invariant broken: % x % <= % x %', sf, lo, bf, hi;
	END IF;
	IF NOT (impact < (sf - bf) * lo / bf) THEN
		RAISE EXCEPTION 'market impact % rides the cut (limit %)', impact, (sf - bf) * lo / bf;
	END IF;
END
$balance$;

-- ── 9. Pushes ────────────────────────────────────────────────────────────────
-- A find's plural, as the client says it (utils/trader.ts findPlural).
CREATE OR REPLACE FUNCTION public._market_find_plural(p_find text, p_n int)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE WHEN p_n = 1 THEN COALESCE(f.name, 'find')
	       ELSE CASE p_find
	           WHEN 'wool_tuft' THEN 'tufts of wool'
	           WHEN 'red_berries' THEN 'sprigs of red berries'
	           WHEN 'clover' THEN 'four-leaf clovers'
	           WHEN 'honeycomb' THEN 'honeycomb chips'
	           ELSE COALESCE(f.name, 'find') || 's' END END
	FROM (SELECT (SELECT sf.name FROM public.satchel_finds sf WHERE sf.id = p_find) AS name) f;
$function$;
REVOKE ALL ON FUNCTION public._market_find_plural(text, int) FROM PUBLIC, anon, authenticated;

-- The phone side of a notice: an offer pinned for you, your listing filled,
-- crossed or swapped. Never to the pig whose call this is (they are looking
-- at it). A friend is named, anyone else is "A pig". Its own subtransaction:
-- a push that fails is a NOTICE, never a rolled-back trade.
CREATE OR REPLACE FUNCTION public._market_push(p_user uuid, p_kind text, p_offer public.market_offers, p_trade bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	tr public.market_trades;
	who text;
	what text;
	ttl text;
	body text;
BEGIN
	IF p_user IS NULL OR p_user IS NOT DISTINCT FROM auth.uid() THEN
		RETURN;
	END IF;
	BEGIN
		IF p_kind = 'for_you' THEN
			who := COALESCE((SELECT NULLIF(btrim(pr.username), '') FROM public.profiles pr WHERE pr.id = p_offer.user_id), 'A friend');
			what := p_offer.qty || ' ' || public._market_find_plural(p_offer.find_id, p_offer.qty);
			ttl := 'An offer for you';
			body := CASE p_offer.side
				WHEN 'sell' THEN who || ' pinned ' || what || ' for you at ' || p_offer.price || '.'
				WHEN 'buy' THEN who || ' wants to buy ' || what || ' from you at ' || p_offer.price || '.'
				ELSE who || ' pinned ' || what || ' for you, straight up for ' || p_offer.want_qty || ' '
					|| public._market_find_plural(p_offer.want_find_id, p_offer.want_qty) || '.' END;
		ELSE
			SELECT * INTO tr FROM public.market_trades WHERE id = p_trade;
			IF NOT FOUND THEN RETURN; END IF;
			what := tr.qty || ' ' || public._market_find_plural(tr.find_id, tr.qty);
			IF p_kind = 'crossed' THEN
				IF tr.side = 'sell' THEN
					ttl := 'Sold to Bullion';
					body := 'Bullion bought your ' || what || ' for ' || tr.price || '.';
				ELSE
					ttl := 'Bought from Bullion';
					body := 'Bullion sold you ' || what || ' for ' || tr.price || '.';
				END IF;
			ELSE
				who := COALESCE(public._market_who(p_user,
					CASE WHEN tr.seller_id = p_user THEN tr.buyer_id ELSE tr.seller_id END)->>'name', 'A pig');
				IF p_kind = 'swapped' THEN
					ttl := 'Your swap went through';
					body := who || ' swapped ' || tr.want_qty || ' '
						|| public._market_find_plural(tr.want_find_id, tr.want_qty) || ' for your ' || what || '.';
				ELSIF tr.seller_id = p_user THEN
					ttl := 'Your ' || public._market_find_plural(tr.find_id, 2) || ' sold';
					body := who || ' bought your ' || what || ' for ' || tr.price || '.';
				ELSE
					ttl := 'Your wanted ad filled';
					body := who || ' sold you ' || what || ' for ' || tr.price || '.';
				END IF;
			END IF;
		END IF;
		PERFORM public.send_push_to_user(p_user, ttl, body,
			jsonb_build_object('kind', 'market', 'screen', 'market'));
	EXCEPTION WHEN OTHERS THEN
		RAISE NOTICE 'market: push to % failed: %', p_user, SQLERRM;
	END;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_push(uuid, text, public.market_offers, bigint) FROM PUBLIC, anon, authenticated;

-- A notice carries the listing as it ENDED (its status follows the notice's
-- kind), not the open row it was read as. The kinds a pig wants to hear about
-- away from the app also go to their phone.
CREATE OR REPLACE FUNCTION public._market_notice(p_user uuid, p_kind text, p_offer public.market_offers, p_trade bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
	INSERT INTO public.market_notices (user_id, kind, offer, trade_id)
	VALUES (p_user, p_kind,
		CASE WHEN p_offer.id IS NULL THEN NULL
		ELSE public._market_offer_json(p_offer) || jsonb_build_object('status',
			CASE p_kind WHEN 'swapped' THEN 'filled' WHEN 'for_you' THEN 'open' ELSE p_kind END) END,
		p_trade);
	IF p_kind IN ('for_you', 'filled', 'crossed', 'swapped') THEN
		PERFORM public._market_push(p_user, p_kind, p_offer, p_trade);
	END IF;
END;
$function$;

-- ── 2. Settlement by what is held ────────────────────────────────────────────
-- Bullion buys a pig's set at his buying price; the price drops impact x U.
-- p_costs is the set (already out of the bag or out of escrow): it is what he
-- buys, so he pays for exactly those units (a listing pinned at another set
-- size is priced by its own count) and the price moves in proportion.
CREATE OR REPLACE FUNCTION public._market_counter_sell(p_user uuid, p_find text, p_costs jsonb, p_how text,
	p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	u int := public._market_usual(p_find, p_t);
	sz int := public._market_set_size(p_find, p_t);
	n int := jsonb_array_length(COALESCE(p_costs, '[]'::jsonb));
	p numeric;
	bid int;
	ask int;
	np numeric;
	lc jsonb := public._market_lots_cost(p_costs);
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	IF n < 1 THEN
		RAISE EXCEPTION 'market: counter sale of nothing';
	END IF;
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	bid := public._market_bid_n(p_find, n, p, p_t);
	ask := public._market_ask_n(p_find, n, p, p_t);
	PERFORM public.grant_tickles(p_user, bid);
	PERFORM public._market_ledger(p_user, 0, bid);
	np := public._market_set_price(p_find, p - (p_t->'price'->>'impact')::numeric * ((u / sz) * n), p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, seller_id, from_price, to_price,
		bid, ask, cost, paid_units, dug, listed, offer_id, tick, created_at)
	VALUES ('counter', 'sell', p_how, p_find, n, bid, p_user, p, np, bid, ask,
		(lc->>'cost')::int, (lc->>'paid_units')::int, (lc->>'dug')::int, p_offer.price, p_offer.id, p_tick, v_now)
	RETURNING * INTO tr;
	IF p_offer.id IS NOT NULL THEN
		UPDATE public.market_offers SET status = 'crossed', closed_at = v_now, trade_id = tr.id WHERE id = p_offer.id;
		PERFORM public._market_notice(p_user, 'crossed', p_offer, tr.id);
	END IF;
	RETURN tr;
END;
$function$;

-- Bullion sells a pig a set at his selling price; the price rises impact x U.
-- The caller has already checked (and this spends) the tickles. A wanted ad
-- crossing gets its own qty (the set size it was posted at), priced for it.
CREATE OR REPLACE FUNCTION public._market_counter_buy(p_user uuid, p_find text, p_how text,
	p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	u int := public._market_usual(p_find, p_t);
	sz int := public._market_set_size(p_find, p_t);
	n int := COALESCE(p_offer.qty, public._market_set_size(p_find, p_t));
	p numeric;
	bid int;
	ask int;
	np numeric;
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	bid := public._market_bid_n(p_find, n, p, p_t);
	ask := public._market_ask_n(p_find, n, p, p_t);
	IF NOT public._market_spend(p_user, ask) THEN
		RAISE EXCEPTION 'market: counter buy without the tickles';
	END IF;
	PERFORM public._market_ledger(p_user, ask, 0);
	PERFORM public._market_give_units(p_user, p_find, public._market_costs(n, ask), v_now);
	np := public._market_set_price(p_find, p + (p_t->'price'->>'impact')::numeric * ((u / sz) * n), p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, buyer_id, from_price, to_price,
		bid, ask, listed, offer_id, tick, created_at)
	VALUES ('counter', 'buy', p_how, p_find, n, ask, p_user, p, np, bid, ask, p_offer.price, p_offer.id, p_tick, v_now)
	RETURNING * INTO tr;
	IF p_offer.id IS NOT NULL THEN
		UPDATE public.market_offers SET status = 'crossed', closed_at = v_now, trade_id = tr.id WHERE id = p_offer.id;
		PERFORM public._market_notice(p_user, 'crossed', p_offer, tr.id);
	END IF;
	RETURN tr;
END;
$function$;

-- One pig sells another a set; the price moves a third of the way to what was
-- paid (as a set's worth). The caller has checked the buyer can pay (this
-- spends it). p_costs is what the seller hands over (a listing's held set, or
-- the units taken for a wanted ad's own qty): the buyer gets exactly those,
-- nothing minted, nothing lost. p_offer is the listing taken (its poster gets
-- the notice), or a NULL row.
CREATE OR REPLACE FUNCTION public._market_settle_pig(p_seller uuid, p_buyer uuid, p_find text, p_price int,
	p_costs jsonb, p_how text, p_offer public.market_offers, p_tick bigint, p_t jsonb)
RETURNS public.market_trades LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	sz int := public._market_set_size(p_find, p_t);
	n int := jsonb_array_length(COALESCE(p_costs, '[]'::jsonb));
	p numeric;
	np numeric;
	lc jsonb := public._market_lots_cost(p_costs);
	tr public.market_trades;
	v_now timestamptz := public._patch_now();
BEGIN
	IF n < 1 THEN
		RAISE EXCEPTION 'market: pig sale of nothing';
	END IF;
	SELECT price INTO p FROM public.market_prices WHERE find_id = p_find FOR UPDATE;
	IF NOT public._market_spend(p_buyer, p_price) THEN
		RAISE EXCEPTION 'market: pig sale without the tickles';
	END IF;
	PERFORM public.grant_tickles(p_seller, p_price);
	PERFORM public._market_ledger(p_buyer, p_price, 0);
	PERFORM public._market_ledger(p_seller, 0, p_price);
	PERFORM public._market_give_units(p_buyer, p_find, public._market_costs(n, p_price), v_now);
	np := public._market_set_price(p_find,
		p + (CASE WHEN n = sz THEN p_price::numeric ELSE p_price::numeric * sz / n END - p)
			* (p_t->'price'->>'pig_pull')::numeric, p_tick, true, p_t);
	INSERT INTO public.market_trades (kind, how, find_id, qty, price, seller_id, buyer_id, from_price, to_price,
		bid, ask, cost, paid_units, dug, offer_id, target_id, poster_id, tick, created_at)
	VALUES ('pig', p_how, p_find, n, p_price, p_seller, p_buyer, p, np,
		public._market_bid_n(p_find, n, p, p_t), public._market_ask_n(p_find, n, p, p_t),
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

-- ── 6/7. The lazy tick: due once, housekeeping once a day ────────────────────
-- Is there anything for an advance to do? A price behind the tick, a listing
-- past its hours, a listing from before a standing season reset, or (the
-- flip undone) a reset listing to restore.
CREATE OR REPLACE FUNCTION public._market_due(p_now_t bigint, p_now timestamptz, p_reset_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT EXISTS (SELECT 1 FROM public.satchel_finds sf
	               LEFT JOIN public.market_prices mp ON mp.find_id = sf.id
	               WHERE mp.find_id IS NULL OR mp.tick < p_now_t)
	    OR EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'open' AND expires_at <= p_now)
	    OR (p_reset_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.market_offers
	                WHERE status = 'open' AND posted_at < p_reset_at))
	    OR (p_reset_at IS NULL AND EXISTS (SELECT 1 FROM public.market_offers WHERE status = 'reset'));
$function$;
REVOKE ALL ON FUNCTION public._market_due(bigint, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

-- Forget what nobody reads any more: delivered notices, nonce replays and
-- closed listings (never a 'reset' one: an undone flip gives its set back from
-- the row) older than 30 days, and trades from before p_tick that nothing
-- still points at (a notice, Bullion's shelf). At most 5000 rows a table a
-- call; a backlog clears over the following days. Never fails the read.
CREATE OR REPLACE FUNCTION public._market_prune(p_now timestamptz, p_tick bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cutoff timestamptz := p_now - interval '30 days';
	n_notices int;
	n_requests int;
	n_offers int;
	n_trades int;
BEGIN
	DELETE FROM public.market_notices WHERE id IN (
		SELECT n.id FROM public.market_notices n
		WHERE n.delivered_at IS NOT NULL AND n.delivered_at < cutoff ORDER BY n.id LIMIT 5000);
	GET DIAGNOSTICS n_notices = ROW_COUNT;
	DELETE FROM public.market_requests WHERE nonce IN (
		SELECT r.nonce FROM public.market_requests r WHERE r.created_at < cutoff LIMIT 5000);
	GET DIAGNOSTICS n_requests = ROW_COUNT;
	DELETE FROM public.market_offers WHERE id IN (
		SELECT o.id FROM public.market_offers o
		WHERE o.status NOT IN ('open', 'reset') AND COALESCE(o.closed_at, o.created_at) < cutoff
		ORDER BY o.id LIMIT 5000);
	GET DIAGNOSTICS n_offers = ROW_COUNT;
	DELETE FROM public.market_trades WHERE id IN (
		SELECT x.id FROM public.market_trades x
		WHERE x.tick < p_tick AND x.kind <> 'print'
		  AND NOT EXISTS (SELECT 1 FROM public.market_notices n WHERE n.trade_id = x.id)
		  AND NOT EXISTS (SELECT 1 FROM public.market_bullion_offers b WHERE b.trade_id = x.id)
		ORDER BY x.id LIMIT 5000);
	GET DIAGNOSTICS n_trades = ROW_COUNT;
	RETURN jsonb_build_object('notices', n_notices, 'requests', n_requests, 'offers', n_offers, 'trades', n_trades);
EXCEPTION WHEN OTHERS THEN
	RAISE WARNING 'market: housekeeping failed: %', SQLERRM;
	RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_prune(timestamptz, bigint) FROM PUBLIC, anon, authenticated;

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
	reset_at timestamptz := public._market_reset_at();
	came_home boolean;
	prev_t bigint;
BEGIN
	-- Nothing due? (No lock, no writes: the common read.)
	IF NOT public._market_due(now_t, v_now, reset_at) THEN
		RETURN now_t;
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);

	-- Still due, now that we hold the lock? A read that queued behind another
	-- read's advance at a tick boundary finds the work done and leaves,
	-- rather than every queued read redoing it in turn. The season guard is
	-- read again too: a flip may have run while we waited.
	reset_at := public._market_reset_at();
	IF NOT public._market_due(now_t, v_now, reset_at) THEN
		RETURN now_t;
	END IF;
	-- Where the walk had got to: an earlier UTC day means this is the day's
	-- first advance (step 4).
	SELECT MAX(mp.tick) INTO prev_t FROM public.market_prices mp;

	-- 0. A find with no price yet starts near its usual price.
	INSERT INTO public.market_prices (find_id, price, tick, last_active_tick)
	SELECT sf.id,
	       ROUND(public._market_clamp(public._market_usual(sf.id, t),
	           public._market_usual(sf.id, t) * (0.97 + 0.06 * public._market_unit('p0:' || sf.id))::numeric, t), 6),
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
			p := ROUND(public._market_clamp(u, p, t), 6);
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

	-- 1b. The flip was undone (unflip_season_2): listings it ended give their
	-- sets back — the escrow was kept on the row for exactly this. Notified as
	-- a plain take-down ("came home").
	IF reset_at IS NULL THEN
		FOR o IN SELECT * FROM public.market_offers WHERE status = 'reset' ORDER BY id FOR UPDATE LOOP
			BEGIN
				came_home := public._market_close(o, 'cancelled', v_now);
				PERFORM public._market_notice(o.user_id, 'expired', o, NULL);
			EXCEPTION WHEN OTHERS THEN
				RAISE WARNING 'market: restoring reset listing % failed: %', o.id, SQLERRM;
			END;
		END LOOP;
	END IF;

	-- 2. Listings older than their hours lapse; a set on offer comes home. A
	-- listing pinned before a season's fresh start ends too, its set reset
	-- with the bag it came from (_market_close keeps it from coming home).
	-- This runs while the market is closed too: time still passes.
	FOR o IN SELECT * FROM public.market_offers
	         WHERE status = 'open'
	           AND (expires_at <= v_now OR (reset_at IS NOT NULL AND posted_at < reset_at))
	         ORDER BY id FOR UPDATE LOOP
		-- Each its own subtransaction: one listing that cannot close must not
		-- stop every pig's read (it stays open and is retried next read).
		BEGIN
			IF public._market_pre_reset(o, reset_at) THEN
				PERFORM public._market_close(o, 'reset', v_now);
				PERFORM public._market_notice(o.user_id, 'reset', o, NULL);
			ELSE
				PERFORM public._market_close(o, 'expired', v_now);
				PERFORM public._market_notice(o.user_id, 'expired', o, NULL);
			END IF;
		EXCEPTION WHEN OTHERS THEN
			RAISE WARNING 'market: closing listing % failed: %', o.id, SQLERRM;
		END;
	END LOOP;

	-- 3. The counter keeps the board honest. Each crossing moves the price, so
	-- every listing is judged against the price as it stands when its turn
	-- comes, and priced by its own qty (the set size it was pinned at), never
	-- the current set size. Nothing crosses while the market is closed.
	IF COALESCE((t->>'enabled')::boolean, true) THEN
		FOR o IN SELECT * FROM public.market_offers
		         WHERE status = 'open' AND side IN ('sell', 'buy') ORDER BY id FOR UPDATE LOOP
			SELECT price INTO p FROM public.market_prices WHERE find_id = o.find_id;
			bid := public._market_bid_n(o.find_id, o.qty, p, t);
			ask := public._market_ask_n(o.find_id, o.qty, p, t);
			-- Each crossing is its own subtransaction: one listing that cannot
			-- settle (a pig with no bank row, a bank spent since the check) is
			-- taken down, and the market — every pig's read — keeps working.
			BEGIN
				IF o.side = 'sell' AND o.price <= bid AND public._market_counter_open(o.user_id, 'sell', now_t, t) THEN
					PERFORM public._market_counter_sell(o.user_id, o.find_id, o.escrow, 'crossed', o, now_t, t);
				ELSIF o.side = 'buy' AND o.price >= ask AND public._market_counter_open(o.user_id, 'buy', now_t, t) THEN
					IF COALESCE(public.tickle_balance(o.user_id), 0) < ask THEN
						PERFORM public._market_close(o, 'lapsed', v_now);
						PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
					ELSE
						PERFORM public._market_counter_buy(o.user_id, o.find_id, 'crossed', o, now_t, t);
					END IF;
				END IF;
			EXCEPTION WHEN OTHERS THEN
				RAISE WARNING 'market: crossing listing % failed, taking it down: %', o.id, SQLERRM;
				BEGIN
					PERFORM public._market_close(o, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, v_now);
					PERFORM public._market_notice(o.user_id, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, o, NULL);
				EXCEPTION WHEN OTHERS THEN
					RAISE WARNING 'market: taking listing % down failed too: %', o.id, SQLERRM;
				END;
			END;
		END LOOP;
	END IF;

	-- 4. Housekeeping, on the day's first advance (prints already go at seven
	-- days, above).
	IF prev_t IS NOT NULL AND prev_t / print_window < now_t / print_window THEN
		PERFORM public._market_prune(v_now, now_t - 30 * print_window);
	END IF;

	RETURN now_t;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_advance() FROM PUBLIC, anon, authenticated;

-- ── 4/5. Reads ───────────────────────────────────────────────────────────────
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
		-- Closed: nothing trades, but time still passes (a listing still
		-- expires and its set comes home) and your own listings stay in reach
		-- so you can take them down (market_cancel ignores the switch).
		-- Notices wait for the market to reopen (they are handed over once).
		now_t := public._market_advance();
		SELECT COALESCE(jsonb_agg(public._market_offer_json(o) ORDER BY o.id), '[]'::jsonb) INTO mine
		FROM public.market_offers o WHERE o.user_id = uid AND o.status = 'open';
		RETURN jsonb_build_object('ok', false, 'reason', 'closed', 'now', v_now, 'tick', now_t,
			'me', jsonb_build_object('id', uid, 'offers', mine, 'holdings', public._market_holdings(uid)));
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
		-- Kept for the client's shape: every wanted ad shown is payable.
		'poster_coin_ok', CASE WHEN o.side = 'buy' THEN true END)
		ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC), '[]'::jsonb) INTO board
	-- Cut the candidates cheaply first (open, not mine, public or for me; the
	-- newest 120), then run the per-row friendship / block checks on those.
	FROM (SELECT c.* FROM (
	          SELECT * FROM public.market_offers o
	          WHERE o.status = 'open' AND o.user_id <> uid AND (o.target_id IS NULL OR o.target_id = uid)
	          ORDER BY (o.target_id IS NOT DISTINCT FROM uid) DESC, o.id DESC LIMIT 120) c
	      -- A wanted ad its pig can't pay right now is not shown (it would only
	      -- lapse on the taker); nobody learns a stranger's bank, only that an
	      -- ad is up.
	      WHERE public._market_visible(uid, c)
	        AND (c.side <> 'buy' OR COALESCE(public.tickle_balance(c.user_id), 0) >= c.price)
	      ORDER BY (c.target_id IS NOT DISTINCT FROM uid) DESC, c.id DESC LIMIT 80) o;

	-- Player pins keep their ordering (For you first); Bullion is clearly named.
	board := board || public._market_bullion_board(now_t, t);

	-- By tick: a catch-up after a quiet spell inserts backdated prints find by
	-- find, so id order is not time order.
	SELECT COALESCE(jsonb_agg(public._market_tape_json(uid, x) ORDER BY x.tick DESC, x.id DESC), '[]'::jsonb) INTO tape
	FROM (SELECT * FROM public.market_trades tr ORDER BY tr.tick DESC, tr.id DESC LIMIT 24) x;

	WITH pending AS (
		UPDATE public.market_notices SET delivered_at = v_now
		-- Once: two overlapping reads (focus + poll, two devices) must not both
		-- hand the same notice over.
		WHERE id IN (SELECT n.id FROM public.market_notices n
		             WHERE n.user_id = uid AND n.delivered_at IS NULL ORDER BY n.id LIMIT 20
		             FOR UPDATE SKIP LOCKED)
		  AND delivered_at IS NULL
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
	      ORDER BY lower(pr.username) LIMIT 100) pr;

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
			'tick_minutes', t->'tick_minutes', 'counter_caps', t->'counter_caps',
			'bullion_board', t->'bullion_board'),
		'finds', COALESCE(finds, '[]'::jsonb),
		'me', jsonb_build_object(
			'id', uid,
			'coin', public.tickle_balance(uid),
			'cap', cap_val,
			'spent', COALESCE(led.spent, 0),
			'took_in', COALESCE(led.took_in, 0),
			'posts_today', posts,
			-- Sets bought off Bullion's shelf today (bullion_board.per_pig caps it).
			'shelf_today', (SELECT COUNT(*)::int FROM public.market_bullion_offers bo
			                WHERE bo.day = (v_now AT TIME ZONE 'UTC')::date AND bo.buyer_id = uid
			                  AND bo.status = 'filled'),
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
	IF NOT COALESCE((t->>'enabled')::boolean, true) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'closed');
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

	SELECT COALESCE(jsonb_agg(public._market_tape_json(uid, x) ORDER BY x.tick DESC, x.id DESC), '[]'::jsonb) INTO recent
	FROM (SELECT * FROM public.market_trades tr
	      WHERE (tr.find_id = p_find OR tr.want_find_id = p_find)
	      ORDER BY tr.tick DESC, tr.id DESC LIMIT 10) x;

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

-- ── 2. Writes: a post meets only listings of its own size; a take hands over
-- what was held ────────────────────────────────────────────────────────────
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
	IF NOT public._market_has_bank(uid) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;
	now_t := public._market_advance();

	u := public._market_usual(p_find, t);
	sz := public._market_set_size(p_find, t);
	exp := v_now + make_interval(hours => GREATEST(1, COALESCE((t->>'offer_hours')::int, 48)));
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
		IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', sz,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = p_find));
		END IF;
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
		-- (ads whose pig can't pay lapse on the way), for a set of the size we
		-- hand over (an ad posted at another set size waits for a taker).
		LOOP
			SELECT * INTO w FROM public.market_offers o
			WHERE o.status = 'open' AND o.side = 'buy' AND o.find_id = p_find AND o.user_id <> uid
			  AND o.qty = sz
			  AND o.price >= p_price AND public._market_visible(uid, o) AND public._market_has_bank(o.user_id)
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
			IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
				RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', sz,
					'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = p_find));
			END IF;
			INSERT INTO public.market_offers (user_id, find_id, side, price, qty, target_id, status, created_at, expires_at, closed_at)
			VALUES (uid, p_find, 'sell', p_price, sz, p_target, 'filled', v_now, exp, v_now);
			tr := public._market_settle_pig(uid, w.user_id, p_find, w.price, costs, 'wanted', w, now_t, t);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', true, 'filled', true, 'via', 'pig',
				'trade', public._market_tape_json(uid, tr)));
		END IF;
		IF p_price <= bid AND public._market_counter_open(uid, 'sell', now_t, t) THEN
			costs := public._market_take_units(uid, p_find, sz);
			IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
				RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', sz,
					'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = p_find));
			END IF;
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
		IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', sz,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = p_find));
		END IF;
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
	-- The cheapest listing at or under our price, holding a set of the size we
	-- want (one pinned at another set size waits for a taker).
	SELECT * INTO s FROM public.market_offers o
	WHERE o.status = 'open' AND o.side = 'sell' AND o.find_id = p_find AND o.user_id <> uid
	  AND o.qty = sz
	  AND o.price <= p_price AND public._market_visible(uid, o) AND public._market_has_bank(o.user_id)
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
-- a swap. A for-sale set or a swap hands over exactly the units held; a wanted
-- ad takes its own qty from your bag (the set size it was posted at).
CREATE OR REPLACE FUNCTION public.market_take(p_offer_id bigint, p_limit int, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._market_tuning();
	v_now timestamptz := public._patch_now();
	now_t bigint;
	o public.market_offers;
	n int;
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
	IF NOT public._market_has_bank(uid) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_bank');
	END IF;
	now_t := public._market_advance();
	IF p_offer_id < 0 THEN
		-- Reject bigint's minimum before negation so a malformed id fails
		-- closed instead of overflowing. Real ids are positive.
		IF p_offer_id = '-9223372036854775808'::bigint THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
		END IF;
		RETURN public._market_bullion_take(uid, -p_offer_id, p_limit, p_nonce, now_t, t);
	END IF;

	SELECT * INTO o FROM public.market_offers WHERE id = p_offer_id FOR UPDATE;
	IF NOT FOUND OR o.status <> 'open' OR NOT public._market_visible(uid, o) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF o.user_id = uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'own_offer');
	END IF;
	IF NOT public._market_has_bank(o.user_id) THEN
		-- Its pig can't be paid (or pay): take it down rather than fail every taker.
		PERFORM public._market_close(o, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, v_now);
		PERFORM public._market_notice(o.user_id, CASE WHEN o.side = 'buy' THEN 'lapsed' ELSE 'expired' END, o, NULL);
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;

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
		IF held < o.qty THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'held', held, 'set_size', o.qty);
		END IF;
		IF public.tickle_balance(o.user_id) < o.price THEN
			PERFORM public._market_close(o, 'lapsed', v_now);
			PERFORM public._market_notice(o.user_id, 'lapsed', o, NULL);
			RETURN public._market_done(uid, p_nonce, jsonb_build_object('ok', false, 'reason', 'lapsed'));
		END IF;
		costs := public._market_take_units(uid, o.find_id, o.qty);
		IF costs IS NULL THEN  -- the bag shrank since the count (outside the market lock)
			RETURN jsonb_build_object('ok', false, 'reason', 'not_a_set', 'set_size', o.qty,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = o.find_id));
		END IF;
		tr := public._market_settle_pig(uid, o.user_id, o.find_id, o.price, costs, 'wanted', o, now_t, t);
	ELSE
		-- Straight up: both sides move at once; no tickles; a swapped find
		-- carries no cost; the price stays put. The taker gets the units held.
		n := jsonb_array_length(o.escrow);
		sz := public._market_set_size(o.find_id, t);
		SELECT COUNT(*)::int INTO held FROM public.satchel_items WHERE user_id = uid AND find_id = o.want_find_id;
		IF held < o.want_qty THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'held', held, 'needed', o.want_qty);
		END IF;
		costs := public._market_take_units(uid, o.want_find_id, o.want_qty);
		IF costs IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_enough', 'needed', o.want_qty,
				'held', (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = uid AND find_id = o.want_find_id));
		END IF;
		PERFORM public._market_give_units(uid, o.find_id, public._market_costs(n, NULL), v_now);
		PERFORM public._market_give_units(o.user_id, o.want_find_id, public._market_costs(o.want_qty, NULL), v_now);
		INSERT INTO public.market_trades (kind, find_id, qty, seller_id, buyer_id, want_find_id, want_qty,
			give_val, want_val, cost, gave_cost, offer_id, target_id, poster_id, tick, created_at)
		VALUES ('swap', o.find_id, n, o.user_id, uid, o.want_find_id, o.want_qty,
			(SELECT CASE WHEN n = sz THEN price ELSE price * n / sz END FROM public.market_prices WHERE find_id = o.find_id),
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

-- ── 3/5. Bullion's daily shelf: never free, never fails the read, one a pig ──
-- The midpoint is quoted from live counter prices. Hide the offer if tuning
-- leaves no whole tickle strictly between the two prices. Never below 1.
CREATE OR REPLACE FUNCTION public._market_bullion_price(p_find text, p_t jsonb)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
    SELECT CASE WHEN q.ask - q.bid >= 2 THEN GREATEST(1, (q.ask + q.bid) / 2) END
    FROM (SELECT public._market_bid(public._market_usual(p_find, p_t), mp.price, p_t) AS bid,
                 public._market_ask(public._market_usual(p_find, p_t), mp.price, p_t) AS ask
          FROM public.market_prices mp WHERE mp.find_id = p_find) q;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_price(text, jsonb) FROM PUBLIC, anon, authenticated;

-- Any error building the shelf answers an empty shelf (a WARNING), never a
-- failed market_state.
CREATE OR REPLACE FUNCTION public._market_bullion_board(p_tick bigint, p_t jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
    v_now timestamptz := public._patch_now();
    today date := (v_now AT TIME ZONE 'UTC')::date;
    n int;
    board jsonb;
BEGIN
    BEGIN
        n := LEAST(6, GREATEST(0, COALESCE((p_t->'bullion_board'->>'daily_listings')::int, 3)));
        IF n = 0 THEN RETURN '[]'::jsonb; END IF;
        -- Only the current day is materialised. Filled slots still count, so a
        -- poll, another player, a quiet week or a restart never refills stock.
        IF (SELECT COUNT(*) FROM public.market_bullion_offers WHERE day = today) < n THEN
            PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
            INSERT INTO public.market_bullion_offers (day, slot, find_id, created_at)
            SELECT today, x.slot, x.id, v_now
            FROM (SELECT sf.id,
                         row_number() OVER (ORDER BY md5(today::text || ':' || sf.id), sf.id)::int AS slot
                  FROM public.satchel_finds sf) x
            WHERE x.slot <= n
            ON CONFLICT (day, slot) DO NOTHING;
        END IF;
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            -- Player offer ids are positive. Negative ids select this separate
            -- stock table through the existing market_take RPC.
            'id', -o.id, 'find_id', o.find_id, 'side', 'sell', 'price', q.price,
            'qty', public._market_set_size(o.find_id, p_t), 'source', 'bullion',
            'poster', jsonb_build_object('id', 'bullion', 'kind', 'bullion', 'name', 'Bullion'),
            'for_you', false, 'created_at', o.created_at,
            'expires_at', (today + 1)::timestamp AT TIME ZONE 'UTC', 'status', 'open')
            ORDER BY o.slot), '[]'::jsonb)
        INTO board
        FROM public.market_bullion_offers o
        CROSS JOIN LATERAL (SELECT public._market_bullion_price(o.find_id, p_t) AS price) q
        WHERE o.day = today AND o.slot <= n AND o.status = 'open' AND q.price IS NOT NULL;
        RETURN board;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'market: Bullion''s shelf failed, showing none: %', SQLERRM;
        RETURN '[]'::jsonb;
    END;
END;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_board(bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- Called only after market_take's auth, bank, lock, nonce replay and advance.
-- bullion_board.per_pig caps one pig's shelf buys a UTC day (null = off), so
-- one pig can't empty the shared shelf.
CREATE OR REPLACE FUNCTION public._market_bullion_take(p_user uuid, p_id bigint, p_limit int,
    p_nonce uuid, p_tick bigint, p_t jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
    v_now timestamptz := public._patch_now();
    today date := (v_now AT TIME ZONE 'UTC')::date;
    n int := LEAST(6, GREATEST(0, COALESCE((p_t->'bullion_board'->>'daily_listings')::int, 3)));
    per_pig jsonb := p_t->'bullion_board'->'per_pig';
    o public.market_bullion_offers;
    quote int;
    bal int;
    sz int;
    u int;
    p numeric;
    np numeric;
    tr public.market_trades;
BEGIN
    SELECT * INTO o FROM public.market_bullion_offers WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR o.day <> today OR o.status <> 'open' OR o.slot > n THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
    END IF;
    IF jsonb_typeof(per_pig) = 'number'
       AND (SELECT COUNT(*) FROM public.market_bullion_offers bo
            WHERE bo.day = today AND bo.buyer_id = p_user AND bo.status = 'filled') >= (per_pig #>> '{}')::int THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'shelf_limit', 'limit', (per_pig #>> '{}')::int);
    END IF;
    quote := public._market_bullion_price(o.find_id, p_t);
    IF quote IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
    IF p_limit IS NOT NULL AND quote > p_limit THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'price_moved', 'now', quote);
    END IF;
    IF NOT public._market_counter_open(p_user, 'buy', p_tick, p_t) THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'counter_limit', 'side', 'buy');
    END IF;
    bal := public.settle_tickles(p_user);
    IF bal < quote THEN
        RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_tickles', 'ready', bal, 'needed', quote);
    END IF;
    IF NOT public._market_spend(p_user, quote) THEN
        RAISE EXCEPTION 'market: daily shelf purchase without the tickles';
    END IF;
    sz := public._market_set_size(o.find_id, p_t);
    u := public._market_usual(o.find_id, p_t);
    SELECT price INTO p FROM public.market_prices WHERE find_id = o.find_id FOR UPDATE;
    PERFORM public._market_ledger(p_user, quote, 0);
    PERFORM public._market_give_units(p_user, o.find_id, public._market_costs(sz, quote), v_now);
    np := public._market_set_price(o.find_id, p + (p_t->'price'->>'impact')::numeric * u, p_tick, true, p_t);
    INSERT INTO public.market_trades (kind, side, how, find_id, qty, price, buyer_id,
        from_price, to_price, bid, ask, tick, created_at)
    VALUES ('counter', 'buy', 'board', o.find_id, sz, quote, p_user, p, np,
        public._market_bid(u, p, p_t), public._market_ask(u, p, p_t), p_tick, v_now)
    RETURNING * INTO tr;
    UPDATE public.market_bullion_offers SET status = 'filled', trade_id = tr.id, buyer_id = p_user WHERE id = o.id;
    RETURN public._market_done(p_user, p_nonce,
        jsonb_build_object('ok', true, 'trade', public._market_tape_json(p_user, tr)));
END;
$function$;
REVOKE ALL ON FUNCTION public._market_bullion_take(uuid, bigint, int, uuid, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- ── 8. The Season 2 flip, under the market lock ──────────────────────────────
-- The market lock first, so no listing is pinned, taken or crossed while the
-- bags reset; then flip_season_2 exactly as written. It stamps ran_at with
-- now(), this transaction's START, so a write that held the market lock when
-- the job began can have pinned a listing after that instant, which the
-- market's guard (posted_at < ran_at) would miss: its held set would come
-- home into the new season's bag. Under the lock nothing else is in flight,
-- so every listing still open was pinned from the bag the flip just reset:
-- they all end as the guard would end them ('reset', the set does not come
-- home, a 'reset' notice; an unflip gives the set back, F's step 1b). Only
-- when this call flipped and the Satchel was in scope. Owner-only: the cron
-- job runs it; a manual flip should too.
CREATE OR REPLACE FUNCTION public._season2_flip_market_locked(p_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	res jsonb;
	o public.market_offers;
	v_now timestamptz := public._patch_now();
	n int := 0;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtext('market')::bigint);
	res := public.flip_season_2(p_at);
	IF COALESCE((res->>'already_flipped')::boolean, true) = false AND public._market_reset_at() IS NOT NULL THEN
		FOR o IN SELECT * FROM public.market_offers WHERE status = 'open' ORDER BY id FOR UPDATE LOOP
			UPDATE public.market_offers SET status = 'reset', closed_at = v_now WHERE id = o.id;
			PERFORM public._market_notice(o.user_id, 'reset', o, NULL);
			n := n + 1;
		END LOOP;
	END IF;
	RETURN res || jsonb_build_object('market_reset', n);
END;
$function$;
REVOKE ALL ON FUNCTION public._season2_flip_market_locked(timestamptz) FROM PUBLIC, anon, authenticated;

-- Re-schedule season2-flip in place: the same schedule (0 0 9 11 *: Monday
-- 2026-11-09 00:00 UTC, cron.timezone GMT), the same p_at, the same date guard
-- and the same self-unschedule as 20261029260000, the flip now through the
-- wrapper. pg_cron runs the whole command in one transaction, and the lock is
-- taken inside the wrapper's own call anyway. Left alone (a NOTICE) when
-- pg_cron is absent (the local harness), when Season 2 has already flipped,
-- or when the job is not scheduled (it fired, or was removed on purpose).
DO $reschedule_flip$
BEGIN
	IF to_regclass('cron.job') IS NULL THEN
		RAISE NOTICE 'pg_cron is not installed here: season2-flip left alone';
		RETURN;
	END IF;
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RAISE NOTICE 'Season 2 has already flipped: season2-flip left alone';
		RETURN;
	END IF;
	IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'season2-flip') THEN
		RAISE NOTICE 'season2-flip is not scheduled: left alone';
		RETURN;
	END IF;
	IF to_regprocedure('public.flip_season_2(timestamptz, integer)') IS NULL THEN
		RAISE EXCEPTION 'flip_season_2(timestamptz, integer) is missing: the wrapper would fail at 00:00';
	END IF;
	PERFORM cron.unschedule('season2-flip');
	PERFORM cron.schedule('season2-flip', '0 0 9 11 *',
		$cmd$SELECT public._season2_flip_market_locked('2026-11-09 00:00:00+00'::timestamptz) WHERE now() < '2026-11-10 00:00:00+00'::timestamptz; SELECT cron.unschedule('season2-flip');$cmd$);
	IF (SELECT count(*) FROM cron.job WHERE jobname = 'season2-flip') <> 1 THEN
		RAISE EXCEPTION 'season2-flip is not scheduled exactly once';
	END IF;
END
$reschedule_flip$;

-- The Ghost Sheep v2: sets and trade-ups (2026-10-29, founder-picked
-- direction A of the trader canvas, docs/design/claude-design/trader-2026-10-29).
--
-- One sentence: pairs pay more, three alike go up.
--   * He still buys singles at 3 / 8 / 20 applied tickles by rarity, the find
--     he fancies x2 (unchanged).
--   * A PAIR handed over within one visit pays half again. Judged HERE, over
--     the visit's own trader_sales (no multi-select RPC): the sale that
--     completes a pair of one find (the 2nd, 4th, ... of that find this visit)
--     carries a pair_bonus = FLOOR((the unpaired sale's price + this price)
--     x (pair_multiplier - 1)). Two river pebbles: 3 + (3 + 3) = 9.
--   * THREE ALIKE trade up one rarity: trade_up_with_trader(find_id, nonce)
--     takes three of one find out of the bag and puts ONE find of the next
--     rarity back, his seeded pick for the (pig, day, rarity). Rare has no
--     trade-up: nothing sits above it. A 3 -> 1 sink, never a faucet: no
--     tickles move, no snouts ever, and only finds (never anything bought).
--   * The cap that moves 6 -> 9 is HIS bag, finds_per_visit (the canvas: "the
--     bag of six grows to nine so a hand can actually form"). The Satchel's
--     own cap has been the unbounded 9999 sentinel since
--     20260918090000_satchel_unbounded.sql (founder ruling 2026-09-18), so it
--     is left alone: lowering it to 9 would undo that ruling. A trade-up
--     counts its three finds against the visit (the receipt board: "takes 6
--     more" -> a pair + a trade-up -> "takes 1 more").
--   * Flushes (sets of different finds) are deferred.
--
-- Charter: no new currency (applied tickles only, the COUNT, never snouts:
-- 20260920100000) - finds given-never-sold stands for everything but the
-- trader's own ledger - a trade-up is finds for a find.
--
-- Carry-latest-def (every function below is CREATE OR REPLACE'd from its
-- alphabetically-latest definition across ALL migrations, checked with
-- `grep -l "FUNCTION public.<name>" supabase/migrations/*`):
--   _trader_tuning()            from 20260917170000_ghost_sheep_trader.sql (its only def)
--   _trader_status_json(uuid)   from 20260917170000_ghost_sheep_trader.sql (its only def)
--   trade_with_trader(bigint, uuid)
--                               from 20260920100000_trader_pays_tickles_not_snouts.sql
--                               (latest; supersedes 20260917170000)
--   satchel_items_source_check  from 20260918120000_pig_errands.sql (latest)
-- trader_status() and dev_summon_trader() are NOT redefined: both answer
-- through _trader_status_json, so they pick the new fields up untouched.
--
-- What changes, section by section:
--   1. trader_tuning gains pair_multiplier 1.5, trade_up true, trade_up_count
--      3; finds_per_visit 6 -> 9. (The canvas's {pairMultiplier, tradeUp}
--      spelled in the row's existing snake_case.)
--   2. trader_sales gains kind ('sale' | 'trade_up'), pair_bonus, and the
--      trade-up's audit columns (item_ids, got_find_id, got_item_id,
--      new_to_bag). A trade-up is ONE ledger row (its nonce), tickles 0.
--   3. satchel_items.source gains 'trader' (the find that came back).
--   4. _trader_trade_up_pick(user, day, rarity): his seeded pick.
--   5. _trader_status_json: + pair_multiplier, trade_up, trade_up_count, and
--      on the visit (only while he is here) `unpaired` (finds one sale into a
--      pair this visit, so the client can price the next one honestly) and
--      `trade_ups` ({from rarity: the find that comes back}).
--   6. trade_with_trader: same signature, same answer + `pair`, `pair_bonus`;
--      the pair judged over the visit's sales. A binary already calling it
--      keeps working (and is simply paid the bonus).
--   7. trade_up_with_trader(p_find_id text, p_nonce uuid): NEW. Fail-closed
--      {ok:false, reason}: not_authenticated - bad_nonce - not_here -
--      no_trade_up (switched off / rare / unknown find) - had_enough (fewer
--      than three left this visit) - not_enough (fewer than three in the bag,
--      with the live bag). Idempotent on the nonce: a replay answers the
--      original receipt and never takes a second hand.
--
-- The testable clock is _patch_now() (ttp.fake_now-aware). Validated on the
-- stubbed-Postgres harness: scripts/db-harness/A4_trader_sets_and_trade_ups_smoke.sql.
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
-- Merge: the new keys land, finds_per_visit is deliberately overwritten 6 -> 9,
-- everything else in the row (stay, window, prices, want) stays as it is.
UPDATE public.app_settings
SET value = COALESCE(value, '{}'::jsonb)
		|| '{"finds_per_visit": 9, "pair_multiplier": 1.5, "trade_up": true, "trade_up_count": 3}'::jsonb,
    description = 'The Ghost Sheep Trader (20260917170000, sets and trade-ups 20261029210000): hours he stays (one visit per pig per local day), the local-time window [start_hour, end_hour) his arrival is drawn from, tickles per find by rarity, the multiplier on the find he fancies, finds he takes per visit, the multiplier on a pair of one find within a visit, and whether three alike trade up one rarity (trade_up_count of them).'
WHERE key = 'trader_tuning';

INSERT INTO public.app_settings (key, value, description)
SELECT 'trader_tuning',
	'{"stay_hours": 6,
	  "window": {"start_hour": 8, "end_hour": 22},
	  "prices": {"common": 3, "uncommon": 8, "rare": 20},
	  "want_multiplier": 2,
	  "finds_per_visit": 9,
	  "pair_multiplier": 1.5,
	  "trade_up": true,
	  "trade_up_count": 3}'::jsonb,
	'The Ghost Sheep Trader (20260917170000, sets and trade-ups 20261029210000): hours he stays (one visit per pig per local day), the local-time window [start_hour, end_hour) his arrival is drawn from, tickles per find by rarity, the multiplier on the find he fancies, finds he takes per visit, the multiplier on a pair of one find within a visit, and whether three alike trade up one rarity (trade_up_count of them).'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'trader_tuning');

-- Carried from 20260917170000 (its only def); the fallback learns the new keys.
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
REVOKE ALL ON FUNCTION public._trader_tuning() FROM PUBLIC, anon, authenticated;

-- ── 2. The ledger learns pairs and trade-ups ─────────────────────────────────
ALTER TABLE public.trader_sales
	ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'sale',
	-- The half-again on the sale that completed a pair (already inside `tickles`).
	ADD COLUMN IF NOT EXISTS pair_bonus int NOT NULL DEFAULT 0,
	-- A trade-up: every bag row it took (item_id holds the first), and the
	-- find + bag row that came back.
	ADD COLUMN IF NOT EXISTS item_ids bigint[],
	ADD COLUMN IF NOT EXISTS got_find_id text REFERENCES public.satchel_finds(id),
	ADD COLUMN IF NOT EXISTS got_item_id bigint,
	ADD COLUMN IF NOT EXISTS new_to_bag boolean NOT NULL DEFAULT false;
ALTER TABLE public.trader_sales DROP CONSTRAINT IF EXISTS trader_sales_kind_check;
ALTER TABLE public.trader_sales
	ADD CONSTRAINT trader_sales_kind_check CHECK (kind IN ('sale', 'trade_up'));
ALTER TABLE public.trader_sales DROP CONSTRAINT IF EXISTS trader_sales_pair_bonus_check;
ALTER TABLE public.trader_sales
	ADD CONSTRAINT trader_sales_pair_bonus_check CHECK (pair_bonus >= 0 AND pair_bonus <= tickles);
-- The pair judge reads one visit's sales of one find.
CREATE INDEX IF NOT EXISTS trader_sales_visit_find_idx
	ON public.trader_sales (visit_id, find_id) WHERE kind = 'sale';

-- ── 3. A bag row can come back from the trader ───────────────────────────────
-- Carried from 20260918120000_pig_errands.sql (the latest); + 'trader'.
ALTER TABLE public.satchel_items
	DROP CONSTRAINT IF EXISTS satchel_items_source_check;
ALTER TABLE public.satchel_items
	ADD CONSTRAINT satchel_items_source_check
	CHECK (source IN ('dig', 'swap', 'gift', 'migrated_shelf', 'errand', 'trader'));

-- ── 4. His pick ──────────────────────────────────────────────────────────────
-- The find of p_rarity that comes back for three alike on (pig, day): seeded,
-- so the sheet can show it before the hand-over and every device agrees.
CREATE OR REPLACE FUNCTION public._trader_trade_up_pick(p_user uuid, p_day date, p_rarity text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT f.id
	FROM public.satchel_finds f
	WHERE f.rarity = p_rarity
	ORDER BY public._trader_unit(p_user::text || ':' || p_day::text || ':up:' || f.id), f.sort
	LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public._trader_trade_up_pick(uuid, date, text) FROM PUBLIC, anon, authenticated;

-- The rarity one step up; NULL above rare.
CREATE OR REPLACE FUNCTION public._trader_next_rarity(p_rarity text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE p_rarity WHEN 'common' THEN 'uncommon' WHEN 'uncommon' THEN 'rare' ELSE NULL END;
$function$;
REVOKE ALL ON FUNCTION public._trader_next_rarity(text) FROM PUBLIC, anon, authenticated;

-- ── 5. The status payload ────────────────────────────────────────────────────
-- Carried from 20260917170000 (its only def). Adds the pair / trade-up tuning
-- and, on a visit he is present for, `unpaired` + `trade_ups`.
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
REVOKE ALL ON FUNCTION public._trader_status_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── 6. trade_with_trader: the pair, judged over the visit ────────────────────
-- Carried from 20260920100000_trader_pays_tickles_not_snouts.sql (the latest
-- def). Changes: the default cap 9, the pair judge (step 4b), the ledger's
-- pair_bonus, `pair` / `pair_bonus` in the answer (and its replay), and a
-- trade-up's nonce is not a sale's.
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
REVOKE ALL ON FUNCTION public.trade_with_trader(bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_with_trader(bigint, uuid) TO authenticated;

-- ── 7. trade_up_with_trader: three alike, one up ─────────────────────────────
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
REVOKE ALL ON FUNCTION public.trade_up_with_trader(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_up_with_trader(text, uuid) TO authenticated;

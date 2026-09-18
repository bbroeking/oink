-- The Ghost Sheep Trader (20260917170000_ghost_sheep_trader.sql): a hooded
-- wandering trader who turns up ONCE A DAY for six hours at an hour that is
-- random per pig, and takes finds for tickles.
--
-- Asserts:
--   1. The day's visit: one row per (pig, local day); arrival inside the tuned
--      local window, a six-hour stay; the same answer on every read (no second
--      row, same times); two pigs draw different hours; the want hidden until
--      he is here.
--   2. Before he arrives: trade_with_trader → not_here (with arrives_at),
--      nothing moved.
--   3. While he is here: a common pays the common price, the fancied find the
--      multiplier, an uncommon the uncommon price; each sale deletes exactly
--      one bag row, writes one ledger row, applies tickles (tickles_earned AND
--      counter, never the bank), answers before/after and the WHOLE bag.
--   4. The nonce replay: the ORIGINAL receipt with replay:true, nothing sold
--      twice. Someone else's find → not_in_bag; a stranger's nonce → bad_nonce.
--   5. The per-visit cap → had_enough with leaves_at.
--   6. After he leaves: not_here; status turns to TOMORROW's visit (fresh cap,
--      a different want); a day nobody looks in is simply missed (no carry-over).
--   7. tickle_breakdown's `trader` lane, and an untouched pig's residual.
--   8. unlock_field_guide_page('trader') is whitelisted.
--   9. dev_summon_trader: admin_only for a normal pig; for a test pig it starts
--      a visit NOW (present, six hours, count reset), a sale works at once, and
--      a second summon resets the count while the ledger keeps every sale.
--
-- Fixture ids live in the ...0B000n block so they cannot collide with the
-- satchel smokes' ...0900xx / ...0A00xx blocks. Pigs have no feeding zone set,
-- so the trader keeps America/New_York time — 2026-05-01 is EDT (UTC−4).
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $trader$
DECLARE
	p    uuid := '00000000-0000-0000-0000-0000000b0001'; -- the seller
	q    uuid := '00000000-0000-0000-0000-0000000b0002'; -- a bystander with a bag; later the test pig
	u    uuid := '00000000-0000-0000-0000-0000000b0003'; -- never traded
	res jsonb; res2 jsonb;
	visit_id bigint; arrives timestamptz; leaves timestamptz; want text; want2 text;
	q_arrives timestamptz;
	t0 timestamptz := '2026-05-01 12:00+00'; -- 08:00 EDT on 2026-05-01
	win_lo timestamptz := '2026-05-01 08:00-04';
	win_hi timestamptz := '2026-05-01 16:00-04'; -- end_hour 22 − stay 6
	pebble_id bigint; feather_id bigint; key_id bigint; shell_id bigint;
	cone_id bigint; clover_id bigint; other_id bigint; q_item bigint;
	n int; earned int; cnt int;
	nonce1 uuid := '00000000-0000-0000-0000-00000000d001';
	nonce2 uuid := '00000000-0000-0000-0000-00000000d002';
	nonce3 uuid := '00000000-0000-0000-0000-00000000d003';
	nonce4 uuid := '00000000-0000-0000-0000-00000000d004';
	nonce5 uuid := '00000000-0000-0000-0000-00000000d005';
	nonce6 uuid := '00000000-0000-0000-0000-00000000d006';
	nonce7 uuid := '00000000-0000-0000-0000-00000000d007';
	nonce8 uuid := '00000000-0000-0000-0000-00000000d008';
	raised boolean := false;
BEGIN
	-- ── fixtures ─────────────────────────────────────────────────────────────
	UPDATE public.app_settings SET value = value || '{
		"stay_hours": 6, "window": {"start_hour": 8, "end_hour": 22},
		"prices": {"common": 3, "uncommon": 8, "rare": 20},
		"want_multiplier": 2, "finds_per_visit": 3}'::jsonb
		WHERE key = 'trader_tuning';

	INSERT INTO auth.users(id) VALUES (p),(q),(u) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id, username, discriminator, tickles_earned, counter, alignment_score) VALUES
		(p,'trader-seller','0001',100,100,0), (q,'trader-other','0002',0,0,0),
		(u,'trader-never','0003',7,7,0)
		ON CONFLICT(id) DO UPDATE SET username = EXCLUDED.username,
			discriminator = EXCLUDED.discriminator,
			tickles_earned = EXCLUDED.tickles_earned,
			counter = EXCLUDED.counter, alignment_score = EXCLUDED.alignment_score;
	UPDATE public.profiles SET is_test = false WHERE id IN (p,q,u);
	DELETE FROM public.trader_sales WHERE user_id IN (p,q,u);
	DELETE FROM public.trader_visits WHERE user_id IN (p,q,u);
	DELETE FROM public.satchel_items WHERE user_id IN (p,q,u);
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'river_pebble') RETURNING id INTO pebble_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'blue_feather') RETURNING id INTO feather_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'old_key')      RETURNING id INTO key_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'snail_shell')  RETURNING id INTO shell_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'pinecone')     RETURNING id INTO cone_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (p,'clover')       RETURNING id INTO clover_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (q,'river_pebble') RETURNING id INTO other_id;

	PERFORM set_config('ttp.fake_now', t0::text, true);
	PERFORM set_config('smoke.uid', p::text, true);

	-- ── 1. the day's visit ───────────────────────────────────────────────────
	res := public.trader_status();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'trader_status: %', res; END IF;
	arrives := (res->'visit'->>'arrives_at')::timestamptz;
	leaves := (res->'visit'->>'leaves_at')::timestamptz;
	visit_id := (res->'visit'->>'id')::bigint;
	IF (res->'visit'->>'day')::date <> '2026-05-01' THEN RAISE EXCEPTION 'the visit belongs to the local day: %', res; END IF;
	IF arrives < win_lo OR arrives >= win_hi THEN RAISE EXCEPTION 'arrival must sit in the local window, got %', arrives; END IF;
	IF leaves <> arrives + interval '6 hours' THEN RAISE EXCEPTION 'stay must be 6h, got %', leaves; END IF;
	IF (res->>'present')::boolean <> (arrives <= t0) THEN RAISE EXCEPTION 'present must follow the window: %', res; END IF;
	IF (res->'visit'->>'finds_left')::int <> 3 THEN RAISE EXCEPTION 'finds_left must be the cap: %', res; END IF;
	IF (res->>'met')::boolean THEN RAISE EXCEPTION 'not met yet'; END IF;
	IF res->'prices' <> '{"common":3,"uncommon":8,"rare":20}'::jsonb THEN RAISE EXCEPTION 'prices: %', res->'prices'; END IF;
	-- the same answer on every read
	res2 := public.trader_status();
	IF (res2->'visit'->>'id')::bigint <> visit_id OR (res2->'visit'->>'arrives_at')::timestamptz <> arrives THEN
		RAISE EXCEPTION 'status must not re-roll: % vs %', res, res2; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_visits WHERE user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'one visit expected, got %', n; END IF;
	-- the computed visit agrees with the stored one (a pure function of pig + day)
	IF (SELECT c.arrives_at FROM public._trader_visit_for(p, '2026-05-01', 'America/New_York') c) <> arrives THEN
		RAISE EXCEPTION 'the stored visit must equal the computed one'; END IF;
	-- another pig draws another hour
	PERFORM set_config('smoke.uid', q::text, true);
	res2 := public.trader_status();
	q_arrives := (res2->'visit'->>'arrives_at')::timestamptz;
	IF q_arrives = arrives THEN RAISE EXCEPTION 'two pigs must not share an hour (%)', arrives; END IF;
	IF q_arrives < win_lo OR q_arrives >= win_hi THEN RAISE EXCEPTION 'q arrival off-window: %', q_arrives; END IF;
	PERFORM set_config('smoke.uid', p::text, true);

	-- pin the clock BEFORE his arrival, whatever hour he drew
	PERFORM set_config('ttp.fake_now', (arrives - interval '1 minute')::text, true);
	res := public.trader_status();
	IF (res->>'present')::boolean THEN RAISE EXCEPTION 'not here a minute before'; END IF;
	IF res->'visit'->>'want_find_id' IS NOT NULL THEN
		RAISE EXCEPTION 'the want is his to say — hidden until he is here: %', res; END IF;

	-- ── 2. before he arrives ─────────────────────────────────────────────────
	res := public.trade_with_trader(pebble_id, nonce1);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_here' THEN RAISE EXCEPTION 'expected not_here: %', res; END IF;
	IF (res->>'arrives_at')::timestamptz <> arrives THEN RAISE EXCEPTION 'not_here must say when: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = p;
	IF n <> 6 THEN RAISE EXCEPTION 'nothing may move before he is here'; END IF;

	-- ── 3. while he is here ──────────────────────────────────────────────────
	PERFORM set_config('ttp.fake_now', (arrives + interval '1 minute')::text, true);
	res := public.trader_status();
	IF NOT (res->>'present')::boolean THEN RAISE EXCEPTION 'he should be here: %', res; END IF;
	want := res->'visit'->>'want_find_id';
	IF want IS NULL THEN RAISE EXCEPTION 'the want shows once he is here'; END IF;

	-- Pin the want to something in the bag so the multiplier is reachable.
	UPDATE public.trader_visits SET want_find_id = 'blue_feather' WHERE id = visit_id;

	-- 3a. a common at the common price
	res := public.trade_with_trader(pebble_id, nonce1);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'sale 1: %', res; END IF;
	IF (res->>'replay')::boolean THEN RAISE EXCEPTION 'first sale is not a replay'; END IF;
	IF res->>'find_id' <> 'river_pebble' OR (res->>'tickles')::int <> 3 OR (res->>'was_want')::boolean THEN
		RAISE EXCEPTION 'sale 1 receipt: %', res; END IF;
	IF (res->>'before')::int <> 100 OR (res->>'after')::int <> 103 THEN RAISE EXCEPTION 'sale 1 tally: %', res; END IF;
	IF (res->>'finds_left')::int <> 2 THEN RAISE EXCEPTION 'sale 1 finds_left: %', res; END IF;
	IF jsonb_array_length(res->'bag') <> 5 THEN RAISE EXCEPTION 'sale 1 must answer the whole bag: %', res->'bag'; END IF;
	IF EXISTS (SELECT 1 FROM public.satchel_items WHERE id = pebble_id) THEN RAISE EXCEPTION 'the pebble must be gone'; END IF;
	SELECT tickles_earned, counter INTO earned, cnt FROM public.profiles WHERE id = p;
	IF earned <> 103 OR cnt <> 103 THEN RAISE EXCEPTION 'apply_tickles: earned=% counter=%', earned, cnt; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_sales WHERE user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'one ledger row expected, got %', n; END IF;

	-- 3b. the find he fancies, doubled
	res := public.trade_with_trader(feather_id, nonce2);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'sale 2: %', res; END IF;
	IF (res->>'tickles')::int <> 6 OR NOT (res->>'was_want')::boolean THEN RAISE EXCEPTION 'the want pays double: %', res; END IF;
	IF (res->>'before')::int <> 103 OR (res->>'after')::int <> 109 THEN RAISE EXCEPTION 'sale 2 tally: %', res; END IF;

	-- ── 4. the replay, not yours, not your nonce ─────────────────────────────
	res2 := public.trade_with_trader(feather_id, nonce2);
	IF NOT (res2->>'ok')::boolean OR NOT (res2->>'replay')::boolean THEN RAISE EXCEPTION 'replay: %', res2; END IF;
	IF (res2->>'tickles')::int <> 6 OR res2->>'find_id' <> 'blue_feather' THEN RAISE EXCEPTION 'replay must be the original receipt: %', res2; END IF;
	IF (res2->>'after')::int <> 109 THEN RAISE EXCEPTION 'replay must not pay again: %', res2; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_sales WHERE user_id = p;
	IF n <> 2 THEN RAISE EXCEPTION 'replay wrote a row: %', n; END IF;
	SELECT tickles_earned INTO earned FROM public.profiles WHERE id = p;
	IF earned <> 109 THEN RAISE EXCEPTION 'replay paid: %', earned; END IF;

	res := public.trade_with_trader(other_id, nonce3);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_in_bag' THEN RAISE EXCEPTION 'expected not_in_bag: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.satchel_items WHERE id = other_id AND user_id <> q) THEN RAISE EXCEPTION 'the other bag moved'; END IF;
	PERFORM set_config('smoke.uid', q::text, true);
	res := public.trade_with_trader(other_id, nonce2);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_nonce' THEN RAISE EXCEPTION 'expected bad_nonce: %', res; END IF;
	PERFORM set_config('smoke.uid', p::text, true);

	-- 3c. an uncommon at the uncommon price, and that spends the visit
	res := public.trade_with_trader(key_id, nonce4);
	IF NOT (res->>'ok')::boolean OR (res->>'tickles')::int <> 8 THEN RAISE EXCEPTION 'sale 3: %', res; END IF;
	IF (res->>'finds_left')::int <> 0 THEN RAISE EXCEPTION 'sale 3 finds_left: %', res; END IF;
	IF (res->>'visit_tickles')::int <> 17 THEN RAISE EXCEPTION 'visit tally: %', res; END IF;

	-- ── 5. had enough ────────────────────────────────────────────────────────
	res := public.trade_with_trader(shell_id, nonce5);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'had_enough' THEN RAISE EXCEPTION 'expected had_enough: %', res; END IF;
	IF (res->>'leaves_at')::timestamptz <> leaves THEN RAISE EXCEPTION 'had_enough must say until when: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.satchel_items WHERE id = shell_id) THEN RAISE EXCEPTION 'the shell must stay'; END IF;
	res := public.trader_status();
	IF (res->'visit'->>'finds_left')::int <> 0 OR NOT (res->>'met')::boolean OR (res->>'sales')::int <> 3 THEN
		RAISE EXCEPTION 'status after the visit: %', res; END IF;

	-- ── 6. after he leaves: tomorrow, and a missed day ───────────────────────
	PERFORM set_config('ttp.fake_now', (leaves + interval '1 minute')::text, true);
	res := public.trade_with_trader(shell_id, nonce6);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_here' THEN RAISE EXCEPTION 'expected not_here after leaving: %', res; END IF;
	res := public.trader_status();
	IF (res->>'present')::boolean THEN RAISE EXCEPTION 'he left'; END IF;
	IF (res->'visit'->>'id')::bigint = visit_id THEN RAISE EXCEPTION 'once today ends, status turns to tomorrow'; END IF;
	IF (res->'visit'->>'day')::date <> '2026-05-02' THEN RAISE EXCEPTION 'tomorrow is the next visit: %', res; END IF;
	IF (res->'visit'->>'arrives_at')::timestamptz < '2026-05-02 08:00-04' OR (res->'visit'->>'arrives_at')::timestamptz >= '2026-05-02 16:00-04' THEN
		RAISE EXCEPTION 'tomorrow''s arrival off-window: %', res; END IF;
	IF (res->'visit'->>'finds_left')::int <> 3 THEN RAISE EXCEPTION 'a new visit starts fresh: %', res; END IF;
	SELECT want_find_id INTO want2 FROM public.trader_visits WHERE user_id = p AND day = '2026-05-02';
	IF want2 = public._trader_want_for(p, '2026-05-01', public._trader_want_for(p, '2026-04-30', NULL)) THEN
		RAISE EXCEPTION 'never the same want two days running'; END IF;
	-- nobody looks in on 05-02; on 05-03 the read is 05-03's (or 05-04's if it
	-- has ended) — 05-02's row stays untouched and unsold: no carry-over.
	PERFORM set_config('ttp.fake_now', '2026-05-03 12:00+00', true);
	res := public.trader_status();
	IF (res->'visit'->>'day')::date NOT IN ('2026-05-03', '2026-05-04') THEN RAISE EXCEPTION 'a missed day does not carry over: %', res; END IF;
	SELECT sold INTO n FROM public.trader_visits WHERE user_id = p AND day = '2026-05-02';
	IF n <> 0 THEN RAISE EXCEPTION 'the missed day sold something?'; END IF;
	IF (SELECT COUNT(*) FROM public.trader_visits WHERE user_id = p AND day = '2026-05-02') <> 1 THEN
		RAISE EXCEPTION 'one row per day'; END IF;

	-- ── 7. the glass box ─────────────────────────────────────────────────────
	res := public.tickle_breakdown(p);
	IF (res->>'trader')::int <> 17 THEN RAISE EXCEPTION 'trader lane: %', res; END IF;
	res := public.tickle_breakdown(u);
	IF (res->>'trader')::int <> 0 OR (res->>'home_taps')::int <> 7 THEN RAISE EXCEPTION 'untouched pig: %', res; END IF;

	-- ── 8. the Field Guide ───────────────────────────────────────────────────
	PERFORM public.unlock_field_guide_page('trader');
	IF NOT EXISTS (SELECT 1 FROM public.field_guide_pages WHERE user_id = p AND page_id = 'trader') THEN
		RAISE EXCEPTION 'the trader page must unlock'; END IF;

	-- ── 9. the dev summon ────────────────────────────────────────────────────
	BEGIN
		PERFORM public.dev_summon_trader();
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM <> 'admin_only' THEN RAISE; END IF;
		raised := true;
	END;
	IF NOT raised THEN RAISE EXCEPTION 'a normal pig must not summon him'; END IF;

	UPDATE public.profiles SET is_test = true WHERE id = q;
	PERFORM set_config('smoke.uid', q::text, true);
	PERFORM set_config('ttp.fake_now', '2026-05-03 12:00+00', true);
	res := public.dev_summon_trader();
	IF NOT (res->>'ok')::boolean OR NOT (res->>'present')::boolean THEN RAISE EXCEPTION 'summon: %', res; END IF;
	IF (res->'visit'->>'arrives_at')::timestamptz <> '2026-05-03 12:00+00' THEN RAISE EXCEPTION 'summon arrives now: %', res; END IF;
	IF (res->'visit'->>'leaves_at')::timestamptz <> '2026-05-03 18:00+00' THEN RAISE EXCEPTION 'summon stays 6h: %', res; END IF;
	IF (res->'visit'->>'finds_left')::int <> 3 OR res->'visit'->>'want_find_id' IS NULL THEN RAISE EXCEPTION 'summon fresh + want: %', res; END IF;
	res2 := public.trader_status();
	IF NOT (res2->>'present')::boolean OR (res2->'visit'->>'id')::bigint <> (res->'visit'->>'id')::bigint THEN
		RAISE EXCEPTION 'status must read the summoned visit: %', res2; END IF;
	-- a sale works at once
	res := public.trade_with_trader(other_id, nonce7);
	IF NOT (res->>'ok')::boolean OR (res->>'tickles')::int < 3 THEN RAISE EXCEPTION 'summoned sale: %', res; END IF;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (q,'pinecone') RETURNING id INTO q_item;
	-- a second summon resets the count; the ledger keeps the sale
	res := public.dev_summon_trader();
	IF (res->'visit'->>'finds_left')::int <> 3 THEN RAISE EXCEPTION 'summon must reset the count: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_sales WHERE user_id = q;
	IF n <> 1 THEN RAISE EXCEPTION 'the ledger must keep the sale: %', n; END IF;
	res := public.trade_with_trader(q_item, nonce8);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'sale after re-summon: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.trader_visits WHERE user_id = q AND day = '2026-05-03';
	IF n <> 1 THEN RAISE EXCEPTION 'summon keeps one row per day: %', n; END IF;

	PERFORM set_config('ttp.fake_now', '', true);
	RAISE NOTICE 'chk 98 ghost sheep trader: ok';
END;
$trader$;

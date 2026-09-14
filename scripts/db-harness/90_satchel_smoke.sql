-- The Satchel (20260915010000): a Dig rolls finds onto the receipt and into
-- the bag (capped, overflow listed lost); every pig has one wish; a matching
-- find hands over ONCE per wish, moves flat tickles to both, rerolls the wish
-- away from the given find, writes the host's while-away line and a heart
-- (the guestbook is retired — no stamp); a wrong find, a repeat, a non-friend and a foreign item are refused
-- with a reason and change nothing; toss removes; the owner's "not this one"
-- is single-use; the Board's counts read back.
\set ON_ERROR_STOP on

DO $satchel$
DECLARE
	giver uuid := '00000000-0000-0000-0000-000000090001';
	host  uuid := '00000000-0000-0000-0000-000000090002';
	other uuid := '00000000-0000-0000-0000-000000090003';
	res jsonb; bag jsonb; w jsonb; item_id bigint; wrong_id bigint; n int;
	g_before int; h_before int; wish_find text; other_find text; first_wish_no bigint;
	fake_receipt jsonb;
BEGIN
	INSERT INTO auth.users(id) VALUES (giver),(host),(other) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,tickles_earned,counter) VALUES
		(giver,'satchel-giver',40,40),(host,'satchel-host',7,7),(other,'satchel-other',0,0)
		ON CONFLICT(id) DO UPDATE SET tickles_earned=EXCLUDED.tickles_earned, counter=EXCLUDED.counter;

	-- ── 1. the Dig hook: a receipt insert rolls finds, capped at the bag ─────
	-- Force "two finds every dig" through the tuning row, then a full bag.
	UPDATE public.app_settings SET value = value || '{"find_odds":{"none":0,"one":0,"two":1},"cap":3}'::jsonb
		WHERE key = 'satchel_tuning';
	fake_receipt := '{"ok": true, "mode": "snout_deep"}'::jsonb;
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt) VALUES (giver, 900001, fake_receipt);
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt) VALUES (giver, 900002, fake_receipt);
	SELECT COUNT(*) INTO n FROM public.satchel_items WHERE user_id = giver;
	IF n <> 3 THEN RAISE EXCEPTION 'cap 3: expected 3 items after two 2-find digs, got %', n; END IF;
	SELECT receipt INTO res FROM public.rooting_receipts WHERE user_id = giver AND window_index = 900002;
	IF jsonb_array_length(res->'satchel'->'found') <> 1 OR jsonb_array_length(res->'satchel'->'lost') <> 1 THEN
		RAISE EXCEPTION 'second dig should list 1 found + 1 lost, got %', res->'satchel';
	END IF;
	IF (res->'satchel'->>'cap')::int <> 3 OR (res->'satchel'->>'count')::int <> 3 THEN
		RAISE EXCEPTION 'receipt satchel count/cap wrong: %', res->'satchel';
	END IF;
	-- a conflicting re-insert (the submit core's ON CONFLICT DO NOTHING) rolls nothing
	INSERT INTO public.rooting_receipts(user_id, window_index, receipt) VALUES (giver, 900002, fake_receipt)
		ON CONFLICT DO NOTHING;
	SELECT COUNT(*) INTO n FROM public.satchel_items WHERE user_id = giver;
	IF n <> 3 THEN RAISE EXCEPTION 'idempotent roll: expected 3, got %', n; END IF;
	SELECT COUNT(*) INTO n FROM public.satchel_met WHERE user_id = giver;
	IF n < 1 THEN RAISE EXCEPTION 'met should record first-found'; END IF;

	-- ── 2. every pig has a wish; the giver's bag is made to hold it ─────────
	PERFORM set_config('smoke.uid', giver::text, true);
	res := public.friend_wishes(ARRAY[host, other]);
	IF NOT (res->>'ok')::boolean OR jsonb_array_length(res->'wishes') <> 2 THEN
		RAISE EXCEPTION 'friend_wishes: %', res;
	END IF;
	wish_find := res->'wishes'->0->>'find_id';
	first_wish_no := (res->'wishes'->0->>'wish_no')::bigint;
	IF (res->'wishes'->0->>'fulfilled_by_me')::boolean THEN RAISE EXCEPTION 'fresh wish must be open'; END IF;
	-- Rig the bag: one matching find, one that never matches.
	DELETE FROM public.satchel_items WHERE user_id = giver;
	SELECT id INTO other_find FROM public.satchel_finds WHERE id <> wish_find ORDER BY sort LIMIT 1;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (giver, wish_find) RETURNING id INTO item_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (giver, other_find) RETURNING id INTO wrong_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (other, wish_find);

	-- ── 3. refusals change nothing ───────────────────────────────────────────
	res := public.fulfil_pig_wish(host, wrong_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'wrong_find' THEN RAISE EXCEPTION 'wrong find: %', res; END IF;
	res := public.fulfil_pig_wish(giver, item_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'invalid_host' THEN RAISE EXCEPTION 'self: %', res; END IF;
	res := public.fulfil_pig_wish(host, 999999999);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_in_bag' THEN RAISE EXCEPTION 'foreign item: %', res; END IF;
	SELECT COUNT(*) INTO n FROM public.satchel_deliveries; IF n <> 0 THEN RAISE EXCEPTION 'refusals wrote a delivery'; END IF;

	-- ── 4. the hand-off ──────────────────────────────────────────────────────
	SELECT tickles_earned INTO g_before FROM public.profiles WHERE id = giver;
	SELECT tickles_earned INTO h_before FROM public.profiles WHERE id = host;
	res := public.fulfil_pig_wish(host, item_id);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'fulfil: %', res; END IF;
	IF res->>'find_id' <> wish_find THEN RAISE EXCEPTION 'wrong find echoed: %', res; END IF;
	IF (res->>'tickles')::int <> 3 THEN RAISE EXCEPTION 'flat tickles should be 3: %', res; END IF;
	IF (res->>'giver_tickled')::int <> g_before + 3 OR (res->>'host_tickled')::int <> h_before + 3 THEN
		RAISE EXCEPTION 'both pigs +3: %', res;
	END IF;
	IF (res->>'deliveries')::int <> 1 OR res->'keepsake' <> 'null'::jsonb THEN RAISE EXCEPTION 'first delivery: %', res; END IF;
	IF res->'next_wish'->>'find_id' = wish_find THEN RAISE EXCEPTION 'reroll picked the given find'; END IF;
	IF (res->'next_wish'->>'wish_no')::bigint <> first_wish_no + 1 THEN RAISE EXCEPTION 'wish_no must advance'; END IF;
	IF (res->>'bag_count')::int <> 1 THEN RAISE EXCEPTION 'bag should hold the one wrong find: %', res; END IF;
	-- the transfer
	IF EXISTS (SELECT 1 FROM public.satchel_items WHERE id = item_id) THEN RAISE EXCEPTION 'find still in bag'; END IF;
	SELECT count INTO n FROM public.pig_shelf WHERE user_id = host AND find_id = wish_find;
	IF n <> 1 THEN RAISE EXCEPTION 'shelf should hold 1'; END IF;
	-- the traces
	SELECT COUNT(*) INTO n FROM public.system_announcements WHERE user_id = host AND kind = 'satchel_delivery';
	IF n <> 1 THEN RAISE EXCEPTION 'while-away line missing'; END IF;
	SELECT alignment_score INTO n FROM public.profiles WHERE id = giver;
	IF n <> 1 THEN RAISE EXCEPTION 'generous tick missing: %', n; END IF;
	-- the snouts moved with the count (apply_tickles pays counter too), never a bank
	SELECT counter INTO n FROM public.profiles WHERE id = giver;
	IF n <> 43 THEN RAISE EXCEPTION 'giver counter should be 43, got %', n; END IF;

	-- ── 5. once per wish: the NEW wish is not this visitor's to fulfil twice ─
	-- (a second hand-off on the new wish is a later visit's; here just prove
	-- the old wish_no can't be replayed)
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (giver, res->'next_wish'->>'find_id') RETURNING id INTO item_id;
	res := public.fulfil_pig_wish(host, item_id);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'second wish should be fulfillable: %', res; END IF;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (giver, res->'next_wish'->>'find_id') RETURNING id INTO item_id;
	INSERT INTO public.satchel_deliveries(giver_id, host_id, wish_no, find_id)
		VALUES (giver, host, (res->'next_wish'->>'wish_no')::bigint, res->'next_wish'->>'find_id');
	res := public.fulfil_pig_wish(host, item_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_fulfilled' THEN RAISE EXCEPTION 'replay: %', res; END IF;

	-- ── 6. my_satchel, toss, not-this-one, the Board's counts ────────────────
	bag := public.my_satchel();
	IF NOT (bag->>'ok')::boolean OR (bag->>'deliveries')::int <> 3 /* two hand-offs + the replay fixture row */ OR (bag->>'cap')::int <> 3 THEN
		RAISE EXCEPTION 'my_satchel: %', bag;
	END IF;
	res := public.toss_find(wrong_id);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'toss: %', res; END IF;
	res := public.toss_find(wrong_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_in_bag' THEN RAISE EXCEPTION 'toss twice: %', res; END IF;
	w := bag->'wish';
	res := public.reroll_my_wish();
	IF NOT (res->>'ok')::boolean OR res->'wish'->>'find_id' = w->>'find_id' THEN RAISE EXCEPTION 'reroll: %', res; END IF;
	res := public.reroll_my_wish();
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_rerolled' THEN RAISE EXCEPTION 'reroll twice: %', res; END IF;
	res := public.satchel_deliveries_for(ARRAY[giver, host]);
	IF (res->'counts'->>giver::text)::int <> 3 OR res->'counts' ? host::text THEN
		RAISE EXCEPTION 'board counts: %', res;
	END IF;

	-- ── 7. keepsake at the threshold ─────────────────────────────────────────
	UPDATE public.app_settings SET value = value || '{"keepsake_thresholds":[4]}'::jsonb WHERE key = 'satchel_tuning';
	res := public.friend_wishes(ARRAY[other]);
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (giver, res->'wishes'->0->>'find_id') RETURNING id INTO item_id;
	res := public.fulfil_pig_wish(other, item_id);
	IF NOT (res->>'ok')::boolean OR (res->>'keepsake')::int <> 4 THEN RAISE EXCEPTION 'keepsake at 4: %', res; END IF;
	SELECT COUNT(*) INTO n FROM public.satchel_keepsakes WHERE user_id = giver AND threshold = 4;
	IF n <> 1 THEN RAISE EXCEPTION 'keepsake row missing'; END IF;

	RAISE NOTICE 'satchel smoke ok';
END
$satchel$;

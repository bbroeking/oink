-- The barn swap (20260917100000_satchel_swaps.sql): a visitor hands the host
-- pig the find it is hoping for and takes one of up to three the host's bag can
-- spare — or just gives it. Rows MOVE between bags; nothing is minted.
--
-- Asserts, each refusal paired with a proof that NOTHING moved:
--   0. the migration's data moves — shelf rows became `migrated_shelf` bag
--      rows, deliveries became swaps, the satchel_deliveries VIEW still reads.
--   1. _wish_options: deterministic (two calls, one array) and largest stack
--      first.
--   2. every refusal, in the wire contract's order: bad_nonce · invalid_host ·
--      host_not_found · not_friends · blocked · not_in_bag · wish_changed ·
--      wrong_find · not_offered · option_gone · host_bag_full · already_today.
--   3. a successful SWAP: both rows moved with source + from_user_id, both
--      pigs met their new find, both +3, NO generous tick, a ledger row, a
--      while-away line carrying data.screen = 'barn', and the wish advanced
--      away from the given find.
--   4. the nonce replay: the ORIGINAL receipt with replay:true, nothing moved
--      a second time.
--   5. a successful GIFT: took_find_id null, generous tick +1.
--   6. the daily paid caps: per-pig and per-pair spent → tickles 0 and
--      paid:false, but the finds still change hands.
--   7. my_satchel / my_satchel_swaps / satchel_swaps_for /
--      satchel_deliveries_for / the fulfil_pig_wish alias.
--   8. tickle_breakdown's new `swaps` lane, and an untouched pig's residual.
--
-- Fixture ids live in the ...0A000n block so they cannot collide with
-- 90_satchel_smoke's ...09000n block.
--
-- 00x_satchel_swaps_prep.sql makes are_friends / are_blocked readable from a
-- GUC so the refusals are reachable at all (audit F9).
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $satchel_swaps$
DECLARE
	g    uuid := '00000000-0000-0000-0000-0000000a0001'; -- the giver
	h    uuid := '00000000-0000-0000-0000-0000000a0002'; -- the host (swap)
	o    uuid := '00000000-0000-0000-0000-0000000a0003'; -- the host (gift)
	d4   uuid := '00000000-0000-0000-0000-0000000a0004'; -- per-pig cap host
	d5   uuid := '00000000-0000-0000-0000-0000000a0005'; -- per-pair cap host
	d6   uuid := '00000000-0000-0000-0000-0000000a0006'; -- the alias's host
	u7   uuid := '00000000-0000-0000-0000-0000000a0007'; -- never swapped
	ghost uuid := '00000000-0000-0000-0000-0000000a00ff'; -- no profile
	res jsonb; bag jsonb; opts jsonb;
	pebble_id bigint; feather_id bigint; clover_id bigint;
	shell_id bigint; cone_id bigint; brass_id bigint;
	owner uuid; moved public.satchel_items%ROWTYPE;
	nonce_ok uuid := '00000000-0000-0000-0000-00000000c001';
	swaps_before int; g_bag int; h_bag int;
	g_before int; h_before int; align_before int; n int;
BEGIN
	-- ── 0. what the migration moved ─────────────────────────────────────────
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE source = 'migrated_shelf';
	IF n < 1 THEN RAISE EXCEPTION 'shelf migration produced no migrated_shelf rows'; END IF;
	IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'pig_shelf' AND relkind = 'r') THEN
		RAISE EXCEPTION 'pig_shelf should be gone';
	END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_swaps;
	IF n < 1 THEN RAISE EXCEPTION 'deliveries did not become swaps'; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_deliveries) <> n THEN
		RAISE EXCEPTION 'the satchel_deliveries VIEW disagrees with the ledger';
	END IF;

	-- ── 1. fixtures ──────────────────────────────────────────────────────────
	-- A known tuning: cap 6, three options, one paid swap per pair and two per
	-- pig per day (so the caps are reachable inside one smoke).
	UPDATE public.app_settings SET value = value || '{
		"cap": 6, "options": 3, "tickles": 3, "wish_reroll_hours": 48,
		"keepsake_thresholds": [10, 50, 100],
		"paid_swaps_per_pair_per_day": 1, "paid_swaps_per_pig_per_day": 2}'::jsonb
		WHERE key = 'satchel_tuning';

	INSERT INTO auth.users(id) VALUES (g),(h),(o),(d4),(d5),(d6),(u7) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id, username, discriminator, tickles_earned, counter, alignment_score) VALUES
		(g,'swap-giver','0001',0,0,0), (h,'swap-host','0002',0,0,0),
		(o,'swap-other','0003',0,0,0), (d4,'swap-four','0004',0,0,0),
		(d5,'swap-five','0005',0,0,0), (d6,'swap-six','0006',0,0,0),
		(u7,'swap-seven','0007',11,11,0)
		ON CONFLICT(id) DO UPDATE SET username = EXCLUDED.username,
			discriminator = EXCLUDED.discriminator,
			tickles_earned = EXCLUDED.tickles_earned,
			counter = EXCLUDED.counter, alignment_score = EXCLUDED.alignment_score;

	-- Pinned wishes, so every assertion below is deterministic.
	INSERT INTO public.pig_wishes(user_id, find_id, wish_no, rolled_at, expires_at) VALUES
		(g, 'brass_button', 1, now(), now() + interval '48 hours'),
		(h, 'river_pebble', 1, now(), now() + interval '48 hours'),
		(o, 'blue_feather', 1, now(), now() + interval '48 hours'),
		(d4,'clover',       1, now(), now() + interval '48 hours'),
		(d5,'snail_shell',  1, now(), now() + interval '48 hours'),
		(d6,'brass_button', 1, now(), now() + interval '48 hours'),
		(u7,'tin_whistle',  1, now(), now() + interval '48 hours')
		ON CONFLICT(user_id) DO UPDATE SET find_id = EXCLUDED.find_id,
			wish_no = 1, rolled_at = now(), expires_at = now() + interval '48 hours',
			owner_rerolled = false;

	-- The host's bag: 3 old keys, 2 marbles, 1 clover — six, exactly the cap,
	-- so a GIFT is refused and a SWAP is not.
	DELETE FROM public.satchel_items WHERE user_id IN (g,h,o,d4,d5,d6,u7);
	INSERT INTO public.satchel_items(user_id, find_id) VALUES
		(h,'old_key'),(h,'old_key'),(h,'old_key'),
		(h,'marble'),(h,'marble'),(h,'clover');
	-- The giver's bag: one find for each host's wish, plus a mismatch.
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'river_pebble') RETURNING id INTO pebble_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'blue_feather') RETURNING id INTO feather_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'clover')       RETURNING id INTO clover_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'snail_shell')  RETURNING id INTO shell_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'pinecone')     RETURNING id INTO cone_id;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (g,'brass_button') RETURNING id INTO brass_id;

	PERFORM set_config('smoke.uid', g::text, true);
	SELECT COUNT(*)::int INTO swaps_before FROM public.satchel_swaps;
	SELECT COUNT(*)::int INTO g_bag FROM public.satchel_items WHERE user_id = g;
	SELECT COUNT(*)::int INTO h_bag FROM public.satchel_items WHERE user_id = h;
	IF g_bag <> 6 OR h_bag <> 6 THEN RAISE EXCEPTION 'fixture bags: g=% h=%', g_bag, h_bag; END IF;

	-- ── 2. the tray: deterministic, biggest stacks first ────────────────────
	res := public.friend_wishes(ARRAY[h]);
	IF NOT (res->>'ok')::boolean OR jsonb_array_length(res->'wishes') <> 1 THEN
		RAISE EXCEPTION 'friend_wishes: %', res; END IF;
	opts := res->'wishes'->0->'options';
	IF opts <> '["old_key","marble","clover"]'::jsonb THEN
		RAISE EXCEPTION 'options must be largest-stack-first, got %', opts; END IF;
	IF (res->'wishes'->0->>'swapped_today')::boolean THEN RAISE EXCEPTION 'nothing swapped yet'; END IF;
	IF (res->'wishes'->0->>'fulfilled_by_me')::boolean THEN RAISE EXCEPTION 'wish must be open'; END IF;
	res := public.friend_wishes(ARRAY[h]);
	IF res->'wishes'->0->'options' <> opts THEN
		RAISE EXCEPTION 'options must be deterministic: % vs %', res->'wishes'->0->'options', opts; END IF;

	-- ── 3. every refusal changes nothing ────────────────────────────────────
	res := public.swap_with_host(h, pebble_id, 'old_key', 1, NULL);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_nonce' THEN RAISE EXCEPTION 'bad_nonce: %', res; END IF;
	res := public.swap_with_host(g, pebble_id, NULL, 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'invalid_host' THEN RAISE EXCEPTION 'self: %', res; END IF;
	res := public.swap_with_host(ghost, pebble_id, NULL, 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'host_not_found' THEN RAISE EXCEPTION 'ghost: %', res; END IF;

	PERFORM set_config('smoke.unfriend', h::text, true);
	res := public.swap_with_host(h, pebble_id, 'old_key', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_friends' THEN RAISE EXCEPTION 'not_friends: %', res; END IF;
	-- a stranger's wish is not even visible
	IF jsonb_array_length(public.friend_wishes(ARRAY[h])->'wishes') <> 0 THEN
		RAISE EXCEPTION 'friend_wishes must skip a non-friend'; END IF;
	PERFORM set_config('smoke.unfriend', '', true);

	PERFORM set_config('smoke.blocked', h::text, true);
	res := public.swap_with_host(h, pebble_id, 'old_key', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'blocked' THEN RAISE EXCEPTION 'blocked: %', res; END IF;
	PERFORM set_config('smoke.blocked', '', true);

	res := public.swap_with_host(h, 999999999, 'old_key', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_in_bag' THEN RAISE EXCEPTION 'not_in_bag: %', res; END IF;

	res := public.swap_with_host(h, pebble_id, 'old_key', 99, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'wish_changed' THEN RAISE EXCEPTION 'wish_changed: %', res; END IF;
	IF res->'wish'->>'find_id' <> 'river_pebble' OR res->'options' <> opts THEN
		RAISE EXCEPTION 'wish_changed must carry the live wish + fresh options: %', res; END IF;

	res := public.swap_with_host(h, cone_id, 'old_key', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'wrong_find' THEN RAISE EXCEPTION 'wrong_find: %', res; END IF;
	IF res->'wish'->>'find_id' <> 'river_pebble' OR res->'options' <> opts THEN
		RAISE EXCEPTION 'wrong_find must carry the live wish + options: %', res; END IF;

	-- host_bag_full: the host's bag is exactly at cap, so a GIFT is refused…
	res := public.swap_with_host(h, pebble_id, NULL, 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'host_bag_full' THEN RAISE EXCEPTION 'host_bag_full: %', res; END IF;

	-- not_offered: the host HOLDS the clover but only two finds are offered —
	-- the rule diverged, and that is the Sentry case, not the warm one.
	UPDATE public.app_settings SET value = value || '{"options": 2}'::jsonb WHERE key = 'satchel_tuning';
	res := public.swap_with_host(h, pebble_id, 'clover', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_offered' THEN RAISE EXCEPTION 'not_offered: %', res; END IF;
	IF res->'options' <> '["old_key","marble"]'::jsonb THEN
		RAISE EXCEPTION 'not_offered options: %', res->'options'; END IF;
	UPDATE public.app_settings SET value = value || '{"options": 3}'::jsonb WHERE key = 'satchel_tuning';

	-- option_gone: the owner tossed the marbles between the tray and the tap.
	DELETE FROM public.satchel_items WHERE user_id = h AND find_id = 'marble';
	res := public.swap_with_host(h, pebble_id, 'marble', 1, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'option_gone' THEN RAISE EXCEPTION 'option_gone: %', res; END IF;
	IF res->'options' <> '["old_key","clover"]'::jsonb THEN
		RAISE EXCEPTION 'option_gone must redraw the tray, got %', res->'options'; END IF;
	SELECT user_id INTO owner FROM public.satchel_items WHERE id = pebble_id;
	IF owner <> g THEN RAISE EXCEPTION 'option_gone moved the giver''s find'; END IF;
	INSERT INTO public.satchel_items(user_id, find_id) VALUES (h,'marble'),(h,'marble');

	-- nothing above wrote a thing
	IF (SELECT COUNT(*)::int FROM public.satchel_swaps) <> swaps_before THEN
		RAISE EXCEPTION 'a refusal wrote a ledger row'; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = g) <> g_bag
	   OR (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = h) <> h_bag THEN
		RAISE EXCEPTION 'a refusal moved a find'; END IF;
	IF (SELECT COUNT(*)::int FROM public.system_announcements WHERE user_id = h) <> 0 THEN
		RAISE EXCEPTION 'a refusal wrote a while-away line'; END IF;

	-- ── 4. the swap ──────────────────────────────────────────────────────────
	SELECT tickles_earned INTO g_before FROM public.profiles WHERE id = g;
	SELECT tickles_earned INTO h_before FROM public.profiles WHERE id = h;
	SELECT alignment_score INTO align_before FROM public.profiles WHERE id = g;
	res := public.swap_with_host(h, pebble_id, 'old_key', 1, nonce_ok);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'swap: %', res; END IF;
	IF (res->>'replay')::boolean THEN RAISE EXCEPTION 'a first swap is not a replay'; END IF;
	IF res->>'gave_find_id' <> 'river_pebble' OR res->>'took_find_id' <> 'old_key' THEN
		RAISE EXCEPTION 'swap echoed the wrong finds: %', res; END IF;
	IF (res->>'tickles')::int <> 3 OR NOT (res->>'paid')::boolean THEN RAISE EXCEPTION 'flat 3, paid: %', res; END IF;
	IF (res->>'giver_tickled')::int <> g_before + 3 OR (res->>'host_tickled')::int <> h_before + 3 THEN
		RAISE EXCEPTION 'both pigs +3: %', res; END IF;
	IF (res->>'swaps_given')::int <> 1 THEN RAISE EXCEPTION 'swaps_given: %', res; END IF;
	IF res->'keepsake' <> 'null'::jsonb THEN RAISE EXCEPTION 'no keepsake at 1: %', res; END IF;
	IF (res->'next_wish'->>'wish_no')::bigint <> 2 OR res->'next_wish'->>'find_id' = 'river_pebble' THEN
		RAISE EXCEPTION 'the wish must advance away from the given find: %', res->'next_wish'; END IF;
	IF jsonb_array_length(res->'bag') <> 6 THEN RAISE EXCEPTION 'the receipt carries the FULL bag: %', res->'bag'; END IF;

	-- both rows MOVED, with provenance
	SELECT * INTO moved FROM public.satchel_items WHERE id = pebble_id;
	IF moved.user_id <> h OR moved.source <> 'swap' OR moved.from_user_id <> g THEN
		RAISE EXCEPTION 'the given find did not move with provenance: %', moved; END IF;
	SELECT * INTO moved FROM public.satchel_items
		WHERE user_id = g AND find_id = 'old_key' ORDER BY id LIMIT 1;
	IF moved.source <> 'swap' OR moved.from_user_id <> h THEN
		RAISE EXCEPTION 'the taken find did not move with provenance: %', moved; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = h) <> 6
	   OR (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = g) <> 6 THEN
		RAISE EXCEPTION 'a swap is 1:1 — both bags keep their size'; END IF;
	-- both met their new find
	IF NOT EXISTS (SELECT 1 FROM public.satchel_met WHERE user_id = h AND find_id = 'river_pebble')
	   OR NOT EXISTS (SELECT 1 FROM public.satchel_met WHERE user_id = g AND find_id = 'old_key') THEN
		RAISE EXCEPTION 'a swap is how a lone digger meets a rare'; END IF;
	-- a swap is a trade, not a gift: no generous tick
	SELECT alignment_score INTO n FROM public.profiles WHERE id = g;
	IF n <> align_before THEN RAISE EXCEPTION 'a swap must not move alignment: % -> %', align_before, n; END IF;
	-- the ledger + the host's trace
	SELECT COUNT(*)::int INTO n FROM public.satchel_swaps
		WHERE nonce = nonce_ok AND giver_id = g AND host_id = h
		  AND gave_find_id = 'river_pebble' AND took_find_id = 'old_key' AND tickles = 3;
	IF n <> 1 THEN RAISE EXCEPTION 'ledger row missing'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.system_announcements
		WHERE user_id = h AND kind = 'satchel_swap'
		  AND data->>'screen' = 'barn' AND data->>'took_find_id' = 'old_key'
		  AND data->>'giver_id' = g::text;
	IF n <> 1 THEN RAISE EXCEPTION 'the while-away line must tap through to the barn'; END IF;
	-- the snouts moved with the count
	SELECT counter INTO n FROM public.profiles WHERE id = g;
	IF n <> 3 THEN RAISE EXCEPTION 'giver counter should be 3, got %', n; END IF;

	-- ── 5. the replay ────────────────────────────────────────────────────────
	SELECT COUNT(*)::int INTO swaps_before FROM public.satchel_swaps;
	res := public.swap_with_host(h, pebble_id, 'old_key', 1, nonce_ok);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'replay')::boolean THEN RAISE EXCEPTION 'replay: %', res; END IF;
	IF res->>'gave_find_id' <> 'river_pebble' OR res->>'took_find_id' <> 'old_key'
	   OR (res->>'tickles')::int <> 3 OR NOT (res->>'paid')::boolean THEN
		RAISE EXCEPTION 'a replay returns the ORIGINAL receipt: %', res; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_swaps) <> swaps_before THEN
		RAISE EXCEPTION 'a replay traded twice'; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = g) <> 6
	   OR (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = h) <> 6 THEN
		RAISE EXCEPTION 'a replay moved finds a second time'; END IF;
	SELECT tickles_earned INTO n FROM public.profiles WHERE id = g;
	IF n <> 3 THEN RAISE EXCEPTION 'a replay paid again: %', n; END IF;

	-- ── 6. already_today: this visitor is done here today ───────────────────
	-- Point the host's new wish at something the giver still carries, so the
	-- ONLY thing standing in the way is the day gate.
	UPDATE public.pig_wishes SET find_id = 'pinecone' WHERE user_id = h;
	res := public.swap_with_host(h, cone_id, 'old_key', 2, gen_random_uuid());
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_today' THEN RAISE EXCEPTION 'already_today: %', res; END IF;
	IF res->'wish'->>'find_id' <> 'pinecone' THEN RAISE EXCEPTION 'already_today carries the wish: %', res; END IF;
	IF (SELECT user_id FROM public.satchel_items WHERE id = cone_id) <> g THEN
		RAISE EXCEPTION 'already_today moved a find'; END IF;
	res := public.friend_wishes(ARRAY[h]);
	IF NOT (res->'wishes'->0->>'swapped_today')::boolean THEN
		RAISE EXCEPTION 'friend_wishes must report swapped_today'; END IF;

	-- ── 7. the gift ──────────────────────────────────────────────────────────
	SELECT alignment_score INTO align_before FROM public.profiles WHERE id = g;
	res := public.swap_with_host(o, feather_id, NULL, 1, gen_random_uuid());
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'gift: %', res; END IF;
	IF res->'took_find_id' <> 'null'::jsonb THEN RAISE EXCEPTION 'a gift takes nothing: %', res; END IF;
	IF (res->>'tickles')::int <> 3 OR NOT (res->>'paid')::boolean THEN RAISE EXCEPTION 'gift pays the flat 3: %', res; END IF;
	SELECT * INTO moved FROM public.satchel_items WHERE id = feather_id;
	IF moved.user_id <> o OR moved.source <> 'gift' OR moved.from_user_id <> g THEN
		RAISE EXCEPTION 'the gift did not move: %', moved; END IF;
	SELECT alignment_score INTO n FROM public.profiles WHERE id = g;
	IF n <> align_before + 1 THEN RAISE EXCEPTION 'a gift earns the generous tick: % -> %', align_before, n; END IF;
	SELECT COUNT(*)::int INTO n FROM public.system_announcements
		WHERE user_id = o AND kind = 'satchel_swap' AND body LIKE '%brought your pig%';
	IF n <> 1 THEN RAISE EXCEPTION 'the gift''s while-away line reads as a gift'; END IF;

	-- ── 8. the glass box: the swaps lane ────────────────────────────────────
	res := public.tickle_breakdown(g);
	IF (res->>'boundary') IS NULL THEN RAISE EXCEPTION 'tickle_breakdown needs an active season'; END IF;
	IF (res->>'swaps')::int <> 6 THEN RAISE EXCEPTION 'swaps lane: expected 6, got %', res; END IF;
	IF (res->>'total')::int <> 6 OR (res->>'home_taps')::int <> 0 THEN
		RAISE EXCEPTION 'hand-off tickles must leave the home_taps residual: %', res; END IF;
	res := public.tickle_breakdown(u7);
	IF (res->>'swaps')::int <> 0 OR (res->>'home_taps')::int <> 11 OR (res->>'total')::int <> 11 THEN
		RAISE EXCEPTION 'an untouched pig''s residual must be unchanged: %', res; END IF;

	-- ── 9. the daily paid caps: no tickles, but the finds still move ────────
	-- per-pig: two paid hand-offs already today, and the cap is two.
	res := public.swap_with_host(d4, clover_id, NULL, 1, gen_random_uuid());
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'per-pig cap must not block the swap: %', res; END IF;
	IF (res->>'tickles')::int <> 0 OR (res->>'paid')::boolean THEN
		RAISE EXCEPTION 'per-pig cap spent → 0 tickles, paid false: %', res; END IF;
	IF (SELECT user_id FROM public.satchel_items WHERE id = clover_id) <> d4 THEN
		RAISE EXCEPTION 'the find must still change hands when the cap is spent'; END IF;
	SELECT tickles_earned INTO n FROM public.profiles WHERE id = g;
	IF n <> 6 THEN RAISE EXCEPTION 'an unpaid swap must not pay: %', n; END IF;

	-- per-pair: the pair cap is stricter than the day gate, so reach it by
	-- tuning (with the F1 gate in place a pair can only swap once a day
	-- anyway — the cap is here for when that gate is relaxed).
	UPDATE public.app_settings SET value = value ||
		'{"paid_swaps_per_pig_per_day": 99, "paid_swaps_per_pair_per_day": 0}'::jsonb
		WHERE key = 'satchel_tuning';
	res := public.swap_with_host(d5, shell_id, NULL, 1, gen_random_uuid());
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'per-pair cap must not block the swap: %', res; END IF;
	IF (res->>'tickles')::int <> 0 OR (res->>'paid')::boolean THEN
		RAISE EXCEPTION 'per-pair cap spent → 0 tickles, paid false: %', res; END IF;
	IF (SELECT user_id FROM public.satchel_items WHERE id = shell_id) <> d5 THEN
		RAISE EXCEPTION 'the find must still change hands when the pair cap is spent'; END IF;
	UPDATE public.app_settings SET value = value ||
		'{"paid_swaps_per_pig_per_day": 10, "paid_swaps_per_pair_per_day": 3}'::jsonb
		WHERE key = 'satchel_tuning';

	-- ── 10. the one-build aliases ───────────────────────────────────────────
	res := public.fulfil_pig_wish(h, cone_id);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_fulfilled' THEN
		RAISE EXCEPTION 'the alias must map already_today → already_fulfilled: %', res; END IF;
	res := public.fulfil_pig_wish(d6, brass_id);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'alias: %', res; END IF;
	IF res->>'find_id' <> 'brass_button' THEN RAISE EXCEPTION 'alias find_id: %', res; END IF;
	IF (res->>'deliveries')::int <> 5 THEN RAISE EXCEPTION 'alias deliveries: %', res; END IF;
	IF (res->>'bag_count')::int <> 2 THEN RAISE EXCEPTION 'alias bag_count: %', res; END IF;
	IF (res->>'tickles')::int <> 3 THEN RAISE EXCEPTION 'alias pays the flat 3: %', res; END IF;

	res := public.satchel_swaps_for(ARRAY[g, h]);
	IF (res->'counts'->>g::text)::int <> 5 OR res->'counts' ? h::text THEN
		RAISE EXCEPTION 'board counts: %', res; END IF;
	IF public.satchel_deliveries_for(ARRAY[g, h]) <> res THEN
		RAISE EXCEPTION 'the deliveries alias must agree with satchel_swaps_for'; END IF;
	IF (SELECT COUNT(*)::int FROM public.satchel_deliveries WHERE giver_id = g AND find_id = 'river_pebble') <> 1 THEN
		RAISE EXCEPTION 'the satchel_deliveries VIEW must still read'; END IF;

	-- ── 11. my_satchel + my_satchel_swaps ───────────────────────────────────
	bag := public.my_satchel();
	IF NOT (bag->>'ok')::boolean THEN RAISE EXCEPTION 'my_satchel: %', bag; END IF;
	IF bag->'shelf' <> '[]'::jsonb THEN RAISE EXCEPTION 'the shelf is retired: %', bag->'shelf'; END IF;
	IF (bag->>'deliveries')::int <> 5 OR (bag->>'swaps_given')::int <> 5 THEN
		RAISE EXCEPTION 'my_satchel counts: %', bag; END IF;
	IF (bag->>'swaps_received')::int <> 0 THEN RAISE EXCEPTION 'the giver received nothing: %', bag; END IF;
	IF (bag->>'paid_left_today')::int <> 7 THEN
		RAISE EXCEPTION 'paid_left_today: expected 10 - 3 paid = 7, got %', bag->>'paid_left_today'; END IF;
	IF jsonb_array_length(bag->'items') <> 2 THEN RAISE EXCEPTION 'the giver keeps two finds: %', bag->'items'; END IF;
	IF NOT (bag->'items'->0 ? 'source') THEN RAISE EXCEPTION 'bag items carry their source: %', bag->'items'; END IF;

	res := public.my_satchel_swaps(20);
	IF jsonb_array_length(res->'swaps') <> 5 THEN RAISE EXCEPTION 'the giver has five swaps: %', res; END IF;
	IF res->'swaps'->0->>'direction' <> 'given' THEN RAISE EXCEPTION 'direction: %', res->'swaps'->0; END IF;
	IF (res->'swaps'->0->>'id')::bigint <= (res->'swaps'->4->>'id')::bigint THEN
		RAISE EXCEPTION 'my_satchel_swaps is newest first: %', res->'swaps'; END IF;
	PERFORM set_config('smoke.uid', h::text, true);
	res := public.my_satchel_swaps(20);
	IF jsonb_array_length(res->'swaps') <> 1 THEN RAISE EXCEPTION 'the host has one swap: %', res; END IF;
	IF res->'swaps'->0->>'direction' <> 'received'
	   OR res->'swaps'->0->>'partner_id' <> g::text
	   OR res->'swaps'->0->>'partner_username' <> 'swap-giver'
	   OR res->'swaps'->0->>'partner_discriminator' <> '0001'
	   OR res->'swaps'->0->>'gave_find_id' <> 'river_pebble'
	   OR res->'swaps'->0->>'took_find_id' <> 'old_key' THEN
		RAISE EXCEPTION 'the host reads the swap from the giver''s point of view: %', res->'swaps'->0; END IF;

	-- ── 12. the 48h wish timeout, on the lock-free read path ────────────────
	PERFORM set_config('smoke.uid', g::text, true);
	UPDATE public.pig_wishes SET expires_at = now() - interval '1 hour',
		owner_rerolled = true, find_id = 'tin_whistle', wish_no = 7 WHERE user_id = u7;
	res := public.friend_wishes(ARRAY[u7]);
	IF (res->'wishes'->0->>'wish_no')::bigint <> 8 THEN
		RAISE EXCEPTION 'a timed-out wish rerolls on read: %', res; END IF;
	IF res->'wishes'->0->>'find_id' = 'tin_whistle' THEN
		RAISE EXCEPTION 'a timed-out reroll must not pick the same find'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.pig_wishes WHERE user_id = u7 AND owner_rerolled = false;
	IF n <> 1 THEN RAISE EXCEPTION 'a timeout restores the owner''s free reroll'; END IF;
	-- and a live wish is read without writing
	SELECT wish_no INTO n FROM public.pig_wishes WHERE user_id = u7;
	PERFORM public.friend_wishes(ARRAY[u7]);
	IF (SELECT wish_no FROM public.pig_wishes WHERE user_id = u7) <> n THEN
		RAISE EXCEPTION '_peek_wish must not reroll a live wish'; END IF;

	RAISE NOTICE 'chk satchel swaps: shelf migrated, tray deterministic, 11 refusals inert, swap + gift + replay + day gate + paid caps + aliases + swaps lane OK';
END
$satchel_swaps$;

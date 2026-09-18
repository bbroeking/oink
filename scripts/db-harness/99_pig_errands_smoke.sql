-- Pig errands (20260918120000_pig_errands.sql): send a pig to look for a Find;
-- hours later it comes back with it or without it; give it through the swap's
-- gift path or keep it. The RPC contract of docs/pig-errands-build-brief.md §5.3.
--
-- Asserts:
--   1. send_pig's refusals, in order and writing nothing: errands_disabled
--      (flag off, not is_test) · pig_unknown · pig_not_owned · pig_resting
--      (a lapsed member's companion) · target_unknown · not_friends ·
--      target_not_wished (with the live wish) · pig_already_out · replay.
--   2. The row: out, ends_at = now + 4h (trot 2), the pig's LOCAL day, the
--      seed committed; pig_errands() says away=rosie, today.rosie, one out,
--      empty board; host_pig_away answers the visitor.
--   3. The Auto-Tickler returns 0 while the greeter is out (R12).
--   4. A recall spends the day: recalled, empty-handed, errand_used_today on a
--      second send; recall again → not_out.
--   5. _errand_roll is deterministic: the same seed → the same finds at any
--      fake_now; a hit seed carries the target; a miss seed carries nothing.
--   6. The return: past ends_at the read materialises (back, the roll landed,
--      away null); the sweep enqueues exactly ONE push per errand with
--      screen 'pen' and the friend line, and none the second time.
--   7. claim_errand give: keep-then-gift — exactly one satchel_swaps row with
--      took_find_id NULL, the host's bag row source='gift', the caller's bag
--      without it, flat tickles both sides, status given; the replay answers
--      the original; a second nonce → already_claimed.
--   8. wish_moved: the friend's wish moved while the pig was out → the give is
--      refused, the errand is kept and the find is in the caller's bag
--      (source 'errand') — never lost.
--   9. Empty hands: claim keep on {} → kept, nothing inserted.
--  10. board_full at the cap; dev_summon_return is admin_only for a normal pig
--      and brings a test pig home now; unlock_field_guide_page('pen').
--
-- Fixture ids live in the ...0C000n block so they cannot collide with the
-- trader smoke's ...0B000n block. Pigs have no feeding zone set, so the
-- errand keeps America/New_York time — 2026-05-01 is EDT (UTC−4).
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

DO $errands$
DECLARE
	p uuid := '00000000-0000-0000-0000-0000000c0001'; -- the sender
	q uuid := '00000000-0000-0000-0000-0000000c0002'; -- the friend whose pig wishes
	u uuid := '00000000-0000-0000-0000-0000000c0003'; -- a stranger
	t0 timestamptz := '2026-05-01 12:00+00'; -- 08:00 EDT on 2026-05-01
	t1 timestamptz := '2026-05-02 12:00+00'; -- the next local day
	t jsonb;
	res jsonb; res2 jsonb;
	eid bigint; eid2 bigint; eid3 bigint; eid4 bigint;
	n int; earned_p int; earned_q int; cnt int;
	nonce_hit uuid; nonce_miss uuid; nonce_hit2 uuid; nonce_miss_copper uuid;
	nonce_x uuid := '00000000-0000-0000-0000-00000000e001';
	nonce_y uuid := '00000000-0000-0000-0000-00000000e002';
	nonce_z uuid := '00000000-0000-0000-0000-00000000e003';
	nonce_c1 uuid := '00000000-0000-0000-0000-00000000e101';
	nonce_c2 uuid := '00000000-0000-0000-0000-00000000e102';
	nonce_c3 uuid := '00000000-0000-0000-0000-00000000e103';
	nonce_c4 uuid := '00000000-0000-0000-0000-00000000e104';
	nonce_c5 uuid := '00000000-0000-0000-0000-00000000e105';
	seed text;
	roll1 text[]; roll2 text[];
	i int;
	cand uuid;
	q_wish_no bigint;
	q_row_id bigint;
BEGIN
	-- ── fixtures ─────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (p),(q),(u) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id, username, discriminator, tickles_earned, counter, alignment_score) VALUES
		(p,'errand-sender','0001',100,100,0), (q,'Maya','0002',50,50,0), (u,'errand-stranger','0003',0,0,0)
		ON CONFLICT(id) DO UPDATE SET username = EXCLUDED.username,
			discriminator = EXCLUDED.discriminator,
			tickles_earned = EXCLUDED.tickles_earned,
			counter = EXCLUDED.counter, alignment_score = EXCLUDED.alignment_score;
	UPDATE public.profiles SET is_test = false, is_vip = false, active_pig_id = 'rosie' WHERE id IN (p,q,u);
	INSERT INTO public.user_pigs (user_id, pig_id) VALUES (p,'rosie'),(q,'rosie'),(u,'rosie') ON CONFLICT DO NOTHING;
	DELETE FROM public.user_pigs WHERE user_id = p AND pig_id <> 'rosie';
	DELETE FROM public.pig_errands WHERE user_id IN (p,q,u);
	DELETE FROM public.satchel_swaps WHERE giver_id IN (p,q,u) OR host_id IN (p,q,u);
	DELETE FROM public.satchel_items WHERE user_id IN (p,q,u);
	DELETE FROM public.satchel_met WHERE user_id IN (p,q,u);
	DELETE FROM public.pig_wishes WHERE user_id IN (p,q,u);
	DELETE FROM public.smoke_push_calls WHERE target_user_id IN (p,q,u);
	DELETE FROM public.user_contraptions WHERE user_id IN (p,q,u);
	DELETE FROM public.interaction_analytics_events WHERE user_id IN (p,q,u);
	INSERT INTO public.user_items (user_id, item_count) VALUES (p, 10) ON CONFLICT (user_id) DO UPDATE SET item_count = 10;
	-- Maya's pig wants a blue feather, for a long while.
	INSERT INTO public.pig_wishes (user_id, find_id, wish_no, rolled_at, expires_at)
		VALUES (q, 'blue_feather', 7, now(), now() + interval '30 days');
	UPDATE public.app_settings SET value = value || '{"enabled": false, "board_cap": 3}'::jsonb WHERE key = 'errand_tuning';
	t := public._errand_tuning();
	IF (t->>'enabled')::boolean THEN RAISE EXCEPTION 'the flag must ship off'; END IF;
	IF (t->'pigs'->'rosie'->>'trot')::int <> 2 THEN RAISE EXCEPTION 'tuning pigs: %', t; END IF;

	PERFORM set_config('ttp.fake_now', t0::text, true);
	PERFORM set_config('smoke.uid', p::text, true);

	-- ── 1. refusals, in order, writing nothing ───────────────────────────────
	res := public.send_pig('rosie', 'blue_feather', q, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'errands_disabled' THEN RAISE EXCEPTION 'expected errands_disabled: %', res; END IF;
	UPDATE public.profiles SET is_test = true WHERE id = p;
	res := public.pig_errands();
	IF NOT (res->>'enabled')::boolean THEN RAISE EXCEPTION 'a test pig sees it on: %', res; END IF;
	IF res->>'away' IS NOT NULL OR jsonb_array_length(res->'out') <> 0 OR jsonb_array_length(res->'board') <> 0 THEN
		RAISE EXCEPTION 'fresh state: %', res; END IF;
	IF (res->'today'->>'rosie')::boolean THEN RAISE EXCEPTION 'nothing spent yet: %', res; END IF;

	res := public.send_pig('dragon', NULL, NULL, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'pig_unknown' THEN RAISE EXCEPTION 'expected pig_unknown: %', res; END IF;
	res := public.send_pig('copper', NULL, NULL, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'pig_not_owned' THEN RAISE EXCEPTION 'expected pig_not_owned: %', res; END IF;
	INSERT INTO public.user_pigs (user_id, pig_id) VALUES (p, 'copper') ON CONFLICT DO NOTHING;
	res := public.send_pig('copper', NULL, NULL, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'pig_resting' THEN RAISE EXCEPTION 'a lapsed member''s companion rests: %', res; END IF;
	res := public.send_pig('rosie', 'unobtainium', NULL, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'target_unknown' THEN RAISE EXCEPTION 'expected target_unknown: %', res; END IF;
	PERFORM set_config('smoke.unfriend', u::text, true);
	res := public.send_pig('rosie', 'blue_feather', u, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_friends' THEN RAISE EXCEPTION 'expected not_friends: %', res; END IF;
	PERFORM set_config('smoke.unfriend', '', true);
	res := public.send_pig('rosie', 'old_key', q, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'target_not_wished' THEN RAISE EXCEPTION 'expected target_not_wished: %', res; END IF;
	IF res->>'wish' <> 'blue_feather' THEN RAISE EXCEPTION 'target_not_wished carries the live wish: %', res; END IF;
	res := public.send_pig('rosie', NULL, q, nonce_x);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'target_not_wished' THEN RAISE EXCEPTION 'a friend needs a target: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.pig_errands WHERE user_id = p;
	IF n <> 0 THEN RAISE EXCEPTION 'a refused send must write nothing, got % rows', n; END IF;

	-- ── 5 (early). a hit nonce and a miss nonce, from the real seed rule ────
	-- seed = md5(uid:pig:day:nonce); hit when u(seed:find)*100 < 60 (common,
	-- nose 1); a miss that is not distracted (u(seed:distracted)*100 >= 10)
	-- comes home with nothing.
	-- (Each search walks its own block of candidate uuids so no two nonces
	-- can coincide — a shared nonce would replay instead of send.)
	FOR i IN 1..500 LOOP
		cand := ('00000000-0000-0000-0000-0000000' || lpad(to_hex(i), 5, '0'))::uuid;
		seed := md5(p::text || ':rosie:2026-05-01:' || cand::text);
		IF public._errand_unit(seed || ':find') * 100 < 60 THEN nonce_hit := cand; EXIT; END IF;
	END LOOP;
	FOR i IN 1001..1500 LOOP
		cand := ('00000000-0000-0000-0000-0000000' || lpad(to_hex(i), 5, '0'))::uuid;
		seed := md5(p::text || ':rosie:2026-05-01:' || cand::text);
		IF public._errand_unit(seed || ':find') * 100 >= 60
			AND public._errand_unit(seed || ':distracted') * 100 >= 10 THEN nonce_miss := cand; EXIT; END IF;
	END LOOP;
	FOR i IN 2001..2500 LOOP
		cand := ('00000000-0000-0000-0000-0000000' || lpad(to_hex(i), 5, '0'))::uuid;
		seed := md5(p::text || ':rosie:2026-05-02:' || cand::text);
		IF public._errand_unit(seed || ':find') * 100 < 60 THEN nonce_hit2 := cand; EXIT; END IF;
	END LOOP;
	FOR i IN 3001..3500 LOOP
		cand := ('00000000-0000-0000-0000-0000000' || lpad(to_hex(i), 5, '0'))::uuid;
		seed := md5(p::text || ':copper:2026-05-02:' || cand::text);
		IF public._errand_unit(seed || ':find') * 100 >= 60
			AND public._errand_unit(seed || ':distracted') * 100 >= 10 THEN nonce_miss_copper := cand; EXIT; END IF;
	END LOOP;
	IF nonce_hit IS NULL OR nonce_miss IS NULL OR nonce_hit2 IS NULL OR nonce_miss_copper IS NULL THEN
		RAISE EXCEPTION 'could not find hit/miss nonces'; END IF;

	-- ── 2. the send ──────────────────────────────────────────────────────────
	res := public.send_pig('rosie', 'blue_feather', q, nonce_hit);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'send: %', res; END IF;
	IF (res->>'replay')::boolean THEN RAISE EXCEPTION 'first send is not a replay'; END IF;
	eid := (res->'errand'->>'id')::bigint;
	IF res->'errand'->>'status' <> 'out' THEN RAISE EXCEPTION 'out: %', res; END IF;
	IF (res->'errand'->>'ends_at')::timestamptz <> t0 + interval '4 hours' THEN RAISE EXCEPTION 'trot 2 = 4h: %', res; END IF;
	IF (res->'errand'->>'for_wish_no')::bigint <> 7 THEN RAISE EXCEPTION 'the wish number at send: %', res; END IF;
	SELECT local_day INTO seed FROM public.pig_errands WHERE id = eid;
	IF seed <> '2026-05-01' THEN RAISE EXCEPTION 'the pig''s local day: %', seed; END IF;
	-- replay: the original row
	res2 := public.send_pig('rosie', 'blue_feather', q, nonce_hit);
	IF NOT (res2->>'ok')::boolean OR NOT (res2->>'replay')::boolean OR (res2->'errand'->>'id')::bigint <> eid THEN
		RAISE EXCEPTION 'replay must answer the original row: %', res2; END IF;
	res := public.send_pig('rosie', NULL, NULL, nonce_y);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'pig_already_out' THEN RAISE EXCEPTION 'expected pig_already_out: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.pig_errands WHERE user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'one row expected, got %', n; END IF;
	SELECT COUNT(*)::int INTO n FROM public.interaction_analytics_events WHERE user_id = p AND event_name = 'errand_sent';
	IF n <> 1 THEN RAISE EXCEPTION 'one errand_sent event, got %', n; END IF;

	res := public.pig_errands();
	IF res->>'away' <> 'rosie' THEN RAISE EXCEPTION 'Rosie is away: %', res; END IF;
	IF NOT (res->'today'->>'rosie')::boolean OR (res->'today'->>'copper')::boolean THEN RAISE EXCEPTION 'today: %', res; END IF;
	IF jsonb_array_length(res->'out') <> 1 OR jsonb_array_length(res->'board') <> 0 THEN RAISE EXCEPTION 'out/board: %', res; END IF;
	-- the visitor's read
	PERFORM set_config('smoke.uid', q::text, true);
	res := public.host_pig_away(p);
	IF res->>'away' <> 'rosie' OR (res->>'ends_at')::timestamptz <> t0 + interval '4 hours' THEN RAISE EXCEPTION 'host_pig_away: %', res; END IF;
	res := public.host_pig_away(q);
	IF res->>'away' IS NOT NULL THEN RAISE EXCEPTION 'Maya''s pig is home: %', res; END IF;
	PERFORM set_config('smoke.uid', p::text, true);

	-- ── 3. the Auto-Tickler skips a yard with nobody in it ───────────────────
	INSERT INTO public.user_contraptions (user_id, contraption_id, resource_balance, active_until)
		VALUES (p, 'auto_tickler', 100, now() + interval '1 day');
	IF public._process_auto_tickler_user(p) <> 0 THEN RAISE EXCEPTION 'the Auto-Tickler must skip an away pig'; END IF;
	IF EXISTS (SELECT 1 FROM public.user_contraptions WHERE user_id = p AND last_processed_at IS NOT NULL) THEN
		RAISE EXCEPTION 'the skipped service must not be stamped'; END IF;

	-- ── 4. a recall spends the day ───────────────────────────────────────────
	UPDATE public.profiles SET is_vip = true WHERE id = p;
	res := public.send_pig('copper', NULL, NULL, nonce_y);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'a member''s companion goes: %', res; END IF;
	eid2 := (res->'errand'->>'id')::bigint;
	res := public.recall_pig(eid2);
	IF NOT (res->>'ok')::boolean OR res->'errand'->>'status' <> 'recalled' THEN RAISE EXCEPTION 'recall: %', res; END IF;
	IF jsonb_array_length(res->'errand'->'result_find_ids') <> 0 THEN RAISE EXCEPTION 'a recall is empty-handed: %', res; END IF;
	res := public.send_pig('copper', NULL, NULL, nonce_z);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'errand_used_today' THEN RAISE EXCEPTION 'expected errand_used_today after a recall: %', res; END IF;
	res := public.recall_pig(eid2);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_out' THEN RAISE EXCEPTION 'expected not_out: %', res; END IF;
	res := public.pig_errands();
	IF NOT (res->'today'->>'copper')::boolean THEN RAISE EXCEPTION 'copper''s day is spent: %', res; END IF;
	IF jsonb_array_length(res->'out') <> 1 THEN RAISE EXCEPTION 'only Rosie is out: %', res; END IF;

	-- ── 5. the roll is a pure function of the seed ───────────────────────────
	SELECT e.seed INTO seed FROM public.pig_errands e WHERE e.id = eid;
	roll1 := public._errand_roll(seed, 'blue_feather', 'rosie', t);
	PERFORM set_config('ttp.fake_now', (t0 + interval '9 days')::text, true);
	roll2 := public._errand_roll(seed, 'blue_feather', 'rosie', t);
	PERFORM set_config('ttp.fake_now', t0::text, true);
	IF roll1 <> roll2 THEN RAISE EXCEPTION 'the roll must not depend on the clock: % vs %', roll1, roll2; END IF;
	IF roll1 <> ARRAY['blue_feather'] THEN RAISE EXCEPTION 'the hit seed carries the target: %', roll1; END IF;
	roll1 := public._errand_roll(md5(p::text || ':rosie:2026-05-01:' || nonce_miss::text), 'blue_feather', 'rosie', t);
	IF COALESCE(array_length(roll1, 1), 0) <> 0 THEN RAISE EXCEPTION 'the miss seed comes home empty: %', roll1; END IF;
	roll1 := public._errand_roll(seed, NULL, 'rosie', t);
	IF array_length(roll1, 1) <> 1 OR NOT EXISTS (SELECT 1 FROM public.satchel_finds WHERE id = roll1[1]) THEN
		RAISE EXCEPTION 'anything rolls one catalog find: %', roll1; END IF;
	-- two pockets: the loop exists (a second pocket may or may not fill)
	roll1 := public._errand_roll(seed, NULL, 'rosie', t || '{"pigs": {"rosie": {"pockets": 2}}}'::jsonb);
	IF array_length(roll1, 1) NOT IN (1, 2) THEN RAISE EXCEPTION 'pockets 2 rolls one or two: %', roll1; END IF;

	-- ── 6. the return ────────────────────────────────────────────────────────
	PERFORM set_config('ttp.fake_now', (t0 + interval '3 hours 59 minutes')::text, true);
	IF public.sweep_errand_returns() <> 0 THEN RAISE EXCEPTION 'nothing due yet'; END IF;
	res := public.pig_errands();
	IF jsonb_array_length(res->'board') <> 0 OR res->>'away' <> 'rosie' THEN RAISE EXCEPTION 'still out a minute before: %', res; END IF;
	PERFORM set_config('ttp.fake_now', (t0 + interval '4 hours')::text, true);
	res := public.pig_errands();
	IF res->>'away' IS NOT NULL THEN RAISE EXCEPTION 'home now: %', res; END IF;
	IF jsonb_array_length(res->'board') <> 1 OR jsonb_array_length(res->'out') <> 0 THEN RAISE EXCEPTION 'on the board: %', res; END IF;
	IF res->'board'->0->>'status' <> 'back' OR res->'board'->0->'result_find_ids' <> '["blue_feather"]'::jsonb THEN
		RAISE EXCEPTION 'the roll landed: %', res->'board'; END IF;
	-- the Auto-Tickler runs again once she is home (the early return lifts;
	-- the service itself is stamped by the carried body)
	PERFORM public._process_auto_tickler_user(p);
	IF NOT EXISTS (SELECT 1 FROM public.user_contraptions WHERE user_id = p AND last_processed_at IS NOT NULL) THEN
		RAISE EXCEPTION 'the service runs once the pig is home'; END IF;
	-- the sweep: ONE push per errand, screen pen, the friend line
	IF public.sweep_errand_returns() <> 1 THEN RAISE EXCEPTION 'one push expected'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.smoke_push_calls WHERE target_user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'pushes recorded: %', n; END IF;
	SELECT push_title INTO seed FROM public.smoke_push_calls WHERE target_user_id = p;
	IF seed <> 'Rosie''s back' THEN RAISE EXCEPTION 'push title: %', seed; END IF;
	SELECT push_body INTO seed FROM public.smoke_push_calls WHERE target_user_id = p;
	IF seed <> 'She found the blue feather Maya''s pig was hoping for.' THEN RAISE EXCEPTION 'push body: %', seed; END IF;
	IF (SELECT push_data->>'screen' FROM public.smoke_push_calls WHERE target_user_id = p) <> 'pen' THEN RAISE EXCEPTION 'push screen'; END IF;
	IF (SELECT (push_data->>'errand_id')::bigint FROM public.smoke_push_calls WHERE target_user_id = p) <> eid THEN RAISE EXCEPTION 'push errand_id'; END IF;
	IF public.sweep_errand_returns() <> 0 THEN RAISE EXCEPTION 'never twice'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.interaction_analytics_events WHERE user_id = p AND event_name = 'errand_returned';
	IF n <> 1 THEN RAISE EXCEPTION 'one errand_returned event, got %', n; END IF;

	-- ── 7. the give: keep-then-gift, byte-for-byte the swap ──────────────────
	SELECT tickles_earned INTO earned_p FROM public.profiles WHERE id = p;
	SELECT tickles_earned INTO earned_q FROM public.profiles WHERE id = q;
	res := public.claim_errand(eid, 'give', nonce_c1);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'give: %', res; END IF;
	IF res->>'action' <> 'give' OR res->>'status' <> 'given' OR (res->>'tickles')::int <> 3 THEN RAISE EXCEPTION 'give answer: %', res; END IF;
	IF (res->>'bag_count')::int <> 0 THEN RAISE EXCEPTION 'the gift left the bag: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_swaps WHERE giver_id = p AND host_id = q AND took_find_id IS NULL AND gave_find_id = 'blue_feather' AND nonce = nonce_c1;
	IF n <> 1 THEN RAISE EXCEPTION 'exactly one gift swap row, got %', n; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = p;
	IF n <> 0 THEN RAISE EXCEPTION 'nothing stays in the giver''s bag, got %', n; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = q AND find_id = 'blue_feather' AND source = 'gift' AND from_user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'the host''s row is a gift, got %', n; END IF;
	SELECT tickles_earned INTO cnt FROM public.profiles WHERE id = p;
	IF cnt <> earned_p + 3 THEN RAISE EXCEPTION 'the giver''s flat 3: % → %', earned_p, cnt; END IF;
	SELECT tickles_earned INTO cnt FROM public.profiles WHERE id = q;
	IF cnt <> earned_q + 3 THEN RAISE EXCEPTION 'the host''s flat 3: % → %', earned_q, cnt; END IF;
	IF (SELECT status FROM public.pig_errands WHERE id = eid) <> 'given' THEN RAISE EXCEPTION 'status given'; END IF;
	SELECT wish_no INTO q_wish_no FROM public.pig_wishes WHERE user_id = q;
	IF q_wish_no <> 8 THEN RAISE EXCEPTION 'the wish rerolled: %', q_wish_no; END IF;
	-- the replay
	res2 := public.claim_errand(eid, 'give', nonce_c1);
	IF NOT (res2->>'ok')::boolean OR NOT (res2->>'replay')::boolean OR res2->>'status' <> 'given' THEN RAISE EXCEPTION 'claim replay: %', res2; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_swaps WHERE giver_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'replay wrote a swap: %', n; END IF;
	res := public.claim_errand(eid, 'keep', nonce_c2);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_claimed' THEN RAISE EXCEPTION 'expected already_claimed: %', res; END IF;
	res := public.pig_errands();
	IF jsonb_array_length(res->'board') <> 0 THEN RAISE EXCEPTION 'the board is clear: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.interaction_analytics_events WHERE user_id = p AND event_name = 'errand_claimed';
	IF n <> 1 THEN RAISE EXCEPTION 'one errand_claimed event, got %', n; END IF;

	-- ── 8. wish_moved: the give refused, the find kept, never lost ───────────
	PERFORM set_config('ttp.fake_now', t1::text, true);
	-- Maya's pig wants a blue feather again (a fresh wish number).
	UPDATE public.pig_wishes SET find_id = 'blue_feather', wish_no = 9, expires_at = now() + interval '30 days' WHERE user_id = q;
	res := public.send_pig('rosie', 'blue_feather', q, nonce_hit2);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'day-2 send: %', res; END IF;
	eid3 := (res->'errand'->>'id')::bigint;
	-- dev_summon_return: admin_only for a normal pig, home now for a test pig
	UPDATE public.profiles SET is_test = false WHERE id = p;
	res := public.dev_summon_return(eid3);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'admin_only' THEN RAISE EXCEPTION 'expected admin_only: %', res; END IF;
	UPDATE public.profiles SET is_test = true WHERE id = p;
	res := public.dev_summon_return(eid3);
	IF NOT (res->>'ok')::boolean OR res->'errand'->>'status' <> 'back' THEN RAISE EXCEPTION 'summon return: %', res; END IF;
	IF res->'errand'->'result_find_ids' <> '["blue_feather"]'::jsonb THEN RAISE EXCEPTION 'summoned roll: %', res; END IF;
	-- her wish moved while the pig was out
	UPDATE public.pig_wishes SET find_id = 'old_key', wish_no = 10 WHERE user_id = q;
	res := public.claim_errand(eid3, 'give', nonce_c3);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'wish_moved' THEN RAISE EXCEPTION 'expected wish_moved: %', res; END IF;
	IF res->>'status' <> 'kept' OR res->>'wish' <> 'old_key' THEN RAISE EXCEPTION 'wish_moved keeps, and says the live wish: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = p AND find_id = 'blue_feather' AND source = 'errand';
	IF n <> 1 THEN RAISE EXCEPTION 'the find is in the caller''s bag, got %', n; END IF;
	IF (SELECT status FROM public.pig_errands WHERE id = eid3) <> 'kept' THEN RAISE EXCEPTION 'status kept after a refused give'; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_swaps WHERE giver_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'no second swap row: %', n; END IF;
	-- the refusal replays too
	res2 := public.claim_errand(eid3, 'give', nonce_c3);
	IF (res2->>'ok')::boolean OR NOT (res2->>'replay')::boolean OR res2->>'reason' <> 'wish_moved' THEN RAISE EXCEPTION 'refusal replay: %', res2; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'the replay must not keep twice: %', n; END IF;

	-- ── 9. empty hands ───────────────────────────────────────────────────────
	res := public.send_pig('copper', 'blue_feather', NULL, nonce_miss_copper);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'copper day-2 send: %', res; END IF;
	eid4 := (res->'errand'->>'id')::bigint;
	res := public.dev_summon_return(eid4);
	IF NOT (res->>'ok')::boolean OR jsonb_array_length(res->'errand'->'result_find_ids') <> 0 THEN RAISE EXCEPTION 'muddy trotters: %', res; END IF;
	-- the push for an empty return never says so; a return claimed before the
	-- sweep (eid3) is never announced — the player has already seen it
	IF public.sweep_errand_returns() <> 1 THEN RAISE EXCEPTION 'one push for the empty return'; END IF;
	SELECT push_body INTO seed FROM public.smoke_push_calls WHERE target_user_id = p AND (push_data->>'errand_id')::bigint = eid4;
	IF seed IS DISTINCT FROM 'Back from the hedge — come and see.' THEN RAISE EXCEPTION 'empty push body: %', seed; END IF;
	SELECT COUNT(*)::int INTO n FROM public.smoke_push_calls WHERE target_user_id = p;
	IF n <> 2 THEN RAISE EXCEPTION 'two pushes so far (day 1, eid4; eid3 was claimed first), got %', n; END IF;
	res := public.claim_errand(eid4, 'give', nonce_c4);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_giveable' THEN RAISE EXCEPTION 'nothing to give: %', res; END IF;
	res := public.claim_errand(eid4, 'keep', nonce_c4);
	IF NOT (res->>'ok')::boolean OR res->>'status' <> 'kept' OR (res->>'kept')::int <> 0 THEN RAISE EXCEPTION 'keep nothing: %', res; END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = p;
	IF n <> 1 THEN RAISE EXCEPTION 'empty hands insert nothing: %', n; END IF;

	-- ── 10. board_full at the cap; the field guide ───────────────────────────
	UPDATE public.app_settings SET value = value || '{"board_cap": 1}'::jsonb WHERE key = 'errand_tuning';
	PERFORM set_config('ttp.fake_now', (t1 + interval '1 day')::text, true);
	res := public.send_pig('rosie', NULL, NULL, nonce_c5);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'day-3 send: %', res; END IF;
	res := public.dev_summon_return((res->'errand'->>'id')::bigint);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'day-3 summon: %', res; END IF;
	res := public.send_pig('copper', NULL, NULL, '00000000-0000-0000-0000-00000000e106');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'board_full' THEN RAISE EXCEPTION 'expected board_full: %', res; END IF;
	UPDATE public.app_settings SET value = value || '{"board_cap": 3}'::jsonb WHERE key = 'errand_tuning';
	res := public.send_pig('copper', NULL, NULL, '00000000-0000-0000-0000-00000000e106');
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'room again: %', res; END IF;
	-- the flag on: a normal pig sees it
	UPDATE public.profiles SET is_test = false WHERE id = p;
	UPDATE public.app_settings SET value = value || '{"enabled": true}'::jsonb WHERE key = 'errand_tuning';
	res := public.pig_errands();
	IF NOT (res->>'enabled')::boolean THEN RAISE EXCEPTION 'flag on: %', res; END IF;
	UPDATE public.app_settings SET value = value || '{"enabled": false}'::jsonb WHERE key = 'errand_tuning';
	PERFORM public.unlock_field_guide_page('pen');
	IF NOT EXISTS (SELECT 1 FROM public.field_guide_pages WHERE user_id = p AND page_id = 'pen') THEN
		RAISE EXCEPTION 'the field guide learns the pen'; END IF;

	PERFORM set_config('ttp.fake_now', '', true);
	PERFORM set_config('smoke.uid', '', true);
	RAISE NOTICE 'chk 99 errands ok: refusals in order, out 4h on the local day, away + host read, auto-tickler skips, recall spends the day, deterministic roll, lazy return + one push, give = the swap (3 both), replay, wish_moved keeps, empty hands, board cap, summon, field guide';
END
$errands$;

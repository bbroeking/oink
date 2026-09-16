-- The Barn Draw (20260916120000): the Monday herd prize + the Trough giver's
-- quarter reward.
--
-- Proves: cycle bounds derived from a cycle_key; the featured-collection
-- rotation off the 2026-09-14 epoch (including a pre-epoch week); one draw per
-- crew per cycle off a COMMITTED seed with the largest md5(seed:crew:user)
-- winning; a crew of one wins alone; a crew where nobody dug draws nothing and
-- shames nobody; re-running resolves nothing; the seed is revealed and the
-- next week's seed committed with a true sha256; the purse fallback when the
-- winner owns the whole pool; herd_prize_state() shows the caller's crew only;
-- and the Trough quarter rule — reward at the quarter, once per ISO week, from
-- the featured collection, never for giving below the quarter, never stacking.
\set ON_ERROR_STOP on

DO $barn_draw$
DECLARE
	h1 uuid := '00000000-0000-0000-0000-000000093001';  -- crew HA, dug
	h2 uuid := '00000000-0000-0000-0000-000000093002';  -- crew HA, dug
	h3 uuid := '00000000-0000-0000-0000-000000093003';  -- crew HA, slept
	h4 uuid := '00000000-0000-0000-0000-000000093004';  -- crew HB, dug (alone)
	h5 uuid := '00000000-0000-0000-0000-000000093005';  -- crew HC, slept
	h6 uuid := '00000000-0000-0000-0000-000000093006';  -- crew HD, dug, owns everything
	hz uuid := '00000000-0000-0000-0000-000000093007';  -- bot crew HZ, dug
	ha uuid := '00000000-0000-0000-0000-000000093010';
	hb uuid := '00000000-0000-0000-0000-000000093011';
	hc uuid := '00000000-0000-0000-0000-000000093012';
	hd uuid := '00000000-0000-0000-0000-000000093013';
	hzc uuid := '00000000-0000-0000-0000-000000093014';
	-- Trough cast
	t1 uuid := '00000000-0000-0000-0000-000000093021';  -- reaches a quarter
	t2 uuid := '00000000-0000-0000-0000-000000093022';  -- stays under the quarter
	t3 uuid := '00000000-0000-0000-0000-000000093023';  -- owns the featured collection
	topener uuid := '00000000-0000-0000-0000-000000093024';
	dr1 uuid := '00000000-0000-0000-0000-000000093031';
	dr2 uuid := '00000000-0000-0000-0000-000000093032';

	wk       text := '20260406';   -- a Monday
	nextwk   text := '20260413';
	seed_val text := 'barn-draw-smoke-seed';
	expect_w uuid;
	got_w    uuid;
	drew     int;
	st       jsonb;
	res      jsonb;
	feat     text;
	prize    text;
	before_t int; after_t int;
	n_rows   int;
BEGIN
	-- ── 1. Cycle bounds from a cycle_key ────────────────────────────────────
	IF (SELECT b.cycle_key FROM public._barn_cycle_bounds(wk) b) <> wk
	   OR (SELECT b.starts_at FROM public._barn_cycle_bounds(wk) b) <> '2026-04-06 00:00+00'::timestamptz
	   OR (SELECT b.ends_at   FROM public._barn_cycle_bounds(wk) b) <> '2026-04-13 00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'cycle bounds for % wrong: %', wk,
			(SELECT row_to_json(b) FROM public._barn_cycle_bounds(wk) b);
	END IF;

	-- ── 2. The featured-collection rotation ─────────────────────────────────
	-- The epoch week is position 1; the next week position 2; the week BEFORE
	-- the epoch wraps to position 10 (the safe modulo, not Postgres' -1).
	IF public._barn_featured_collection('20260914') <> 'orchard_morning'
	   OR public._barn_featured_collection('20260921') <> 'hearthside_supper'
	   OR public._barn_featured_collection('20261123') <> 'orchard_morning'
	   OR public._barn_featured_collection('20260907') <> 'moonlit_slumber' THEN
		RAISE EXCEPTION 'featured rotation drifted: % % % %',
			public._barn_featured_collection('20260914'),
			public._barn_featured_collection('20260921'),
			public._barn_featured_collection('20261123'),
			public._barn_featured_collection('20260907');
	END IF;

	-- ── 3. Herd fixtures ────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (h1),(h2),(h3),(h4),(h5),(h6),(hz),(t1),(t2),(t3),(topener)
		ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,tickles_earned,counter) VALUES
		(h1,'bd-h1',0,0),(h2,'bd-h2',0,0),(h3,'bd-h3',0,0),(h4,'bd-h4',0,0),
		(h5,'bd-h5',0,0),(h6,'bd-h6',0,0),(hz,'bd-hz',0,0),
		(t1,'bd-t1',0,5000),(t2,'bd-t2',0,5000),(t3,'bd-t3',0,5000),(topener,'bd-open',0,0)
		ON CONFLICT(id) DO UPDATE SET tickles_earned=EXCLUDED.tickles_earned, counter=EXCLUDED.counter;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES
		(ha,'Barn A',h1,false),(hb,'Barn B',h4,false),(hc,'Barn C',h5,false),
		(hd,'Barn D',h6,false),(hzc,'Barn Bot',hz,true) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES
		(ha,h1,'leader'),(ha,h2,'member'),(ha,h3,'member'),
		(hb,h4,'leader'),(hc,h5,'leader'),(hd,h6,'leader'),(hzc,hz,'leader')
		ON CONFLICT DO NOTHING;
	INSERT INTO public.race_digs(cycle_key,user_id,window_index,crew_id,finds) VALUES
		(wk,h1,9301,ha,4),(wk,h2,9301,ha,3),(wk,h4,9301,hb,2),
		(wk,h6,9301,hd,1),(wk,hz,9301,hzc,9) ON CONFLICT DO NOTHING;
	-- h6 already owns every for-sale, active furnishing → the purse fallback.
	INSERT INTO public.user_habitat_items(user_id,item_id)
		SELECT h6, i.id FROM public.habitat_items i WHERE i.is_for_sale AND i.active
		ON CONFLICT DO NOTHING;

	-- ── 4. Commit the week's seed, then resolve ─────────────────────────────
	INSERT INTO public.herd_prize_seeds(iso_week,seed,seed_hash)
		VALUES (wk, seed_val, encode(sha256(seed_val::bytea),'hex'))
		ON CONFLICT (iso_week) DO NOTHING;

	SELECT m.user_id INTO expect_w FROM public.crew_members m
		WHERE m.crew_id = ha AND m.user_id IN (h1,h2)
		ORDER BY md5(seed_val || ':' || ha::text || ':' || m.user_id::text) DESC LIMIT 1;

	SELECT tickles_earned INTO before_t FROM public.profiles WHERE id = h6;
	drew := public._herd_prize_resolve(wk);
	IF drew < 3 THEN
		RAISE EXCEPTION 'expected at least the three digging herds to draw, got %', drew; END IF;

	-- HA: the committed seed decides, and the sleeper is not an entrant.
	SELECT winner_user_id INTO got_w FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha;
	IF got_w IS DISTINCT FROM expect_w THEN
		RAISE EXCEPTION 'HA winner should be the largest md5 key: expected %, got %', expect_w, got_w; END IF;
	IF (SELECT entrants FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha)
	   <> jsonb_build_array(to_jsonb(h1), to_jsonb(h2)) THEN
		RAISE EXCEPTION 'HA entrants should be the two diggers only: %',
			(SELECT entrants FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha); END IF;
	IF (SELECT winner_key FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha)
	   <> md5(seed_val || ':' || ha::text || ':' || expect_w::text) THEN
		RAISE EXCEPTION 'HA winner_key should be recomputable by hand'; END IF;
	-- The prize is a for-sale, active furnishing the winner did not own.
	SELECT item_id INTO prize FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha;
	IF prize IS NULL
	   OR NOT EXISTS (SELECT 1 FROM public.habitat_items WHERE id = prize AND is_for_sale AND active)
	   OR NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = expect_w AND item_id = prize)
	   OR NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	                  WHERE user_id = expect_w AND source = 'herd_prize' AND source_ref = wk AND item_id = prize) THEN
		RAISE EXCEPTION 'HA prize should be a granted for-sale furnishing: %', prize; END IF;
	IF (SELECT kind FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha) <> 'habitat' THEN
		RAISE EXCEPTION 'HA prize kind should be habitat'; END IF;

	-- HB: a herd of one draws alone and wins.
	IF (SELECT winner_user_id FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hb) <> h4 THEN
		RAISE EXCEPTION 'a crew of one should win its own draw'; END IF;

	-- HC: nobody dug → a 'none' row, no winner, no grant, no shame.
	IF (SELECT kind FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hc) <> 'none'
	   OR (SELECT winner_user_id FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hc) IS NOT NULL
	   OR EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = h5) THEN
		RAISE EXCEPTION 'a herd where nobody dug draws nothing'; END IF;

	-- Bot crews never draw.
	IF EXISTS (SELECT 1 FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hzc) THEN
		RAISE EXCEPTION 'bot crews must not enter the herd prize'; END IF;

	-- HD: the winner owns every for-sale furnishing → a purse, never a zero.
	IF (SELECT kind FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hd) <> 'tickles'
	   OR (SELECT item_id FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hd) IS NOT NULL
	   OR (SELECT amount FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hd) <= 0 THEN
		RAISE EXCEPTION 'HD should fall back to a tickle purse: %',
			(SELECT row_to_json(x) FROM public.herd_prize_draws x WHERE iso_week = wk AND crew_id = hd); END IF;
	SELECT tickles_earned INTO after_t FROM public.profiles WHERE id = h6;
	IF after_t - before_t <> (SELECT amount FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = hd) THEN
		RAISE EXCEPTION 'the purse fallback must mint through apply_tickles'; END IF;

	-- ── 5. Seed reveal + the next week's commitment ─────────────────────────
	IF (SELECT revealed_at FROM public.herd_prize_seeds WHERE iso_week = wk) IS NULL THEN
		RAISE EXCEPTION 'the drawn week''s seed should be revealed'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.herd_prize_seeds
	               WHERE iso_week = nextwk AND revealed_at IS NULL
	                 AND seed_hash = encode(sha256(seed::bytea),'hex')) THEN
		RAISE EXCEPTION 'the next week''s seed should be committed, hashed, and sealed'; END IF;

	-- ── 6. Idempotence: a second resolve redraws and regrants nothing ───────
	SELECT count(*) INTO n_rows FROM public.herd_prize_draws WHERE iso_week = wk;
	IF public._herd_prize_resolve(wk) <> 0 THEN
		RAISE EXCEPTION 'a second resolve must draw nothing'; END IF;
	IF (SELECT count(*) FROM public.herd_prize_draws WHERE iso_week = wk) <> n_rows
	   OR (SELECT winner_user_id FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha) <> expect_w
	   OR (SELECT item_id FROM public.herd_prize_draws WHERE iso_week = wk AND crew_id = ha) <> prize
	   OR (SELECT count(*) FROM public.habitat_grant_receipts
	       WHERE user_id = expect_w AND source = 'herd_prize' AND source_ref = wk) <> 1 THEN
		RAISE EXCEPTION 'a second resolve must not redraw or regrant'; END IF;

	-- ── 7. herd_prize_state() — the caller's crew only ──────────────────────
	PERFORM set_config('ttp.fake_now','2026-04-15 09:00+00',true);   -- the week after
	PERFORM set_config('smoke.uid', h3::text, true);                 -- HA's sleeper still sees the herd's prize
	st := public.herd_prize_state();
	IF NOT (st->>'ok')::boolean
	   OR st->'week'->>'cycle_key' <> nextwk
	   OR st->'week'->>'seed_hash' IS NULL
	   OR st->'last'->>'cycle_key' <> wk
	   OR st->'last'->>'seed' <> seed_val
	   OR (st->'last'->>'winner_user_id')::uuid <> expect_w
	   OR st->'last'->>'winner_name' IS NULL
	   OR st->'last'->>'kind' <> 'habitat'
	   OR st->'last'->>'item_id' <> prize
	   OR st->'last'->>'item_name' IS NULL
	   OR jsonb_array_length(st->'last'->'entrants') <> 2 THEN
		RAISE EXCEPTION 'herd_prize_state wrong for HA: %', st; END IF;
	-- The published hash is the hash of the SEALED seed, and that seed stays hidden.
	IF st->'week'->>'seed_hash'
	   <> (SELECT encode(sha256(seed::bytea),'hex') FROM public.herd_prize_seeds WHERE iso_week = nextwk) THEN
		RAISE EXCEPTION 'week.seed_hash must be sha256 of the sealed seed'; END IF;
	-- A crewless caller has no last draw.
	PERFORM set_config('smoke.uid', t1::text, true);
	st := public.herd_prize_state();
	IF NOT (st->>'ok')::boolean OR st->'last' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'a crewless caller should see no last draw: %', st; END IF;

	-- ── 8. The race cycle resolves the herd prize exactly once ──────────────
	-- _race_pay_cycle carries the one added line; its cycle_payouts guard makes
	-- the whole body (herd prize included) run once per cycle.
	PERFORM set_config('ttp.fake_now','',true);
	IF NOT public._race_pay_cycle(wk) THEN
		RAISE EXCEPTION 'first payout of % should land', wk; END IF;
	IF (SELECT count(*) FROM public.herd_prize_draws WHERE iso_week = wk) <> n_rows THEN
		RAISE EXCEPTION '_race_pay_cycle must not redraw an already-resolved week'; END IF;
	IF public._race_pay_cycle(wk) THEN
		RAISE EXCEPTION 'second payout of % must be a no-op', wk; END IF;

	-- ── 9. The Trough quarter rule ──────────────────────────────────────────
	PERFORM set_config('ttp.fake_now','2026-04-08 12:00+00',true);   -- inside the 20260406 cycle
	feat := public._barn_featured_collection(wk);
	IF feat IS NULL THEN RAISE EXCEPTION 'no featured collection for %', wk; END IF;

	INSERT INTO public.item_drives(id,opener_user_id,item_id,status,closes_at,target_snouts,raised_snouts)
		VALUES (dr1, topener, 'bd_item', 'open', now() + interval '72 hours', 1000, 0),
		       (dr2, topener, 'bd_item', 'open', now() + interval '72 hours', 1000, 0)
		ON CONFLICT DO NOTHING;
	-- t3 owns the whole featured collection → the purse fallback.
	INSERT INTO public.user_habitat_items(user_id,item_id)
		SELECT t3, i.id FROM public.habitat_items i
		WHERE i.collection_id = feat AND i.is_for_sale AND i.active
		ON CONFLICT DO NOTHING;

	-- Under the quarter (cap = 250): helps, but draws nothing.
	PERFORM set_config('smoke.uid', t2::text, true);
	res := public.donate_to_drive(dr1, 100);
	IF NOT (res->>'ok')::boolean OR (res->>'quarter_reached')::boolean
	   OR res->'reward' <> 'null'::jsonb OR (res->>'weekly_reward_taken')::boolean THEN
		RAISE EXCEPTION 'a chip under the quarter draws nothing: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.trough_weekly_rewards WHERE user_id = t2) THEN
		RAISE EXCEPTION 'no receipt below the quarter'; END IF;
	IF (SELECT tickle_reward FROM public.item_drive_donations
	    WHERE donor_user_id = t2 AND drive_id = dr1) <> 0 THEN
		RAISE EXCEPTION 'the 1:100 tickle credit is retired'; END IF;
	st := public.trough_reward_state();
	IF NOT (st->>'ok')::boolean OR st->>'cycle_key' <> wk
	   OR (st->>'taken')::boolean OR st->'reward' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'trough_reward_state wrong before a draw: %', st; END IF;

	-- Reaching the quarter draws one design from the featured collection.
	PERFORM set_config('smoke.uid', t1::text, true);
	res := public.donate_to_drive(dr1, 250);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'quarter_reached')::boolean
	   OR NOT (res->>'weekly_reward_taken')::boolean
	   OR res->'reward'->>'kind' <> 'habitat'
	   OR res->'reward'->>'item_id' IS NULL
	   OR res->'reward'->>'item_name' IS NULL
	   OR (res->>'raised')::int <> 350 OR (res->>'target')::int <> 1000
	   OR (res->>'funded')::boolean THEN
		RAISE EXCEPTION 'the quarter should draw a design: %', res; END IF;
	prize := res->'reward'->>'item_id';
	IF NOT EXISTS (SELECT 1 FROM public.habitat_items
	               WHERE id = prize AND collection_id = feat AND is_for_sale AND active)
	   OR NOT EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = t1 AND item_id = prize)
	   OR NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	                  WHERE user_id = t1 AND source = 'trough_quarter' AND source_ref = wk AND item_id = prize)
	   OR NOT EXISTS (SELECT 1 FROM public.trough_weekly_rewards
	                  WHERE user_id = t1 AND iso_week = wk AND drive_id = dr1
	                    AND kind = 'habitat' AND item_id = prize AND amount = 0) THEN
		RAISE EXCEPTION 'the quarter reward should be a featured-collection grant with a receipt: %', prize; END IF;
	st := public.trough_reward_state();
	IF NOT (st->>'taken')::boolean OR st->'reward'->>'kind' <> 'habitat'
	   OR st->'reward'->>'item_id' <> prize OR st->'reward'->>'item_name' IS NULL THEN
		RAISE EXCEPTION 'trough_reward_state should echo the week''s draw: %', st; END IF;

	-- No stacking: a second quarter, on another Trough, in the same week.
	res := public.donate_to_drive(dr2, 250);
	IF NOT (res->>'ok')::boolean OR NOT (res->>'quarter_reached')::boolean
	   OR NOT (res->>'weekly_reward_taken')::boolean
	   OR res->'reward' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'one reward per week, whichever Trough: %', res; END IF;
	IF (SELECT count(*) FROM public.trough_weekly_rewards WHERE user_id = t1) <> 1 THEN
		RAISE EXCEPTION 'a week holds exactly one giver receipt'; END IF;

	-- Owning the whole featured collection pays a purse instead.
	SELECT tickles_earned INTO before_t FROM public.profiles WHERE id = t3;
	PERFORM set_config('smoke.uid', t3::text, true);
	res := public.donate_to_drive(dr1, 250);
	IF NOT (res->>'ok')::boolean OR res->'reward'->>'kind' <> 'tickles'
	   OR (res->'reward'->>'amount')::int <= 0
	   OR res->'reward'->>'item_id' IS NOT NULL THEN
		RAISE EXCEPTION 'a complete collection should pay a purse: %', res; END IF;
	SELECT tickles_earned INTO after_t FROM public.profiles WHERE id = t3;
	IF after_t - before_t <> (res->'reward'->>'amount')::int THEN
		RAISE EXCEPTION 'the Trough purse must mint through apply_tickles'; END IF;
	IF (SELECT tickle_reward FROM public.item_drive_donations
	    WHERE donor_user_id = t3 AND drive_id = dr1) <> (res->'reward'->>'amount')::int THEN
		RAISE EXCEPTION 'the ledger should record the purse as the donation''s tickle_reward'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.trough_weekly_rewards
	               WHERE user_id = t3 AND iso_week = wk AND kind = 'tickles'
	                 AND item_id IS NULL AND amount = (res->'reward'->>'amount')::int) THEN
		RAISE EXCEPTION 'the purse fallback should leave a tickles receipt'; END IF;

	-- Giving never enters the herd prize: t1/t2/t3 are crewless and undrawn.
	IF EXISTS (SELECT 1 FROM public.herd_prize_draws
	           WHERE winner_user_id IN (t1,t2,t3)) THEN
		RAISE EXCEPTION 'giving to a Trough must not enter the herd prize'; END IF;

	-- The old guards still hold on the carried body.
	res := public.donate_to_drive(dr1, 50);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'donate_cooldown' THEN
		RAISE EXCEPTION '12h per-drive cooldown should still bite: %', res; END IF;
	PERFORM set_config('smoke.uid', topener::text, true);
	res := public.donate_to_drive(dr1, 50);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'self' THEN
		RAISE EXCEPTION 'the opener still seeds through open_item_drive: %', res; END IF;

	PERFORM set_config('ttp.fake_now','',true);
	RAISE NOTICE 'chk barn_draw: herd prize + seed commitment + Trough quarter reward OK';
END
$barn_draw$;

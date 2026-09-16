-- Monday tickle draw + furnishing spoils (20260916110000): the draw week is
-- the cycle that just ended; eligibility = a dig inside it (race_digs OR a
-- rooting_receipts row); one draw per (user, week), minted through
-- apply_tickles; the catch-up curve + "1 in N"; a bottom-half herd only ever
-- warms; the weekly payout grants bunting instead of tickles; race_standings'
-- prizes read honest zeros + the two furnishings.
\set ON_ERROR_STOP on

DO $monday_draw$
DECLARE
	m1 uuid := '00000000-0000-0000-0000-000000091001';  -- crew MA (rank 1)
	m2 uuid := '00000000-0000-0000-0000-000000091002';  -- crew MA
	m3 uuid := '00000000-0000-0000-0000-000000091003';  -- crew MB (rank 2)
	m4 uuid := '00000000-0000-0000-0000-000000091004';  -- crew MB
	m5 uuid := '00000000-0000-0000-0000-000000091005';  -- crew MC (rank 3, bottom half)
	m6 uuid := '00000000-0000-0000-0000-000000091006';  -- crew MC
	m7 uuid := '00000000-0000-0000-0000-000000091007';  -- uncrewed, dug (receipt only)
	m8 uuid := '00000000-0000-0000-0000-000000091008';  -- crew MA, slept
	ma uuid := '00000000-0000-0000-0000-000000091010';
	mb uuid := '00000000-0000-0000-0000-000000091011';
	mc uuid := '00000000-0000-0000-0000-000000091012';
	wk text := '20260302';
	st jsonb; res jsonb; again jsonb; saved jsonb;
	before_t int; after_t int; before_c int; after_c int;
BEGIN
	-- ── fixtures ────────────────────────────────────────────────────────────
	INSERT INTO auth.users(id) VALUES (m1),(m2),(m3),(m4),(m5),(m6),(m7),(m8) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,tickles_earned,counter) VALUES
		(m1,'md-m1',100,10),(m2,'md-m2',0,0),(m3,'md-m3',5,5),(m4,'md-m4',0,0),
		(m5,'md-m5',0,0),(m6,'md-m6',0,0),(m7,'md-m7',40,4),(m8,'md-m8',0,0)
		ON CONFLICT(id) DO UPDATE SET tickles_earned=EXCLUDED.tickles_earned, counter=EXCLUDED.counter;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES
		(ma,'Monday A',m1,false),(mb,'Monday B',m3,false),(mc,'Monday C',m5,false) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES
		(ma,m1,'leader'),(ma,m2,'member'),(ma,m8,'member'),
		(mb,m3,'leader'),(mb,m4,'member'),
		(mc,m5,'leader'),(mc,m6,'member') ON CONFLICT DO NOTHING;
	-- The week of 2026-03-02 (Mon) → 2026-03-09: MA 18 finds, MB 5, MC 2.
	INSERT INTO public.race_digs(cycle_key,user_id,window_index,crew_id,finds) VALUES
		(wk,m1,9101,ma,10),(wk,m2,9101,ma,8),
		(wk,m3,9101,mb,3),(wk,m4,9101,mb,2),
		(wk,m5,9101,mc,1),(wk,m6,9101,mc,1) ON CONFLICT DO NOTHING;
	-- m7 dug uncrewed: only a durable receipt inside the week.
	INSERT INTO public.rooting_receipts(user_id,window_index,receipt,created_at)
		VALUES (m7,9102,'{"ok":true}'::jsonb,'2026-03-04 10:00+00') ON CONFLICT DO NOTHING;
	-- Prior draws: m5 three below-rare in a row (a missing week in between);
	-- m6 a jackpot two weeks back, then one common.
	INSERT INTO public.monday_draws(user_id,iso_week,tier,amount,mondays_since_rare_before,herd_bottom_half) VALUES
		(m5,'20260202','common',20,0,false),(m5,'20260216','good',60,1,false),(m5,'20260223','common',20,2,false),
		(m6,'20260202','common',20,0,false),(m6,'20260209','jackpot',400,1,false),(m6,'20260223','common',20,0,false)
		ON CONFLICT DO NOTHING;
	-- Tuesday 2026-03-10: the 03-02 race is run; the purse is for that week.
	PERFORM set_config('ttp.fake_now','2026-03-10 12:00+00',true);

	-- ── tuning + the curve ──────────────────────────────────────────────────
	IF public._monday_draw_multiplier(0) <> 1 OR public._monday_draw_multiplier(1) <> 1
	   OR public._monday_draw_multiplier(2) <> 1.5 OR public._monday_draw_multiplier(3) <> 2
	   OR public._monday_draw_multiplier(4) <> 2.5 OR public._monday_draw_multiplier(5) <> 3
	   OR public._monday_draw_multiplier(40) <> 3 THEN
		RAISE EXCEPTION 'catch-up curve drifted: % % % % % %',
			public._monday_draw_multiplier(0), public._monday_draw_multiplier(2),
			public._monday_draw_multiplier(3), public._monday_draw_multiplier(4),
			public._monday_draw_multiplier(5), public._monday_draw_multiplier(40);
	END IF;
	-- 12/100 → 1 in 8; ×2.5 → 30/118 → 1 in 4; ×3 → 36/124 → 1 in 3.
	IF public._monday_draw_odds_one_in(1) <> 8 OR public._monday_draw_odds_one_in(2.5) <> 4
	   OR public._monday_draw_odds_one_in(3) <> 3 THEN
		RAISE EXCEPTION 'odds drifted: % % %', public._monday_draw_odds_one_in(1),
			public._monday_draw_odds_one_in(2.5), public._monday_draw_odds_one_in(3);
	END IF;
	IF (SELECT cycle_key FROM public._monday_draw_week('2026-03-10 12:00+00')) <> wk
	   OR (SELECT cycle_key FROM public._monday_draw_week('2026-03-09 00:00+00')) <> wk
	   OR (SELECT cycle_key FROM public._monday_draw_week('2026-03-08 23:59+00')) <> '20260223' THEN
		RAISE EXCEPTION 'draw week should be the cycle that just ended';
	END IF;

	-- ── not eligible: slept all week → no purse, no row, no tickles ─────────
	PERFORM set_config('smoke.uid', m8::text, true);
	st := public.monday_draw_state();
	IF (st->>'eligible')::boolean OR (st->>'drawn')::boolean OR st->>'week' <> wk THEN
		RAISE EXCEPTION 'm8 should be ineligible + undrawn: %', st; END IF;
	res := public.draw_monday_purse();
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_eligible' THEN
		RAISE EXCEPTION 'm8 draw should refuse: %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.monday_draws WHERE user_id = m8) THEN
		RAISE EXCEPTION 'refused draw must not write a row'; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id = m8) <> 0 THEN
		RAISE EXCEPTION 'refused draw must not mint'; END IF;

	-- ── state before a draw: streak, herd flag, odds — and READ-ONLY ────────
	PERFORM set_config('smoke.uid', m1::text, true);
	SELECT tickles_earned, counter INTO before_t, before_c FROM public.profiles WHERE id = m1;
	st := public.monday_draw_state();
	st := public.monday_draw_state();   -- peeking twice rolls nothing
	IF NOT (st->>'eligible')::boolean OR (st->>'drawn')::boolean
	   OR (st->>'mondays_since_rare')::int <> 0 OR (st->>'herd_bottom_half')::boolean
	   OR (st->>'next_rare_odds_one_in')::int <> 8
	   OR jsonb_array_length(st->'tiers') <> 4 OR st->'catchup' IS NULL THEN
		RAISE EXCEPTION 'm1 pre-draw state wrong: %', st; END IF;
	IF EXISTS (SELECT 1 FROM public.monday_draws WHERE user_id = m1)
	   OR (SELECT tickles_earned FROM public.profiles WHERE id = m1) <> before_t
	   OR (SELECT counter FROM public.profiles WHERE id = m1) <> before_c THEN
		RAISE EXCEPTION 'monday_draw_state must never write (peek is read-only)'; END IF;
	IF (SELECT provolatile FROM pg_proc WHERE proname = 'monday_draw_state'
	    AND pronamespace = 'public'::regnamespace) <> 's' THEN
		RAISE EXCEPTION 'monday_draw_state must stay STABLE'; END IF;
	-- m5: 3 below-rare draws (missing week skipped), bottom-half herd → 4 steps → ×2.5 → 1 in 4.
	PERFORM set_config('smoke.uid', m5::text, true);
	st := public.monday_draw_state();
	IF (st->>'mondays_since_rare')::int <> 3 OR NOT (st->>'herd_bottom_half')::boolean
	   OR (st->>'next_rare_odds_one_in')::int <> 4 THEN
		RAISE EXCEPTION 'm5 catch-up state wrong: %', st; END IF;
	-- m6: the jackpot resets the streak → 1, bottom half → 2 steps → ×1.5 → 18/106 → 1 in 6.
	PERFORM set_config('smoke.uid', m6::text, true);
	st := public.monday_draw_state();
	IF (st->>'mondays_since_rare')::int <> 1 OR (st->>'next_rare_odds_one_in')::int <> 6 THEN
		RAISE EXCEPTION 'm6 streak should stop at the jackpot: %', st; END IF;

	-- ── the draw: minted through apply_tickles, once ────────────────────────
	PERFORM set_config('smoke.uid', m1::text, true);
	SELECT tickles_earned, counter INTO before_t, before_c FROM public.profiles WHERE id = m1;
	res := public.draw_monday_purse();
	IF NOT (res->>'ok')::boolean OR NOT (res->>'drawn')::boolean
	   OR res->>'tier' NOT IN ('common','good','rare','jackpot')
	   OR (res->>'amount')::int NOT IN (20,60,150,400)
	   OR (res->>'tier' = 'common' AND (res->>'amount')::int <> 20)
	   OR (res->>'tier' = 'good' AND (res->>'amount')::int <> 60)
	   OR (res->>'tier' = 'rare' AND (res->>'amount')::int <> 150)
	   OR (res->>'tier' = 'jackpot' AND (res->>'amount')::int <> 400) THEN
		RAISE EXCEPTION 'm1 draw shape wrong: %', res; END IF;
	SELECT tickles_earned, counter INTO after_t, after_c FROM public.profiles WHERE id = m1;
	IF after_t - before_t <> (res->>'amount')::int OR after_c - before_c <> (res->>'amount')::int THEN
		RAISE EXCEPTION 'purse must land through apply_tickles (count + snouts): % → % / % → %',
			before_t, after_t, before_c, after_c; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.monday_draws WHERE user_id = m1 AND iso_week = wk
	               AND tier = res->>'tier' AND amount = (res->>'amount')::int
	               AND mondays_since_rare_before = 0 AND herd_bottom_half = false) THEN
		RAISE EXCEPTION 'm1 receipt row wrong'; END IF;
	-- The streak after the draw: 0 on rare+, else 1.
	IF (res->>'mondays_since_rare')::int <>
	   (CASE WHEN res->>'tier' IN ('rare','jackpot') THEN 0 ELSE 1 END) THEN
		RAISE EXCEPTION 'post-draw streak wrong: %', res; END IF;
	-- Idempotent: a second tap returns the same purse and mints nothing.
	again := public.draw_monday_purse();
	IF again->>'tier' <> res->>'tier' OR (again->>'amount')::int <> (res->>'amount')::int
	   OR NOT (again->>'drawn')::boolean THEN
		RAISE EXCEPTION 'second draw must echo the first: % vs %', again, res; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id = m1) <> after_t
	   OR (SELECT count(*) FROM public.monday_draws WHERE user_id = m1) <> 1 THEN
		RAISE EXCEPTION 'second draw double-minted'; END IF;
	st := public.monday_draw_state();
	IF NOT (st->>'drawn')::boolean OR (st->>'amount')::int <> (res->>'amount')::int THEN
		RAISE EXCEPTION 'state should echo the draw: %', st; END IF;

	-- ── uncrewed digger draws too (receipt-only eligibility) ────────────────
	PERFORM set_config('smoke.uid', m7::text, true);
	st := public.monday_draw_state();
	IF NOT (st->>'eligible')::boolean OR (st->>'herd_bottom_half')::boolean THEN
		RAISE EXCEPTION 'm7 (uncrewed, dug) should be eligible: %', st; END IF;
	res := public.draw_monday_purse();
	IF NOT (res->>'ok')::boolean OR (res->>'amount')::int < 20 THEN
		RAISE EXCEPTION 'm7 draw failed: %', res; END IF;

	-- ── the roll honors the tuning row (pin one tier, draw, restore) ────────
	SELECT value INTO saved FROM public.app_settings WHERE key = 'monday_draw';
	UPDATE public.app_settings SET value = jsonb_set(saved, '{tiers}',
		'[{"tier":"common","amount":20,"weight":0},{"tier":"good","amount":60,"weight":0},{"tier":"rare","amount":150,"weight":0},{"tier":"jackpot","amount":400,"weight":1}]'::jsonb)
		WHERE key = 'monday_draw';
	PERFORM set_config('smoke.uid', m3::text, true);
	res := public.draw_monday_purse();
	IF res->>'tier' <> 'jackpot' OR (res->>'amount')::int <> 400 OR (res->>'mondays_since_rare')::int <> 0 THEN
		RAISE EXCEPTION 'pinned jackpot should draw jackpot: %', res; END IF;
	UPDATE public.app_settings SET value = jsonb_set(saved, '{tiers}',
		'[{"tier":"common","amount":20,"weight":1},{"tier":"good","amount":60,"weight":0},{"tier":"rare","amount":150,"weight":0},{"tier":"jackpot","amount":400,"weight":0}]'::jsonb)
		WHERE key = 'monday_draw';
	PERFORM set_config('smoke.uid', m4::text, true);
	res := public.draw_monday_purse();
	IF res->>'tier' <> 'common' OR (res->>'amount')::int <> 20 OR (res->>'mondays_since_rare')::int <> 1 THEN
		RAISE EXCEPTION 'pinned common should draw common: %', res; END IF;
	UPDATE public.app_settings SET value = saved WHERE key = 'monday_draw';
	-- m5's draw stores the catch-up inputs it rolled with.
	PERFORM set_config('smoke.uid', m5::text, true);
	res := public.draw_monday_purse();
	IF NOT EXISTS (SELECT 1 FROM public.monday_draws WHERE user_id = m5 AND iso_week = wk
	               AND mondays_since_rare_before = 3 AND herd_bottom_half = true) THEN
		RAISE EXCEPTION 'm5 receipt should carry streak 3 + bottom half'; END IF;

	-- ── weekly spoils: bunting, not tickles ─────────────────────────────────
	SELECT tickles_earned INTO before_t FROM public.profiles WHERE id = m2;
	IF NOT public._race_pay_cycle(wk) THEN
		RAISE EXCEPTION 'first payout of % should land', wk; END IF;
	IF public._race_pay_cycle(wk) THEN
		RAISE EXCEPTION 'second payout of % must be a no-op', wk; END IF;
	IF (SELECT tickles_earned FROM public.profiles WHERE id = m2) <> before_t THEN
		RAISE EXCEPTION 'the payout must not pay tickles any more'; END IF;
	IF (SELECT count(*) FROM public.user_habitat_items
	    WHERE item_id = 'barn_bunting' AND user_id IN (m1,m2,m3,m4,m5,m6)) <> 6 THEN
		RAISE EXCEPTION 'every digging snout in a ranked herd gets barn_bunting'; END IF;
	IF (SELECT count(*) FROM public.user_habitat_items
	    WHERE item_id = 'gold_bunting' AND user_id IN (m1,m2)) <> 2
	   OR EXISTS (SELECT 1 FROM public.user_habitat_items
	              WHERE item_id = 'gold_bunting' AND user_id IN (m3,m4,m5,m6,m8)) THEN
		RAISE EXCEPTION 'only the winning herd''s diggers get gold_bunting'; END IF;
	IF EXISTS (SELECT 1 FROM public.user_habitat_items WHERE user_id = m8) THEN
		RAISE EXCEPTION 'a sleeper gets no spoils (and no shame)'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	               WHERE user_id = m1 AND source = 'race_spoils' AND source_ref = wk AND item_id = 'barn_bunting')
	   OR NOT EXISTS (SELECT 1 FROM public.habitat_grant_receipts
	               WHERE user_id = m1 AND source = 'race_spoils_first' AND source_ref = wk AND item_id = 'gold_bunting') THEN
		RAISE EXCEPTION 'spoils should leave idempotent grant receipts'; END IF;
	SELECT detail INTO res FROM public.cycle_payouts WHERE cycle_key = wk;
	IF res->'members'->(m1::text)->'furnishings_paid' <> '["barn_bunting","gold_bunting"]'::jsonb
	   OR res->'members'->(m3::text)->'furnishings_paid' <> '["barn_bunting"]'::jsonb
	   OR (res->'members'->(m1::text)->>'tickles_paid')::int <> 0
	   OR (res->'members'->(m1::text)->>'truffles_paid')::int <> 6
	   OR res->'members'->(m8::text)->'furnishings_paid' <> '[]'::jsonb THEN
		RAISE EXCEPTION 'cycle_payouts detail wrong: %', res->'members'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.system_announcements
	               WHERE user_id = m1 AND kind = 'race_result' AND body LIKE '%Gold Bunting for your Barn%')
	   OR NOT EXISTS (SELECT 1 FROM public.system_announcements
	               WHERE user_id = m3 AND kind = 'race_result' AND body LIKE '%Barn Bunting for your Barn%') THEN
		RAISE EXCEPTION 'race_result announcement should name the bunting'; END IF;

	-- ── race_standings: honest prizes ───────────────────────────────────────
	PERFORM set_config('smoke.uid', m1::text, true);
	st := public.race_standings();
	IF (st->'prizes'->'tickles'->>'first')::int <> 0 OR (st->'prizes'->'tickles'->>'participation')::int <> 0
	   OR st->'prizes'->'furnishings'->>'all_who_dug' <> 'barn_bunting'
	   OR st->'prizes'->'furnishings'->>'first' <> 'gold_bunting'
	   OR (st->'prizes'->'truffles'->>'first')::int <> 6 THEN
		RAISE EXCEPTION 'prizes payload wrong: %', st->'prizes'; END IF;
	IF st->'last'->>'cycle_key' <> wk OR st->'last'->'furnishings_paid' <> '["barn_bunting","gold_bunting"]'::jsonb THEN
		RAISE EXCEPTION 'last payout should carry the furnishings: %', st->'last'; END IF;

	-- gold_bunting is grant-only in the catalog
	IF NOT EXISTS (SELECT 1 FROM public.habitat_items
	               WHERE id = 'gold_bunting' AND is_for_sale = false AND snout_cost = 0
	                 AND category = 'wall_decor' AND active) THEN
		RAISE EXCEPTION 'gold_bunting catalog row wrong'; END IF;

	PERFORM set_config('ttp.fake_now','',true);
	RAISE NOTICE 'chk monday_draw: draw + catch-up + spoils OK';
END
$monday_draw$;

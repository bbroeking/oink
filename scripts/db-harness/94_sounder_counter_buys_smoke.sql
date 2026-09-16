-- sounder_counter_buys() (20260916130000): the sounder at the counter.
--
-- Proves: a crewmate's priced buy from today is listed with who / pig / item /
-- when; the caller's own buys are not; yesterday's buys are not; another
-- crew's buys are not; a pass reward and a hidden-category item are not, even
-- when bought today; a member-only item IS listed; a pig with no crew sees an
-- empty counter (no error); newest first.
\set ON_ERROR_STOP on

DO $counter$
DECLARE
	c1 uuid := '00000000-0000-0000-0000-000000094001';  -- caller, crew CA
	c2 uuid := '00000000-0000-0000-0000-000000094002';  -- crew CA, bought today
	c3 uuid := '00000000-0000-0000-0000-000000094003';  -- crew CA, bought two days ago
	c4 uuid := '00000000-0000-0000-0000-000000094004';  -- crew CB, bought today
	c5 uuid := '00000000-0000-0000-0000-000000094005';  -- crew CA, pass reward + scarf + members piece today
	c6 uuid := '00000000-0000-0000-0000-000000094006';  -- no crew
	ca uuid := '00000000-0000-0000-0000-000000094010';
	cb uuid := '00000000-0000-0000-0000-000000094011';
	n int;
	first_hat text;
	first_user uuid;
BEGIN
	INSERT INTO auth.users (id) VALUES (c1), (c2), (c3), (c4), (c5), (c6) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, active_pig_id) VALUES
		(c1, 'caller', 'rosie'), (c2, 'jen', 'copper'), (c3, 'sam', 'rosie'),
		(c4, 'priya', 'rosie'), (c5, 'marco', 'pepper'), (c6, 'loner', 'rosie')
	ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, active_pig_id = EXCLUDED.active_pig_id;
	INSERT INTO public.crews (id, name) VALUES (ca, 'Counter A'), (cb, 'Counter B') ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members (crew_id, user_id) VALUES
		(ca, c1), (ca, c2), (ca, c3), (ca, c5), (cb, c4)
	ON CONFLICT DO NOTHING;

	INSERT INTO public.hats (id, cost, category, pass_exclusive) VALUES
		('ctr_top_hat',  200, 'hat',   false),
		('ctr_halo',    1800, 'hat',   false),
		('ctr_beanie',   126, 'hat',   false),
		('ctr_pass_bow',   0, 'bow',   true),
		('ctr_scarf',    150, 'scarf', false),
		('ctr_members',  900, 'hat',   false)
	ON CONFLICT (id) DO UPDATE SET cost = EXCLUDED.cost, category = EXCLUDED.category, pass_exclusive = EXCLUDED.pass_exclusive;
	-- The stub's hats has no members_only column in some chains; only set it
	-- when it exists (prod always has it, 20260688).
	IF EXISTS (SELECT 1 FROM information_schema.columns
	           WHERE table_schema = 'public' AND table_name = 'hats' AND column_name = 'members_only') THEN
		UPDATE public.hats SET members_only = true WHERE id = 'ctr_members';
	END IF;

	INSERT INTO public.user_hats (user_id, hat_id, acquired_at) VALUES
		(c1, 'ctr_halo',     now()),                       -- the caller's own buy
		(c2, 'ctr_top_hat',  now() - interval '1 hour'),   -- crewmate, today
		(c3, 'ctr_beanie',   now() - interval '2 days'),   -- crewmate, stale
		(c4, 'ctr_halo',     now()),                       -- other crew
		(c5, 'ctr_pass_bow', now()),                       -- earned, never sold
		(c5, 'ctr_scarf',    now()),                       -- hidden category
		(c5, 'ctr_members',  now() - interval '2 hours');  -- members piece, listed
	
	PERFORM set_config('smoke.uid', c1::text, true);
	SELECT count(*) INTO n FROM public.sounder_counter_buys();
	IF n <> 2 THEN RAISE EXCEPTION 'chk counter: caller should see 2 crewmate buys, saw %', n; END IF;
	IF EXISTS (SELECT 1 FROM public.sounder_counter_buys() WHERE user_id = c1) THEN
		RAISE EXCEPTION 'chk counter: the caller must not stand at their own counter'; END IF;
	IF EXISTS (SELECT 1 FROM public.sounder_counter_buys() WHERE hat_id IN ('ctr_pass_bow', 'ctr_scarf', 'ctr_beanie')) THEN
		RAISE EXCEPTION 'chk counter: pass / hidden / stale buys leaked'; END IF;
	SELECT hat_id, user_id INTO first_hat, first_user FROM public.sounder_counter_buys() LIMIT 1;
	IF first_hat <> 'ctr_top_hat' OR first_user <> c2 THEN
		RAISE EXCEPTION 'chk counter: newest first, got % by %', first_hat, first_user; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.sounder_counter_buys()
	               WHERE user_id = c2 AND username = 'jen' AND pig_id = 'copper' AND hat_id = 'ctr_top_hat') THEN
		RAISE EXCEPTION 'chk counter: row should carry who / pig / item'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.sounder_counter_buys() WHERE user_id = c5 AND hat_id = 'ctr_members') THEN
		RAISE EXCEPTION 'chk counter: a members-only piece is still shown at the counter'; END IF;

	-- Jen sees the caller's halo and Marco's piece, never her own top hat.
	PERFORM set_config('smoke.uid', c2::text, true);
	SELECT count(*) INTO n FROM public.sounder_counter_buys();
	IF n <> 2 THEN RAISE EXCEPTION 'chk counter: jen should see 2, saw %', n; END IF;
	IF EXISTS (SELECT 1 FROM public.sounder_counter_buys() WHERE user_id = c2) THEN
		RAISE EXCEPTION 'chk counter: jen must not see her own buy'; END IF;

	-- Another crew: Priya sees nobody from crew A.
	PERFORM set_config('smoke.uid', c4::text, true);
	SELECT count(*) INTO n FROM public.sounder_counter_buys();
	IF n <> 0 THEN RAISE EXCEPTION 'chk counter: other crew leaked, saw %', n; END IF;

	-- No crew: an empty counter, not an error.
	PERFORM set_config('smoke.uid', c6::text, true);
	SELECT count(*) INTO n FROM public.sounder_counter_buys();
	IF n <> 0 THEN RAISE EXCEPTION 'chk counter: a loner should see an empty counter, saw %', n; END IF;

	RAISE NOTICE 'chk counter: sounder_counter_buys OK';
END
$counter$;

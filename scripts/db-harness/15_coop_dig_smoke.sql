-- Functional smoke for the co-op dig rebuild (20260714000000):
-- open_rooting / submit_rooting / feeding_state / hunger_meter, the golden
-- echo + retro-gild, the barnyard drain, crew lifetime + milestone grant, and
-- the no_crew gate. Creates rosie/denny/jen (crew c001) reused by 30_achievements.
\set ON_ERROR_STOP on

-- auth.uid() reads a session GUC so the smoke can act "as" a given pig.
-- Unset (the default in 20/30) → NULL, i.e. the anon path.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Fixtures: crew c001 (rosie leader + denny) for the dig; crew c002
-- (milo/pearl/quinn) isolated for the milestone purse test so it can't
-- pollute the a00x counters that 30_achievements asserts on.
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000a001', 'rosie'),
	('00000000-0000-0000-0000-00000000a002', 'denny'),
	('00000000-0000-0000-0000-00000000a003', 'jen'),
	('00000000-0000-0000-0000-00000000a099', 'stray'),
	('00000000-0000-0000-0000-00000000b001', 'milo'),
	('00000000-0000-0000-0000-00000000b002', 'pearl'),
	('00000000-0000-0000-0000-00000000b003', 'quinn');
INSERT INTO auth.users (id) SELECT id FROM public.profiles;   -- war_rootings FK
INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000c001', 'Rooters',  '00000000-0000-0000-0000-00000000a001'),
	('00000000-0000-0000-0000-00000000c002', 'Diggers',  '00000000-0000-0000-0000-00000000b001');
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001', 'leader'),
	('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a002', 'member'),
	('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b001', 'leader'),
	('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b002', 'member'),
	('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b003', 'member');

DO $smoke$
DECLARE
	a001 uuid := '00000000-0000-0000-0000-00000000a001';
	a002 uuid := '00000000-0000-0000-0000-00000000a002';
	a099 uuid := '00000000-0000-0000-0000-00000000a099';
	b003 uuid := '00000000-0000-0000-0000-00000000b003';
	c002 uuid := '00000000-0000-0000-0000-00000000c002';
	seed int; res jsonb; fs jsonb; hm jsonb;
	drain1 bigint; drain2 bigint; gt int;
BEGIN
	-- Pin the clock (20260721 patch phase) to 1h into the CURRENT real 8h
	-- block: guaranteed OPEN phase, same window/cycle as real now() (so
	-- feeding_state, which reads the real clock, still agrees).
	PERFORM set_config('ttp.fake_now',
		(to_timestamp(floor(extract(epoch FROM now()) / 28800) * 28800)
		 + interval '1 hour')::text, true);

	-- ── rosie: first digger of the window ──────────────────────────────────
	PERFORM set_config('smoke.uid', a001::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'rosie open should carry ok:true: %', res; END IF;
	IF (res->>'already')::boolean THEN RAISE EXCEPTION 'rosie open: already true? %', res; END IF;
	IF (res->>'coop')::boolean THEN RAISE EXCEPTION 'rosie open: coop should be false: %', res; END IF;
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = a001 AND wr.submitted_at IS NULL;
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'rosie submit should carry ok:true: %', res; END IF;
	drain1 := (res->>'drain_total')::bigint;
	IF (res->>'truffles')::int <> 1 THEN RAISE EXCEPTION 'rosie first-dig truffles want 1 got %', res; END IF;
	IF drain1 <= 0 THEN RAISE EXCEPTION 'drain not incremented: %', drain1; END IF;
	SELECT golden_truffles INTO gt FROM public.profiles WHERE id = a001;
	IF gt <> 1 THEN RAISE EXCEPTION 'rosie golden want 1 got %', gt; END IF;

	-- ── denny: crewmate digs same window → echo both ways ──────────────────
	PERFORM set_config('smoke.uid', a002::text, true);
	res := public.open_rooting();
	IF NOT (res->>'coop')::boolean THEN RAISE EXCEPTION 'denny open should be coop: %', res; END IF;
	IF jsonb_array_length(res->'crew_dug') <> 1 THEN RAISE EXCEPTION 'denny crew_dug want 1: %', res->'crew_dug'; END IF;
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = a002 AND wr.submitted_at IS NULL;
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	drain2 := (res->>'drain_total')::bigint;
	IF (res->>'truffles')::int <> 2 THEN RAISE EXCEPTION 'denny coop truffles want 2 got %', res; END IF;
	IF NOT (res->'echo_names' ? 'rosie') THEN RAISE EXCEPTION 'denny echo_names missing rosie: %', res->'echo_names'; END IF;
	IF drain2 <= drain1 THEN RAISE EXCEPTION 'drain not incremented twice: % then %', drain1, drain2; END IF;
	-- rosie retro-gilded from 1 → 2
	SELECT golden_truffles INTO gt FROM public.profiles WHERE id = a001;
	IF gt <> 2 THEN RAISE EXCEPTION 'rosie retro-gild want 2 got %', gt; END IF;

	-- ── feeding_state shows the crewmate; hunger_meter returns a stage ─────
	PERFORM set_config('smoke.uid', a001::text, true);
	fs := public.feeding_state();
	IF NOT (fs->>'dug')::boolean THEN RAISE EXCEPTION 'rosie feeding dug false: %', fs; END IF;
	IF jsonb_array_length(fs->'crew_dug') <> 1 THEN RAISE EXCEPTION 'rosie crew_dug want 1: %', fs; END IF;
	hm := public.hunger_meter();
	IF (hm->>'stage') IS NULL OR NOT (hm->>'available')::boolean THEN RAISE EXCEPTION 'hunger_meter bad: %', hm; END IF;

	-- ── crew lifetime + milestone grant (isolated crew c002) ──────────────
	UPDATE public.crews SET lifetime_finds = 148 WHERE id = c002;
	PERFORM set_config('smoke.uid', b003::text, true);
	PERFORM public.open_rooting();
	SELECT wr.seed INTO seed FROM public.war_rootings wr
		WHERE wr.user_id = b003 AND wr.submitted_at IS NULL;
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	IF res->'milestone' = 'null'::jsonb OR res->'milestone' IS NULL THEN
		RAISE EXCEPTION 'quinn dig should cross the 150 milestone: %', res; END IF;
	IF (res->'milestone'->>'threshold')::int <> 150 THEN RAISE EXCEPTION 'milestone threshold want 150: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crew_milestones WHERE crew_id = c002 AND threshold = 150) THEN
		RAISE EXCEPTION 'crew_milestones claim row missing'; END IF;
	IF (SELECT count(*) FROM public.user_titles WHERE title_id = 'mud_champion'
	    AND user_id IN ('00000000-0000-0000-0000-00000000b001',
	                    '00000000-0000-0000-0000-00000000b002', b003)) <> 3 THEN
		RAISE EXCEPTION 'milestone title not granted to all c002 members'; END IF;

	-- ── no_crew gate: a crewless pig can't open a dig ─────────────────────
	-- (20260716: refusals are {ok:false, reason} envelopes, not RAISEs — the
	-- client's rpcAction treats exceptions as generic network failures.)
	PERFORM set_config('smoke.uid', a099::text, true);
	res := public.open_rooting();
	IF (res->>'ok')::boolean OR (res->>'reason') <> 'no_crew' THEN
		RAISE EXCEPTION 'crewless open should refuse with no_crew: %', res;
	END IF;

	RAISE NOTICE 'coop dig smoke: all assertions passed';
END
$smoke$;

SELECT 'coop dig drain total' AS chk, total FROM public.hunger_drain WHERE id = true;
SELECT 'coop dig hunger stage' AS chk, (public.hunger_meter()->>'stage') AS stage;
SELECT 'c002 lifetime + milestone' AS chk, c.lifetime_finds,
	(SELECT count(*) FROM public.crew_milestones m WHERE m.crew_id = c.id) AS milestones
	FROM public.crews c WHERE c.id = '00000000-0000-0000-0000-00000000c002';

-- Functional smoke for leader recruiting discovery (20260741000000):
-- the default candidate board ranks by truffles actually claimed in submitted
-- digs, not by profiles.tickles_earned or Golden Truffle currency events.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

INSERT INTO public.profiles (id, username, tickles_earned) VALUES
	('00000000-0000-0000-0000-00000000ef51', 'rank-leader', 100),
	('00000000-0000-0000-0000-00000000ef52', 'rank-tickle-rich', 5000),
	('00000000-0000-0000-0000-00000000ef53', 'rank-truffle-rich', 1);
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000ef5%';

INSERT INTO public.crews (id, name, leader_id, is_bot) VALUES
	('00000000-0000-0000-0000-00000000df50', 'Golden Rooters',
	 '00000000-0000-0000-0000-00000000ef51', false);
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000df50',
	 '00000000-0000-0000-0000-00000000ef51', 'leader');

-- Currency noise points the opposite direction and must not affect dug rank.
INSERT INTO public.war_truffles (user_id, amount, reason) VALUES
	('00000000-0000-0000-0000-00000000ef52', 1, 'dig'),
	('00000000-0000-0000-0000-00000000ef52', 1, 'dig_echo'),
	('00000000-0000-0000-0000-00000000ef52', 1, 'blessed_dig'),
	('00000000-0000-0000-0000-00000000ef53', 1, 'dig');

-- One actual truffle for the tickle-rich pig; three for the truffle-rich pig.
INSERT INTO public.war_rootings
	(user_id, crew_id, window_index, seed, dig_day, submitted_at, finds)
VALUES
	('00000000-0000-0000-0000-00000000ef52',
	 '00000000-0000-0000-0000-00000000df50', 7001, 11, current_date, now(),
	 ARRAY['truffle_l', 'shimmer']::text[]),
	('00000000-0000-0000-0000-00000000ef53',
	 '00000000-0000-0000-0000-00000000df50', 7001, 12, current_date, now(),
	 ARRAY['truffle_l', 'truffle_d']::text[]),
	('00000000-0000-0000-0000-00000000ef53',
	 '00000000-0000-0000-0000-00000000df50', 7002, 13, current_date, now(),
	 ARRAY['truffle_d', 'junk']::text[]);

DO $smoke_recruit_board$
DECLARE
	names text[];
	totals bigint[];
BEGIN
	PERFORM set_config(
		'smoke.uid',
		'00000000-0000-0000-0000-00000000ef51',
		true
	);

	SELECT array_agg(c.username), array_agg(c.truffles_dug)
	INTO names, totals
	FROM public.sounder_invite_candidates('rank-', 10) c;

	IF names <> ARRAY['rank-truffle-rich', 'rank-tickle-rich']::text[] THEN
		RAISE EXCEPTION 'candidate board must rank by all-time truffles, got %', names;
	END IF;
	IF totals <> ARRAY[3, 1]::bigint[] THEN
		RAISE EXCEPTION 'candidate board must return lifetime truffle totals, got %', totals;
	END IF;

	RAISE NOTICE 'chk sounder recruiting: all-time truffle ranking OK';
END $smoke_recruit_board$;

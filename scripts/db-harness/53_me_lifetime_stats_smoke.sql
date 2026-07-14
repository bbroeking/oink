-- Functional smoke for me_lifetime_stats() (20260738800000): the seven aggregate
-- counts behind the Me tab's lifetime dashboard.
--
-- Self-contained: the plain-Postgres stub carries partial blessings/curses and
-- none of barn_visits / truffles / truffle_digs / tickle_trades, so this prep
-- builds the minimal shapes the RPC reads. The RPC itself is applied by the
-- harness chain (run.sh), so it already exists when this smoke calls it.
--
-- Asserts:
--   1. Unauthenticated → { ok:false, reason:'unauthenticated' }.
--   2. A fresh user (no social rows) → every count 0, ok true, all 7 keys present.
--   3. After seeding a few rows per table (and NOISE rows for OTHER users +
--      wrong-direction rows), each count reflects only the caller's own tally,
--      pinned to the correct direction (made vs hosted, sent vs received,
--      fulfilled vs pending).
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Minimal tables the RPC aggregates. blessings/curses exist in the stub with
-- sender_id already; barn_visits/truffles/truffle_digs/tickle_trades don't.
CREATE TABLE IF NOT EXISTS public.barn_visits (
	id bigserial PRIMARY KEY, visitor_id uuid, target_id uuid, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.truffles (
	id bigserial PRIMARY KEY, host_id uuid, buried_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.truffle_digs (
	truffle_id bigint, digger_id uuid, dug_at timestamptz DEFAULT now(),
	PRIMARY KEY (truffle_id, digger_id)
);
CREATE TABLE IF NOT EXISTS public.tickle_trades (
	id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
	requester_id uuid, target_id uuid, status text DEFAULT 'pending'
);

DO $smoke_lifetime$
DECLARE
	me    uuid := '00000000-0000-0000-0000-000000053001';
	other uuid := '00000000-0000-0000-0000-000000053002';
	res   jsonb;
BEGIN
	-- 1. Unauthenticated → refusal envelope, no crash.
	PERFORM set_config('smoke.uid', '', true);
	res := public.me_lifetime_stats();
	IF (res->>'ok')::boolean OR res->>'reason' <> 'unauthenticated' THEN
		RAISE EXCEPTION 'lifetime_stats: no auth must be unauthenticated, got %', res; END IF;

	PERFORM set_config('smoke.uid', me::text, true);

	-- 2. Fresh user → all seven counts zero, ok true, every key present.
	res := public.me_lifetime_stats();
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'lifetime_stats: fresh must be ok, got %', res; END IF;
	IF (res->>'barn_visits_made')::int   <> 0
		OR (res->>'barn_visits_hosted')::int <> 0
		OR (res->>'truffles_buried')::int    <> 0
		OR (res->>'friend_mound_digs')::int  <> 0
		OR (res->>'blessings_sent')::int     <> 0
		OR (res->>'curses_sent')::int        <> 0
		OR (res->>'trades_fulfilled')::int   <> 0 THEN
		RAISE EXCEPTION 'lifetime_stats: fresh user must be all zero, got %', res; END IF;
	-- Every key present even at zero (?& asserts membership).
	IF NOT (res ?& ARRAY['barn_visits_made','barn_visits_hosted','truffles_buried',
	                     'friend_mound_digs','blessings_sent','curses_sent','trades_fulfilled']) THEN
		RAISE EXCEPTION 'lifetime_stats: missing a key, got %', res; END IF;

	-- 3. Seed the caller's rows + noise (other user's rows, wrong-direction rows).
	--    Expected caller counts: made 2, hosted 1, buried 3, digs 2,
	--    blessings 2, curses 1, trades_fulfilled 1.
	-- barn_visits: me made 2, hosted 1 (other visited me). Noise: other→other.
	INSERT INTO public.barn_visits (visitor_id, target_id) VALUES
		(me, other), (me, other),      -- made 2
		(other, me),                    -- hosted 1
		(other, other);                 -- noise
	-- truffles: me buried 3, other buried 1 (noise).
	INSERT INTO public.truffles (host_id) VALUES (me), (me), (me), (other);
	-- truffle_digs: me dug 2, other dug 1 (noise).
	INSERT INTO public.truffle_digs (truffle_id, digger_id) VALUES
		(1, me), (2, me), (3, other);
	-- blessings: me sent 2. Noise: other→me (received, not sent).
	INSERT INTO public.blessings (sender_id, receiver_id) VALUES
		(me, other), (me, other), (other, me);
	-- curses: me sent 1. Noise: other→me.
	INSERT INTO public.curses (sender_id, receiver_id) VALUES (me, other), (other, me);
	-- tickle_trades: me fulfilled 1. Noise: me pending (not counted),
	-- other fulfilled (wrong requester).
	INSERT INTO public.tickle_trades (requester_id, target_id, status) VALUES
		(me, other, 'fulfilled'), (me, other, 'pending'), (other, me, 'fulfilled');

	res := public.me_lifetime_stats();
	IF (res->>'barn_visits_made')::int   <> 2 THEN
		RAISE EXCEPTION 'lifetime_stats: barn_visits_made expected 2, got %', res; END IF;
	IF (res->>'barn_visits_hosted')::int <> 1 THEN
		RAISE EXCEPTION 'lifetime_stats: barn_visits_hosted expected 1, got %', res; END IF;
	IF (res->>'truffles_buried')::int    <> 3 THEN
		RAISE EXCEPTION 'lifetime_stats: truffles_buried expected 3, got %', res; END IF;
	IF (res->>'friend_mound_digs')::int  <> 2 THEN
		RAISE EXCEPTION 'lifetime_stats: friend_mound_digs expected 2, got %', res; END IF;
	IF (res->>'blessings_sent')::int     <> 2 THEN
		RAISE EXCEPTION 'lifetime_stats: blessings_sent expected 2, got %', res; END IF;
	IF (res->>'curses_sent')::int        <> 1 THEN
		RAISE EXCEPTION 'lifetime_stats: curses_sent expected 1, got %', res; END IF;
	IF (res->>'trades_fulfilled')::int   <> 1 THEN
		RAISE EXCEPTION 'lifetime_stats: trades_fulfilled expected 1, got %', res; END IF;

	RAISE NOTICE 'chk me_lifetime_stats: unauth + fresh-zeros + 7 seeded counts (caller-pinned, direction-correct) OK';
END $smoke_lifetime$;

-- Cleanup so later smokes' bare `INSERT INTO auth.users SELECT id FROM profiles`
-- don't collide on the seeded ids (mirrors 50_lifetime_tickles_smoke's teardown).
-- These smokes seed nothing into profiles/auth.users, but drop the social rows
-- to keep the schema clean for any downstream aggregate assertions.
DELETE FROM public.tickle_trades WHERE requester_id IN
	('00000000-0000-0000-0000-000000053001','00000000-0000-0000-0000-000000053002')
	OR target_id IN ('00000000-0000-0000-0000-000000053001','00000000-0000-0000-0000-000000053002');

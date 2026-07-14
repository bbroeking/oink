-- Smoke: 20260739000000_barn_pair_locks — barn_pair_locks(p_targets) computes
-- the SAME pairwise lock barn_visit_status computes, for many targets at once.
--
-- Self-contained (barn_visits isn't in 00_stub): this smoke stands up an
-- auth.uid() GUC shim + a minimal barn_visits table, seeds four pairs for one
-- caller, and asserts each pair's locked / taps_left against the 7-taps-per-
-- pair-per-24h rule:
--   fully   — 7 taps in-window     → locked, taps_left 0
--   partial — 3 taps in-window     → locked, taps_left 4  (cap 7)
--   untouched — no rows            → absent from pairs (unlocked by absence)
--   stale   — taps 25h ago         → NOT locked, absent-shaped (window aged out)
-- plus an unauthenticated caller is refused.
--
-- The migration is applied by run.sh's CHAIN (the suite is piped into psql, so
-- relative \i paths don't resolve on the container).
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

-- Minimal barn_visits (matches the real columns barn_pair_locks reads:
-- visitor_id, target_id, visit_started_at, visit_cap, created_at).
CREATE TABLE IF NOT EXISTS public.barn_visits (
	id               bigserial PRIMARY KEY,
	visitor_id       uuid NOT NULL,
	target_id        uuid NOT NULL,
	tickles          int  NOT NULL DEFAULT 1,
	visit_started_at timestamptz,
	visit_cap        int,
	created_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000006a0'), -- caller
	('00000000-0000-0000-0000-0000000006f1'), -- fully-tapped pair
	('00000000-0000-0000-0000-0000000006f2'), -- partially-tapped pair
	('00000000-0000-0000-0000-0000000006f3'), -- untouched pair
	('00000000-0000-0000-0000-0000000006f4')  -- stale pair (aged out)
ON CONFLICT (id) DO NOTHING;

SET smoke.uid = '00000000-0000-0000-0000-0000000006a0';

-- fully-tapped: cap 7, 7 taps this session, started 1h ago (in-window)
INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, visit_cap, created_at)
SELECT '00000000-0000-0000-0000-0000000006a0',
       '00000000-0000-0000-0000-0000000006f1',
       now() - interval '1 hour', 7,
       now() - interval '1 hour' + (g * interval '1 second')
FROM generate_series(1, 7) g;

-- partially-tapped: cap 7, 3 taps this session, started 2h ago (in-window)
INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, visit_cap, created_at)
SELECT '00000000-0000-0000-0000-0000000006a0',
       '00000000-0000-0000-0000-0000000006f2',
       now() - interval '2 hours', 7,
       now() - interval '2 hours' + (g * interval '1 second')
FROM generate_series(1, 3) g;

-- untouched: no rows for 006f3.

-- stale: cap 7, 5 taps, session started 25h ago (aged out of the 24h window)
INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, visit_cap, created_at)
SELECT '00000000-0000-0000-0000-0000000006a0',
       '00000000-0000-0000-0000-0000000006f4',
       now() - interval '25 hours', 7,
       now() - interval '25 hours' + (g * interval '1 second')
FROM generate_series(1, 5) g;

-- 1. locked/taps_left per pair match expectations
DO $$
DECLARE
	r      jsonb;
	pairs  jsonb;
	p_full jsonb;
	p_part jsonb;
	p_untd jsonb;
	p_stal jsonb;
BEGIN
	r := public.barn_pair_locks(ARRAY[
		'00000000-0000-0000-0000-0000000006f1',
		'00000000-0000-0000-0000-0000000006f2',
		'00000000-0000-0000-0000-0000000006f3',
		'00000000-0000-0000-0000-0000000006f4'
	]::uuid[]);
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'not ok: %', r;
	END IF;
	pairs := r->'pairs';

	-- pluck each pair by target_id
	SELECT e INTO p_full FROM jsonb_array_elements(pairs) e
		WHERE e->>'target_id' = '00000000-0000-0000-0000-0000000006f1';
	SELECT e INTO p_part FROM jsonb_array_elements(pairs) e
		WHERE e->>'target_id' = '00000000-0000-0000-0000-0000000006f2';
	SELECT e INTO p_untd FROM jsonb_array_elements(pairs) e
		WHERE e->>'target_id' = '00000000-0000-0000-0000-0000000006f3';
	SELECT e INTO p_stal FROM jsonb_array_elements(pairs) e
		WHERE e->>'target_id' = '00000000-0000-0000-0000-0000000006f4';

	-- fully-tapped → locked, taps_left 0
	IF p_full IS NULL OR NOT (p_full->>'locked')::boolean OR (p_full->>'taps_left')::int <> 0 THEN
		RAISE EXCEPTION 'fully-tapped wrong: %', p_full;
	END IF;
	IF (p_full->>'next_at') IS NULL THEN
		RAISE EXCEPTION 'fully-tapped missing next_at: %', p_full;
	END IF;

	-- partially-tapped → locked, taps_left 4 (cap 7 − 3)
	IF p_part IS NULL OR NOT (p_part->>'locked')::boolean OR (p_part->>'taps_left')::int <> 4 THEN
		RAISE EXCEPTION 'partially-tapped wrong: %', p_part;
	END IF;

	-- untouched → absent from pairs (unlocked by absence)
	IF p_untd IS NOT NULL THEN
		RAISE EXCEPTION 'untouched should be absent: %', p_untd;
	END IF;

	-- stale → present but NOT locked (25h > 24h window), taps_left null, next_at null
	IF p_stal IS NULL OR (p_stal->>'locked')::boolean THEN
		RAISE EXCEPTION 'stale should be unlocked: %', p_stal;
	END IF;
	IF (p_stal->>'taps_left') IS NOT NULL OR (p_stal->>'next_at') IS NOT NULL THEN
		RAISE EXCEPTION 'stale should carry null taps_left/next_at: %', p_stal;
	END IF;
END $$;

-- 2. self + null targets are ignored (no self entry, still ok)
DO $$
DECLARE r jsonb;
BEGIN
	r := public.barn_pair_locks(ARRAY[
		'00000000-0000-0000-0000-0000000006a0', -- self
		NULL,
		'00000000-0000-0000-0000-0000000006f1'  -- real locked pair
	]::uuid[]);
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'self/null probe not ok: %', r;
	END IF;
	IF EXISTS (
		SELECT 1 FROM jsonb_array_elements(r->'pairs') e
		WHERE e->>'target_id' = '00000000-0000-0000-0000-0000000006a0'
	) THEN
		RAISE EXCEPTION 'self leaked into pairs: %', r;
	END IF;
	IF jsonb_array_length(r->'pairs') <> 1 THEN
		RAISE EXCEPTION 'expected exactly the one real pair: %', r;
	END IF;
END $$;

-- 3. unauthenticated → refused
SET smoke.uid = '';
DO $$
DECLARE r jsonb;
BEGIN
	r := public.barn_pair_locks(ARRAY['00000000-0000-0000-0000-0000000006f1']::uuid[]);
	IF (r->>'ok')::boolean OR r->>'error' <> 'unauthenticated' THEN
		RAISE EXCEPTION 'unauth not refused: %', r;
	END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk barn pair locks: fully/partial/untouched/stale + self-drop + unauth OK'; END $$;
ROLLBACK;

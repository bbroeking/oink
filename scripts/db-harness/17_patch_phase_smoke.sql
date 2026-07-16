-- Patch-phase smoke (20260721 + the 20260744 window shift): the 4h-open/
-- 4h-guarded gate on open_rooting, the phase-countdown payload keys, submit
-- surviving the guard phase within its window, and the stale-session refusal
-- after the window ends. All driven through the ttp.fake_now clock at a FIXED
-- block ('2026-07-08 02:00 UTC' — windows anchor at 02/10/18 UTC since the
-- 20260744 shift: floor((epoch - 7200)/28800)).
\set ON_ERROR_STOP on

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000de40', 'pp1'),
	('00000000-0000-0000-0000-00000000de41', 'pp2');
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-00000000de40'),
	('00000000-0000-0000-0000-00000000de41');
INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000dd20', 'CrewPhase', '00000000-0000-0000-0000-00000000de40');
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000dd20', '00000000-0000-0000-0000-00000000de40', 'leader'),
	('00000000-0000-0000-0000-00000000dd20', '00000000-0000-0000-0000-00000000de41', 'member');

DO $smoke4$
DECLARE
	pp1 uuid := '00000000-0000-0000-0000-00000000de40';
	pp2 uuid := '00000000-0000-0000-0000-00000000de41';
	b0  timestamptz := '2026-07-08 02:00+00';   -- block start (02:00 UTC anchor)
	res jsonb; seed int;
BEGIN
	-- ── 1. Pure phase math at the edges (the 02/10/18 UTC anchor) ────────────
	IF public.patch_phase_open('2026-07-08 01:59:59+00') IS NOT FALSE
	   OR public.patch_phase_open('2026-07-08 02:00:00+00') IS NOT TRUE
	   OR public.patch_phase_open('2026-07-08 05:59:59+00') IS NOT TRUE
	   OR public.patch_phase_open('2026-07-08 06:00:00+00') IS NOT FALSE
	   OR public.patch_phase_open('2026-07-08 09:59:59+00') IS NOT FALSE
	   OR public.patch_phase_open('2026-07-08 10:00:00+00') IS NOT TRUE THEN
		RAISE EXCEPTION 'patch_phase_open edge math wrong';
	END IF;

	-- ── 2. Closed phase: open refuses with the countdown payload ─────────────
	PERFORM set_config('smoke.uid', pp1::text, true);
	PERFORM set_config('ttp.fake_now', (b0 + interval '5 hours')::text, true);
	res := public.open_rooting();
	IF (res->>'ok')::boolean OR (res->>'reason') <> 'patch_closed' THEN
		RAISE EXCEPTION 'open during guard phase should refuse patch_closed: %', res; END IF;
	IF (res->>'opens_at')::timestamptz <> b0 + interval '8 hours'
	   OR (res->>'phase_ends_at')::timestamptz <> b0 + interval '8 hours' THEN
		RAISE EXCEPTION 'patch_closed countdowns wrong (want next block start): %', res; END IF;

	-- ── 3. 3h59m into the block: open succeeds, payload carries the phase ────
	PERFORM set_config('ttp.fake_now', (b0 + interval '3 hours 59 minutes')::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean OR (res->>'already')::boolean THEN
		RAISE EXCEPTION 'open at 3h59m should succeed: %', res; END IF;
	IF (res->>'phase_ends_at')::timestamptz <> b0 + interval '4 hours'
	   OR (res->>'opens_at')::timestamptz <> b0 + interval '8 hours' THEN
		RAISE EXCEPTION 'open-phase countdowns wrong: %', res; END IF;
	seed := (res->>'seed')::int;

	-- ── 4. Same session submits at 4h30m — guard phase, window still live ────
	PERFORM set_config('ttp.fake_now', (b0 + interval '4 hours 30 minutes')::text, true);
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'in-window submit during guard phase should succeed: %', res; END IF;

	-- ── 5. Stale session: opened in-phase, window ends → refuses as before ───
	PERFORM set_config('smoke.uid', pp2::text, true);
	PERFORM set_config('ttp.fake_now', (b0 + interval '3 hours 59 minutes')::text, true);
	res := public.open_rooting();
	IF NOT (res->>'ok')::boolean THEN RAISE EXCEPTION 'pp2 open failed: %', res; END IF;
	seed := (res->>'seed')::int;
	PERFORM set_config('ttp.fake_now', (b0 + interval '9 hours')::text, true);   -- next window
	res := public.submit_rooting(public.rooting_finds(seed), 4);
	IF (res->>'ok')::boolean OR (res->>'reason') <> 'no_open_rooting' THEN
		RAISE EXCEPTION 'submit after window end should refuse no_open_rooting: %', res; END IF;

	RAISE NOTICE 'patch phase smoke: all assertions passed';
END
$smoke4$;

SELECT 'patch phase open now' AS chk, public.patch_phase_open(now());

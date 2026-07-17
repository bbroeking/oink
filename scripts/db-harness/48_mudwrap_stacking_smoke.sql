-- Functional smoke for mud-wrap stacking (20260750000000_mudwrap_stacking): a
-- second friend's regen wrap EXTENDS the receiver's existing wrap additively
-- (banked to a 12h ceiling) into ONE active row, instead of stacking parallel
-- rows. The single-active-row invariant is exactly what keeps regen from
-- compounding — regen_secs_for() gates its 0.5× on a boolean EXISTS over active
-- wrap rows, so 1 row and N rows read identically; dedup to one row makes the
-- banked expiry the ONLY thing a coordinated Sounder can grow, capped at 12h.
--
-- Self-contained. Applied by run.sh (pass the migration as an extra arg; the
-- smoke is auto-globbed by the [1234]*_smoke.sql glob). send_blessing (carried
-- by the chain's 20260714 coop-dig rebuild, redefined by the migration) is
-- PL/pgSQL, so its helper/column refs are only resolved at RUNTIME — the plain-
-- Postgres stub omits several. We prep exactly what the mud_wrap path touches:
--   * blessings.sent_on (generated) + the one-per-pair-per-day unique index
--     (the casts_today tally + already_blessed_today guard read them),
--   * profiles.alignment_score (the alignment bonus factor `bf`),
--   * daily_blessing_kind() → 'mud_wrap' (decouple from the day-of-year roll),
--   * is_crewmates()/shift_alignment() stubs (send_blessing calls both; the
--     crew path is inert here — no crew_members rows → no Chorus/announcement).
-- All senders get alignment_score 0 so bf = 1.0 and every wrap is exactly the
-- 3h base — the banked expiries are then exact multiples of now() (a single
-- transaction, so now() is fixed) and need no tolerance.
--
-- Asserts:
--   1. First wrap → 1 active row, expiry = now()+3h.
--   2. Second friend's wrap → still 1 ACTIVE row (the first is soft-cleared),
--      expiry banked to now()+6h; two total rows (1 active + 1 cleared).
--   3. 12h ceiling → wrapping over an 11h-remaining wrap caps at now()+12h.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Prep the runtime deps the stub omits (all IF-NOT-EXISTS / OR-REPLACE no-ops
-- against prod, which already has the real column/index/functions).
ALTER TABLE public.blessings
	ADD COLUMN IF NOT EXISTS sent_on date
	GENERATED ALWAYS AS ((sent_at AT TIME ZONE 'UTC')::date) STORED;
CREATE UNIQUE INDEX IF NOT EXISTS blessings_one_per_pair_per_day
	ON public.blessings (sender_id, receiver_id, sent_on);
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS alignment_score int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.daily_blessing_kind() RETURNS text
	LANGUAGE sql IMMUTABLE AS $$ SELECT 'mud_wrap'::text $$;
CREATE OR REPLACE FUNCTION public.is_crewmates(a uuid, b uuid) RETURNS boolean
	LANGUAGE sql AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION public.shift_alignment(uid uuid, delta int) RETURNS void
	LANGUAGE sql AS $$ SELECT $$;

DO $smoke_mudwrap$
DECLARE
	rcv1 uuid := '00000000-0000-0000-0000-000000048001'; -- receiver, scenarios 1+2
	sndA uuid := '00000000-0000-0000-0000-000000048002'; -- first wrapper
	sndB uuid := '00000000-0000-0000-0000-000000048003'; -- second wrapper (extends)
	rcv2 uuid := '00000000-0000-0000-0000-000000048004'; -- receiver, cap scenario
	sndC uuid := '00000000-0000-0000-0000-000000048005'; -- cap-scenario wrapper
	sndS uuid := '00000000-0000-0000-0000-000000048006'; -- seeder of the 11h row
	res     jsonb;
	active  int;
	total   int;
	delta_s numeric;
BEGIN
	INSERT INTO auth.users (id) VALUES (rcv1), (sndA), (sndB), (rcv2), (sndC), (sndS)
		ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, alignment_score) VALUES
		(rcv1, 'r1', 0), (sndA, 'a', 0), (sndB, 'b', 0),
		(rcv2, 'r2', 0), (sndC, 'c', 0), (sndS, 's', 0)
		ON CONFLICT (id) DO UPDATE SET alignment_score = 0;

	-- ── 1. First wrap → one active row at now()+3h ─────────────────────────────
	PERFORM set_config('smoke.uid', sndA::text, true);
	res := public.send_blessing(rcv1);
	IF NOT (res->>'ok')::boolean OR res->>'kind' <> 'mud_wrap' THEN
		RAISE EXCEPTION 'mudwrap: first cast must land a mud_wrap, got %', res; END IF;

	SELECT count(*) INTO active FROM public.blessings
		WHERE receiver_id = rcv1 AND kind = 'mud_wrap'
		  AND cleared_at IS NULL AND expires_at > now();
	IF active <> 1 THEN
		RAISE EXCEPTION 'mudwrap: first wrap must leave 1 active row, got %', active; END IF;

	SELECT EXTRACT(EPOCH FROM (max(expires_at) - now())) INTO delta_s
		FROM public.blessings WHERE receiver_id = rcv1 AND kind = 'mud_wrap'
		  AND cleared_at IS NULL;
	IF delta_s <> 10800 THEN  -- 3h, bf=1.0
		RAISE EXCEPTION 'mudwrap: first wrap must expire at now()+3h (10800s), got %s', delta_s; END IF;

	-- ── 2. Second friend's wrap EXTENDS additively into ONE active row ─────────
	PERFORM set_config('smoke.uid', sndB::text, true);
	res := public.send_blessing(rcv1);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'mudwrap: second friend cast must land, got %', res; END IF;

	SELECT count(*) FILTER (WHERE cleared_at IS NULL AND expires_at > now()),
	       count(*)
		INTO active, total
		FROM public.blessings WHERE receiver_id = rcv1 AND kind = 'mud_wrap';
	IF active <> 1 THEN
		RAISE EXCEPTION 'mudwrap: after 2 wraps exactly ONE row stays active, got %', active; END IF;
	IF total <> 2 THEN
		RAISE EXCEPTION 'mudwrap: both casts must persist (1 active + 1 soft-cleared), got % total', total; END IF;

	SELECT EXTRACT(EPOCH FROM (expires_at - now())) INTO delta_s
		FROM public.blessings WHERE receiver_id = rcv1 AND kind = 'mud_wrap'
		  AND cleared_at IS NULL AND expires_at > now();
	IF delta_s <> 21600 THEN  -- banked 3h + 3h = 6h
		RAISE EXCEPTION 'mudwrap: second wrap must bank to now()+6h (21600s), got %s', delta_s; END IF;

	-- ── 3. 12h ceiling — wrap over an 11h-remaining wrap caps at now()+12h ─────
	-- Seed a wrap with 11h left (direct insert, unrelated sender), then wrap.
	INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
		VALUES (sndS, rcv2, 'mud_wrap', now() + interval '11 hours');
	PERFORM set_config('smoke.uid', sndC::text, true);
	res := public.send_blessing(rcv2);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'mudwrap: cap-scenario cast must land, got %', res; END IF;

	SELECT count(*) INTO active FROM public.blessings
		WHERE receiver_id = rcv2 AND kind = 'mud_wrap'
		  AND cleared_at IS NULL AND expires_at > now();
	IF active <> 1 THEN
		RAISE EXCEPTION 'mudwrap: cap scenario must leave 1 active row, got %', active; END IF;

	SELECT EXTRACT(EPOCH FROM (expires_at - now())) INTO delta_s
		FROM public.blessings WHERE receiver_id = rcv2 AND kind = 'mud_wrap'
		  AND cleared_at IS NULL AND expires_at > now();
	IF delta_s <> 43200 THEN  -- capped at 12h, NOT 11h+3h=14h
		RAISE EXCEPTION 'mudwrap: banked duration must cap at now()+12h (43200s), got %s', delta_s; END IF;

	RAISE NOTICE 'chk mudwrap stacking: first=3h, second banks to 6h in ONE active row (prior soft-cleared), ceiling caps at 12h OK';
END $smoke_mudwrap$;

-- Cleanup so later smokes' bare `INSERT INTO auth.users SELECT id FROM profiles`
-- don't collide on the seeded ids (mirrors 42_pair_bonds / 53_me_lifetime_stats).
DELETE FROM public.blessings WHERE receiver_id IN
	('00000000-0000-0000-0000-000000048001','00000000-0000-0000-0000-000000048004');
DELETE FROM public.profiles WHERE id IN
	('00000000-0000-0000-0000-000000048001','00000000-0000-0000-0000-000000048002',
	 '00000000-0000-0000-0000-000000048003','00000000-0000-0000-0000-000000048004',
	 '00000000-0000-0000-0000-000000048005','00000000-0000-0000-0000-000000048006');

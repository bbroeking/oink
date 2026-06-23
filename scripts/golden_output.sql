-- Off-path smoke regression for migration 20260668 (Songs of the Bog / rhythm).
-- GUARDS the build-93 carry-latest footgun: with mud_rhythm_on()=false (and
-- mud_fronts_on()=false), the SEVEN re-declared functions must still resolve a war the
-- way 20260667 did. This is a smoke test (invariants), not a byte diff against a saved
-- baseline — it catches "a carried function silently lost a feature" (no payout, rope
-- stops moving, war_state loses a key) and pins the ONE intentional global change: the
-- 24h win-trade cooldown stamps REAL wars only, never bot/practice.
--
-- RUN (local supabase with the migration applied; both flags false = default):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/golden_output.sql
-- Wrapped in a transaction that ROLLBACKs — non-destructive.

BEGIN;
SET LOCAL search_path TO public;

-- sanity: both flags must be OFF for this off-path test
DO $$ BEGIN
	IF public.mud_rhythm_on() OR public.mud_fronts_on() THEN
		RAISE EXCEPTION 'golden_output expects mud_rhythm_on()=false AND mud_fronts_on()=false (off-path)';
	END IF;
END $$;

-- ── fixture: 2 real crews (war A, real vs real) + 1 crew for the bot war ──────────
DO $$
DECLARE
	uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uC uuid := gen_random_uuid();
	cA uuid; cB uuid; cC uuid; wReal uuid; wBot uuid;
	bot uuid := '00000000-0000-0000-0000-0000000000b0';
	start_at timestamptz := now() - interval '6 days';
	d date;
BEGIN
	INSERT INTO auth.users (id, email) VALUES
		(uA,'goldA@example.com'),(uB,'goldB@example.com'),(uC,'goldC@example.com');
	-- profiles carry the snout counter the payout writes to
	INSERT INTO public.profiles (id, counter) VALUES (uA,0),(uB,0),(uC,0)
		ON CONFLICT (id) DO UPDATE SET counter = 0;

	INSERT INTO public.crews (name, leader_id) VALUES ('GoldA',uA) RETURNING id INTO cA;
	INSERT INTO public.crews (name, leader_id) VALUES ('GoldB',uB) RETURNING id INTO cB;
	INSERT INTO public.crews (name, leader_id) VALUES ('GoldC',uC) RETURNING id INTO cC;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
		(cA,uA,'leader'),(cB,uB,'leader'),(cC,uC,'leader');

	-- WAR A: real vs real, classic (fronts_enabled=false), already ended so it resolves.
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at, fronts_enabled, rhythm_enabled)
		VALUES (cA, cB, 'active', false, start_at, now() - interval '1 minute', false, false)
		RETURNING id INTO wReal;
	-- challenger out-slings the defender every day so the challenger wins the rope.
	FOR d IN SELECT generate_series((start_at AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date - 1, interval '1 day')::date LOOP
		INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, throws_today, war_day)
			VALUES (wReal, cA, uA, 21, 7, d);
		INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, throws_today, war_day)
			VALUES (wReal, cB, uB, 3, 7, d);
	END LOOP;

	-- WAR C: bot war (the human is cC, defender is the house bot), ended so it resolves.
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at, fronts_enabled, rhythm_enabled)
		VALUES (cC, bot, 'active', true, start_at, now() - interval '1 minute', false, false)
		RETURNING id INTO wBot;
	FOR d IN SELECT generate_series((start_at AT TIME ZONE 'UTC')::date, (now() AT TIME ZONE 'UTC')::date - 1, interval '1 day')::date LOOP
		INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, throws_today, war_day)
			VALUES (wBot, cC, uC, 21, 7, d);
	END LOOP;

	CREATE TEMP TABLE _gold (k text, v uuid) ON COMMIT DROP;
	INSERT INTO _gold VALUES ('uA',uA),('uB',uB),('uC',uC),('cA',cA),('cB',cB),('cC',cC),('wReal',wReal),('wBot',wBot);
END $$;

-- ── ASSERT 1: classic real war scores + resolves; challenger wins + is paid ───────
DO $$
DECLARE wReal uuid; cA uuid; uA uuid; res jsonb; rope int; bal bigint; st text;
BEGIN
	SELECT v INTO wReal FROM _gold WHERE k='wReal';
	SELECT v INTO cA FROM _gold WHERE k='cA';
	SELECT v INTO uA FROM _gold WHERE k='uA';

	res := public.resolve_war(wReal);
	SELECT rope_pos, status INTO rope, st FROM public.mud_wars WHERE id = wReal;

	IF st <> 'resolved' THEN RAISE EXCEPTION 'CARRY REGRESSION: ended war did not resolve (status=%)', st; END IF;
	IF rope <= 0 THEN RAISE EXCEPTION 'CARRY REGRESSION: base_notch fold did not move the rope challenger-positive (rope=%)', rope; END IF;
	IF (res->>'winner') IS DISTINCT FROM cA::text THEN RAISE EXCEPTION 'CARRY REGRESSION: challenger should win (winner=%)', res->>'winner'; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = uA;
	IF bal <= 0 THEN RAISE EXCEPTION 'CARRY REGRESSION: winner payout did not credit snouts (counter=%)', bal; END IF;
	RAISE NOTICE 'ASSERT 1 PASS — classic war resolves, rope=%, winner paid % snouts', rope, bal;
END $$;

-- ── ASSERT 2: the win-trade cooldown stamps a REAL war (both crews) ───────────────
DO $$
DECLARE cA uuid; cB uuid; nA timestamptz; nB timestamptz;
BEGIN
	SELECT v INTO cA FROM _gold WHERE k='cA';
	SELECT v INTO cB FROM _gold WHERE k='cB';
	SELECT next_war_at INTO nA FROM public.crews WHERE id = cA;
	SELECT next_war_at INTO nB FROM public.crews WHERE id = cB;
	IF nA IS NULL OR nA <= now() THEN RAISE EXCEPTION 'COOLDOWN MISSING: real-war challenger not stamped (next_war_at=%)', nA; END IF;
	IF nB IS NULL OR nB <= now() THEN RAISE EXCEPTION 'COOLDOWN MISSING: real-war defender not stamped (next_war_at=%)', nB; END IF;
	RAISE NOTICE 'ASSERT 2 PASS — real war stamped the 24h cooldown on both crews';
END $$;

-- ── ASSERT 3: a BOT war resolves + pays HOUSE_BONUS but does NOT stamp the human ──
DO $$
DECLARE wBot uuid; cC uuid; uC uuid; st text; nC timestamptz; bal bigint;
BEGIN
	SELECT v INTO wBot FROM _gold WHERE k='wBot';
	SELECT v INTO cC FROM _gold WHERE k='cC';
	SELECT v INTO uC FROM _gold WHERE k='uC';
	PERFORM public.resolve_war(wBot);
	SELECT status INTO st FROM public.mud_wars WHERE id = wBot;
	IF st <> 'resolved' THEN RAISE EXCEPTION 'CARRY REGRESSION: bot war did not resolve (status=%)', st; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = uC;
	IF bal <= 0 THEN RAISE EXCEPTION 'CARRY REGRESSION: bot-war HOUSE_BONUS not paid (counter=%)', bal; END IF;
	-- THE FIX: the human crew must NOT be stamped after a practice war.
	SELECT next_war_at INTO nC FROM public.crews WHERE id = cC;
	IF nC IS NOT NULL AND nC > now() THEN
		RAISE EXCEPTION 'COOLDOWN BUG: bot/practice war wrongly stamped the human crew (next_war_at=%) — house practice would be blocked', nC;
	END IF;
	RAISE NOTICE 'ASSERT 3 PASS — bot war resolves + pays house bonus, human crew NOT cooldown-stamped';
END $$;

-- ── ASSERT 4: war_state returns the rope + the additive superset keys ─────────────
DO $$
DECLARE wReal uuid; uA uuid; js jsonb;
BEGIN
	SELECT v INTO wReal FROM _gold WHERE k='wReal';
	SELECT v INTO uA FROM _gold WHERE k='uA';
	PERFORM set_config('role','authenticated',true);
	PERFORM set_config('request.jwt.claims', json_build_object('sub', uA)::text, true);
	js := public.war_state(wReal);
	RESET ROLE;
	IF js IS NULL OR js = 'null'::jsonb THEN RAISE EXCEPTION 'CARRY REGRESSION: war_state returned null for a participant'; END IF;
	IF NOT (js ? 'ropePos' AND js ? 'mine' AND js ? 'them') THEN RAISE EXCEPTION 'CARRY REGRESSION: war_state lost a core key'; END IF;
	-- additive superset keys from 20260668 (existing clients ignore them)
	IF NOT (js ? 'rhythmEnabled' AND js ? 'phase') THEN RAISE EXCEPTION 'SUPERSET BROKEN: war_state missing additive rhythm keys'; END IF;
	IF (js->>'rhythmEnabled')::boolean THEN RAISE EXCEPTION 'OFF-PATH BROKEN: rhythmEnabled true with flag off'; END IF;
	RAISE NOTICE 'ASSERT 4 PASS — war_state intact + additive rhythm keys present (rhythmEnabled=false)';
END $$;

DO $$ BEGIN RAISE NOTICE '✓ ALL GOLDEN-OUTPUT (OFF-PATH) SMOKE TESTS PASSED'; END $$;
ROLLBACK;

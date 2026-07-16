-- Smoke: 20260745000000_feedback_den — the Den (player feedback & ideas).
--
-- Shims auth.uid() off a GUC and exercises the RPCs directly (SECURITY DEFINER,
-- so the zero-policy feedback table is only reachable through them). Applied by
-- run.sh's CHAIN (app_settings exists from 20260744100000; profiles is stubbed).
--
-- Covers:
--   • submit_feedback ok (row lands, source 'app', username snapshot)
--   • kind validation (bad_kind), body validation (too_short / too_long)
--   • 3-per-UTC-day rate limit (4th → resting)
--   • username snapshot survives a profile RENAME (history not rewritten)
--   • web door: name default ('a passing pig'), name clamp to 24, honeypot
--     silent-ok (no row), hourly cap of 20 → resting
--   • feedback_dump secret gate: wrong secret refused, right secret returns rows
--   • feedback_mark: secret gate + status transition ('seen'/'folded')
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

-- Actors.
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000fb001'),
	('00000000-0000-0000-0000-0000000fb002')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-0000000fb001', 'whisperer'),
	('00000000-0000-0000-0000-0000000fb002', 'ratelimited')
ON CONFLICT (id) DO NOTHING;

-- The dump secret seeded by the migration (repo-visible pull secret) is pinned
-- literally in the assertions below ('den-0ce9a84f7ef87f9cd2267bcd') — a
-- rotation of the migration literal fails these loudly. (psql \set vars don't
-- interpolate inside DO $$ bodies, so the literal is inlined at each call.)

-- ═══ 1. submit_feedback ok — row lands, source 'app', username snapshot ══════
SET smoke.uid = '00000000-0000-0000-0000-0000000fb001';
DO $$ DECLARE r jsonb; row_ct int; snap text; src text;
BEGIN
	r := public.submit_feedback('idea', 'a bigger mud pit for the whole herd');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'submit ok failed: %', r; END IF;
	SELECT count(*), max(username), max(source) INTO row_ct, snap, src
		FROM public.feedback WHERE user_id = '00000000-0000-0000-0000-0000000fb001';
	IF row_ct <> 1 THEN RAISE EXCEPTION 'expected 1 app row, saw %', row_ct; END IF;
	IF snap <> 'whisperer' THEN RAISE EXCEPTION 'username not snapshotted, saw %', snap; END IF;
	IF src <> 'app' THEN RAISE EXCEPTION 'source not app, saw %', src; END IF;
END $$;

-- ═══ 2. kind / body validation envelopes (never raises) ══════════════════════
DO $$ DECLARE r jsonb;
BEGIN
	r := public.submit_feedback('rant', 'not a real kind');
	IF (r->>'reason') <> 'bad_kind' THEN RAISE EXCEPTION 'bad_kind not caught: %', r; END IF;
	r := public.submit_feedback('idea', 'x');
	IF (r->>'reason') <> 'too_short' THEN RAISE EXCEPTION 'too_short not caught: %', r; END IF;
	r := public.submit_feedback('love', repeat('a', 1001));
	IF (r->>'reason') <> 'too_long' THEN RAISE EXCEPTION 'too_long not caught: %', r; END IF;
END $$;

-- ═══ 3. 3-per-UTC-day rate limit — 4th whisper rests ═════════════════════════
-- fb002 has 0 rows yet. Three land, the fourth is refused with 'resting'.
SET smoke.uid = '00000000-0000-0000-0000-0000000fb002';
DO $$ DECLARE r jsonb; i int;
BEGIN
	FOR i IN 1..3 LOOP
		r := public.submit_feedback('bug', 'whisper number ' || i);
		IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'whisper % refused early: %', i, r; END IF;
	END LOOP;
	r := public.submit_feedback('bug', 'one whisper too many');
	IF (r->>'reason') <> 'resting' THEN RAISE EXCEPTION '4th whisper not rate-limited: %', r; END IF;
END $$;

-- ═══ 4. username snapshot survives a profile RENAME ══════════════════════════
-- fb001 submitted as 'whisperer' (§1). Rename the profile; the stored row must
-- STILL read 'whisperer' — history is a snapshot, not a live FK.
UPDATE public.profiles SET username = 'renamed_pig'
	WHERE id = '00000000-0000-0000-0000-0000000fb001';
DO $$ DECLARE snap text;
BEGIN
	SELECT username INTO snap FROM public.feedback
		WHERE user_id = '00000000-0000-0000-0000-0000000fb001' LIMIT 1;
	IF snap <> 'whisperer' THEN RAISE EXCEPTION 'rename rewrote history, saw %', snap; END IF;
END $$;

-- ═══ 5. web door — name default, name clamp, honeypot, source ════════════════
SET smoke.uid = '';  -- web door is anon-callable; no caller.
DO $$ DECLARE r jsonb; snap text; uid uuid; src text;
BEGIN
	-- 5a. empty name → 'a passing pig', user_id null, source 'web'.
	r := public.submit_feedback_web('love', 'love this game', '');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'web submit failed: %', r; END IF;
	SELECT username, user_id, source INTO snap, uid, src FROM public.feedback
		WHERE source = 'web' AND body = 'love this game';
	IF snap <> 'a passing pig' THEN RAISE EXCEPTION 'web default name wrong: %', snap; END IF;
	IF uid IS NOT NULL THEN RAISE EXCEPTION 'web row got a user_id: %', uid; END IF;
	IF src <> 'web' THEN RAISE EXCEPTION 'web source wrong: %', src; END IF;

	-- 5b. name trimmed + clamped to 24 chars.
	r := public.submit_feedback_web('idea', 'clamp my name please', '   ' || repeat('z', 40) || '   ');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'web clamp submit failed: %', r; END IF;
	SELECT username INTO snap FROM public.feedback WHERE body = 'clamp my name please';
	IF char_length(snap) <> 24 THEN RAISE EXCEPTION 'name not clamped to 24, len %: %', char_length(snap), snap; END IF;

	-- 5c. honeypot filled → silent ok, NO row inserted.
	r := public.submit_feedback_web('bug', 'i am a bot', 'BotName', 'gotcha');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'honeypot should lie ok: %', r; END IF;
	IF EXISTS (SELECT 1 FROM public.feedback WHERE body = 'i am a bot') THEN
		RAISE EXCEPTION 'honeypot inserted a row (should be silent)';
	END IF;
END $$;

-- ═══ 6. web hourly cap — 20 per rolling hour, 21st rests ═════════════════════
-- Bulk-insert web rows to reach the cap, then the next call refuses.
DO $$ DECLARE r jsonb; cur int; need int; i int;
BEGIN
	SELECT count(*) INTO cur FROM public.feedback
		WHERE source = 'web' AND created_at >= now() - interval '1 hour';
	need := 20 - cur;
	FOR i IN 1..need LOOP
		r := public.submit_feedback_web('bug', 'cap filler ' || i, 'anon');
		IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'cap filler % refused early: %', i, r; END IF;
	END LOOP;
	r := public.submit_feedback_web('bug', 'the one over the cap', 'anon');
	IF (r->>'reason') <> 'resting' THEN RAISE EXCEPTION 'web cap not enforced: %', r; END IF;
END $$;

-- ═══ 7. feedback_dump secret gate ════════════════════════════════════════════
DO $$ DECLARE r jsonb;
BEGIN
	-- Wrong secret → { ok:false }, no rows leaked.
	r := public.feedback_dump('den-wrong');
	IF (r->>'ok')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'wrong secret not refused: %', r; END IF;
	IF r ? 'rows' THEN RAISE EXCEPTION 'wrong secret leaked rows: %', r; END IF;
END $$;
-- Right secret → { ok:true, rows:[...] } ordered created_at asc.
DO $$ DECLARE r jsonb; n int; first_body text;
BEGIN
	r := public.feedback_dump('den-0ce9a84f7ef87f9cd2267bcd');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'right secret refused: %', r; END IF;
	n := jsonb_array_length(r->'rows');
	IF n < 1 THEN RAISE EXCEPTION 'dump returned no rows: %', r; END IF;
	-- Oldest first: the first row is fb001's §1 idea.
	first_body := (r->'rows'->0->>'body');
	IF first_body <> 'a bigger mud pit for the whole herd' THEN
		RAISE EXCEPTION 'dump not ordered created_at asc, first: %', first_body; END IF;
END $$;

-- ═══ 8. feedback_mark — secret gate + status transition ══════════════════════
DO $$ DECLARE r jsonb; rid uuid; st text; marked int;
BEGIN
	-- Wrong secret → refused, status untouched.
	SELECT id INTO rid FROM public.feedback
		WHERE user_id = '00000000-0000-0000-0000-0000000fb001' LIMIT 1;
	r := public.feedback_mark('den-wrong', ARRAY[rid], 'folded');
	IF (r->>'ok')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'mark wrong secret not refused: %', r; END IF;
	SELECT status INTO st FROM public.feedback WHERE id = rid;
	IF st <> 'new' THEN RAISE EXCEPTION 'wrong-secret mark mutated status: %', st; END IF;

	-- Bad status → refused.
	r := public.feedback_mark('den-0ce9a84f7ef87f9cd2267bcd', ARRAY[rid], 'archived');
	IF (r->>'reason') <> 'bad_status' THEN RAISE EXCEPTION 'bad_status not caught: %', r; END IF;

	-- Right secret → status flips to 'folded'.
	r := public.feedback_mark('den-0ce9a84f7ef87f9cd2267bcd', ARRAY[rid], 'folded');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'mark folded failed: %', r; END IF;
	marked := (r->>'marked')::int;
	IF marked <> 1 THEN RAISE EXCEPTION 'mark counted %, expected 1', marked; END IF;
	SELECT status INTO st FROM public.feedback WHERE id = rid;
	IF st <> 'folded' THEN RAISE EXCEPTION 'status not folded, saw %', st; END IF;
END $$;

SET smoke.uid = '';
DO $$ BEGIN RAISE NOTICE 'chk feedback den: submit/validation/rate-limit + rename-snapshot + web(default/clamp/honeypot/cap) + dump-gate + mark OK'; END $$;
ROLLBACK;

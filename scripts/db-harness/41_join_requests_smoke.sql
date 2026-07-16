-- Smoke: 20260742000000_join_requests — the knock-on-the-door join model.
--
-- Shims auth.uid() off a GUC and exercises the RPCs directly (SECURITY DEFINER,
-- so RLS on crew_join_requests is bypassed by the definer — the zero-policy
-- table is only reachable through these). Applied by run.sh's CHAIN.
--
-- Covers:
--   • request → accept (member added, requester's OTHER pending knocks declined)
--   • request → decline (quiet no)
--   • request → cancel (asker takes it back)
--   • already_asked dedupe
--   • too_many_asks at 3 pending
--   • crew_full at members + pending invites = 4 (no knocking on a full door)
--   • accept race: door fills after the knock → crew_full, request left pending
--   • accept when requester already crewed → cancelled + already_in_crew refusal
--   • join_crew transitional path → { ok:true, requested:true }, NO member insert
--   • crew_state showing join_requests_in / join_requests_out
BEGIN;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
$$ SELECT nullif(current_setting('smoke.uid', true), '')::uuid $$;

-- Actors. jr0* = a crew's members; jrA/B/C/D/E = crewless askers.
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-00000000d001'),
	('00000000-0000-0000-0000-00000000d002'),
	('00000000-0000-0000-0000-0000000d00aa'),
	('00000000-0000-0000-0000-0000000d00bb'),
	('00000000-0000-0000-0000-0000000d00cc'),
	('00000000-0000-0000-0000-0000000d00dd'),
	('00000000-0000-0000-0000-0000000d00ee')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000d001', 'leader1'),
	('00000000-0000-0000-0000-00000000d002', 'member2'),
	('00000000-0000-0000-0000-0000000d00aa', 'askerA'),
	('00000000-0000-0000-0000-0000000d00bb', 'askerB'),
	('00000000-0000-0000-0000-0000000d00cc', 'askerC'),
	('00000000-0000-0000-0000-0000000d00dd', 'askerD'),
	('00000000-0000-0000-0000-0000000d00ee', 'askerE')
ON CONFLICT (id) DO NOTHING;

-- Two open crews (one member each, room to grow), plus target crews for the
-- too-many-asks fan-out.
INSERT INTO public.crews (id, name, leader_id) VALUES
	('00000000-0000-0000-0000-00000000ce01', 'The Mudlarks', '00000000-0000-0000-0000-00000000d001'),
	('00000000-0000-0000-0000-00000000ce02', 'The Rooters',  '00000000-0000-0000-0000-00000000d002'),
	('00000000-0000-0000-0000-00000000ce03', 'The Snouts',   '00000000-0000-0000-0000-00000000d001'),
	('00000000-0000-0000-0000-00000000ce04', 'The Wallow',   '00000000-0000-0000-0000-00000000d002');
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000ce01', '00000000-0000-0000-0000-00000000d001', 'leader'),
	('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-00000000d002', 'leader'),
	('00000000-0000-0000-0000-00000000ce03', '00000000-0000-0000-0000-00000000d001', 'leader'),
	('00000000-0000-0000-0000-00000000ce04', '00000000-0000-0000-0000-00000000d002', 'leader');

-- ═══ 1. request → accept: member added, other knocks declined ═══════════════
-- askerA knocks on crew01 AND crew02, then crew01's leader accepts the crew01
-- knock. A joins crew01; A's crew02 knock is declined by the cleanup.
SET smoke.uid = '00000000-0000-0000-0000-0000000d00aa';
DO $$ DECLARE r jsonb;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce01');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'A knock crew01 failed: %', r; END IF;
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'A knock crew02 failed: %', r; END IF;
END $$;

-- Every crew01 member got a 'crew_knock' announcement.
DO $$ DECLARE n int;
BEGIN
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'crew_knock' AND (data->>'crew_id') = '00000000-0000-0000-0000-00000000ce01';
	IF n <> 1 THEN RAISE EXCEPTION 'expected 1 knock announce to crew01 (1 member), saw %', n; END IF;
END $$;

-- Leader of crew01 accepts A's crew01 knock.
SET smoke.uid = '00000000-0000-0000-0000-00000000d001';
DO $$ DECLARE r jsonb; rid uuid;
BEGIN
	SELECT id INTO rid FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce01'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00aa' AND status = 'pending';
	r := public.accept_join_request(rid);
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'accept failed: %', r; END IF;
	IF (r->>'crew_id') <> '00000000-0000-0000-0000-00000000ce01' THEN
		RAISE EXCEPTION 'accept returned wrong crew_id: %', r; END IF;
END $$;

DO $$ DECLARE nm int; nreq int; ninv int;
BEGIN
	SELECT count(*) INTO nm FROM public.crew_members
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce01'
		  AND user_id = '00000000-0000-0000-0000-0000000d00aa';
	IF nm <> 1 THEN RAISE EXCEPTION 'A not added to crew01, saw %', nm; END IF;
	-- A's crew02 knock got auto-declined by the accept cleanup.
	SELECT count(*) INTO nreq FROM public.crew_join_requests
		WHERE requester_id = '00000000-0000-0000-0000-0000000d00aa' AND status = 'pending';
	IF nreq <> 0 THEN RAISE EXCEPTION 'A still has % pending knocks after accept', nreq; END IF;
	-- The new member got the 'banner opened' join announce.
	SELECT count(*) INTO ninv FROM public.system_announcements
		WHERE user_id = '00000000-0000-0000-0000-0000000d00aa' AND kind = 'crew_join'
		  AND body LIKE 'the banner opened%';
	IF ninv <> 1 THEN RAISE EXCEPTION 'A missing banner-opened announce, saw %', ninv; END IF;
END $$;

-- ═══ 2. request → decline: a quiet no, no requester announce ═════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000d00bb';
DO $$ DECLARE r jsonb;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'B knock failed: %', r; END IF;
END $$;
SET smoke.uid = '00000000-0000-0000-0000-00000000d002';
DO $$ DECLARE r jsonb; rid uuid;
BEGIN
	SELECT id INTO rid FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce02'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00bb' AND status = 'pending';
	r := public.decline_join_request(rid);
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'decline failed: %', r; END IF;
END $$;
DO $$ DECLARE st text; ann int;
BEGIN
	SELECT status INTO st FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce02'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00bb';
	IF st <> 'declined' THEN RAISE EXCEPTION 'B request status % (want declined)', st; END IF;
	-- No announce to B on a decline (dignity — a quiet no).
	SELECT count(*) INTO ann FROM public.system_announcements
		WHERE user_id = '00000000-0000-0000-0000-0000000d00bb';
	IF ann <> 0 THEN RAISE EXCEPTION 'B got % announcements on a quiet decline', ann; END IF;
END $$;

-- ═══ 3. request → cancel: the asker takes it back ════════════════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000d00cc';
DO $$ DECLARE r jsonb; rid uuid;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'C knock failed: %', r; END IF;
	SELECT id INTO rid FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce02'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00cc' AND status = 'pending';
	r := public.cancel_join_request(rid);
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'cancel failed: %', r; END IF;
END $$;
-- A member cannot cancel someone else's knock (not_yours).
SET smoke.uid = '00000000-0000-0000-0000-00000000d002';
DO $$ DECLARE r jsonb; rid uuid;
BEGIN
	INSERT INTO public.crew_join_requests (crew_id, requester_id)
		VALUES ('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-0000000d00dd')
		RETURNING id INTO rid;
	r := public.cancel_join_request(rid);
	IF (r->>'reason') <> 'not_yours' THEN RAISE EXCEPTION 'member cancel of other knock: %', r; END IF;
	DELETE FROM public.crew_join_requests WHERE id = rid;
END $$;

-- ═══ 4. already_asked dedupe ═════════════════════════════════════════════════
SET smoke.uid = '00000000-0000-0000-0000-0000000d00dd';
DO $$ DECLARE r jsonb;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'D first knock failed: %', r; END IF;
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'reason') <> 'already_asked' THEN RAISE EXCEPTION 'D dupe knock: %', r; END IF;
END $$;

-- ═══ 5. too_many_asks at 3 pending ═══════════════════════════════════════════
-- E knocks on crew01/03/04 (3 pending) then a 4th door is refused.
SET smoke.uid = '00000000-0000-0000-0000-0000000d00ee';
DO $$ DECLARE r jsonb;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce01'); IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'E c1: %', r; END IF;
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce03'); IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'E c3: %', r; END IF;
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce04'); IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'E c4: %', r; END IF;
	-- 4th knock (crew02) refused — 3 already pending.
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce02');
	IF (r->>'reason') <> 'too_many_asks' THEN RAISE EXCEPTION 'E 4th knock not capped: %', r; END IF;
END $$;

-- ═══ 6. crew_full at members + pending invites = 4 (no knocking) ═════════════
-- Fill crew04: it has 1 member; add 3 pending invites → seat_count 4.
INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id, status) VALUES
	('00000000-0000-0000-0000-00000000ce04', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-00000000d001', 'pending'),
	('00000000-0000-0000-0000-00000000ce04', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000d00aa', 'pending'),
	('00000000-0000-0000-0000-00000000ce04', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000d00bb', 'pending');
SET smoke.uid = '00000000-0000-0000-0000-0000000d00cc';
DO $$ DECLARE r jsonb;
BEGIN
	r := public.request_to_join('00000000-0000-0000-0000-00000000ce04');
	IF (r->>'reason') <> 'crew_full' THEN RAISE EXCEPTION 'knock on full door not refused: %', r; END IF;
END $$;
-- Clean those reserving invites back out so later seat math is unaffected.
DELETE FROM public.crew_invites WHERE crew_id = '00000000-0000-0000-0000-00000000ce04';

-- ═══ 7. accept race: door fills after the knock → crew_full, left pending ════
-- D has a pending knock on crew02 (from §4). Fill crew02 to 4 with pending
-- invites, then the leader's accept must bounce crew_full and LEAVE it pending.
INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id, status) VALUES
	('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000d00aa', 'pending'),
	('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000d00bb', 'pending'),
	('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-00000000d002', '00000000-0000-0000-0000-0000000d00cc', 'pending');
SET smoke.uid = '00000000-0000-0000-0000-00000000d002';
DO $$ DECLARE r jsonb; rid uuid; st text;
BEGIN
	SELECT id INTO rid FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce02'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00dd' AND status = 'pending';
	r := public.accept_join_request(rid);
	IF (r->>'reason') <> 'crew_full' THEN RAISE EXCEPTION 'accept into full crew not crew_full: %', r; END IF;
	SELECT status INTO st FROM public.crew_join_requests WHERE id = rid;
	IF st <> 'pending' THEN RAISE EXCEPTION 'crew_full accept should leave pending, got %', st; END IF;
END $$;
DELETE FROM public.crew_invites WHERE crew_id = '00000000-0000-0000-0000-00000000ce02';

-- ═══ 8. accept when requester already crewed → cancelled + refusal ══════════
-- A is already in crew01 (§1). Manufacture a stray pending knock from A onto
-- crew02, then crew02's leader accepts → already_in_crew + the knock cancelled.
INSERT INTO public.crew_join_requests (crew_id, requester_id)
	VALUES ('00000000-0000-0000-0000-00000000ce02', '00000000-0000-0000-0000-0000000d00aa');
SET smoke.uid = '00000000-0000-0000-0000-00000000d002';
DO $$ DECLARE r jsonb; rid uuid; st text;
BEGIN
	SELECT id INTO rid FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce02'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00aa' AND status = 'pending';
	r := public.accept_join_request(rid);
	IF (r->>'reason') <> 'already_in_crew' THEN RAISE EXCEPTION 'accept of crewed asker: %', r; END IF;
	SELECT status INTO st FROM public.crew_join_requests WHERE id = rid;
	IF st <> 'cancelled' THEN RAISE EXCEPTION 'crewed-asker knock should be cancelled, got %', st; END IF;
END $$;

-- ═══ 9. join_crew transitional path → { ok:true, requested:true }, no insert ══
-- askerB (crewless) calls the repurposed join_crew on crew01. It must NOT add a
-- member — it just files a knock and returns { ok:true, requested:true }.
SET smoke.uid = '00000000-0000-0000-0000-0000000d00bb';
DO $$ DECLARE r jsonb; nm int; nreq int;
BEGIN
	r := public.join_crew('00000000-0000-0000-0000-00000000ce01');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'join_crew not ok: %', r; END IF;
	IF (r->>'requested')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'join_crew missing requested flag: %', r; END IF;
	IF (r ? 'crew_id') THEN RAISE EXCEPTION 'join_crew leaked a crew_id (old clients would think they joined): %', r; END IF;
	SELECT count(*) INTO nm FROM public.crew_members
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce01'
		  AND user_id = '00000000-0000-0000-0000-0000000d00bb';
	IF nm <> 0 THEN RAISE EXCEPTION 'join_crew ADDED a member (should only knock), saw %', nm; END IF;
	SELECT count(*) INTO nreq FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce01'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00bb' AND status = 'pending';
	IF nreq <> 1 THEN RAISE EXCEPTION 'join_crew didn''t file a knock, saw %', nreq; END IF;
	-- DEDUPE: a second join_crew is a no-op, still ok/requested, no 2nd row.
	r := public.join_crew('00000000-0000-0000-0000-00000000ce01');
	IF (r->>'requested')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'join_crew dedupe not ok: %', r; END IF;
	SELECT count(*) INTO nreq FROM public.crew_join_requests
		WHERE crew_id = '00000000-0000-0000-0000-00000000ce01'
		  AND requester_id = '00000000-0000-0000-0000-0000000d00bb' AND status = 'pending';
	IF nreq <> 1 THEN RAISE EXCEPTION 'join_crew dedupe made a 2nd knock, saw %', nreq; END IF;
END $$;

-- ═══ 10. crew_state — join_requests_in (crewed) / join_requests_out (crewless) ═
-- Leader of crew01 sees B's incoming knock (join_requests_in), empty _out.
SET smoke.uid = '00000000-0000-0000-0000-00000000d001';
DO $$ DECLARE s jsonb; nin int; nout int;
BEGIN
	s := public.crew_state();
	nin  := jsonb_array_length(s->'join_requests_in');
	nout := jsonb_array_length(s->'join_requests_out');
	IF nin < 1 THEN RAISE EXCEPTION 'leader join_requests_in empty, expected B''s knock: %', s->'join_requests_in'; END IF;
	IF nout <> 0 THEN RAISE EXCEPTION 'crewed leader has join_requests_out: %', s->'join_requests_out'; END IF;
	-- Each in-row carries id/requester_id/username.
	IF NOT ((s->'join_requests_in'->0) ? 'username') THEN
		RAISE EXCEPTION 'join_requests_in row missing username: %', s->'join_requests_in'->0; END IF;
END $$;

-- B (crewless) sees their outgoing knock (join_requests_out), empty _in.
SET smoke.uid = '00000000-0000-0000-0000-0000000d00bb';
DO $$ DECLARE s jsonb; nin int; nout int;
BEGIN
	s := public.crew_state();
	nin  := jsonb_array_length(s->'join_requests_in');
	nout := jsonb_array_length(s->'join_requests_out');
	IF nout < 1 THEN RAISE EXCEPTION 'crewless B join_requests_out empty: %', s->'join_requests_out'; END IF;
	IF nin <> 0 THEN RAISE EXCEPTION 'crewless B has join_requests_in: %', s->'join_requests_in'; END IF;
	IF NOT ((s->'join_requests_out'->0) ? 'crew_name') THEN
		RAISE EXCEPTION 'join_requests_out row missing crew_name: %', s->'join_requests_out'->0; END IF;
END $$;

SET smoke.uid = '';
DO $$ BEGIN RAISE NOTICE 'chk join requests: request/accept/decline/cancel + dedupe + too_many + crew_full + accept-race + crewed-asker + join_crew transitional + crew_state in/out OK'; END $$;
ROLLBACK;

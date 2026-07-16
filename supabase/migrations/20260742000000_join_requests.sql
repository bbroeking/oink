-- ════════════════════════════════════════════════════════════════════════
-- Knock-on-the-door joins — an open Sounder stops being walk-in.
--
-- Until now a crewless pig could join_crew() straight into any open Sounder's
-- seat, no consent from the herd. This makes the front door a KNOCK: a crewless
-- pig ASKS to join (crew_join_requests, status 'pending'), and any current
-- member accepts (or declines). Crew→pig invites (crew_invites) keep their
-- existing instant-accept flow — that's consensual both ways already; this only
-- gates the pig→crew direction.
--
-- CARRY-LATEST-DEF (the two footguns that bit before):
--   join_crew  ← 20260738000000_sounder_invite_seats.sql (combined-seat cap;
--                the NEWEST def). Repurposed below into request semantics.
--   crew_state ← 20260714000000_coop_dig_rebuild.sql (the NEWEST def — carried
--                VERBATIM, only the two new join_requests arrays appended).
--
-- ANNOUNCEMENTS: every RPC INLINES its system_announcements INSERT, wrapped in a
-- fail-soft BEGIN … EXCEPTION WHEN OTHERS THEN NULL; END; block (mirroring how
-- join_crew does it today) — NEVER send_system_announcement() (admin-gated →
-- silent rollback for non-admins).
--
-- SEAT MATH: the door is "full" at members + PENDING crew_invites ≥ 4 (an
-- outgoing invite reserves a seat, per 20260738000000). A pending join REQUEST
-- does NOT reserve a seat — many pigs may knock on the same crew; the seat only
-- gets spent when a member accepts one.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Table — crew_join_requests (RPC-only, RLS with zero policies) ─────────
-- The codes-table idiom: RLS on with NO policies means direct PostgREST access
-- is fully denied; every read/write flows through the SECURITY DEFINER RPCs
-- below (crew_state surfaces the rows a caller is allowed to see).
CREATE TABLE IF NOT EXISTS public.crew_join_requests (
	id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	crew_id      uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	requester_id uuid        NOT NULL,
	status       text        NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
	created_at   timestamptz NOT NULL DEFAULT now()
);

-- One PENDING knock per (crew, requester) — re-knocking while an ask is open is
-- a no-op (the RPC dedupes), and the partial index makes the DB the backstop.
CREATE UNIQUE INDEX IF NOT EXISTS crew_join_requests_one_pending
	ON public.crew_join_requests (crew_id, requester_id)
	WHERE status = 'pending';

ALTER TABLE public.crew_join_requests ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies — RPC-only access.

-- ── 2. request_to_join — a crewless pig knocks on an open banner ─────────────
-- { ok, reason } envelope matching the other crew RPCs. A pending REQUEST does
-- NOT reserve a seat (crew_full counts members + pending INVITES only), so many
-- pigs may knock the same open door.
CREATE OR REPLACE FUNCTION public.request_to_join(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	seat_count   int;
	my_asks      int;
	new_id       uuid;
	asker_name   text;
	m            record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	-- No knocking on a full door: members + pending-out invites ≥ 4. (Requests
	-- themselves do NOT count — a seat isn't spent until a member accepts.)
	seat_count := member_count
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = p_crew AND status = 'pending');
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_join_requests
	           WHERE crew_id = p_crew AND requester_id = caller_id AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_asked');
	END IF;
	-- A pig can only knock on so many doors at once (keeps the herd's inboxes
	-- civil + the asker honest about where they'd actually settle).
	SELECT count(*) INTO my_asks FROM public.crew_join_requests
		WHERE requester_id = caller_id AND status = 'pending';
	IF my_asks >= 3 THEN RETURN jsonb_build_object('ok', false, 'reason', 'too_many_asks'); END IF;

	INSERT INTO public.crew_join_requests (crew_id, requester_id)
		VALUES (p_crew, caller_id) RETURNING id INTO new_id;

	-- Inline-announce the knock to EVERY current member (any member may answer).
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = caller_id;
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = p_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'crew_knock', 'A knock at the banner',
				COALESCE(asker_name, 'A pig') || ' wants to dig with ' || target.name || '.',
				jsonb_build_object('crew_id', p_crew, 'request_id', new_id));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 3. accept_join_request — any member opens the door ───────────────────────
-- The requester CONVERTS a knock into a seat: members + pending invites cap at
-- 4 (matching accept_crew_invite's members-focused door; a request never
-- reserved a seat, so this is the honest point the seat gets spent).
CREATE OR REPLACE FUNCTION public.accept_join_request(p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	req          record;
	crew_name    text;
	crew_leader  uuid;
	seat_count   int;
	asker_name   text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO req FROM public.crew_join_requests WHERE id = p_request FOR UPDATE;
	IF req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF NOT public.is_crew_member(req.crew_id, caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_your_crew');
	END IF;
	IF req.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
	-- The requester wandered into a crew (own or another's) since knocking — the
	-- knock is void. Mark it cancelled so it stops cluttering the banner.
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = req.requester_id) THEN
		UPDATE public.crew_join_requests SET status = 'cancelled' WHERE id = p_request;
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	-- Seat check: members + pending-out invites ≥ 4 → the door filled while the
	-- knock waited. Leave the request PENDING — a seat may free up.
	SELECT (SELECT count(*) FROM public.crew_members WHERE crew_id = req.crew_id)
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = req.crew_id AND status = 'pending')
		INTO seat_count;
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;

	SELECT name, leader_id INTO crew_name, crew_leader FROM public.crews WHERE id = req.crew_id;

	INSERT INTO public.crew_members (crew_id, user_id, role)
		VALUES (req.crew_id, req.requester_id, 'member');
	UPDATE public.crew_join_requests SET status = 'accepted' WHERE id = p_request;
	-- Cleanup, mirroring join_crew: the new member's OTHER pending knocks + their
	-- pending crew_invites all resolve (they've found their herd).
	UPDATE public.crew_join_requests SET status = 'declined'
		WHERE requester_id = req.requester_id AND status = 'pending' AND id <> p_request;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = req.requester_id AND status = 'pending';

	-- Inline-announce: the new member ("the banner opened"), and the leader (the
	-- same 'crew_join' shape join_crew posts when a snout arrives).
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = req.requester_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (req.requester_id, 'crew_join', 'A new snout',
			'the banner opened — you''re in ' || crew_name || '.',
			jsonb_build_object('crew_id', req.crew_id));
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (crew_leader, 'crew_join', 'A new snout',
			COALESCE(asker_name, 'A pig') || ' joined ' || crew_name || '.',
			jsonb_build_object('crew_id', req.crew_id));
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'crew_id', req.crew_id);
END;
$function$;

-- ── 4. decline_join_request — a quiet no ─────────────────────────────────────
-- Any member of the request's crew declines a pending knock. NO announcement to
-- the requester — a quiet no keeps dignity intact (they just stop seeing it).
CREATE OR REPLACE FUNCTION public.decline_join_request(p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	req       record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO req FROM public.crew_join_requests WHERE id = p_request FOR UPDATE;
	IF req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF NOT public.is_crew_member(req.crew_id, caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_your_crew');
	END IF;
	IF req.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
	UPDATE public.crew_join_requests SET status = 'declined' WHERE id = p_request;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 5. cancel_join_request — the asker takes their knock back ─────────────────
-- The requester (and only the requester) withdraws their own pending knock.
CREATE OR REPLACE FUNCTION public.cancel_join_request(p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	req       record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO req FROM public.crew_join_requests WHERE id = p_request FOR UPDATE;
	IF req.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF req.requester_id <> caller_id THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_yours'); END IF;
	IF req.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
	UPDATE public.crew_join_requests SET status = 'cancelled' WHERE id = p_request;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 6. join_crew — repurposed as a knock (OLD-CLIENT TRANSITION) ─────────────
-- Carried from 20260738000000_sounder_invite_seats.sql (the newest def) but the
-- member INSERT is replaced with request semantics: join_crew now behaves
-- exactly like request_to_join (same checks, same insert, same announce).
--
-- OLD-CLIENT NOTE: 1.2/148 clients still call join_crew from their Join buttons.
-- Those clients treat { ok:false } as a generic error note and { ok:true,
-- crew_id } as "joined". Returning { ok:false, reason:'ask_sent' } would flash a
-- red error even though the knock landed; returning a crew_id would make them
-- believe they joined when they only knocked. The least-bad path: return
-- { ok:true, requested:true } (NO crew_id) after creating the request — the old
-- client shows no error, refetches crew_state, finds itself still crewless, and
-- the knock is genuinely delivered. New clients call request_to_join directly.
-- DEDUPE: if the caller already has a pending request there, just return
-- { ok:true, requested:true } without a second insert.
CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	seat_count   int;
	new_id       uuid;
	asker_name   text;
	m            record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	seat_count := member_count
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = p_crew AND status = 'pending');
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	-- DEDUPE: already knocking here → treat as success, no second row.
	IF EXISTS (SELECT 1 FROM public.crew_join_requests
	           WHERE crew_id = p_crew AND requester_id = caller_id AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', true, 'requested', true);
	END IF;

	INSERT INTO public.crew_join_requests (crew_id, requester_id)
		VALUES (p_crew, caller_id) RETURNING id INTO new_id;
	BEGIN
		SELECT username INTO asker_name FROM public.profiles WHERE id = caller_id;
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = p_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'crew_knock', 'A knock at the banner',
				COALESCE(asker_name, 'A pig') || ' wants to dig with ' || target.name || '.',
				jsonb_build_object('crew_id', p_crew, 'request_id', new_id));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	-- TRANSITIONAL: ok:true so old clients show no error; requested (not crew_id)
	-- so they don't believe they joined — they refetch + stay crewless, knock sent.
	RETURN jsonb_build_object('ok', true, 'requested', true);
END;
$function$;

-- ── 7. crew_state — carry NEWEST def (20260714) VERBATIM + two arrays ────────
-- Every existing field byte-identical; two new arrays appended:
--   join_requests_in  — when the caller IS crewed: pending knocks on THEIR crew
--                       ({id, requester_id, username})
--   join_requests_out — when crewless: the caller's own pending knocks
--                       ({id, crew_id, crew_name})
-- Empty arrays otherwise (the branch that doesn't apply is '[]').
CREATE OR REPLACE FUNCTION public.crew_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	crew_row    record;
	members     jsonb;
	invites_in  jsonb;
	invites_out jsonb;
	reqs_in     jsonb;
	reqs_out    jsonb;
	milestones  int[];
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('crew', NULL); END IF;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', ci.id, 'crew_id', ci.crew_id, 'crew_name', c.name,
			'inviter_id', ci.inviter_id, 'inviter_name', p.username
		) ORDER BY ci.created_at DESC), '[]'::jsonb) INTO invites_in
		FROM public.crew_invites ci
		JOIN public.crews c ON c.id = ci.crew_id
		JOIN public.profiles p ON p.id = ci.inviter_id
		WHERE ci.invitee_id = caller_id AND ci.status = 'pending';

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		-- Crewless: surface the caller's OWN outgoing knocks (join_requests_out).
		SELECT COALESCE(jsonb_agg(jsonb_build_object(
				'id', jr.id, 'crew_id', jr.crew_id, 'crew_name', c.name
			) ORDER BY jr.created_at DESC), '[]'::jsonb) INTO reqs_out
			FROM public.crew_join_requests jr
			JOIN public.crews c ON c.id = jr.crew_id
			WHERE jr.requester_id = caller_id AND jr.status = 'pending';
		RETURN jsonb_build_object('crew', NULL, 'members', '[]'::jsonb,
			'invitesIn', invites_in, 'invitesOut', '[]'::jsonb,
			'join_requests_in', '[]'::jsonb, 'join_requests_out', reqs_out);
	END IF;

	SELECT * INTO crew_row FROM public.crews WHERE id = my_crew;
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', cm.user_id, 'username', p.username, 'role', cm.role,
			'active_title', p.active_title_id
		) ORDER BY (cm.role = 'leader') DESC, cm.joined_at), '[]'::jsonb) INTO members
		FROM public.crew_members cm JOIN public.profiles p ON p.id = cm.user_id
		WHERE cm.crew_id = my_crew;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', ci.id, 'invitee_id', ci.invitee_id, 'invitee_name', p.username
		) ORDER BY ci.created_at DESC), '[]'::jsonb) INTO invites_out
		FROM public.crew_invites ci JOIN public.profiles p ON p.id = ci.invitee_id
		WHERE ci.crew_id = my_crew AND ci.status = 'pending';

	-- Incoming knocks on the caller's crew (join_requests_in) — any member answers.
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', jr.id, 'requester_id', jr.requester_id, 'username', p.username
		) ORDER BY jr.created_at DESC), '[]'::jsonb) INTO reqs_in
		FROM public.crew_join_requests jr JOIN public.profiles p ON p.id = jr.requester_id
		WHERE jr.crew_id = my_crew AND jr.status = 'pending';

	-- Herd milestone data for the season tab (thresholds crossed, e.g. [150, 600]).
	SELECT COALESCE(array_agg(threshold ORDER BY threshold), '{}'::int[]) INTO milestones
		FROM public.crew_milestones WHERE crew_id = my_crew;

	RETURN jsonb_build_object(
		'crew', jsonb_build_object('id', crew_row.id, 'name', crew_row.name,
			'leader_id', crew_row.leader_id, 'is_bot', crew_row.is_bot,
			'lifetime_finds', crew_row.lifetime_finds,
			'milestones_claimed', to_jsonb(milestones)),
		'members', members, 'invitesIn', invites_in, 'invitesOut', invites_out,
		'join_requests_in', reqs_in, 'join_requests_out', '[]'::jsonb);
END;
$function$;

-- ── 8. Grants ────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.request_to_join(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_crew(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_state()              TO authenticated;

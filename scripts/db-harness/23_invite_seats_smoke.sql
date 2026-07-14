-- Functional smoke for the combined-seat invite rule (20260738000000):
--   • invite_to_crew / join_crew count members + pending invites (cap 4).
--   • accept_crew_invite stays members-only (converts a reserved seat).
--   • cancel_crew_invite takes back an outgoing pending ask (frees the seat)
--     with the { ok, reason } envelope and its four reason codes.
-- Fresh se4x/dd40 namespace so nothing collides with earlier smokes.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke GUC (idempotent — earlier smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Six pigs: a 3-member crew (leader + two) plus three outsiders to invite/join.
INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-00000000ea41', 'seat-leader'),
	('00000000-0000-0000-0000-00000000ea42', 'seat-two'),
	('00000000-0000-0000-0000-00000000ea43', 'seat-three'),
	('00000000-0000-0000-0000-00000000ea44', 'seat-invitee-a'),
	('00000000-0000-0000-0000-00000000ea45', 'seat-invitee-b'),
	('00000000-0000-0000-0000-00000000ea46', 'seat-joiner');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-00000000ea4%';

INSERT INTO public.crews (id, name, leader_id, is_bot) VALUES
	('00000000-0000-0000-0000-00000000dd40', 'Seatholders',
	 '00000000-0000-0000-0000-00000000ea41', false);
INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
	('00000000-0000-0000-0000-00000000dd40', '00000000-0000-0000-0000-00000000ea41', 'leader'),
	('00000000-0000-0000-0000-00000000dd40', '00000000-0000-0000-0000-00000000ea42', 'member'),
	('00000000-0000-0000-0000-00000000dd40', '00000000-0000-0000-0000-00000000ea43', 'member');

DO $smoke_seats$
DECLARE
	leader   uuid := '00000000-0000-0000-0000-00000000ea41';
	inv_a    uuid := '00000000-0000-0000-0000-00000000ea44';
	inv_b    uuid := '00000000-0000-0000-0000-00000000ea45';
	joiner   uuid := '00000000-0000-0000-0000-00000000ea46';
	crew     uuid := '00000000-0000-0000-0000-00000000dd40';
	res      jsonb;
	invite_a uuid;
BEGIN
	-- ── 1. 3 members + 0 pending → first invite fills the 4th (reserved) seat. ──
	PERFORM set_config('smoke.uid', leader::text, true);
	res := public.invite_to_crew(inv_a);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'invite #1 should succeed (3 members, 0 pending), got %', res; END IF;

	-- ── 2. 3 members + 1 pending = 4 seats → second invite is crew_full. ──
	res := public.invite_to_crew(inv_b);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'crew_full' THEN
		RAISE EXCEPTION 'invite #2 must be crew_full (pending reserves the seat), got %', res; END IF;

	-- ── 3. An open JOIN also respects the reserved seat. ──
	PERFORM set_config('smoke.uid', joiner::text, true);
	res := public.join_crew(crew);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'crew_full' THEN
		RAISE EXCEPTION 'join must be crew_full while a seat is reserved, got %', res; END IF;

	-- ── 4. cancel_crew_invite reason codes. ──
	SELECT id INTO invite_a FROM public.crew_invites
		WHERE crew_id = crew AND invitee_id = inv_a AND status = 'pending';

	-- not_authed (anon).
	PERFORM set_config('smoke.uid', '', true);
	res := public.cancel_crew_invite(invite_a);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_authed' THEN
		RAISE EXCEPTION 'cancel anon must be not_authed, got %', res; END IF;

	-- not_found (bogus id).
	PERFORM set_config('smoke.uid', leader::text, true);
	res := public.cancel_crew_invite('00000000-0000-0000-0000-0000000000ff');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_found' THEN
		RAISE EXCEPTION 'cancel bogus id must be not_found, got %', res; END IF;

	-- not_your_crew (an outsider can't cancel this crew's invite).
	PERFORM set_config('smoke.uid', inv_b::text, true);
	res := public.cancel_crew_invite(invite_a);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_your_crew' THEN
		RAISE EXCEPTION 'cancel by outsider must be not_your_crew, got %', res; END IF;

	-- Happy path: the leader (a member) takes it back → status flips cancelled.
	PERFORM set_config('smoke.uid', leader::text, true);
	res := public.cancel_crew_invite(invite_a);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'cancel by member should succeed, got %', res; END IF;
	IF (SELECT status FROM public.crew_invites WHERE id = invite_a) <> 'cancelled' THEN
		RAISE EXCEPTION 'cancelled invite must carry status=cancelled'; END IF;

	-- not_pending (cancelling an already-cancelled invite).
	res := public.cancel_crew_invite(invite_a);
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_pending' THEN
		RAISE EXCEPTION 'cancel non-pending must be not_pending, got %', res; END IF;

	-- ── 5. Seat freed → a fresh invite succeeds again. ──
	res := public.invite_to_crew(inv_b);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'invite after cancel should succeed (seat freed), got %', res; END IF;

	-- ── 6. Accept at 3 members + 1 pending → ok, and seats are then full. ──
	SELECT id INTO invite_a FROM public.crew_invites
		WHERE crew_id = crew AND invitee_id = inv_b AND status = 'pending';
	PERFORM set_config('smoke.uid', inv_b::text, true);
	res := public.accept_crew_invite(invite_a);
	IF NOT (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'accept converting the reserved seat should succeed, got %', res; END IF;
	IF (SELECT count(*) FROM public.crew_members WHERE crew_id = crew) <> 4 THEN
		RAISE EXCEPTION 'crew should hold exactly 4 members after accept'; END IF;

	-- Roster now full (4 + 0 pending) → next invite crew_full.
	PERFORM set_config('smoke.uid', leader::text, true);
	res := public.invite_to_crew('00000000-0000-0000-0000-00000000ea43');  -- already a member anyway
	IF (res->>'ok')::boolean THEN
		RAISE EXCEPTION 'invite on a full 4-member roster must fail, got %', res; END IF;

	RAISE NOTICE 'chk invite seats: combined cap + cancel envelope + accept-converts-seat OK';
END $smoke_seats$;

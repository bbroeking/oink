-- ════════════════════════════════════════════════════════════════════════
-- Sounder seat rule — pending invites reserve a seat.
--
-- Until now the CAP-4 gate counted MEMBERS only, so a leader could fire off
-- four invites at a three-member crew and, when they all landed, the accept
-- trigger would bounce the overflow — a confusing "you're full" AFTER the ask
-- went out. This makes the seat math honest at the point of INVITE:
--
--   members + pending-out invites ≤ 4
--
-- so a full "reservation" (roster + open asks) is what closes the door. The
-- enforce_crew_cap trigger stays the members-only backstop (accepting converts
-- a reserved seat into a real one — no double-count), so a race can never
-- overfill the roster itself.
--
-- Plus cancel_crew_invite: any crew member can TAKE BACK an outgoing pending
-- invite ("take it back" on the ghost row), freeing the reserved seat.
--
-- CARRY-LATEST-DEF: the newest defs are —
--   invite_to_crew     ← 20260707000000_sounder_league.sql (any-member cap 4)
--   accept_crew_invite ← 20260707000000_sounder_league.sql
--   join_crew          ← 20260719000000_digoff_race.sql  (NOT the league copy;
--                        the digoff-race version dropped the crew_in_war gate)
-- Each carried VERBATIM below; ONLY the marked seat lines change.
--
-- invite_to_crew / join_crew INLINE their system_announcements INSERT — kept
-- inlined, never send_system_announcement() (admin-gated → silent rollback).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Status CHECK gains 'cancelled' ───────────────────────────────────
-- The table def (20260647000000_mud_fights.sql) constrains status to
-- pending/accepted/declined via an inline auto-named constraint. Drop + re-add
-- to admit the new 'cancelled' terminal state (a taken-back outgoing invite).
ALTER TABLE public.crew_invites DROP CONSTRAINT IF EXISTS crew_invites_status_check;
ALTER TABLE public.crew_invites ADD CONSTRAINT crew_invites_status_check
	CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled'));

-- ── 2. invite_to_crew — combined-seat cap ───────────────────────────────
-- Carried VERBATIM from 20260707; ONLY the cap pre-check changes: members +
-- pending-out invites (both reserve a seat) must be under 4.
CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	seat_count   int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name
		FROM public.crew_members mm
		JOIN public.crews c ON c.id = mm.crew_id AND c.is_bot = false
		WHERE mm.user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	IF NOT public.are_friends(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- SEAT DIFF: a pending invite reserves a seat too — members + pending-out ≥ 4
	-- closes the door at the point of the ask (not later, on the accept trigger).
	seat_count := (SELECT count(*) FROM public.crew_members WHERE crew_id = my_crew)
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = my_crew AND status = 'pending');
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invitee_in_crew');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee AND status = 'pending') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_invited');
	END IF;
	INSERT INTO public.crew_invites (crew_id, inviter_id, invitee_id) VALUES (my_crew, caller_id, p_invitee);
	-- Inline announce, savepoint-guarded.
	BEGIN
		SELECT username INTO caller_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_invitee, 'crew_invite', 'Sounder invite',
			COALESCE(caller_name, 'A friend') || ' invited you to join ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 3. accept_crew_invite — members-only cap UNTOUCHED ──────────────────
-- Carried VERBATIM from 20260707. Accepting CONVERTS a reserved seat into a
-- real member, so the check must stay members-only (counting the pending row
-- being accepted would double-count and wrongly reject the last real seat).
CREATE OR REPLACE FUNCTION public.accept_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	inv          record;
	member_count int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO inv FROM public.crew_invites WHERE id = p_invite FOR UPDATE;
	IF inv.id IS NULL OR inv.invitee_id <> caller_id OR inv.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = inv.crew_id;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (inv.crew_id, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending' AND id <> p_invite;
	RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
END;
$function$;

-- ── 4. join_crew — combined-seat cap ────────────────────────────────────
-- Carried VERBATIM from 20260719000000_digoff_race.sql (the NEWEST def — the
-- one that dropped the crew_in_war gate); ONLY the cap changes: an open join
-- must respect the crew's OUTSTANDING invites too, so a joiner can't slip into
-- a seat already promised to a pending invitee.
CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	seat_count   int;
	joiner_name  text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false FOR UPDATE;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	-- SEAT DIFF: pending invites reserve seats for open joins too.
	seat_count := member_count
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = p_crew AND status = 'pending');
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (p_crew, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	BEGIN
		SELECT username INTO joiner_name FROM public.profiles WHERE id = caller_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (target.leader_id, 'crew_join', 'A new snout',
			COALESCE(joiner_name, 'A pig') || ' joined ' || target.name || '.',
			jsonb_build_object('crew_id', p_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'crew_id', p_crew);
END;
$function$;

-- ── 5. cancel_crew_invite — take back an outgoing pending ask ────────────
-- Any member of the inviting crew (not just the original inviter or leader —
-- the invite affordance is any-member, so is the take-back) can cancel a
-- pending outgoing invite, freeing the reserved seat. Same { ok, reason }
-- envelope as the other crew RPCs. Locks the invite row FOR UPDATE so a
-- concurrent accept can't slip past the status check.
CREATE OR REPLACE FUNCTION public.cancel_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	inv       record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_authed'); END IF;
	SELECT * INTO inv FROM public.crew_invites WHERE id = p_invite FOR UPDATE;
	IF inv.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF NOT public.is_crew_member(inv.crew_id, caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_your_crew');
	END IF;
	IF inv.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;
	UPDATE public.crew_invites SET status = 'cancelled' WHERE id = p_invite;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 6. Grants ───────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.cancel_crew_invite(uuid) TO authenticated;

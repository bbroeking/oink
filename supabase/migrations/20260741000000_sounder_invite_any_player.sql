-- ════════════════════════════════════════════════════════════════════════
-- SOUNDER — invite ANY player (leaderboard recruiting + poaching).
--
-- PROPOSAL (pending founder approval — see docs/wiki/outputs/memos/
-- sounder-invite-any-player-2026-07.md). Today a leader can only invite
-- FRIENDS who aren't already in a Sounder (invite_to_crew: are_friends gate +
-- invitee_in_crew refusal). This opens recruiting up:
--
--   1. LEADERS can invite ANY player, not just friends. (Members still invite
--      their own friends only — the stranger reach is a leader power.)
--   2. POACHING — a player already in a Sounder CAN be invited. The invite is a
--      REQUEST: the invitee chooses to ACCEPT & SWITCH (leave their current
--      Sounder, join yours) or DECLINE & STAY. Nothing happens without consent.
--   3. Discovery is a new leader-gated read, sounder_invite_candidates: the top
--      players by tickles (leaderboard) + a username search.
--
-- GUARDRAILS (the ask is unsolicited now, so):
--   * are_blocked — never invite across a block, even as leader.
--   * 24h decline cooldown — a player who declined THIS Sounder can't be
--     re-pestered by it for 24h (needs crew_invites.updated_at, added here).
--   * The combined seat cap (members + pending-out ≤ 4) already throttles a
--     Sounder to ≤ 3 outstanding asks at a time — no extra rate limit needed.
--
-- THE SWITCH — accept_crew_invite, when the invitee is already in a Sounder,
-- reuses leave_crew's exact semantics to depart the old one FIRST (disband it
-- if they were its last member, else auto-promote the oldest remaining member
-- when the leaver led it), THEN joins the inviting Sounder. New-crew capacity is
-- checked BEFORE the departure so a failed switch never orphans the invitee.
--
-- CARRY-LATEST-DEF: invite_to_crew + accept_crew_invite carried VERBATIM from
-- 20260738000000_sounder_invite_seats (the newest defs) with ONLY the marked
-- deltas. Refusals stay { ok, reason } envelopes; announces stay inline +
-- savepoint-guarded (never send_system_announcement).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. crew_invites.updated_at — stamped whenever an invite leaves 'pending' ──
-- The decline cooldown needs to know WHEN a decline happened; the table only had
-- created_at (the SEND time). Add updated_at + a BEFORE UPDATE trigger so any
-- status change (declined / accepted / cancelled) stamps it, with no need to
-- touch decline_crew_invite / accept / cancel.
ALTER TABLE public.crew_invites ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.touch_crew_invite_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
	NEW.updated_at := now();
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS crew_invites_touch_updated ON public.crew_invites;
CREATE TRIGGER crew_invites_touch_updated
	BEFORE UPDATE ON public.crew_invites
	FOR EACH ROW EXECUTE FUNCTION public.touch_crew_invite_updated_at();

-- ── 2. invite_to_crew — leaders reach anyone; poaching allowed; guardrails ────
-- Carried VERBATIM from 20260738000000; DELTAS:
--   (a) resolve whether the caller LEADS this Sounder (crews.leader_id).
--   (b) are_blocked → refuse 'blocked' (applies to everyone, leader included).
--   (c) friends gate relaxes: a NON-leader still needs are_friends; a LEADER may
--       invite anyone.
--   (d) 24h decline cooldown → refuse 'recently_declined'.
--   (e) the invitee_in_crew refusal is REMOVED — an in-Sounder player is a valid
--       poach target (they decide at accept time).
CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	seat_count   int;
	is_leader    boolean;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name, (c.leader_id = caller_id) INTO my_crew, crew_name, is_leader
		FROM public.crew_members mm
		JOIN public.crews c ON c.id = mm.crew_id AND c.is_bot = false
		WHERE mm.user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	-- Never invite across a block (either direction), even as leader.
	IF public.are_blocked(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;
	-- Members still rally FRIENDS only; reaching strangers is a LEADER power.
	IF NOT public.are_friends(caller_id, p_invitee) AND NOT is_leader THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- Anti-pester: a player who DECLINED this Sounder gets a 24h reprieve.
	IF EXISTS (SELECT 1 FROM public.crew_invites
	           WHERE crew_id = my_crew AND invitee_id = p_invitee
	             AND status = 'declined' AND updated_at > now() - interval '24 hours') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'recently_declined');
	END IF;
	-- SEAT DIFF (unchanged): members + pending-out invites reserve seats; ≥ 4 shut.
	seat_count := (SELECT count(*) FROM public.crew_members WHERE crew_id = my_crew)
		+ (SELECT count(*) FROM public.crew_invites WHERE crew_id = my_crew AND status = 'pending');
	IF seat_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	-- NOTE: no invitee_in_crew refusal — poaching an in-Sounder player is allowed;
	-- they choose to switch (accept) or stay (decline).
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
			COALESCE(caller_name, 'Someone') || ' invited you to join ' || crew_name || '.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 3. accept_crew_invite — ACCEPT & SWITCH (poaching) ──────────────────────
-- Carried VERBATIM from 20260738000000; DELTAS:
--   (a) the already_in_crew refusal is REMOVED — accepting from another Sounder
--       is a SWITCH, not an error.
--   (b) new-crew capacity is checked FIRST (before any departure).
--   (c) if the invitee is already in a Sounder, depart it using leave_crew's
--       exact rules (disband if last member; else promote oldest when the leaver
--       led it) BEFORE joining the inviting Sounder.
CREATE OR REPLACE FUNCTION public.accept_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	inv          record;
	member_count int;
	-- ── switch (poach) locals ────────────────────────────────────────────────
	old_crew     uuid;
	old_name     text;
	am_leader    boolean;
	remaining    int;
	next_leader  uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO inv FROM public.crew_invites WHERE id = p_invite FOR UPDATE;
	IF inv.id IS NULL OR inv.invitee_id <> caller_id OR inv.status <> 'pending' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_invite');
	END IF;
	-- Capacity of the INVITING Sounder, checked BEFORE any departure so a failed
	-- switch never leaves the invitee crewless. (Members-only: the reserved seat
	-- from the pending invite converts to a real one — counting it double-rejects.)
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = inv.crew_id;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;

	-- SWITCH: if already in a Sounder, leave it first (leave_crew's exact rules).
	SELECT cm.crew_id, c.name, (c.leader_id = caller_id)
		INTO old_crew, old_name, am_leader
		FROM public.crew_members cm JOIN public.crews c ON c.id = cm.crew_id
		WHERE cm.user_id = caller_id;
	IF old_crew IS NOT NULL THEN
		IF old_crew = inv.crew_id THEN
			-- Already a member of the inviting Sounder — nothing to switch. Resolve
			-- the stale invite cleanly rather than double-insert (PK would throw).
			UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
			RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
		END IF;
		DELETE FROM public.crew_members WHERE crew_id = old_crew AND user_id = caller_id;
		SELECT count(*) INTO remaining FROM public.crew_members WHERE crew_id = old_crew;
		IF remaining = 0 THEN
			DELETE FROM public.crews WHERE id = old_crew;   -- last one out disbands it
		ELSIF am_leader THEN
			SELECT user_id INTO next_leader FROM public.crew_members
				WHERE crew_id = old_crew ORDER BY joined_at ASC LIMIT 1;
			UPDATE public.crews SET leader_id = next_leader WHERE id = old_crew;
			UPDATE public.crew_members SET role = 'leader'
				WHERE crew_id = old_crew AND user_id = next_leader;
		END IF;
		-- Tell the old Sounder's (possibly new) leader a snout slipped away.
		BEGIN
			IF remaining > 0 THEN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				SELECT c.leader_id, 'crew_left', 'A snout answered another banner',
					'A rider left ' || old_name || ' to join another Sounder.',
					jsonb_build_object('crew_id', old_crew)
				FROM public.crews c WHERE c.id = old_crew;
			END IF;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (inv.crew_id, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending' AND id <> p_invite;
	RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
END;
$function$;

-- ── 4. sounder_invite_candidates — the leader's recruiting picker source ─────
-- Leader-gated read: with no search, the TOP players by tickles (the leaderboard,
-- honoring hide_from_leaderboard); with a search, a username prefix match. Each
-- row is annotated so the picker can render state:
--   in_crew        — already rides a Sounder (a poach) + which one (crew_name).
--   already_invited — this Sounder has a pending ask out to them ("waiting…").
-- Excludes the caller, blocked users, and hidden-from-leaderboard players.
-- Returns no rows to a non-leader (the picker is a leader surface).
CREATE OR REPLACE FUNCTION public.sounder_invite_candidates(p_search text, p_limit int)
RETURNS TABLE (
	id             uuid,
	username       text,
	discriminator  text,
	tickles_earned int,
	in_crew        boolean,
	crew_name      text,
	already_invited boolean
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	q         text := btrim(COALESCE(p_search, ''));
	lim       int  := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
	IF caller_id IS NULL THEN RETURN; END IF;
	-- Leader-only: resolve the Sounder the caller LEADS (non-bot).
	SELECT c.id INTO my_crew FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false;
	IF my_crew IS NULL THEN RETURN; END IF;

	RETURN QUERY
		SELECT p.id, p.username, p.discriminator, p.tickles_earned,
			(cm.crew_id IS NOT NULL) AS in_crew,
			oc.name AS crew_name,
			EXISTS (SELECT 1 FROM public.crew_invites ci
				WHERE ci.crew_id = my_crew AND ci.invitee_id = p.id AND ci.status = 'pending')
				AS already_invited
		FROM public.profiles p
		LEFT JOIN public.crew_members cm ON cm.user_id = p.id
		LEFT JOIN public.crews oc ON oc.id = cm.crew_id AND oc.is_bot = false
		WHERE p.id <> caller_id
		  AND p.username IS NOT NULL
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		  AND NOT public.are_blocked(caller_id, p.id)
		  -- Don't surface members of the caller's OWN Sounder (nothing to do).
		  AND (cm.crew_id IS NULL OR cm.crew_id <> my_crew)
		  AND (q = '' OR p.username ILIKE q || '%')
		ORDER BY p.tickles_earned DESC NULLS LAST, p.username, p.id
		LIMIT lim;
END;
$function$;

-- ── 5. Grants ───────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.sounder_invite_candidates(text, int) TO authenticated;

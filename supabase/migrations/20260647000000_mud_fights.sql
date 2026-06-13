-- Sounder Mud Fights — clan-war layer (next-season headline, dark-launched).
--
-- Design: docs/sounder-mud-fight-spec.md. Player-facing crew = "Sounder"
-- (reclaimed from the hidden referral program). Technical tables stay
-- crews/crew_members/crew_invites/mud_wars/mud_slings.
--
-- THE FAIRNESS MECHANISM. War contribution is its OWN verb — "mud slinging" —
-- a FLAT 20 slings/day per member, use-or-lose, NO modifiers. None of the core
-- account's regen/blessing/alignment/VIP buffs can touch a war. A crew's ceiling
-- is members × 20 × days; winning = roster participation, not account strength.
-- Scoring is per-capita active average with a quorum floor of 2.
--
-- Resolution is LAZY (first reader after ends_at), cloning the Trough's
-- resolve_expired_drives() — no cron. Payout uses the 20260628 leaderboard shape
-- (counter + tickles_earned). Winners get a regen buff via a new blessing kind
-- (war_winner_regen, ×0.85/72h) reusing regen_secs_for. Announcements are
-- INLINE INSERTs into system_announcements (never send_system_announcement,
-- which is admin-gated and would roll back a non-admin's whole RPC — see
-- donate_to_drive in 20260627). Every side-effect is savepoint-guarded so a
-- fault can't roll back a payout (the 20260624 hardening pattern).
--
-- Named constants (also mirrored in constants/mudFights.ts):
--   DAILY_ALLOTMENT 20 · WAR_LENGTH_DAYS 5 · QUORUM 2 · CREW_CAP 5
--   BOT_DAILY_PACE 12 · HOUSE_BONUS 25 · BUFF_MULT 0.85 · BUFF_HOURS 72
--   BOT_CREW_ID 00000000-0000-0000-0000-0000000000b0

-- ════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════════════════

-- crews — a "Sounder". is_bot=true is the seeded house "ghost crew" so a real
-- crew can always fight (27-player beta). Bot has a NULL leader + no members.
CREATE TABLE IF NOT EXISTS public.crews (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	name       text        NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 24),
	leader_id  uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
	is_bot     boolean     NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now(),
	CHECK (is_bot OR leader_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.crew_members (
	crew_id   uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	role      text        NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
	joined_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (crew_id, user_id)
);
-- One crew per user (CREW_CAP enforced by the trigger below). The bot crew has
-- no member rows, so a plain unique on user_id is correct.
CREATE UNIQUE INDEX IF NOT EXISTS crew_members_one_per_user
	ON public.crew_members (user_id);

CREATE TABLE IF NOT EXISTS public.crew_invites (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	crew_id    uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	inviter_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	invitee_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	status     text        NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'accepted', 'declined')),
	created_at timestamptz NOT NULL DEFAULT now(),
	CHECK (inviter_id <> invitee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_invites_one_pending
	ON public.crew_invites (crew_id, invitee_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS crew_invites_invitee_pending
	ON public.crew_invites (invitee_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.mud_wars (
	id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	challenger_crew uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	defender_crew   uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	status          text        NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'active', 'resolved', 'declined')),
	started_at      timestamptz,
	ends_at         timestamptz,
	winner_crew     uuid        REFERENCES public.crews(id),   -- NULL after resolve = no winner
	resolved_at     timestamptz,                               -- idempotency guard
	is_bot_war      boolean     NOT NULL DEFAULT false,
	created_at      timestamptz NOT NULL DEFAULT now(),
	CHECK (challenger_crew <> defender_crew)
);
-- A crew can be in at most one live war as challenger…
CREATE UNIQUE INDEX IF NOT EXISTS mud_wars_one_active_challenger
	ON public.mud_wars (challenger_crew) WHERE status IN ('pending', 'active');
-- …and one as defender, EXCEPT the bot (many crews fight the house at once).
CREATE UNIQUE INDEX IF NOT EXISTS mud_wars_one_active_defender
	ON public.mud_wars (defender_crew)
	WHERE status IN ('pending', 'active') AND is_bot_war = false;
CREATE INDEX IF NOT EXISTS mud_wars_resolvable
	ON public.mud_wars (ends_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.mud_slings (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	war_id     uuid        NOT NULL REFERENCES public.mud_wars(id) ON DELETE CASCADE,
	crew_id    uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	slings     int         NOT NULL DEFAULT 0 CHECK (slings >= 0 AND slings <= 20),  -- DAILY_ALLOTMENT clamp
	war_day    date        NOT NULL,   -- UTC day bucket → midnight refresh + use-or-lose for free
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (war_id, user_id, war_day)
);
CREATE INDEX IF NOT EXISTS mud_slings_war_idx ON public.mud_slings (war_id);

-- CREW_CAP=5 enforced at INSERT (RPCs also pre-check for a clean reason string).
CREATE OR REPLACE FUNCTION public.enforce_crew_cap()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
	bot boolean;
	cnt int;
BEGIN
	SELECT is_bot INTO bot FROM public.crews WHERE id = NEW.crew_id;
	IF COALESCE(bot, false) THEN RETURN NEW; END IF;   -- bot crew unbounded (no real members)
	SELECT count(*) INTO cnt FROM public.crew_members WHERE crew_id = NEW.crew_id;
	IF cnt >= 5 THEN RAISE EXCEPTION 'crew_full'; END IF;
	RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS crew_members_cap ON public.crew_members;
CREATE TRIGGER crew_members_cap BEFORE INSERT ON public.crew_members
	FOR EACH ROW EXECUTE FUNCTION public.enforce_crew_cap();

-- ════════════════════════════════════════════════════════════════════════
-- 2. RLS — SELECT only (every mutation flows through SECURITY DEFINER RPCs).
--    Helper fns are SECURITY DEFINER so the policies don't self-recurse on
--    crew_members (the classic Supabase "infinite recursion in policy" trap).
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.is_crew_member(p_crew uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = p_crew AND user_id = p_user);
$function$;

CREATE OR REPLACE FUNCTION public.is_war_participant(p_war uuid, p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.mud_wars w
		JOIN public.crew_members m
		  ON m.crew_id = w.challenger_crew OR m.crew_id = w.defender_crew
		WHERE w.id = p_war AND m.user_id = p_user
	);
$function$;

ALTER TABLE public.crews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crew_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_wars     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mud_slings   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View crews you're in or the bot" ON public.crews;
CREATE POLICY "View crews you're in or the bot" ON public.crews FOR SELECT
	USING (is_bot OR public.is_crew_member(id, auth.uid()));

DROP POLICY IF EXISTS "View members of your crew" ON public.crew_members;
CREATE POLICY "View members of your crew" ON public.crew_members FOR SELECT
	USING (public.is_crew_member(crew_id, auth.uid()));

DROP POLICY IF EXISTS "View your invites" ON public.crew_invites;
CREATE POLICY "View your invites" ON public.crew_invites FOR SELECT
	USING (auth.uid() = invitee_id OR auth.uid() = inviter_id
	       OR public.is_crew_member(crew_id, auth.uid()));

DROP POLICY IF EXISTS "View wars your crew is in" ON public.mud_wars;
CREATE POLICY "View wars your crew is in" ON public.mud_wars FOR SELECT
	USING (public.is_crew_member(challenger_crew, auth.uid())
	       OR public.is_crew_member(defender_crew, auth.uid()));

DROP POLICY IF EXISTS "View slings in your wars" ON public.mud_slings;
CREATE POLICY "View slings in your wars" ON public.mud_slings FOR SELECT
	USING (public.is_war_participant(war_id, auth.uid()));

-- Realtime (live tug-of-war + invite/roster updates). Guarded so a DB without
-- the supabase_realtime publication doesn't fail the migration.
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_members; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.crew_invites; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.mud_slings;   EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. PROFILES + BLESSINGS + TITLES extensions
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS war_wins int NOT NULL DEFAULT 0;

-- New blessing kind for the winner regen buff. (The original kind CHECK is the
-- inline anonymous constraint auto-named blessings_kind_check in 20260522.)
ALTER TABLE public.blessings DROP CONSTRAINT IF EXISTS blessings_kind_check;
ALTER TABLE public.blessings ADD CONSTRAINT blessings_kind_check
	CHECK (kind IN ('warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts', 'war_winner_regen'));

-- regen_secs_for — body VERBATIM from 20260630000000_alignment_regen_linear.sql
-- (the LATEST def — carrying from the older 20260598 would silently revert the
-- linear-alignment factor) + ONE new factor: the war-winner regen buff.
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		(CASE WHEN COALESCE(
			(SELECT is_vip FROM public.profiles WHERE id = uid), false)
		 THEN 1800 ELSE 3600 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'warm_tea'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		-- Alignment: LINEAR ±10% cap, full strength at ±25 (was a ±25 step).
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		-- Happiness: 1.15× (sad) → 0.85× (happy), linear.
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
		-- Mud Fights: war-winner regen buff — ×0.85 (BUFF_MULT) for 72h after a win.
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;

-- War-outcome titles get their own source so they stay independent of the
-- referral 'sounder' ladder. Carry the source list from the LATEST def
-- (20260526000000_finale.sql, which added 'season') + 'mud_war'.
ALTER TABLE public.titles DROP CONSTRAINT IF EXISTS titles_source_check;
ALTER TABLE public.titles ADD CONSTRAINT titles_source_check
	CHECK (source IS NULL OR source IN
		('battle_pass', 'shop', 'lucky', 'sounder', 'achievement', 'season', 'mud_war'));

INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('mud_champion', 'Mud Champion', 'pre', 'Won a Sounder Mud Fight.',            'mud_war', false, 210),
	('mud_veteran',  'Mud Veteran',  'pre', 'Won five Sounder Mud Fights.',        'mud_war', false, 211),
	('mud_legend',   'Mud Legend',   'pre', 'Won twenty-five Sounder Mud Fights.', 'mud_war', false, 212)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 4. SEED the house bot crew (fixed UUID → referenced as a constant in RPCs)
-- ════════════════════════════════════════════════════════════════════════

INSERT INTO public.crews (id, name, is_bot, leader_id)
VALUES ('00000000-0000-0000-0000-0000000000b0', 'The Mudlarks', true, NULL)
ON CONFLICT (id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════
-- 5. CREW LIFECYCLE RPCs
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_crew(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	clean_name text := btrim(COALESCE(p_name, ''));
	new_id     uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF char_length(clean_name) < 1 OR char_length(clean_name) > 24 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_name');
	END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	INSERT INTO public.crews (name, leader_id, is_bot) VALUES (clean_name, caller_id, false)
		RETURNING id INTO new_id;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (new_id, caller_id, 'leader');
	RETURN jsonb_build_object('ok', true, 'crew_id', new_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_to_crew(p_invitee uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	my_crew      uuid;
	crew_name    text;
	caller_name  text;
	member_count int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF caller_id = p_invitee THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	IF NOT public.are_friends(caller_id, p_invitee) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = my_crew;
	IF member_count >= 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
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
	IF member_count >= 5 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (inv.crew_id, caller_id, 'member');
	UPDATE public.crew_invites SET status = 'accepted' WHERE id = p_invite;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending' AND id <> p_invite;
	RETURN jsonb_build_object('ok', true, 'crew_id', inv.crew_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_crew_invite(p_invite uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	UPDATE public.crew_invites SET status = 'declined'
		WHERE id = p_invite AND invitee_id = caller_id AND status = 'pending';
	RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_crew()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	am_leader   boolean;
	next_leader uuid;
	remaining   int;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_crew'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'in_war');
	END IF;
	SELECT (leader_id = caller_id) INTO am_leader FROM public.crews WHERE id = my_crew;
	DELETE FROM public.crew_members WHERE crew_id = my_crew AND user_id = caller_id;
	SELECT count(*) INTO remaining FROM public.crew_members WHERE crew_id = my_crew;
	IF remaining = 0 THEN
		DELETE FROM public.crews WHERE id = my_crew;
	ELSIF am_leader THEN
		SELECT user_id INTO next_leader FROM public.crew_members
			WHERE crew_id = my_crew ORDER BY joined_at ASC LIMIT 1;
		UPDATE public.crews SET leader_id = next_leader WHERE id = my_crew;
		UPDATE public.crew_members SET role = 'leader' WHERE crew_id = my_crew AND user_id = next_leader;
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. WAR LIFECYCLE RPCs
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.challenge_crew(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	my_name   text;
	new_war   uuid;
	m         record;
	tgt       record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT c.id, c.name INTO my_crew, my_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF p_target = my_crew THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	SELECT * INTO tgt FROM public.crews WHERE id = p_target;
	IF tgt.id IS NULL OR tgt.is_bot THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_target'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_war');
	END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = p_target OR defender_crew = p_target)
	             AND status IN ('pending', 'active') AND is_bot_war = false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'target_busy');
	END IF;
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war)
		VALUES (my_crew, p_target, 'pending', false) RETURNING id INTO new_war;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = p_target LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_challenge', 'Mud Fight challenge!',
				my_name || ' challenged your Sounder to a Mud Fight. Accept to start.',
				jsonb_build_object('war_id', new_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'war_id', new_war);
END;
$function$;

CREATE OR REPLACE FUNCTION public.challenge_house()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	new_war   uuid;
	m         record;
	bot_id    uuid := '00000000-0000-0000-0000-0000000000b0';
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT id INTO my_crew FROM public.crews WHERE leader_id = caller_id AND is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_war');
	END IF;
	-- Bot auto-accepts → war is active immediately. WAR_LENGTH_DAYS=5.
	INSERT INTO public.mud_wars (challenger_crew, defender_crew, status, is_bot_war, started_at, ends_at)
		VALUES (my_crew, bot_id, 'active', true, now(), now() + interval '5 days')
		RETURNING id INTO new_war;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_started', 'Mud Fight on!',
				'Your Sounder is fighting The Mudlarks. Sling mud daily to win!',
				jsonb_build_object('war_id', new_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'war_id', new_war);
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_challenge(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	m         record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crews WHERE id = w.defender_crew AND leader_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_defender_leader');
	END IF;
	UPDATE public.mud_wars SET status = 'active', started_at = now(), ends_at = now() + interval '5 days'
		WHERE id = p_war;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_started', 'Mud Fight on!',
				'The Mud Fight has begun. Sling mud daily to win for your Sounder!',
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true, 'war_id', p_war);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_challenge(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	m         record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR w.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crews WHERE id = w.defender_crew AND leader_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_defender_leader');
	END IF;
	UPDATE public.mud_wars SET status = 'declined' WHERE id = p_war;
	BEGIN
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = w.challenger_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id, 'war_declined', 'Challenge declined',
				'That Sounder declined your Mud Fight challenge.',
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- sling_mud — the hot path. The mud_slings upsert is the core write; the only
-- side-effect is the lazy resolve. DAILY_ALLOTMENT=20.
CREATE OR REPLACE FUNCTION public.sling_mud(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	cur       int;
	allotment int := 20;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		RETURN jsonb_build_object('ok', false, 'reason', 'war_over');
	END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'war_not_active'); END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL OR my_crew NOT IN (w.challenger_crew, w.defender_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_war');
	END IF;
	SELECT slings INTO cur FROM public.mud_slings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;
	IF COALESCE(cur, 0) >= allotment THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap', 'slings_today', allotment, 'remaining', 0);
	END IF;
	INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, war_day)
		VALUES (p_war, my_crew, caller_id, 1, today)
	ON CONFLICT (war_id, user_id, war_day) DO UPDATE
		SET slings = LEAST(20, mud_slings.slings + 1)
	RETURNING slings INTO cur;
	RETURN jsonb_build_object('ok', true, 'slings_today', cur, 'remaining', allotment - cur);
END;
$function$;

-- resolve_war — the payout engine. Lazy, idempotent (FOR UPDATE + resolved_at).
-- Constants: QUORUM 2, BOT_DAILY_PACE 12, HOUSE_BONUS 25, BUFF_HOURS 72.
CREATE OR REPLACE FUNCTION public.resolve_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	c_quorum    int := 2;
	c_bot_pace  int := 12;
	c_house     int := 25;
	bot_id      uuid := '00000000-0000-0000-0000-0000000000b0';
	war_days    numeric;
	ch_total    int; ch_active int; ch_score numeric;
	df_total    int; df_active int; df_score numeric;
	ch_qual     boolean; df_qual boolean;
	winner      uuid := NULL;
	win_active  int := 0;
	loser_pot   int := 0;
	share       int := 0;
	m           record;
	reward      int;
	wins_now    int;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status <> 'active' OR w.resolved_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', true, 'noop', true);     -- idempotent: no double-pay
	END IF;
	IF w.ends_at > now() THEN
		RETURN jsonb_build_object('ok', true, 'not_yet', true);
	END IF;

	-- Challenger: per-capita active average.
	SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
		INTO ch_total, ch_active
		FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
		      WHERE war_id = p_war AND crew_id = w.challenger_crew GROUP BY user_id) s;
	ch_score := CASE WHEN ch_active > 0 THEN ch_total::numeric / ch_active ELSE 0 END;
	ch_qual  := ch_active >= c_quorum;

	IF w.is_bot_war THEN
		war_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (w.ends_at - w.started_at)) / 86400.0));
		df_total := 0; df_active := NULL;
		df_score := c_bot_pace * war_days;     -- fixed pace; bot always meets quorum
		df_qual  := true;
	ELSE
		SELECT COALESCE(SUM(s.own), 0), COUNT(*) FILTER (WHERE s.own > 0)
			INTO df_total, df_active
			FROM (SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			      WHERE war_id = p_war AND crew_id = w.defender_crew GROUP BY user_id) s;
		df_score := CASE WHEN df_active > 0 THEN df_total::numeric / df_active ELSE 0 END;
		df_qual  := df_active >= c_quorum;
	END IF;

	-- Winner (quorum gate first, then score; both-below-quorum or tie = no winner).
	IF NOT ch_qual AND NOT df_qual THEN
		winner := NULL;
	ELSIF ch_qual AND NOT df_qual THEN
		winner := w.challenger_crew;
	ELSIF df_qual AND NOT ch_qual THEN
		winner := w.defender_crew;
	ELSIF ch_score > df_score THEN
		winner := w.challenger_crew;
	ELSIF df_score > ch_score THEN
		winner := w.defender_crew;
	ELSE
		winner := NULL;
	END IF;

	-- Payout only when a REAL crew won (the bot has no members to pay).
	IF winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew) THEN
		IF winner = w.challenger_crew THEN win_active := ch_active; ELSE win_active := df_active; END IF;
		IF w.is_bot_war THEN
			loser_pot := 0; share := c_house;        -- flat house bonus, no loser pot
		ELSE
			IF winner = w.challenger_crew THEN loser_pot := df_total; ELSE loser_pot := ch_total; END IF;
			share := CASE WHEN win_active > 0 THEN floor((loser_pot * 0.5) / win_active)::int ELSE 0 END;
		END IF;

		FOR m IN
			SELECT user_id, SUM(slings)::int AS own FROM public.mud_slings
			WHERE war_id = p_war AND crew_id = winner GROUP BY user_id HAVING SUM(slings) > 0
		LOOP
			reward := m.own + share;
			UPDATE public.profiles
				SET counter        = counter + reward,
				    tickles_earned = tickles_earned + reward,   -- exact 20260628 leaderboard shape
				    war_wins       = war_wins + 1
				WHERE id = m.user_id
				RETURNING war_wins INTO wins_now;
			-- Regen buff (self-blessing) — guarded.
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			-- Titles — guarded.
			BEGIN
				INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_champion')
					ON CONFLICT DO NOTHING;
				IF wins_now >= 5 THEN
					INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_veteran')
						ON CONFLICT DO NOTHING;
				END IF;
				IF wins_now >= 25 THEN
					INSERT INTO public.user_titles (user_id, title_id) VALUES (m.user_id, 'mud_legend')
						ON CONFLICT DO NOTHING;
				END IF;
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END IF;

	-- Status flip (core write) + idempotency stamp.
	UPDATE public.mud_wars SET status = 'resolved', winner_crew = winner, resolved_at = now()
		WHERE id = p_war;

	-- Announce both real crews — guarded so a bad insert can't undo a payout.
	BEGIN
		FOR m IN SELECT user_id, crew_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id,
				CASE WHEN winner IS NULL THEN 'war_draw'
				     WHEN m.crew_id = winner THEN 'war_won' ELSE 'war_lost' END,
				CASE WHEN winner IS NULL THEN 'Mud Fight: a draw'
				     WHEN m.crew_id = winner THEN 'Mud Fight won!' ELSE 'Mud Fight lost' END,
				CASE WHEN winner IS NULL THEN 'No quorum — the mud settles. Rally your Sounder next time.'
				     WHEN m.crew_id = winner THEN 'Your Sounder won! Snouts paid out and a 72h regen buff is on you.'
				     ELSE 'Your Sounder came up short this time.' END,
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'winner', winner,
		'challenger_score', round(ch_score, 2), 'defender_score', round(df_score, 2));
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. QUERY RPCs
-- ════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.crew_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	my_crew    uuid;
	crew_row   record;
	members    jsonb;
	invites_in jsonb;
	invites_out jsonb;
	active_war uuid;
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
		RETURN jsonb_build_object('crew', NULL, 'members', '[]'::jsonb,
			'invitesIn', invites_in, 'invitesOut', '[]'::jsonb, 'inWar', false, 'warId', NULL);
	END IF;

	SELECT * INTO crew_row FROM public.crews WHERE id = my_crew;
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', cm.user_id, 'username', p.username, 'role', cm.role,
			'active_title', p.active_title_id
		) ORDER BY cm.joined_at), '[]'::jsonb) INTO members
		FROM public.crew_members cm JOIN public.profiles p ON p.id = cm.user_id
		WHERE cm.crew_id = my_crew;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', ci.id, 'invitee_id', ci.invitee_id, 'invitee_name', p.username
		) ORDER BY ci.created_at DESC), '[]'::jsonb) INTO invites_out
		FROM public.crew_invites ci JOIN public.profiles p ON p.id = ci.invitee_id
		WHERE ci.crew_id = my_crew AND ci.status = 'pending';

	SELECT id INTO active_war FROM public.mud_wars
		WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
		  AND status IN ('pending', 'active') LIMIT 1;

	RETURN jsonb_build_object(
		'crew', jsonb_build_object('id', crew_row.id, 'name', crew_row.name,
			'leader_id', crew_row.leader_id, 'is_bot', crew_row.is_bot),
		'members', members, 'invitesIn', invites_in, 'invitesOut', invites_out,
		'inWar', active_war IS NOT NULL, 'warId', active_war);
END;
$function$;

-- war_side — one crew's roster + per-capita score for the war screen.
CREATE OR REPLACE FUNCTION public.war_side(p_war uuid, p_crew uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	WITH per_member AS (
		SELECT cm.user_id, p.username, COALESCE(SUM(ms.slings), 0)::int AS slings
		FROM public.crew_members cm
		JOIN public.profiles p ON p.id = cm.user_id
		LEFT JOIN public.mud_slings ms ON ms.user_id = cm.user_id AND ms.war_id = p_war
		WHERE cm.crew_id = p_crew
		GROUP BY cm.user_id, p.username
	), agg AS (
		SELECT COALESCE(SUM(slings), 0)::int AS total,
		       COUNT(*) FILTER (WHERE slings > 0)::int AS active
		FROM per_member
	)
	SELECT jsonb_build_object(
		'crew', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'is_bot', c.is_bot)
		         FROM public.crews c WHERE c.id = p_crew),
		'members', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', user_id, 'username', username, 'slings', slings) ORDER BY slings DESC), '[]'::jsonb)
			FROM per_member),
		'total', (SELECT total FROM agg),
		'active', (SELECT active FROM agg),
		'perCapita', (SELECT CASE WHEN active > 0 THEN round(total::numeric / active, 1) ELSE 0 END FROM agg),
		'quorumMet', (SELECT active >= 2 FROM agg)
	);
$function$;

CREATE OR REPLACE FUNCTION public.war_state(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	w         record;
	my_crew   uuid;
	them_crew uuid;
	today     date := (now() AT TIME ZONE 'UTC')::date;
	my_today  int;
	allotment int := 20;
	bot_pace  int := 12;
	elapsed   numeric;
	mine      jsonb;
	them      jsonb;
BEGIN
	IF caller_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	IF w.id IS NULL THEN RETURN 'null'::jsonb; END IF;
	-- Lazy resolve on first read after expiry, then re-read.
	IF w.status = 'active' AND w.ends_at <= now() THEN
		PERFORM public.resolve_war(p_war);
		SELECT * INTO w FROM public.mud_wars WHERE id = p_war;
	END IF;

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew = w.defender_crew THEN them_crew := w.challenger_crew; ELSE them_crew := w.defender_crew; END IF;

	mine := public.war_side(p_war, my_crew);
	IF w.is_bot_war AND them_crew = w.defender_crew THEN
		elapsed := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (LEAST(now(), w.ends_at) - w.started_at)) / 86400.0));
		them := jsonb_build_object(
			'crew', jsonb_build_object('id', them_crew, 'name', 'The Mudlarks', 'is_bot', true),
			'members', '[]'::jsonb, 'total', bot_pace * elapsed, 'active', NULL,
			'perCapita', bot_pace * elapsed, 'quorumMet', true);
	ELSE
		them := public.war_side(p_war, them_crew);
	END IF;

	SELECT slings INTO my_today FROM public.mud_slings
		WHERE war_id = p_war AND user_id = caller_id AND war_day = today;

	RETURN jsonb_build_object(
		'warId', w.id, 'status', w.status, 'endsAt', w.ends_at, 'isBotWar', w.is_bot_war,
		'winnerCrew', w.winner_crew, 'iAmChallenger', my_crew = w.challenger_crew,
		'myRemainingToday', allotment - COALESCE(my_today, 0),
		'mine', mine, 'them', them);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_war()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	w_id      uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RETURN 'null'::jsonb; END IF;
	SELECT id INTO w_id FROM public.mud_wars
		WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
		  AND status IN ('pending', 'active', 'resolved')
		ORDER BY created_at DESC LIMIT 1;
	IF w_id IS NULL THEN RETURN 'null'::jsonb; END IF;
	RETURN public.war_state(w_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.find_challengeable_crews()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'id', c.id, 'name', c.name,
		'memberCount', (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id)
	)), '[]'::jsonb)
	FROM public.crews c
	WHERE c.is_bot = false
	  AND c.id <> COALESCE(
	        (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()),
	        '00000000-0000-0000-0000-000000000000'::uuid)
	  AND NOT EXISTS (SELECT 1 FROM public.mud_wars w
	        WHERE (w.challenger_crew = c.id OR w.defender_crew = c.id)
	          AND w.status IN ('pending', 'active') AND w.is_bot_war = false)
	  AND EXISTS (SELECT 1 FROM public.crew_members m
	        WHERE m.crew_id = c.id AND public.are_friends(auth.uid(), m.user_id));
$function$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. GRANTS
-- ════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.is_crew_member(uuid, uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_war_participant(uuid, uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_crew(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_to_crew(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_crew_invite(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_crew_invite(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_crew()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_crew(uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_house()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_challenge(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_challenge(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sling_mud(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_war(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_state()                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.war_side(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.war_state(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_war()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_challengeable_crews()        TO authenticated;

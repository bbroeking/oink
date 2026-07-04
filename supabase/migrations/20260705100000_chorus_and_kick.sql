-- ════════════════════════════════════════════════════════════════════════
-- The Chorus + kick_crew_member.
--
-- CHORUS: when 3+ distinct crewmates each cast a blessing within a
-- 30-minute window, the whole Sounder gains a 1-hour `chorus_glow`
-- (regen ×0.5, same family as warm_tea/mud_wrap) AND +3 crew Elo.
-- At most once per crew per UTC day. The glow rows are SYSTEM self-rows
-- (sender = receiver), like war_winner_regen.
--
-- Correctness notes:
--   · blessings_one_per_pair_per_day (sender, receiver, sent_on) also
--     covers self-rows, so a member who already got a war_winner_regen
--     self-row today would collide → the glow INSERT is ON CONFLICT DO
--     NOTHING, and the Elo/announce only fire when at least one row
--     actually landed (no rows → no +3, so the bump can't be farmed by
--     re-triggering on a fully-conflicted day).
--   · The daily cast-cap count now EXCLUDES system kinds
--     (war_winner_regen, chorus_glow) — previously a war-winner's
--     self-row silently ate one of their 3 daily casts.
--
-- KICK: the leader can remove a member (not mid-scuffle — same war gate
-- as leave_crew, so rosters can't shift under a live war).
--
-- Carried latest defs: blessings_kind_check + send_blessing +
-- regen_secs_for + ritual_push_notify ← 20260704900000;
-- blessings_check (self-row carve-out) ← 20260647.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.blessings DROP CONSTRAINT IF EXISTS blessings_kind_check;
ALTER TABLE public.blessings ADD CONSTRAINT blessings_kind_check
	CHECK (kind IN ('warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts', 'war_winner_regen',
	                'mud_wrap', 'glimmer_truffle', 'snoot_boop', 'trough_bounty', 'chorus_glow'));

ALTER TABLE public.blessings DROP CONSTRAINT IF EXISTS blessings_check;
ALTER TABLE public.blessings ADD CONSTRAINT blessings_check
	CHECK (sender_id <> receiver_id OR kind IN ('war_winner_regen', 'chorus_glow'));

CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_blessing_kind();
	casts_today   int;
	cast_cap      int;
	new_id        uuid;
	exp           timestamptz;
	bf            numeric;
	base          interval;
	my_crew       uuid;
	chorus_voices int;
	glow_rows     int := 0;
	chorus_fired  boolean := false;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	-- Friends OR crewmates: the herd you fight beside deserves your
	-- blessings even before the friend request lands.
	IF NOT (public.are_friends(caller_id, target_user_id)
	        OR public.is_crewmates(caller_id, target_user_id)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;  -- bless up to 3 different pigs/day
	-- System-granted self-rows (war buff, chorus glow) don't count against
	-- the player's daily casts.
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date
		  AND kind NOT IN ('war_winner_regen', 'chorus_glow');
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Generous blessers cast LONGER blessings; greedy ones shorter. Only the
	-- timed kinds use it; the instant kinds are NULL.
	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'        THEN interval '3 hours'
		WHEN 'mud_wrap'        THEN interval '3 hours'
		WHEN 'sun_beam'        THEN interval '4 hours'
		WHEN 'glimmer_truffle' THEN interval '4 hours'
		ELSE NULL   -- halo_kiss / snoot_boop (+5 tickles), bountiful_snouts / trough_bounty (+5 snouts)
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Instant payouts.
	IF kind_today IN ('bountiful_snouts', 'trough_bounty') THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	ELSIF kind_today IN ('halo_kiss', 'snoot_boop') THEN
		PERFORM public.grant_tickles(target_user_id, 5);
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	-- ── THE CHORUS ────────────────────────────────────────────────────
	-- 3+ distinct crewmates cast (any blessing, at anyone) within 30
	-- minutes → the whole Sounder glows for an hour and gains +3 Elo.
	-- Once per crew per UTC day.
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NOT NULL THEN
		SELECT count(DISTINCT b.sender_id) INTO chorus_voices
			FROM public.blessings b
			JOIN public.crew_members cm
			  ON cm.user_id = b.sender_id AND cm.crew_id = my_crew
			WHERE b.sent_at > now() - interval '30 minutes'
			  AND b.kind NOT IN ('war_winner_regen', 'chorus_glow');
		IF chorus_voices >= 3 AND NOT EXISTS (
			SELECT 1 FROM public.blessings cb
			JOIN public.crew_members cm2
			  ON cm2.user_id = cb.receiver_id AND cm2.crew_id = my_crew
			WHERE cb.kind = 'chorus_glow'
			  AND cb.sent_on = (now() AT TIME ZONE 'UTC')::date
		) THEN
			INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
				SELECT cm.user_id, cm.user_id, 'chorus_glow', now() + interval '1 hour'
				FROM public.crew_members cm WHERE cm.crew_id = my_crew
			ON CONFLICT (sender_id, receiver_id, sent_on) DO NOTHING;
			GET DIAGNOSTICS glow_rows = ROW_COUNT;
			IF glow_rows > 0 THEN
				chorus_fired := true;
				INSERT INTO public.crew_ratings (crew_id) VALUES (my_crew) ON CONFLICT DO NOTHING;
				UPDATE public.crew_ratings SET rating = rating + 3 WHERE crew_id = my_crew;
				-- Tell the herd. Inline announce, savepoint-guarded.
				BEGIN
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					SELECT cm.user_id, 'chorus_glow', 'The Chorus rises',
						'Three voices blessed within the half hour — the whole Sounder glows for an hour, and gains a little Elo.',
						jsonb_build_object('crew_id', my_crew)
					FROM public.crew_members cm WHERE cm.crew_id = my_crew;
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;
		END IF;
	END IF;

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id,
		'chorus', chorus_fired);
END;
$function$;

-- chorus_glow joins the regen-boost family. Verbatim from 20260704900000
-- otherwise.
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
			WHERE receiver_id = uid AND kind IN ('warm_tea', 'mud_wrap', 'chorus_glow')
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
		-- Mud Scuffles: winner regen buff — ×0.85 (BUFF_MULT) for 72h after a win.
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;

-- Push copy: chorus_glow rows are system self-rows — a "<you> blessed you"
-- title would be nonsense, so they get their own title. Verbatim from
-- 20260704900000 otherwise.
CREATE OR REPLACE FUNCTION public.ritual_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name text;
	is_curse   boolean := TG_TABLE_NAME = 'curses';
	push_title text;
	push_body  text;
BEGIN
	SELECT username INTO actor_name
		FROM public.profiles WHERE id = NEW.sender_id;

	IF is_curse THEN
		push_title := COALESCE(actor_name, 'Someone') || ' cursed you';
		push_body := CASE NEW.kind
			WHEN 'sluggish_snout' THEN 'A sluggish snout — your tickles crawl.'
			WHEN 'phantom_itch'   THEN 'A phantom itch is on you.'
			WHEN 'goblin_whisper' THEN 'A goblin whisper follows you.'
			WHEN 'coin_pinch'     THEN 'A coin pinch — snouts gone missing.'
			ELSE 'A little mischief lands on you.'
		END;
	ELSIF NEW.kind = 'chorus_glow' THEN
		push_title := 'The Chorus rises';
		push_body := 'Three voices sang together — your whole Sounder glows.';
	ELSE
		push_title := COALESCE(actor_name, 'A friend') || ' blessed you';
		push_body := CASE NEW.kind
			WHEN 'warm_tea'         THEN 'Warm tea — your tickles brew faster.'
			WHEN 'sun_beam'         THEN 'A sun beam — your next Lucky Pig shines.'
			WHEN 'halo_kiss'        THEN 'A halo kiss — you''re glowing.'
			WHEN 'bountiful_snouts' THEN 'Bountiful snouts — +5 landed in your barn.'
			WHEN 'mud_wrap'         THEN 'A mud wrap — your tickles brew faster.'
			WHEN 'glimmer_truffle'  THEN 'A glimmering truffle — your next Lucky Pig shines.'
			WHEN 'snoot_boop'       THEN 'A snoot boop — +5 tickles, right now.'
			WHEN 'trough_bounty'    THEN 'Trough bounty — +5 snouts landed in your barn.'
			ELSE 'A friend sent something kind your way.'
		END;
	END IF;

	-- Fire-and-forget; a push failure must never roll back the ritual.
	BEGIN
		PERFORM public.send_push_to_user(
			NEW.receiver_id,
			push_title,
			push_body,
			jsonb_build_object(
				'kind', CASE WHEN is_curse THEN 'curse' ELSE 'blessing' END,
				'screen', 'friends'
			)
		);
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;

	RETURN NEW;
END;
$function$;

-- ── KICK ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kick_crew_member(p_member uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	crew_name text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF caller_id = p_member THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;
	SELECT c.id, c.name INTO my_crew, crew_name FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crew_members
	               WHERE crew_id = my_crew AND user_id = p_member) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
	END IF;
	-- Rosters can't shift under a live scuffle (mirrors leave_crew/join_crew).
	IF EXISTS (SELECT 1 FROM public.mud_wars
	           WHERE (challenger_crew = my_crew OR defender_crew = my_crew)
	             AND status IN ('pending', 'active')) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'in_war');
	END IF;

	DELETE FROM public.crew_members WHERE crew_id = my_crew AND user_id = p_member;

	-- Tell the kicked pig, gently. Inline announce, savepoint-guarded.
	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (p_member, 'crew_kick', 'Paths part',
			crew_name || ' has parted ways with you. No mud lost — the bog is full of banners.',
			jsonb_build_object('crew_id', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.kick_crew_member(uuid) TO authenticated;

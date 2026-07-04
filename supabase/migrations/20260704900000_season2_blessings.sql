-- ════════════════════════════════════════════════════════════════════════
-- Season 2 blessings — a new daily set for the Season of the Hunger, and
-- blessings now reach CREWMATES, not just friends (join-first Sounders mean
-- your crew isn't necessarily your friend list; kindness inside the herd is
-- exactly what Sounder Spirit rewards).
--
-- The S2 set is a 1:1 mechanical analog of Season 1's — same machinery,
-- new fiction:
--       S1                 S2                effect
--   warm_tea          → mud_wrap          regen ×0.5, 3h (alignment-scaled)
--   sun_beam          → glimmer_truffle   lucky-pig boost, consume-on-lucky, 4h
--   halo_kiss         → snoot_boop        +5 tickles, instant
--   bountiful_snouts  → trough_bounty     +5 snouts, instant
--
-- The season is decided by the GLOBAL world_boss flag (app_config.enabled);
-- per-user overrides deliberately don't move the daily kind — the whole
-- barnyard casts the same blessing on the same day. The client mirror
-- (utils/rituals.ts) reads the same flag.
--
-- Carried latest defs (carry-latest-def footgun):
--   blessings_kind_check   ← 20260647 (had added war_winner_regen)
--   daily_blessing_kind    ← 20260522 (only def)
--   send_blessing          ← 20260614 (cap-3 def; alignment + xp + instant payouts)
--   regen_secs_for         ← 20260647 (vip + curse + alignment + happiness + war buff)
--   ritual_push_notify     ← 20260528 (only def; triggers stay in place)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.blessings DROP CONSTRAINT IF EXISTS blessings_kind_check;
ALTER TABLE public.blessings ADD CONSTRAINT blessings_kind_check
	CHECK (kind IN ('warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts', 'war_winner_regen',
	                'mud_wrap', 'glimmer_truffle', 'snoot_boop', 'trough_bounty'));

-- Same-crew test, both directions. SECURITY DEFINER because crew_members RLS
-- only shows the caller's own crew.
CREATE OR REPLACE FUNCTION public.is_crewmates(user_a uuid, user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.crew_members x
		JOIN public.crew_members y ON y.crew_id = x.crew_id
		WHERE x.user_id = user_a AND y.user_id = user_b AND user_a <> user_b
	);
$function$;

-- Season-aware daily kind: S2 pool once the world_boss GLOBAL is on.
CREATE OR REPLACE FUNCTION public.daily_blessing_kind()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	SELECT (CASE WHEN COALESCE(
			(SELECT enabled FROM public.app_config WHERE key = 'world_boss'), false)
		THEN ARRAY['mud_wrap', 'glimmer_truffle', 'snoot_boop', 'trough_bounty']
		ELSE ARRAY['warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts'] END)[
		(EXTRACT(DOY FROM (now() AT TIME ZONE 'UTC'))::int % 4) + 1
	];
$$;

-- send_blessing: reach = friends OR crewmates; S2 kinds wired into the
-- duration map + instant payouts. Otherwise verbatim from 20260614.
CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	kind_today   text := public.daily_blessing_kind();
	casts_today  int;
	cast_cap     int;
	new_id       uuid;
	exp          timestamptz;
	bf           numeric;
	base         interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	-- Friends OR crewmates: the herd you fight beside deserves your
	-- blessings even before the friend request lands. Reason string stays
	-- 'not_friends' for client compatibility.
	IF NOT (public.are_friends(caller_id, target_user_id)
	        OR public.is_crewmates(caller_id, target_user_id)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;  -- bless up to 3 different pigs/day
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
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

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

-- regen_secs_for: mud_wrap joins warm_tea as the regen-boost kind.
-- Verbatim from 20260647 otherwise.
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
			WHERE receiver_id = uid AND kind IN ('warm_tea', 'mud_wrap')
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

-- Push copy for the S2 kinds. Verbatim from 20260528 otherwise; the
-- blessings_push / curses_push triggers already point at this function.
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

GRANT EXECUTE ON FUNCTION public.is_crewmates(uuid, uuid) TO authenticated;

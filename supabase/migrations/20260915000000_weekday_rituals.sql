-- ════════════════════════════════════════════════════════════════════════
-- Weekday rituals — seven blessings, seven curses, cosmetic only.
--
-- Plan: docs/design/2026-09-14-weekday-rituals-plan.md (founder decisions
-- 2026-09-14). Replaces the Season 0 AND Season 1 ritual sets outright.
--
--   1. The ISO weekday of the UTC date picks the day's pair. Monday is
--      always Cloud Nine + Pickle Brine; Friday is always Golden Hour +
--      Bacon Bits. The old day-of-year-modulo-four cycle drifted (4 does
--      not divide 7) so no day ever earned a reputation.
--   2. The `world_boss` / app_config season switch NO LONGER branches the
--      rotation. A rotation that branches on a flag has bitten once already
--      (the S1 client mirror), so the flag leaves the ritual path entirely.
--   3. Rituals stop touching gameplay. No regen change, no lucky boost, no
--      +5 tickles, no +5 snouts, no snout pinch. Every kind is a flat SIX
--      HOURS scaled by the caster's existing alignment factor, and what it
--      buys is something you SEE on your pig or your Barn.
--
-- Casting is still a social action: the cap of three, the friends-OR-
-- crewmates reach, the XP, the alignment shift, the Chorus, the push and
-- the Inbox row are all unchanged.
--
-- The client contract for the fourteen kind names is `constants/ritualFx.ts`.
--
-- ── Carried definitions (carry-latest-def footgun) ──────────────────────
-- Every function below is CREATE OR REPLACE'd from its LATEST definition in
-- this migration tree, verified by grep, with only the documented edits:
--
--   blessings_kind_check   ← 20260705100000_chorus_and_kick.sql
--                            (the 9 S0+S2 kinds + war_winner_regen +
--                             chorus_glow; ALL kept, + the 7 new blessings)
--   curses_kind_check      ← 20260523000000_curses.sql (the inline,
--                            auto-named CHECK on curses.kind; never
--                            redefined since. All 4 old kinds kept, + the
--                            7 new curses)
--   daily_blessing_kind()  ← 20260704900000_season2_blessings.sql
--                            (drops the app_config/world_boss read; keeps
--                             STABLE SECURITY DEFINER SET search_path)
--   daily_curse_kind()     ← 20260523000000_curses.sql (only def; plain
--                            STABLE LANGUAGE sql, as today)
--   send_blessing()        ← 20260750000000_mudwrap_stacking.sql
--                            (nothing after 20260750 redefines it)
--   send_curse()           ← 20260634000000_curse_cap_three.sql
--                            (nothing after 20260634 redefines it)
--   ritual_status()        ← 20260634000000_curse_cap_three.sql
--                            (only def besides 20260614; purely additive)
--   ritual_push_notify()   ← 20260705100000_chorus_and_kick.sql
--                            (NOT 20260528 — chorus_and_kick added the
--                             chorus_glow system-row title branch, which is
--                             carried here verbatim. The blessings_push /
--                             curses_push triggers stay as they are.)
--
-- NOT TOUCHED, deliberately: regen_secs_for() (20260705100000), the lucky
-- boost, the sluggish-snout regen history, cleanse_curses(), my_active_
-- effects(), and the clear_curses_on_blessing trigger. They only ever match
-- OLD kinds, which stop being cast the moment this lands and expire within
-- twelve hours.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Kind constraints ─────────────────────────────────────────────────
-- Old kinds stay in the CHECK so history rows (and rows still ticking down
-- when this lands) remain valid.

ALTER TABLE public.blessings DROP CONSTRAINT IF EXISTS blessings_kind_check;
ALTER TABLE public.blessings ADD CONSTRAINT blessings_kind_check
	CHECK (kind IN (
		-- Season 0
		'warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts',
		-- Season 1 / 2
		'mud_wrap', 'glimmer_truffle', 'snoot_boop', 'trough_bounty',
		-- system-granted, never in the rotation
		'war_winner_regen', 'chorus_glow',
		-- weekday rituals, Monday first
		'cloud_nine', 'bubble_bath', 'butterfly_crown', 'confetti_snout',
		'golden_hour', 'firefly_night', 'sunday_best'
	));

ALTER TABLE public.curses DROP CONSTRAINT IF EXISTS curses_kind_check;
ALTER TABLE public.curses ADD CONSTRAINT curses_kind_check
	CHECK (kind IN (
		-- Season 0 / 1
		'sluggish_snout', 'phantom_itch', 'goblin_whisper', 'coin_pinch',
		-- weekday rituals, Monday first
		'pickle_brine', 'topsy_turvy', 'pipsqueak', 'little_raincloud',
		'bacon_bits', 'hiccups', 'old_timey'
	));

-- ── 2. Rotation: the ISO weekday of the UTC date ────────────────────────
-- EXTRACT(ISODOW) is 1 (Monday) … 7 (Sunday), so it indexes a Monday-first
-- 7-array directly. Same UTC clock the daily cap and the reset countdown
-- already use, and the same `isodow` convention the Dig-Off race uses.

CREATE OR REPLACE FUNCTION public.daily_blessing_kind()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT (ARRAY[
		'cloud_nine',       -- Mon
		'bubble_bath',      -- Tue
		'butterfly_crown',  -- Wed
		'confetti_snout',   -- Thu
		'golden_hour',      -- Fri
		'firefly_night',    -- Sat
		'sunday_best'       -- Sun
	])[EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC'))::int];
$function$;

CREATE OR REPLACE FUNCTION public.daily_curse_kind()
RETURNS text
LANGUAGE sql
STABLE
AS $function$
	SELECT (ARRAY[
		'pickle_brine',     -- Mon
		'topsy_turvy',      -- Tue
		'pipsqueak',        -- Wed
		'little_raincloud', -- Thu
		'bacon_bits',       -- Fri
		'hiccups',          -- Sat
		'old_timey'         -- Sun
	])[EXTRACT(ISODOW FROM (now() AT TIME ZONE 'UTC'))::int];
$function$;

REVOKE ALL ON FUNCTION public.daily_blessing_kind() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.daily_blessing_kind() TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_curse_kind() TO authenticated;

-- ── 3. send_blessing ────────────────────────────────────────────────────
-- Carried from 20260750000000_mudwrap_stacking.sql. Removed, per the plan:
--   · the whole mud-wrap / warm-tea BANKING + soft-clear block (spec 14) —
--     no ritual changes regen any more, so there is no wrap to extend;
--   · the per-kind `base` CASE — every kind is a flat 6h × bf;
--   · the +5 snouts (bountiful_snouts / trough_bounty) payout;
--   · the +5 tickles (halo_kiss / snoot_boop) payout.
-- Kept verbatim: reach (friends OR crewmates), the cap of three excluding
-- system self-rows, the alignment factor `bf`, the unique-violation guard,
-- shift_alignment, grant_season_xp, the whole Chorus block (including the
-- INLINED, savepoint-guarded system_announcements INSERT — routing it via
-- send_system_announcement() would raise admin_only and silently roll the
-- cast back), and the {ok, kind, blessing_id, chorus} return shape.

CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
	-- blessings even before the friend request lands. Reason string stays
	-- 'not_friends' for client compatibility.
	IF NOT (public.are_friends(caller_id, target_user_id)
	        OR public.is_crewmates(caller_id, target_user_id)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;
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

	-- Generous blessers cast LONGER blessings; greedy ones shorter. Every
	-- weekday kind is timed now, so this applies to all of them.
	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := interval '6 hours';
	exp := now() + (base * bf);

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	-- THE CHORUS — 3+ distinct crewmates cast within 30 minutes → the whole
	-- Sounder glows for an hour. Once per crew per UTC day.
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
				BEGIN
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					SELECT cm.user_id, 'chorus_glow', 'The Chorus rises',
						'Three voices blessed within the half hour — the whole Sounder glows for an hour.',
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

REVOKE ALL ON FUNCTION public.send_blessing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_blessing(uuid) TO authenticated;

-- ── 4. send_curse ───────────────────────────────────────────────────────
-- Carried from 20260634000000_curse_cap_three.sql. Removed, per the plan:
--   · the per-kind `base` CASE — flat 6h × cf for every kind;
--   · the whole coin_pinch block (the per-receiver 10/day take tally, the
--     `this_take` deduction, and the profiles.counter UPDATE);
--   · `snouts_taken` from the return payload.
-- The curses.snouts_taken COLUMN stays (history rows carry real values and
-- nothing else reads it); new rows simply take its DEFAULT 0.
-- Kept verbatim: the friends reach, the cap of three, the alignment factor
-- `cf`, the unique-violation guard, shift_alignment(-1), grant_season_xp(2).

CREATE OR REPLACE FUNCTION public.send_curse(target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_curse_kind();
	casts_today   int;
	cast_cap      int;
	new_id        uuid;
	exp           timestamptz;
	cf            numeric;
	base          interval;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;  -- curse up to 3 different targets/day
	SELECT COUNT(*) INTO casts_today
		FROM public.curses
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Greedy cursers cast LONGER curses; generous ones shorter.
	cf := 1 - (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := interval '6 hours';
	exp := now() + (base * cf);

	BEGIN
		INSERT INTO public.curses (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_cursed_today');
	END;

	PERFORM public.shift_alignment(caller_id, -1);
	PERFORM public.grant_season_xp(caller_id, 2);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'curse_id', new_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.send_curse(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_curse(uuid) TO authenticated;

-- ── 5. ritual_status ────────────────────────────────────────────────────
-- Carried from 20260634000000_curse_cap_three.sql. Purely ADDITIVE: the
-- four existing fields keep their names and meanings; `bless_kind` and
-- `curse_kind` join them so the client stops mirroring the rotation (its
-- local weekday table survives only as an offline fallback).

CREATE OR REPLACE FUNCTION public.ritual_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	today     date := (now() AT TIME ZONE 'UTC')::date;
	b_used    int;
	c_used    int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT count(*) INTO b_used FROM public.blessings WHERE sender_id = caller_id AND sent_on = today;
	SELECT count(*) INTO c_used FROM public.curses    WHERE sender_id = caller_id AND sent_on = today;
	-- caps mirror the cast fns: send_blessing cast_cap=3, send_curse cast_cap=3.
	RETURN jsonb_build_object('ok', true,
		'bless_used', b_used, 'bless_cap', 3,
		'curse_used', c_used, 'curse_cap', 3,
		-- The day's pair, server-authoritative (weekday-locked, UTC).
		'bless_kind', public.daily_blessing_kind(),
		'curse_kind', public.daily_curse_kind());
END;
$function$;

REVOKE ALL ON FUNCTION public.ritual_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ritual_status() TO authenticated;

-- ── 6. ritual_push_notify ───────────────────────────────────────────────
-- Carried from 20260705100000_chorus_and_kick.sql (the LATEST def — it
-- added the chorus_glow system-row title branch on top of 20260704900000,
-- which in turn came from 20260528000000_ritual_push). One playful body
-- line per new kind; every old line and both ELSE fallbacks stay, because
-- rows cast before this migration still push as they expire-and-renew in
-- the Inbox. The blessings_push / curses_push triggers are untouched.

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
			-- Weekday rituals, Monday first.
			WHEN 'pickle_brine'     THEN 'Your barn has gone briny green.'
			WHEN 'topsy_turvy'      THEN 'Your pig is upside down. It seems fine.'
			WHEN 'pipsqueak'        THEN 'Your pig is half its size and twice as squeaky.'
			WHEN 'little_raincloud' THEN 'A small grey cloud is following your pig.'
			WHEN 'bacon_bits'       THEN 'Your pig is bacon now. Sorry.'
			WHEN 'hiccups'          THEN 'Your pig has the hiccups. Hic.'
			WHEN 'old_timey'        THEN 'Your pig has gone sepia, and got a monocle.'
			-- Retired kinds, still expiring.
			WHEN 'sluggish_snout'   THEN 'A sluggish snout — your tickles crawl.'
			WHEN 'phantom_itch'     THEN 'A phantom itch is on you.'
			WHEN 'goblin_whisper'   THEN 'A goblin whisper follows you.'
			WHEN 'coin_pinch'       THEN 'A coin pinch — snouts gone missing.'
			ELSE 'A little mischief lands on you.'
		END;
	ELSIF NEW.kind = 'chorus_glow' THEN
		push_title := 'The Chorus rises';
		push_body := 'Three voices sang together — your whole Sounder glows.';
	ELSE
		push_title := COALESCE(actor_name, 'A friend') || ' blessed you';
		push_body := CASE NEW.kind
			-- Weekday rituals, Monday first.
			WHEN 'cloud_nine'       THEN 'Your pig is floating on a tiny cloud.'
			WHEN 'bubble_bath'      THEN 'Soap bubbles are drifting around your pig.'
			WHEN 'butterfly_crown'  THEN 'A butterfly has settled on your pig''s head.'
			WHEN 'confetti_snout'   THEN 'Every tickle pops confetti today.'
			WHEN 'golden_hour'      THEN 'Your barn has gone warm and gold.'
			WHEN 'firefly_night'    THEN 'Dusk in your barn, and fireflies.'
			WHEN 'sunday_best'      THEN 'Your pig is wearing a little bow tie.'
			-- Retired kinds, still expiring.
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

-- ── 7. active_effects_of ────────────────────────────────────────────────
-- NEW. A visitor sees the host's Barn the way the host sees it (plan phase
-- 4: a curse is something the caster can go and admire).
--
-- Deliberately NARROWER than my_active_effects(): no sender_id, no
-- sender_username. Who left a mark on you is yours to see; a visitor only
-- gets the kinds so the scene and the pig can render. Reach mirrors
-- send_blessing exactly — friends OR crewmates — so unfriending or being
-- kicked from a Sounder closes the window in the same breath. A caller
-- asking about themselves is allowed (my_active_effects already tells them
-- strictly more).
--
-- SECURITY DEFINER because the curses/blessings RLS policies only expose
-- rows where the caller is the sender or receiver; the reach predicate
-- below is the whole authorization.

CREATE OR REPLACE FUNCTION public.active_effects_of(p_target uuid)
RETURNS TABLE (
	source     text,
	kind       text,
	expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT e.source, e.kind, e.expires_at
	FROM (
		SELECT 'blessing'::text AS source, b.kind AS kind, b.expires_at AS expires_at
			FROM public.blessings b
			WHERE b.receiver_id = p_target
			  AND b.cleared_at IS NULL
			  AND b.expires_at IS NOT NULL
			  AND b.expires_at > now()
		UNION ALL
		SELECT 'curse'::text AS source, c.kind AS kind, c.expires_at AS expires_at
			FROM public.curses c
			WHERE c.receiver_id = p_target
			  AND c.cleared_at IS NULL
			  AND c.expires_at IS NOT NULL
			  AND c.expires_at > now()
	) e
	WHERE auth.uid() IS NOT NULL
	  AND p_target IS NOT NULL
	  AND (auth.uid() = p_target
	       OR public.are_friends(auth.uid(), p_target)
	       OR public.is_crewmates(auth.uid(), p_target))
	  AND NOT public.are_blocked(auth.uid(), p_target);
$function$;

REVOKE ALL ON FUNCTION public.active_effects_of(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.active_effects_of(uuid) TO authenticated;

-- ── 8. unlock_field_guide_page — the Rituals page ───────────────────────
-- Carried from 20260752000000_field_guide_pages.sql (only def; verified with
-- `grep -ln 'FUNCTION public.unlock_field_guide_page' | sort | tail`). The
-- client's "Mud Wrap & Warm Tea" page became "Rituals" (id `rituals`) with the
-- weekday set, so the whitelist admits the new id. `mud_wrap` stays admitted
-- so an older build's fire never raises, and existing mud_wrap unlock rows are
-- carried over to `rituals` — the player already met the page.
CREATE OR REPLACE FUNCTION public.unlock_field_guide_page(p_page text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN; -- unauthenticated: silent no-op
	END IF;
	IF p_page NOT IN (
		'truffle', 'golden_truffle', 'lucky_number', 'trough',
		'mud_wrap', 'rituals', 'snouts', 'exchange', 'feeding_windows'
	) THEN
		RAISE EXCEPTION 'unknown field guide page: %', p_page
			USING ERRCODE = 'check_violation';
	END IF;
	INSERT INTO public.field_guide_pages (user_id, page_id)
		VALUES (auth.uid(), p_page)
		ON CONFLICT (user_id, page_id) DO NOTHING;
END;
$function$;

REVOKE ALL ON FUNCTION public.unlock_field_guide_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_field_guide_page(text) TO authenticated;

INSERT INTO public.field_guide_pages (user_id, page_id)
	SELECT user_id, 'rituals' FROM public.field_guide_pages WHERE page_id = 'mud_wrap'
	ON CONFLICT (user_id, page_id) DO NOTHING;

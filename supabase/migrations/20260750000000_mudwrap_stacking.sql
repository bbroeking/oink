-- Spec 14 — Mud-wrap stacking: extend duration, never multiply regen.
-- Decision trail: SKILL.md decision log 2026-07-16 (option 1, founder call).
--
-- Today two DIFFERENT friends wrapping the same pig on the same day each land a
-- parallel blessings row (the one-per-pair-per-day unique is keyed on the
-- SENDER, so distinct senders never collide). The regen buff does NOT multiply
-- — regen_secs_for() (latest def: 20260705100000_chorus_and_kick) gates the
-- 0.5× on a boolean `EXISTS (... kind IN ('warm_tea','mud_wrap','chorus_glow')
-- AND cleared_at IS NULL AND expires_at > now())`, so N active rows still read
-- as exactly one wrap. But the second wrap is effectively WASTED: two rows cast
-- minutes apart expire minutes apart, so the herd's coordination bought almost
-- no extra double-regen.
--
-- THE CHANGE (this migration): a regen wrap (mud_wrap, or its S0 twin warm_tea)
-- cast on a pig that already carries an active wrap now EXTENDS that wrap
-- ADDITIVELY instead of stacking a parallel row — banked up to a 12h CEILING
-- (== 4 wraps of the 3h base) so a coordinated Sounder can't bank a week of
-- double-regen. The caster's cast still LANDS exactly as today: we keep
-- inserting the caster's own row (the daily-cap tally, the Chorus 30-min window,
-- the pair-bond trigger, and the receiver push all key off a fresh blessings
-- INSERT), give that row the banked expiry, then soft-clear the prior active
-- wrap rows so the receiver keeps exactly ONE active wrap row. my_active_effects
-- then shows the single extended-expiry card naturally — no client change.
--
-- CARRY-LATEST: send_blessing is carried VERBATIM from its latest definition
-- (20260714000000_coop_dig_rebuild) — nothing between 20260715 and here
-- redefines it — with ONLY the banking block + the soft-clear added. The Chorus
-- system_announcements INSERT stays INLINED + EXCEPTION-wrapped (send_blessing
-- is a user RPC; routing it through send_system_announcement() would raise
-- admin_only and silently roll the whole cast back — see the admin-gated
-- announcement footgun in CLAUDE.md memory).
--
-- The 12h ceiling constant lives server-side (wrap_ceiling below) — no client
-- constant.

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
	-- Spec 14: banked mud-wrap / warm-tea duration ceiling (== 4 × 3h wraps).
	wrap_ceiling  constant interval := interval '12 hours';
	prior_wrap_exp timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT (public.are_friends(caller_id, target_user_id)
	        OR public.is_crewmates(caller_id, target_user_id)) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	cast_cap := 3;
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date
		  AND kind NOT IN ('war_winner_regen', 'chorus_glow');
	IF casts_today >= cast_cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	bf := 1 + (COALESCE(
		(SELECT alignment_score FROM public.profiles WHERE id = caller_id), 0) / 100.0) * 0.5;
	base := CASE kind_today
		WHEN 'warm_tea'        THEN interval '3 hours'
		WHEN 'mud_wrap'        THEN interval '3 hours'
		WHEN 'sun_beam'        THEN interval '4 hours'
		WHEN 'glimmer_truffle' THEN interval '4 hours'
		ELSE NULL
	END;
	exp := CASE WHEN base IS NULL THEN NULL ELSE now() + (base * bf) END;

	-- ── Mud-wrap / warm-tea stacking (spec 14) ────────────────────────────────
	-- If the receiver already carries an active wrap of this kind (from ANY
	-- sender), BANK this wrap's duration onto the existing expiry additively,
	-- capped at the 12h ceiling. regen_secs_for's EXISTS gate means the buff
	-- never multiplies regardless of row count — this only controls how long the
	-- single 0.5× lasts.
	IF kind_today IN ('warm_tea', 'mud_wrap') THEN
		SELECT max(expires_at) INTO prior_wrap_exp
			FROM public.blessings
			WHERE receiver_id = target_user_id
			  AND kind = kind_today
			  AND cleared_at IS NULL
			  AND expires_at > now();
		IF prior_wrap_exp IS NOT NULL THEN
			exp := LEAST(prior_wrap_exp + (base * bf), now() + wrap_ceiling);
		END IF;
	END IF;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Soft-clear the prior wrap rows now that their remaining time is banked into
	-- new_id — leaving the receiver exactly ONE active wrap row (the extended
	-- one), so my_active_effects surfaces a single card with the banked expiry.
	IF kind_today IN ('warm_tea', 'mud_wrap') AND prior_wrap_exp IS NOT NULL THEN
		UPDATE public.blessings
			SET cleared_at = now()
			WHERE receiver_id = target_user_id
			  AND kind = kind_today
			  AND cleared_at IS NULL
			  AND expires_at > now()
			  AND id <> new_id;
	END IF;

	IF kind_today IN ('bountiful_snouts', 'trough_bounty') THEN
		UPDATE public.profiles SET counter = counter + 5 WHERE id = target_user_id;
	ELSIF kind_today IN ('halo_kiss', 'snoot_boop') THEN
		PERFORM public.grant_tickles(target_user_id, 5);
	END IF;

	PERFORM public.shift_alignment(caller_id, 1);
	PERFORM public.grant_season_xp(caller_id, 5);

	-- THE CHORUS — 3+ distinct crewmates cast within 30 minutes → the whole
	-- Sounder glows for an hour. (The league +3 Elo bump was removed with the
	-- ratings table; the glow + announce are the co-op payoff now.)
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
GRANT EXECUTE ON FUNCTION public.send_blessing(uuid) TO authenticated;

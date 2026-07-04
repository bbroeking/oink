-- ════════════════════════════════════════════════════════════════════════
-- The Echo, scuffle match history, forfeit, and participation-paid wins.
--
-- ECHO: when a pig hits a Lucky Pig, the moment rings for their whole
-- Sounder — crewmates who tap their own pig within 10 minutes catch the
-- echo (+1 tickle, once each). One echo per crew per 10-minute window.
--
-- FORFEIT: the leader can yield an active scuffle (forfeit_war). The
-- other side wins immediately; Elo applies as a normal loss.
--
-- PAYOUT: winning now pays TICKLES proportional to each winner's own
-- participation (sling points + 3×submitted digs, capped 20 / bot 10) —
-- replacing the raw-snout mint from the loser pot. This closes the
-- war→snout economy hole (rollout precondition #2 in the mudwar memos):
-- tickles are the bounded core-verb resource, snouts stay un-mintable
-- from wars, and Golden Truffles remain the war-exclusive currency.
--
-- Carried latest defs: resolve_war ← 20260668 (rhythm; the ONLY changes
-- are the forfeit override, the payout block, and Scuffle-named
-- announcement copy); record_lucky_pig_hit ← 20260674.
-- ════════════════════════════════════════════════════════════════════════

-- ── ECHO tables (RPC-only; RLS enabled with no policies) ─────────────
CREATE TABLE IF NOT EXISTS public.echo_events (
	id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	crew_id     uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	source_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	kind        text NOT NULL DEFAULT 'lucky_pig' CHECK (kind IN ('lucky_pig')),
	created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS echo_events_crew_recent_idx
	ON public.echo_events (crew_id, created_at DESC);
ALTER TABLE public.echo_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.echo_claims (
	event_id bigint NOT NULL REFERENCES public.echo_events(id) ON DELETE CASCADE,
	user_id  uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	claimed_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (event_id, user_id)
);
ALTER TABLE public.echo_claims ENABLE ROW LEVEL SECURITY;

-- record_lucky_pig_hit — carried from 20260674 + the echo: first lucky hit
-- in a 10-minute window rings for the crew (needs 2+ members to mean
-- anything). Announce is inline + savepoint-guarded.
CREATE OR REPLACE FUNCTION public.record_lucky_pig_hit()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	src_name  text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	INSERT INTO public.lucky_pig_hits (user_id) VALUES (caller_id);

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NOT NULL
	   AND (SELECT count(*) FROM public.crew_members WHERE crew_id = my_crew) >= 2
	   AND NOT EXISTS (SELECT 1 FROM public.echo_events
	                   WHERE crew_id = my_crew AND created_at > now() - interval '10 minutes') THEN
		INSERT INTO public.echo_events (crew_id, source_user) VALUES (my_crew, caller_id);
		BEGIN
			SELECT username INTO src_name FROM public.profiles WHERE id = caller_id;
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			SELECT cm.user_id, 'echo', 'The bog echoes',
				COALESCE(src_name, 'A crewmate') || '''s pig hit a Lucky Pig — tap yours within 10 minutes to catch the echo.',
				jsonb_build_object('crew_id', my_crew)
			FROM public.crew_members cm
			WHERE cm.crew_id = my_crew AND cm.user_id <> caller_id;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	RETURN jsonb_build_object('ok', true);
END; $function$;

-- The caller's currently catchable echo (their crew, within 10 minutes,
-- not their own lucky, not yet claimed) — or ok:false-shaped null fields.
CREATE OR REPLACE FUNCTION public.active_echo()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE((
		SELECT jsonb_build_object(
			'id', e.id,
			'sourceName', (SELECT username FROM public.profiles WHERE id = e.source_user),
			'expiresAt', e.created_at + interval '10 minutes')
		FROM public.echo_events e
		JOIN public.crew_members cm ON cm.crew_id = e.crew_id AND cm.user_id = auth.uid()
		WHERE e.created_at > now() - interval '10 minutes'
		  AND e.source_user <> auth.uid()
		  AND NOT EXISTS (SELECT 1 FROM public.echo_claims c
		                  WHERE c.event_id = e.id AND c.user_id = auth.uid())
		ORDER BY e.created_at DESC LIMIT 1
	), 'null'::jsonb);
$function$;

CREATE OR REPLACE FUNCTION public.claim_echo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	ev        record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT e.* INTO ev
		FROM public.echo_events e
		JOIN public.crew_members cm ON cm.crew_id = e.crew_id AND cm.user_id = caller_id
		WHERE e.created_at > now() - interval '10 minutes'
		  AND e.source_user <> caller_id
		ORDER BY e.created_at DESC LIMIT 1;
	IF ev.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_echo'); END IF;
	BEGIN
		INSERT INTO public.echo_claims (event_id, user_id) VALUES (ev.id, caller_id);
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END;
	PERFORM public.grant_tickles(caller_id, 1);
	RETURN jsonb_build_object('ok', true, 'tickles', 1);
END; $function$;

-- ── FORFEIT ──────────────────────────────────────────────────────────
ALTER TABLE public.mud_wars ADD COLUMN IF NOT EXISTS forfeited_by uuid;

CREATE OR REPLACE FUNCTION public.forfeit_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	w         record;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	-- Yielding is the leader's call — it ends the scuffle for all five.
	SELECT c.id INTO my_crew FROM public.crews c
		WHERE c.leader_id = caller_id AND c.is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL OR (w.challenger_crew <> my_crew AND w.defender_crew <> my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_war');
	END IF;
	IF w.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_active'); END IF;

	UPDATE public.mud_wars SET forfeited_by = my_crew, ends_at = now() WHERE id = p_war;
	RETURN public.resolve_war(p_war);
END; $function$;

-- ── resolve_war — carried VERBATIM from 20260668 except:
--    (1) forfeited_by overrides the rope for the winner,
--    (2) winners are paid TICKLES ∝ own participation (slings + 3×digs,
--        cap 20 / bot 10) instead of snouts from the loser pot,
--    (3) announcement copy says Scuffle (+ forfeit flavor).
CREATE OR REPLACE FUNCTION public.resolve_war(p_war uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w           record;
	winner      uuid := NULL;
	m           record;
	reward      int;
	wins_now    int;
	c_rout      int := 12;
BEGIN
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;
	IF w.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no_war'); END IF;
	IF w.status <> 'active' OR w.resolved_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', true, 'noop', true);
	END IF;

	PERFORM public.score_mud_war_days(p_war);
	SELECT * INTO w FROM public.mud_wars WHERE id = p_war FOR UPDATE;

	IF w.forfeited_by IS NULL AND w.ends_at > now() AND ABS(w.rope_pos) < c_rout THEN
		RETURN jsonb_build_object('ok', true, 'not_yet', true, 'rope_pos', w.rope_pos);
	END IF;

	winner := CASE
		WHEN w.forfeited_by IS NOT NULL THEN
			CASE WHEN w.forfeited_by = w.challenger_crew THEN w.defender_crew ELSE w.challenger_crew END
		WHEN w.rope_pos > 0 THEN w.challenger_crew
		WHEN w.rope_pos < 0 THEN w.defender_crew
		ELSE NULL
	END;

	IF winner IS NOT NULL AND NOT (w.is_bot_war AND winner = w.defender_crew) THEN
		-- Participation-paid: each winner earns tickles for what THEY did —
		-- sling points ×1 + submitted truffle digs ×3, capped so a marathon
		-- week can't overflow the bank into pure waste.
		FOR m IN
			SELECT u.user_id, SUM(u.units)::int AS units FROM (
				SELECT user_id, SUM(slings)::int AS units FROM public.mud_slings
					WHERE war_id = p_war AND crew_id = winner GROUP BY user_id
				UNION ALL
				SELECT user_id, COUNT(*)::int * 3 FROM public.war_rootings
					WHERE war_id = p_war AND crew_id = winner AND submitted_at IS NOT NULL
					GROUP BY user_id
			) u GROUP BY u.user_id HAVING SUM(u.units) > 0
		LOOP
			reward := LEAST(m.units, CASE WHEN w.is_bot_war THEN 10 ELSE 20 END);
			PERFORM public.grant_tickles(m.user_id, reward);
			IF NOT w.is_bot_war THEN
				UPDATE public.profiles
					SET tickles_earned = tickles_earned + reward,
					    war_wins       = war_wins + 1
					WHERE id = m.user_id
					RETURNING war_wins INTO wins_now;
			END IF;
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			IF NOT w.is_bot_war THEN
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
			END IF;
		END LOOP;
	END IF;

	UPDATE public.mud_wars SET status = 'resolved', winner_crew = winner, resolved_at = now()
		WHERE id = p_war;

	-- Win-trade cooldown — REAL crew-vs-crew wars ONLY (carried).
	IF NOT w.is_bot_war THEN
		UPDATE public.crews SET next_war_at = now() + interval '24 hours'
			WHERE id IN (w.challenger_crew, w.defender_crew) AND is_bot = false;
	END IF;

	-- GATED: ladder update for real (non-bot) wars only (carried).
	IF w.fronts_enabled AND NOT w.is_bot_war THEN
		BEGIN
			PERFORM public.apply_crew_elo(w.challenger_crew, w.defender_crew, winner, w.rope_pos);
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	BEGIN
		FOR m IN SELECT user_id, crew_id FROM public.crew_members
		         WHERE crew_id = w.challenger_crew OR crew_id = w.defender_crew LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (m.user_id,
				CASE WHEN winner IS NULL THEN 'war_draw'
				     WHEN m.crew_id = winner THEN 'war_won' ELSE 'war_lost' END,
				CASE WHEN winner IS NULL THEN 'Mud Scuffle: a draw'
				     WHEN m.crew_id = winner THEN 'Mud Scuffle won!' ELSE 'Mud Scuffle lost' END,
				CASE WHEN winner IS NULL THEN 'The rope held dead even. Rally your Sounder next time.'
				     WHEN m.crew_id = winner AND w.forfeited_by IS NOT NULL
				          THEN 'Their Sounder yielded the bog — the scuffle is yours. Tickles paid for your digging and slinging.'
				     WHEN m.crew_id = winner
				          THEN 'Your Sounder dragged the rope home! Tickles paid for your digging and slinging, and a 72h regen buff is on you.'
				     WHEN w.forfeited_by IS NOT NULL
				          THEN 'Your Sounder yielded. No mud lost — regroup and return.'
				     ELSE 'Your Sounder lost the tug this time.' END,
				jsonb_build_object('war_id', p_war));
		END LOOP;
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'winner', winner, 'rope_pos', w.rope_pos,
		'routed', ABS(w.rope_pos) >= c_rout,
		'forfeited', w.forfeited_by IS NOT NULL);
END;
$function$;

-- ── MATCH HISTORY ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crew_match_history(p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
	SELECT COALESCE(jsonb_agg(q.j ORDER BY q.at DESC), '[]'::jsonb)
	FROM (
		SELECT jsonb_build_object(
			'war_id', w.id,
			'opponent', CASE
				WHEN w.is_bot_war THEN 'The Mudlarks'
				WHEN w.challenger_crew = me.crew_id
					THEN COALESCE((SELECT name FROM public.crews WHERE id = w.defender_crew), 'A vanished Sounder')
				ELSE COALESCE((SELECT name FROM public.crews WHERE id = w.challenger_crew), 'A vanished Sounder')
			END,
			'result', CASE
				WHEN w.winner_crew IS NULL THEN 'draw'
				WHEN w.winner_crew = me.crew_id THEN 'won'
				ELSE 'lost'
			END,
			'forfeited', w.forfeited_by IS NOT NULL,
			'yieldedByUs', w.forfeited_by = me.crew_id,
			'ropePos', w.rope_pos,
			'isBot', w.is_bot_war,
			'resolvedAt', w.resolved_at
		) AS j, w.resolved_at AS at
		FROM public.mud_wars w
		JOIN (SELECT crew_id FROM public.crew_members WHERE user_id = auth.uid()) me
		  ON w.challenger_crew = me.crew_id OR w.defender_crew = me.crew_id
		WHERE w.status = 'resolved'
		ORDER BY w.resolved_at DESC
		LIMIT GREATEST(1, LEAST(100, p_limit))
	) q;
$function$;

GRANT EXECUTE ON FUNCTION public.active_echo()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_echo()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.forfeit_war(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.crew_match_history(int)   TO authenticated;

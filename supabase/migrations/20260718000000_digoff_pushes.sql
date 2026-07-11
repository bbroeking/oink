-- ═══════════════════════════════════════════════════════════════════════════
-- DIG-OFF PUSHES + SWEEPER — the dig-off lifecycle becomes notification-based.
--
-- WHY: the versus loop spans 24h+ and both sides are mostly NOT in-app when the
-- interesting moments happen (challenged, clock started, resolved). The push
-- pipeline already exists: send_push_to_user (20260520050000, pg_net →
-- exp.host, fire-and-forget, silently no-ops without a token). Payload
-- convention copied from the existing callers (tickle_trades / friendships):
-- data = {kind, screen, ...} — the client's tap handler routes on data.screen
-- via utils/notificationRouting.ts; 'season' → /season (the dig-off lives on
-- the season tab).
--
-- WHAT — pushes at EXACTLY three moments (cozy filter: no hourly updates, no
-- ending-soon nags):
--   1. Challenge received  → the DEFENDER crew's LEADER only (challenge_crew_digoff)
--   2. Dig-off became ACTIVE → every member of BOTH crews, in all three
--      activation paths: find_rival instant pairing, the 30-min queue→bot
--      conversion (_digoff_queue_bot_fill), accept_digoff. Bot "members" are
--      skipped for free: the house bot crew has no crew_members rows.
--   3. Resolved → every member of both real crews, outcome-specific body, sent
--      AFTER the resolution bookkeeping in the same transaction (pg_net is
--      async; a push can never roll back a resolve — each send is also wrapped
--      in its own EXCEPTION guard, mirroring tickle_trades_push_notify).
--
-- Plus sweep_digoffs(): idempotent cron entry point (every 10 min) that runs
-- the SAME lazy helpers (resolve overdue actives, expire stale pendings,
-- bot-fill stale queue rows) so resolution/activation pushes fire on time when
-- nobody is in-app. Lazy resolution in digoff_state() etc. stays — the cron is
-- belt-and-braces, and both paths are idempotent/row-locked.
--
-- FOOTGUNS honored:
--   • carry-latest-def — find_rival / accept_digoff / challenge_crew_digoff /
--     _digoff_resolve_one / _digoff_queue_bot_fill carried VERBATIM from
--     20260715 (their latest defs; 20260716 touched only open/submit_rooting,
--     which this migration does not touch) with ONLY the push calls added.
--   • cron.schedule wrapped in the tolerate-pg_cron-absent guard (harness
--     stubs cron; prod has it).
--   • system_announcements INSERTs stay INLINE (admin-gated RPC footgun).
--   • Every push call is EXCEPTION-guarded: push failure never rolls back
--     game state.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Shared helper: "the dig-off is on" push to both rosters ───────────────
-- Fired from all three activation paths. The bot crew has no crew_members rows,
-- so bot dig-offs push to the real side only.
CREATE OR REPLACE FUNCTION public._digoff_push_active(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	d        record;
	m        record;
	opp_name text;
BEGIN
	SELECT * INTO d FROM public.dig_offs WHERE id = p_id;
	IF d.id IS NULL THEN RETURN; END IF;
	FOR m IN
		SELECT cm.user_id,
		       CASE WHEN cm.crew_id = d.crew_a THEN d.crew_b ELSE d.crew_a END AS opp_crew
		FROM public.crew_members cm
		WHERE cm.crew_id IN (d.crew_a, d.crew_b)
	LOOP
		SELECT name INTO opp_name FROM public.crews WHERE id = m.opp_crew;
		BEGIN
			PERFORM public.send_push_to_user(m.user_id,
				'The dig-off is on',
				'vs ' || COALESCE(opp_name, 'a rival Sounder') || ' — 24 hours. Every find counts.',
				jsonb_build_object('kind', 'digoff_active', 'dig_off_id', d.id::text,
					'screen', 'season'));
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;
END;
$function$;

-- ── 2. _digoff_queue_bot_fill — carried from 20260715; + activation push ─────
CREATE OR REPLACE FUNCTION public._digoff_queue_bot_fill(p_crew uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	BOT_ID    CONSTANT uuid := '00000000-0000-0000-0000-0000000000b0';
	QUEUE_BOT_AFTER CONSTANT interval := interval '1800 seconds';
	q      record;
	new_id uuid;
BEGIN
	SELECT * INTO q FROM public.digoff_queue WHERE crew_id = p_crew FOR UPDATE;
	IF q.crew_id IS NULL THEN RETURN NULL; END IF;
	IF now() < q.since + QUEUE_BOT_AFTER THEN RETURN NULL; END IF;
	DELETE FROM public.digoff_queue WHERE crew_id = p_crew;
	IF public._digoff_crew_busy(p_crew) THEN RETURN NULL; END IF;   -- stale row backstop
	INSERT INTO public.dig_offs (crew_a, crew_b, challenger_crew, status, is_bot, starts_at, ends_at)
		VALUES (p_crew, BOT_ID, p_crew, 'active', true, now(), now() + interval '24 hours')
		RETURNING id INTO new_id;
	PERFORM public._digoff_push_active(new_id);   -- push moment 2 (bot conversion path)
	RETURN new_id;
END;
$function$;

-- ── 3. find_rival — carried from 20260715; + activation push on pairing ──────
-- (The bot-conversion branch pushes inside _digoff_queue_bot_fill — no double.)
CREATE OR REPLACE FUNCTION public.find_rival()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	BOT_ID    CONSTANT uuid := '00000000-0000-0000-0000-0000000000b0';
	caller_id uuid := auth.uid();
	my_crew   uuid;
	my_roster int;
	opp_crew  uuid;
	opp_name  text;
	opp_roster int;
	new_id    uuid;
	ends      timestamptz := now() + interval '24 hours';
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT id INTO my_crew FROM public.crews
		WHERE leader_id = caller_id AND is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;

	PERFORM public._digoff_resolve_due(my_crew);
	IF public._digoff_crew_busy(my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_digoff');
	END IF;

	-- Already queued past the 30-min threshold? Convert to the bot match now
	-- (same lazy fill digoff_state performs) and hand back the fresh dig-off.
	new_id := public._digoff_queue_bot_fill(my_crew);
	IF new_id IS NOT NULL THEN
		SELECT ends_at INTO ends FROM public.dig_offs WHERE id = new_id;
		RETURN jsonb_build_object('ok', true, 'queued', false, 'matched', true, 'is_bot', true,
			'digoff_id', new_id,
			'dig_off', jsonb_build_object('id', new_id, 'status', 'active', 'is_bot', true,
				'i_am_side', 'a', 'ends_at', ends,
				'opponent', jsonb_build_object('crew_id', BOT_ID, 'name', 'The Mudlarks',
					'roster_size', 2, 'is_bot', true)));
	END IF;

	SELECT count(*) INTO my_roster FROM public.crew_members WHERE crew_id = my_crew;

	-- Announce that I'm looking, so a concurrent find_rival can pair with me.
	-- Re-tapping while already queued keeps the ORIGINAL since (the 30-min bot
	-- clock must not reset on every poll).
	INSERT INTO public.digoff_queue (crew_id, since, roster_size)
		VALUES (my_crew, now(), my_roster)
		ON CONFLICT (crew_id) DO UPDATE SET roster_size = EXCLUDED.roster_size;

	-- Prefer the closest-roster real crew that is looking + free.
	SELECT q.crew_id, c.name INTO opp_crew, opp_name
		FROM public.digoff_queue q JOIN public.crews c ON c.id = q.crew_id
		WHERE q.crew_id <> my_crew AND c.is_bot = false
		  AND NOT public._digoff_crew_busy(q.crew_id)
		ORDER BY abs(q.roster_size - my_roster) ASC, q.since ASC
		LIMIT 1;

	IF opp_crew IS NOT NULL THEN
		-- Pair two real crews — active now, 24h clock. Initiator is crew_a.
		DELETE FROM public.digoff_queue WHERE crew_id IN (my_crew, opp_crew);
		SELECT count(*) INTO opp_roster FROM public.crew_members WHERE crew_id = opp_crew;
		INSERT INTO public.dig_offs (crew_a, crew_b, challenger_crew, status, is_bot, starts_at, ends_at)
			VALUES (my_crew, opp_crew, my_crew, 'active', false, now(), ends)
			RETURNING id INTO new_id;
		PERFORM public._digoff_push_active(new_id);   -- push moment 2 (instant pairing)
		RETURN jsonb_build_object('ok', true, 'queued', false, 'matched', true, 'is_bot', false,
			'digoff_id', new_id,
			'dig_off', jsonb_build_object('id', new_id, 'status', 'active', 'is_bot', false,
				'i_am_side', 'a', 'ends_at', ends,
				'opponent', jsonb_build_object('crew_id', opp_crew, 'name', opp_name,
					'roster_size', opp_roster, 'is_bot', false)));
	END IF;

	-- Empty pool → stay in the pool and wait for a real rival. The 30-minute bot
	-- fallback fires lazily (digoff_state / a later find_rival). since is the
	-- row's ORIGINAL enqueue time, so the client can render the wait.
	RETURN jsonb_build_object('ok', true, 'queued', true, 'matched', false,
		'since', (SELECT since FROM public.digoff_queue WHERE crew_id = my_crew),
		'bot_after_secs', 1800);   -- DIGOFF_QUEUE_BOT_AFTER_SECS
END;
$function$;
REVOKE ALL ON FUNCTION public.find_rival() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_rival() TO authenticated;

-- ── 4. challenge_crew_digoff — carried from 20260715; + defender-leader push ─
CREATE OR REPLACE FUNCTION public.challenge_crew_digoff(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
	my_name   text;
	target    record;
	new_id    uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT id, name INTO my_crew, my_name FROM public.crews
		WHERE leader_id = caller_id AND is_bot = false FOR UPDATE;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	IF p_crew = my_crew THEN RETURN jsonb_build_object('ok', false, 'reason', 'self'); END IF;

	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

	PERFORM public._digoff_resolve_due(my_crew);
	PERFORM public._digoff_resolve_due(p_crew);
	IF public._digoff_crew_busy(my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_digoff');
	END IF;
	IF public._digoff_crew_busy(p_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'target_busy');
	END IF;

	-- Pending: 24h clock starts on ACCEPT, not now. starts_at/ends_at NULL.
	INSERT INTO public.dig_offs (crew_a, crew_b, challenger_crew, status, is_bot)
		VALUES (my_crew, p_crew, my_crew, 'pending', false)
		RETURNING id INTO new_id;

	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (target.leader_id, 'digoff_challenge', 'A snout in the mud',
			my_name || ' has called your Sounder to a dig-off. Answer within a day, or it fades.',
			jsonb_build_object('dig_off_id', new_id, 'challenger_crew', my_crew));
	EXCEPTION WHEN OTHERS THEN NULL; END;

	-- Push moment 1: the DEFENDER's leader only (they hold the accept button).
	BEGIN
		PERFORM public.send_push_to_user(target.leader_id,
			'A rival calls you out',
			my_name || ' wants a dig-off — a day of digging, herd vs herd.',
			jsonb_build_object('kind', 'digoff_challenge', 'dig_off_id', new_id::text,
				'screen', 'season'));
	EXCEPTION WHEN OTHERS THEN NULL; END;

	RETURN jsonb_build_object('ok', true, 'digoff_id', new_id, 'status', 'pending');
END;
$function$;
REVOKE ALL ON FUNCTION public.challenge_crew_digoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_crew_digoff(uuid) TO authenticated;

-- ── 5. accept_digoff — carried from 20260715; + activation push ──────────────
CREATE OR REPLACE FUNCTION public.accept_digoff(p_digoff uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	d         record;
	is_leader boolean;
	ends      timestamptz := now() + interval '24 hours';
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;

	SELECT * INTO d FROM public.dig_offs WHERE id = p_digoff FOR UPDATE;
	IF d.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

	-- Lazy expiry: a 24h-stale pending is silently gone.
	IF d.status = 'pending' AND now() >= d.created_at + interval '24 hours' THEN
		UPDATE public.dig_offs SET status = 'expired', resolved_at = now() WHERE id = d.id;
		RETURN jsonb_build_object('ok', false, 'reason', 'expired');
	END IF;
	IF d.status <> 'pending' THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_pending'); END IF;

	-- Only the DEFENDER's leader (crew_b) may accept.
	SELECT (leader_id = caller_id) INTO is_leader FROM public.crews WHERE id = d.crew_b;
	IF NOT COALESCE(is_leader, false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_defender');
	END IF;

	UPDATE public.dig_offs
		SET status = 'active', starts_at = now(), ends_at = ends
		WHERE id = d.id;
	-- Both crews leave the looking pool if they happened to be in it.
	DELETE FROM public.digoff_queue WHERE crew_id IN (d.crew_a, d.crew_b);

	PERFORM public._digoff_push_active(d.id);   -- push moment 2 (challenge accepted)

	RETURN jsonb_build_object('ok', true, 'digoff_id', d.id, 'status', 'active', 'ends_at', ends);
END;
$function$;
REVOKE ALL ON FUNCTION public.accept_digoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_digoff(uuid) TO authenticated;

-- ── 6. _digoff_resolve_one — carried from 20260715; + resolution pushes ──────
CREATE OR REPLACE FUNCTION public._digoff_resolve_one(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	-- Bot pace (see 20260715 header). per-snout avg = FINDS_PER_WINDOW × WINDOWS = 6.
	BOT_SNOUTS          CONSTANT int := 2;
	BOT_FINDS_PER_WIN   CONSTANT int := 2;
	DIGOFF_WINDOWS      CONSTANT int := 3;
	DIGOFF_QUORUM       CONSTANT int := 2;
	DIGOFF_WIN_TRUFFLE_MAX CONSTANT int := 3;
	d          record;
	sa         jsonb;  sb jsonb;
	avg_a      numeric := 0;  avg_b numeric := 0;
	cnt_a      int := 0;      cnt_b int := 0;
	a_ok       boolean;  b_ok boolean;
	v_outcome  text;
	winner     uuid := NULL;
	m          record;
	w_windows  int;
BEGIN
	SELECT * INTO d FROM public.dig_offs WHERE id = p_id FOR UPDATE;
	IF d.id IS NULL THEN RETURN; END IF;

	-- Pending: silently expire after 24h; otherwise leave it for the defender.
	-- (Expiry stays push-free — cozy: no rejection moment, no fade notice.)
	IF d.status = 'pending' THEN
		IF now() >= d.created_at + interval '24 hours' THEN
			UPDATE public.dig_offs SET status = 'expired', resolved_at = now() WHERE id = p_id;
		END IF;
		RETURN;
	END IF;

	IF d.status <> 'active' THEN RETURN; END IF;   -- already resolved/expired
	IF now() < d.ends_at THEN RETURN; END IF;      -- not due yet

	-- Per-side stats. Bot side (always crew_b for bot dig-offs) is synthesized.
	sa := public._digoff_side_stats(d.id, d.crew_a);
	avg_a := (sa->>'avg')::numeric;  cnt_a := (sa->>'diggers')::int;
	IF d.is_bot THEN
		avg_b := BOT_FINDS_PER_WIN * DIGOFF_WINDOWS;   -- 6
		cnt_b := BOT_SNOUTS;                            -- quorate
	ELSE
		sb := public._digoff_side_stats(d.id, d.crew_b);
		avg_b := (sb->>'avg')::numeric;  cnt_b := (sb->>'diggers')::int;
	END IF;

	a_ok := cnt_a >= DIGOFF_QUORUM;
	b_ok := cnt_b >= DIGOFF_QUORUM;

	IF NOT a_ok AND NOT b_ok THEN
		v_outcome := 'unanswered';
	ELSIF a_ok AND NOT b_ok THEN
		v_outcome := 'a'; winner := d.crew_a;
	ELSIF b_ok AND NOT a_ok THEN
		v_outcome := 'b'; winner := d.crew_b;
	ELSE
		IF avg_a > avg_b THEN v_outcome := 'a'; winner := d.crew_a;
		ELSIF avg_b > avg_a THEN v_outcome := 'b'; winner := d.crew_b;
		ELSE v_outcome := 'draw'; winner := NULL;   -- equal averages → draw
		END IF;
	END IF;

	-- ── Payouts ──────────────────────────────────────────────────────────────
	IF v_outcome IN ('a', 'b') THEN
		-- Winners: glow all members; +1 truffle per personal window dug (max 3),
		-- but NEVER in a bot dig-off (bot dig-offs = glow only).
		FOR m IN SELECT user_id FROM public.crew_members WHERE crew_id = winner LOOP
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			IF NOT d.is_bot THEN
				SELECT LEAST(DIGOFF_WIN_TRUFFLE_MAX, count(DISTINCT window_index))::int INTO w_windows
					FROM public.dig_off_digs WHERE dig_off_id = d.id AND user_id = m.user_id;
				IF COALESCE(w_windows, 0) > 0 THEN
					PERFORM public.mint_truffles(m.user_id, w_windows, 'digoff_win', NULL);
					BEGIN PERFORM public.try_claim_achievements(m.user_id, 'truffles_dug');
					EXCEPTION WHEN OTHERS THEN NULL; END;
				END IF;
			END IF;
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'digoff_win', 'The dig-off is yours',
					'Your Sounder out-rooted the other snouts. The winner''s glow warms you for three days.',
					jsonb_build_object('dig_off_id', d.id, 'is_bot', d.is_bot));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
		-- Losing side (real members only; the bot has none).
		FOR m IN SELECT user_id FROM public.crew_members
			WHERE crew_id = (CASE WHEN winner = d.crew_a THEN d.crew_b ELSE d.crew_a END) LOOP
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'digoff_loss', 'The dig-off slipped away',
					'The other Sounder rooted deeper this time. No mud lost — the patch refills.',
					jsonb_build_object('dig_off_id', d.id));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	ELSIF v_outcome = 'draw' THEN
		-- Both sides glow, no truffle bonus.
		FOR m IN SELECT user_id FROM public.crew_members
			WHERE crew_id IN (d.crew_a, d.crew_b) LOOP
			BEGIN
				INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
					VALUES (m.user_id, m.user_id, 'war_winner_regen', now() + interval '72 hours');
			EXCEPTION WHEN OTHERS THEN NULL; END;
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'digoff_draw', 'A dead heat',
					'Snout for snout, the two Sounders rooted even. Both barns glow tonight.',
					jsonb_build_object('dig_off_id', d.id));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	ELSE   -- unanswered: no payout
		FOR m IN SELECT user_id FROM public.crew_members
			WHERE crew_id IN (d.crew_a, d.crew_b) LOOP
			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'digoff_unanswered', 'The dig-off went quiet',
					'Too few snouts turned up to call it. No winner — but the spoiled feast still fed the Hungerer.',
					jsonb_build_object('dig_off_id', d.id));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END IF;

	-- Record the result + slam BOTH banked pots into the hunger meter at once.
	UPDATE public.dig_offs
		SET status = 'resolved', outcome = v_outcome, winner_crew = winner, resolved_at = now()
		WHERE id = d.id;
	UPDATE public.hunger_drain SET total = total + d.pot_a + d.pot_b WHERE id = true;

	-- Push moment 3: AFTER the resolution bookkeeping — one outcome-specific
	-- push per member of both real crews (bot crew has no member rows).
	FOR m IN SELECT cm.user_id, cm.crew_id FROM public.crew_members cm
		WHERE cm.crew_id IN (d.crew_a, d.crew_b)
	LOOP
		BEGIN
			PERFORM public.send_push_to_user(m.user_id,
				'The dig-off has ended',
				CASE
					WHEN v_outcome = 'draw'       THEN 'An even match — both herds feast.'
					WHEN v_outcome = 'unanswered' THEN 'The dig-off went quiet — no result.'
					WHEN m.crew_id = winner       THEN 'The feast is spoiled — and the day is yours.'
					ELSE 'They out-dug you — but every find still starved him.'
				END,
				jsonb_build_object('kind', 'digoff_resolved', 'dig_off_id', d.id::text,
					'outcome', v_outcome, 'screen', 'season'));
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;
END;
$function$;

-- ── 7. sweep_digoffs() — idempotent cron entry point ─────────────────────────
-- Reuses the SAME lazy helpers the in-app readers use (row-locked, idempotent),
-- so the only thing the cron adds is timeliness: resolution + bot-activation
-- pushes fire within 10 minutes even when nobody opens the app.
CREATE OR REPLACE FUNCTION public.sweep_digoffs()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	r        record;
	n_due    int := 0;
	n_filled int := 0;
BEGIN
	-- Overdue actives → resolve; stale pendings → expire (both via the shared
	-- resolver, which re-checks due-ness under its own row lock).
	FOR r IN SELECT id FROM public.dig_offs
		WHERE (status = 'active'  AND ends_at <= now())
		   OR (status = 'pending' AND created_at + interval '24 hours' <= now())
	LOOP
		PERFORM public._digoff_resolve_one(r.id);
		n_due := n_due + 1;
	END LOOP;

	-- Stale queue rows → bot dig-off (30-min threshold re-checked inside).
	FOR r IN SELECT crew_id FROM public.digoff_queue
		WHERE since + interval '1800 seconds' <= now()   -- DIGOFF_QUEUE_BOT_AFTER_SECS
	LOOP
		PERFORM public._digoff_queue_bot_fill(r.crew_id);
		n_filled := n_filled + 1;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'swept', n_due, 'bot_filled', n_filled);
END;
$function$;
-- Cron-only entry point: not callable from clients.
REVOKE ALL ON FUNCTION public.sweep_digoffs() FROM PUBLIC, anon, authenticated;

-- Every 10 minutes. cron.schedule upserts by job name, so re-applying is safe.
-- Tolerate pg_cron being absent (the plain-postgres harness stubs cron.*).
DO $$ BEGIN
	PERFORM cron.schedule('digoff-sweep', '*/10 * * * *', 'SELECT public.sweep_digoffs()');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

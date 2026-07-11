-- ═══════════════════════════════════════════════════════════════════════════
-- THE DIG-OFF — a minimal Sounder-vs-Sounder versus layer on top of the co-op
-- dig (20260714000000_coop_dig_rebuild). 24h skirmish = 3 feeding windows.
--
-- WHAT: two initiation doors, both LEADER-ONLY —
--   • find_rival()            quick match: pair INSTANTLY with a crew already
--                             "looking" in the pool (closest roster size); empty
--                             pool → JOIN the pool and return {queued:true}. A
--                             queued crew waits up to 30 minutes for a real
--                             rival, then the queue row lazily converts into an
--                             active BOT dig-off — checked in digoff_state()
--                             and on a repeat find_rival() call (same lazy
--                             pattern as pending expiry; small population means
--                             two crews searching minutes apart should meet).
--                             + cancel_rival_search() to leave the pool.
--   • challenge_crew_digoff() direct, named challenge → 'pending'; the DEFENDER's
--                             leader calls accept_digoff() → 'active', clock runs.
--                             No decline RPC (cozy). Pending expires lazily @24h.
-- SCORE: finds per DIGGING snout = SUM(finds)/COUNT(DISTINCT diggers), quorum 2
--   diggers/side. Neither quorate → 'unanswered' (no winner/payout). One quorate
--   → that side wins. Both quorate → higher avg wins; equal → 'draw'.
-- BANKED DRAIN: while a crew is inside an ACTIVE dig-off covering now,
--   submit_rooting BANKS credited finds into the dig-off pot (per-user) INSTEAD
--   of touching hunger_drain. At resolution BOTH pots slam hunger_drain in one
--   chunk ("the feast spoiled"). Milestones + truffle minting are UNAFFECTED.
-- RESOLUTION is LAZY (repo pattern): the first reader after ends_at resolves it,
--   row-locked + idempotent. Winners: +1 Golden Truffle per feeding window they
--   personally dug (max +3, reason 'digoff_win') + the war_winner_regen glow
--   (×0.85 / 72h). BOT dig-offs: glow only, NO truffles. Draw: glow both, no
--   truffles. Unanswered: no payout, pots still drain.
--
-- FOOTGUNS honored:
--   • carry-latest-def — submit_rooting + join/leave/kick are carried VERBATIM
--     from 20260714 with ONLY the banking branch / the single war-gate added.
--   • system_announcements INSERTs are INLINE (send_system_announcement() is
--     admin-gated → silent rollback for users).
--   • the house bot crew (00000000-0000-0000-0000-0000000000b0, 'The Mudlarks',
--     is_bot=true) survives from 20260647; re-seeded ON CONFLICT DO NOTHING so
--     the plain-postgres harness (which never seeded it) can exercise the bot.
--   • war_truffles.reason has NO CHECK constraint (verified) → no CHECK to
--     extend; 'digoff_win' is just a new reason string. war_winner_regen is
--     already in the live blessings_kind_check (20260704900000) → no extend.
--
-- CONSTANTS (must match client constants/dig.ts, extended concurrently):
--   DIGOFF_HOURS                = 24   (3 × 8h feeding windows)
--   DIGOFF_QUORUM               = 2    (distinct digging snouts per side)
--   DIGOFF_WIN_TRUFFLE_MAX      = 3    (+1 bonus truffle per personal window, capped)
--   DIGOFF_QUEUE_BOT_AFTER_SECS = 1800 (queued 30 min without a rival → bot fill)
--   Bot pace (documented): DIGOFF_BOT_SNOUTS = 2, DIGOFF_BOT_FINDS_PER_WINDOW = 2,
--     DIGOFF_WINDOWS = 3 → bot per-snout avg = 2×3 = 6 finds/24h, quorate at 2
--     snouts. A casual 2-pig crew digging all 3 windows at ~2-3 finds/dig lands
--     an avg of ~7-9 > 6 and slightly beats the bot; a 1-pig crew is sub-quorum.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Data model ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dig_offs (
	id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	crew_a          uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,   -- challenger side
	crew_b          uuid NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,   -- defender side (bot for bot dig-offs)
	challenger_crew uuid NOT NULL,
	status          text NOT NULL DEFAULT 'pending'
		CHECK (status IN ('pending', 'active', 'resolved', 'expired')),
	winner_crew     uuid,                                       -- NULL for draw / unanswered / expired
	outcome         text CHECK (outcome IN ('a', 'b', 'draw', 'unanswered')),
	is_bot          bool NOT NULL DEFAULT false,
	created_at      timestamptz NOT NULL DEFAULT now(),
	starts_at       timestamptz,                                -- NULL until active (accept / pair)
	ends_at         timestamptz,
	resolved_at     timestamptz,
	pot_a           int NOT NULL DEFAULT 0,
	pot_b           int NOT NULL DEFAULT 0
);
ALTER TABLE public.dig_offs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View dig-offs of either crew" ON public.dig_offs;
CREATE POLICY "View dig-offs of either crew" ON public.dig_offs FOR SELECT
	USING (public.is_crew_member(crew_a, auth.uid())
	    OR public.is_crew_member(crew_b, auth.uid()));

-- Backstop for the "one pending/active per crew" invariant (the SECURITY DEFINER
-- guard _digoff_crew_busy is the real enforcer, since these two indexes can't
-- catch a crew that is crew_a in one row and crew_b in another). The bot is
-- crew_b in EVERY bot dig-off, so it MUST be excluded from the crew_b index.
CREATE UNIQUE INDEX IF NOT EXISTS dig_offs_one_open_a
	ON public.dig_offs (crew_a) WHERE status IN ('pending', 'active');
CREATE UNIQUE INDEX IF NOT EXISTS dig_offs_one_open_b
	ON public.dig_offs (crew_b)
	WHERE status IN ('pending', 'active')
	  AND crew_b <> '00000000-0000-0000-0000-0000000000b0'::uuid;

-- Per-user banked finds, keyed to the feeding window (powers per-snout scoring,
-- quorum, and the participation-scaled truffle bonus). Rows persist after
-- resolve so digoff_state history can recompute final averages.
CREATE TABLE IF NOT EXISTS public.dig_off_digs (
	dig_off_id   uuid   NOT NULL REFERENCES public.dig_offs(id) ON DELETE CASCADE,
	user_id      uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	window_index bigint NOT NULL,
	crew_id      uuid   NOT NULL,
	finds        int    NOT NULL DEFAULT 0,
	PRIMARY KEY (dig_off_id, user_id, window_index)
);
CREATE INDEX IF NOT EXISTS dig_off_digs_side_idx ON public.dig_off_digs (dig_off_id, crew_id);
ALTER TABLE public.dig_off_digs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View digs of your dig-off" ON public.dig_off_digs;
CREATE POLICY "View digs of your dig-off" ON public.dig_off_digs FOR SELECT
	USING (EXISTS (SELECT 1 FROM public.dig_offs o WHERE o.id = dig_off_id
		AND (public.is_crew_member(o.crew_a, auth.uid())
		  OR public.is_crew_member(o.crew_b, auth.uid()))));

-- Looking pool for find_rival. A crew sits here for up to 30 minutes
-- (DIGOFF_QUEUE_BOT_AFTER_SECS) waiting for a real rival; then the row lazily
-- converts to a bot dig-off. cancel_rival_search clears it.
CREATE TABLE IF NOT EXISTS public.digoff_queue (
	crew_id     uuid        PRIMARY KEY REFERENCES public.crews(id) ON DELETE CASCADE,
	since       timestamptz NOT NULL DEFAULT now(),
	roster_size int         NOT NULL DEFAULT 1
);
ALTER TABLE public.digoff_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View your crew's search" ON public.digoff_queue;
CREATE POLICY "View your crew's search" ON public.digoff_queue FOR SELECT
	USING (public.is_crew_member(crew_id, auth.uid()));

-- ── 2. Re-seed the house bot crew (idempotent; survives in prod) ─────────────
INSERT INTO public.crews (id, name, is_bot, leader_id)
	VALUES ('00000000-0000-0000-0000-0000000000b0', 'The Mudlarks', true, NULL)
	ON CONFLICT (id) DO NOTHING;

-- ── 3. Guard: is a crew already committed to a pending/active dig-off? ───────
CREATE OR REPLACE FUNCTION public._digoff_crew_busy(p_crew uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.dig_offs
		WHERE status IN ('pending', 'active')
		  AND (crew_a = p_crew OR crew_b = p_crew));
$function$;

-- ── 4. Per-side live/final stats (SUM(finds) / COUNT(DISTINCT diggers)) ──────
-- Real crews only; the bot side is synthesized by callers from the constants.
CREATE OR REPLACE FUNCTION public._digoff_side_stats(p_id uuid, p_crew uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object(
		'avg', CASE WHEN count(DISTINCT d.user_id) > 0
			THEN round(sum(d.finds)::numeric / count(DISTINCT d.user_id), 2)
			ELSE 0 END,
		'diggers',     count(DISTINCT d.user_id)::int,
		'total_finds', COALESCE(sum(d.finds), 0)::int,
		'members', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'user_id', x.user_id, 'display_name', p.username,
				'finds', x.finds, 'windows_dug', x.windows) ORDER BY x.finds DESC)
			FROM (
				SELECT user_id, sum(finds)::int AS finds,
				       count(DISTINCT window_index)::int AS windows
				FROM public.dig_off_digs
				WHERE dig_off_id = p_id AND crew_id = p_crew
				GROUP BY user_id
			) x JOIN public.profiles p ON p.id = x.user_id
		), '[]'::jsonb))
	FROM public.dig_off_digs d
	WHERE d.dig_off_id = p_id AND d.crew_id = p_crew;
$function$;

-- ── 5. Lazy resolve / expire ONE dig-off (row-locked, idempotent) ────────────
CREATE OR REPLACE FUNCTION public._digoff_resolve_one(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	-- Bot pace (see header). per-snout avg = FINDS_PER_WINDOW × WINDOWS = 6.
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
END;
$function$;

-- ── 6. Sweep a crew's past-due dig-offs (resolve/expire) before any read ─────
CREATE OR REPLACE FUNCTION public._digoff_resolve_due(p_crew uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
	FOR r IN SELECT id FROM public.dig_offs
		WHERE (crew_a = p_crew OR crew_b = p_crew) AND status IN ('pending', 'active')
	LOOP
		PERFORM public._digoff_resolve_one(r.id);
	END LOOP;
END;
$function$;

-- ── 6b. Lazy bot fill: a crew queued past the threshold gets the house bot ───
-- Returns the new dig-off id (NULL if not queued / not due / crew became busy).
-- Row-locked on the queue row so a concurrent digoff_state + find_rival can't
-- double-fill. MUST match client DIGOFF_QUEUE_BOT_AFTER_SECS = 1800.
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
	RETURN new_id;
END;
$function$;

-- ── 7. find_rival() — quick match (leader only) ─────────────────────────────
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

-- ── 8. cancel_rival_search() — leave the looking pool (leader only) ─────────
CREATE OR REPLACE FUNCTION public.cancel_rival_search()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	my_crew   uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	SELECT id INTO my_crew FROM public.crews WHERE leader_id = caller_id AND is_bot = false;
	IF my_crew IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_leader'); END IF;
	DELETE FROM public.digoff_queue WHERE crew_id = my_crew;
	RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.cancel_rival_search() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_rival_search() TO authenticated;

-- ── 9. challenge_crew_digoff(p_crew) — direct challenge (leader only) ───────
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

	RETURN jsonb_build_object('ok', true, 'digoff_id', new_id, 'status', 'pending');
END;
$function$;
REVOKE ALL ON FUNCTION public.challenge_crew_digoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_crew_digoff(uuid) TO authenticated;

-- ── 10. accept_digoff(p_digoff) — defender's leader answers → active ────────
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

	RETURN jsonb_build_object('ok', true, 'digoff_id', d.id, 'status', 'active', 'ends_at', ends);
END;
$function$;
REVOKE ALL ON FUNCTION public.accept_digoff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_digoff(uuid) TO authenticated;

-- ── 11. digoff_state() — caller's live dig-off + last 10 resolved (lazy) ────
-- VOLATILE (not STABLE like feeding_state/crew_state): it lazily resolves/expires
-- past-due rows on read, which writes.
CREATE OR REPLACE FUNCTION public.digoff_state()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	BOT_ID    CONSTANT uuid := '00000000-0000-0000-0000-0000000000b0';
	caller_id uuid := auth.uid();
	my_crew   uuid;
	d         record;
	mine      jsonb;
	theirs    jsonb;
	my_side   text;
	their_side text;
	my_pot    int;
	their_pot int;
	their_crew uuid;
	their_name text;
	their_roster int;
	digoff    jsonb := NULL;
	history   jsonb := '[]'::jsonb;
	queued    boolean := false;
	q_since   timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('digoff', NULL, 'queued', false, 'history', history);
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('digoff', NULL, 'queued', false, 'history', history);
	END IF;

	-- Lazy resolve/expire any past-due rows before we read; then, if the crew
	-- has been queued past the 30-min threshold, lazily convert the queue row
	-- into an active bot dig-off (picked up by the live-row read below).
	PERFORM public._digoff_resolve_due(my_crew);
	PERFORM public._digoff_queue_bot_fill(my_crew);
	SELECT true, since INTO queued, q_since
		FROM public.digoff_queue WHERE crew_id = my_crew;
	queued := COALESCE(queued, false);

	-- The one live (pending/active) dig-off, if any.
	SELECT * INTO d FROM public.dig_offs
		WHERE status IN ('pending', 'active')
		  AND (crew_a = my_crew OR crew_b = my_crew)
		LIMIT 1;
	IF d.id IS NOT NULL THEN
		-- Challenger/initiator is always crew_a ('a'); defender/matched is crew_b.
		IF d.crew_a = my_crew THEN
			my_side := 'a'; their_side := 'b'; their_crew := d.crew_b;
			my_pot := d.pot_a; their_pot := d.pot_b;
		ELSE
			my_side := 'b'; their_side := 'a'; their_crew := d.crew_a;
			my_pot := d.pot_b; their_pot := d.pot_a;
		END IF;

		mine := public._digoff_side_stats(d.id, my_crew)
			|| jsonb_build_object('crew_id', my_crew, 'side', my_side, 'pot', my_pot);

		SELECT name INTO their_name FROM public.crews WHERE id = their_crew;
		SELECT count(*) INTO their_roster FROM public.crew_members WHERE crew_id = their_crew;
		IF d.is_bot THEN
			-- Bot side synthesized (pace: 2 snouts × 2 finds × 3 windows = avg 6).
			their_roster := 2;
			theirs := jsonb_build_object('avg', 6, 'diggers', 2, 'total_finds', 12,
				'members', '[]'::jsonb, 'crew_id', their_crew, 'side', their_side,
				'pot', their_pot, 'roster_size', their_roster);
		ELSE
			theirs := public._digoff_side_stats(d.id, their_crew) || jsonb_build_object(
				'crew_id', their_crew, 'side', their_side, 'pot', their_pot,
				'roster_size', their_roster);
		END IF;

		digoff := jsonb_build_object(
			'id', d.id, 'status', d.status, 'is_bot', d.is_bot,
			'created_at', d.created_at, 'starts_at', d.starts_at, 'ends_at', d.ends_at,
			'i_am_side', my_side,                          -- 'b' on a pending row = incoming challenge
			'i_challenged', (d.challenger_crew = my_crew),
			'opponent', jsonb_build_object('crew_id', their_crew, 'name', their_name,
				'roster_size', their_roster, 'is_bot', d.is_bot),
			'mine', mine, 'theirs', theirs);
	END IF;

	-- Last 10 resolved. RAW outcome ('a'/'b'/'draw'/'unanswered') + crew ids +
	-- i_am_side so the client computes outcome_for_me itself; 'result' is a
	-- convenience mirror (win/loss/draw/unanswered relative to the caller).
	SELECT COALESCE(jsonb_agg(h ORDER BY h_resolved DESC), '[]'::jsonb) INTO history FROM (
		SELECT
			jsonb_build_object(
				'id', o.id,
				'i_am_side',        CASE WHEN o.crew_a = my_crew THEN 'a' ELSE 'b' END,
				'outcome',          o.outcome,               -- raw 'a' | 'b' | 'draw' | 'unanswered'
				'winner_crew',      o.winner_crew,
				'crew_a',           o.crew_a,
				'crew_b',           o.crew_b,
				'opponent_crew_id', CASE WHEN o.crew_a = my_crew THEN o.crew_b ELSE o.crew_a END,
				'opponent_name', (SELECT name FROM public.crews WHERE id =
					CASE WHEN o.crew_a = my_crew THEN o.crew_b ELSE o.crew_a END),
				'is_bot', o.is_bot,
				'result', CASE
					WHEN o.outcome = 'draw'       THEN 'draw'
					WHEN o.outcome = 'unanswered' THEN 'unanswered'
					WHEN o.winner_crew = my_crew  THEN 'win'
					ELSE 'loss' END,
				'my_avg', (public._digoff_side_stats(o.id, my_crew)->>'avg')::numeric,
				'their_avg', CASE WHEN o.is_bot THEN 6::numeric
					ELSE (public._digoff_side_stats(o.id,
						CASE WHEN o.crew_a = my_crew THEN o.crew_b ELSE o.crew_a END)->>'avg')::numeric END,
				'resolved_at', o.resolved_at
			) AS h,
			o.resolved_at AS h_resolved
		FROM public.dig_offs o
		WHERE o.status = 'resolved' AND (o.crew_a = my_crew OR o.crew_b = my_crew)
		ORDER BY o.resolved_at DESC
		LIMIT 10
	) sub;

	RETURN jsonb_build_object('digoff', digoff, 'queued', queued,
		'queued_since', q_since, 'history', history);
END;
$function$;
REVOKE ALL ON FUNCTION public.digoff_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.digoff_state() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. submit_rooting — carried VERBATIM from 20260714000000 with ONE change:
--     the hunger_drain UPDATE now BANKS into an active dig-off pot when the
--     crew is mid-skirmish (carry-latest-def footgun: only the drain branch +
--     its DECLAREs + two return keys are new; everything else is identical).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	my_crew     uuid;
	win         bigint := floor(extract(epoch FROM now()) / 28800)::bigint;
	row_r       record;
	valid       text[];
	claimed     text[];
	f           text;
	truffle_cnt int := 0;
	n_credited  int := 0;
	prior_cnt   int;
	minted      int := 0;
	my_echo     boolean := false;
	blessed     boolean := false;
	r           record;
	echo_names  text[];
	drain_total bigint;
	old_life    bigint;
	new_life    bigint;
	milestone   jsonb := NULL;
	t           record;
	landed      int;
	mem         record;
	active_do   record;   -- NEW: the crew's active dig-off covering now (banking)
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN RAISE EXCEPTION 'no_crew'; END IF;

	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RAISE EXCEPTION 'bad_actions';
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win FOR UPDATE;
	IF row_r.user_id IS NULL THEN RAISE EXCEPTION 'no_open_rooting'; END IF;
	IF row_r.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'already_rooted'; END IF;

	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		IF NOT (f = ANY (valid)) THEN RAISE EXCEPTION 'bad_finds'; END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	n_credited := COALESCE(array_length(claimed, 1), 0);

	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > now());
	IF truffle_cnt >= 1 THEN
		minted := public.mint_truffles(caller_id, 1, 'dig', NULL);
		IF prior_cnt >= 1 THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'dig_echo', NULL);
			my_echo := true;
		END IF;
		IF blessed THEN
			minted := minted + public.mint_truffles(caller_id, 1, 'blessed_dig', NULL);
		END IF;
	END IF;

	FOR r IN SELECT user_id FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL
		  AND echo_credited = false AND truffles_minted >= 1
	LOOP
		PERFORM public.mint_truffles(r.user_id, 1, 'dig_echo', NULL);
		UPDATE public.war_rootings SET echo_credited = true,
			truffles_minted = truffles_minted + 1
			WHERE user_id = r.user_id AND window_index = win;
		BEGIN PERFORM public.try_claim_achievements(r.user_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;

	IF minted > 0 THEN
		BEGIN PERFORM public.try_claim_achievements(caller_id, 'truffles_dug');
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END IF;

	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- ── DRAIN vs BANK ────────────────────────────────────────────────────────
	-- If this crew is inside an ACTIVE dig-off covering right now, credited finds
	-- are BANKED into the dig-off pot (per-user, per-window) and slam
	-- hunger_drain all at once at resolution. Otherwise drain instantly (today's
	-- behavior). Lifetime herd + milestones + truffle minting are unaffected.
	SELECT * INTO active_do FROM public.dig_offs
		WHERE status = 'active' AND starts_at <= now() AND ends_at > now()
		  AND (crew_a = my_crew OR crew_b = my_crew)
		ORDER BY starts_at DESC LIMIT 1 FOR UPDATE;
	IF active_do.id IS NOT NULL THEN
		IF active_do.crew_a = my_crew THEN
			UPDATE public.dig_offs SET pot_a = pot_a + n_credited WHERE id = active_do.id;
		ELSE
			UPDATE public.dig_offs SET pot_b = pot_b + n_credited WHERE id = active_do.id;
		END IF;
		INSERT INTO public.dig_off_digs (dig_off_id, user_id, window_index, crew_id, finds)
			VALUES (active_do.id, caller_id, win, my_crew, n_credited)
			ON CONFLICT (dig_off_id, user_id, window_index)
			DO UPDATE SET finds = public.dig_off_digs.finds + EXCLUDED.finds;
		SELECT total INTO drain_total FROM public.hunger_drain WHERE id = true;   -- unchanged (banked)
	ELSE
		UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
			RETURNING total INTO drain_total;
	END IF;

	SELECT lifetime_finds INTO old_life FROM public.crews WHERE id = my_crew FOR UPDATE;
	old_life := COALESCE(old_life, 0);
	new_life := old_life + n_credited;
	UPDATE public.crews SET lifetime_finds = new_life WHERE id = my_crew;

	FOR t IN SELECT * FROM (VALUES
		(150,  'mud_champion', 200,  'Root Rustler'),
		(600,  'mud_veteran',  1000, 'Truffle Baron'),
		(1800, 'mud_legend',   2000, 'Hunger''s Bane')
	) AS v(thresh, title_id, purse, title_name)
	LOOP
		IF old_life < t.thresh AND new_life >= t.thresh THEN
			INSERT INTO public.crew_milestones (crew_id, threshold)
				VALUES (my_crew, t.thresh) ON CONFLICT DO NOTHING;
			GET DIAGNOSTICS landed = ROW_COUNT;
			IF landed > 0 THEN
				FOR mem IN SELECT user_id FROM public.crew_members WHERE crew_id = my_crew LOOP
					INSERT INTO public.user_titles (user_id, title_id)
						VALUES (mem.user_id, t.title_id) ON CONFLICT DO NOTHING;
					UPDATE public.profiles SET counter = counter + t.purse WHERE id = mem.user_id;
					BEGIN
						INSERT INTO public.system_announcements (user_id, kind, title, body, data)
						VALUES (mem.user_id, 'crew_milestone', 'Your Sounder made history',
							'Your Sounder has rooted ' || t.thresh ||
							' truffles out from under the Great Hungerer. The title "' ||
							t.title_name || '" is yours, and ' || t.purse || ' snouts landed in your barn.',
							jsonb_build_object('crew_id', my_crew, 'threshold', t.thresh, 'title_id', t.title_id));
					EXCEPTION WHEN OTHERS THEN NULL; END;
				END LOOP;
				milestone := jsonb_build_object('threshold', t.thresh, 'title_id', t.title_id);
			END IF;
		END IF;
	END LOOP;

	UPDATE public.war_rootings SET
		submitted_at    = now(),
		finds           = claimed,
		actions         = p_actions,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited
		WHERE user_id = caller_id AND window_index = win;

	PERFORM public.grant_season_xp(caller_id, 20);

	RETURN jsonb_build_object(
		'credited',    claimed,
		'truffles',    minted,
		'echo_names',  echo_names,
		'drain_total', drain_total,
		'banked',      (active_do.id IS NOT NULL),
		'digoff_id',   active_do.id,
		'milestone',   milestone);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. Membership gates — re-add the SINGLE dig-off gate to the crew-lifecycle
--     RPCs (carried VERBATIM from 20260714000000; only the gate + a due-sweep
--     are new). leave/join/kick are BLOCKED while the crew is mid-skirmish.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.join_crew(p_crew uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	target       record;
	member_count int;
	joiner_name  text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	SELECT * INTO target FROM public.crews WHERE id = p_crew AND is_bot = false FOR UPDATE;
	IF target.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	-- Dig-off gate: no roster churn while the crew is committed to a skirmish.
	PERFORM public._digoff_resolve_due(p_crew);
	IF public._digoff_crew_busy(p_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'crew_in_digoff');
	END IF;
	SELECT count(*) INTO member_count FROM public.crew_members WHERE crew_id = p_crew;
	IF member_count = 0 THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
	IF member_count >= 4 THEN RETURN jsonb_build_object('ok', false, 'reason', 'crew_full'); END IF;
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
GRANT EXECUTE ON FUNCTION public.join_crew(uuid) TO authenticated;

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
	-- Dig-off gate: can't desert the Sounder mid-skirmish.
	PERFORM public._digoff_resolve_due(my_crew);
	IF public._digoff_crew_busy(my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'crew_in_digoff');
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
GRANT EXECUTE ON FUNCTION public.leave_crew() TO authenticated;

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
	-- Dig-off gate: no kicks while the crew is committed to a skirmish.
	PERFORM public._digoff_resolve_due(my_crew);
	IF public._digoff_crew_busy(my_crew) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'crew_in_digoff');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.crew_members
	               WHERE crew_id = my_crew AND user_id = p_member) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
	END IF;
	DELETE FROM public.crew_members WHERE crew_id = my_crew AND user_id = p_member;
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

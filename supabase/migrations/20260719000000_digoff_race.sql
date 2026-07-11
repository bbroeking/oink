-- ═══════════════════════════════════════════════════════════════════════════
-- THE GREAT DIG RACE — the 1-v-1 dig-off (20260715/20260718) is REPLACED by a
-- single global race every non-bot Sounder is automatically in.
--
-- WHY (founder-approved after a grill session): 1-v-1 matchmaking needs a
-- coincidence of two leaders; a global race makes every dig count against the
-- whole barnyard, always, with zero doors to knock on.
--
-- CYCLE MATH (client MUST mirror in utils/dig.ts — document precisely):
--   A race starts every MONDAY 00:00 UTC and THURSDAY 00:00 UTC. The cycle
--   containing time T starts at the MOST RECENT Mon/Thu 00:00 UTC ≤ T:
--     d          = UTC date of T
--     since_mon  = (isodow(d) - 1) mod 7          -- isodow: 1=Mon … 7=Sun
--     since_thu  = (isodow(d) - 4 + 7) mod 7
--     start_date = d - LEAST(since_mon, since_thu)
--     ends_at    = start + 3 days when start is a Monday (Mon→Thu race),
--                  start + 4 days when start is a Thursday (Thu→Mon race)
--     cycle_key  = to_char(start_date, 'YYYYMMDD')  -- sorts chronologically
--   race_cycle_at(timestamptz) is IMMUTABLE pure clock math; race_current_cycle()
--   is the STABLE now() wrapper.
--
-- SCORE: finds per digging snout — SUM(finds) / COUNT(DISTINCT digger), rounded
--   to 1dp (round(x, 1) — the client displays it verbatim). Quorum 2 diggers to
--   be RANKED; 1-digger crews are listed unranked. DENSE ranking — ties share
--   the better rank, no tiebreak chain.
--
-- ATTRIBUTION: submit_rooting ALWAYS writes race_digs (crew-at-dig-time) and
--   ALWAYS drains hunger instantly — the dig-off banking branch is deleted
--   ('banked'/'digoff_id' leave the payload). Truffles/echo/milestones/XP
--   unchanged.
--
-- PAYOUT (sweep_race, cron every 10 min): for each ENDED cycle with digs and no
--   cycle_payouts row (PK idempotence):
--   • RACE_TRUFFLE_TABLE (MUST match client constants/dig.ts RACE_TRUFFLE_TABLE):
--       rank 1 → 6, rank 2 → 5, rank 3 → 4,
--       rank ≤ ceil(ranked_count/2) → 3, every other ranked crew → 2.
--     Minted (reason 'race_rank') per member of a ranked crew WHO DUG ≥1 that
--     cycle. 'of' = COUNT of ranked crews (rows, not max rank).
--   • PODIUM (ranks 1–3, includes rank-3-via-tie): each qualifying (dug ≥1)
--     member also receives ONE cosmetic — pop the next race_podium_queue row
--     (founder-curated FIFO; rows are assumed novel — an already-owned queue
--     hat is consumed and deduped by ON CONFLICT); queue EMPTY → one random
--     hats.war_exclusive item the member does NOT own (the grant_war_spoils
--     pattern from 20260660, reimplemented since that trigger was dropped in
--     20260714); member owns the whole catalog → +2 extra truffles instead.
--   • Detail recorded in cycle_payouts.detail (per-crew + per-member) — powers
--     race_standings().last. Announced via INLINE system_announcements.
--
-- PUSHES (send_push_to_user; data {kind, cycle_key, screen:'season'}):
--   • race_start — first sweep after a boundary, every member of every non-bot
--     crew, once per cycle (cycle_notices tracks sent-ness).
--   • race_end — at payout, every member of each RANKED crew. Sub-quorum crews
--     get NO end push (no shame).
--
-- RETIRED: find_rival / cancel_rival_search / challenge_crew_digoff /
--   accept_digoff / digoff_state / sweep_digoffs / all _digoff_* helpers and
--   the digoff_queue table. dig_offs + dig_off_digs TABLES stay as dormant
--   history (no reads, no writes — not dropped). Membership gates (join/leave/
--   kick) revert to their 20260714 defs: races are open-world, roster churn
--   mid-cycle is fine because race_digs pins crew-at-dig-time.
--
-- FOOTGUNS honored: carry-latest-def (submit_rooting from 20260716; the crew
-- lifecycle trio from 20260714 — their last pre-gate defs); inline
-- announcements; pg_cron guards on unschedule AND schedule; every push/mint
-- side-call EXCEPTION-guarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Retire the 1-v-1 ──────────────────────────────────────────────────────
DO $$ BEGIN
	BEGIN PERFORM cron.unschedule('digoff-sweep'); EXCEPTION WHEN OTHERS THEN NULL; END;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DROP FUNCTION IF EXISTS public.sweep_digoffs();
DROP FUNCTION IF EXISTS public.digoff_state();
DROP FUNCTION IF EXISTS public.find_rival();
DROP FUNCTION IF EXISTS public.cancel_rival_search();
DROP FUNCTION IF EXISTS public.challenge_crew_digoff(uuid);
DROP FUNCTION IF EXISTS public.accept_digoff(uuid);
DROP FUNCTION IF EXISTS public._digoff_queue_bot_fill(uuid);
DROP FUNCTION IF EXISTS public._digoff_push_active(uuid);
DROP FUNCTION IF EXISTS public._digoff_resolve_due(uuid);
DROP FUNCTION IF EXISTS public._digoff_resolve_one(uuid);
DROP FUNCTION IF EXISTS public._digoff_crew_busy(uuid);
DROP FUNCTION IF EXISTS public._digoff_side_stats(uuid, uuid);
DROP TABLE IF EXISTS public.digoff_queue;
-- dig_offs / dig_off_digs: dormant history, intentionally NOT dropped.

-- ── 2. Cycle math ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.race_cycle_at(p_at timestamptz)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql IMMUTABLE
AS $function$
DECLARE
	d         date := (p_at AT TIME ZONE 'UTC')::date;
	since_mon int;
	since_thu int;
	start_d   date;
BEGIN
	since_mon := (extract(isodow FROM d)::int - 1) % 7;
	since_thu := (extract(isodow FROM d)::int - 4 + 7) % 7;
	start_d   := d - LEAST(since_mon, since_thu);
	cycle_key := to_char(start_d, 'YYYYMMDD');
	starts_at := (start_d::timestamp AT TIME ZONE 'UTC');
	ends_at   := ((start_d + (CASE WHEN extract(isodow FROM start_d)::int = 1
	                               THEN 3 ELSE 4 END))::timestamp AT TIME ZONE 'UTC');
	RETURN NEXT;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.race_cycle_at(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.race_current_cycle()
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql STABLE
AS $function$ SELECT * FROM public.race_cycle_at(now()) $function$;
GRANT EXECUTE ON FUNCTION public.race_current_cycle() TO authenticated;

-- ── 3. Data model ─────────────────────────────────────────────────────────────
-- Per-dig race attribution. crew_id is the digger's crew AT DIG TIME — roster
-- churn mid-cycle can't retro-move finds.
CREATE TABLE IF NOT EXISTS public.race_digs (
	cycle_key    text   NOT NULL,
	user_id      uuid   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	window_index bigint NOT NULL,
	crew_id      uuid   NOT NULL,
	finds        int    NOT NULL DEFAULT 0,
	PRIMARY KEY (cycle_key, user_id, window_index)
);
CREATE INDEX IF NOT EXISTS race_digs_cycle_crew_idx ON public.race_digs (cycle_key, crew_id);
ALTER TABLE public.race_digs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View your crew's race digs" ON public.race_digs;
CREATE POLICY "View your crew's race digs" ON public.race_digs FOR SELECT
	USING (public.is_crew_member(crew_id, auth.uid()));

-- One row per PAID cycle (PK = the payout idempotence lock). detail carries the
-- final table + per-member spoils for race_standings().last.
CREATE TABLE IF NOT EXISTS public.cycle_payouts (
	cycle_key text        PRIMARY KEY,
	paid_at   timestamptz NOT NULL DEFAULT now(),
	detail    jsonb       NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.cycle_payouts ENABLE ROW LEVEL SECURITY;   -- server-only

-- Sent-ness of the race_start push, once per cycle.
CREATE TABLE IF NOT EXISTS public.cycle_notices (
	cycle_key       text        PRIMARY KEY,
	start_pushed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cycle_notices ENABLE ROW LEVEL SECURITY;   -- server-only

-- Founder-curated podium cosmetics, popped FIFO at payout (fill via SQL/tooling;
-- hat_id should reference a REAL hats row in prod).
CREATE TABLE IF NOT EXISTS public.race_podium_queue (
	id     serial PRIMARY KEY,
	hat_id text   NOT NULL,
	note   text
);
ALTER TABLE public.race_podium_queue ENABLE ROW LEVEL SECURITY;   -- server-only

-- ── 4. submit_rooting — carried VERBATIM from 20260716; banking branch DELETED,
--      race attribution added (instant drain is the single rule again) ─────────
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
	v_cycle     text;   -- NEW: current race cycle for attribution
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');
	END IF;

	SELECT count(*) INTO prior_cnt FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL;

	IF p_actions IS NULL OR p_actions < 0
	   OR p_actions > (CASE WHEN prior_cnt >= 1 THEN 25 ELSE 20 END) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_actions');
	END IF;

	SELECT * INTO row_r FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win FOR UPDATE;
	IF row_r.user_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;

	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		IF NOT (f = ANY (valid)) THEN
			-- Still pre-write: a forged find rejects the whole submit, no side effects.
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
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

	-- ── DRAIN + RACE ATTRIBUTION ─────────────────────────────────────────────
	-- Instant drain is the single rule again (the dig-off banking branch left
	-- with the 1-v-1). Every real dig is also attributed to the current race
	-- cycle under the digger's crew AT DIG TIME.
	UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
		RETURNING total INTO drain_total;
	SELECT rc.cycle_key INTO v_cycle FROM public.race_current_cycle() rc;
	INSERT INTO public.race_digs (cycle_key, user_id, window_index, crew_id, finds)
		VALUES (v_cycle, caller_id, win, my_crew, n_credited)
		ON CONFLICT (cycle_key, user_id, window_index)
		DO UPDATE SET finds = public.race_digs.finds + EXCLUDED.finds;

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
		'ok',          true,
		'credited',    claimed,
		'truffles',    minted,
		'echo_names',  echo_names,
		'drain_total', drain_total,
		'milestone',   milestone);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;

-- ── 5. Membership gates REMOVED — carried VERBATIM from 20260714 (the last
--      pre-gate defs). Races are open-world; crew-at-dig-time attribution makes
--      mid-cycle roster churn harmless. ─────────────────────────────────────────
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

-- ── 6. Scoring table (shared by standings + payout) ──────────────────────────
-- One row per non-bot crew with ≥1 dig in the cycle. rnk is a DENSE rank over
-- QUORATE (≥2 diggers) crews only, NULL for sub-quorum crews. avg rounds 1dp.
CREATE OR REPLACE FUNCTION public._race_table(p_cycle text)
RETURNS TABLE (crew_id uuid, crew_name text, avg numeric, diggers int,
               total_finds int, roster_size int, rnk int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH per_crew AS (
		SELECT d.crew_id,
		       round(sum(d.finds)::numeric / count(DISTINCT d.user_id), 1) AS avg,
		       count(DISTINCT d.user_id)::int AS diggers,
		       COALESCE(sum(d.finds), 0)::int AS total_finds
		FROM public.race_digs d
		JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
		WHERE d.cycle_key = p_cycle
		GROUP BY d.crew_id
	),
	ranked AS (
		SELECT pc.crew_id, (DENSE_RANK() OVER (ORDER BY pc.avg DESC))::int AS rnk
		FROM per_crew pc
		WHERE pc.diggers >= 2   -- RACE quorum (client DIGOFF_QUORUM = 2)
	)
	SELECT pc.crew_id, c.name, pc.avg, pc.diggers, pc.total_finds,
	       (SELECT count(*)::int FROM public.crew_members cm WHERE cm.crew_id = pc.crew_id),
	       r.rnk
	FROM per_crew pc
	JOIN public.crews c ON c.id = pc.crew_id
	LEFT JOIN ranked r ON r.crew_id = pc.crew_id;
$function$;
REVOKE ALL ON FUNCTION public._race_table(text) FROM PUBLIC, anon, authenticated;

-- RACE_TRUFFLE_TABLE — MUST match client constants/dig.ts RACE_TRUFFLE_TABLE:
-- rank 1→6, 2→5, 3→4, rank ≤ ceil(ranked_count/2) → 3, all other ranked → 2.
CREATE OR REPLACE FUNCTION public._race_truffles_for_rank(p_rank int, p_ranked int)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE
		WHEN p_rank = 1 THEN 6
		WHEN p_rank = 2 THEN 5
		WHEN p_rank = 3 THEN 4
		WHEN p_rank <= ceil(p_ranked / 2.0)::int THEN 3
		ELSE 2
	END;
$function$;
REVOKE ALL ON FUNCTION public._race_truffles_for_rank(int, int) FROM PUBLIC, anon, authenticated;

-- ── 7. race_standings() — the season tab's read ──────────────────────────────
CREATE OR REPLACE FUNCTION public.race_standings()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cyc       record;
	my_crew   uuid;
	ranked    jsonb;
	unranked  jsonb;
	mine      jsonb := NULL;
	last_res  jsonb := NULL;
BEGIN
	SELECT * INTO cyc FROM public.race_current_cycle();

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'rank', t.rnk, 'crew_id', t.crew_id, 'name', t.crew_name,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds,
			'roster_size', t.roster_size)
		ORDER BY t.rnk, t.crew_name), '[]'::jsonb) INTO ranked
		FROM public._race_table(cyc.cycle_key) t WHERE t.rnk IS NOT NULL;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'crew_id', t.crew_id, 'name', t.crew_name,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds,
			'roster_size', t.roster_size)
		ORDER BY t.avg DESC, t.crew_name), '[]'::jsonb) INTO unranked
		FROM public._race_table(cyc.cycle_key) t WHERE t.rnk IS NULL;

	IF caller_id IS NOT NULL THEN
		SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
		IF my_crew IS NOT NULL THEN
			SELECT jsonb_build_object('crew_id', t.crew_id, 'rank', t.rnk, 'avg', t.avg,
					'diggers', t.diggers, 'total_finds', t.total_finds) INTO mine
				FROM public._race_table(cyc.cycle_key) t WHERE t.crew_id = my_crew;
			IF mine IS NULL THEN   -- crew hasn't dug this cycle yet
				mine := jsonb_build_object('crew_id', my_crew, 'rank', NULL,
					'avg', 0, 'diggers', 0, 'total_finds', 0);
			END IF;
			-- The caller's most recent recorded payout (usually last cycle).
			SELECT (cp.detail->'members'->(caller_id::text))
			       || jsonb_build_object('cycle_key', cp.cycle_key) INTO last_res
				FROM public.cycle_payouts cp
				WHERE cp.detail->'members' ? caller_id::text
				ORDER BY cp.cycle_key DESC LIMIT 1;
		END IF;
	END IF;

	RETURN jsonb_build_object(
		'cycle', jsonb_build_object('key', cyc.cycle_key,
			'starts_at', cyc.starts_at, 'ends_at', cyc.ends_at),
		'ranked', ranked, 'unranked', unranked, 'mine', mine, 'last', last_res);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_standings() TO authenticated;

-- ── 8. Payout for ONE ended cycle (idempotent via cycle_payouts PK) ──────────
CREATE OR REPLACE FUNCTION public._race_pay_cycle(p_cycle text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	landed   int;
	ranked_n int;
	t        record;
	m        record;
	amt      int;
	pick     text;
	dug      boolean;
	members  jsonb := '{}'::jsonb;
	crews_j  jsonb := '[]'::jsonb;
BEGIN
	-- Idempotence lock: first inserter pays; everyone else no-ops.
	INSERT INTO public.cycle_payouts (cycle_key) VALUES (p_cycle) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed = 0 THEN RETURN false; END IF;

	SELECT count(*) INTO ranked_n FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL;

	FOR t IN SELECT * FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL
		ORDER BY rt.rnk, rt.crew_name
	LOOP
		crews_j := crews_j || jsonb_build_object('crew_id', t.crew_id, 'rank', t.rnk,
			'avg', t.avg, 'diggers', t.diggers, 'total_finds', t.total_finds);

		FOR m IN SELECT cm.user_id FROM public.crew_members cm
			WHERE cm.crew_id = t.crew_id ORDER BY cm.user_id
		LOOP
			amt := 0; pick := NULL;
			dug := EXISTS (SELECT 1 FROM public.race_digs d
				WHERE d.cycle_key = p_cycle AND d.user_id = m.user_id AND d.crew_id = t.crew_id);

			IF dug THEN
				amt := public._race_truffles_for_rank(t.rnk, ranked_n);
				BEGIN PERFORM public.mint_truffles(m.user_id, amt, 'race_rank', NULL);
				EXCEPTION WHEN OTHERS THEN NULL; END;

				-- PODIUM cosmetic (ranks 1-3): queue pop → random unowned catalog
				-- item → owns-everything +2 truffles.
				IF t.rnk <= 3 THEN
					DELETE FROM public.race_podium_queue q
						WHERE q.id = (SELECT id FROM public.race_podium_queue
						              ORDER BY id LIMIT 1)
						RETURNING q.hat_id INTO pick;
					IF pick IS NULL THEN
						SELECT h.id INTO pick FROM public.hats h
						WHERE h.war_exclusive = true
						  AND NOT EXISTS (SELECT 1 FROM public.user_hats uh
							WHERE uh.user_id = m.user_id AND uh.hat_id = h.id)
						ORDER BY random() LIMIT 1;
					END IF;
					IF pick IS NOT NULL THEN
						INSERT INTO public.user_hats (user_id, hat_id)
							VALUES (m.user_id, pick) ON CONFLICT DO NOTHING;
					ELSE
						BEGIN PERFORM public.mint_truffles(m.user_id, 2, 'race_rank', NULL);
						EXCEPTION WHEN OTHERS THEN NULL; END;
						amt := amt + 2;
					END IF;
				END IF;

				BEGIN PERFORM public.try_claim_achievements(m.user_id, 'truffles_dug');
				EXCEPTION WHEN OTHERS THEN NULL; END;
			END IF;

			members := members || jsonb_build_object(m.user_id::text, jsonb_build_object(
				'crew_id', t.crew_id, 'rank', t.rnk, 'of', ranked_n,
				'truffles_paid', amt, 'cosmetic_hat_id', pick));

			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (m.user_id, 'race_result', 'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
					CASE WHEN amt > 0 THEN ' — ' || amt || ' Golden Truffles are yours.'
					     ELSE '.' END,
					jsonb_build_object('cycle_key', p_cycle, 'rank', t.rnk, 'of', ranked_n,
						'truffles', amt, 'hat_id', pick));
			EXCEPTION WHEN OTHERS THEN NULL; END;

			-- Race-end push: every member of each RANKED crew. Sub-quorum crews
			-- get no push (no shame).
			BEGIN
				PERFORM public.send_push_to_user(m.user_id, 'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n || ' — your spoils are in.',
					jsonb_build_object('kind', 'race_end', 'cycle_key', p_cycle, 'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END LOOP;

	UPDATE public.cycle_payouts
		SET detail = jsonb_build_object('ranked_count', ranked_n,
			'crews', crews_j, 'members', members)
		WHERE cycle_key = p_cycle;
	RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._race_pay_cycle(text) FROM PUBLIC, anon, authenticated;

-- ── 9. sweep_race() — cron entry point (replaces digoff-sweep) ───────────────
CREATE OR REPLACE FUNCTION public.sweep_race()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	cur     record;
	k       text;
	landed  int;
	n_paid  int := 0;
	started boolean := false;
	days    int;
	m       record;
BEGIN
	SELECT * INTO cur FROM public.race_current_cycle();

	-- (a) race_start push — once per cycle (cycle_notices = sent-ness lock).
	INSERT INTO public.cycle_notices (cycle_key) VALUES (cur.cycle_key) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed > 0 THEN
		started := true;
		days := (extract(epoch FROM (cur.ends_at - cur.starts_at)) / 86400)::int;   -- 3 or 4
		FOR m IN SELECT cm.user_id FROM public.crew_members cm
			JOIN public.crews c ON c.id = cm.crew_id AND c.is_bot = false
		LOOP
			BEGIN
				PERFORM public.send_push_to_user(m.user_id, 'A new race is on',
					'Every Sounder digs — ' || days || ' days on the clock.',
					jsonb_build_object('kind', 'race_start', 'cycle_key', cur.cycle_key,
						'screen', 'season'));
			EXCEPTION WHEN OTHERS THEN NULL; END;
		END LOOP;
	END IF;

	-- (b) payouts: any ENDED cycle with digs and no payout row. cycle_key is
	-- YYYYMMDD, so string < compares chronologically; cycles with zero digs
	-- have nothing to pay and are skipped.
	FOR k IN SELECT DISTINCT d.cycle_key FROM public.race_digs d
		WHERE d.cycle_key < cur.cycle_key
		  AND NOT EXISTS (SELECT 1 FROM public.cycle_payouts cp WHERE cp.cycle_key = d.cycle_key)
		ORDER BY d.cycle_key
	LOOP
		IF public._race_pay_cycle(k) THEN n_paid := n_paid + 1; END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'cycle', cur.cycle_key,
		'started', started, 'paid', n_paid);
END;
$function$;
-- Cron-only entry point: not callable from clients.
REVOKE ALL ON FUNCTION public.sweep_race() FROM PUBLIC, anon, authenticated;

-- Every 10 minutes (replaces digoff-sweep, unscheduled in §1). Tolerate pg_cron
-- being absent (the plain-postgres harness stubs cron.*).
DO $$ BEGIN
	PERFORM cron.schedule('race-sweep', '*/10 * * * *', 'SELECT public.sweep_race()');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

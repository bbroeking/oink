-- ═══════════════════════════════════════════════════════════════════════════
-- PATCH UNIQUES — the Season 1 relic pool + the Burrow Book.
--
-- WHAT: a board may carry ONE single-cell "unique" relic (~2 in 5). open_rooting
-- rolls whether this board gets one and which (rarity-weighted) and returns its
-- id as `unique_id`; the client places it deterministically LAST (after every
-- existing draw). submit_rooting accepts the literal token 'unique' in p_finds
-- ONLY when the caller's row actually carries a unique_id, upserts the catch into
-- user_uniques (bumping found_count on a dupe), credits it toward the meter drain
-- exactly like any other find, and returns `unique_found` {id, new, found_count}.
-- First catch lights the relic's Burrow Book entry.
--
-- WHY: Collect (the Book is proof-you-were-there, earned only) + Contend (uniques
-- drain the meter). See SKILL.md decision log (2026-07-11).
--
-- PARITY: the pool ids + weights below MUST match constants/uniques.ts
-- (UNIQUE_POOL + UNIQUE_RARITY_WEIGHT) and UNIQUE_SPAWN_CHANCE = 0.4. The board
-- PRNG parity contract (utils/rooting.ts header) is untouched: the unique cell is
-- placed AFTER the four find-set draws and every existing placement draw, so a
-- non-unique board is byte-identical to before. The seed/find-set derivation is
-- unchanged; only WHICH relic (or none) rides on the board is new server state.
--
-- FOOTGUNS honored — carry-latest-def: open_rooting AND submit_rooting are
-- carried VERBATIM from 20260721000000_patch_phase (the LATEST defs of both:
-- phase gate + _patch_now() + race_digs attribution), with ONLY the unique
-- deltas layered on. No banking path exists in the 20260721 submit (the digoff
-- banking was superseded by race_digs) — do NOT reintroduce it. All refusals stay
-- pre-write {ok:false, reason} envelopes.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. war_rootings gains the relic this board carries (nullable) ─────────────
ALTER TABLE public.war_rootings ADD COLUMN IF NOT EXISTS unique_id text;

-- ── 2. user_uniques — the Burrow Book, one row per (pig, relic) ───────────────
CREATE TABLE IF NOT EXISTS public.user_uniques (
	user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	unique_id      text NOT NULL,
	found_count    int  NOT NULL DEFAULT 1,
	first_found_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, unique_id)
);
ALTER TABLE public.user_uniques ENABLE ROW LEVEL SECURITY;
-- RLS: a pig may SELECT only its own catches; ALL writes go through the
-- SECURITY DEFINER submit_rooting (no INSERT/UPDATE/DELETE policy = none allowed).
DROP POLICY IF EXISTS user_uniques_select_own ON public.user_uniques;
CREATE POLICY user_uniques_select_own ON public.user_uniques
	FOR SELECT USING (user_id = auth.uid());
REVOKE ALL ON public.user_uniques FROM PUBLIC, anon;
GRANT SELECT ON public.user_uniques TO authenticated;

-- ── 3. unique_pool() — the server-authoritative relic table ───────────────────
-- MUST match constants/uniques.ts (UNIQUE_POOL ids + UNIQUE_RARITY_WEIGHT).
CREATE OR REPLACE FUNCTION public.unique_pool()
RETURNS TABLE (unique_id text, weight numeric) LANGUAGE sql IMMUTABLE
AS $function$
	SELECT * FROM (VALUES
		('old_boot',        6.0),
		('licked_wrapper',  6.0),
		('fossil_acorn',    6.0),
		('brass_cowbell',   3.0),
		('milk_tooth',      3.0),
		('jam_letter',      3.0),
		('glass_eye',       3.0),
		('music_box_heart', 1.5),
		('tiny_crown',      1.5),
		('petrified_tickle',1.5),
		('first_truffle',   0.5),
		('thin_portrait',   0.5)
	) AS p(unique_id, weight);
$function$;

-- Pick one relic id, weighted; NULL is never returned (caller gates on the roll).
CREATE OR REPLACE FUNCTION public.roll_unique()
RETURNS text LANGUAGE plpgsql VOLATILE
AS $function$
DECLARE
	total numeric;
	pick  numeric;
	acc   numeric := 0;
	rec   record;
BEGIN
	SELECT sum(weight) INTO total FROM public.unique_pool();
	pick := random() * total;
	FOR rec IN SELECT unique_id, weight FROM public.unique_pool() ORDER BY unique_id LOOP
		acc := acc + rec.weight;
		IF pick < acc THEN RETURN rec.unique_id; END IF;
	END LOOP;
	-- Floating-point edge: return the last id.
	RETURN (SELECT unique_id FROM public.unique_pool() ORDER BY unique_id DESC LIMIT 1);
END;
$function$;

-- ── 4. open_rooting — carried VERBATIM from 20260721; + unique roll/return ────
-- DELTA: after inserting the new row, roll random() < 0.4; if hit, pick a
-- weighted unique id and UPDATE the row. unique_id is included in BOTH return
-- paths (existing-row echoes the stored value, new-row echoes the just-rolled one).
CREATE OR REPLACE FUNCTION public.open_rooting()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	win         bigint;
	today       date;
	the_seed    int;
	existing    record;
	coop_now    boolean;
	blessed_now boolean;
	crew_dug    jsonb;
	block_start timestamptz;
	phase_ends  timestamptz;
	opens       timestamptz;
	the_unique  text;   -- the relic this NEW board carries, or NULL
BEGIN
	win   := floor(extract(epoch FROM v_now) / 28800)::bigint;
	today := (v_now AT TIME ZONE 'UTC')::date;
	block_start := to_timestamp(win * 28800);
	opens       := block_start + interval '8 hours';   -- the next opening instant
	phase_ends  := CASE WHEN public.patch_phase_open(v_now)
	                    THEN block_start + interval '4 hours'   -- open phase ends
	                    ELSE opens END;                          -- guard ends = next open

	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Phase gate: the patch is guarded during the second 4h of each block.
	IF NOT public.patch_phase_open(v_now) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'patch_closed',
			'phase_ends_at', phase_ends, 'opens_at', opens);
	END IF;

	SELECT crew_id INTO my_crew FROM public.crew_members WHERE user_id = caller_id;
	IF my_crew IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_crew');   -- the dig is Sounder-gated
	END IF;

	coop_now := EXISTS (SELECT 1 FROM public.war_rootings
		WHERE crew_id = my_crew AND window_index = win
		  AND user_id <> caller_id AND submitted_at IS NOT NULL);
	blessed_now := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'user_id', r.user_id, 'display_name', p.username)), '[]'::jsonb)
		INTO crew_dug
		FROM public.war_rootings r JOIN public.profiles p ON p.id = r.user_id
		WHERE r.crew_id = my_crew AND r.window_index = win
		  AND r.submitted_at IS NOT NULL AND r.user_id <> caller_id;

	-- Normalized Park–Miller seed in [1, 2147483646] (client receives it; parity
	-- is in board generation from the seed, not the seed derivation).
	the_seed := (abs(hashtext(win::text || ':' || caller_id::text)) % 2147483646) + 1;

	SELECT * INTO existing FROM public.war_rootings
		WHERE user_id = caller_id AND window_index = win;
	IF existing.user_id IS NOT NULL THEN
		-- Existing row: echo its stored relic (never re-rolled — the board is fixed).
		RETURN jsonb_build_object(
			'ok', true,
			'already', existing.submitted_at IS NOT NULL,
			'window_index', win, 'seed', existing.seed, 'opened_at', existing.opened_at,
			'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
			'phase_ends_at', phase_ends, 'opens_at', opens,
			'unique_id', existing.unique_id);
	END IF;

	-- New board: roll whether it carries a relic (~2 in 5) and which.
	IF random() < 0.4 THEN
		the_unique := public.roll_unique();
	END IF;

	INSERT INTO public.war_rootings (user_id, crew_id, window_index, seed, dig_day, opened_at, unique_id)
		VALUES (caller_id, my_crew, win, the_seed, today, v_now, the_unique);
	RETURN jsonb_build_object(
		'ok', true,
		'already', false,
		'window_index', win, 'seed', the_seed, 'opened_at', v_now,
		'coop', coop_now, 'blessed', blessed_now, 'crew_dug', crew_dug,
		'phase_ends_at', phase_ends, 'opens_at', opens,
		'unique_id', the_unique);
END;
$function$;
REVOKE ALL ON FUNCTION public.open_rooting() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_rooting() TO authenticated;

-- ── 5. submit_rooting — carried VERBATIM from 20260721; + unique claim/upsert ─
-- DELTA: accept 'unique' in p_finds ONLY when the row carries a unique_id (else
-- it's a forged find → bad_finds, unchanged). On a valid unique claim: upsert
-- user_uniques (increment found_count on conflict), count it as a credited find
-- (it flows through n_credited → drain, like every other claimed find), and
-- return unique_found {id, new, found_count}.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[], p_actions int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	v_now       timestamptz := public._patch_now();
	my_crew     uuid;
	win         bigint;
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
	v_cycle     text;
	claimed_unique boolean := false;   -- did the payload validly claim the relic?
	uniq_new    boolean := false;      -- first catch (fresh Book entry)?
	uniq_count  int := 0;              -- found_count after this catch
	unique_found jsonb := NULL;
BEGIN
	win := floor(extract(epoch FROM v_now) / 28800)::bigint;
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
		-- Also the stale-session path: a dig opened in a PREVIOUS window refuses
		-- here because win moved on (unchanged pre-phase behavior).
		RETURN jsonb_build_object('ok', false, 'reason', 'no_open_rooting');
	END IF;
	IF row_r.submitted_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rooted');
	END IF;

	valid := public.rooting_finds(row_r.seed);
	SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::text[]) INTO claimed
		FROM unnest(COALESCE(p_finds, ARRAY[]::text[])) AS x;
	FOREACH f IN ARRAY claimed LOOP
		-- 'unique' is valid ONLY when this board actually carries a relic; the
		-- board's rooting_finds() (seed-derived) never contains 'unique', so it is
		-- validated against the row's unique_id here instead.
		IF f = 'unique' THEN
			IF row_r.unique_id IS NULL THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
			END IF;
			claimed_unique := true;
		ELSIF NOT (f = ANY (valid)) THEN
			-- Still pre-write: a forged find rejects the whole submit, no side effects.
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_finds');
		END IF;
		IF f IN ('truffle_l', 'truffle_d') THEN truffle_cnt := truffle_cnt + 1; END IF;
	END LOOP;
	-- Every claimed find (truffles, shimmer, junk, AND the relic) counts toward
	-- the meter drain — the relic is a credited find like any other.
	n_credited := COALESCE(array_length(claimed, 1), 0);

	blessed := EXISTS (SELECT 1 FROM public.blessings
		WHERE receiver_id = caller_id AND cleared_at IS NULL AND expires_at > v_now);
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

	-- ── UNIQUE CATCH ─────────────────────────────────────────────────────────
	-- Light the Burrow Book: first catch inserts (new=true), a dupe bumps count.
	IF claimed_unique THEN
		INSERT INTO public.user_uniques (user_id, unique_id, found_count, first_found_at)
			VALUES (caller_id, row_r.unique_id, 1, v_now)
			ON CONFLICT (user_id, unique_id)
			DO UPDATE SET found_count = public.user_uniques.found_count + 1
			RETURNING (xmax = 0) AS was_insert, found_count INTO uniq_new, uniq_count;
		unique_found := jsonb_build_object(
			'id', row_r.unique_id, 'new', uniq_new, 'found_count', uniq_count);
	END IF;

	SELECT COALESCE(array_agg(p.username), ARRAY[]::text[]) INTO echo_names
		FROM public.war_rootings r2 JOIN public.profiles p ON p.id = r2.user_id
		WHERE r2.crew_id = my_crew AND r2.window_index = win
		  AND r2.user_id <> caller_id AND r2.submitted_at IS NOT NULL AND r2.truffles_minted >= 1;

	-- ── DRAIN + RACE ATTRIBUTION ─────────────────────────────────────────────
	-- Instant drain; the race cycle is derived from the SAME clock as the
	-- window (race_cycle_at(v_now), not race_current_cycle()).
	UPDATE public.hunger_drain SET total = total + n_credited WHERE id = true
		RETURNING total INTO drain_total;
	SELECT rc.cycle_key INTO v_cycle FROM public.race_cycle_at(v_now) rc;
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
		submitted_at    = v_now,
		finds           = claimed,
		actions         = p_actions,
		truffles_minted = minted,
		echo_credited   = my_echo,
		credited_finds  = n_credited
		WHERE user_id = caller_id AND window_index = win;

	PERFORM public.grant_season_xp(caller_id, 20);

	RETURN jsonb_build_object(
		'ok',           true,
		'credited',     claimed,
		'truffles',     minted,
		'echo_names',   echo_names,
		'drain_total',  drain_total,
		'milestone',    milestone,
		'unique_found', unique_found);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[], int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[], int) TO authenticated;

-- ── 6. Grants/revokes for the new helpers (mirror the existing functions) ─────
REVOKE ALL ON FUNCTION public.unique_pool() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unique_pool() TO authenticated;
REVOKE ALL ON FUNCTION public.roll_unique() FROM PUBLIC, anon;
-- roll_unique is only ever called from the SECURITY DEFINER open_rooting; no
-- direct client grant needed.

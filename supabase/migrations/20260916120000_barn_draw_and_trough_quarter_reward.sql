-- ═══════════════════════════════════════════════════════════════════════════
-- THE BARN DRAW — the herd prize + the Trough giver's reward
--
-- Ratified 2026-09-16. Design: docs/design/2026-09-16-barn-prize-draw.md, with
-- ONE correction the founder made at ratification: there is NO "everyone's
-- draw" layer. The doc's Layer 1 is dropped; what lands is the herd prize
-- (Layer 2, re-scoped) and a new giver's reward on the Trough. SKILL.md lens:
-- Connect (the prize exists at the size of the herd, and giving to a friend's
-- Trough is what earns the design), Collect (both prizes are Barn furnishings
-- out of the catalog), Contend (the herd draw rides the Monday the race
-- resolves). No shame states: a herd with nobody digging simply has no draw,
-- and nothing anywhere names who slept.
--
-- WHAT LANDS
--   1. app_settings.barn_draw — the tier tuning row (60/28/12, relative
--      weights, no amounts: the prize is a furnishing, not a purse).
--      utils/barnDraw.ts BARN_DRAW_TUNING is the compiled fallback and MUST
--      mirror it. Server-config-over-constants.
--   2. _barn_draw_pick(user, cycle, scope) — the one prize picker. scope
--      'all' = every for-sale, active furnishing the snout doesn't own;
--      scope 'featured' = only the week's featured collection. Rolls a tier,
--      then picks uniformly inside it, stepping to the NEAREST tier that has
--      stock. NULL when the snout owns the whole pool.
--   3. _barn_draw_purse(user) — the fallback when the pool is empty: roll the
--      Monday purse tiers (no catch-up) and mint through apply_tickles().
--   4. herd_prize_seeds + herd_prize_draws + _herd_prize_resolve(cycle) —
--      one draw per crew per cycle, entrants = crew members who dug, winner
--      picked DETERMINISTICALLY from a committed seed. herd_prize_state() is
--      the read.
--   5. trough_weekly_rewards + the rewritten reward block in donate_to_drive
--      + trough_reward_state() — the quarter rule.
--
-- THE PRIZE POOL. `is_for_sale = true AND active` — nothing else. Every
-- special gift in the catalog (collection milestone gifts, Wallow keepsakes,
-- season-pass rewards, the race bunting) is `is_for_sale = false`, so the
-- for-sale filter IS the "never in the pool" rule; no allowlist to drift.
-- Special gifts are untouched by this migration.
--
-- VERIFIABILITY. Before week W's draw runs, a seed for W is already committed
-- (with its sha256 published through herd_prize_state().week.seed_hash). When
-- W resolves: draw every crew off that seed, mark W revealed (the seed is
-- then readable in herd_prize_state().last.seed), and commit a fresh seed for
-- W+1. The winner key is md5(seed || ':' || crew_id || ':' || user_id) and the
-- largest key wins, so anyone holding the seed + the entrant list can
-- recompute the result by hand. FIRST RUN: no seed exists for the first week
-- to resolve after this migration lands (nothing committed one), so
-- _herd_prize_resolve commits one for W at draw time and reveals it in the
-- same breath — that one week is auditable after the fact but not
-- pre-committed. Every week after it is pre-committed.
--
-- THE FEATURED COLLECTION. Position (ordered by display_order, 1..10) =
-- ((to_date(cycle_key) - DATE '2026-09-14') / 7) mod 10 + 1. 2026-09-14 is a
-- Monday and every cycle_key is a Monday, so the day difference is always a
-- multiple of 7 and Postgres' truncating integer division equals a floor —
-- utils/barnDraw.ts featuredCollectionIndex() mirrors it with Math.trunc for
-- exactly that reason. The modulo is taken the safe way ((x % 10) + 10) % 10
-- so a cycle before the epoch still lands in 0..9.
--
-- THE TROUGH QUARTER RULE (replaces the floor(snouts/100) tickle credit from
-- 20260757000000). A giver earns from a Trough only once their CUMULATIVE
-- contribution to THAT drive reaches the existing per-donor quarter cap
-- (ceil(target * 0.25) — the same `cap` variable the clamp already uses).
-- The FIRST time in an ISO week a giver crosses a quarter on any drive they
-- draw one furnishing from the week's featured collection; nothing further
-- that week, on any Trough. Giving never enters or weights the herd prize.
--
-- FOOTGUNS HONORED
--   • CARRY-LATEST-DEF. donate_to_drive is carried VERBATIM from
--     20260757000000_trough_quarter_cap_and_72h.sql (the alphabetically-latest
--     file that defines it — 20260782000000 only mentions it in comments) with
--     ONLY the reward block changed: the 1:100 credit and its profiles UPDATE
--     are gone. Every other guard stays in place and in order: the 12h
--     per-drive cooldown, the quarter cap + refusal, the remaining-gap clamp,
--     the balance check, the first-chip-of-day XP, the chip + funded
--     announcements, the funding grant, the 72h window's untouched machinery.
--     _race_pay_cycle is carried VERBATIM from 20260916110000 with exactly one
--     added line (the herd-prize call).
--   • ADMIN-GATED ANNOUNCEMENT. The carried body's system_announcements
--     INSERTs stay INLINE — send_system_announcement() would raise admin_only
--     and silently roll the donation back.
--   • IDEMPOTENCE. _herd_prize_resolve is safe to run twice: herd_prize_draws'
--     (iso_week, crew_id) primary key is checked per crew before any roll, so
--     a second run redraws nothing and regrants nothing. The grants themselves
--     ride grant_habitat_item(), idempotent per (user, source, source_ref).
--
-- Migrations are WRITTEN, NOT PUSHED — never `db push` without the founder's
-- explicit "go".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
-- Relative weights, not percentages. No amounts: the prize is a design, and
-- its snout price already lives on the habitat_items row.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'barn_draw',
	'{
		"tiers": [
			{"tier": "common",   "weight": 60},
			{"tier": "uncommon", "weight": 28},
			{"tier": "rare",     "weight": 12}
		]
	}'::jsonb,
	'Barn draw (20260916120000): the tier weights for both furnishing prizes — the Monday herd prize (pool: every for-sale, active furnishing the winner does not own) and the Trough giver''s weekly reward (pool: the week''s featured collection). Weights are relative, not percentages; a rolled tier with no stock steps to the nearest tier that has some. utils/barnDraw.ts BARN_DRAW_TUNING is the compiled fallback.'
)
ON CONFLICT (key) DO UPDATE SET
	value = EXCLUDED.value,
	description = EXCLUDED.description,
	updated_at = now();

CREATE OR REPLACE FUNCTION public._barn_draw_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'barn_draw'),
		'{"tiers":[{"tier":"common","weight":60},{"tier":"uncommon","weight":28},{"tier":"rare","weight":12}]}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._barn_draw_tuning() FROM PUBLIC, anon, authenticated;

-- ── 2. Cycle bounds for a cycle_key ──────────────────────────────────────────
-- race_cycle_at() takes a clock reading and walks back to the most recent
-- Monday; a cycle_key IS that Monday, so reading the clock one hour into it
-- returns the very cycle the key names. (Verified against the 20260720000000
-- definition: it computes (p_at AT TIME ZONE 'UTC')::date, subtracts
-- isodow-1, and returns [Monday 00:00 UTC, the following Monday 00:00 UTC).)
-- The `::timestamp AT TIME ZONE 'UTC'` spelling is deliberate — a bare
-- `::timestamptz` would read the session TimeZone and could slip a day.
CREATE OR REPLACE FUNCTION public._barn_cycle_bounds(p_cycle text)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
	SELECT * FROM public.race_cycle_at(
		((to_date(p_cycle, 'YYYYMMDD')::timestamp) AT TIME ZONE 'UTC') + interval '1 hour');
$function$;
REVOKE ALL ON FUNCTION public._barn_cycle_bounds(text) FROM PUBLIC, anon, authenticated;

-- ── 3. The week's featured collection ────────────────────────────────────────
-- The ten collections rotate on the display_order ladder, one per week, from
-- the 2026-09-14 epoch. Returns NULL if the catalog has no collections.
CREATE OR REPLACE FUNCTION public._barn_featured_collection(p_cycle text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH ladder AS (
		SELECT c.id, (row_number() OVER (ORDER BY c.display_order))::int AS pos,
		       (count(*) OVER ())::int AS n
		FROM public.habitat_collections c
	),
	-- `n` is the collection count (10 today). Using it rather than a literal 10
	-- keeps the rotation whole if the catalog ever grows a collection.
	span AS (
		SELECT ((to_date(p_cycle, 'YYYYMMDD') - DATE '2026-09-14') / 7) AS w
	)
	SELECT l.id FROM ladder l, span
	WHERE l.n > 0 AND l.pos = ((span.w % l.n) + l.n) % l.n + 1;
$function$;
REVOKE ALL ON FUNCTION public._barn_featured_collection(text) FROM PUBLIC, anon, authenticated;

-- ── 4. The prize picker ──────────────────────────────────────────────────────
-- Roll a tier off the tuning row, then pick uniformly among the snout's
-- UNOWNED for-sale, active furnishings of that tier — stepping to the nearest
-- tier that has stock when the rolled one is exhausted (ties break toward the
-- humbler tier). NULL means the snout owns the whole pool: the callers then
-- fall back to a tickle purse.
--
-- The ORDER BY does the whole "nearest tier with stock, uniform inside it"
-- rule in one pass: distance from the rolled tier first, the tier ladder as
-- the tie-break, then random() — every row of the chosen tier shares the first
-- two keys, so random() shuffles within exactly that tier.
CREATE OR REPLACE FUNCTION public._barn_draw_pick(p_user uuid, p_cycle text, p_scope text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	tuning  jsonb := public._barn_draw_tuning();
	coll    text  := NULL;
	total   numeric := 0;
	acc     numeric := 0;
	roll    numeric;
	t       jsonb;
	want    text := NULL;
	ord     int;
	pick_id text;
BEGIN
	IF p_user IS NULL THEN RETURN NULL; END IF;

	IF p_scope = 'featured' THEN
		coll := public._barn_featured_collection(p_cycle);
		IF coll IS NULL THEN RETURN NULL; END IF;
	END IF;

	FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
		total := total + GREATEST(0, COALESCE((t ->> 'weight')::numeric, 0));
	END LOOP;
	IF total > 0 THEN
		roll := random() * total;
		FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
			acc  := acc + GREATEST(0, COALESCE((t ->> 'weight')::numeric, 0));
			want := t ->> 'tier';
			EXIT WHEN roll < acc;
		END LOOP;
	END IF;
	ord := CASE want WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 ELSE 1 END;

	SELECT i.id INTO pick_id
	FROM public.habitat_items i
	WHERE i.is_for_sale
	  AND i.active
	  AND (coll IS NULL OR i.collection_id = coll)
	  AND NOT EXISTS (
		SELECT 1 FROM public.user_habitat_items o
		WHERE o.user_id = p_user AND o.item_id = i.id)
	ORDER BY
		abs((CASE i.rarity WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 ELSE 1 END) - ord),
		(CASE i.rarity WHEN 'uncommon' THEN 2 WHEN 'rare' THEN 3 ELSE 1 END),
		random()
	LIMIT 1;

	RETURN pick_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._barn_draw_pick(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ── 5. The tickle-purse fallback ─────────────────────────────────────────────
-- Owning the whole pool is a good problem; it is never a zero. Roll the Monday
-- purse tiers (the same app_settings.monday_draw table, WITHOUT the catch-up
-- curve — that curve belongs to the Monday purse's own streak) and mint
-- through apply_tickles(), the named applied-tickles path, never a bare
-- balance UPDATE. Returns the amount paid.
CREATE OR REPLACE FUNCTION public._barn_draw_purse(p_user uuid)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	tuning jsonb := public._monday_draw_tuning();
	total  numeric := 0;
	acc    numeric := 0;
	roll   numeric;
	t      jsonb;
	amt    int := 0;
BEGIN
	IF p_user IS NULL THEN RETURN 0; END IF;
	FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
		total := total + GREATEST(0, COALESCE((t ->> 'weight')::numeric, 0));
	END LOOP;
	IF total <= 0 THEN RETURN 0; END IF;
	roll := random() * total;
	FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
		acc := acc + GREATEST(0, COALESCE((t ->> 'weight')::numeric, 0));
		amt := GREATEST(0, COALESCE((t ->> 'amount')::int, 0));
		EXIT WHEN roll < acc;
	END LOOP;
	IF amt > 0 THEN PERFORM public.apply_tickles(p_user, amt); END IF;
	RETURN amt;
END;
$function$;
REVOKE ALL ON FUNCTION public._barn_draw_purse(uuid) FROM PUBLIC, anon, authenticated;

-- ── 6. The herd prize tables ─────────────────────────────────────────────────

-- One committed seed per cycle. `seed_hash` is publishable the moment the seed
-- is committed; `seed` only becomes readable (through herd_prize_state) once
-- revealed_at is stamped — which happens as the week's draws are run.
CREATE TABLE IF NOT EXISTS public.herd_prize_seeds (
	iso_week     text PRIMARY KEY,
	seed         text        NOT NULL,
	seed_hash    text        NOT NULL,
	committed_at timestamptz NOT NULL DEFAULT now(),
	revealed_at  timestamptz
);
ALTER TABLE public.herd_prize_seeds ENABLE ROW LEVEL SECURITY;   -- server-only; RPCs read it
REVOKE ALL ON public.herd_prize_seeds FROM PUBLIC, anon, authenticated;

-- One draw per crew per cycle. kind 'none' records a crew where nobody dug —
-- the row exists purely so the PK makes a re-run a no-op; herd_prize_state()
-- never surfaces it.
CREATE TABLE IF NOT EXISTS public.herd_prize_draws (
	iso_week       text        NOT NULL,
	crew_id        uuid        NOT NULL REFERENCES public.crews(id) ON DELETE CASCADE,
	winner_user_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
	kind           text        NOT NULL CHECK (kind IN ('habitat', 'tickles', 'none')),
	item_id        text,
	amount         int         NOT NULL DEFAULT 0 CHECK (amount >= 0),
	-- The entrant list the draw ran over, in the order the winner key was
	-- computed — the audit trail a player recomputes the winner from.
	entrants       jsonb       NOT NULL DEFAULT '[]'::jsonb,
	winner_key     text,
	drawn_at       timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (iso_week, crew_id)
);
ALTER TABLE public.herd_prize_draws ENABLE ROW LEVEL SECURITY;   -- server-only; RPCs read it
REVOKE ALL ON public.herd_prize_draws FROM PUBLIC, anon, authenticated;

-- ── 7. The herd prize draw ───────────────────────────────────────────────────
-- Idempotent per (cycle, crew): the PK is checked before any roll, so running
-- this twice for the same cycle redraws nothing and regrants nothing.
CREATE OR REPLACE FUNCTION public._herd_prize_resolve(p_cycle text)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk       record;
	seed_txt text;
	fresh    text;
	next_key text;
	c        record;
	entrants jsonb;
	winner   uuid;
	win_key  text;
	item     text;
	amt      int;
	kind     text;
	drawn    int := 0;
BEGIN
	IF p_cycle IS NULL OR btrim(p_cycle) = '' THEN RETURN 0; END IF;
	-- Serialize the cycle: two resolvers can't both draw the same week.
	PERFORM pg_advisory_xact_lock(hashtextextended('herd_prize:' || p_cycle, 0));

	SELECT * INTO wk FROM public._barn_cycle_bounds(p_cycle);

	SELECT s.seed INTO seed_txt FROM public.herd_prize_seeds s WHERE s.iso_week = p_cycle;
	IF seed_txt IS NULL THEN
		-- First run: nothing committed a seed for this week (no prior cycle
		-- resolved), so commit one now and reveal it below, in the same breath.
		fresh := gen_random_uuid()::text;
		INSERT INTO public.herd_prize_seeds (iso_week, seed, seed_hash)
		VALUES (p_cycle, fresh, encode(sha256(fresh::bytea), 'hex'))
		ON CONFLICT (iso_week) DO NOTHING;
		SELECT s.seed INTO seed_txt FROM public.herd_prize_seeds s WHERE s.iso_week = p_cycle;
	END IF;

	FOR c IN SELECT cr.id FROM public.crews cr WHERE cr.is_bot = false ORDER BY cr.id LOOP
		CONTINUE WHEN EXISTS (
			SELECT 1 FROM public.herd_prize_draws hp
			WHERE hp.iso_week = p_cycle AND hp.crew_id = c.id);

		-- Entry: a crew member who dug at least one feeding in the cycle.
		-- Giving to a Trough is deliberately NOT an entry and never a weight.
		SELECT COALESCE(jsonb_agg(to_jsonb(m.user_id) ORDER BY m.user_id), '[]'::jsonb)
			INTO entrants
			FROM public.crew_members m
			WHERE m.crew_id = c.id
			  AND public._monday_draw_eligible(m.user_id, p_cycle, wk.starts_at, wk.ends_at);

		IF jsonb_array_length(entrants) = 0 THEN
			INSERT INTO public.herd_prize_draws
				(iso_week, crew_id, winner_user_id, kind, item_id, amount, entrants, winner_key)
			VALUES (p_cycle, c.id, NULL, 'none', NULL, 0, '[]'::jsonb, NULL);
			CONTINUE;
		END IF;

		-- Equal odds, decided by the committed seed: the largest
		-- md5(seed:crew:user) wins. A crew of one draws alone and wins.
		SELECT m.user_id, md5(seed_txt || ':' || c.id::text || ':' || m.user_id::text)
			INTO winner, win_key
			FROM public.crew_members m
			WHERE m.crew_id = c.id
			  AND public._monday_draw_eligible(m.user_id, p_cycle, wk.starts_at, wk.ends_at)
			ORDER BY md5(seed_txt || ':' || c.id::text || ':' || m.user_id::text) DESC, m.user_id
			LIMIT 1;

		item := public._barn_draw_pick(winner, p_cycle, 'all');
		IF item IS NOT NULL THEN
			PERFORM public.grant_habitat_item(winner, item, 'herd_prize', p_cycle);
			kind := 'habitat';
			amt  := 0;
		ELSE
			-- The winner already owns every for-sale furnishing. Pay a purse.
			amt  := public._barn_draw_purse(winner);
			kind := 'tickles';
		END IF;

		INSERT INTO public.herd_prize_draws
			(iso_week, crew_id, winner_user_id, kind, item_id, amount, entrants, winner_key)
		VALUES (p_cycle, c.id, winner, kind, item, amt, entrants, win_key);
		drawn := drawn + 1;
	END LOOP;

	-- Reveal this week's seed, then commit next week's (hash publishable now,
	-- seed sealed until it draws).
	UPDATE public.herd_prize_seeds
		SET revealed_at = now()
		WHERE iso_week = p_cycle AND revealed_at IS NULL;

	next_key := to_char(to_date(p_cycle, 'YYYYMMDD') + 7, 'YYYYMMDD');
	fresh    := gen_random_uuid()::text;
	INSERT INTO public.herd_prize_seeds (iso_week, seed, seed_hash)
	VALUES (next_key, fresh, encode(sha256(fresh::bytea), 'hex'))
	ON CONFLICT (iso_week) DO NOTHING;

	RETURN drawn;
END;
$function$;
REVOKE ALL ON FUNCTION public._herd_prize_resolve(text) FROM PUBLIC, anon, authenticated;

-- ── 8. herd_prize_state() — the read ─────────────────────────────────────────
-- The caller's crew only. `week` names the cycle now being run and the hash of
-- its sealed seed; `last` is that crew's most recent draw that produced a
-- winner, with the seed it ran on, so the whole thing can be recomputed by
-- hand. Crewless caller, or a crew that has never drawn → last is null.
CREATE OR REPLACE FUNCTION public.herd_prize_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid      uuid := auth.uid();
	cyc      record;
	my_crew  uuid;
	d        public.herd_prize_draws%ROWTYPE;
	seed_txt text;
	w_name   text;
	i_name   text;
	last_j   jsonb := NULL;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO cyc FROM public.race_cycle_at(public._patch_now());

	SELECT cm.crew_id INTO my_crew FROM public.crew_members cm WHERE cm.user_id = uid;
	IF my_crew IS NOT NULL THEN
		SELECT * INTO d FROM public.herd_prize_draws hp
			WHERE hp.crew_id = my_crew AND hp.kind <> 'none'
			ORDER BY hp.iso_week DESC LIMIT 1;
		IF d.iso_week IS NOT NULL THEN
			SELECT s.seed INTO seed_txt FROM public.herd_prize_seeds s
				WHERE s.iso_week = d.iso_week AND s.revealed_at IS NOT NULL;
			SELECT p.username INTO w_name FROM public.profiles p WHERE p.id = d.winner_user_id;
			IF d.item_id IS NOT NULL THEN
				SELECT i.name INTO i_name FROM public.habitat_items i WHERE i.id = d.item_id;
			END IF;
			last_j := jsonb_build_object(
				'cycle_key', d.iso_week,
				'seed', seed_txt,
				'crew_id', d.crew_id,
				'winner_user_id', d.winner_user_id,
				'winner_name', w_name,
				'kind', d.kind,
				'item_id', d.item_id,
				'item_name', i_name,
				'amount', d.amount,
				'entrants', d.entrants);
		END IF;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'week', jsonb_build_object(
			'cycle_key', cyc.cycle_key,
			'seed_hash', (SELECT s.seed_hash FROM public.herd_prize_seeds s
			              WHERE s.iso_week = cyc.cycle_key)),
		'last', last_j);
END;
$function$;
REVOKE ALL ON FUNCTION public.herd_prize_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.herd_prize_state() TO authenticated;

-- ── 9. The Trough giver's weekly receipt ─────────────────────────────────────
-- One reward per giver per ISO week, whichever Trough earned it. The PK is the
-- no-stacking rule.
CREATE TABLE IF NOT EXISTS public.trough_weekly_rewards (
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	-- The race cycle_key of the week the reward was drawn in (its Monday).
	iso_week   text        NOT NULL,
	drive_id   uuid,
	kind       text        NOT NULL CHECK (kind IN ('habitat', 'tickles')),
	item_id    text,
	amount     int         NOT NULL DEFAULT 0 CHECK (amount >= 0),
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, iso_week)
);
ALTER TABLE public.trough_weekly_rewards ENABLE ROW LEVEL SECURITY;   -- server-only; RPCs read it
REVOKE ALL ON public.trough_weekly_rewards FROM PUBLIC, anon, authenticated;

-- ── 10. trough_reward_state() — the pre-chip read ────────────────────────────
CREATE OR REPLACE FUNCTION public.trough_reward_state()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid    uuid := auth.uid();
	cyc    record;
	r      public.trough_weekly_rewards%ROWTYPE;
	i_name text;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO cyc FROM public.race_cycle_at(public._patch_now());
	SELECT * INTO r FROM public.trough_weekly_rewards t
		WHERE t.user_id = uid AND t.iso_week = cyc.cycle_key;
	IF r.item_id IS NOT NULL THEN
		SELECT i.name INTO i_name FROM public.habitat_items i WHERE i.id = r.item_id;
	END IF;
	RETURN jsonb_build_object(
		'ok', true,
		'cycle_key', cyc.cycle_key,
		'taken', r.user_id IS NOT NULL,
		'reward', CASE WHEN r.user_id IS NULL THEN NULL::jsonb
		               ELSE jsonb_build_object(
			'kind', r.kind, 'item_id', r.item_id,
			'item_name', i_name, 'amount', r.amount) END);
END;
$function$;
REVOKE ALL ON FUNCTION public.trough_reward_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trough_reward_state() TO authenticated;

-- ── 11. donate_to_drive — the quarter reward replaces the 1:100 credit ───────
-- CARRY-LATEST-DEF: body carried VERBATIM from 20260757000000_trough_quarter_
-- cap_and_72h.sql (the alphabetically-latest definition — 20260782000000 only
-- names it in comments). The ONLY change is the reward block: the
-- floor(snouts/100) credit and its profiles UPDATE are gone; in their place,
-- the quarter rule. Every other guard is untouched and in the same order.
-- item_drive_donations.tickle_reward keeps being written — 0 normally, and the
-- purse amount on the owns-the-whole-collection fallback, so the ledger still
-- tells the truth about tickles paid out of a Trough.
CREATE OR REPLACE FUNCTION public.donate_to_drive(drive_id uuid, snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	d           public.item_drives;
	bal         bigint;
	reward      int;
	now_raised  int;
	item_name   text;
	op_name     text;
	donor_row   record;
	first_today boolean;
	cap         int;
	prior_sum   int;
	at_now      timestamptz := public._patch_now();
	cyc         record;
	quarter_hit boolean := false;
	week_taken  boolean;
	prize_id    text;
	prize_name  text;
	reward_j    jsonb := NULL;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount');
	END IF;

	SELECT * INTO d FROM public.item_drives WHERE id = drive_id FOR UPDATE;
	IF d.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_drive');
	END IF;
	IF d.status <> 'open' OR d.closes_at <= now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'drive_closed');
	END IF;
	IF d.opener_user_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');  -- opener seeds via open
	END IF;
	-- Sounder-scoped: only the opener's friends can donate.
	IF NOT public.are_friends(caller_id, d.opener_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- Donating cooldown: once every 12 hours PER DRIVE (was global across all
	-- drives — chipping into one friend's Trough locked out every other
	-- friend's for 12h). dd. alias is load-bearing: unqualified drive_id here
	-- is ambiguous against the function parameter (the 20260626 42702 bug).
	IF EXISTS (
		SELECT 1 FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id
		  AND dd.drive_id = d.id
		  AND dd.created_at > now() - interval '12 hours'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donate_cooldown');
	END IF;

	-- Quarter cap (founder 2026-07-20): no single pig funds more than 25% of the
	-- target, cumulative across their chips into THIS drive. cap = ceil(target *
	-- 0.25); headroom = cap - what they've already chipped. No headroom → refuse
	-- BEFORE charging; otherwise the incoming chip is clamped to fit inside it.
	cap := CEIL(d.target_snouts * 0.25);
	SELECT COALESCE(SUM(dd.snouts), 0) INTO prior_sum
		FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id AND dd.drive_id = d.id;
	IF cap - prior_sum <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donor_cap');
	END IF;

	-- Never take more than the remaining gap, nor more than the donor's headroom.
	snouts := LEAST(snouts, d.target_snouts - d.raised_snouts, cap - prior_sum);
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_funded');
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', snouts);
	END IF;

	-- First donation of the UTC day? (checked before this donation's row exists)
	SELECT NOT EXISTS (
		SELECT 1 FROM public.item_drive_donations
		WHERE donor_user_id = caller_id
		  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	UPDATE public.profiles SET counter = counter - snouts WHERE id = caller_id;

	-- ── THE GIVER'S REWARD (2026-09-16) ──────────────────────────────────────
	-- Replaces the floor(snouts/100) tickle credit from 20260757000000 (and its
	-- profiles UPDATE — both are gone). The quarter rule: a giver earns from a
	-- Trough only once their CUMULATIVE contribution to THAT drive reaches the
	-- per-donor cap above, and only the FIRST time in an ISO week, across every
	-- Trough. The prize is a furnishing from the week's featured collection;
	-- owning the whole collection pays a tickle purse instead (never a zero).
	-- The ISO week is the CURRENT race cycle — the week being lived, not the
	-- ended one the Monday purse pays for.
	reward      := 0;
	quarter_hit := (prior_sum + snouts) >= cap;
	SELECT * INTO cyc FROM public.race_cycle_at(at_now);
	-- Serialize per giver: two chips landing at once can't both take the week.
	PERFORM pg_advisory_xact_lock(hashtextextended('trough_weekly:' || caller_id::text, 0));
	SELECT EXISTS (
		SELECT 1 FROM public.trough_weekly_rewards tw
		WHERE tw.user_id = caller_id AND tw.iso_week = cyc.cycle_key
	) INTO week_taken;

	IF quarter_hit AND NOT week_taken THEN
		prize_id := public._barn_draw_pick(caller_id, cyc.cycle_key, 'featured');
		IF prize_id IS NOT NULL THEN
			PERFORM public.grant_habitat_item(caller_id, prize_id, 'trough_quarter', cyc.cycle_key);
			SELECT i.name INTO prize_name FROM public.habitat_items i WHERE i.id = prize_id;
			INSERT INTO public.trough_weekly_rewards
				(user_id, iso_week, drive_id, kind, item_id, amount)
			VALUES (caller_id, cyc.cycle_key, d.id, 'habitat', prize_id, 0);
			reward_j := jsonb_build_object('kind', 'habitat', 'item_id', prize_id,
				'item_name', prize_name, 'amount', 0);
		ELSE
			reward := public._barn_draw_purse(caller_id);
			INSERT INTO public.trough_weekly_rewards
				(user_id, iso_week, drive_id, kind, item_id, amount)
			VALUES (caller_id, cyc.cycle_key, d.id, 'tickles', NULL, reward);
			reward_j := jsonb_build_object('kind', 'tickles', 'item_id', NULL,
				'item_name', NULL, 'amount', reward);
		END IF;
		week_taken := true;
	END IF;

	INSERT INTO public.item_drive_donations (drive_id, donor_user_id, snouts, tickle_reward)
		VALUES (drive_id, caller_id, snouts, reward);

	now_raised := d.raised_snouts + snouts;
	UPDATE public.item_drives SET raised_snouts = now_raised WHERE id = drive_id;

	-- Opener-side feedback: every chip-in drops a note into the opener's
	-- WhileAway feed ("Jen chipped in 25 — 1,775 to go"). Funded chips skip
	-- this — the funded announcement below already covers the moment.
	-- (Inline INSERT, never send_system_announcement: admin-gated rollback.)
	IF now_raised < d.target_snouts THEN
		SELECT username INTO op_name FROM public.profiles WHERE id = caller_id;
		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_chip',
			COALESCE(op_name, 'A friend') || ' chipped in!',
			COALESCE(op_name, 'A friend') || ' put ' || snouts || ' snouts in your '
				|| COALESCE(item_name, 'item') || ' Trough — '
				|| (d.target_snouts - now_raised) || ' to go.',
			jsonb_build_object('drive_id', drive_id));
	END IF;

	-- Funded → grant the item to the opener; tell the opener + every donor.
	-- (Inline INSERTs, not send_system_announcement, which is admin-gated and
	-- would roll back the donation for non-admins.) No tickle claim anymore —
	-- the donor note celebrates the item landing (spec 15, whimsy voice).
	IF now_raised >= d.target_snouts THEN
		UPDATE public.item_drives
			SET status = 'funded', granted_at = now() WHERE id = drive_id;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (d.opener_user_id, d.item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		SELECT username INTO op_name FROM public.profiles WHERE id = d.opener_user_id;

		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_funded',
			'Your Trough filled!',
			'Your Sounder came through — the ' || COALESCE(item_name, 'item')
				|| ' is yours!',
			jsonb_build_object('drive_id', drive_id));

		FOR donor_row IN
			SELECT DISTINCT dd.donor_user_id FROM public.item_drive_donations dd
			WHERE dd.drive_id = d.id
		LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				donor_row.donor_user_id, 'trough_funded',
				'You helped land it!',
				'Thanks to you, ' || COALESCE(op_name, 'a friend') || ' got the '
					|| COALESCE(item_name, 'item') || '. That''s the herd coming through!',
				jsonb_build_object('drive_id', drive_id));
		END LOOP;
	END IF;

	-- Reward the donor's engagement: +5 season XP on the first donation of the day.
	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 5); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', reward_j,
		'raised', now_raised, 'target', d.target_snouts,
		'funded', now_raised >= d.target_snouts,
		'quarter_reached', quarter_hit,
		'weekly_reward_taken', week_taken,
		'xp', CASE WHEN first_today THEN 5 ELSE 0 END);
END;
$function$;

REVOKE ALL ON FUNCTION public.donate_to_drive(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

-- ── 12. _race_pay_cycle — carried, plus the one herd-prize line ──────────────
-- CARRY-LATEST-DEF: body carried VERBATIM from 20260916110000_monday_tickle_
-- draw.sql (its alphabetically-latest definition) with EXACTLY ONE added line
-- — `PERFORM public._herd_prize_resolve(p_cycle);` — placed right after the
-- cycle_payouts idempotence guard, so the herd draws run once per cycle even
-- when the race board is empty, and never twice. Everything else (the truffle
-- ladder, the bunting spoils, the announcements, the pushes, the detail
-- payload) is unchanged.
CREATE OR REPLACE FUNCTION public._race_pay_cycle(p_cycle text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	landed   int;
	ranked_n int;
	t        record;
	m        record;
	amt      int;
	tix      int;
	dug      boolean;
	furn     jsonb;
	members  jsonb := '{}'::jsonb;
	crews_j  jsonb := '[]'::jsonb;
BEGIN
	INSERT INTO public.cycle_payouts (cycle_key)
		VALUES (p_cycle) ON CONFLICT DO NOTHING;
	GET DIAGNOSTICS landed = ROW_COUNT;
	IF landed = 0 THEN RETURN false; END IF;

	-- The Monday herd prize: one draw per crew, off the week's committed seed.
	PERFORM public._herd_prize_resolve(p_cycle);

	SELECT count(*) INTO ranked_n
		FROM public._race_table(p_cycle) rt WHERE rt.rnk IS NOT NULL;

	FOR t IN
		SELECT * FROM public._race_table(p_cycle) rt
		WHERE rt.rnk IS NOT NULL
		ORDER BY rt.rnk, rt.crew_name
	LOOP
		crews_j := crews_j || jsonb_build_object(
			'crew_id', t.crew_id, 'rank', t.rnk, 'avg', t.avg,
			'diggers', t.diggers, 'total_finds', t.total_finds);

		FOR m IN
			SELECT cm.user_id FROM public.crew_members cm
			WHERE cm.crew_id = t.crew_id ORDER BY cm.user_id
		LOOP
			amt := 0;
			tix := 0;
			furn := '[]'::jsonb;
			dug := EXISTS (
				SELECT 1 FROM public.race_digs d
				WHERE d.cycle_key = p_cycle
				  AND d.user_id = m.user_id
				  AND d.crew_id = t.crew_id
			);

			IF dug THEN
				amt := public._race_truffles_for_rank(t.rnk, ranked_n);
				BEGIN
					PERFORM public.mint_truffles(m.user_id, amt, 'race_rank', NULL);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;

				-- The spoils: Barn Bunting for every digging snout in a ranked
				-- herd; Gold Bunting on top for the winning herd's diggers.
				-- (Replaces the herd tickle payout — 2026-09-16.)
				BEGIN
					PERFORM public.grant_habitat_item(m.user_id, 'barn_bunting', 'race_spoils', p_cycle);
					furn := furn || to_jsonb('barn_bunting'::text);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;
				IF t.rnk = 1 THEN
					BEGIN
						PERFORM public.grant_habitat_item(m.user_id, 'gold_bunting', 'race_spoils_first', p_cycle);
						furn := furn || to_jsonb('gold_bunting'::text);
					EXCEPTION WHEN OTHERS THEN NULL;
					END;
				END IF;

				BEGIN
					PERFORM public.try_claim_achievements(m.user_id, 'truffles_dug');
				EXCEPTION WHEN OTHERS THEN NULL;
				END;
			END IF;

			members := members || jsonb_build_object(
				m.user_id::text,
				jsonb_build_object(
					'crew_id', t.crew_id,
					'rank', t.rnk,
					'of', ranked_n,
					'truffles_paid', amt,
					'tickles_paid', tix,
					'furnishings_paid', furn,
					'cosmetic_hat_id', NULL
				)
			);

			BEGIN
				INSERT INTO public.system_announcements (user_id, kind, title, body, data)
				VALUES (
					m.user_id,
					'race_result',
					'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
						CASE
							WHEN NOT dug THEN '.'
							WHEN amt > 0
							THEN ' — ' || amt || ' Golden Truffles and ' ||
								CASE WHEN t.rnk = 1 THEN 'Gold Bunting' ELSE 'Barn Bunting' END ||
								' for your Barn are yours.'
							ELSE ' — ' ||
								CASE WHEN t.rnk = 1 THEN 'Gold Bunting' ELSE 'Barn Bunting' END ||
								' for your Barn is yours.'
						END,
					jsonb_build_object(
						'cycle_key', p_cycle,
						'rank', t.rnk,
						'of', ranked_n,
						'truffles', amt,
						'tickles', tix,
						'furnishings', furn,
						'hat_id', NULL
					)
				);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;

			BEGIN
				PERFORM public.send_push_to_user(
					m.user_id,
					'The race is run',
					t.crew_name || ' placed ' || t.rnk || ' of ' || ranked_n ||
						' — your spoils are in.',
					jsonb_build_object(
						'kind', 'race_end',
						'cycle_key', p_cycle,
						'screen', 'season'
					)
				);
			EXCEPTION WHEN OTHERS THEN NULL;
			END;
		END LOOP;
	END LOOP;

	UPDATE public.cycle_payouts
	SET detail = jsonb_build_object(
		'ranked_count', ranked_n,
		'crews', crews_j,
		'members', members
	)
	WHERE cycle_key = p_cycle;

	RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public._race_pay_cycle(text)
	FROM PUBLIC, anon, authenticated;

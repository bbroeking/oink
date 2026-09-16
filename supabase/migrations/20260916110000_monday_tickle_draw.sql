-- ═══════════════════════════════════════════════════════════════════════════
-- MONDAY TICKLE DRAW + WEEKLY SPOILS → BARN FURNISHINGS
--
-- Spec: docs/design/season-almanac-2026-09-16/SPEC.md ("Race" panel, "Monday
-- draw" sheet, "Economy (server)"). SKILL.md lens: fair by construction (the
-- draw is server-side random, participation-gated, one per snout per week);
-- losing still feels warm (the smallest purse is still a purse, and every
-- Monday without a rare warms the next one); no shame states (nothing here
-- ever names who slept, and a herd's bottom-half finish only ever HELPS its
-- snouts' odds — it never drags anyone down).
--
-- What lands here:
--   1. app_settings.monday_draw — the tuning row (tiers, base weights, the
--      catch-up curve). Server-config-over-constants: the client prints
--      whatever this row says. EVERY NUMBER IS A PLACEHOLDER (spec: "All
--      numbers are tuning placeholders").
--   2. monday_draws — one row per (user, iso_week): the receipt of a draw.
--   3. monday_draw_state() — the read: { eligible, drawn, amount, tier,
--      mondays_since_rare, next_rare_odds_one_in, ... } for the caller.
--   4. draw_monday_purse() — the write: one draw per user per ISO week,
--      participation-gated, server-side random, minted through
--      apply_tickles() (the named applied-tickles path from 20260913120000 —
--      the same path the weekly Dig-Off spoils used, never a bare UPDATE on a
--      balance), then the receipt row. Re-calling returns the stored draw.
--   5. Weekly spoils → furnishings. _race_pay_cycle is CARRIED from
--      20260817000000 (its alphabetically-latest live definition — the
--      carry-latest-def footgun applies) with ONE delta: the herd tickle
--      payout (the profiles counter UPDATE) is REMOVED, and in its place every
--      digging snout in a ranked herd is granted `barn_bunting` and the
--      1st-place herd's diggers are also granted `gold_bunting`, through
--      grant_habitat_item() (20260910130000 — idempotent per (user, source,
--      source_ref), already-owned is a no-op receipt). Golden Truffles are
--      untouched. race_standings is CARRIED from 20260767000000 (its latest
--      def) with the `prizes` payload made honest: the tickle ladder reads 0
--      (the cycle pays no tickles now) and a `furnishings` key names the two
--      items, so the client can never advertise a purse the cycle won't pay.
--   6. gold_bunting joins the habitat_items catalog: grant-only (never for
--      sale, 0 snouts, no collection), wall decor. ART PENDING — the client
--      maps its asset key onto the barn_bunting art, tinted gold, until an
--      asset lands.
--
-- THE DRAW WEEK. The race resolves Monday 00:00 UTC; the purse is for the
-- week that JUST ENDED (the race that was run), and it stays drawable all the
-- following week, so a snout who opens the app Wednesday is not punished for
-- missing Monday. `iso_week` is the race cycle_key of that ended week (its
-- Monday, YYYYMMDD — race_cycle_at is the one clock). The clock is
-- _patch_now() (20260721: ttp.fake_now-aware), like race attribution.
--
-- ELIGIBILITY. Dug ≥1 feeding in the draw week: a rooting_receipts row
-- (20260913010000 — every dig, crewed or not) created inside the week, OR a
-- race_digs row for the cycle (digs that predate durable receipts).
--
-- CATCH-UP (soft pity). steps = mondays_since_rare (+1 when the snout's herd
-- finished in the bottom half of that week's board). multiplier =
-- LEAST(cap, 1 + step × GREATEST(0, steps − after_mondays + 1)) — with the
-- placeholder row: ×1 for 0–1, ×1.5 after two, ×2 after three, ×2.5, then
-- capped at ×3. The multiplier scales the rare + jackpot weights only.
-- mondays_since_rare counts consecutive PRIOR DRAWS below rare; a week with no
-- draw (didn't dig) is simply absent and does not reset the streak.
--
-- Migrations are written, not pushed — do not push without Brian's "go".
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tuning — ALL PLACEHOLDERS ─────────────────────────────────────────────
-- tiers: amount + base weight per tier (weights are relative, not %).
-- catchup: after_mondays = the streak length at which the first raise lands;
--   step = the raise per further Monday; cap = the ceiling multiplier;
--   bottom_half_step = the extra steps a bottom-half herd finish adds.
-- utils/mondayDraw.ts MONDAY_DRAW_TUNING is the compiled fallback and MUST
-- mirror this row.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'monday_draw',
	'{
		"tiers": [
			{"tier": "common",  "amount": 20,  "weight": 60},
			{"tier": "good",    "amount": 60,  "weight": 28},
			{"tier": "rare",    "amount": 150, "weight": 10},
			{"tier": "jackpot", "amount": 400, "weight": 2}
		],
		"catchup": {"after_mondays": 2, "step": 0.5, "cap": 3, "bottom_half_step": 1}
	}'::jsonb,
	'Monday tickle draw (20260916110000): per-tier amount + base weight, and the catch-up curve (multiplier on the rare+jackpot weights = LEAST(cap, 1 + step * GREATEST(0, steps - after_mondays + 1)); steps = consecutive prior draws below rare, + bottom_half_step when the herd finished in the bottom half). All numbers are tuning placeholders. utils/mondayDraw.ts MONDAY_DRAW_TUNING is the compiled fallback.'
)
ON CONFLICT (key) DO UPDATE SET
	value = EXCLUDED.value,
	description = EXCLUDED.description,
	updated_at = now();

-- ── 2. The receipt table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.monday_draws (
	user_id                   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	-- The race cycle_key of the ISO week the purse is for (its Monday, YYYYMMDD).
	iso_week                  text        NOT NULL,
	tier                      text        NOT NULL CHECK (tier IN ('common', 'good', 'rare', 'jackpot')),
	amount                    int         NOT NULL CHECK (amount >= 0),
	-- The catch-up inputs the roll used — the audit trail for "why these odds".
	mondays_since_rare_before int         NOT NULL DEFAULT 0 CHECK (mondays_since_rare_before >= 0),
	herd_bottom_half          boolean     NOT NULL DEFAULT false,
	drawn_at                  timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, iso_week)
);
ALTER TABLE public.monday_draws ENABLE ROW LEVEL SECURITY;   -- server-only; RPCs read it
REVOKE ALL ON public.monday_draws FROM PUBLIC, anon, authenticated;

-- ── 3. gold_bunting joins the catalog (grant-only; art pending) ──────────────
INSERT INTO public.habitat_items
	(id, name, description, category, rarity, asset_key, snout_cost, is_for_sale, display_order)
VALUES (
	'gold_bunting', 'Gold Bunting',
	'Gilded pennants strung for the herd that dug the most in one week.',
	'wall_decor', 'rare', 'gold_bunting', 0, false, 65
)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	category = EXCLUDED.category,
	rarity = EXCLUDED.rarity,
	snout_cost = EXCLUDED.snout_cost,
	is_for_sale = EXCLUDED.is_for_sale;

-- ── 4. Draw helpers (server-only) ────────────────────────────────────────────

-- The tuning row, with the compiled placeholders as the fallback so a database
-- that lost the row still draws sensibly.
CREATE OR REPLACE FUNCTION public._monday_draw_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'monday_draw'),
		'{"tiers":[{"tier":"common","amount":20,"weight":60},{"tier":"good","amount":60,"weight":28},{"tier":"rare","amount":150,"weight":10},{"tier":"jackpot","amount":400,"weight":2}],"catchup":{"after_mondays":2,"step":0.5,"cap":3,"bottom_half_step":1}}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_tuning() FROM PUBLIC, anon, authenticated;

-- The draw week for a clock reading: the cycle that ENDED most recently.
CREATE OR REPLACE FUNCTION public._monday_draw_week(p_at timestamptz)
RETURNS TABLE (cycle_key text, starts_at timestamptz, ends_at timestamptz)
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
	SELECT * FROM public.race_cycle_at(p_at - interval '7 days');
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_week(timestamptz) FROM PUBLIC, anon, authenticated;

-- The catch-up multiplier for a number of steps (see the header formula).
CREATE OR REPLACE FUNCTION public._monday_draw_multiplier(p_steps int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT LEAST(
		COALESCE((t -> 'catchup' ->> 'cap')::numeric, 3),
		1 + COALESCE((t -> 'catchup' ->> 'step')::numeric, 0.5)
		    * GREATEST(0, COALESCE(p_steps, 0)
		                  - COALESCE((t -> 'catchup' ->> 'after_mondays')::int, 2) + 1))
	FROM public._monday_draw_tuning() t;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_multiplier(int) FROM PUBLIC, anon, authenticated;

-- "1 in N" for rare-or-better under a multiplier: the boosted rare + jackpot
-- weight over the boosted total, rounded to the nearest whole N (never < 1).
-- utils/mondayDraw.ts oddsOneIn() mirrors this exactly.
CREATE OR REPLACE FUNCTION public._monday_draw_odds_one_in(p_multiplier numeric)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH w AS (
		SELECT
			sum(CASE WHEN x ->> 'tier' IN ('rare', 'jackpot') THEN (x ->> 'weight')::numeric ELSE 0 END) AS hot,
			sum(CASE WHEN x ->> 'tier' IN ('rare', 'jackpot') THEN 0 ELSE (x ->> 'weight')::numeric END) AS cold
		FROM public._monday_draw_tuning() t, jsonb_array_elements(t -> 'tiers') x
	)
	SELECT CASE
		WHEN hot * p_multiplier <= 0 THEN 2147483647
		ELSE GREATEST(1, round((cold + hot * p_multiplier) / (hot * p_multiplier)))::int
	END
	FROM w;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_odds_one_in(numeric) FROM PUBLIC, anon, authenticated;

-- Consecutive prior draws below rare, walking back from (and excluding) the
-- given week. A week without a draw is simply absent — it neither counts nor
-- resets.
CREATE OR REPLACE FUNCTION public._monday_draw_streak_before(p_user uuid, p_week text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH ordered AS (
		SELECT d.tier, row_number() OVER (ORDER BY d.iso_week DESC) AS rn
		FROM public.monday_draws d
		WHERE d.user_id = p_user AND d.iso_week < p_week
	)
	SELECT COALESCE(
		(SELECT min(rn) FROM ordered WHERE tier IN ('rare', 'jackpot')),
		(SELECT count(*) FROM ordered) + 1)::int - 1;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_streak_before(uuid, text) FROM PUBLIC, anon, authenticated;

-- Did the snout's herd (the crew it dug with that week) finish in the bottom
-- half of the ranked board? Unranked / no herd → false (never a penalty; the
-- flag can only warm a draw).
CREATE OR REPLACE FUNCTION public._monday_draw_herd_bottom_half(p_user uuid, p_week text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	WITH my_crew AS (
		SELECT d.crew_id FROM public.race_digs d
		WHERE d.cycle_key = p_week AND d.user_id = p_user
		GROUP BY d.crew_id ORDER BY sum(d.finds) DESC, d.crew_id LIMIT 1
	),
	board AS (
		SELECT rt.crew_id, rt.rnk,
		       count(*) OVER () AS ranked_n
		FROM public._race_table(p_week) rt WHERE rt.rnk IS NOT NULL
	)
	SELECT COALESCE(
		(SELECT b.rnk > ceil(b.ranked_n / 2.0)::int
		 FROM board b JOIN my_crew mc ON mc.crew_id = b.crew_id),
		false);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_herd_bottom_half(uuid, text) FROM PUBLIC, anon, authenticated;

-- Did the snout dig at least one feeding inside the week?
CREATE OR REPLACE FUNCTION public._monday_draw_eligible(
	p_user uuid, p_week text, p_starts timestamptz, p_ends timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT EXISTS (
		SELECT 1 FROM public.rooting_receipts r
		WHERE r.user_id = p_user AND r.created_at >= p_starts AND r.created_at < p_ends
	) OR EXISTS (
		SELECT 1 FROM public.race_digs d
		WHERE d.cycle_key = p_week AND d.user_id = p_user
	);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_eligible(uuid, text, timestamptz, timestamptz)
	FROM PUBLIC, anon, authenticated;

-- The one snapshot both RPCs return. `next_rare_odds_one_in` is the odds of
-- the NEXT undrawn purse: this week's (with the herd flag known) when not yet
-- drawn; next week's (herd flag unknown → the floor, which can only warm)
-- once drawn. `mondays_since_rare` includes this week's draw once it exists.
CREATE OR REPLACE FUNCTION public._monday_draw_snapshot(p_user uuid, p_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk          record;
	row_d       public.monday_draws%ROWTYPE;
	tuning      jsonb := public._monday_draw_tuning();
	eligible    boolean := false;
	streak      int;
	bottom      boolean := false;
	steps       int;
	one_in      int;
	bottom_step int := COALESCE((tuning -> 'catchup' ->> 'bottom_half_step')::int, 1);
BEGIN
	SELECT * INTO wk FROM public._monday_draw_week(p_at);
	IF p_user IS NOT NULL THEN
		eligible := public._monday_draw_eligible(p_user, wk.cycle_key, wk.starts_at, wk.ends_at);
		SELECT * INTO row_d FROM public.monday_draws
			WHERE user_id = p_user AND iso_week = wk.cycle_key;
	END IF;

	IF row_d.user_id IS NOT NULL THEN
		streak := CASE WHEN row_d.tier IN ('rare', 'jackpot') THEN 0
		               ELSE row_d.mondays_since_rare_before + 1 END;
		bottom := row_d.herd_bottom_half;
		steps  := streak;                       -- next week's herd flag is unknown
	ELSE
		streak := CASE WHEN p_user IS NULL THEN 0
		               ELSE public._monday_draw_streak_before(p_user, wk.cycle_key) END;
		bottom := CASE WHEN p_user IS NULL THEN false
		               ELSE public._monday_draw_herd_bottom_half(p_user, wk.cycle_key) END;
		steps  := streak + CASE WHEN bottom THEN bottom_step ELSE 0 END;
	END IF;
	one_in := public._monday_draw_odds_one_in(public._monday_draw_multiplier(steps));

	RETURN jsonb_build_object(
		'ok', true,
		'week', wk.cycle_key,
		'week_starts_at', wk.starts_at,
		'week_ends_at', wk.ends_at,
		'eligible', eligible,
		'drawn', row_d.user_id IS NOT NULL,
		'amount', row_d.amount,
		'tier', row_d.tier,
		'mondays_since_rare', streak,
		'herd_bottom_half', bottom,
		'next_rare_odds_one_in', one_in,
		'tiers', tuning -> 'tiers',
		'catchup', tuning -> 'catchup');
END;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_snapshot(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ── 5. The RPCs ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.monday_draw_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public._monday_draw_snapshot(auth.uid(), public._patch_now());
$function$;
REVOKE ALL ON FUNCTION public.monday_draw_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monday_draw_state() TO authenticated;

-- One purse per snout per ISO week. Participation-gated. Server-side random.
-- Minted through apply_tickles (the count + the snouts, never the spendable
-- bank, never a bare UPDATE). Re-calling after a draw returns the stored draw
-- — idempotent by the (user_id, iso_week) primary key under a per-user lock.
CREATE OR REPLACE FUNCTION public.draw_monday_purse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid       uuid := auth.uid();
	at_now    timestamptz := public._patch_now();
	wk        record;
	tuning    jsonb := public._monday_draw_tuning();
	existing  public.monday_draws%ROWTYPE;
	streak    int;
	bottom    boolean;
	steps     int;
	mult      numeric;
	total     numeric := 0;
	roll      numeric;
	acc       numeric := 0;
	t         jsonb;
	w         numeric;
	hit_tier  text := NULL;
	hit_amt   int := 0;
	snap      jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO wk FROM public._monday_draw_week(at_now);

	-- Serialize per snout: two taps can't both roll.
	PERFORM pg_advisory_xact_lock(hashtextextended('monday_draw:' || uid::text, 0));

	SELECT * INTO existing FROM public.monday_draws
		WHERE user_id = uid AND iso_week = wk.cycle_key;
	IF existing.user_id IS NOT NULL THEN
		RETURN public._monday_draw_snapshot(uid, at_now);
	END IF;

	IF NOT public._monday_draw_eligible(uid, wk.cycle_key, wk.starts_at, wk.ends_at) THEN
		RETURN public._monday_draw_snapshot(uid, at_now)
			|| jsonb_build_object('ok', false, 'reason', 'not_eligible');
	END IF;

	streak := public._monday_draw_streak_before(uid, wk.cycle_key);
	bottom := public._monday_draw_herd_bottom_half(uid, wk.cycle_key);
	steps  := streak + CASE WHEN bottom
	                        THEN COALESCE((tuning -> 'catchup' ->> 'bottom_half_step')::int, 1)
	                        ELSE 0 END;
	mult   := public._monday_draw_multiplier(steps);

	-- Weighted roll: rare + jackpot weights carry the catch-up multiplier.
	FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
		w := (t ->> 'weight')::numeric
		     * CASE WHEN t ->> 'tier' IN ('rare', 'jackpot') THEN mult ELSE 1 END;
		total := total + w;
	END LOOP;
	roll := random() * total;
	FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
		w := (t ->> 'weight')::numeric
		     * CASE WHEN t ->> 'tier' IN ('rare', 'jackpot') THEN mult ELSE 1 END;
		acc := acc + w;
		hit_tier := t ->> 'tier';
		hit_amt  := (t ->> 'amount')::int;
		EXIT WHEN roll < acc;
	END LOOP;
	IF hit_tier IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_tiers');
	END IF;

	-- The receipt first (the PK is the idempotence lock), then the mint.
	INSERT INTO public.monday_draws
		(user_id, iso_week, tier, amount, mondays_since_rare_before, herd_bottom_half, drawn_at)
	VALUES (uid, wk.cycle_key, hit_tier, hit_amt, streak, bottom, at_now);

	PERFORM public.apply_tickles(uid, hit_amt);

	snap := public._monday_draw_snapshot(uid, at_now);
	RETURN snap || jsonb_build_object('amount', hit_amt, 'tier', hit_tier);
END;
$function$;
REVOKE ALL ON FUNCTION public.draw_monday_purse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_monday_purse() TO authenticated;

-- ── 6. Weekly spoils → furnishings ───────────────────────────────────────────
-- Carry-latest-def: _race_pay_cycle from 20260817000000_auto_apply_weekly_dig_
-- tickles.sql, VERBATIM except the documented delta: the tickle payout block
-- (the profiles counter UPDATE) is gone; in its place the two habitat grants.
-- `tickles_paid` stays in the members detail (always 0 now) so shipped clients
-- that read race_standings().last keep parsing; `furnishings_paid` is new.
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

-- ── 7. race_standings — carried from 20260767000000; `prizes` made honest ────
-- VERBATIM except the `prizes` block: the tickle ladder reads 0 on every rung
-- (the cycle pays no tickles), and `furnishings` names the two spoils so the
-- client draws the Monday's-spoils cards from the server.
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
	season    jsonb;
	mine_season jsonb := NULL;
	prizes    jsonb;
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

	-- Season-cumulative board: SUM(finds) DESC over ALL race_digs, dense rank,
	-- no quorum (accumulation, not weekly fairness), bot excluded.
	WITH per_crew AS (
		SELECT d.crew_id,
		       sum(d.finds)::int AS total_finds,
		       count(DISTINCT d.user_id)::int AS diggers
		FROM public.race_digs d
		JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
		GROUP BY d.crew_id
		HAVING sum(d.finds) >= 1
	),
	board AS (
		SELECT pc.*, c.name,
		       (DENSE_RANK() OVER (ORDER BY pc.total_finds DESC))::int AS rnk,
		       (SELECT count(*)::int FROM public.crew_members cm
		        WHERE cm.crew_id = pc.crew_id) AS roster_size
		FROM per_crew pc JOIN public.crews c ON c.id = pc.crew_id
	)
	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'rank', b.rnk, 'crew_id', b.crew_id, 'name', b.name,
			'total_finds', b.total_finds, 'diggers', b.diggers,
			'roster_size', b.roster_size)
		ORDER BY b.rnk, b.name), '[]'::jsonb) INTO season
		FROM board b;

	-- The weekly spoils. Tickles: none — the cycle pays furnishings now
	-- (2026-09-16); the rungs stay so shipped clients keep parsing, and read 0
	-- so none of them can advertise a purse the cycle won't pay. Truffles are
	-- read from the payout helper so the strip is exactly what the cycle pays.
	prizes := jsonb_build_object(
		'tickles', jsonb_build_object(
			'first', 0, 'second', 0, 'third', 0,
			'upper', 0, 'field', 0, 'participation', 0),
		'truffles', jsonb_build_object(
			'first',  public._race_truffles_for_rank(1, 3),
			'second', public._race_truffles_for_rank(2, 3),
			'third',  public._race_truffles_for_rank(3, 3),
			'upper',  public._race_truffles_for_rank(4, 100),
			'field',  public._race_truffles_for_rank(4, 4)),
		'furnishings', jsonb_build_object(
			'all_who_dug', 'barn_bunting',
			'first', 'gold_bunting'));

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
			-- The caller's crew on the season board (null until its first find).
			WITH per_crew AS (
				SELECT d.crew_id, sum(d.finds)::int AS total_finds
				FROM public.race_digs d
				JOIN public.crews c ON c.id = d.crew_id AND c.is_bot = false
				GROUP BY d.crew_id
				HAVING sum(d.finds) >= 1
			),
			board AS (
				SELECT pc.crew_id, pc.total_finds,
				       (DENSE_RANK() OVER (ORDER BY pc.total_finds DESC))::int AS rnk
				FROM per_crew pc
			)
			SELECT jsonb_build_object('rank', b.rnk, 'total_finds', b.total_finds)
				INTO mine_season FROM board b WHERE b.crew_id = my_crew;
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
		'ranked', ranked, 'unranked', unranked, 'mine', mine, 'last', last_res,
		'season', season, 'mine_season', mine_season, 'prizes', prizes);
END;
$function$;
REVOKE ALL ON FUNCTION public.race_standings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.race_standings() TO authenticated;

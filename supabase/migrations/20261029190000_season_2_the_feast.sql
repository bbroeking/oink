-- ═══════════════════════════════════════════════════════════════════════════
-- SEASON 2, "THE FEAST": seeded DARK, flipped later by one service-role call
--
-- Spec: docs/explorations/2026-10-29-season-2/proposal.md (concept A, §2, §3),
-- with the founder's 2026-10-29 rulings: concept = The Feast; reset = "Full
-- fresh start", applied BY THE FLIP, never before.
--
-- Pushing this file changes NOTHING a live player can see, except two
-- server-side facts that are invisible until the flip:
--   • the founder's account previews Season 2 (feature_overrides.season_preview)
--   • three Slop Club members' pieces join the pass and leave the members'
--     shelf (frosted_cupcake_crown, whipped_swirl_cap, confection_counter_bg;
--     the sync_pass_exclusive trigger flags every pinned pass cosmetic, the
--     2026-09-16 "a pass reward is the pass's" ruling). The reserved nine are
--     already pass_exclusive (20260916150000).
--
-- What lands here:
--   1. seasons row snout_season_2 'The Feast' at a FAR-FUTURE placeholder
--      window (2099). No date ever auto-starts it: only flip_season_2() does,
--      so the reset can never be skipped by a calendar.
--   2. Six season titles (earn-only).
--   3. The 30-tier track. Free: tickles (S1's ladder), six titles, one Barn
--      furnishing (rolling_pie_cart, habitat). Premium: cosmetics only, the
--      nine reserved for this season by 20260792000000 (its no-op UPDATEs,
--      rewritten here as real rows at the same tiers) plus three bakery
--      members' pieces at 10 / 20 / 30. No tickles, no boosts on premium.
--      The Halloween items the proposal floated have NO hats rows in any
--      migration, so none are pinned.
--   4. active_season(): the world_boss -> snout_season_1 pin is replaced by an
--      explicit feature_overrides.season_preview that only applies to a season
--      that has NOT STARTED yet (so it can never strand anyone after a flip).
--      The founder's row gets season_preview = 'snout_season_2'.
--   5. hunger_meter(): reads total - baseline (app_settings.season_meter),
--      thresholds optionally from the same row; same six stage ids, same shape.
--      The Feast's client re-reads it as the Larder filling.
--   6. LEFTOVERS: a Monday purse that pays below rare (no rare, no jackpot
--      roll won) leaves one ball in the next week's drum. Capped at one (the
--      PK), counted only in a week with at least one dig (no free roll chain
--      for a pig who stopped digging), gated on
--      app_settings.monday_draw_leftovers.enabled, which only the flip turns on.
--      monday_draw_state() / draw_monday_purse() gain `leftover_balls` (the
--      drawable week) and `running_leftover_balls` (the week in progress);
--      `balls` stays digs-only; both odds fields include the leftover.
--   7. The Board, baselined: profiles.season_tickles_earned is a STORED
--      generated column (tickles_earned - tickles_board_baseline). Baseline 0
--      until the flip, so it equals tickles_earned today; the flip snapshots
--      the S1 Board into season1_tickle_standings and sets the baseline. The
--      lifetime number (tickles_earned, the earned stamp) is never touched.
--      app_settings.board_sort_column tells today's client which column to
--      rank by ('tickles_earned' until the flip).
--   8. The full-fresh-start reset, configurable in
--      app_settings.season2_reset_scope {"tickle_bank","snouts","satchel"}:
--      per player, the flip ARCHIVES then zeroes the spendable tickle bank
--      (user_items), snouts (profiles.counter) and Satchel contents
--      (satchel_items rows) into season_reset_archive (user, season, kind),
--      so unflip_season_2() restores exactly what was wiped (additively: any
--      activity after the flip is kept on top).
--      KEPT, never touched: user_hats / titles / habitat items / keepsakes,
--      Slop Club (is_vip) + purchase records, tickles_earned +
--      tickles_lifetime_base, golden_truffles, wallow_count, satchel_met /
--      Field Guide discovery, friends + Sounders.
--   9. flip_season_2(p_at, p_weeks) / unflip_season_2(): idempotent (guarded
--      by app_config.season2_flipped + an advisory lock), service-role only.
--  10. my_season_reset(): the caller's own list of buckets the flip zeroed
--      (non-zero archives only), for today's one-time "fresh start" card.
--
-- NOT HERE (handled elsewhere): the Great Hunger bridge extension and
-- app_settings.min_build (20261029180000).
--
-- CARRY-LATEST-DEF (the 2026-09 footgun). Every CREATE OR REPLACE below starts
-- from the alphabetically-latest definition across ALL migrations, pending
-- ones included (20260922100000_endless_wallow.sql and later redefine none of
-- these; grepped 2026-10-29):
--   • active_season()            <- 20260709000000_season_renumber.sql
--   • hunger_meter()             <- 20260714000000_coop_dig_rebuild.sql
--   • _monday_draw_snapshot(uuid,timestamptz)
--                                <- 20260921150000_drum_draw.sql
--   • monday_draw_state()        <- 20260921150000_drum_draw.sql (body unchanged;
--                                   re-stated so the grant is explicit)
--   • draw_monday_purse()        <- 20260921150000_drum_draw.sql
--   Delta in each is documented at the function. Nothing else moves.
--
-- THE FLIP, as a runbook (a Monday 00:00 UTC, the drum's week boundary):
--   0. Check `supabase migration list --linked`; this file must be pushed.
--   1. The day before: SELECT public.grant_season1_finale(); (manual, nothing
--      else fires the Hungerer's Crown).
--   2. Review app_settings.season2_reset_scope (all true = full fresh start).
--   3. SELECT public.flip_season_2('2026-11-16 00:00:00+00');   -- or now()
--   4. Raise app_settings.min_build to today's build (20261029180000 header).
--   5. Verify as a real user (set_config request.jwt.claims):
--      SELECT id FROM active_season(); SELECT season_state()->>'active';
--   6. Announce with an INLINE system_announcements INSERT.
--   Reverse: SELECT public.unflip_season_2();
--
-- Migration AUTHORED ONLY. Never `db push` without the founder's explicit go.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. The season row, dark ──────────────────────────────────────────────────
-- 2099, not the S0->S1 playbook's 2027-01-01: the reset lives in the flip, so a
-- calendar must never start this season on its own.
INSERT INTO public.seasons
	(id, name, starts_at, ends_at, total_tiers, xp_per_tier, premium_price_cents, premium_plus_price_cents)
VALUES (
	'snout_season_2',
	'The Feast',
	'2099-01-01 00:00:00+00',
	'2099-02-26 00:00:00+00',
	30, 100, 299, 999
)
ON CONFLICT (id) DO NOTHING;


-- ── 2. Titles (earn-only; ids = title_id_from_name(name)) ────────────────────
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('trencherman',       'Trencherman',       'pre',  'Ate a hearty share at the long table.',     'season', false, 506),
	('of_the_long_table', 'Of the Long Table', 'post', 'Had a seat saved at the Feast.',            'season', false, 507),
	('larder_keeper',     'Larder Keeper',     'pre',  'Kept the Larder full all winter.',          'season', false, 508),
	('second_helpings',   'Second Helpings',   'post', 'Went back for more, and nobody minded.',    'season', false, 509),
	('the_well_rested',   'The Well-Rested',   'post', 'Napped off the Feast in the warm hay.',     'season', false, 510),
	('feast_bringer',     'Feast-Bringer',     'post', 'Carried the last truffle to the table.',    'season', false, 511)
ON CONFLICT (id) DO NOTHING;


-- ── 3. The track ─────────────────────────────────────────────────────────────
-- Cosmetic rows pin hat_id (claim_tier_reward + sync_pass_exclusive resolve it).
-- The habitat row pins item_id (20260916100000's branch). The tier-30 free
-- finale carries the generic `tickles` bonus key (20260659000000), as S1's did.
INSERT INTO public.season_tiers (season_id, tier, track, reward_type, reward_value, display_label) VALUES
-- free
('snout_season_2',  1, 'free',    'tickles',    '{"amount": 25}',                               '25 tickles'),
('snout_season_2',  3, 'free',    'title',      '{"title": "Trencherman"}',                     'Title: Trencherman'),
('snout_season_2',  5, 'free',    'tickles',    '{"amount": 50}',                               '50 tickles'),
('snout_season_2',  7, 'free',    'tickles',    '{"amount": 50}',                               '50 tickles'),
('snout_season_2',  9, 'free',    'title',      '{"title": "Of the Long Table"}',               'Title: Of the Long Table'),
('snout_season_2', 11, 'free',    'tickles',    '{"amount": 75}',                               '75 tickles'),
('snout_season_2', 13, 'free',    'tickles',    '{"amount": 75}',                               '75 tickles'),
('snout_season_2', 15, 'free',    'title',      '{"title": "Larder Keeper"}',                   'Title: Larder Keeper'),
('snout_season_2', 17, 'free',    'tickles',    '{"amount": 100}',                              '100 tickles'),
('snout_season_2', 19, 'free',    'tickles',    '{"amount": 100}',                              '100 tickles'),
('snout_season_2', 21, 'free',    'title',      '{"title": "Second Helpings"}',                 'Title: Second Helpings'),
('snout_season_2', 22, 'free',    'habitat',    '{"item_id": "rolling_pie_cart"}',              'Rolling Pie Cart'),
('snout_season_2', 24, 'free',    'title',      '{"title": "The Well-Rested"}',                 'Title: The Well-Rested'),
('snout_season_2', 26, 'free',    'tickles',    '{"amount": 200}',                              '200 tickles'),
('snout_season_2', 28, 'free',    'tickles',    '{"amount": 250}',                              '250 tickles'),
('snout_season_2', 30, 'free',    'title',      '{"title": "Feast-Bringer", "tickles": 500}',   'Title: Feast-Bringer + 500 tickles'),
-- premium: the reserved nine (20260792000000's tiers, types, labels) ...
('snout_season_2',  2, 'premium', 'hat',        '{"hat_id": "ganache_truffle_crown"}',          'Ganache Truffle Crown'),
('snout_season_2',  5, 'premium', 'hat',        '{"hat_id": "slop_pail_topper"}',               'Slop Pail Topper'),
('snout_season_2',  8, 'premium', 'held',       '{"hat_id": "truffle_medal_held"}',             'Grand Trough Medal'),
('snout_season_2', 12, 'premium', 'aura',       '{"hat_id": "drip_glaze_aura"}',                'Drip Glaze Aura'),
('snout_season_2', 14, 'premium', 'background', '{"hat_id": "spa_wallow_bg"}',                  'Truffle Spa Wallow'),
('snout_season_2', 16, 'premium', 'glasses',    '{"hat_id": "cocoa_sheen_specs"}',              'Cocoa Sheen Specs'),
('snout_season_2', 21, 'premium', 'bow',        '{"hat_id": "caramel_drip_bow"}',               'Caramel Drip Bow'),
('snout_season_2', 27, 'premium', 'held',       '{"hat_id": "corn_on_the_cob"}',                'Corn on the Cob'),
('snout_season_2', 29, 'premium', 'hat',        '{"hat_id": "slop_club_signet_crown"}',         'Slop Club Signet Crown'),
-- ... and three bakery pieces (members' art shipped since 2026-06-29)
('snout_season_2', 10, 'premium', 'hat',        '{"hat_id": "frosted_cupcake_crown"}',          'Frosted Cupcake Crown'),
('snout_season_2', 20, 'premium', 'hat',        '{"hat_id": "whipped_swirl_cap"}',              'Whipped Swirl Cap'),
('snout_season_2', 30, 'premium', 'background', '{"hat_id": "confection_counter_bg"}',          'Confection Counter background')
ON CONFLICT (season_id, tier, track) DO NOTHING;


-- ── 4. active_season(): season_preview replaces the world_boss pin ───────────
-- Carried from 20260709000000_season_renumber.sql. Delta: the CASE that pinned
-- every world_boss caller to snout_season_1 forever is gone. In its place a
-- caller whose feature_overrides.season_preview names a season that has NOT
-- STARTED YET gets that season; everyone else (and the preview account once
-- the previewed season is live, or after it ends) gets the date window, newest
-- first, exactly as before. world_boss itself stays true and keeps meaning
-- "the dig exists".
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH pv AS (
    SELECT p.feature_overrides ->> 'season_preview' AS season_id
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL AND p.id = auth.uid()
  )
  SELECT s.* FROM public.seasons s
  WHERE
    (s.id = (SELECT season_id FROM pv) AND s.starts_at > now())
    OR (s.starts_at <= now() AND s.ends_at >= now())
  ORDER BY
    (s.id = (SELECT season_id FROM pv) AND s.starts_at > now()) DESC NULLS LAST,
    s.starts_at DESC
  LIMIT 1;
$function$;

-- The founder previews Season 2 (the world_boss override stays: it gates the dig).
UPDATE public.profiles
	SET feature_overrides = COALESCE(feature_overrides, '{}'::jsonb)
		|| '{"season_preview": "snout_season_2"}'::jsonb
	WHERE lower(username) = 'brian';


-- ── 5. hunger_meter(): the season baseline ───────────────────────────────────
-- Carried from 20260714000000_coop_dig_rebuild.sql. Delta: when
-- app_settings.season_meter carries a `baseline` (written by flip_season_2),
-- total = hunger_drain.total - baseline (never below 0), and a valid
-- `thresholds` array in the same row (5 ascending positive ints) replaces the
-- compiled ladder. Without a baseline the row is ignored entirely, so
-- thresholds can be tuned ahead of the flip without moving S1's meter. Same six stage ids, same payload keys: old binaries keep
-- working (they will read the Feast's meter with S1 copy, a known cosmetic
-- mismatch, proposal §0.3).
CREATE OR REPLACE FUNCTION public.hunger_meter()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	thresholds  bigint[] := ARRAY[600, 1800, 3600, 6000, 9000];
	stage_names CONSTANT text[]   :=
		ARRAY['gorged', 'stuffed', 'full', 'peckish', 'hungry', 'famished'];
	total       bigint := 0;
	stage_idx   int := 0;   -- 0=gorged … 5=famished
	next_thresh bigint := NULL;
	i           int;
	meter       jsonb;
	tuned       bigint[];
	baseline    bigint := 0;
BEGIN
	SELECT COALESCE(hd.total, 0) INTO total FROM public.hunger_drain hd WHERE hd.id = true;
	total := COALESCE(total, 0);

	-- Only a row carrying a baseline is a live season meter: tuned thresholds
	-- sit dormant until the flip writes one (and again after an unflip).
	SELECT value INTO meter FROM public.app_settings WHERE key = 'season_meter';
	IF meter IS NOT NULL AND jsonb_typeof(meter -> 'baseline') = 'number' THEN
		baseline := GREATEST(0, (meter ->> 'baseline')::bigint);
		IF jsonb_typeof(meter -> 'thresholds') = 'array'
		   AND jsonb_array_length(meter -> 'thresholds') = 5 THEN
			BEGIN
				SELECT array_agg(x::bigint ORDER BY o) INTO tuned
					FROM jsonb_array_elements_text(meter -> 'thresholds') WITH ORDINALITY t(x, o);
				IF tuned[1] > 0 AND tuned[1] < tuned[2] AND tuned[2] < tuned[3]
				   AND tuned[3] < tuned[4] AND tuned[4] < tuned[5] THEN
					thresholds := tuned;
				END IF;
			EXCEPTION WHEN OTHERS THEN
				NULL;   -- a malformed row never breaks the meter
			END;
		END IF;
	END IF;
	total := GREATEST(0, total - baseline);

	FOR i IN 1 .. array_length(thresholds, 1) LOOP
		IF total >= thresholds[i] THEN stage_idx := i; END IF;
	END LOOP;
	IF stage_idx < array_length(thresholds, 1) THEN
		next_thresh := thresholds[stage_idx + 1];
	END IF;
	RETURN jsonb_build_object(
		'available',      true,
		'total',          total,
		'stage',          stage_names[stage_idx + 1],
		'stage_index',    stage_idx,
		'next_threshold', next_thresh
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.hunger_meter() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hunger_meter() TO authenticated;


-- ── 6. Leftovers ─────────────────────────────────────────────────────────────
-- One row = one ball carried into `to_week`'s drum. PK (user, to_week) is the
-- cap at one. Written by draw_monday_purse() only.
CREATE TABLE IF NOT EXISTS public.monday_draw_leftovers (
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	from_week  text        NOT NULL,
	to_week    text        NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, to_week)
);
ALTER TABLE public.monday_draw_leftovers ENABLE ROW LEVEL SECURITY;   -- server-only
REVOKE ALL ON public.monday_draw_leftovers FROM PUBLIC, anon, authenticated;

-- The receipt keeps how many leftover balls rolled with the digs.
ALTER TABLE public.monday_draws
	ADD COLUMN IF NOT EXISTS leftover_balls int NOT NULL DEFAULT 0 CHECK (leftover_balls >= 0);

-- Dark until the flip. The flip sets enabled=true; unflip sets it back.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'monday_draw_leftovers',
	'{"enabled": false}'::jsonb,
	'Season 2 Leftovers: a purse below rare leaves one ball for next week. Turned on by flip_season_2().'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public._monday_draw_leftovers_on()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT CASE WHEN jsonb_typeof(value -> 'enabled') = 'boolean'
		             THEN (value ->> 'enabled')::boolean END
		 FROM public.app_settings WHERE key = 'monday_draw_leftovers'),
		false);
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_leftovers_on() FROM PUBLIC, anon, authenticated;

-- 0 or 1: the leftover waiting in `p_week`'s drum (raw: before the dig rule).
CREATE OR REPLACE FUNCTION public._monday_draw_leftover(p_user uuid, p_week text)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE
		WHEN p_user IS NOT NULL AND p_week IS NOT NULL
		 AND public._monday_draw_leftovers_on()
		 AND EXISTS (SELECT 1 FROM public.monday_draw_leftovers l
		             WHERE l.user_id = p_user AND l.to_week = p_week)
		THEN 1 ELSE 0
	END;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_leftover(uuid, text) FROM PUBLIC, anon, authenticated;

-- Carried from 20260921150000_drum_draw.sql. Delta: `leftover_balls` (the
-- drawable week: the stored receipt's when drawn, else the waiting ball, 0 in a
-- week with no dig) and `running_leftover_balls` (raw, so the player sees it
-- waiting before their first dig); both odds fields add the leftover.
CREATE OR REPLACE FUNCTION public._monday_draw_snapshot(p_user uuid, p_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	wk        record;
	run       record;
	row_d     public.monday_draws%ROWTYPE;
	tuning    jsonb := public._monday_draw_tuning();
	n_balls   int   := 0;
	n_cap     int   := 0;
	n_left    int   := 0;
	rolls_j   jsonb := NULL;
	run_balls int   := 0;
	run_cap   int   := 0;
	run_left  int   := 0;
	odds      int   := NULL;
BEGIN
	SELECT * INTO wk  FROM public._monday_draw_week(p_at);
	SELECT * INTO run FROM public.draw_week_at(p_at);

	IF p_user IS NOT NULL THEN
		SELECT * INTO row_d FROM public.monday_draws
			WHERE user_id = p_user AND iso_week = wk.cycle_key;
		IF row_d.user_id IS NOT NULL THEN
			n_balls := row_d.balls;
			n_cap   := row_d.cap;
			n_left  := COALESCE(row_d.leftover_balls, 0);
			rolls_j := CASE WHEN row_d.rolls IS NULL THEN NULL ELSE to_jsonb(row_d.rolls) END;
		ELSE
			n_balls := public._monday_draw_balls(p_user, wk.cycle_key);
			n_cap   := public._monday_draw_cap(p_user, wk.cycle_key);
			n_left  := CASE WHEN n_balls >= 1
			                THEN public._monday_draw_leftover(p_user, wk.cycle_key) ELSE 0 END;
		END IF;
		run_balls := public._monday_draw_balls(p_user, run.cycle_key);
		run_cap   := public._monday_draw_cap(p_user, run.cycle_key);
		run_left  := public._monday_draw_leftover(p_user, run.cycle_key);
	END IF;

	IF n_balls > 0 THEN
		odds := public._monday_draw_odds_one_in(n_balls + n_left);
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'week', wk.cycle_key,
		'week_starts_at', wk.starts_at,
		'week_ends_at', wk.ends_at,
		'eligible', n_balls >= 1,
		'drawn', row_d.user_id IS NOT NULL,
		'amount', row_d.amount,
		'tier', row_d.tier,
		'balls', n_balls,
		'cap', n_cap,
		'leftover_balls', n_left,
		'rolls', rolls_j,
		'purse_odds_one_in', odds,
		'running_week', run.cycle_key,
		'running_starts_at', run.starts_at,
		'running_ends_at', run.ends_at,
		'running_balls', run_balls,
		'running_cap', run_cap,
		'running_leftover_balls', run_left,
		'running_odds_one_in', public._monday_draw_odds_one_in(GREATEST(1, run_balls) + run_left),
		'next_turn_at', run.ends_at,
		'tiers', tuning -> 'tiers');
END;
$function$;
REVOKE ALL ON FUNCTION public._monday_draw_snapshot(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Carried from 20260921150000_drum_draw.sql, body unchanged.
CREATE OR REPLACE FUNCTION public.monday_draw_state()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public._monday_draw_snapshot(auth.uid(), public._patch_now());
$function$;
REVOKE ALL ON FUNCTION public.monday_draw_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monday_draw_state() TO authenticated;

-- Carried from 20260921150000_drum_draw.sql. Delta: (a) a waiting leftover
-- rolls as one more ball when the week has a dig (stored on the receipt as
-- leftover_balls; `balls` stays digs-only); (b) a purse whose best roll is
-- below rare (not rare, not jackpot: the odds formula's "hot" set) writes one
-- leftover into the NEXT week's drum, when Leftovers are on.
CREATE OR REPLACE FUNCTION public.draw_monday_purse()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid       uuid := auth.uid();
	at_now    timestamptz := public._patch_now();
	wk        record;
	nxt       record;
	tuning    jsonb := public._monday_draw_tuning();
	existing  public.monday_draws%ROWTYPE;
	n_balls   int;
	n_cap     int;
	n_left    int := 0;
	total     numeric := 0;
	roll      numeric;
	acc       numeric;
	t         jsonb;
	i         int;
	rolled    text[] := ARRAY[]::text[];
	hit_tier  text;
	hit_amt   int;
	best_tier text := NULL;
	best_amt  int := -1;
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

	n_balls := public._monday_draw_balls(uid, wk.cycle_key);
	n_cap   := public._monday_draw_cap(uid, wk.cycle_key);
	IF n_balls < 1 THEN
		RETURN public._monday_draw_snapshot(uid, at_now)
			|| jsonb_build_object('ok', false, 'reason', 'not_eligible');
	END IF;
	n_left := public._monday_draw_leftover(uid, wk.cycle_key);

	SELECT sum((x ->> 'weight')::numeric) INTO total
		FROM jsonb_array_elements(tuning -> 'tiers') x;
	IF COALESCE(total, 0) <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_tiers');
	END IF;

	FOR i IN 1..(n_balls + n_left) LOOP
		roll := random() * total;
		acc  := 0;
		hit_tier := NULL;
		FOR t IN SELECT x FROM jsonb_array_elements(tuning -> 'tiers') x LOOP
			acc := acc + (t ->> 'weight')::numeric;
			hit_tier := t ->> 'tier';
			hit_amt  := (t ->> 'amount')::int;
			EXIT WHEN roll < acc;
		END LOOP;
		IF hit_tier IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'no_tiers');
		END IF;
		rolled := rolled || hit_tier;
		IF hit_amt > best_amt THEN
			best_amt  := hit_amt;
			best_tier := hit_tier;
		END IF;
	END LOOP;

	-- The receipt first (the PK is the idempotence lock), then the mint.
	INSERT INTO public.monday_draws
		(user_id, iso_week, tier, amount, balls, cap, rolls, drawn_at, leftover_balls)
	VALUES (uid, wk.cycle_key, best_tier, best_amt, n_balls, n_cap, rolled, at_now, n_left);

	PERFORM public.apply_tickles(uid, best_amt);

	-- Leftovers: a purse below rare leaves one ball in the next week's drum.
	IF public._monday_draw_leftovers_on() AND best_tier NOT IN ('rare', 'jackpot') THEN
		SELECT * INTO nxt FROM public.draw_week_at(wk.ends_at);
		INSERT INTO public.monday_draw_leftovers (user_id, from_week, to_week, created_at)
		VALUES (uid, wk.cycle_key, nxt.cycle_key, at_now)
		ON CONFLICT (user_id, to_week) DO NOTHING;
	END IF;

	snap := public._monday_draw_snapshot(uid, at_now);
	RETURN snap || jsonb_build_object('amount', best_amt, 'tier', best_tier);
END;
$function$;
REVOKE ALL ON FUNCTION public.draw_monday_purse() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.draw_monday_purse() TO authenticated;


-- ── 7. The Board, baselined ──────────────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS tickles_board_baseline bigint NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS season_tickles_earned bigint
	GENERATED ALWAYS AS (GREATEST(0, COALESCE(tickles_earned, 0)::bigint - tickles_board_baseline)) STORED;
CREATE INDEX IF NOT EXISTS profiles_season_tickles_earned_idx
	ON public.profiles (season_tickles_earned DESC, id);

-- Which column the client ranks the Board by. 'tickles_earned' until the flip.
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'board_sort_column',
	'{"column": "tickles_earned"}'::jsonb,
	'The Board''s rank column: tickles_earned (lifetime) or season_tickles_earned. flip_season_2() sets the season column.'
)
ON CONFLICT (key) DO NOTHING;

-- The S1 Board as it stood at the flip (season0_tickle_standings' shape).
CREATE TABLE IF NOT EXISTS public.season1_tickle_standings (
	user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	username       text,
	tickles_earned bigint NOT NULL,
	rank           int NOT NULL,
	hidden         boolean NOT NULL DEFAULT false,
	archived_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.season1_tickle_standings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.season1_tickle_standings FROM PUBLIC, anon, authenticated;


-- ── 8. The reset archive + scope ─────────────────────────────────────────────
-- One row per (player, season entered, kind). payload holds the pre-flip
-- values (tickle_bank / snouts / board) or the pre-flip rows (satchel).
CREATE TABLE IF NOT EXISTS public.season_reset_archive (
	user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	season_id   text        NOT NULL,
	kind        text        NOT NULL CHECK (kind IN ('tickle_bank', 'snouts', 'satchel', 'board')),
	payload     jsonb       NOT NULL,
	archived_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, season_id, kind)
);
ALTER TABLE public.season_reset_archive ENABLE ROW LEVEL SECURITY;   -- server-only
REVOKE ALL ON public.season_reset_archive FROM PUBLIC, anon, authenticated;

-- Read by flip_season_2() AT FLIP TIME. A missing key reads as false (an
-- absent config never wipes anything).
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'season2_reset_scope',
	'{"tickle_bank": true, "snouts": true, "satchel": true}'::jsonb,
	'What the Season 2 flip archives then zeroes per player (founder ruling 2026-10-29: full fresh start).'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.app_config (key, enabled) VALUES ('season2_flipped', false)
ON CONFLICT (key) DO NOTHING;


-- ── 9. flip_season_2() / unflip_season_2() ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.flip_season_2(
	p_at    timestamptz DEFAULT now(),
	p_weeks int         DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	s1          public.seasons%ROWTYPE;
	s2          public.seasons%ROWTYPE;
	scope       jsonb;
	do_bank     boolean;
	do_snouts   boolean;
	do_satchel  boolean;
	n_bank      int := 0;
	n_snouts    int := 0;
	n_satchel   int := 0;
	n_board     int := 0;
	meter_total bigint := 0;
	state       jsonb;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended('season2_flip', 0));

	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RETURN jsonb_build_object('ok', true, 'already_flipped', true,
			'state', (SELECT value FROM public.app_settings WHERE key = 'season2_flip'));
	END IF;

	IF p_at IS NULL OR p_at > now() + interval '1 minute' OR p_at < now() - interval '7 days' THEN
		RAISE EXCEPTION 'flip_season_2: p_at must be now or within the last 7 days (got %)', p_at;
	END IF;
	IF p_weeks IS NULL OR p_weeks < 1 OR p_weeks > 26 THEN
		RAISE EXCEPTION 'flip_season_2: p_weeks must be 1..26 (got %)', p_weeks;
	END IF;

	SELECT * INTO s1 FROM public.seasons WHERE id = 'snout_season_1' FOR UPDATE;
	SELECT * INTO s2 FROM public.seasons WHERE id = 'snout_season_2' FOR UPDATE;
	IF s1.id IS NULL OR s2.id IS NULL THEN
		RAISE EXCEPTION 'flip_season_2: both season rows must exist';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.season_tiers WHERE season_id = 'snout_season_2') THEN
		RAISE EXCEPTION 'flip_season_2: snout_season_2 has no tiers';
	END IF;

	scope      := COALESCE((SELECT value FROM public.app_settings WHERE key = 'season2_reset_scope'), '{}'::jsonb);
	do_bank    := COALESCE(CASE WHEN jsonb_typeof(scope -> 'tickle_bank') = 'boolean' THEN (scope ->> 'tickle_bank')::boolean END, false);
	do_snouts  := COALESCE(CASE WHEN jsonb_typeof(scope -> 'snouts')      = 'boolean' THEN (scope ->> 'snouts')::boolean END, false);
	do_satchel := COALESCE(CASE WHEN jsonb_typeof(scope -> 'satchel')     = 'boolean' THEN (scope ->> 'satchel')::boolean END, false);

	-- A clean slate for this season's archive (a previous flip's rows were
	-- consumed by unflip; anything left is stale).
	DELETE FROM public.season_reset_archive WHERE season_id = 'snout_season_2';

	-- 1. The handover: both rows match for one instant; ORDER BY starts_at DESC
	--    hands every caller to Season 2 (the 20260706300000 shape).
	UPDATE public.seasons SET ends_at = p_at WHERE id = 'snout_season_1';
	UPDATE public.seasons
		SET starts_at = p_at, ends_at = p_at + make_interval(weeks => p_weeks)
		WHERE id = 'snout_season_2';

	-- 2. The meter baseline (the Larder starts empty; the raw ledger is intact).
	SELECT COALESCE(hd.total, 0) INTO meter_total FROM public.hunger_drain hd WHERE hd.id = true;
	meter_total := COALESCE(meter_total, 0);
	INSERT INTO public.app_settings (key, value, description)
	VALUES ('season_meter',
		jsonb_build_object('season_id', 'snout_season_2', 'baseline', meter_total, 'set_at', p_at),
		'hunger_meter() reads hunger_drain.total - baseline. Optional thresholds: 5 ascending ints.')
	ON CONFLICT (key) DO UPDATE
		SET value = public.app_settings.value
			|| jsonb_build_object('season_id', 'snout_season_2', 'baseline', meter_total, 'set_at', p_at),
		    updated_at = now();

	-- 3. The Board: snapshot S1, then baseline (archive any non-zero baseline).
	INSERT INTO public.season1_tickle_standings (user_id, username, tickles_earned, rank, hidden, archived_at)
	SELECT p.id, p.username, p.season_tickles_earned,
		row_number() OVER (
			ORDER BY (COALESCE(p.is_test, false) OR COALESCE(p.hide_from_leaderboard, false)),
			         p.season_tickles_earned DESC, p.id)::int,
		(COALESCE(p.is_test, false) OR COALESCE(p.hide_from_leaderboard, false)),
		p_at
	FROM public.profiles p
	JOIN auth.users u ON u.id = p.id
	WHERE p.season_tickles_earned > 0
	ON CONFLICT (user_id) DO NOTHING;

	INSERT INTO public.season_reset_archive (user_id, season_id, kind, payload, archived_at)
	SELECT p.id, 'snout_season_2', 'board',
		jsonb_build_object('tickles_board_baseline', p.tickles_board_baseline), p_at
	FROM public.profiles p JOIN auth.users u ON u.id = p.id
	WHERE p.tickles_board_baseline <> 0;
	UPDATE public.profiles
		SET tickles_board_baseline = COALESCE(tickles_earned, 0)
		WHERE tickles_board_baseline IS DISTINCT FROM COALESCE(tickles_earned, 0);
	GET DIAGNOSTICS n_board = ROW_COUNT;
	INSERT INTO public.app_settings (key, value, description)
	VALUES ('board_sort_column', '{"column": "season_tickles_earned"}'::jsonb,
		'The Board''s rank column: tickles_earned (lifetime) or season_tickles_earned.')
	ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

	-- 4. The full fresh start, per scope. Archive first, then zero.
	-- Each bucket's rows are row-locked BEFORE they are archived, so a tickle
	-- or a purchase can't land between the archive and the zero: what is
	-- archived is exactly what is wiped (and what unflip gives back).
	IF do_bank THEN
		PERFORM 1 FROM public.user_items FOR UPDATE;
		-- The EFFECTIVE balance (tickle_balance: stored + regenerated, cap-aware)
		-- is what the player sees, so that is what is archived and restored.
		INSERT INTO public.season_reset_archive (user_id, season_id, kind, payload, archived_at)
		SELECT ui.user_id, 'snout_season_2', 'tickle_bank',
			jsonb_build_object(
				'balance',        COALESCE(public.tickle_balance(ui.user_id), ui.item_count),
				'item_count',     ui.item_count,
				'last_increment', ui.last_increment,
				'regen_progress', ui.regen_progress),
			p_at
		FROM public.user_items ui JOIN auth.users u ON u.id = ui.user_id;
		UPDATE public.user_items ui
			SET item_count = 0, last_increment = p_at, regen_progress = 0
			FROM public.season_reset_archive a
			WHERE a.user_id = ui.user_id AND a.season_id = 'snout_season_2' AND a.kind = 'tickle_bank';
		GET DIAGNOSTICS n_bank = ROW_COUNT;
	END IF;

	IF do_snouts THEN
		PERFORM 1 FROM public.profiles WHERE COALESCE(counter, 0) <> 0 FOR UPDATE;
		INSERT INTO public.season_reset_archive (user_id, season_id, kind, payload, archived_at)
		SELECT p.id, 'snout_season_2', 'snouts', jsonb_build_object('counter', p.counter), p_at
		FROM public.profiles p JOIN auth.users u ON u.id = p.id
		WHERE COALESCE(p.counter, 0) <> 0;
		UPDATE public.profiles p
			SET counter = 0
			FROM public.season_reset_archive a
			WHERE a.user_id = p.id AND a.season_id = 'snout_season_2' AND a.kind = 'snouts';
		GET DIAGNOSTICS n_snouts = ROW_COUNT;
	END IF;

	IF do_satchel THEN
		-- Whole rows (id + provenance), so a restored find is the same find.
		-- satchel_met (Field Guide discovery) and satchel_keepsakes are kept.
		PERFORM 1 FROM public.satchel_items FOR UPDATE;
		INSERT INTO public.season_reset_archive (user_id, season_id, kind, payload, archived_at)
		SELECT si.user_id, 'snout_season_2', 'satchel',
			jsonb_agg(to_jsonb(si) ORDER BY si.id), p_at
		FROM public.satchel_items si JOIN auth.users u ON u.id = si.user_id
		GROUP BY si.user_id;
		DELETE FROM public.satchel_items si
			USING public.season_reset_archive a
			WHERE a.user_id = si.user_id AND a.season_id = 'snout_season_2' AND a.kind = 'satchel';
		GET DIAGNOSTICS n_satchel = ROW_COUNT;
	END IF;

	-- 5. Leftovers on.
	INSERT INTO public.app_settings (key, value, description)
	VALUES ('monday_draw_leftovers', '{"enabled": true}'::jsonb,
		'Season 2 Leftovers: a purse below rare leaves one ball for next week.')
	ON CONFLICT (key) DO UPDATE
		SET value = public.app_settings.value || '{"enabled": true}'::jsonb, updated_at = now();

	-- 6. The record unflip reads, then the guard.
	state := jsonb_build_object(
		'flipped_at',          p_at,
		'ran_at',              now(),
		's1_ends_at_before',   s1.ends_at,
		's2_starts_at_before', s2.starts_at,
		's2_ends_at_before',   s2.ends_at,
		'weeks',               p_weeks,
		'scope',               jsonb_build_object('tickle_bank', do_bank, 'snouts', do_snouts, 'satchel', do_satchel),
		'meter_baseline',      meter_total,
		'counts',              jsonb_build_object('tickle_bank', n_bank, 'snouts', n_snouts,
		                                          'satchel_items', n_satchel, 'board', n_board));
	INSERT INTO public.app_settings (key, value, description)
	VALUES ('season2_flip', state, 'Written by flip_season_2(); read by unflip_season_2().')
	ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

	INSERT INTO public.app_config (key, enabled) VALUES ('season2_flipped', true)
	ON CONFLICT (key) DO UPDATE SET enabled = true, updated_at = now();

	RETURN jsonb_build_object('ok', true, 'already_flipped', false, 'state', state);
END;
$function$;
REVOKE ALL ON FUNCTION public.flip_season_2(timestamptz, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flip_season_2(timestamptz, int) TO service_role;

-- Reverse the flip. Restores are ADDITIVE (what was wiped is added back on top
-- of anything earned since), so a quick reversal is exact and a late one loses
-- nothing. Season 2 progress rows written while flipped are left alone: they
-- key on the S2 id and reappear when it flips again.
CREATE OR REPLACE FUNCTION public.unflip_season_2()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	state     jsonb;
	n_bank    int := 0;
	n_snouts  int := 0;
	n_satchel int := 0;
	n_board   int := 0;
BEGIN
	PERFORM pg_advisory_xact_lock(hashtextextended('season2_flip', 0));

	IF NOT COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RETURN jsonb_build_object('ok', true, 'already_unflipped', true);
	END IF;
	SELECT value INTO state FROM public.app_settings WHERE key = 'season2_flip';
	IF state IS NULL THEN
		RAISE EXCEPTION 'unflip_season_2: season2_flipped is set but no season2_flip record exists';
	END IF;

	-- 1. The windows. S1 is never handed back an end date in the past: an empty
	--    active_season() reads as "the season stopped" (the 2026-10-12 lapse).
	UPDATE public.seasons
		SET ends_at = GREATEST((state ->> 's1_ends_at_before')::timestamptz, now() + interval '7 days')
		WHERE id = 'snout_season_1';
	UPDATE public.seasons
		SET starts_at = (state ->> 's2_starts_at_before')::timestamptz,
		    ends_at   = (state ->> 's2_ends_at_before')::timestamptz
		WHERE id = 'snout_season_2';

	-- 2. The meter: drop the baseline (any tuned thresholds stay).
	UPDATE public.app_settings
		SET value = value - 'baseline' - 'season_id' - 'set_at', updated_at = now()
		WHERE key = 'season_meter';

	-- 3. The Board: baselines back to their archived value (0 for nearly all).
	UPDATE public.profiles p
		SET tickles_board_baseline = COALESCE(
			(SELECT (a.payload ->> 'tickles_board_baseline')::bigint
			 FROM public.season_reset_archive a
			 WHERE a.user_id = p.id AND a.season_id = 'snout_season_2' AND a.kind = 'board'), 0)
		WHERE p.tickles_board_baseline <> COALESCE(
			(SELECT (a.payload ->> 'tickles_board_baseline')::bigint
			 FROM public.season_reset_archive a
			 WHERE a.user_id = p.id AND a.season_id = 'snout_season_2' AND a.kind = 'board'), 0);
	GET DIAGNOSTICS n_board = ROW_COUNT;
	DELETE FROM public.season1_tickle_standings;
	UPDATE public.app_settings
		SET value = '{"column": "tickles_earned"}'::jsonb, updated_at = now()
		WHERE key = 'board_sort_column';

	-- 4. The bank, the snouts, the Satchel.
	UPDATE public.user_items ui
		SET item_count = ui.item_count + GREATEST(0, (a.payload ->> 'balance')::int)
		FROM public.season_reset_archive a
		WHERE a.user_id = ui.user_id AND a.season_id = 'snout_season_2' AND a.kind = 'tickle_bank';
	GET DIAGNOSTICS n_bank = ROW_COUNT;

	UPDATE public.profiles p
		SET counter = COALESCE(p.counter, 0) + (a.payload ->> 'counter')::bigint
		FROM public.season_reset_archive a
		WHERE a.user_id = p.id AND a.season_id = 'snout_season_2' AND a.kind = 'snouts';
	GET DIAGNOSTICS n_snouts = ROW_COUNT;

	INSERT INTO public.satchel_items
	SELECT (jsonb_populate_record(NULL::public.satchel_items,
		CASE WHEN r ->> 'from_user_id' IS NOT NULL
		      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = (r ->> 'from_user_id')::uuid)
		     THEN r || '{"from_user_id": null}'::jsonb ELSE r END)).*
	FROM public.season_reset_archive a
	CROSS JOIN LATERAL jsonb_array_elements(a.payload) r
	WHERE a.season_id = 'snout_season_2' AND a.kind = 'satchel'
	ON CONFLICT (id) DO NOTHING;
	GET DIAGNOSTICS n_satchel = ROW_COUNT;

	DELETE FROM public.season_reset_archive WHERE season_id = 'snout_season_2';

	-- 5. Leftovers off (waiting balls stop counting; the rows stay as history).
	UPDATE public.app_settings
		SET value = value || '{"enabled": false}'::jsonb, updated_at = now()
		WHERE key = 'monday_draw_leftovers';

	-- 6. The guard.
	UPDATE public.app_settings
		SET value = value || jsonb_build_object('unflipped_at', now(),
			'restored', jsonb_build_object('tickle_bank', n_bank, 'snouts', n_snouts,
			                               'satchel_items', n_satchel, 'board', n_board)),
		    updated_at = now()
		WHERE key = 'season2_flip';
	UPDATE public.app_config SET enabled = false, updated_at = now() WHERE key = 'season2_flipped';

	RETURN jsonb_build_object('ok', true, 'already_unflipped', false,
		'restored', jsonb_build_object('tickle_bank', n_bank, 'snouts', n_snouts,
		                               'satchel_items', n_satchel, 'board', n_board));
END;
$function$;
REVOKE ALL ON FUNCTION public.unflip_season_2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unflip_season_2() TO service_role;


-- ── 10. my_season_reset(): the caller's own "fresh start" receipt ───────────
-- Which buckets the flip zeroed for THIS pig in the season it is in now (only
-- non-zero archives count), so today's client can say so once, naming only
-- what really reset. Never another pig's, never the amounts.
CREATE OR REPLACE FUNCTION public.my_season_reset()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid   uuid := auth.uid();
	sid   text;
	kinds text[] := ARRAY[]::text[];
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT s.id INTO sid FROM public.active_season() s;
	IF sid IS NULL THEN
		RETURN jsonb_build_object('ok', true, 'season_id', NULL, 'kinds', '[]'::jsonb);
	END IF;
	SELECT COALESCE(array_agg(a.kind ORDER BY a.kind), ARRAY[]::text[]) INTO kinds
	FROM public.season_reset_archive a
	WHERE a.user_id = uid AND a.season_id = sid
	  AND CASE a.kind
	        WHEN 'tickle_bank' THEN COALESCE((a.payload ->> 'balance')::bigint, 0) > 0
	        WHEN 'snouts'      THEN COALESCE((a.payload ->> 'counter')::bigint, 0) > 0
	        WHEN 'satchel'     THEN jsonb_typeof(a.payload) = 'array' AND jsonb_array_length(a.payload) > 0
	        ELSE false
	      END;
	RETURN jsonb_build_object('ok', true, 'season_id', sid, 'kinds', to_jsonb(kinds));
END;
$function$;
REVOKE ALL ON FUNCTION public.my_season_reset() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_season_reset() TO authenticated;

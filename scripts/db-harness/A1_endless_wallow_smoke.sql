-- 20260922100000_endless_wallow — the ladder never ends.
-- Exercises the real wallow() RPC on the throwaway DB: the W7+ rank-prize rule
-- (truffles / aura / keepsake / undrawn-frame fallthrough), the receipt gate,
-- the de-ranked Barn decor, and the re-slotted Marsh Wreath.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid
$$;

-- A two-tier season: the cycle is 200 XP and no Prestige Path tier falls inside
-- it, so the "claim your rewards first" gate is satisfied by construction.
INSERT INTO public.seasons (id, name, starts_at, ends_at, total_tiers, xp_per_tier)
VALUES ('endless_wallow_smoke', 'Endless Wallow', now() - interval '1 day', now() + interval '30 days', 2, 100);
CREATE OR REPLACE FUNCTION public.active_season()
RETURNS public.seasons LANGUAGE sql STABLE AS $$
  SELECT * FROM public.seasons WHERE id = 'endless_wallow_smoke';
$$;

DO $smoke$
DECLARE
  spec record;
  pig uuid;
  r jsonb;
  truffles int;
  motes int;
  again text;
BEGIN
  -- (a) the catalog rulings
  IF (SELECT category FROM public.hats WHERE id = 'wallow_marsh_crown') <> 'necklace'
    OR (SELECT name FROM public.hats WHERE id = 'wallow_marsh_crown') <> 'Marsh Wreath' THEN
    RAISE EXCEPTION 'Marsh Wreath did not move to the Neck slot';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.habitat_items
    WHERE id IN ('dried_herb_garland', 'barn_bunting', 'muddy_paw_rug',
                 'reading_chair', 'tiny_radio', 'midnight_rafters')
      AND prestige_rank IS NOT NULL
  ) THEN RAISE EXCEPTION 'Barn decor is still a rank grant'; END IF;
  IF (SELECT count(*) FROM public.habitat_items WHERE prestige_rank IS NOT NULL) <> 4
    OR (SELECT prestige_rank FROM public.habitat_items WHERE id = 'wallow_keepsake_celestial') <> 10 THEN
    RAISE EXCEPTION 'the four keepsakes must keep their ranks';
  END IF;

  -- (b) a pig at each interesting rung wallows once and collects its prize.
  FOR spec IN
    SELECT * FROM (VALUES
      (6,  'truffles', 2, 1),   -- W7  — neither a keepsake nor an aura rank
      (7,  'aura',     0, 0),   -- W8  — (8-5) % 3 = 0
      (9,  'keepsake', 0, 0),   -- W10 — the Celestial frame is drawn
      (14, 'truffles', 2, 1)    -- W15 — a keepsake rank with no frame yet
    ) AS t(before_rank, prize, truffle_gain, mote_gain)
  LOOP
    pig := ('00000000-0000-0000-0000-' || lpad((110000 + spec.before_rank)::text, 12, '0'))::uuid;
    INSERT INTO auth.users(id) VALUES (pig);
    INSERT INTO public.profiles(id, username, wallow_count, mote_balance, counter, golden_truffles)
      VALUES (pig, 'endless-' || spec.before_rank, spec.before_rank, 0, 0, 0);
    INSERT INTO public.user_items(user_id, item_count) VALUES (pig, 10);
    INSERT INTO public.user_season_progress(user_id, season_id, xp, wallow_count)
      VALUES (pig, 'endless_wallow_smoke', (spec.before_rank + 1) * 200, spec.before_rank);
    PERFORM set_config('smoke.uid', pig::text, true);

    r := public.wallow();
    IF (r->>'ok')::boolean IS NOT TRUE
      OR (r->>'wallow_count')::int <> spec.before_rank + 1
      OR r->>'rank_prize' IS DISTINCT FROM spec.prize THEN
      RAISE EXCEPTION 'W% prize mismatch (wanted %): %', spec.before_rank + 1, spec.prize, r;
    END IF;
    IF (SELECT prize FROM public.wallow_rank_prizes
        WHERE user_id = pig AND rank = spec.before_rank + 1) IS DISTINCT FROM spec.prize THEN
      RAISE EXCEPTION 'W% receipt missing or wrong', spec.before_rank + 1;
    END IF;

    SELECT golden_truffles, mote_balance INTO truffles, motes
      FROM public.profiles WHERE id = pig;
    IF truffles <> spec.truffle_gain OR motes <> spec.mote_gain THEN
      RAISE EXCEPTION 'W% paid % truffles / % motes, wanted % / %',
        spec.before_rank + 1, truffles, motes, spec.truffle_gain, spec.mote_gain;
    END IF;

    -- (c) the receipt is the gate: a replay pays nothing and reports the same prize.
    again := public._grant_wallow_rank_prize(pig, spec.before_rank + 1);
    IF again IS DISTINCT FROM spec.prize THEN
      RAISE EXCEPTION 'W% replay returned %', spec.before_rank + 1, again;
    END IF;
    IF (SELECT golden_truffles FROM public.profiles WHERE id = pig) <> spec.truffle_gain
      OR (SELECT mote_balance FROM public.profiles WHERE id = pig) <> spec.mote_gain
      OR (SELECT count(*) FROM public.wallow_rank_prizes WHERE user_id = pig) <> 1 THEN
      RAISE EXCEPTION 'W% replay granted again', spec.before_rank + 1;
    END IF;
  END LOOP;

  -- (d) the first chapter is untouched: a W6 climb carries no rank prize.
  pig := '00000000-0000-0000-0000-000000110005'::uuid;
  INSERT INTO auth.users(id) VALUES (pig);
  INSERT INTO public.profiles(id, username, wallow_count, mote_balance, counter, golden_truffles)
    VALUES (pig, 'endless-five', 5, 0, 0, 0);
  INSERT INTO public.user_items(user_id, item_count) VALUES (pig, 10);
  INSERT INTO public.user_season_progress(user_id, season_id, xp, wallow_count)
    VALUES (pig, 'endless_wallow_smoke', 1200, 5);
  PERFORM set_config('smoke.uid', pig::text, true);
  r := public.wallow();
  IF (r->>'ok')::boolean IS NOT TRUE OR (r->>'wallow_count')::int <> 6
    OR r->>'rank_prize' IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.wallow_rank_prizes WHERE user_id = pig)
    OR (SELECT golden_truffles FROM public.profiles WHERE id = pig) <> 0 THEN
    RAISE EXCEPTION 'W6 must not draw a rank prize: %', r;
  END IF;
  -- The W6 regalia still lands in the head slot.
  IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = pig AND hat_id = 'wallow_sovereign_crown') THEN
    RAISE EXCEPTION 'W6 lost its Sovereign Crown';
  END IF;

  -- (e) the rule holds for any number, not a table: below 7 grants nothing.
  IF public._grant_wallow_rank_prize(pig, 6) IS NOT NULL THEN
    RAISE EXCEPTION 'rank 6 must not be prize-able';
  END IF;

  -- (f) the one-shot re-slot (fixtures from 00y_endless_wallow_prep.sql):
  -- an empty Neck slot takes the Wreath; an occupied one keeps what it wore and
  -- the pig is simply unequipped rather than stranded in the head slot.
  IF (SELECT active_neck_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000111001') <> 'wallow_marsh_crown'
    OR (SELECT active_hat_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000111001') IS NOT NULL THEN
    RAISE EXCEPTION 'the Wreath did not move into the bare Neck slot';
  END IF;
  IF (SELECT active_neck_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000111002') <> 'smoke_spare_necklace'
    OR (SELECT active_hat_id FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000111002') IS NOT NULL THEN
    RAISE EXCEPTION 'the re-slot clobbered an occupied Neck slot';
  END IF;

  -- (g) back-pay: the W11 pig seeded before the migration owns ranks 7..11 —
  -- truffles(7) + aura(8) + truffles(9) + keepsake(10) + aura(11).
  pig := '00000000-0000-0000-0000-000000111011'::uuid;
  IF (SELECT count(*) FROM public.wallow_rank_prizes WHERE user_id = pig) <> 5
    OR (SELECT string_agg(prize, ',' ORDER BY rank) FROM public.wallow_rank_prizes WHERE user_id = pig)
       <> 'truffles,aura,truffles,keepsake,aura'
    OR (SELECT golden_truffles FROM public.profiles WHERE id = pig) <> 4
    OR (SELECT mote_balance FROM public.profiles WHERE id = pig) <> 2 THEN
    RAISE EXCEPTION 'W11 back-pay wrong: %',
      (SELECT jsonb_agg(jsonb_build_object('rank', rank, 'prize', prize) ORDER BY rank)
         FROM public.wallow_rank_prizes WHERE user_id = pig);
  END IF;
  -- Re-running the back-pay block is a no-op.
  FOR spec IN SELECT g AS before_rank FROM generate_series(7, 11) g LOOP
    PERFORM public._grant_wallow_rank_prize(pig, spec.before_rank);
  END LOOP;
  IF (SELECT golden_truffles FROM public.profiles WHERE id = pig) <> 4
    OR (SELECT mote_balance FROM public.profiles WHERE id = pig) <> 2
    OR (SELECT count(*) FROM public.wallow_rank_prizes WHERE user_id = pig) <> 5 THEN
    RAISE EXCEPTION 'back-pay is not idempotent';
  END IF;

  RAISE NOTICE 'chk endless wallow OK';
END;
$smoke$;

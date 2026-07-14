-- Smoke: 20260739100000_season1_finale_reward — grant_season1_finale() gives
-- the Hungerer's Crown hat + "Starver of the Hunger" title to every user whose
-- Season-1 credited finds (SUM war_rootings.credited_finds, submitted only)
-- >= 10, announces once per fresh grant, and is fully idempotent (re-run grants
-- nothing new + sends no duplicate announcement).
--
-- The migration is applied by run.sh's CHAIN (it can't self-\i — the suite is
-- piped into psql, so relative \i paths don't resolve on the container). This
-- smoke leans on the co-op-dig-rebuild (20260714) war_rootings shape
-- (credited_finds + NOT NULL crew_id/seed/dig_day) and the stub's crews /
-- user_hats / user_titles / system_announcements tables.
BEGIN;

-- Three diggers: A well over 10, B exactly at 10 (boundary — eligible), C under
-- 10 (not eligible). Plus D who has finds but never submitted (excluded).
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000039a1'),  -- A: 12 finds → eligible
	('00000000-0000-0000-0000-0000000039b2'),  -- B: 10 finds → eligible (boundary)
	('00000000-0000-0000-0000-0000000039c3'),  -- C: 7 finds  → NOT eligible
	('00000000-0000-0000-0000-0000000039d4')   -- D: 20 finds but unsubmitted → excluded
	ON CONFLICT (id) DO NOTHING;

-- One crew to satisfy war_rootings.crew_id FK.
INSERT INTO public.crews (id, name) VALUES
	('00000000-0000-0000-0000-000000039c50', 'Starvers') ON CONFLICT (id) DO NOTHING;

-- Seed war_rootings. credited_finds is what counts; A is split across two
-- windows (7 + 5 = 12) to prove the SUM. B lands exactly on 10. C is 7. D's
-- 20 are unsubmitted (submitted_at NULL) so they must NOT count.
INSERT INTO public.war_rootings
	(user_id, crew_id, window_index, seed, dig_day, submitted_at, credited_finds)
VALUES
	('00000000-0000-0000-0000-0000000039a1', '00000000-0000-0000-0000-000000039c50', 100, 1, '2026-07-10', now(), 7),
	('00000000-0000-0000-0000-0000000039a1', '00000000-0000-0000-0000-000000039c50', 101, 1, '2026-07-11', now(), 5),
	('00000000-0000-0000-0000-0000000039b2', '00000000-0000-0000-0000-000000039c50', 100, 1, '2026-07-10', now(), 10),
	('00000000-0000-0000-0000-0000000039c3', '00000000-0000-0000-0000-000000039c50', 100, 1, '2026-07-10', now(), 7),
	('00000000-0000-0000-0000-0000000039d4', '00000000-0000-0000-0000-000000039c50', 100, 1, '2026-07-10', NULL,  20);

-- 1. First grant → A + B get hat + title + one announcement each; C + D nothing.
DO $$
DECLARE r jsonb;
BEGIN
	r := public.grant_season1_finale();
	IF NOT (r->>'ok')::boolean
		OR (r->>'hats_granted')::int   <> 2
		OR (r->>'titles_granted')::int <> 2
		OR (r->>'announced')::int      <> 2 THEN
		RAISE EXCEPTION 'first grant counts wrong: %', r;
	END IF;

	-- A + B hold the hat; C + D do not.
	IF NOT EXISTS (SELECT 1 FROM public.user_hats
		WHERE hat_id = 'hungerers_crown' AND user_id = '00000000-0000-0000-0000-0000000039a1') THEN
		RAISE EXCEPTION 'A did not get the crown';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats
		WHERE hat_id = 'hungerers_crown' AND user_id = '00000000-0000-0000-0000-0000000039b2') THEN
		RAISE EXCEPTION 'B (boundary =10) did not get the crown';
	END IF;
	IF EXISTS (SELECT 1 FROM public.user_hats
		WHERE hat_id = 'hungerers_crown' AND user_id = '00000000-0000-0000-0000-0000000039c3') THEN
		RAISE EXCEPTION 'C (<10) wrongly got the crown';
	END IF;
	IF EXISTS (SELECT 1 FROM public.user_hats
		WHERE hat_id = 'hungerers_crown' AND user_id = '00000000-0000-0000-0000-0000000039d4') THEN
		RAISE EXCEPTION 'D (unsubmitted) wrongly got the crown';
	END IF;

	-- Same eligibility for the title.
	IF (SELECT count(*) FROM public.user_titles WHERE title_id = 'starver_of_the_hunger') <> 2 THEN
		RAISE EXCEPTION 'title grant count <> 2';
	END IF;

	-- Exactly two announcements, both to eligible diggers.
	IF (SELECT count(*) FROM public.system_announcements
		WHERE title = 'The Hungerer''s Crown is yours') <> 2 THEN
		RAISE EXCEPTION 'announcement count <> 2 after first grant';
	END IF;
END $$;

-- 2. Idempotent re-run → grants nothing new, sends no new announcement.
DO $$
DECLARE r jsonb;
BEGIN
	r := public.grant_season1_finale();
	IF (r->>'hats_granted')::int   <> 0
		OR (r->>'titles_granted')::int <> 0
		OR (r->>'announced')::int      <> 0 THEN
		RAISE EXCEPTION 'second grant not idempotent: %', r;
	END IF;
	-- No duplicate hats / titles / announcements.
	IF (SELECT count(*) FROM public.user_hats WHERE hat_id = 'hungerers_crown') <> 2 THEN
		RAISE EXCEPTION 'crown duplicated on re-run';
	END IF;
	IF (SELECT count(*) FROM public.user_titles WHERE title_id = 'starver_of_the_hunger') <> 2 THEN
		RAISE EXCEPTION 'title duplicated on re-run';
	END IF;
	IF (SELECT count(*) FROM public.system_announcements
		WHERE title = 'The Hungerer''s Crown is yours') <> 2 THEN
		RAISE EXCEPTION 'announcement duplicated on re-run';
	END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'chk finale reward: >=10 granted (12 & boundary 10), <10 + unsubmitted excluded, idempotent OK'; END $$;
ROLLBACK;

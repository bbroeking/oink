-- Prep for 20260916100000_habitat_pass_rewards.sql. Production hats carries
-- pass_exclusive (20260675000000); the minimal stub does not, and the migration
-- re-creates the season_tiers trigger that UPDATEs it. Seed a HAT that shares
-- its slug with a Barn furnishing (prod really has hats.firefly_lantern) so the
-- smoke can assert the trigger leaves it alone. The two relocated season titles
-- exist in prod (20260711000000); seed them so the title branch grants.
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS pass_exclusive boolean NOT NULL DEFAULT false;
INSERT INTO public.hats (id, war_exclusive) VALUES ('firefly_lantern', false), ('slop_bucket_hat', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('slop_savorer',  'Slop Savorer',  'pre', 'Licked the trough clean in the lean weeks.', 'season', false, 506),
	('truffle_hound', 'Truffle Hound', 'pre', 'Nose to the mud, every time.',               'season', false, 505)
ON CONFLICT (id) DO NOTHING;
-- Production's title slug helper (20260511000000) — the chain never applies
-- it, and the reseed backfill's title branch calls it.
CREATE OR REPLACE FUNCTION public.title_id_from_name(display_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
	SELECT replace(replace(lower(display_name), ' ', '_'), '-', '_');
$$;
-- A player who claimed reseeded tiers BEFORE the reseed: tier 5 (was the Slop
-- Savorer title → now the lantern), 6 (was 50 tickles → now that title, which
-- this player already holds from tier 5), 8 (was 50 tickles → now the hat), 10
-- (was a mystery box → now the lamp). Smoke 91 asserts the backfill.
INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000091002');
INSERT INTO public.profiles(id, username, counter, golden_truffles)
VALUES ('00000000-0000-0000-0000-000000091002', 'reseed-pig', 0, 0);
INSERT INTO public.user_titles(user_id, title_id)
VALUES ('00000000-0000-0000-0000-000000091002', 'slop_savorer');
INSERT INTO public.user_tier_claims(user_id, season_id, tier, track) VALUES
	('00000000-0000-0000-0000-000000091002', 'snout_season_1', 5, 'free'),
	('00000000-0000-0000-0000-000000091002', 'snout_season_1', 6, 'free'),
	('00000000-0000-0000-0000-000000091002', 'snout_season_1', 8, 'free'),
	('00000000-0000-0000-0000-000000091002', 'snout_season_1', 10, 'free');

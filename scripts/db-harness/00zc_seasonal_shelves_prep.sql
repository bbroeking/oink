-- Prep for 20261029220000_seasonal_shelves.sql (and the 20261029170000
-- daily_shop it carries). Production has every one of these columns:
--   hats: name / emoji / image_path / cost / display_order (20260501210000),
--         category / rarity / description (20260502030000),
--         pass_exclusive (20260675000000), members_only (20260688000000)
--   profiles.is_vip (20260504010000), user_hats.acquired_at (20260501210000)
-- The minimal stub does not. Idempotent: earlier preps in run.sh's chain
-- (00w) may already have added some of them.
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS name           text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS emoji          text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS image_path     text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS cost           integer NOT NULL DEFAULT 0;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS display_order  integer NOT NULL DEFAULT 0;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS category       text NOT NULL DEFAULT 'hat';
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS rarity         text NOT NULL DEFAULT 'common';
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS description    text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS pass_exclusive boolean NOT NULL DEFAULT false;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS members_only   boolean NOT NULL DEFAULT false;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS created_at     timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS is_vip      boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_hats ADD COLUMN IF NOT EXISTS acquired_at timestamptz NOT NULL DEFAULT now();

-- 00n_prestige_mote_prep.sql stubs grant_mystery_box(p_user uuid, p_kind text);
-- production's only def (20260631000000) names them (target_user, box_kind),
-- and CREATE OR REPLACE cannot rename parameters. Drop the stub so the
-- migration's verbatim carry lands as it will on prod. No-op off that chain.
DROP FUNCTION IF EXISTS public.grant_mystery_box(uuid, text);

-- auth.uid() reads the smoke.uid GUC so the smoke can act "as" a given pig
-- (same rewire 00o/00w apply; idempotent here).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid',true),'')::uuid $$;

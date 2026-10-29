-- Prep for 20261029240000_halloween_costumes.sql + A5_halloween_costumes_smoke.
-- The migration itself applies on the chain as is; this backfills what the
-- smoke reads that the minimal stub lacks. Production has every one of these:
--   profiles.active_* slot columns (20260502030000 .. 20260826030000;
--     59_equip_cosmetic_smoke already adds most, repeated here idempotently),
--   profiles.active_pig_id (20260781000000), profiles.wallow_count,
--   public.porch_round_stops (20260789000000_porch_round_scrapbook.sql, the
--     table my_porch_round reads; minimal shape, same column names).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_hat_id             text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_bow_id             text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_glasses_id         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_mask_id            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_neck_id            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_aura_id            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_held_id            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_background_id      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_flag_id            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tickle_particle_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_pig_id             text NOT NULL DEFAULT 'rosie';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallow_count              int  NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.porch_round_stops (
	id bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_started_at timestamptz NOT NULL,
	page_number int NOT NULL CHECK (page_number >= 1),
	stop_number int NOT NULL CHECK (stop_number BETWEEN 1 AND 3),
	created_at timestamptz NOT NULL DEFAULT now()
);

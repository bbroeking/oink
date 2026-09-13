-- Dependencies outside the minimal harness's pass chain. Claims, catalog,
-- rank tuning, rollover, Mote wallet and Contraptions use real migrations.
ALTER TABLE public.user_season_progress
  ADD COLUMN IF NOT EXISTS premium_unlocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_plus_unlocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS description text;

-- Social visits are outside this pass smoke; 20260779 wraps the public seam.
CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true) $$;

CREATE OR REPLACE FUNCTION public.grant_mystery_box(p_user uuid, p_kind text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- Deterministic duplicate-hat fallback; no random cosmetic subsystem needed.
  UPDATE public.profiles SET counter = counter + 50 WHERE id = p_user;
  RETURN jsonb_build_object('fallback_snouts', 50);
END;
$$;
REVOKE ALL ON FUNCTION public.grant_mystery_box(uuid, text) FROM PUBLIC, anon, authenticated;

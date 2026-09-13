-- Harness-only production-shape additions for
-- 20260826000000_preserve_sluggish_snout_regen.sql.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS wallow_count int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS alignment_score int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS tickles_wasted_total bigint NOT NULL DEFAULT 0;

ALTER TABLE public.curses ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE public.curses ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.curses ADD COLUMN IF NOT EXISTS cleared_at timestamptz;

CREATE OR REPLACE FUNCTION public.happiness_now(uid uuid)
RETURNS numeric LANGUAGE sql STABLE AS $$ SELECT 50::numeric $$;

CREATE OR REPLACE FUNCTION public._wallow_regen_percent(p_wallow_count int)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT 0::numeric $$;

REVOKE ALL ON FUNCTION public._wallow_regen_percent(int)
	FROM PUBLIC, anon, authenticated;

-- The production function comes from the Barn-visit chain, which the minimal
-- harness intentionally omits. The migration wraps it to replace only its bank
-- fields, so provide that wrapper seam here.
CREATE OR REPLACE FUNCTION public.barn_visit_status(p_target uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT jsonb_build_object('ok', true, 'target', p_target) $$;

REVOKE ALL ON FUNCTION public.barn_visit_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.barn_visit_status(uuid) TO authenticated;

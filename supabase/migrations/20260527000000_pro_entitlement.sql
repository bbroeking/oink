-- "Tickle the Pig Pro" — the server-side entitlement mirror.
--
-- The authoritative source of Pro status is RevenueCat. A RevenueCat
-- webhook → Supabase Edge function keeps `profiles.is_pro` in sync
-- (INITIAL_PURCHASE / RENEWAL / EXPIRATION / etc.).
--
-- Trust boundary (see docs/subscriptions-spec.md §5):
--   - Cosmetic gates (premium battle-pass track) — the client may
--     read the RevenueCat entitlement directly; worst case is a
--     sideloaded hat.
--   - Gameplay perks that MINT resources (faster tickle regen, the
--     raised daily ritual cap) — must read THIS column, never a
--     client-passed flag.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS is_pro boolean NOT NULL DEFAULT false;

-- set_pro_status — called by the RevenueCat webhook Edge function
-- (service-role). NOT granted to authenticated: a normal client can
-- never grant itself Pro.
CREATE OR REPLACE FUNCTION public.set_pro_status(
	target_user_id uuid,
	pro boolean
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
	UPDATE public.profiles SET is_pro = pro WHERE id = target_user_id;
$$;

-- Read-only helper for RPCs that gate a gameplay perk on Pro.
CREATE OR REPLACE FUNCTION public.is_pro(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	SELECT COALESCE(
		(SELECT is_pro FROM public.profiles WHERE id = target_user_id),
		false
	);
$$;

GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated;
-- set_pro_status: intentionally NOT granted to authenticated.

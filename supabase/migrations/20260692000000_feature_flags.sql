-- Feature flags — server-driven visibility for dark-launched surfaces.
-- HELD FOR REVIEW; push only on go.
--
-- WHY: MUD_FIGHTS_VISIBLE (Season 2 / Sounder Mud Fights) was a COMPILE-TIME
-- constant (constants/featureFlags.ts, = __DEV__), so shipping the season meant
-- editing code + rebuilding, and there was no way to give ONE account early
-- access. This replaces that with a server flag the client reads at boot via
-- feature_flags(), so a season can be flipped on/off remotely and targeted at a
-- single tester (Brian) without a build.
--
-- SHAPE: two layers, merged per-user by feature_flags():
--   1. app_config.enabled              — the GLOBAL default for a key (the kill switch).
--   2. profiles.feature_overrides->>key — a PER-USER override (true/false) that
--      WINS over the global when present; absent → inherit the global.
--   Effective = COALESCE(per-user override, global default).
--
-- app_config is written ONLY by admins (admin_set_feature_flag, is_test-gated —
-- the project's admin predicate, same as admin_tickle_overview) or by hand /
-- Supabase dashboard. RLS is ON with NO policies, so direct client access is
-- denied — every read goes through the SECURITY DEFINER feature_flags() RPC,
-- which is why the table needs no SELECT policy for authenticated.
--
-- SEEDS: mud_wars global = FALSE (the season stays dark for everyone) and Brian
-- (lower(username)='brian', the is_test owner account) gets a per-user override
-- = true, so the season is live for the local test account the moment this is
-- pushed — no more flipping the constant to switch back and forth.
--
-- FOOTGUN (naming-collision, per mud-wars-master-plan §rollout): "mud_wars" here
-- is a UI-visibility flag only. It does NOT gate the backend — the mud_wars /
-- mud_slings / resolve_war stack is server-authoritative on its own. Flipping
-- this true just reveals the surfaces; it does not bypass any economy guard.

-- ── Global flag table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_config (
	key         text PRIMARY KEY,
	enabled     boolean NOT NULL DEFAULT false,
	description text,
	updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Read path is the SECURITY DEFINER feature_flags() RPC, so lock the table
-- down: RLS on with no policies denies all direct client access by default.
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- ── Per-user overrides ───────────────────────────────────────────────
-- A jsonb map of flag_key -> boolean. Empty = no overrides (inherit globals).
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ── Effective-flags read RPC ─────────────────────────────────────────
-- Returns { key: bool, ... } for the CALLING user: per-user override wins,
-- else the global default. anon (no auth.uid()) gets globals only. Empty
-- app_config → '{}'.
CREATE OR REPLACE FUNCTION public.feature_flags()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		jsonb_object_agg(
			c.key,
			COALESCE((p.feature_overrides ->> c.key)::boolean, c.enabled)
		),
		'{}'::jsonb
	)
	FROM public.app_config c
	LEFT JOIN public.profiles p ON p.id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.feature_flags() FROM public;
GRANT EXECUTE ON FUNCTION public.feature_flags() TO anon, authenticated;

-- ── Admin global toggle ──────────────────────────────────────────────
-- Flip a global flag on/off from the app (or SQL). is_test-gated; upserts the
-- key so a brand-new flag can be created in one call. Non-admins get admin_only.
CREATE OR REPLACE FUNCTION public.admin_set_feature_flag(p_key text, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_is_test boolean;
BEGIN
	SELECT COALESCE(pr.is_test, false) INTO caller_is_test
		FROM public.profiles pr WHERE pr.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	INSERT INTO public.app_config (key, enabled, updated_at)
	VALUES (p_key, p_enabled, now())
	ON CONFLICT (key) DO UPDATE
		SET enabled = EXCLUDED.enabled, updated_at = now();

	RETURN jsonb_build_object('ok', true, 'key', p_key, 'enabled', p_enabled);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_set_feature_flag(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_feature_flag(text, boolean) TO authenticated;

-- ── Seeds ────────────────────────────────────────────────────────────
-- Season 2 / Mud Wars stays dark globally.
INSERT INTO public.app_config (key, enabled, description)
VALUES ('mud_wars', false, 'Season 2 — Sounder Mud Fights visibility')
ON CONFLICT (key) DO NOTHING;

-- Brian (the is_test owner account) gets early access, so the season is live
-- for the local test account without flipping the global. Merge-assign so any
-- other overrides on that profile survive.
UPDATE public.profiles
SET feature_overrides = COALESCE(feature_overrides, '{}'::jsonb) || '{"mud_wars": true}'::jsonb
WHERE lower(username) = 'brian';

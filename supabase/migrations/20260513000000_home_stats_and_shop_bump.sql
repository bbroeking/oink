-- Two unrelated changes batched into one migration:
--
-- 1. home_stats() RPC consolidates the home screen's startup-and-per-tick
--    fetches into a single round trip. fetchStats() was firing 3-4 RPCs
--    sequentially after every tickle (profiles select + tickle_info +
--    season_state + optional hats join), adding ~800-1500ms of latency
--    per tap on cell networks. One RPC trims that to ~250ms.
--
-- 2. daily_shop() rotation bumped from 4 → 5 items per day. Pure
--    one-line tweak; keeps the deterministic-per-date hash ordering.

-- ── 1. home_stats() ─────────────────────────────────────────────────
-- Returns everything the home screen needs to render:
--   counter, tickles_earned, active hat meta, balance/cap/regen,
--   season tier + totalTiers
--
-- jsonb-shaped to keep the wire format flexible; client casts the
-- single returned blob.

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof      record;
	hat       record;
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id
		INTO prof
		FROM public.profiles
		WHERE id = caller_id;

	IF prof.active_hat_id IS NOT NULL THEN
		SELECT category, emoji
			INTO hat
			FROM public.hats
			WHERE id = prof.active_hat_id;
	END IF;

	-- Reuse existing tickle_info + season_state instead of duplicating
	-- their math here. Both are STABLE pure-SQL/plpgsql so inlining is
	-- safe and respects whatever caps/multipliers they currently encode.
	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',              true,
		'counter',         COALESCE(prof.counter, 0),
		'tickles_earned',  COALESCE(prof.tickles_earned, 0),
		'active_hat_id',   prof.active_hat_id,
		'active_hat',      CASE
			WHEN prof.active_hat_id IS NULL THEN NULL
			ELSE jsonb_build_object(
				'id', prof.active_hat_id,
				'category', hat.category,
				'emoji', hat.emoji
			)
		END,
		'balance',           COALESCE((tickle->>'balance')::int, 0),
		'cap',               COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds', tickle->'next_regen_seconds',
		'current_tier',      COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',       COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

-- ── 2. daily_shop bump 4 → 5 ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.daily_shop()
RETURNS SETOF public.hats
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	WITH
		today_seed AS (SELECT current_date::text AS d),
		candidates AS (
			SELECT h.*,
				abs(hashtext(h.id || (SELECT d FROM today_seed))) AS rnk
			FROM public.hats h
			LEFT JOIN public.user_hats uh
				ON uh.hat_id = h.id AND uh.user_id = auth.uid()
			WHERE uh.hat_id IS NULL
		)
	SELECT id, name, emoji, image_path, cost, display_order, created_at, category, rarity, description
	FROM candidates
	ORDER BY rnk
	LIMIT 5;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_shop() TO authenticated;

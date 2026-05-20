-- Track which user_achievements have been seen by the user, so the
-- Barn banner can surface ungrokked unlocks. NULL viewed_at means
-- "user hasn't seen the reveal modal for this yet."

ALTER TABLE public.user_achievements
	ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS user_achievements_unviewed_idx
	ON public.user_achievements (user_id) WHERE viewed_at IS NULL;

-- Update my_achievements to expose viewed_at + a tiny accompanying
-- RPC for the dismiss flow. DROP + RECREATE because Postgres won't
-- let CREATE OR REPLACE change the return type signature.
DROP FUNCTION IF EXISTS public.my_achievements();

CREATE OR REPLACE FUNCTION public.my_achievements()
RETURNS TABLE (
	id              text,
	category        text,
	tier            int,
	name            text,
	description     text,
	threshold       int,
	reward_title_id text,
	reward_item_id  text,
	reward_snouts   int,
	icon            text,
	display_order   int,
	is_top_tier     boolean,
	progress        int,
	claimed         boolean,
	level           int,
	viewed_at       timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	prog_giver  int := 0;
	prog_recv   int := 0;
BEGIN
	IF caller_id IS NOT NULL THEN
		prog_giver := public.trade_given_total(caller_id);
		prog_recv  := public.trade_received_total(caller_id);
	END IF;

	RETURN QUERY
	SELECT
		a.id, a.category, a.tier, a.name, a.description, a.threshold,
		a.reward_title_id, a.reward_item_id, a.reward_snouts,
		a.icon, a.display_order, a.is_top_tier,
		CASE a.category
			WHEN 'trade_giver'    THEN prog_giver
			WHEN 'trade_receiver' THEN prog_recv
			ELSE 0
		END AS progress,
		EXISTS (
			SELECT 1 FROM public.user_achievements ua
			WHERE ua.user_id = caller_id AND ua.achievement_id = a.id
		) AS claimed,
		COALESCE(
			(SELECT level FROM public.user_achievements ua
			 WHERE ua.user_id = caller_id AND ua.achievement_id = a.id),
			0
		) AS level,
		(SELECT viewed_at FROM public.user_achievements ua
		 WHERE ua.user_id = caller_id AND ua.achievement_id = a.id) AS viewed_at
	FROM public.achievements a
	ORDER BY a.display_order ASC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_achievements() TO authenticated;

-- Mark a specific unlock as viewed (called when the user dismisses
-- the reveal modal).
CREATE OR REPLACE FUNCTION public.mark_achievement_viewed(target_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	UPDATE public.user_achievements
		SET viewed_at = now()
		WHERE user_id = caller_id
		  AND achievement_id = target_id
		  AND viewed_at IS NULL;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_achievement_viewed(text) TO authenticated;

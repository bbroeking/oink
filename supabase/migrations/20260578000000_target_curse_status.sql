-- Curse countdown: when you go to curse a friend who's already cursed, show a
-- timer to when the current curse wears off. The curses RLS only lets you see
-- curses you sent/received, so this SECURITY DEFINER fn exposes ONLY the
-- soonest active-curse expiry for a target — never who cast it or which kind.
-- Instant curses (coin_pinch, expires_at NULL) are ignored.

CREATE OR REPLACE FUNCTION public.target_curse_status(target_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object(
		'cursed', EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = target_id
			  AND cleared_at IS NULL
			  AND expires_at IS NOT NULL
			  AND expires_at > now()
		),
		'expires_at', (
			SELECT MIN(expires_at) FROM public.curses
			WHERE receiver_id = target_id
			  AND cleared_at IS NULL
			  AND expires_at IS NOT NULL
			  AND expires_at > now()
		)
	);
$function$;

GRANT EXECUTE ON FUNCTION public.target_curse_status(uuid) TO authenticated;

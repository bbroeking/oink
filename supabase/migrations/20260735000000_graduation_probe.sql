-- One-off probe: the finale engine's graduation block swallowed its error on
-- 2026-07-11 (flag stayed false, 1 archived row = the morning demo dry-run).
-- Same body, but RETURNS the SQLERRM so the operator can see what broke.
-- Guarded by the same season0_graduated flag; safe to call repeatedly.
CREATE OR REPLACE FUNCTION public.graduate_season0_probe()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season0_graduated'), false) THEN
		RETURN 'already graduated';
	END IF;
	INSERT INTO public.season0_tickle_standings (user_id, username, tickles_earned, rank, hidden)
	SELECT p.id, p.username, p.tickles_earned,
		RANK() OVER (ORDER BY (p.is_test OR p.hide_from_leaderboard), p.tickles_earned DESC),
		(p.is_test OR p.hide_from_leaderboard)
	FROM public.profiles p
	WHERE p.username IS NOT NULL AND p.username <> ''
	ON CONFLICT (user_id) DO NOTHING;
	UPDATE public.profiles SET tickles_earned = 0 WHERE tickles_earned <> 0;
	UPDATE public.user_items SET item_count = 10, last_increment = now();
	UPDATE public.app_config SET enabled = TRUE, updated_at = now() WHERE key = 'season0_graduated';
	RETURN 'ok';
EXCEPTION WHEN OTHERS THEN
	RETURN 'ERROR: ' || SQLERRM;
END;
$$;
REVOKE ALL ON FUNCTION public.graduate_season0_probe() FROM PUBLIC, anon, authenticated;

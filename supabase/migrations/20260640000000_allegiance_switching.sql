-- Allegiance switching (player request): choose_allegiance loses its
-- first-pick-wins lock — players can switch countries whenever they want
-- by tapping the flag on their Barn (the shop AllegianceCard is gone).
--
-- Switch semantics:
--   • allegiance_country / allegiance_chosen_at update to the new pick.
--   • The new flag is granted (ON CONFLICT DO NOTHING — flags accumulate
--     across switches, which is harmless) and auto-equipped.
--   • The Sunny Pitch background grant + auto-equip happens ONLY on the
--     FIRST pick — re-running it on a switch would stomp whatever
--     background the player has equipped since.
--   • Re-picking the current country is an idempotent ok.
--
-- Body otherwise verbatim from 20260585 (latest choose_allegiance def).

CREATE OR REPLACE FUNCTION public.choose_allegiance(p_flag_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	existing  text;
	default_bg constant text := 'soccer_field_day';
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
	END IF;

	-- Must be a real, non-denylisted flag cosmetic.
	IF NOT EXISTS (
		SELECT 1 FROM public.hats
		WHERE id = p_flag_id AND category = 'flag'
	) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'invalid_flag');
	END IF;

	SELECT allegiance_country INTO existing
	FROM public.profiles WHERE id = caller_id;

	-- Same pick again → idempotent ok (double-tap / other device).
	IF existing = p_flag_id THEN
		RETURN jsonb_build_object(
			'ok', true,
			'allegiance_country', p_flag_id,
			'flag_id', p_flag_id,
			'switched', false
		);
	END IF;

	-- Record allegiance + equip the flag so it shows on the pig/leaderboard.
	UPDATE public.profiles
	SET allegiance_country = p_flag_id,
		allegiance_chosen_at = now(),
		active_flag_id = p_flag_id
	WHERE id = caller_id;

	-- Grant the flag every time; the soccer background only rides along
	-- on the FIRST pick (grant + equip), never on a switch.
	INSERT INTO public.user_hats (user_id, hat_id)
	VALUES (caller_id, p_flag_id)
	ON CONFLICT (user_id, hat_id) DO NOTHING;

	IF existing IS NULL THEN
		UPDATE public.profiles
		SET active_background_id = default_bg
		WHERE id = caller_id;

		INSERT INTO public.user_hats (user_id, hat_id)
		VALUES (caller_id, default_bg)
		ON CONFLICT (user_id, hat_id) DO NOTHING;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'allegiance_country', p_flag_id,
		'flag_id', p_flag_id,
		'switched', existing IS NOT NULL,
		'background_id', CASE WHEN existing IS NULL THEN default_bg END
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.choose_allegiance(text) TO authenticated;

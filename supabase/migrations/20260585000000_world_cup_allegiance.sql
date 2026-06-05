-- World Cup allegiance: a one-time "pick your country" flow.
--
-- 1. Seed the 4 soccer backgrounds as catalog items (also buyable in browse /
--    the WC shop; the allegiance grant hands out soccer_field_day for free).
-- 2. Record a player's allegiance on profiles (locked once chosen).
-- 3. choose_allegiance(): validate + lock-guard, then grant + equip the chosen
--    flag and the default soccer background.

-- ── 1. Soccer background catalog rows ──────────────────────────────
INSERT INTO public.hats
	(id, name, emoji, image_path, cost, display_order, category, rarity, description)
VALUES
	('soccer_field_day',   'Sunny Pitch',        '⚽', NULL, 600, 110, 'background', 'rare', 'Match day under a big blue sky.'),
	('soccer_street',      'Joga Bonito',        '🥅', NULL, 600, 111, 'background', 'rare', 'Sunset pelada in the old neighborhood.'),
	('soccer_podium',      'Champions'' Podium',  '🏆', NULL, 600, 112, 'background', 'rare', 'Confetti, balloons, and a golden cup.'),
	('soccer_field_night', 'Night Match',        '🌙', NULL, 600, 113, 'background', 'rare', 'Floodlights and a stadium full of stars.')
ON CONFLICT (id) DO NOTHING;

-- ── 2. Allegiance columns on profiles ──────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS allegiance_country text
		REFERENCES public.hats(id) ON DELETE SET NULL,
	ADD COLUMN IF NOT EXISTS allegiance_chosen_at timestamptz;

-- ── 3. choose_allegiance(p_flag_id) ────────────────────────────────
-- Idempotent-by-lock: once a user has an allegiance it never changes, so a
-- second call is a no-op that just reports the existing pick. Grants are
-- ON CONFLICT DO NOTHING so re-runs can't duplicate wardrobe rows.
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

	-- Lock: first pick wins for the whole tournament.
	SELECT allegiance_country INTO existing
	FROM public.profiles WHERE id = caller_id;

	IF existing IS NOT NULL THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'already_chosen',
			'allegiance_country', existing
		);
	END IF;

	-- Record allegiance + equip the flag so it shows on the pig/leaderboard.
	UPDATE public.profiles
	SET allegiance_country = p_flag_id,
		allegiance_chosen_at = now(),
		active_flag_id = p_flag_id,
		active_background_id = default_bg
	WHERE id = caller_id;

	-- Grant the flag + the default soccer background.
	INSERT INTO public.user_hats (user_id, hat_id)
	VALUES (caller_id, p_flag_id), (caller_id, default_bg)
	ON CONFLICT (user_id, hat_id) DO NOTHING;

	RETURN jsonb_build_object(
		'ok', true,
		'allegiance_country', p_flag_id,
		'flag_id', p_flag_id,
		'background_id', default_bg
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.choose_allegiance(text) TO authenticated;

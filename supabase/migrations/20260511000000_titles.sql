-- Titles system.
--
-- Mirrors the hats pattern: a catalog table (`titles`) of available
-- titles, a per-user ownership table (`user_titles`), and an
-- `active_title_id` slot on `profiles` for the currently-equipped one.
-- Battle pass title rewards now actually insert into user_titles
-- instead of being a stub.

-- ── catalog ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.titles (
	id          text        PRIMARY KEY,
	name        text        NOT NULL,
	placement   text        NOT NULL DEFAULT 'pre'
		CHECK (placement IN ('pre', 'post')),
	description text,
	created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read titles" ON public.titles;
CREATE POLICY "Anyone can read titles" ON public.titles
	FOR SELECT USING (true);

-- ── ownership ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_titles (
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	title_id   text        NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
	awarded_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, title_id)
);

ALTER TABLE public.user_titles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own titles" ON public.user_titles;
CREATE POLICY "Users can read own titles" ON public.user_titles
	FOR SELECT USING (auth.uid() = user_id);

-- Leaderboard needs to read OTHER users' active title — owned set is
-- private, but the active_title_id on the profile is public-read via
-- the existing profiles RLS, and titles catalog is public-read, so the
-- leaderboard works without exposing the ownership list itself.

-- ── active slot ────────────────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_title_id text REFERENCES public.titles(id) ON DELETE SET NULL;

-- ── seed the existing battle-pass titles ───────────────────────────
-- Keep IDs simple snake_case slugs so the reward_data JSON can keep
-- using the display name and we look it up case-insensitively below.
INSERT INTO public.titles (id, name, placement, description) VALUES
	('piglet',            'Piglet',            'pre',  'Just getting started.'),
	('trotter',           'Trotter',           'pre',  'Quick on the hoof.'),
	('boar_apprentice',   'Boar Apprentice',   'pre',  'Learning the trade.'),
	('mud_caked_mage',    'Mud-Caked Mage',    'pre',  'Mystical and grimy.'),
	('hamfister',         'Hamfister',         'pre',  'Hits hard.'),
	('bacon_baron',       'Bacon Baron',       'pre',  'Industry mogul.'),
	('snout_sage',        'Snout Sage',        'pre',  'Sniffs out wisdom.'),
	('pork_lord',         'Pork Lord',         'pre',  'Reigns over the pen.'),
	('season_1_veteran',  'Season 1 Veteran',  'post', 'Survived the first season.')
ON CONFLICT (id) DO NOTHING;

-- ── equip / unequip RPC ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.equip_title(target_title_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'Not authenticated';
	END IF;

	-- NULL clears the equipped title.
	IF target_title_id IS NULL THEN
		UPDATE public.profiles
			SET active_title_id = NULL
			WHERE id = caller_id;
		RETURN jsonb_build_object('ok', true, 'active_title_id', NULL);
	END IF;

	IF NOT EXISTS (
		SELECT 1 FROM public.user_titles
		WHERE user_id = caller_id AND title_id = target_title_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
	END IF;

	UPDATE public.profiles
		SET active_title_id = target_title_id
		WHERE id = caller_id;

	RETURN jsonb_build_object('ok', true, 'active_title_id', target_title_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.equip_title(text) TO authenticated;

-- ── helper: case-insensitive lookup of title id by display name ────
-- Battle pass reward_data carries the display name ("Piglet"); we map
-- it to a slug ('piglet') by lowercasing + space→underscore.
CREATE OR REPLACE FUNCTION public.title_id_from_name(display_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
	SELECT replace(replace(lower(display_name), ' ', '_'), '-', '_');
$function$;

-- ── update claim_tier_reward to actually award titles ──────────────
-- Replace the prior body (which stubbed title rewards) so a title
-- reward inserts into user_titles. Other reward types (background,
-- pig_skin, boost, mystery_box, cap_increase) still no-op.
CREATE OR REPLACE FUNCTION public.claim_tier_reward(target_tier int, target_track text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id        uuid := auth.uid();
	season           public.seasons;
	progress         record;
	reward           record;
	reward_type_lc   text;
	reward_data      jsonb;
	title_display    text;
	title_slug       text;
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
	IF NOT FOUND OR progress.current_tier < target_tier THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'tier_not_reached');
	END IF;

	IF target_track = 'premium' AND NOT progress.premium_unlocked THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'premium_locked');
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.user_tier_claims
		WHERE user_id = caller_id AND season_id = season.id
		  AND tier = target_tier AND track = target_track
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	SELECT * INTO reward FROM public.season_rewards
		WHERE season_id = season.id
		  AND tier = target_tier
		  AND track = target_track;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
	END IF;

	reward_type_lc := lower(reward.reward_type);
	reward_data    := reward.reward_data;

	IF reward_type_lc = 'tickles' THEN
		UPDATE public.profiles
			SET tickles_earned = tickles_earned + (reward_data->>'amount')::int,
			    counter        = counter        + (reward_data->>'amount')::int
			WHERE id = caller_id;

	ELSIF reward_type_lc = 'hat' THEN
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (caller_id, reward_data->>'hat_id')
			ON CONFLICT (user_id, hat_id) DO NOTHING;

	ELSIF reward_type_lc = 'title' THEN
		title_display := reward_data->>'title';
		IF title_display IS NULL THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'invalid_title_data');
		END IF;
		title_slug := public.title_id_from_name(title_display);
		-- Skip silently if the title isn't in the catalog (data drift)
		-- — claim still records, no crash.
		IF EXISTS (SELECT 1 FROM public.titles WHERE id = title_slug) THEN
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (caller_id, title_slug)
				ON CONFLICT (user_id, title_id) DO NOTHING;
		END IF;

	ELSE
		-- Other reward types are still stubs (background, pig_skin, boost, etc.)
		NULL;
	END IF;

	INSERT INTO public.user_tier_claims (user_id, season_id, tier, track)
		VALUES (caller_id, season.id, target_tier, target_track);

	RETURN jsonb_build_object('ok', true, 'reward_type', reward_type_lc);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_tier_reward(int, text) TO authenticated;

-- ── dev helper: grant any title for testing ───────────────────────
CREATE OR REPLACE FUNCTION public.dev_grant_title(target_title_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.titles WHERE id = target_title_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'title_not_found');
	END IF;
	INSERT INTO public.user_titles (user_id, title_id)
		VALUES (caller_id, target_title_id)
		ON CONFLICT (user_id, title_id) DO NOTHING;
	RETURN jsonb_build_object('ok', true, 'title_id', target_title_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_grant_title(text) TO authenticated;

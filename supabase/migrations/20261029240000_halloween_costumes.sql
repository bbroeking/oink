-- Halloween 2026 full costumes (server half): a Costume slot on the pig, the
-- 11 costume rows on the halloween_2026 Pop-up Stall, and the worn-costume key
-- in the JSON payloads that render a pig.
--
-- Ownership model: a costume is a public.hats row with category = 'costume',
-- owned through user_hats like every other wearable, sold ONLY on the
-- halloween_2026 seasonal shelf (shelf_lane = 'new'). The separate
-- costume_catalog / owned-instance model in the UNPUSHED
-- 20261014200000_halloween_login_costume_gift.sql stays dark; nothing here
-- reads or depends on it (its costume_catalog ids share these ids by design,
-- in a different table, with no FK either way).
--
-- DEPENDS ON 20261029220000_seasonal_shelves.sql (hats.shelf_key/shelf_lane,
-- seasonal_shelf_is_open, the daily_shop / buy_hat / grant_mystery_box lane
-- rules) and 20261029230000_halloween_2026_catalog.sql (the halloween_2026
-- shelf row, which ships DARK). The costumes go live with the shelf window;
-- nothing in this file opens it.
--
-- What this migration does:
--   1. profiles.active_costume_id text, FK -> hats(id) ON DELETE SET NULL
--      (idempotent, same shape as active_bow_id in 20260826030000).
--      * hats.category has no CHECK / enum (plain text since 20260502030000),
--        so 'costume' needs no constraint change.
--      * profiles has a table-level SELECT grant and row-level policies only
--        (no column-level SELECT grants anywhere in the migrations), so the
--        new column is readable by direct PostgREST selects exactly like
--        active_bow_id. No grant change.
--      * UPDATE on profiles is COLUMN-level since 20260913000000 (granted for
--        the columns that existed then). active_costume_id is deliberately
--        NOT granted: the only writer is equip_cosmetic(), which enforces
--        ownership and the Rosie rule. Clients already equip via the RPC.
--   2. equip_cosmetic(text, text): CARRIED from 20260826030000_independent_
--      bow_slot.sql (its latest def; nothing later redefines it). Changes:
--        * CASE gains WHEN 'costume' THEN 'active_costume_id'.
--        * Equipping a costume (non-NULL) needs the caller's EFFECTIVE pig to
--          be 'rosie' (the art is Rosie-fitted only in v1), else
--          {ok:false, reason:'costume_rosie_only'}. Effective pig = the
--          pig_roster() rule: stored active_pig_id only for a member (is_vip)
--          who owns it in user_pigs, else 'rosie' (a lapsed member on a stored
--          pepper is Rosie and may wear one). Checked after no_such_item /
--          not_owned. Unequip (NULL, 'costume') is always allowed.
--        * A costume clears no other slot, and equipping any other slot while
--          costumed keeps the costume (the client hides the outfit under it;
--          taking it off restores the outfit). Both fall out of the generic
--          single-column UPDATE path, unchanged.
--      Same signature, same {ok, update} shape, same REVOKE / GRANT.
--   3. Payloads that render a pig, each CARRIED from its latest def:
--        * home_stats(): the streak wrapper from 20260829000000_contraptions_
--          and_streaks.sql (the latest def; it wraps _home_stats_before_streak,
--          the 20260826030000 body, which is NOT touched). Adds
--          'active_costume_id' and 'active_costume' ({id, category, emoji},
--          the active_x object pattern) to the returned object.
--        * my_porch_round(int): from 20260789000000_porch_round_scrapbook.sql
--          (its only def). Each stop gains 'active_costume_id' and
--          'active_pig_id' (the stored pig, so the client can apply the
--          Rosie-only render rule). plpgsql: no creation-time table
--          dependency.
--      NOT CARRIED, and why:
--        * play_leaderboard (20261004230000_matchmade_play.sql): that
--          migration is AUTHORED, NOT PUSHED (matchmade play is dark), and the
--          function is LANGUAGE sql over play_results, so carrying it here
--          would make this file fail on prod while matchmade play stays
--          unpushed. Add 'costume_id' when matchmade play is pushed.
--        * public_user_stats (20260521010000), suggested_users (20260567000000),
--          alignment_leaderboard (20260708300000): RETURNS TABLE, so a new
--          column is a return-type change (DROP + CREATE). They carry
--          active_hat_id only (no bow either); the client reads the rest of a
--          pig's look from profiles directly.
--        * admin_tickle_overview, onboarding_done, choose_allegiance: read or
--          assign a hat; they do not render another pig.
--   4. The 11 costume rows (ids / names / copy from docs/design/halloween-2026
--      /content.json), all legendary, priced 2400-3600 inside the legendary
--      band (2000-5000), Hollow Jack the showpiece at the top. display_order
--      continues after 20261029230000's 1635. Tagged shelf_key
--      'halloween_2026', shelf_lane 'new'.
--   5. Lanes verified, NO change needed (each already excludes the rows):
--        * daily_shop() (20261029220000): shelf_lane IS DISTINCT FROM 'new'.
--          open_item_drive (Trough, 20260757000000) gates on daily_shop().
--        * grant_mystery_box (20261029220000): shelf_lane IS DISTINCT FROM
--          'new' (and h.category = box_kind, 'hat' for season-pass boxes).
--        * buy_hat (20261029220000): 'new' sells only while the shelf is open
--          ('not_in_window' otherwise).
--        * grant_war_spoils_on_resolve / redeem_war_cosmetic / exchange
--          rotation: war_exclusive rows only (costumes are false).
--        * claim_tier_reward, grant_season1_finale, grant_beta_rewards,
--          redeem_code, award_perfect_feeding_week, try_claim_achievements,
--          complete_referral_if_eligible, handle_new_user, choose_allegiance,
--          donate_to_drive / claim_drive_reward: fixed ids, never a random
--          catalog pick.
--        * open_seasonal_card_pack (20261014180000): grants only an explicit
--          seasonal_card_catalog.item_id mapping (none points at a costume).
--        * Ghost Sheep Trader / trade-ups (20260917170000, 20260920100000,
--          20261029210000), pig errands (20260918120000), Barn / Drum / Monday
--          draws: never read hats or write user_hats.
--
-- Migration AUTHORED ONLY. Never `db push` autonomously (CLAUDE.md).

-- 1. The Costume slot ---------------------------------------------------------
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_costume_id text;

DO $block$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'profiles_active_costume_id_fkey'
			AND conrelid = 'public.profiles'::regclass
	) THEN
		ALTER TABLE public.profiles
			ADD CONSTRAINT profiles_active_costume_id_fkey
			FOREIGN KEY (active_costume_id) REFERENCES public.hats(id)
			ON DELETE SET NULL;
	END IF;
END
$block$;

-- 2. equip_cosmetic(): carried from 20260826030000_independent_bow_slot.sql
--    + the costume slot + the Rosie-only equip rule.
CREATE OR REPLACE FUNCTION public.equip_cosmetic(p_item_id text, p_category text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	v_category text;
	v_column   text;
	v_update   jsonb;
	v_pig_id   text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	IF p_item_id IS NULL THEN
		v_category := p_category;
	ELSE
		SELECT category INTO v_category FROM public.hats WHERE id = p_item_id;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
		END IF;
		IF NOT EXISTS (
			SELECT 1 FROM public.user_hats
			WHERE user_id = caller_id AND hat_id = p_item_id
		) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
		END IF;
	END IF;

	v_column := CASE v_category
		WHEN 'hat'             THEN 'active_hat_id'
		WHEN 'bow'             THEN 'active_bow_id'
		WHEN 'glasses'         THEN 'active_glasses_id'
		WHEN 'mask'            THEN 'active_mask_id'
		WHEN 'scarf'           THEN 'active_neck_id'
		WHEN 'necklace'        THEN 'active_neck_id'
		WHEN 'aura'            THEN 'active_aura_id'
		WHEN 'held'            THEN 'active_held_id'
		WHEN 'background'      THEN 'active_background_id'
		WHEN 'flag'            THEN 'active_flag_id'
		WHEN 'tickle_particle' THEN 'active_tickle_particle_id'
		WHEN 'costume'         THEN 'active_costume_id'
		ELSE NULL
	END;
	IF v_column IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_category');
	END IF;

	IF p_item_id IS NULL THEN
		EXECUTE format('UPDATE public.profiles SET %I = NULL WHERE id = $1', v_column)
			USING caller_id;
		RETURN jsonb_build_object(
			'ok', true,
			'update', jsonb_build_object(v_column, NULL)
		);
	END IF;

	-- Costume art is Rosie-fitted only (v1): putting one on needs Rosie as the
	-- EFFECTIVE pig, the pig_roster() rule (20260781000000 /
	-- 20260791000000): the stored active_pig_id only while the caller is a
	-- member (is_vip) who owns it in user_pigs, else Rosie. So a lapsed member
	-- whose stored pig is still pepper (and who sees Rosie) can wear one.
	-- Taking one off (the NULL path above) is always allowed, and a saved
	-- costume survives a pig switch (the client just does not draw it).
	IF v_category = 'costume' THEN
		SELECT CASE
			WHEN COALESCE(p.is_vip, false) AND EXISTS (
				SELECT 1 FROM public.user_pigs up
				WHERE up.user_id = caller_id AND up.pig_id = COALESCE(p.active_pig_id, 'rosie')
			) THEN COALESCE(p.active_pig_id, 'rosie')
			ELSE 'rosie'
		END
		INTO v_pig_id
		FROM public.profiles p WHERE p.id = caller_id;
		IF COALESCE(v_pig_id, 'rosie') <> 'rosie' THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'costume_rosie_only');
		END IF;
	END IF;

	IF v_category = 'glasses' THEN
		UPDATE public.profiles
			SET active_glasses_id = p_item_id, active_mask_id = NULL
			WHERE id = caller_id;
		v_update := jsonb_build_object('active_glasses_id', p_item_id, 'active_mask_id', NULL);
	ELSIF v_category = 'mask' THEN
		UPDATE public.profiles
			SET active_mask_id = p_item_id, active_glasses_id = NULL
			WHERE id = caller_id;
		v_update := jsonb_build_object('active_mask_id', p_item_id, 'active_glasses_id', NULL);
	ELSE
		-- Includes 'costume': one column, every other slot left as it is.
		EXECUTE format('UPDATE public.profiles SET %I = $1 WHERE id = $2', v_column)
			USING p_item_id, caller_id;
		v_update := jsonb_build_object(v_column, p_item_id);
	END IF;

	RETURN jsonb_build_object('ok', true, 'update', v_update);
END;
$function$;

REVOKE ALL ON FUNCTION public.equip_cosmetic(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(text, text) TO authenticated;

-- 3a. home_stats(): carried from 20260829000000_contraptions_and_streaks.sql
--     (the streak wrapper over _home_stats_before_streak, which stays as is)
--     + the worn costume, in the active_x {id, category, emoji} pattern.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	base jsonb;
	profile_streak record;
	live_streak int;
BEGIN
	base := public._home_stats_before_streak();
	IF caller_id IS NULL OR NOT COALESCE((base->>'ok')::boolean, false) THEN
		RETURN base;
	END IF;

	SELECT current_streak, longest_streak, last_streak_bump_at, active_costume_id
	INTO profile_streak FROM public.profiles WHERE id = caller_id;
	live_streak := CASE
		WHEN profile_streak.last_streak_bump_at IS NULL
			OR profile_streak.last_streak_bump_at < now() - interval '36 hours'
		THEN 0 ELSE profile_streak.current_streak
	END;

	RETURN base || jsonb_build_object(
		'current_streak', live_streak,
		'longest_streak', COALESCE(profile_streak.longest_streak, 0),
		'streak_ends_at', CASE
			WHEN live_streak > 0 THEN profile_streak.last_streak_bump_at + interval '36 hours'
			ELSE NULL
		END,
		'active_costume_id', profile_streak.active_costume_id,
		'active_costume', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = profile_streak.active_costume_id)
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.home_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

-- 3b. my_porch_round(): carried from 20260789000000_porch_round_scrapbook.sql
--     (its only def) + each visited pig's costume and stored pig.
CREATE OR REPLACE FUNCTION public.my_porch_round(p_limit int DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	safe_limit int := LEAST(GREATEST(COALESCE(p_limit, 60), 1), 120);
	stop_rows jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT COALESCE(jsonb_agg(row_data ORDER BY page_number DESC, stop_number), '[]'::jsonb)
	INTO stop_rows
	FROM (
		SELECT
			s.page_number,
			s.stop_number,
			jsonb_build_object(
				'id', s.id,
				'page_number', s.page_number,
				'stop_number', s.stop_number,
				'target_user_id', s.target_id,
				'target_name', COALESCE(NULLIF(trim(p.username), ''), 'A friendly pig'),
				'visited_at', s.created_at,
				'active_hat_id', p.active_hat_id,
				'active_costume_id', p.active_costume_id,
				'active_pig_id', p.active_pig_id,
				'wallow_count', COALESCE(p.wallow_count, 0)
			) AS row_data
		FROM public.porch_round_stops s
		JOIN public.profiles p ON p.id = s.target_id
		WHERE s.visitor_id = caller_id
		  AND NOT public.are_blocked(caller_id, s.target_id)
		ORDER BY s.page_number DESC, s.stop_number
		LIMIT safe_limit
	) recent;

	RETURN jsonb_build_object('ok', true, 'stops', stop_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.my_porch_round(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_porch_round(int) TO authenticated;

-- 4. The costume rows -----------------------------------------------------------
-- Column order (id, name, emoji, cost, display_order, category, ...) matches
-- 20261029230000 and tools/placement_studio.py's catalog-row parser.
--
-- FIT CHECK: the parent may PULL one or two costumes that fail the visual fit
-- check before push. One row per line, so pulling one means deleting its line
-- (mind the trailing comma on the new last row). display_order gaps are fine.
INSERT INTO public.hats
	(id, name, emoji, cost, display_order, category, rarity, description, members_only, pass_exclusive, shelf_key, shelf_lane)
VALUES
	('halloween_2026_hollow_jack_costume', 'Hollow Jack', NULL, 3600, 1636, 'costume', 'legendary', 'A whole patch of moonlit mischief in one suit.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_count_snout_costume', 'Count Snout', NULL, 3200, 1637, 'costume', 'legendary', 'A velvet cape for the gentlest creature of the night.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_moonpuff_costume', 'Moonpuff', NULL, 2800, 1638, 'costume', 'legendary', 'All the moonlit fluff, none of the growl.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_little_reaper_costume', 'Little Reaper', NULL, 3000, 1639, 'costume', 'legendary', 'Here to collect treats and tiny smiles.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_patchwork_pal_costume', 'Patchwork Pal', NULL, 2800, 1640, 'costume', 'legendary', 'Stitched together with friendship and a little moonlight.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_candy_corn_costume', 'Candy Corn', NULL, 2400, 1641, 'costume', 'legendary', 'Three cozy stripes and one very sweet snout.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_linen_lurker_costume', 'Linen Lurker', NULL, 2600, 1642, 'costume', 'legendary', 'Cream bandages, soft seams, and a very awake little snout.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_starspell_costume', 'Starspell', NULL, 3000, 1643, 'costume', 'legendary', 'A pocketful of stars and a moon just for Rosie.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_bat_nap_costume', 'Bat Nap', NULL, 2600, 1644, 'costume', 'legendary', 'Wrapped in plum velvet, ready for a midnight snooze.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_little_imp_costume', 'Little Imp', NULL, 2400, 1645, 'costume', 'legendary', 'Two tiny horns. One very innocent smile.', false, false, 'halloween_2026', 'new'),
	('halloween_2026_marshmallow_boo_costume', 'Marshmallow Boo', NULL, 2400, 1646, 'costume', 'legendary', 'A soft little boo, with Rosie smiling underneath.', false, false, 'halloween_2026', 'new')
ON CONFLICT (id) DO NOTHING;

-- The Wallow — an evergreen prestige lap for players who reach the end of the
-- active season pass.
--
-- Rooting activity already converges on season XP:
--   * bury_truffle: stake / 10 XP (reclaim-cooldown guarded)
--   * dig_truffle: first social dig of the day
--   * submit_rooting: 20 XP per Feeding-window Truffle Patch
-- The pass currently hard-stops at tier 30. A Wallow turns that dead end into a
-- loop: keep every claimed reward, move the visible XP window forward by one
-- full pass, permanently accelerate tickle regeneration, and add one public
-- prestige mark on profiles.wallow_count.
--
-- XP itself stays monotonic. This avoids destroying late-arriving XP and makes
-- concurrent grants safe: visible_xp = xp - wallow_count * cycle_xp. The action
-- locks user_season_progress, so two devices cannot spend the same lap twice.

ALTER TABLE public.user_season_progress
	ADD COLUMN IF NOT EXISTS wallow_count int NOT NULL DEFAULT 0;

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS wallow_count int NOT NULL DEFAULT 0;

DO $$ BEGIN
	ALTER TABLE public.user_season_progress
		ADD CONSTRAINT user_season_progress_wallow_count_check CHECK (wallow_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Internal calculator used both by the live regen clock and by season_state's
-- exact "after your next Wallow" preview. The first two lifetime ranks remove
-- 25% each; later ranks remain visible prestige but add no more clock power.
CREATE OR REPLACE FUNCTION public._regen_secs_for_wallow(uid uuid, p_wallow_count int)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		3600
		* (1.0 - LEAST(2, GREATEST(0, COALESCE(p_wallow_count, 0))) * 0.25)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind IN ('warm_tea', 'mud_wrap', 'chorus_glow')
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;

REVOKE ALL ON FUNCTION public._regen_secs_for_wallow(uuid, int)
	FROM PUBLIC, anon, authenticated;

-- regen_secs_for carried from 20260763000000_member_perks_reshuffle.sql.
-- Paid membership remains absent from this gameplay calculation.
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT public._regen_secs_for_wallow(
		uid,
		COALESCE((SELECT wallow_count FROM public.profiles WHERE id = uid), 0)
	);
$function$;

DO $$ BEGIN
	ALTER TABLE public.profiles
		ADD CONSTRAINT profiles_wallow_count_check CHECK (wallow_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Five rewards across a 30-tier prestige lap. This is intentionally a separate
-- catalog and claim ledger: the original pass remains a one-time collection,
-- while every Wallow lap gets a sparse, repeatable path with no paid track.
CREATE TABLE IF NOT EXISTS public.wallow_tiers (
	tier int PRIMARY KEY CHECK (tier >= 1),
	reward_type text NOT NULL CHECK (reward_type IN ('snouts', 'golden_truffle', 'mystery_box')),
	reward_value jsonb NOT NULL,
	display_label text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.user_wallow_tier_claims (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	season_id text NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
	wallow_lap int NOT NULL CHECK (wallow_lap >= 1),
	tier int NOT NULL REFERENCES public.wallow_tiers(tier),
	claimed_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, season_id, wallow_lap, tier)
);

ALTER TABLE public.wallow_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallow_tier_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
	CREATE POLICY "Wallow tiers public" ON public.wallow_tiers
		FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
	CREATE POLICY "View own Wallow claims" ON public.user_wallow_tier_claims
		FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT ON public.wallow_tiers TO authenticated, anon;
GRANT SELECT ON public.user_wallow_tier_claims TO authenticated;

INSERT INTO public.wallow_tiers (tier, reward_type, reward_value, display_label)
VALUES
	(5,  'snouts',          '{"amount": 125}',       '125 snouts'),
	(10, 'golden_truffle',  '{"amount": 2}',         '2 Golden Truffles'),
	(15, 'mystery_box',     '{"box_kind": "hat"}', 'Mystery Hat Box'),
	(20, 'snouts',          '{"amount": 250}',       '250 snouts'),
	(25, 'golden_truffle',  '{"amount": 2}',         '2 Golden Truffles')
ON CONFLICT (tier) DO UPDATE SET
	reward_type = EXCLUDED.reward_type,
	reward_value = EXCLUDED.reward_value,
	display_label = EXCLUDED.display_label;

-- season_state carried from 20260686000000 (Slop Club includes premium).
-- Diffs: calculate current_tier from the current Wallow lap and expose the
-- additive Wallow state + regeneration-power keys.
CREATE OR REPLACE FUNCTION public.season_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season public.seasons;
	progress public.user_season_progress;
	current_tier int;
	caller_is_vip boolean := false;
	caller_wallow_count int := 0;
	cycle_xp int;
	visible_xp int;
BEGIN
	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('active', false);
	END IF;

	IF caller_id IS NOT NULL THEN
		SELECT * INTO progress
		FROM public.user_season_progress
		WHERE user_id = caller_id AND season_id = season.id;
		SELECT COALESCE(is_vip, false), COALESCE(wallow_count, 0)
		INTO caller_is_vip, caller_wallow_count
		FROM public.profiles WHERE id = caller_id;
	END IF;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	visible_xp := GREATEST(
		0,
		COALESCE(progress.xp, 0) - COALESCE(progress.wallow_count, 0) * cycle_xp
	);
	current_tier := LEAST(
		season.total_tiers,
		GREATEST(1, visible_xp / season.xp_per_tier + 1)
	);
	IF visible_xp >= cycle_xp THEN
		current_tier := season.total_tiers;
	END IF;

	RETURN jsonb_build_object(
		'active', true,
		'season', to_jsonb(season),
		'tiers', (
			SELECT jsonb_agg(to_jsonb(t) ORDER BY t.tier, t.track)
			FROM public.season_tiers t
			WHERE t.season_id = season.id
		),
		-- xp is deliberately lap-local for the existing client progress bar.
		'xp', visible_xp,
		'lifetime_season_xp', COALESCE(progress.xp, 0),
		'current_tier', current_tier,
		'premium_unlocked', (COALESCE(progress.premium_unlocked, false) OR caller_is_vip),
		'premium_plus_unlocked', COALESCE(progress.premium_plus_unlocked, false),
		'wallow_count', caller_wallow_count,
		'season_wallow_count', COALESCE(progress.wallow_count, 0),
		'can_wallow', visible_xp >= cycle_xp,
		'wallow_power_level', LEAST(2, caller_wallow_count),
		'wallow_regen_percent', LEAST(2, caller_wallow_count) * 25,
		'wallow_next_regen_percent', LEAST(2, caller_wallow_count + 1) * 25,
		'wallow_regen_seconds', public._regen_secs_for_wallow(caller_id, caller_wallow_count),
		'wallow_next_regen_seconds', public._regen_secs_for_wallow(caller_id, caller_wallow_count + 1),
		'wallow_tiers', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'tier', wt.tier,
				'track', 'free',
				'reward_type', wt.reward_type,
				'reward_value', wt.reward_value,
				'display_label', wt.display_label
			) ORDER BY wt.tier)
			FROM public.wallow_tiers wt
		), '[]'::jsonb),
		'wallow_claims', COALESCE((
			SELECT jsonb_agg(jsonb_build_object('tier', c.tier, 'track', 'free'))
			FROM public.user_wallow_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.wallow_lap = COALESCE(progress.wallow_count, 0)
		), '[]'::jsonb),
		'claims', COALESCE((
			SELECT jsonb_agg(jsonb_build_object('tier', tier, 'track', track))
			FROM public.user_tier_claims
			WHERE user_id = caller_id AND season_id = season.id
		), '[]'::jsonb)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.season_state() TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.wallow()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season public.seasons;
	progress public.user_season_progress;
	caller_is_vip boolean := false;
	cycle_xp int;
	visible_xp int;
	unclaimed int;
	new_count int;
	lifetime_count int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress
	FROM public.user_season_progress
	WHERE user_id = caller_id AND season_id = season.id
	FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_ready');
	END IF;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	visible_xp := GREATEST(0, progress.xp - progress.wallow_count * cycle_xp);
	IF visible_xp < cycle_xp THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'not_ready',
			'xp_needed', cycle_xp - visible_xp
		);
	END IF;

	SELECT COALESCE(is_vip, false) INTO caller_is_vip
	FROM public.profiles WHERE id = caller_id;

	-- Do not roll a lap while one of its rewards is waiting. The first climb
	-- checks the original free/unlocked-premium pass; later climbs check only the
	-- five rewards belonging to that exact Wallow lap.
	IF progress.wallow_count = 0 THEN
		SELECT count(*) INTO unclaimed
		FROM public.season_tiers t
		WHERE t.season_id = season.id
		  AND (
			t.track = 'free'
			OR (
				t.track = 'premium'
				AND (progress.premium_unlocked OR caller_is_vip)
			)
		  )
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.tier = t.tier
			  AND c.track = t.track
		  );
	ELSE
		SELECT count(*) INTO unclaimed
		FROM public.wallow_tiers wt
		WHERE wt.tier <= season.total_tiers
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_wallow_tier_claims c
			WHERE c.user_id = caller_id
			  AND c.season_id = season.id
			  AND c.wallow_lap = progress.wallow_count
			  AND c.tier = wt.tier
		  );
	END IF;
	IF unclaimed > 0 THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'claim_rewards_first',
			'unclaimed', unclaimed
		);
	END IF;

	UPDATE public.user_season_progress
	SET wallow_count = wallow_count + 1
	WHERE user_id = caller_id AND season_id = season.id
	RETURNING wallow_count INTO new_count;

	UPDATE public.profiles
	SET wallow_count = wallow_count + 1
	WHERE id = caller_id
	RETURNING wallow_count INTO lifetime_count;

	BEGIN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			caller_id,
			'wallow',
			'The mud remembers',
			'You wallowed, your tickle power grew, and the season climb began again.',
			jsonb_build_object(
				'wallow_count', lifetime_count,
				'season_wallow_count', new_count,
				'power_level', LEAST(2, lifetime_count),
				'regen_percent', LEAST(2, lifetime_count) * 25
			)
		);
	EXCEPTION WHEN OTHERS THEN NULL;
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'wallow_count', lifetime_count,
		'season_wallow_count', new_count,
		'power_level', LEAST(2, lifetime_count),
		'regen_percent', LEAST(2, lifetime_count) * 25,
		'regen_seconds', public._regen_secs_for_wallow(caller_id, lifetime_count),
		'xp', GREATEST(0, visible_xp - cycle_xp)
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.wallow() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallow() TO authenticated;

-- Claim one sparse reward from the caller's CURRENT prestige lap. The progress
-- row lock serializes this with wallow(), while the PK makes retries idempotent.
CREATE OR REPLACE FUNCTION public.claim_wallow_tier(target_tier int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	season public.seasons;
	progress public.user_season_progress;
	reward public.wallow_tiers;
	cycle_xp int;
	visible_xp int;
	current_tier int;
	amount int;
	minted int;
	truffle_balance int;
	extra_payload jsonb := '{}'::jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO season FROM public.active_season();
	IF season.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_active_season');
	END IF;

	SELECT * INTO progress
	FROM public.user_season_progress
	WHERE user_id = caller_id AND season_id = season.id
	FOR UPDATE;
	IF NOT FOUND OR progress.wallow_count < 1 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_wallow');
	END IF;

	SELECT * INTO reward FROM public.wallow_tiers WHERE tier = target_tier;
	IF NOT FOUND OR target_tier > season.total_tiers THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_reward');
	END IF;

	cycle_xp := GREATEST(1, season.total_tiers * season.xp_per_tier);
	visible_xp := GREATEST(0, progress.xp - progress.wallow_count * cycle_xp);
	current_tier := LEAST(
		season.total_tiers,
		GREATEST(1, visible_xp / season.xp_per_tier + 1)
	);
	IF visible_xp >= cycle_xp THEN current_tier := season.total_tiers; END IF;
	IF current_tier < target_tier THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'tier_locked',
			'current_tier', current_tier
		);
	END IF;

	IF EXISTS (
		SELECT 1 FROM public.user_wallow_tier_claims c
		WHERE c.user_id = caller_id
		  AND c.season_id = season.id
		  AND c.wallow_lap = progress.wallow_count
		  AND c.tier = target_tier
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	amount := GREATEST(0, COALESCE((reward.reward_value->>'amount')::int, 0));
	IF reward.reward_type = 'snouts' THEN
		UPDATE public.profiles SET counter = counter + amount WHERE id = caller_id;
	ELSIF reward.reward_type = 'golden_truffle' THEN
		-- Refuse before minting if the whole bundle will not fit. mint_truffles()
		-- intentionally allows partial grants, but a claim must be all-or-nothing
		-- or a retry at 998/999 could lose part of its visible reward.
		SELECT golden_truffles INTO truffle_balance
		FROM public.profiles WHERE id = caller_id FOR UPDATE;
		IF COALESCE(truffle_balance, 0) + amount > 999 THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'truffle_cap');
		END IF;
		minted := public.mint_truffles(caller_id, amount, 'wallow_pass', NULL);
		IF minted < amount THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'truffle_cap');
		END IF;
		extra_payload := jsonb_build_object('golden_truffles', minted);
	ELSIF reward.reward_type = 'mystery_box' THEN
		extra_payload := public.grant_mystery_box(
			caller_id,
			COALESCE(reward.reward_value->>'box_kind', 'hat')
		);
	END IF;

	INSERT INTO public.user_wallow_tier_claims
		(user_id, season_id, wallow_lap, tier)
	VALUES (caller_id, season.id, progress.wallow_count, target_tier);

	RETURN jsonb_build_object(
		'ok', true,
		'reward_type', reward.reward_type,
		'wallow_lap', progress.wallow_count,
		'tier', target_tier
	) || extra_payload;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_wallow_tier(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_wallow_tier(int) TO authenticated;

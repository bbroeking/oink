-- Smoke: the member pig roster owns selection on the server. Everyone receives
-- Rosie, members may choose one long-term companion, only owned pigs activate,
-- and a lapsed membership keeps the companion while making Rosie effective.
\set ON_ERROR_STOP on

DO $pig_roster_smoke$
DECLARE
	member_id uuid := '00000000-0000-0000-0000-000000060001';
	other_id uuid := '00000000-0000-0000-0000-000000060002';
	r jsonb;
BEGIN
	-- The follow-up hardening must defeat the project's broad default grants.
	IF has_table_privilege('anon', 'public.pig_catalog', 'SELECT')
	   OR has_table_privilege('anon', 'public.user_pigs', 'SELECT')
	   OR has_table_privilege('authenticated', 'public.pig_catalog', 'TRUNCATE')
	   OR has_table_privilege('authenticated', 'public.user_pigs', 'TRUNCATE') THEN
		RAISE EXCEPTION 'roster tables retained broad client privileges';
	END IF;
	IF has_function_privilege('anon', 'public.pig_roster()', 'EXECUTE')
	   OR has_function_privilege('anon', 'public.recruit_pig(text)', 'EXECUTE')
	   OR has_function_privilege('anon', 'public.activate_pig(text)', 'EXECUTE')
	   OR has_function_privilege('authenticated', 'public.grant_default_pig()', 'EXECUTE') THEN
		RAISE EXCEPTION 'roster functions retained broad client execution';
	END IF;
	IF NOT has_table_privilege('authenticated', 'public.pig_catalog', 'SELECT')
	   OR NOT has_table_privilege('authenticated', 'public.user_pigs', 'SELECT')
	   OR NOT has_function_privilege('authenticated', 'public.pig_roster()', 'EXECUTE')
	   OR NOT has_function_privilege('authenticated', 'public.recruit_pig(text)', 'EXECUTE')
	   OR NOT has_function_privilege('authenticated', 'public.activate_pig(text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'roster least-privilege grants are incomplete';
	END IF;

	INSERT INTO auth.users (id) VALUES (member_id), (other_id);
	INSERT INTO public.profiles (id, username, is_vip)
	VALUES
		(member_id, 'rosterpig', false),
		(other_id, 'otherpig', true);

	-- The profile trigger grants Rosie and never leaks another user's pig.
	IF NOT EXISTS (
		SELECT 1 FROM public.user_pigs
		WHERE user_id = member_id AND pig_id = 'rosie'
	) THEN
		RAISE EXCEPTION 'default Rosie was not granted';
	END IF;
	IF EXISTS (
		SELECT 1 FROM public.user_pigs
		WHERE user_id = member_id AND pig_id <> 'rosie'
	) THEN
		RAISE EXCEPTION 'unexpected companion granted';
	END IF;

	PERFORM set_config('smoke.uid', member_id::text, true);
	r := public.pig_roster();
	IF (r->>'ok')::boolean IS NOT TRUE
	   OR (r->>'is_member')::boolean IS NOT FALSE
	   OR r->>'active_pig_id' <> 'rosie'
	   OR jsonb_array_length(r->'pigs') <> 6 THEN
		RAISE EXCEPTION 'starter roster shape is wrong: %', r;
	END IF;

	r := public.recruit_pig('copper');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'membership_required' THEN
		RAISE EXCEPTION 'non-member recruit did not fail closed: %', r;
	END IF;

	UPDATE public.profiles SET is_vip = true WHERE id = member_id;
	r := public.recruit_pig('copper');
	IF (r->>'ok')::boolean IS NOT TRUE OR r->>'pig_id' <> 'copper' THEN
		RAISE EXCEPTION 'member recruit failed: %', r;
	END IF;
	IF (SELECT active_pig_id FROM public.profiles WHERE id = member_id) <> 'copper' THEN
		RAISE EXCEPTION 'recruited pig was not activated';
	END IF;

	r := public.pig_roster();
	IF r->>'active_pig_id' <> 'copper'
	   OR r->>'recruited_pig_id' <> 'copper'
	   OR NOT EXISTS (
			SELECT 1
			FROM jsonb_array_elements(r->'pigs') pig
			WHERE pig->>'id' = 'copper'
				AND (pig->>'owned')::boolean
				AND (pig->>'selected')::boolean
		) THEN
		RAISE EXCEPTION 'recruited pig missing from effective roster: %', r;
	END IF;

	-- The companion choice is locked. A second recruit fails and preserves the
	-- original ownership and active selection.
	r := public.recruit_pig('pepper');
	IF (r->>'ok')::boolean IS NOT FALSE
	   OR r->>'reason' <> 'roster_full'
	   OR r->>'pig_id' <> 'copper' THEN
		RAISE EXCEPTION 'second companion recruit did not fail locked: %', r;
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.user_pigs
		WHERE user_id = member_id AND pig_id = 'copper'
	) OR EXISTS (
		SELECT 1 FROM public.user_pigs
		WHERE user_id = member_id AND pig_id = 'pepper'
	) THEN
		RAISE EXCEPTION 'locked companion choice changed ownership rows';
	END IF;

	-- Rosie remains owned and can be selected again.
	r := public.activate_pig('rosie');
	IF (r->>'ok')::boolean IS NOT TRUE
	   OR (SELECT active_pig_id FROM public.profiles WHERE id = member_id) <> 'rosie' THEN
		RAISE EXCEPTION 'Rosie activation failed: %', r;
	END IF;

	r := public.activate_pig('copper');
	IF (r->>'ok')::boolean IS NOT TRUE
	   OR (SELECT active_pig_id FROM public.profiles WHERE id = member_id) <> 'copper' THEN
		RAISE EXCEPTION 'companion reactivation failed: %', r;
	END IF;

	r := public.activate_pig('pepper');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'unowned pig activation did not fail closed: %', r;
	END IF;

	-- A lapse retains the companion but prevents it from being effective.
	UPDATE public.profiles
	SET is_vip = false, active_pig_id = 'copper'
	WHERE id = member_id;
	r := public.pig_roster();
	IF r->>'active_pig_id' <> 'rosie' OR r->>'recruited_pig_id' <> 'copper' THEN
		RAISE EXCEPTION 'lapsed membership roster is wrong: %', r;
	END IF;
	r := public.activate_pig('copper');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'membership_required' THEN
		RAISE EXCEPTION 'lapsed member activation did not fail closed: %', r;
	END IF;

	PERFORM set_config('smoke.uid', '', true);
	r := public.pig_roster();
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'not_authenticated' THEN
		RAISE EXCEPTION 'unauthenticated roster did not fail closed: %', r;
	END IF;

	RAISE NOTICE 'chk 60 pig_roster: grant + locked choice + activate + lapse OK';
END
$pig_roster_smoke$;

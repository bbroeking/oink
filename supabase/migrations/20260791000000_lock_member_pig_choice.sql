-- Lock the Slop Club companion to one long-term choice.
--
-- Members may still choose whether Rosie or their recruited companion appears
-- on Home. They may not replace the recruited companion for now. Existing
-- players keep whichever non-Rosie pig they currently own.

CREATE UNIQUE INDEX IF NOT EXISTS user_pigs_one_companion_idx
	ON public.user_pigs (user_id)
	WHERE pig_id <> 'rosie';

CREATE OR REPLACE FUNCTION public.pig_roster()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	caller uuid := auth.uid();
	member boolean := false;
	stored_active text := 'rosie';
	effective_active text := 'rosie';
	recruited text;
BEGIN
	IF caller IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT COALESCE(p.is_vip, false), COALESCE(p.active_pig_id, 'rosie')
	INTO member, stored_active
	FROM public.profiles p
	WHERE p.id = caller;

	SELECT up.pig_id INTO recruited
	FROM public.user_pigs up
	WHERE up.user_id = caller AND up.pig_id <> 'rosie'
	ORDER BY up.recruited_at
	LIMIT 1;

	effective_active := CASE
		WHEN member AND EXISTS (
			SELECT 1 FROM public.user_pigs
			WHERE user_id = caller AND pig_id = stored_active
		) THEN stored_active
		ELSE 'rosie'
	END;

	RETURN jsonb_build_object(
		'ok', true,
		'is_member', member,
		'active_pig_id', effective_active,
		'recruited_pig_id', recruited,
		'pigs', (
			SELECT COALESCE(jsonb_agg(
				jsonb_build_object(
					'id', pc.id,
					'name', pc.name,
					'coat', pc.coat,
					'owned', EXISTS (
						SELECT 1 FROM public.user_pigs up
						WHERE up.user_id = caller AND up.pig_id = pc.id
					),
					'selected', pc.id = effective_active,
					'recruitable', member
						AND recruited IS NULL
						AND pc.id <> 'rosie'
				)
				ORDER BY pc.sort_order
			), '[]'::jsonb)
			FROM public.pig_catalog pc
			WHERE pc.available
		)
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.recruit_pig(target_pig_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	caller uuid := auth.uid();
	member boolean := false;
	existing_pig text;
BEGIN
	IF caller IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT COALESCE(is_vip, false)
	INTO member
	FROM public.profiles
	WHERE id = caller
	FOR UPDATE;

	IF NOT member THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'membership_required');
	END IF;
	IF target_pig_id = 'rosie' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'default_pig');
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.pig_catalog
		WHERE id = target_pig_id AND available
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_pig');
	END IF;

	SELECT pig_id INTO existing_pig
	FROM public.user_pigs
	WHERE user_id = caller AND pig_id <> 'rosie'
	ORDER BY recruited_at
	LIMIT 1;

	IF existing_pig IS NOT NULL AND existing_pig <> target_pig_id THEN
		RETURN jsonb_build_object(
			'ok', false,
			'reason', 'roster_full',
			'pig_id', existing_pig
		);
	END IF;

	-- Idempotent for purchase/webhook retries of the same choice.
	INSERT INTO public.user_pigs (user_id, pig_id)
	VALUES (caller, target_pig_id)
	ON CONFLICT (user_id, pig_id) DO NOTHING;

	UPDATE public.profiles
	SET active_pig_id = target_pig_id
	WHERE id = caller;

	RETURN jsonb_build_object('ok', true, 'pig_id', target_pig_id);
END;
$$;

REVOKE ALL ON FUNCTION public.pig_roster()
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recruit_pig(text)
	FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pig_roster() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recruit_pig(text) TO authenticated;

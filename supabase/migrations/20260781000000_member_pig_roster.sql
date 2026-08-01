-- Slop Club pig roster.
--
-- Everyone owns Rosie. An active member has one replaceable companion slot,
-- then chooses which roster pig is effective on Home. If membership
-- lapses, the companion is retained but Rosie is effective until membership
-- resumes.

CREATE TABLE IF NOT EXISTS public.pig_catalog (
	id text PRIMARY KEY,
	name text NOT NULL,
	coat text NOT NULL,
	sort_order integer NOT NULL UNIQUE,
	available boolean NOT NULL DEFAULT true
);

INSERT INTO public.pig_catalog (id, name, coat, sort_order, available) VALUES
	('rosie',   'Rosie',   'Classic pink',                 1, true),
	('copper',  'Copper',  'Rusty red',                    2, true),
	('pepper',  'Pepper',  'Black with white points',      3, true),
	('bandit',  'Bandit',  'Black with a cream blaze',     4, true),
	('pickles', 'Pickles', 'Pink with black spots',        5, true),
	('biscuit', 'Biscuit', 'Sandy with black spots',       6, true)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	coat = EXCLUDED.coat,
	sort_order = EXCLUDED.sort_order,
	available = EXCLUDED.available;

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_pig_id text
		REFERENCES public.pig_catalog(id)
		DEFAULT 'rosie';

UPDATE public.profiles SET active_pig_id = 'rosie' WHERE active_pig_id IS NULL;
ALTER TABLE public.profiles ALTER COLUMN active_pig_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_pigs (
	user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	pig_id text NOT NULL REFERENCES public.pig_catalog(id),
	recruited_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, pig_id)
);

CREATE INDEX IF NOT EXISTS user_pigs_user_recruited_idx
	ON public.user_pigs (user_id, recruited_at);

INSERT INTO public.user_pigs (user_id, pig_id)
SELECT id, 'rosie' FROM public.profiles
ON CONFLICT (user_id, pig_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_default_pig()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	INSERT INTO public.user_pigs (user_id, pig_id)
	VALUES (NEW.id, 'rosie')
	ON CONFLICT (user_id, pig_id) DO NOTHING;
	RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_grant_default_pig ON public.profiles;
CREATE TRIGGER profiles_grant_default_pig
	AFTER INSERT ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.grant_default_pig();

ALTER TABLE public.pig_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_pigs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pig_catalog_authenticated_read ON public.pig_catalog;
CREATE POLICY pig_catalog_authenticated_read ON public.pig_catalog
	FOR SELECT TO authenticated USING (available);

DROP POLICY IF EXISTS user_pigs_own_read ON public.user_pigs;
CREATE POLICY user_pigs_own_read ON public.user_pigs
	FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.pig_catalog FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_pigs FROM authenticated;
GRANT SELECT ON public.pig_catalog, public.user_pigs TO authenticated;

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
						AND pc.id <> 'rosie'
						AND NOT EXISTS (
							SELECT 1 FROM public.user_pigs up
							WHERE up.user_id = caller AND up.pig_id = pc.id
						)
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

	-- The Slop Club grants one companion slot, not a permanent one-time pick.
	-- Replacing it is atomic while the profile row remains locked.
	DELETE FROM public.user_pigs
	WHERE user_id = caller
		AND pig_id <> 'rosie'
		AND pig_id <> target_pig_id;

	INSERT INTO public.user_pigs (user_id, pig_id)
	VALUES (caller, target_pig_id)
	ON CONFLICT (user_id, pig_id) DO NOTHING;

	UPDATE public.profiles
	SET active_pig_id = target_pig_id
	WHERE id = caller;

	RETURN jsonb_build_object(
		'ok', true,
		'pig_id', target_pig_id,
		'replaced_pig_id', CASE
			WHEN existing_pig IS DISTINCT FROM target_pig_id THEN existing_pig
			ELSE NULL
		END
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_pig(target_pig_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
	caller uuid := auth.uid();
	member boolean := false;
BEGIN
	IF caller IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT COALESCE(is_vip, false)
	INTO member
	FROM public.profiles
	WHERE id = caller
	FOR UPDATE;

	IF target_pig_id <> 'rosie' AND NOT member THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'membership_required');
	END IF;
	IF NOT EXISTS (
		SELECT 1 FROM public.user_pigs
		WHERE user_id = caller AND pig_id = target_pig_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_owned');
	END IF;

	UPDATE public.profiles
	SET active_pig_id = target_pig_id
	WHERE id = caller;

	RETURN jsonb_build_object('ok', true, 'pig_id', target_pig_id);
END;
$$;

REVOKE ALL ON FUNCTION public.pig_roster() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recruit_pig(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_pig(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pig_roster() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recruit_pig(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pig(text) TO authenticated;

CREATE OR REPLACE FUNCTION public._patch_now()
RETURNS timestamptz LANGUAGE sql STABLE
SET search_path TO 'pg_catalog', 'public'
AS $$
	SELECT COALESCE(NULLIF(current_setting('ttp.fake_now', true), '')::timestamptz, now())
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

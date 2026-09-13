-- Keep secure Mote sampling portable across Supabase's `extensions` pgcrypto
-- install and a plain-Postgres `public` install without leaving an unresolved
-- schema-qualified fallback for database lint to analyze.
CREATE OR REPLACE FUNCTION public._mote_secure_bucket(p_size int)
RETURNS int
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  b bytea;
  n int;
  ceiling int;
  crypto_schema name;
BEGIN
  IF p_size IS NULL OR p_size < 1 OR p_size > 10000 THEN
    RAISE EXCEPTION 'bad bucket size';
  END IF;

  SELECT ns.nspname::name
    INTO crypto_schema
  FROM pg_catalog.pg_extension ext
  JOIN pg_catalog.pg_namespace ns ON ns.oid = ext.extnamespace
  WHERE ext.extname = 'pgcrypto'
    AND ns.nspname IN ('extensions', 'public')
  ORDER BY CASE ns.nspname WHEN 'extensions' THEN 0 ELSE 1 END
  LIMIT 1;

  IF crypto_schema IS NULL THEN
    RAISE EXCEPTION 'pgcrypto gen_random_bytes is unavailable';
  END IF;

  ceiling := (65536 / p_size) * p_size;
  LOOP
    EXECUTE format('SELECT %I.gen_random_bytes(2)', crypto_schema) INTO b;
    n := get_byte(b, 0) * 256 + get_byte(b, 1);
    IF n < ceiling THEN
      RETURN n % p_size;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public._mote_secure_bucket(int)
  FROM PUBLIC, anon, authenticated;

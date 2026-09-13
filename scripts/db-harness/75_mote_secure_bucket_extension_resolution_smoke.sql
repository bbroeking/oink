\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS extensions;

DO $invalid_sizes$
BEGIN
  BEGIN PERFORM public._mote_secure_bucket(NULL); RAISE EXCEPTION 'NULL size accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'bad bucket size' THEN RAISE; END IF; END;
  BEGIN PERFORM public._mote_secure_bucket(0); RAISE EXCEPTION 'zero size accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'bad bucket size' THEN RAISE; END IF; END;
  BEGIN PERFORM public._mote_secure_bucket(10001); RAISE EXCEPTION 'large size accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'bad bucket size' THEN RAISE; END IF; END;
END $invalid_sizes$;

ALTER EXTENSION pgcrypto SET SCHEMA public;
DO $public_install$
DECLARE i int; sample int;
BEGIN
  FOR i IN 1..64 LOOP
    sample := public._mote_secure_bucket(10000);
    IF sample < 0 OR sample >= 10000 THEN RAISE EXCEPTION 'public sample out of range: %', sample; END IF;
  END LOOP;
END $public_install$;

ALTER EXTENSION pgcrypto SET SCHEMA extensions;
DO $extensions_install$
DECLARE i int; sample int;
BEGIN
  FOR i IN 1..64 LOOP
    sample := public._mote_secure_bucket(10000);
    IF sample < 0 OR sample >= 10000 THEN RAISE EXCEPTION 'extensions sample out of range: %', sample; END IF;
  END LOOP;
END $extensions_install$;

BEGIN;
DROP EXTENSION pgcrypto CASCADE;
DO $missing_extension$
BEGIN
  BEGIN
    PERFORM public._mote_secure_bucket(10);
    RAISE EXCEPTION 'missing pgcrypto accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'pgcrypto gen_random_bytes is unavailable' THEN RAISE; END IF;
  END;
END $missing_extension$;
ROLLBACK;

DO $privileges$
BEGIN
  IF has_function_privilege('anon','public._mote_secure_bucket(int)','EXECUTE')
     OR has_function_privilege('authenticated','public._mote_secure_bucket(int)','EXECUTE')
  THEN RAISE EXCEPTION 'secure bucket helper is externally executable'; END IF;
  RAISE NOTICE 'chk mote secure bucket: trusted public/extensions resolution, validation, missing extension, privileges OK';
END $privileges$;

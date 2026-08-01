-- Pig-roster least privilege.
--
-- This project's database default privileges grant broad access to new tables
-- and functions. The roster migration revoked table writes and PUBLIC function
-- execution, but direct grants inherited by anon/authenticated survived:
-- authenticated retained TRUNCATE/REFERENCES/TRIGGER on both roster tables,
-- anon retained table access, and anon could execute the authenticated RPCs.
-- RLS and auth.uid() made those paths fail closed through PostgREST, but the
-- grants are unnecessary and violate the module's intended RPC-only writes.

REVOKE ALL ON TABLE public.pig_catalog FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_pigs FROM anon, authenticated;
GRANT SELECT ON TABLE public.pig_catalog TO authenticated;
GRANT SELECT ON TABLE public.user_pigs TO authenticated;

-- Trigger execution does not require callers to hold EXECUTE on its function.
REVOKE ALL ON FUNCTION public.grant_default_pig()
	FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.pig_roster()
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recruit_pig(text)
	FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activate_pig(text)
	FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.pig_roster() TO authenticated;
GRANT EXECUTE ON FUNCTION public.recruit_pig(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pig(text) TO authenticated;

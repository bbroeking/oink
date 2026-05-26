-- (No-op) Removed: auto-confirm email signups via a BEFORE INSERT
-- trigger on auth.users.
--
-- The trigger ran with SET search_path TO '', which broke
-- unqualified function references (now()) in the function body —
-- introspection from GoTrue's schema query failed and signin
-- returned 500 "Database error querying schema" for ALL email
-- signups, not just new ones.
--
-- Supabase already auto-confirms email signups at the project
-- level (project settings → Auth → Email confirmations OFF, the
-- default for new projects). The trigger was redundant.
--
-- This migration drops the trigger + function if either exists,
-- to clean up environments where the original 20260564000000
-- already ran. Idempotent.

DROP TRIGGER IF EXISTS auto_confirm_email_signup ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_email_signup();

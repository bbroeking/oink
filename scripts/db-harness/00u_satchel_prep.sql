-- Prep for 20260915010000_satchel.sql: the stubs for what fulfil_pig_wish
-- calls that the minimal chain never defines (production has all of these):
-- apply_happiness (20260612), shift_alignment (20260536), are_blocked
-- (20260565). Signatures match production so check_function_bodies validates
-- the real call sites. (The guestbook is retired — 20260913020000 dropped its
-- table — so nothing here stubs it; the migration must not touch it.)
CREATE OR REPLACE FUNCTION public.apply_happiness(uid uuid, raw_gain numeric)
RETURNS void LANGUAGE sql AS $$ SELECT $$;
-- 48_mudwrap_stacking_smoke stubs shift_alignment as RETURNS void; production
-- returns int. Drop and re-stub with the real signature (PERFORM ignores it).
DROP FUNCTION IF EXISTS public.shift_alignment(uuid, int);
CREATE FUNCTION public.shift_alignment(target_user_id uuid, delta int)
RETURNS int LANGUAGE plpgsql AS $$
BEGIN
	UPDATE public.profiles SET alignment_score = COALESCE(alignment_score, 0) + delta WHERE id = target_user_id;
	RETURN (SELECT alignment_score FROM public.profiles WHERE id = target_user_id);
END $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS alignment_score int NOT NULL DEFAULT 0;

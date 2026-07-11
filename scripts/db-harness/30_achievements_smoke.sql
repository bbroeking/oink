-- Achievements smoke — the re-themed dig ladders credit at runtime after the
-- co-op rebuild (20260714). The former scuffle-wins category is now
-- truffles_dug (war_truffles ledger count); dig_count + echo_claims still live.
-- Runs after 15_coop_dig_smoke (rosie/denny/jen + c001 exist).
\set ON_ERROR_STOP on

-- 0. Re-theme applied: no scuffle labels remain; first_rope is now truffles_dug.
SELECT 'first_rope re-themed' AS chk, category, name FROM public.achievements WHERE id = 'first_rope';
SELECT 'scuffle labels remaining (want 0)' AS chk, count(*) FROM public.achievements
	WHERE display_category = 'scuffle';

-- 1. truffles_dug: a fresh pig mints a golden truffle → First Truffle (tier 1).
INSERT INTO public.profiles (id, username) VALUES ('00000000-0000-0000-0000-00000000a010', 'zed');
INSERT INTO public.war_truffles (user_id, amount, reason)
	VALUES ('00000000-0000-0000-0000-00000000a010', 1, 'dig');
SELECT public.try_claim_achievements('00000000-0000-0000-0000-00000000a010', 'truffles_dug');
SELECT 'first_truffle claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a010' AND achievement_id = 'first_rope';
SELECT 'first_truffle snouts (want 50)' AS chk, counter FROM public.profiles
	WHERE id = '00000000-0000-0000-0000-00000000a010';

-- 2. dig_count still fires (denny/a002 dug in 15 → first_rooting is claimed).
SELECT 'first_rooting claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a002' AND achievement_id = 'first_rooting';

-- 3. echo_claims fires heard_the_call.
INSERT INTO public.echo_claims (event_id, user_id)
	VALUES (gen_random_uuid(), '00000000-0000-0000-0000-00000000a003');
SELECT 'heard_the_call claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a003' AND achievement_id = 'heard_the_call';

-- 4. Idempotent: re-firing truffles_dug doesn't double-claim or double-pay.
SELECT public.try_claim_achievements('00000000-0000-0000-0000-00000000a010', 'truffles_dug');
SELECT 'no double claim' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a010' AND achievement_id = 'first_rope';
SELECT 'snouts unchanged (want 50)' AS chk, counter FROM public.profiles
	WHERE id = '00000000-0000-0000-0000-00000000a010';

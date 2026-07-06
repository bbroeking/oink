-- Season-1 achievements smoke — exercises the war→achievement flow at
-- runtime: counter moves → trigger → try_claim_achievements → claim row +
-- snout grant. Runs after 10_league_smoke (rosie/denny/jen profiles exist).
\set ON_ERROR_STOP on

-- 1. A war win fires first_rope (threshold 1).
UPDATE public.profiles SET war_wins = 1
	WHERE id = '00000000-0000-0000-0000-00000000a001';
SELECT 'first_rope claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a001'
	  AND achievement_id = 'first_rope';
SELECT 'first_rope snouts (want 50)' AS chk, counter FROM public.profiles
	WHERE id = '00000000-0000-0000-0000-00000000a001';

-- 2. A submitted dig fires first_rooting (AFTER UPDATE OF submitted_at).
INSERT INTO public.war_rootings (war_id, user_id, crew_id, window_index)
	SELECT w.id, '00000000-0000-0000-0000-00000000a002', w.challenger_crew, 1
	FROM public.mud_wars w LIMIT 1;
UPDATE public.war_rootings SET submitted_at = now()
	WHERE user_id = '00000000-0000-0000-0000-00000000a002';
SELECT 'first_rooting claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a002'
	  AND achievement_id = 'first_rooting';

-- 3. An echo claim fires heard_the_call.
INSERT INTO public.echo_claims (event_id, user_id)
	VALUES (gen_random_uuid(), '00000000-0000-0000-0000-00000000a003');
SELECT 'heard_the_call claimed' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a003'
	  AND achievement_id = 'heard_the_call';

-- 4. Idempotent: re-firing the trigger doesn't double-claim or double-pay.
UPDATE public.profiles SET war_wins = 2
	WHERE id = '00000000-0000-0000-0000-00000000a001';
SELECT 'no double claim' AS chk, count(*) FROM public.user_achievements
	WHERE user_id = '00000000-0000-0000-0000-00000000a001'
	  AND achievement_id = 'first_rope';
SELECT 'snouts unchanged (want 50)' AS chk, counter FROM public.profiles
	WHERE id = '00000000-0000-0000-0000-00000000a001';

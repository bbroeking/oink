-- SECURITY FIX — the internal SECURITY DEFINER helpers in 20260667 + 20260668 were
-- only REVOKEd FROM PUBLIC, but this project grants anon/authenticated EXECUTE via
-- default privileges, so a direct client RPC call still executed them. Verified live
-- (scripts/verify_rhythm.mjs): anon could run apply_crew_elo (LADDER TAMPER) and
-- fold_front_outcome / fold_rhythm_margin / rhythm_area_holds (FOG BYPASS — these are
-- SECURITY DEFINER so they read mud_front_pushes / mud_war_deploys PAST RLS, letting a
-- participant compute the opponent's current-day mud + deploy + holds before the reveal,
-- defeating the Pillar-1 hidden Blotto).
--
-- FIX: REVOKE EXECUTE from anon + authenticated (and PUBLIC) explicitly. These helpers
-- are ONLY ever called from owner-context SECURITY DEFINER RPCs (score_mud_war_days,
-- resolve_war, war_state, submit_run, throw_mud, set_deploy, …), and an internal call
-- inside a SECURITY DEFINER function runs as the owner — NOT as anon/authenticated — so
-- the live RPC chain is unaffected; only DIRECT client calls are blocked.
--
-- NB: war_fronts_state self-guards (p_caller = auth.uid() + participant) so it was never
-- a live leak, but it's revoked here too for defense-in-depth and consistency.

DO $$
DECLARE sig text;
BEGIN
	FOREACH sig IN ARRAY ARRAY[
		-- from 20260667 (fronts)
		'public.war_fronts_state(uuid, uuid)',
		'public.fold_front_margin(uuid, date)',
		'public.fold_front_outcome(uuid, date, text)',
		'public.bot_front_eff(int)',
		'public.apply_crew_elo(uuid, uuid, uuid, int)',
		'public.seed_war_board(uuid, date)',
		'public.band_base_p(text)',
		'public.pick_weekly_modifier(uuid)',
		-- from 20260668 (rhythm)
		'public.rhythm_area_holds(uuid, date, text)',
		'public.fold_rhythm_margin(uuid, date)',
		'public.deploy_press(text)',
		'public.bot_deploy(int)',
		'public.grant_war_access(uuid, uuid)'
	]
	LOOP
		EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated;', sig);
	END LOOP;
END $$;

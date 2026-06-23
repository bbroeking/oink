-- Mud Wars launch blockers (server). Mud Wars is dark-launched
-- (MUD_FIGHTS_VISIBLE = __DEV__, hidden in production), so this is a no-op for
-- prod users today — it operates only on dev wars until launch.
--
-- (1) AUTOMATED RESOLUTION. resolve_war() was lazy-only: it ran only when a
--     participant opened the war screen / slung. If a disengaged crew stopped
--     opening the app after ends_at, the war never resolved — winners unpaid,
--     no regen buff / titles / war-spoils cosmetic, and the loser soft-locked
--     (leave_crew is blocked while in_war). A pg_cron sweep now resolves expired
--     active wars on a schedule. resolve_war is idempotent (no double-pay),
--     SECURITY DEFINER, and context-free (no auth.uid()), so calling it per war
--     from cron is safe, and its status flip fires grant_war_spoils_on_resolve.
-- (2) PENDING EXPIRY. A 'pending' challenge that was never accepted or declined
--     locked BOTH crews out of any other war indefinitely (the partial unique
--     indexes treat 'pending' as a live war, and leave_crew is blocked in_war).
--     The sweep auto-declines pending wars older than 48h and tells both crews.
-- (3) prize_sash category fix — see bottom.
--
-- pg_cron is ALREADY installed (see 20260579) — do NOT CREATE EXTENSION (the
-- Supabase after-create hook errors 2BP01 on the existing grant state).
-- Scheduling alone is enough.
--   Cancel:  SELECT cron.unschedule('mud-wars-sweep');
--   Verify:  SELECT * FROM cron.job;  /  SELECT * FROM cron.job_run_details ORDER BY start_time DESC;

CREATE OR REPLACE FUNCTION public.sweep_mud_wars()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r record;
	c_pending_ttl interval := interval '48 hours';
BEGIN
	-- 1. Resolve every active war past its deadline. resolve_war is idempotent
	--    and pays out + fires the war-spoils trigger on the status flip.
	FOR r IN
		SELECT id FROM public.mud_wars
		WHERE status = 'active' AND resolved_at IS NULL AND ends_at <= now()
	LOOP
		PERFORM public.resolve_war(r.id);
	END LOOP;

	-- 2. Expire pending challenges that were never answered, freeing both crews.
	FOR r IN
		SELECT id, challenger_crew, defender_crew FROM public.mud_wars
		WHERE status = 'pending' AND created_at <= now() - c_pending_ttl
	LOOP
		UPDATE public.mud_wars SET status = 'declined' WHERE id = r.id;
		-- Notify both crews (guarded — a bad insert can't undo the status flip).
		BEGIN
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			SELECT cm.user_id, 'war_expired', 'Mud Fight challenge expired',
				'A challenge went unanswered for 48 hours and was called off.',
				jsonb_build_object('war_id', r.id)
			FROM public.crew_members cm
			WHERE cm.crew_id = r.challenger_crew OR cm.crew_id = r.defender_crew;
		EXCEPTION WHEN OTHERS THEN NULL; END;
	END LOOP;
END;
$function$;

-- Only cron invokes this; do NOT grant it to authenticated (no user should be
-- able to trigger a global sweep). The cron job runs as the scheduling role,
-- which owns the function.

-- Every 15 minutes: wars run 5 days, so this resolves within 15 min of ends_at
-- and expires pending within 15 min of the 48h mark — cheap (tiny table) and
-- prompt. cron.schedule upserts by job name, so re-applying is safe.
SELECT cron.schedule(
	'mud-wars-sweep',
	'*/15 * * * *',
	$$SELECT public.sweep_mud_wars()$$
);

-- (3) prize_sash shipped (20260650) with category 'neck', which the client slot
-- map does not recognize (only 'scarf'/'necklace' route to the Neck slot) — so
-- it fell through to the head slot and never appeared in the Closet (CAT_ORDER
-- has 'necklace', not 'neck'). 'necklace' fixes both routing and visibility.
-- Forward-only fix for the already-seeded row.
UPDATE public.hats SET category = 'necklace' WHERE id = 'prize_sash';

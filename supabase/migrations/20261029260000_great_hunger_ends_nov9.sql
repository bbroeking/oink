-- ═══════════════════════════════════════════════════════════════════════════
-- THE GREAT HUNGER ENDS MONDAY 2026-11-09 00:00 UTC (Sun Nov 8, 7pm ET), AND
-- THE FEAST FLIPS AT THE SAME INSTANT
--
-- Founder rulings 2026-10-29 (final; SKILL.md log): snout_season_1 ends
-- 2026-11-09 00:00 UTC and Season 2 flips then through the already-pushed
-- flip_season_2() (20261029190000, full fresh start per
-- app_settings.season2_reset_scope). Copy approved verbatim, no em dashes.
--
-- What lands here:
--   1. The cutoff: snout_season_1.ends_at -> 2026-11-09 00:00+00. This
--      DELIBERATELY shortens the 11-30 bridge (20261029175000). Guarded by
--      _set_season1_ends_at(): fails if the season is absent, if the date is
--      not in the future, or if Season 2 has already flipped.
--   2. pg_cron `season2-flip` (0 0 9 11 *): flip_season_2('2026-11-09 00:00')
--      then cron.unschedule('season2-flip'). The flip is date-guarded in the
--      command, so a job that somehow survives to 2027-11-09 only unschedules.
--   3. announce_great_hunger_ending(p_kind) ('initial' | 'reminder'),
--      service-role only: one push per device to every account with a push
--      token that has not opted out (push_permission_granted; the client
--      clears both on an OS denial), through send_push_to_user, with
--      season1_end_push_deliveries (user, kind) as the send-once lock (the
--      drum_push_deliveries pattern: claim first, send second, release the
--      claim if the send never left). 'initial' also writes the in-app card.
--   4. pg_cron `great-hunger-reminder` (0 0 8 11 *): the 'reminder' push,
--      then cron.unschedule('great-hunger-reminder').
--   5. The in-app card (inside 'initial'): one system_announcements row per
--      player, inline INSERT (send_system_announcement raises admin_only for a
--      cron / service caller and would roll the batch back), targeted like the
--      world-cup broadcast (20260571000000: every profile with a username).
--      kind 'season_ending', data {screen: 'season'}: every client back to
--      1.2.1 renders any kind's title + body in the While-Away modal; 1.3+
--      also taps through to the Season tab.
--
-- What pushing this file does BY ITSELF: moves the cutoff and arms the two
-- cron jobs (the reminder on Nov 8 00:00 UTC, the flip on Nov 9 00:00 UTC).
-- The first push and the in-app card wait for the founder's go:
--   SELECT public.announce_great_hunger_ending('initial');
--
-- NOT HERE: grant_season1_finale() (the flip runbook's "day before" manual
-- step), app_settings.min_build. Both stay manual (20261029190000 header).
--
-- Migration AUTHORED ONLY. Never `db push` without the founder's explicit go.
-- ═══════════════════════════════════════════════════════════════════════════

SET LOCAL lock_timeout = '5s';

DO $preflight$
BEGIN
	IF to_regprocedure('public.flip_season_2(timestamptz, integer)') IS NULL THEN
		RAISE EXCEPTION 'flip_season_2(timestamptz, integer) is missing: push 20261029190000 first';
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE id = 'snout_season_2') THEN
		RAISE EXCEPTION 'snout_season_2 is absent: the flip would fail';
	END IF;
END
$preflight$;


-- ── 1. The cutoff ────────────────────────────────────────────────────────────
-- Owner-only helper so the guard is the one thing that moves the date (and so
-- the harness can prove the guard). _patch_now() is now() on production (no
-- ttp.fake_now there); the harness pins it so the guard does not rot.
CREATE OR REPLACE FUNCTION public._set_season1_ends_at(p_ends_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	prev timestamptz;
BEGIN
	IF p_ends_at IS NULL OR p_ends_at <= public._patch_now() THEN
		RAISE EXCEPTION '_set_season1_ends_at: refusing to move snout_season_1 into the past (got %)', p_ends_at;
	END IF;
	IF COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RAISE EXCEPTION '_set_season1_ends_at: Season 2 has already flipped; snout_season_1 is closed';
	END IF;

	SELECT ends_at INTO prev FROM public.seasons WHERE id = 'snout_season_1' FOR UPDATE;
	IF NOT FOUND THEN
		RAISE EXCEPTION '_set_season1_ends_at: snout_season_1 is absent';
	END IF;

	UPDATE public.seasons SET ends_at = p_ends_at WHERE id = 'snout_season_1';
	RETURN prev;
END;
$function$;
REVOKE ALL ON FUNCTION public._set_season1_ends_at(timestamptz) FROM PUBLIC, anon, authenticated;

DO $cutoff$
BEGIN
	PERFORM public._set_season1_ends_at('2026-11-09 00:00:00+00'::timestamptz);
	IF (SELECT ends_at FROM public.seasons WHERE id = 'snout_season_1')
	   IS DISTINCT FROM '2026-11-09 00:00:00+00'::timestamptz THEN
		RAISE EXCEPTION 'snout_season_1 did not move to 2026-11-09 00:00 UTC';
	END IF;
END
$cutoff$;


-- ── 2. The flip, on the boundary ─────────────────────────────────────────────
-- cron.timezone is GMT on production, so 0 0 9 11 * is Monday 2026-11-09
-- 00:00 UTC. flip_season_2 accepts a p_at up to 7 days back, so the few
-- seconds the job takes to start are fine; it is idempotent (season2_flipped),
-- so a manual flip beforehand turns this into a no-op. The WHERE keeps a job
-- that survives a failed run from flipping anything on 2027-11-09.
-- Unschedule-if-exists first: a re-run of this file never double-schedules,
-- and cron.unschedule raises on an unknown name.
DO $schedule_flip$
BEGIN
	IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'season2-flip') THEN
		PERFORM cron.unschedule('season2-flip');
	END IF;
	PERFORM cron.schedule('season2-flip', '0 0 9 11 *',
		$cmd$SELECT public.flip_season_2('2026-11-09 00:00:00+00'::timestamptz) WHERE now() < '2026-11-10 00:00:00+00'::timestamptz; SELECT cron.unschedule('season2-flip');$cmd$);
	IF (SELECT count(*) FROM cron.job WHERE jobname = 'season2-flip') <> 1 THEN
		RAISE EXCEPTION 'season2-flip is not scheduled exactly once';
	END IF;
END
$schedule_flip$;


-- ── 3. The season-end push (and, for 'initial', the in-app card) ─────────────
CREATE TABLE IF NOT EXISTS public.season1_end_push_deliveries (
	user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	kind       text        NOT NULL CHECK (kind IN ('initial', 'reminder')),
	queued_at  timestamptz NOT NULL DEFAULT now(),
	request_id bigint,
	PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.season1_end_push_deliveries ENABLE ROW LEVEL SECURITY;   -- server-only
REVOKE ALL ON public.season1_end_push_deliveries FROM PUBLIC, anon, authenticated;

-- Recipients: a token and push_permission_granted (the client's OS-denial
-- path calls set_push_token(null), which clears both). One push per DEVICE:
-- an Expo token held by two accounts (a founder signed into a second account
-- on one phone) is sent once, to its lowest real account, and a device that
-- already got this kind under any account it holds is skipped.
-- The copy names Nov 8, 7pm ET, so it sends only while snout_season_1 still
-- ends 2026-11-09 00:00 UTC, before that instant, and before any flip.
CREATE OR REPLACE FUNCTION public.announce_great_hunger_ending(p_kind text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	c_cutoff  CONSTANT timestamptz := '2026-11-09 00:00:00+00';
	s1_end    timestamptz;
	v_title   text;
	v_body    text;
	target    record;
	claimed   text;
	res       jsonb;
	queued    int := 0;
	skipped   int := 0;
	announced int := 0;
BEGIN
	IF p_kind IS NULL OR p_kind NOT IN ('initial', 'reminder') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_kind');
	END IF;

	-- One sender at a time: a cron fire racing a manual call queues behind it
	-- and then finds every slot already claimed.
	PERFORM pg_advisory_xact_lock(hashtextextended('season1_end_announce', 0));

	SELECT ends_at INTO s1_end FROM public.seasons WHERE id = 'snout_season_1';
	IF s1_end IS DISTINCT FROM c_cutoff THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'cutoff_moved', 'ends_at', s1_end);
	END IF;
	IF public._patch_now() >= c_cutoff
	   OR COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'season_over');
	END IF;

	IF p_kind = 'initial' THEN
		v_title := 'The Great Hunger ends Sunday night';
		v_body  := 'The season closes Nov 8 at 7pm ET. Claim your pass rewards and spend your snouts and finds: The Feast starts fresh.';

		-- The in-app card, one row per player, written inline (never
		-- send_system_announcement: admin_only). A re-run adds nothing.
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		SELECT p.id, 'season_ending',
			'The Great Hunger is ending',
			'The season ends Sunday, Nov 8 at 7pm Eastern (Monday 00:00 UTC). Then The Feast begins: a new pass, a Larder to fill, and leftovers in the drum. Everyone starts fresh: your tickle bank, snouts and Satchel reset; your cosmetics, membership and lifetime tickles stay.',
			jsonb_build_object('screen', 'season', 'season_id', 'snout_season_1')
		FROM public.profiles p
		JOIN auth.users u ON u.id = p.id
		WHERE p.username IS NOT NULL AND p.username <> ''
			AND NOT EXISTS (
				SELECT 1 FROM public.system_announcements sa
				WHERE sa.user_id = p.id
					AND sa.kind = 'season_ending'
					AND sa.data ->> 'season_id' = 'snout_season_1');
		GET DIAGNOSTICS announced = ROW_COUNT;
	ELSE
		v_title := 'One day left of The Great Hunger';
		v_body  := 'The Feast starts tomorrow and everyone starts fresh. Spend your snouts and claim your rewards today.';
	END IF;

	FOR target IN
		SELECT DISTINCT ON (p.expo_push_token) p.id
		FROM public.profiles p
		WHERE p.push_permission_granted = true
			AND p.expo_push_token IS NOT NULL
			AND p.expo_push_token <> ''
			AND NOT EXISTS (
				SELECT 1
				FROM public.season1_end_push_deliveries d
				JOIN public.profiles q ON q.id = d.user_id
				WHERE d.kind = p_kind
					AND (d.user_id = p.id OR q.expo_push_token = p.expo_push_token))
		ORDER BY p.expo_push_token, COALESCE(p.is_test, false), p.id
	LOOP
		-- Claim the (account, kind) slot BEFORE sending: a re-run finds it taken.
		claimed := NULL;
		INSERT INTO public.season1_end_push_deliveries (user_id, kind)
			VALUES (target.id, p_kind)
			ON CONFLICT (user_id, kind) DO NOTHING
			RETURNING kind INTO claimed;
		IF claimed IS NULL THEN skipped := skipped + 1; CONTINUE; END IF;

		BEGIN
			res := public.send_push_to_user(
				target.id, v_title, v_body,
				jsonb_build_object(
					'kind', 'season_ending',
					'screen', 'season',
					'season_id', 'snout_season_1',
					'phase', p_kind));
			IF COALESCE((res ->> 'ok')::boolean, false) THEN
				UPDATE public.season1_end_push_deliveries
					SET request_id = NULLIF(res ->> 'request_id', '')::bigint
					WHERE user_id = target.id AND kind = p_kind;
				queued := queued + 1;
			ELSE
				-- No token after all, or the helper refused: release the claim.
				DELETE FROM public.season1_end_push_deliveries
					WHERE user_id = target.id AND kind = p_kind;
				skipped := skipped + 1;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			DELETE FROM public.season1_end_push_deliveries
				WHERE user_id = target.id AND kind = p_kind;
			skipped := skipped + 1;
		END;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'kind', p_kind,
		'queued', queued, 'skipped', skipped, 'announced', announced);
END;
$function$;
REVOKE ALL ON FUNCTION public.announce_great_hunger_ending(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announce_great_hunger_ending(text) TO service_role;


-- ── 4. The reminder, 24 hours out ────────────────────────────────────────────
-- Sunday 2026-11-08 00:00 UTC (Saturday 7pm ET). The function's own guards
-- make a stale fire (cutoff moved, season over, already flipped) send nothing;
-- the job unschedules itself either way.
DO $schedule_reminder$
BEGIN
	IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'great-hunger-reminder') THEN
		PERFORM cron.unschedule('great-hunger-reminder');
	END IF;
	PERFORM cron.schedule('great-hunger-reminder', '0 0 8 11 *',
		$cmd$SELECT public.announce_great_hunger_ending('reminder'); SELECT cron.unschedule('great-hunger-reminder');$cmd$);
	IF (SELECT count(*) FROM cron.job WHERE jobname = 'great-hunger-reminder') <> 1 THEN
		RAISE EXCEPTION 'great-hunger-reminder is not scheduled exactly once';
	END IF;
END
$schedule_reminder$;

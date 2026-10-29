-- The Great Hunger ends 2026-11-09 (20261029260000_great_hunger_ends_nov9.sql).
-- run.sh applies 00zf_great_hunger_ends_prep.sql (recording cron stub, clock
-- pinned to 2026-10-29 12:00 UTC), then the migration TWICE (the idempotent
-- re-run), then this file. Runs last in the chain, after B0 (Season 2 dark,
-- unflipped) and A6.
--
-- Proves:
--   (a) snout_season_1 ends 2026-11-09 00:00 UTC (the 11-30 bridge shortened);
--   (b) the cutoff guard: a past / NULL date, an absent season, and a flipped
--       Season 2 all raise, and none of them moves the row;
--   (c) cron: season2-flip (0 0 9 11 *) and great-hunger-reminder
--       (0 0 8 11 *) exist exactly once after two applies, each command runs
--       its call then unschedules itself; running the reminder's command
--       sends the reminder and removes the job;
--   (d) announce('initial'): one push per device to accounts with a token AND
--       push_permission_granted; opted-out, token-less and empty-token
--       accounts get none; a device shared by two accounts gets one; a re-run
--       sends nothing; a late token gets its push on the next run; a refused
--       send releases its claim; the copy and push_data are exact;
--   (e) the in-app card: one season_ending row per usernamed player (opted-out
--       and token-less included), none for a username-less profile, none
--       added by a re-run or by 'reminder';
--   (f) announce('reminder') is its own ledger lane: sends once per device;
--   (g) refusals: bad kind, a moved cutoff, a flipped season, a clock past
--       the cutoff all send nothing;
--   (h) grants: anon / authenticated cannot execute either function or read
--       the ledger; service_role can execute the announcer.
\set ON_ERROR_STOP on

-- Fixtures. Other smokes' profiles keep their usernames (they get the card)
-- but lose their push tokens so the push counts below are exact.
UPDATE public.profiles SET expo_push_token = NULL, push_permission_granted = false;
DELETE FROM public.push_outbox;
INSERT INTO auth.users (id) VALUES
	('00000000-0000-0000-0000-0000000a7001'),
	('00000000-0000-0000-0000-0000000a7002'),
	('00000000-0000-0000-0000-0000000a7003'),
	('00000000-0000-0000-0000-0000000a7004'),
	('00000000-0000-0000-0000-0000000a7005'),
	('00000000-0000-0000-0000-0000000a7006'),
	('00000000-0000-0000-0000-0000000a7007'),
	('00000000-0000-0000-0000-0000000a7008'),
	('00000000-0000-0000-0000-0000000a7009')
ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, username, is_test, expo_push_token, push_permission_granted) VALUES
	-- 1: tokened, permitted                          -> push
	('00000000-0000-0000-0000-0000000a7001', 'gh7-one',   false, 'ExponentPushToken[gh7aaa]', true),
	-- 2: token left over but opted out (permission)   -> no push, card
	('00000000-0000-0000-0000-0000000a7002', 'gh7-two',   false, 'ExponentPushToken[gh7bbb]', false),
	-- 3: no token at all                              -> no push, card
	('00000000-0000-0000-0000-0000000a7003', 'gh7-three', false, NULL, false),
	-- 4: a test account with its own device            -> push
	('00000000-0000-0000-0000-0000000a7004', 'gh7-four',  true,  'ExponentPushToken[gh7ddd]', true),
	-- 5: same device as 1 (second account on a phone) -> no second push, card
	('00000000-0000-0000-0000-0000000a7005', 'gh7-five',  false, 'ExponentPushToken[gh7aaa]', true),
	-- 6: no username yet, tokened                      -> push, no card
	('00000000-0000-0000-0000-0000000a7006', NULL,        false, 'ExponentPushToken[gh7fff]', true),
	-- 7: empty-string token                            -> no push, card
	('00000000-0000-0000-0000-0000000a7007', 'gh7-seven', false, '', true),
	-- 8: registers a token only after the first send   -> push on the re-run
	('00000000-0000-0000-0000-0000000a7008', 'gh7-eight', false, NULL, false),
	-- 9: the helper refuses its send                   -> claim released
	('00000000-0000-0000-0000-0000000a7009', 'gh7-nine',  false, 'ExponentPushToken[gh7refuse]', true);

-- A send-refusing variant of 00_stub's recorder (restored at the end).
CREATE OR REPLACE FUNCTION public.send_push_to_user(
	target_user_id uuid, push_title text, push_body text,
	push_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
	IF (SELECT expo_push_token FROM public.profiles WHERE id = target_user_id) = 'ExponentPushToken[gh7refuse]' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'refused');
	END IF;
	INSERT INTO public.push_outbox (user_id, title, body, data)
		VALUES (target_user_id, push_title, push_body, push_data);
	RETURN jsonb_build_object('ok', true, 'request_id', 7);
END $$;

DO $a7$
DECLARE
	u1 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7001';
	u2 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7002';
	u3 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7003';
	u4 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7004';
	u5 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7005';
	u6 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7006';
	u7 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7007';
	u8 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7008';
	u9 CONSTANT uuid := '00000000-0000-0000-0000-0000000a7009';
	cutoff CONSTANT timestamptz := '2026-11-09 00:00:00+00';
	res jsonb;
	msg text;
	n int;
	n_named int;
	j record;
	got uuid[];
BEGIN
	-- ── (a) the cutoff ──────────────────────────────────────────────────────
	IF (SELECT ends_at FROM public.seasons WHERE id = 'snout_season_1') IS DISTINCT FROM cutoff THEN
		RAISE EXCEPTION 'chk a: snout_season_1 ends_at %, want %',
			(SELECT ends_at FROM public.seasons WHERE id = 'snout_season_1'), cutoff; END IF;
	IF (SELECT starts_at FROM public.seasons WHERE id = 'snout_season_2') <> '2099-01-01 00:00:00+00' THEN
		RAISE EXCEPTION 'chk a: snout_season_2 must stay dark until the flip'; END IF;

	-- ── (b) the guard ───────────────────────────────────────────────────────
	msg := NULL;
	BEGIN PERFORM public._set_season1_ends_at('2026-10-01 00:00:00+00');
	EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
	IF msg IS NULL OR msg NOT LIKE '%into the past%' THEN
		RAISE EXCEPTION 'chk b: a past date must raise (got %)', msg; END IF;
	msg := NULL;
	BEGIN PERFORM public._set_season1_ends_at(public._patch_now());
	EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
	IF msg IS NULL OR msg NOT LIKE '%into the past%' THEN
		RAISE EXCEPTION 'chk b: "now" must raise (got %)', msg; END IF;
	msg := NULL;
	BEGIN PERFORM public._set_season1_ends_at(NULL);
	EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
	IF msg IS NULL THEN RAISE EXCEPTION 'chk b: NULL must raise'; END IF;
	-- absent season (the delete is rolled back with the sub-block)
	msg := NULL;
	BEGIN
		DELETE FROM public.seasons WHERE id = 'snout_season_1';
		BEGIN PERFORM public._set_season1_ends_at('2026-11-20 00:00:00+00');
		EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
		RAISE EXCEPTION 'a7_rollback';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM <> 'a7_rollback' THEN RAISE; END IF;
	END;
	IF msg IS NULL OR msg NOT LIKE '%absent%' THEN
		RAISE EXCEPTION 'chk b: an absent season must raise (got %)', msg; END IF;
	-- flipped season
	msg := NULL;
	BEGIN
		INSERT INTO public.app_config (key, enabled) VALUES ('season2_flipped', true)
			ON CONFLICT (key) DO UPDATE SET enabled = true;
		BEGIN PERFORM public._set_season1_ends_at('2026-11-20 00:00:00+00');
		EXCEPTION WHEN OTHERS THEN msg := SQLERRM; END;
		RAISE EXCEPTION 'a7_rollback';
	EXCEPTION WHEN OTHERS THEN
		IF SQLERRM <> 'a7_rollback' THEN RAISE; END IF;
	END;
	IF msg IS NULL OR msg NOT LIKE '%already flipped%' THEN
		RAISE EXCEPTION 'chk b: a flipped season must raise (got %)', msg; END IF;
	IF (SELECT ends_at FROM public.seasons WHERE id = 'snout_season_1') IS DISTINCT FROM cutoff
	   OR COALESCE((SELECT enabled FROM public.app_config WHERE key = 'season2_flipped'), false) THEN
		RAISE EXCEPTION 'chk b: refused moves must leave the row (and the flip flag) alone'; END IF;

	-- ── (c) cron ────────────────────────────────────────────────────────────
	IF (SELECT count(*) FROM cron.job WHERE jobname = 'season2-flip') <> 1
	   OR (SELECT count(*) FROM cron.job WHERE jobname = 'great-hunger-reminder') <> 1 THEN
		RAISE EXCEPTION 'chk c: each job must exist exactly once after two applies: %',
			(SELECT jsonb_agg(jobname) FROM cron.job); END IF;
	SELECT * INTO j FROM cron.job WHERE jobname = 'season2-flip';
	IF j.schedule <> '0 0 9 11 *'
	   OR j.command NOT LIKE 'SELECT public.flip_season_2(''2026-11-09 00:00:00+00''::timestamptz)%'
	   OR j.command NOT LIKE '%WHERE now() < ''2026-11-10 00:00:00+00''::timestamptz;%'
	   OR j.command NOT LIKE '%; SELECT cron.unschedule(''season2-flip'');' THEN
		RAISE EXCEPTION 'chk c: season2-flip job wrong: % / %', j.schedule, j.command; END IF;
	SELECT * INTO j FROM cron.job WHERE jobname = 'great-hunger-reminder';
	IF j.schedule <> '0 0 8 11 *'
	   OR j.command <> 'SELECT public.announce_great_hunger_ending(''reminder''); SELECT cron.unschedule(''great-hunger-reminder'');' THEN
		RAISE EXCEPTION 'chk c: great-hunger-reminder job wrong: % / %', j.schedule, j.command; END IF;

	-- ── (d) + (e) the first send ────────────────────────────────────────────
	SELECT count(*) INTO n_named FROM public.profiles p JOIN auth.users u ON u.id = p.id
		WHERE p.username IS NOT NULL AND p.username <> '';
	res := public.announce_great_hunger_ending('initial');
	IF NOT (res ->> 'ok')::boolean OR (res ->> 'queued')::int <> 3 OR (res ->> 'skipped')::int <> 1
	   OR (res ->> 'announced')::int <> n_named THEN
		RAISE EXCEPTION 'chk d: first initial send: % (want queued 3, skipped 1, announced %)', res, n_named; END IF;
	SELECT array_agg(user_id ORDER BY user_id) INTO got FROM public.push_outbox;
	IF got IS DISTINCT FROM ARRAY[u1, u4, u6] THEN
		RAISE EXCEPTION 'chk d: initial pushed to %, want {1,4,6}', got; END IF;
	IF EXISTS (SELECT 1 FROM public.push_outbox
		WHERE title <> 'The Great Hunger ends Sunday night'
		   OR body <> 'The season closes Nov 8 at 7pm ET. Claim your pass rewards and spend your snouts and finds: The Feast starts fresh.'
		   OR data <> '{"kind": "season_ending", "screen": "season", "season_id": "snout_season_1", "phase": "initial"}'::jsonb) THEN
		RAISE EXCEPTION 'chk d: initial copy / data wrong: %', (SELECT jsonb_agg(to_jsonb(o)) FROM public.push_outbox o); END IF;
	SELECT array_agg(user_id ORDER BY user_id) INTO got FROM public.season1_end_push_deliveries WHERE kind = 'initial';
	IF got IS DISTINCT FROM ARRAY[u1, u4, u6]
	   OR EXISTS (SELECT 1 FROM public.season1_end_push_deliveries WHERE request_id IS DISTINCT FROM 7) THEN
		RAISE EXCEPTION 'chk d: ledger after initial: % (u9''s refused claim must be released)', got; END IF;
	-- the card
	IF (SELECT count(*) FROM public.system_announcements WHERE kind = 'season_ending') <> n_named
	   OR (SELECT count(DISTINCT user_id) FROM public.system_announcements WHERE kind = 'season_ending') <> n_named THEN
		RAISE EXCEPTION 'chk e: want one card per usernamed player (%)', n_named; END IF;
	IF EXISTS (SELECT 1 FROM public.system_announcements WHERE kind = 'season_ending' AND user_id = u6) THEN
		RAISE EXCEPTION 'chk e: a username-less profile must not get the card'; END IF;
	IF (SELECT count(*) FROM public.system_announcements WHERE kind = 'season_ending'
		AND user_id IN (u1, u2, u3, u4, u5, u7, u8, u9)) <> 8 THEN
		RAISE EXCEPTION 'chk e: opted-out / token-less players must still get the card'; END IF;
	IF EXISTS (SELECT 1 FROM public.system_announcements WHERE kind = 'season_ending'
		AND (title <> 'The Great Hunger is ending'
		  OR body <> 'The season ends Sunday, Nov 8 at 7pm Eastern (Monday 00:00 UTC). Then The Feast begins: a new pass, a Larder to fill, and leftovers in the drum. Everyone starts fresh: your tickle bank, snouts and Satchel reset; your cosmetics, membership and lifetime tickles stay.'
		  OR data <> '{"screen": "season", "season_id": "snout_season_1"}'::jsonb)) THEN
		RAISE EXCEPTION 'chk e: card copy / data wrong'; END IF;

	-- a re-run: nothing new
	res := public.announce_great_hunger_ending('initial');
	IF (res ->> 'queued')::int <> 0 OR (res ->> 'announced')::int <> 0
	   OR (SELECT count(*) FROM public.push_outbox) <> 3
	   OR (SELECT count(*) FROM public.system_announcements WHERE kind = 'season_ending') <> n_named THEN
		RAISE EXCEPTION 'chk d: a re-run must send and announce nothing: %', res; END IF;
	-- a late token, and the second account moving onto a device of its own
	UPDATE public.profiles SET expo_push_token = 'ExponentPushToken[gh7hhh]', push_permission_granted = true WHERE id = u8;
	res := public.announce_great_hunger_ending('initial');
	SELECT array_agg(user_id ORDER BY user_id) INTO got FROM public.push_outbox;
	IF (res ->> 'queued')::int <> 1 OR got IS DISTINCT FROM ARRAY[u1, u4, u6, u8] THEN
		RAISE EXCEPTION 'chk d: a late token must get exactly its own push: % / %', res, got; END IF;

	-- ── (f) the reminder lane ───────────────────────────────────────────────
	DELETE FROM public.push_outbox;
	res := public.announce_great_hunger_ending('reminder');
	SELECT array_agg(user_id ORDER BY user_id) INTO got FROM public.push_outbox;
	IF (res ->> 'queued')::int <> 4 OR (res ->> 'announced')::int <> 0
	   OR got IS DISTINCT FROM ARRAY[u1, u4, u6, u8] THEN
		RAISE EXCEPTION 'chk f: reminder send: % / %', res, got; END IF;
	IF EXISTS (SELECT 1 FROM public.push_outbox
		WHERE title <> 'One day left of The Great Hunger'
		   OR body <> 'The Feast starts tomorrow and everyone starts fresh. Spend your snouts and claim your rewards today.'
		   OR data ->> 'phase' <> 'reminder' OR data ->> 'screen' <> 'season') THEN
		RAISE EXCEPTION 'chk f: reminder copy / data wrong'; END IF;
	IF (SELECT count(*) FROM public.system_announcements WHERE kind = 'season_ending') <> n_named THEN
		RAISE EXCEPTION 'chk f: the reminder must not add cards'; END IF;
	res := public.announce_great_hunger_ending('reminder');
	IF (res ->> 'queued')::int <> 0 OR (SELECT count(*) FROM public.push_outbox) <> 4 THEN
		RAISE EXCEPTION 'chk f: a reminder re-run must send nothing: %', res; END IF;

	-- ── (g) refusals ────────────────────────────────────────────────────────
	DELETE FROM public.push_outbox;
	DELETE FROM public.season1_end_push_deliveries;
	res := public.announce_great_hunger_ending('final');
	IF (res ->> 'ok')::boolean OR res ->> 'reason' <> 'bad_kind' THEN
		RAISE EXCEPTION 'chk g: bad kind: %', res; END IF;
	res := public.announce_great_hunger_ending(NULL);
	IF (res ->> 'ok')::boolean OR res ->> 'reason' <> 'bad_kind' THEN
		RAISE EXCEPTION 'chk g: NULL kind: %', res; END IF;
	UPDATE public.seasons SET ends_at = '2026-11-30 00:00:00+00' WHERE id = 'snout_season_1';
	res := public.announce_great_hunger_ending('reminder');
	UPDATE public.seasons SET ends_at = cutoff WHERE id = 'snout_season_1';
	IF (res ->> 'ok')::boolean OR res ->> 'reason' <> 'cutoff_moved' THEN
		RAISE EXCEPTION 'chk g: a moved cutoff: %', res; END IF;
	INSERT INTO public.app_config (key, enabled) VALUES ('season2_flipped', true)
		ON CONFLICT (key) DO UPDATE SET enabled = true;
	res := public.announce_great_hunger_ending('reminder');
	UPDATE public.app_config SET enabled = false WHERE key = 'season2_flipped';
	IF (res ->> 'ok')::boolean OR res ->> 'reason' <> 'season_over' THEN
		RAISE EXCEPTION 'chk g: a flipped season: %', res; END IF;
	PERFORM set_config('ttp.fake_now', '2026-11-09 00:00:01+00', false);
	res := public.announce_great_hunger_ending('initial');
	PERFORM set_config('ttp.fake_now', '2026-10-29 12:00:00+00', false);
	IF (res ->> 'ok')::boolean OR res ->> 'reason' <> 'season_over' THEN
		RAISE EXCEPTION 'chk g: past the cutoff: %', res; END IF;
	IF (SELECT count(*) FROM public.push_outbox) <> 0
	   OR (SELECT count(*) FROM public.season1_end_push_deliveries) <> 0 THEN
		RAISE EXCEPTION 'chk g: refusals must send nothing'; END IF;

	-- ── (h) grants ──────────────────────────────────────────────────────────
	IF has_function_privilege('anon', 'public.announce_great_hunger_ending(text)', 'EXECUTE')
	   OR has_function_privilege('authenticated', 'public.announce_great_hunger_ending(text)', 'EXECUTE')
	   OR has_function_privilege('anon', 'public._set_season1_ends_at(timestamptz)', 'EXECUTE')
	   OR has_function_privilege('authenticated', 'public._set_season1_ends_at(timestamptz)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk h: anon / authenticated must not execute the season-end functions'; END IF;
	IF NOT has_function_privilege('service_role', 'public.announce_great_hunger_ending(text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk h: service_role must execute announce_great_hunger_ending'; END IF;
	IF has_table_privilege('authenticated', 'public.season1_end_push_deliveries', 'SELECT')
	   OR has_table_privilege('anon', 'public.season1_end_push_deliveries', 'SELECT') THEN
		RAISE EXCEPTION 'chk h: the ledger must be server-only'; END IF;
END
$a7$;

-- ── (c) the reminder job's own command: sends, then unschedules itself ─────
SELECT command AS a7_reminder_cmd FROM cron.job WHERE jobname = 'great-hunger-reminder' \gset
:a7_reminder_cmd

DO $a7c$
BEGIN
	IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'great-hunger-reminder') THEN
		RAISE EXCEPTION 'chk c: the reminder job must unschedule itself'; END IF;
	IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'season2-flip') THEN
		RAISE EXCEPTION 'chk c: the flip job must survive the reminder'; END IF;
	IF (SELECT count(*) FROM public.push_outbox WHERE data ->> 'phase' = 'reminder') <> 4 THEN
		RAISE EXCEPTION 'chk c: the reminder job command must send the reminder (got %)',
			(SELECT count(*) FROM public.push_outbox); END IF;
	RAISE NOTICE 'chk great hunger ends: cutoff, guards, cron once + self-unschedule, one push per device per kind, opt-outs skipped, cards, grants OK';
END
$a7c$;

-- Restore 00_stub's recorder and the real clock.
CREATE OR REPLACE FUNCTION public.send_push_to_user(
	target_user_id uuid, push_title text, push_body text,
	push_data jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql AS $$
BEGIN
	INSERT INTO public.push_outbox (user_id, title, body, data)
		VALUES (target_user_id, push_title, push_body, push_data);
	RETURN jsonb_build_object('ok', true);
END $$;
SELECT set_config('ttp.fake_now', '', false);

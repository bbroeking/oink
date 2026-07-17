-- Functional smoke for nudge_trough SUPERSEDE (20260746000000, spec 04 / #10 A).
--
-- The bug: nudge_trough INSERTed one trough_nudge announcement per friend per
-- call, gated only by a 6h cooldown — so re-nudging the SAME drive stacked
-- duplicate UNSEEN rows that drip through the While-Away LIMIT 20. The fix marks
-- the prior UNSEEN batch for that drive seen before inserting the fresh one.
--
-- Self-contained: 00f_trough_nudge_prep.sql builds item_drives / are_blocked /
-- system_announcements.seen_at / hats.name AHEAD of the migration; this smoke
-- re-declares them IF NOT EXISTS and seeds its own opener + two friends + drive.
--
-- Asserts:
--   1. First nudge → exactly ONE unseen trough_nudge per friend (2 total).
--   2. Second nudge (after clearing the cooldown) SUPERSEDES: still exactly ONE
--      unseen row per friend — the stale ones are marked seen, not stacked.
--   3. A nudge a recipient already DISMISSED (seen_at set) is NOT resurrected
--      and does NOT block a fresh row (reconciles with mark_announcement_seen).
--   4. A DIFFERENT drive's unseen nudge is untouched by the supersede.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Re-declare the prep targets (already built ahead of the migration) for clarity.
CREATE TABLE IF NOT EXISTS public.item_drives (
	id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	opener_user_id uuid,
	item_id        text,
	status         text        NOT NULL DEFAULT 'open',
	closes_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
	last_nudge_at  timestamptz
);
ALTER TABLE public.system_announcements ADD COLUMN IF NOT EXISTS seen_at timestamptz;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS name text;

DO $smoke_trough_nudge$
DECLARE
	op   uuid := '00000000-0000-0000-0000-000000044001'; -- opener
	fa   uuid := '00000000-0000-0000-0000-000000044002'; -- friend A
	fb   uuid := '00000000-0000-0000-0000-000000044003'; -- friend B
	drv  uuid;
	drv2 uuid;
	res  jsonb;
	n    int;
BEGIN
	-- Seed the cast.
	INSERT INTO auth.users (id) VALUES (op), (fa), (fb) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username) VALUES
		(op, 'Opener'), (fa, 'FriendA'), (fb, 'FriendB') ON CONFLICT DO NOTHING;
	INSERT INTO public.hats (id, name) VALUES ('cowboy', 'Cowboy Hat')
		ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
	-- Two accepted friendships (one in each direction, to prove direction-agnostic).
	INSERT INTO public.friendships (requester_id, receiver_id, status) VALUES
		(op, fa, 'accepted'), (fb, op, 'accepted');
	-- Two open drives owned by the opener.
	INSERT INTO public.item_drives (opener_user_id, item_id, status)
		VALUES (op, 'cowboy', 'open') RETURNING id INTO drv;
	INSERT INTO public.item_drives (opener_user_id, item_id, status)
		VALUES (op, 'cowboy', 'open') RETURNING id INTO drv2;

	PERFORM set_config('smoke.uid', op::text, true);

	-- ── 1. First nudge → one unseen row per friend ───────────────────────────
	res := public.nudge_trough(drv);
	IF NOT (res->>'ok')::boolean OR (res->>'sent')::int <> 2 THEN
		RAISE EXCEPTION 'nudge_trough: first nudge must send to 2 friends, got %', res; END IF;
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv::text;
	IF n <> 2 THEN
		RAISE EXCEPTION 'first nudge: expected 2 unseen rows, got %', n; END IF;

	-- ── 2. Re-nudge (cooldown cleared) SUPERSEDES → still ONE unseen per friend
	UPDATE public.item_drives SET last_nudge_at = NULL WHERE id = drv;
	res := public.nudge_trough(drv);
	IF (res->>'sent')::int <> 2 THEN
		RAISE EXCEPTION 'second nudge: must send 2 fresh rows, got %', res; END IF;
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv::text;
	IF n <> 2 THEN
		RAISE EXCEPTION 'supersede failed: expected 2 unseen rows after re-nudge, got % (stacking)', n; END IF;
	-- The stale batch is present but marked seen (2 old + 2 fresh = 4 total).
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'trough_nudge' AND data->>'drive_id' = drv::text;
	IF n <> 4 THEN
		RAISE EXCEPTION 'expected 4 total rows (2 seen + 2 unseen), got %', n; END IF;

	-- ── 3. A DISMISSED nudge is not resurrected; a fresh one still lands ──────
	-- Friend A dismisses their current unseen nudge (as mark_announcement_seen would).
	UPDATE public.system_announcements SET seen_at = now()
		WHERE user_id = fa AND kind = 'trough_nudge' AND data->>'drive_id' = drv::text AND seen_at IS NULL;
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE user_id = fa AND kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv::text;
	IF n <> 0 THEN
		RAISE EXCEPTION 'friend A should have 0 unseen after dismiss, got %', n; END IF;
	UPDATE public.item_drives SET last_nudge_at = NULL WHERE id = drv;
	res := public.nudge_trough(drv);
	-- Friend A gets exactly one fresh unseen row; the dismissed one stays seen.
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE user_id = fa AND kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv::text;
	IF n <> 1 THEN
		RAISE EXCEPTION 'friend A should have exactly 1 fresh unseen row, got %', n; END IF;

	-- ── 4. A DIFFERENT drive's unseen nudge survives the supersede ───────────
	res := public.nudge_trough(drv2);
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv2::text;
	IF n <> 2 THEN
		RAISE EXCEPTION 'drive2 first nudge: expected 2 unseen, got %', n; END IF;
	-- Re-nudge drive1 again; drive2's unseen rows must be untouched.
	UPDATE public.item_drives SET last_nudge_at = NULL WHERE id = drv;
	res := public.nudge_trough(drv);
	SELECT count(*) INTO n FROM public.system_announcements
		WHERE kind = 'trough_nudge' AND seen_at IS NULL AND data->>'drive_id' = drv2::text;
	IF n <> 2 THEN
		RAISE EXCEPTION 'supersede must be per-drive: drive2 unseen count changed to %', n; END IF;

	RAISE NOTICE 'chk trough_nudge: supersede one-per-drive/recipient + dismissed-not-resurrected + per-drive-scoped OK';
END $smoke_trough_nudge$;

-- Cleanup so later smokes' bare auth.users seeds don't collide on these ids.
DELETE FROM public.system_announcements WHERE user_id IN
	('00000000-0000-0000-0000-000000044001','00000000-0000-0000-0000-000000044002',
	 '00000000-0000-0000-0000-000000044003');
DELETE FROM public.item_drives WHERE opener_user_id = '00000000-0000-0000-0000-000000044001';
DELETE FROM public.friendships WHERE requester_id = '00000000-0000-0000-0000-000000044001'
	OR receiver_id = '00000000-0000-0000-0000-000000044001';
DELETE FROM public.profiles WHERE id IN
	('00000000-0000-0000-0000-000000044001','00000000-0000-0000-0000-000000044002',
	 '00000000-0000-0000-0000-000000044003');
DELETE FROM auth.users WHERE id IN
	('00000000-0000-0000-0000-000000044001','00000000-0000-0000-0000-000000044002',
	 '00000000-0000-0000-0000-000000044003');

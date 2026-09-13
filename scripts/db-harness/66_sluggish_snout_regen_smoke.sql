-- Sluggish Snout boundary accounting smoke
-- (20260826000000_preserve_sluggish_snout_regen.sql).
--
-- Proves start, cleanse, blessing cancellation, and natural expiry use their
-- historical rate segments, and that fractional progress survives each edge.

DO $smoke$
DECLARE
	player uuid := '00000000-0000-0000-0000-000000000066';
	sender uuid := '00000000-0000-0000-0000-000000000067';
	blesser uuid := '00000000-0000-0000-0000-000000000068';
	checkpoint timestamptz := '2026-08-26 12:30:00+00';
	got_intervals int;
	got_fraction numeric;
	settled int;
	stored_fraction numeric;
	tickle jsonb;
	barn jsonb;
BEGIN
	INSERT INTO auth.users (id) VALUES (player), (sender), (blesser)
	ON CONFLICT (id) DO NOTHING;
	INSERT INTO public.profiles (id, username, counter)
	VALUES (player, 'sluggish-regression', 20),
		(sender, 'sluggish-sender', 0),
		(blesser, 'sluggish-blesser', 0)
	ON CONFLICT (id) DO NOTHING;
	INSERT INTO public.user_items (user_id, item_count, last_increment, regen_progress)
	VALUES (player, 0, checkpoint, 0)
	ON CONFLICT (user_id) DO UPDATE SET
		item_count = 0,
		last_increment = EXCLUDED.last_increment,
		regen_progress = 0;

	-- Start boundary: 1h normal + 2h Sluggish = 2 completed Tickles, with
	-- the seeded 50% fraction intact. Rating all 3h at today's slow rate would
	-- produce only 1.5 and erase the pre-curse progress.
	DELETE FROM public.blessings WHERE receiver_id = player;
	DELETE FROM public.curses WHERE receiver_id = player;
	INSERT INTO public.curses
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (sender, player, 'sluggish_snout',
		checkpoint - interval '2 hours', checkpoint + interval '1 hour', NULL);

	SELECT intervals_elapsed, fraction
	INTO got_intervals, got_fraction
	FROM public._tickle_regen_snapshot(
		player, checkpoint - interval '3 hours', 0.5, checkpoint
	);
	IF got_intervals <> 2 OR abs(got_fraction - 0.5) > 0.000001 THEN
		RAISE EXCEPTION 'start boundary: expected 2 + 0.5, got % + %',
			got_intervals, got_fraction;
	END IF;

	-- Cleanse boundary: 1h normal + 2h Sluggish + 1h normal = 3 Tickles.
	-- The suppressed fourth Tickle stays lost; the existing 25% survives.
	DELETE FROM public.curses WHERE receiver_id = player;
	INSERT INTO public.curses
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (sender, player, 'sluggish_snout',
		checkpoint - interval '3 hours', checkpoint + interval '2 hours',
		checkpoint - interval '1 hour');

	SELECT intervals_elapsed, fraction
	INTO got_intervals, got_fraction
	FROM public._tickle_regen_snapshot(
		player, checkpoint - interval '4 hours', 0.25, checkpoint
	);
	IF got_intervals <> 3 OR abs(got_fraction - 0.25) > 0.000001 THEN
		RAISE EXCEPTION 'cleanse boundary: expected 3 + 0.25, got % + %',
			got_intervals, got_fraction;
	END IF;

	-- Blessing cancellation: the blessing starts exactly when it clears the
	-- curse. Earlier cursed time remains slow; only the final hour gets 2x Tea.
	DELETE FROM public.blessings WHERE receiver_id = player;
	DELETE FROM public.curses WHERE receiver_id = player;
	INSERT INTO public.curses
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (sender, player, 'sluggish_snout',
		checkpoint - interval '3 hours', checkpoint + interval '2 hours',
		checkpoint - interval '1 hour');
	INSERT INTO public.blessings
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (blesser, player, 'warm_tea',
		checkpoint - interval '1 hour', checkpoint + interval '2 hours', NULL);

	SELECT intervals_elapsed, fraction
	INTO got_intervals, got_fraction
	FROM public._tickle_regen_snapshot(
		player, checkpoint - interval '4 hours', 0.25, checkpoint
	);
	IF got_intervals <> 4 OR abs(got_fraction - 0.25) > 0.000001 THEN
		RAISE EXCEPTION 'blessing cancellation: expected 4 + 0.25, got % + %',
			got_intervals, got_fraction;
	END IF;

	-- Natural expiry has the same no-refund result as cleanse, without a write
	-- at the boundary.
	DELETE FROM public.blessings WHERE receiver_id = player;
	DELETE FROM public.curses WHERE receiver_id = player;
	INSERT INTO public.curses
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (sender, player, 'sluggish_snout',
		checkpoint - interval '3 hours', checkpoint - interval '1 hour', NULL);

	SELECT intervals_elapsed, fraction
	INTO got_intervals, got_fraction
	FROM public._tickle_regen_snapshot(
		player, checkpoint - interval '4 hours', 0.25, checkpoint
	);
	IF got_intervals <> 3 OR abs(got_fraction - 0.25) > 0.000001 THEN
		RAISE EXCEPTION 'natural expiry: expected 3 + 0.25, got % + %',
			got_intervals, got_fraction;
	END IF;

	-- The write path checkpoints the same result and stores the fraction rather
	-- than encoding it in an anchor that can cross a rate boundary.
	DELETE FROM public.curses WHERE receiver_id = player;
	INSERT INTO public.curses
		(sender_id, receiver_id, kind, sent_at, expires_at, cleared_at)
	VALUES (sender, player, 'sluggish_snout',
		now() - interval '3 hours', now() - interval '1 hour', NULL);
	UPDATE public.user_items SET
		item_count = 0,
		last_increment = now() - interval '4 hours',
		regen_progress = 0.25
	WHERE user_id = player;

	settled := public.settle_tickles(player);
	SELECT regen_progress INTO stored_fraction
	FROM public.user_items WHERE user_id = player;
	IF settled <> 3 OR abs(stored_fraction - 0.25) > 0.001 THEN
		RAISE EXCEPTION 'settle checkpoint: expected 3 + ~0.25, got % + %',
			settled, stored_fraction;
	END IF;

	-- Both canonical read surfaces use the checkpoint (the Barn wrapper
	-- replaces the legacy status RPC's inline wall-clock division).
	tickle := public.tickle_info(player);
	IF (tickle->>'balance')::int <> 3
	   OR (tickle->>'next_regen_seconds')::int NOT BETWEEN 2690 AND 2700
	   OR public.tickle_balance(player) <> 3 THEN
		RAISE EXCEPTION 'canonical reads lost the settled fraction: %', tickle;
	END IF;
	PERFORM set_config('request.jwt.claim.sub', player::text, true);
	barn := public.barn_visit_status(sender);
	IF (barn->>'balance')::int <> 3
	   OR (barn->>'next_regen_seconds')::int NOT BETWEEN 2690 AND 2700 THEN
		RAISE EXCEPTION 'Barn status did not use canonical regen snapshot: %', barn;
	END IF;

	DELETE FROM public.blessings WHERE receiver_id = player;
	DELETE FROM public.curses WHERE receiver_id = player;
	DELETE FROM public.user_items WHERE user_id = player;
	DELETE FROM public.profiles WHERE id IN (player, sender, blesser);
	DELETE FROM auth.users WHERE id IN (player, sender, blesser);
END;
$smoke$;

SELECT 'sluggish snout regen boundaries: ok' AS chk;

-- Guaranteed Mote rewards, Contraption Inventory, Auto-Tickler reserve,
-- personal Streak, and shared per-friend Visit Streak smoke.
\set ON_ERROR_STOP on

DO $contraptions_and_streaks$
DECLARE
	digger uuid := '00000000-0000-0000-0000-000000063002';
	friend_a uuid := '00000000-0000-0000-0000-000000070001';
	friend_b uuid := '00000000-0000-0000-0000-000000070002';
	result jsonb;
	replayed jsonb;
	reward_amount int;
	resource_after_spin int;
	resource_after_activation int;
	spin_count int;
	counter_before int;
	earned_before int;
	bank_after int;
	current_value int;
	longest_value int;
	shared_rows int;
	shared_current int;
	shared_longest int;
BEGIN
	-- Smoke 64 leaves this digger with one newly credited Mote. Every play must
	-- now yield useful, helper-specific fuel and remain exactly-once on retry.
	PERFORM set_config('smoke.uid', digger::text, true);
	result := public.spin_mote_machine('contraption-request-one');
	reward_amount := (result->>'resource_amount')::int;
	resource_after_spin := (result->>'resource_balance')::int;
	IF NOT COALESCE((result->>'ok')::boolean, false)
		OR reward_amount NOT IN (1, 2, 3, 5)
		OR result->>'resource_id' <> 'clockwork_acorn'
		OR result->>'contraption_id' <> 'auto_tickler'
		OR resource_after_spin <> reward_amount
		OR (result->>'motes_remaining')::int <> 0
		OR COALESCE((result->>'replayed')::boolean, true)
	THEN
		RAISE EXCEPTION 'contraption spin was not a positive fuel grant: %', result;
	END IF;

	replayed := public.spin_mote_machine('contraption-request-one');
	SELECT count(*)::int INTO spin_count
	FROM public.mote_machine_spins
	WHERE user_id = digger AND request_id = 'contraption-request-one';
	IF NOT COALESCE((replayed->>'replayed')::boolean, false)
		OR (replayed->>'resource_amount')::int <> reward_amount
		OR (replayed->>'resource_balance')::int <> resource_after_spin
		OR spin_count <> 1
	THEN
		RAISE EXCEPTION 'contraption replay changed its durable grant: %', replayed;
	END IF;

	-- A manual Home tickle is the only path that advances the personal Streak.
	UPDATE public.user_items
	SET item_count = 1, last_increment = now(), regen_progress = 0
	WHERE user_id = digger;
	UPDATE public.profiles
	SET current_streak = 0, longest_streak = 0, last_streak_bump_at = NULL
	WHERE id = digger;
	result := public.update_profile_and_item_count(digger);
	IF (result->>'current_streak')::int <> 1
		OR NOT COALESCE((result->>'credited')::boolean, false)
	THEN
		RAISE EXCEPTION 'first manual tickle did not start personal Streak: %', result;
	END IF;

	UPDATE public.user_items
	SET item_count = 1, last_increment = now(), regen_progress = 0
	WHERE user_id = digger;
	result := public.update_profile_and_item_count(digger);
	IF (result->>'current_streak')::int <> 1
		OR COALESCE((result->>'credited')::boolean, true)
	THEN
		RAISE EXCEPTION 'second manual tickle double-credited inside 24h: %', result;
	END IF;

	UPDATE public.profiles SET last_streak_bump_at = now() - interval '25 hours'
	WHERE id = digger;
	UPDATE public.user_items
	SET item_count = 1, last_increment = now(), regen_progress = 0
	WHERE user_id = digger;
	result := public.update_profile_and_item_count(digger);
	IF (result->>'current_streak')::int <> 2 THEN
		RAISE EXCEPTION 'manual tickle inside grace did not advance personal Streak: %', result;
	END IF;

	UPDATE public.profiles SET last_streak_bump_at = now() - interval '37 hours'
	WHERE id = digger;
	UPDATE public.user_items
	SET item_count = 1, last_increment = now(), regen_progress = 0
	WHERE user_id = digger;
	result := public.update_profile_and_item_count(digger);
	IF (result->>'current_streak')::int <> 1
		OR (result->>'longest_streak')::int <> 2
		OR public.streak_mod(100) <> 0.75
	THEN
		RAISE EXCEPTION 'personal Streak reset/cap contract is wrong: %', result;
	END IF;

	-- One Acorn activates one day. Activation immediately spends only the
	-- surplus above the normal personal cap minus five (25 - 5 = 20).
	UPDATE public.user_items
	SET item_count = 25, last_increment = now(), regen_progress = 0
	WHERE user_id = digger;
	SELECT counter, tickles_earned INTO counter_before, earned_before
	FROM public.profiles WHERE id = digger;
	result := public.activate_contraption('auto_tickler', 'day');
	resource_after_activation := (result->>'resource_balance')::int;
	SELECT item_count INTO bank_after FROM public.user_items WHERE user_id = digger;
	SELECT current_streak, longest_streak INTO current_value, longest_value
	FROM public.profiles WHERE id = digger;
	IF NOT COALESCE((result->>'ok')::boolean, false)
		OR (result->>'cost')::int <> 1
		OR resource_after_activation <> resource_after_spin - 1
		OR bank_after <> 20
		OR (SELECT counter FROM public.profiles WHERE id = digger) <> counter_before + 5
		OR (SELECT tickles_earned FROM public.profiles WHERE id = digger) <> earned_before + 5
		OR current_value <> 1 OR longest_value <> 2
	THEN
		RAISE EXCEPTION 'Auto-Tickler did not preserve five/count normal earned play: %, bank %, streak %/%',
			result, bank_after, current_value, longest_value;
	END IF;

	-- A Visit Streak belongs to the unordered pair. Either direction keeps it
	-- alive, reciprocal visits in one window do not double-credit, and best is
	-- banked when the live count later resets.
	INSERT INTO auth.users (id) VALUES (friend_a), (friend_b)
	ON CONFLICT (id) DO NOTHING;
	INSERT INTO public.profiles (id, username)
	VALUES (friend_a, 'visit-streak-a'), (friend_b, 'visit-streak-b')
	ON CONFLICT (id) DO NOTHING;

	INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, created_at)
	VALUES (friend_a, friend_b, now(), now());
	INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, created_at)
	VALUES (friend_b, friend_a, now(), now());
	SELECT count(*)::int, max(current_streak), max(longest_streak)
	INTO shared_rows, shared_current, shared_longest
	FROM public.visit_streaks
	WHERE user_low = LEAST(friend_a, friend_b)
		AND user_high = GREATEST(friend_a, friend_b);
	IF shared_rows <> 1 OR shared_current <> 1 OR shared_longest <> 1 THEN
		RAISE EXCEPTION 'reciprocal same-window visits double-credited: % rows, %/%',
			shared_rows, shared_current, shared_longest;
	END IF;

	UPDATE public.visit_streaks SET last_credit_at = now() - interval '25 hours'
	WHERE user_low = LEAST(friend_a, friend_b)
		AND user_high = GREATEST(friend_a, friend_b);
	INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, created_at)
	VALUES (friend_b, friend_a, now(), now());
	SELECT current_streak, longest_streak INTO shared_current, shared_longest
	FROM public.visit_streaks
	WHERE user_low = LEAST(friend_a, friend_b)
		AND user_high = GREATEST(friend_a, friend_b);
	IF shared_current <> 2 OR shared_longest <> 2 THEN
		RAISE EXCEPTION 'either-direction Visit did not advance shared Streak: %/%',
			shared_current, shared_longest;
	END IF;

	UPDATE public.visit_streaks SET last_credit_at = now() - interval '37 hours'
	WHERE user_low = LEAST(friend_a, friend_b)
		AND user_high = GREATEST(friend_a, friend_b);
	INSERT INTO public.barn_visits (visitor_id, target_id, visit_started_at, created_at)
	VALUES (friend_a, friend_b, now(), now());
	SELECT current_streak, longest_streak INTO shared_current, shared_longest
	FROM public.visit_streaks
	WHERE user_low = LEAST(friend_a, friend_b)
		AND user_high = GREATEST(friend_a, friend_b);
	IF shared_current <> 1 OR shared_longest <> 2 THEN
		RAISE EXCEPTION 'expired Visit Streak did not reset/bank best: %/%',
			shared_current, shared_longest;
	END IF;

	PERFORM set_config('smoke.uid', friend_a::text, true);
	result := public.friend_visit_streaks(ARRAY[friend_b]);
	IF NOT COALESCE((result->>'ok')::boolean, false)
		OR (result#>>'{streaks,0,target_id}')::uuid <> friend_b
		OR (result#>>'{streaks,0,current_streak}')::int <> 1
		OR (result#>>'{streaks,0,longest_streak}')::int <> 2
		OR NOT COALESCE((result#>>'{streaks,0,active}')::boolean, false)
	THEN
		RAISE EXCEPTION 'friend Visit Streak surface is wrong: %', result;
	END IF;

	RAISE NOTICE 'chk contraptions_streaks: positive fuel + reserve + manual/share rules OK';
END;
$contraptions_and_streaks$;

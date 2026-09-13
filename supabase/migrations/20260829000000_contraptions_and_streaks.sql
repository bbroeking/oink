-- Guaranteed Mote rewards, Contraption Inventory, Auto-Tickler service,
-- personal Streak, and per-friend Visit Streaks.
--
-- Authored only. Applying this migration still requires the founder's explicit
-- database-push "go".

set check_function_bodies = off;

-- ---------------------------------------------------------------------------
-- Contraption catalog and owner inventory
-- ---------------------------------------------------------------------------

CREATE TABLE public.contraption_catalog (
	id text PRIMARY KEY CHECK (id ~ '^[a-z][a-z0-9_]{2,47}$'),
	name text NOT NULL CHECK (length(name) BETWEEN 2 AND 80),
	description text NOT NULL CHECK (length(description) BETWEEN 8 AND 280),
	resource_id text NOT NULL UNIQUE CHECK (resource_id ~ '^[a-z][a-z0-9_]{2,47}$'),
	resource_name text NOT NULL CHECK (length(resource_name) BETWEEN 2 AND 80),
	resource_icon text NOT NULL CHECK (length(resource_icon) BETWEEN 1 AND 32),
	behavior text NOT NULL CHECK (behavior IN ('auto_tickler')),
	enabled boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contraption_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated players can view Contraption catalog"
	ON public.contraption_catalog FOR SELECT TO authenticated
	USING (true);

INSERT INTO public.contraption_catalog (
	id, name, description, resource_id, resource_name, resource_icon,
	behavior, enabled
) VALUES (
	'auto_tickler',
	'Auto-Tickler',
	'Keeps regenerated Tickles moving while preserving the final five for you.',
	'clockwork_acorn',
	'Clockwork Acorn',
	'acorn',
	'auto_tickler',
	true
);

CREATE TABLE public.user_contraptions (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	contraption_id text NOT NULL REFERENCES public.contraption_catalog(id),
	resource_balance int NOT NULL DEFAULT 0 CHECK (resource_balance >= 0),
	unlocked_at timestamptz NOT NULL DEFAULT now(),
	active_until timestamptz,
	last_activated_at timestamptz,
	last_processed_at timestamptz,
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, contraption_id)
);

ALTER TABLE public.user_contraptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View your Contraption Inventory"
	ON public.user_contraptions FOR SELECT TO authenticated
	USING (user_id = auth.uid());

CREATE TABLE public.contraption_service_events (
	id bigserial PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	contraption_id text NOT NULL REFERENCES public.contraption_catalog(id),
	kind text NOT NULL CHECK (kind IN ('activated', 'auto_tickles')),
	amount int NOT NULL,
	metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
	occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contraption_service_events_owner_recent_idx
	ON public.contraption_service_events (user_id, occurred_at DESC);

ALTER TABLE public.contraption_service_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View your Contraption service receipts"
	ON public.contraption_service_events FOR SELECT TO authenticated
	USING (user_id = auth.uid());

-- Install cleanly against both historical Mote schemas: local/replay databases
-- still have the three retired alchemy inputs, while production removed them
-- when the one-argument guaranteed-reward function shipped. Preserve the
-- durable receipt and its historical reward_tickles value in either case.
DROP FUNCTION IF EXISTS public.spin_mote_machine(text, int, int, int);

ALTER TABLE public.mote_machine_spins
	DROP COLUMN IF EXISTS warmth,
	DROP COLUMN IF EXISTS whirl,
	DROP COLUMN IF EXISTS resonance,
	ALTER COLUMN reward_tickles DROP NOT NULL,
	ADD COLUMN IF NOT EXISTS contraption_id text REFERENCES public.contraption_catalog(id),
	ADD COLUMN IF NOT EXISTS resource_id text,
	ADD COLUMN IF NOT EXISTS resource_amount int CHECK (resource_amount > 0),
	ADD COLUMN IF NOT EXISTS reel_value int CHECK (reel_value IN (3, 5, 10, 25));

CREATE OR REPLACE FUNCTION public.mote_machine_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	balance int;
	inventory jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT mote_balance INTO balance
	FROM public.profiles
	WHERE id = caller_id;

	IF balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
	END IF;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'contraption_id', c.id,
		'name', c.name,
		'description', c.description,
		'resource_id', c.resource_id,
		'resource_name', c.resource_name,
		'resource_icon', c.resource_icon,
		'resource_balance', uc.resource_balance,
		'active_until', uc.active_until,
		'unlocked_at', uc.unlocked_at
	) ORDER BY uc.unlocked_at), '[]'::jsonb)
	INTO inventory
	FROM public.user_contraptions uc
	JOIN public.contraption_catalog c ON c.id = uc.contraption_id
	WHERE uc.user_id = caller_id;

	RETURN jsonb_build_object(
		'ok', true,
		'motes', balance,
		'reward_family', jsonb_build_object(
			'contraption_id', 'auto_tickler',
			'name', 'Auto-Tickler',
			'resource_id', 'clockwork_acorn',
			'resource_name', 'Clockwork Acorn',
			'resource_icon', 'acorn'
		),
		'inventory', inventory
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.spin_mote_machine(p_request_id text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	balance int;
	draw double precision;
	reward_amount int;
	reel_stop int;
	was_unlocked boolean;
	new_resource_balance int;
	current_tickle_balance int;
	prior public.mote_machine_spins%ROWTYPE;
	receipt public.mote_machine_spins%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 8 AND 128 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_request_id');
	END IF;

	-- Serializes all plays for this pig. The receipt re-check after this lock
	-- collapses concurrent retries to one spend and one inventory grant.
	SELECT mote_balance INTO balance
	FROM public.profiles
	WHERE id = caller_id
	FOR UPDATE;

	IF balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
	END IF;

	SELECT * INTO prior
	FROM public.mote_machine_spins
	WHERE user_id = caller_id AND request_id = p_request_id;

	IF prior.id IS NOT NULL THEN
		RETURN jsonb_build_object(
			'ok', true,
			'spin_id', prior.id,
			'contraption_id', prior.contraption_id,
			'contraption_name', 'Auto-Tickler',
			'resource_id', prior.resource_id,
			'resource_name', 'Clockwork Acorn',
			'resource_icon', 'acorn',
			'resource_amount', prior.resource_amount,
			'resource_balance', (
				SELECT resource_balance FROM public.user_contraptions
				WHERE user_id = caller_id AND contraption_id = prior.contraption_id
			),
			'reel_value', prior.reel_value,
			'newly_unlocked', false,
			'motes_remaining', prior.motes_remaining,
			'replayed', true
		);
	END IF;

	IF balance < 1 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_motes', 'motes', 0);
	END IF;

	-- Every branch is a positive, useful Clockwork Acorn grant. The client never
	-- receives or displays these weights and cannot influence the draw.
	draw := random();
	reward_amount := CASE
		WHEN draw < 0.50 THEN 1
		WHEN draw < 0.80 THEN 2
		WHEN draw < 0.95 THEN 3
		ELSE 5
	END;
	reel_stop := CASE reward_amount
		WHEN 1 THEN 3
		WHEN 2 THEN 5
		WHEN 3 THEN 10
		ELSE 25
	END;

	SELECT EXISTS (
		SELECT 1 FROM public.user_contraptions
		WHERE user_id = caller_id AND contraption_id = 'auto_tickler'
	) INTO was_unlocked;

	UPDATE public.profiles
	SET mote_balance = mote_balance - 1
	WHERE id = caller_id
	RETURNING mote_balance INTO balance;

	INSERT INTO public.user_contraptions (
		user_id, contraption_id, resource_balance, unlocked_at, updated_at
	) VALUES (
		caller_id, 'auto_tickler', reward_amount, now(), now()
	)
	ON CONFLICT (user_id, contraption_id) DO UPDATE
	SET resource_balance = public.user_contraptions.resource_balance + EXCLUDED.resource_balance,
		updated_at = now()
	RETURNING resource_balance INTO new_resource_balance;

	current_tickle_balance := COALESCE(
		(public.tickle_info(caller_id)->>'balance')::int,
		0
	);

	INSERT INTO public.mote_machine_spins (
		user_id, request_id, reward_tickles,
		motes_remaining, tickles_balance, contraption_id, resource_id,
		resource_amount, reel_value
	) VALUES (
		caller_id, p_request_id, NULL,
		balance, current_tickle_balance, 'auto_tickler', 'clockwork_acorn',
		reward_amount, reel_stop
	)
	RETURNING * INTO receipt;

	RETURN jsonb_build_object(
		'ok', true,
		'spin_id', receipt.id,
		'contraption_id', receipt.contraption_id,
		'contraption_name', 'Auto-Tickler',
		'resource_id', receipt.resource_id,
		'resource_name', 'Clockwork Acorn',
		'resource_icon', 'acorn',
		'resource_amount', receipt.resource_amount,
		'resource_balance', new_resource_balance,
		'reel_value', receipt.reel_value,
		'newly_unlocked', NOT was_unlocked,
		'motes_remaining', receipt.motes_remaining,
		'replayed', false
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.mote_machine_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spin_mote_machine(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mote_machine_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_mote_machine(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Auto-Tickler activation and background service
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._process_auto_tickler_user(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	service public.user_contraptions%ROWTYPE;
	cap_val int;
	reserve_val int;
	balance int;
	spent int;
BEGIN
	SELECT * INTO service
	FROM public.user_contraptions
	WHERE user_id = p_user_id
		AND contraption_id = 'auto_tickler'
	FOR UPDATE;

	IF service.user_id IS NULL OR service.active_until IS NULL
		OR service.active_until <= now()
	THEN
		RETURN 0;
	END IF;

	-- settle_tickles is the canonical fractional-regen checkpoint. The service
	-- then consumes only the surplus over the player's personal cap minus five.
	balance := public.settle_tickles(p_user_id);
	SELECT CASE WHEN COALESCE(is_vip, false) THEN 50 ELSE 25 END
	INTO cap_val FROM public.profiles WHERE id = p_user_id;
	reserve_val := GREATEST(0, cap_val - 5);
	spent := GREATEST(0, balance - reserve_val);

	IF spent > 0 THEN
		UPDATE public.user_items
		SET item_count = item_count - spent
		WHERE user_id = p_user_id;

		-- Deliberately no apply_streak_bump, happiness, Lucky Pig, or season XP.
		-- Automatic tickles are real standings play and normal Snouts, but the
		-- personal-engagement Streak remains manual-only.
		UPDATE public.profiles
		SET counter = counter + spent,
			tickles_earned = tickles_earned + spent
		WHERE id = p_user_id;

		INSERT INTO public.contraption_service_events (
			user_id, contraption_id, kind, amount, metadata
		) VALUES (
			p_user_id, 'auto_tickler', 'auto_tickles', spent,
			jsonb_build_object('reserve', reserve_val, 'cap', cap_val)
		);
	END IF;

	UPDATE public.user_contraptions
	SET last_processed_at = now(), updated_at = now()
	WHERE user_id = p_user_id AND contraption_id = 'auto_tickler';

	RETURN spent;
END;
$function$;

REVOKE ALL ON FUNCTION public._process_auto_tickler_user(uuid)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sweep_auto_ticklers()
RETURNS int
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	row record;
	processed int := 0;
BEGIN
	FOR row IN
		SELECT user_id FROM public.user_contraptions
		WHERE contraption_id = 'auto_tickler' AND active_until > now()
	LOOP
		processed := processed + public._process_auto_tickler_user(row.user_id);
	END LOOP;
	RETURN processed;
END;
$function$;

REVOKE ALL ON FUNCTION public.sweep_auto_ticklers()
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_contraption(
	p_contraption_id text,
	p_duration text
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost int;
	service_duration interval;
	item public.user_contraptions%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_contraption_id <> 'auto_tickler' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_contraption');
	END IF;
	IF p_duration = 'day' THEN
		cost := 1;
		service_duration := interval '1 day';
	ELSIF p_duration = 'week' THEN
		cost := 5;
		service_duration := interval '7 days';
	ELSE
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_duration');
	END IF;

	SELECT * INTO item
	FROM public.user_contraptions
	WHERE user_id = caller_id AND contraption_id = p_contraption_id
	FOR UPDATE;

	IF item.user_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'locked');
	END IF;
	IF item.resource_balance < cost THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'not_enough_resource',
			'needed', cost, 'available', item.resource_balance
		);
	END IF;

	UPDATE public.user_contraptions
	SET resource_balance = resource_balance - cost,
		active_until = GREATEST(COALESCE(active_until, now()), now()) + service_duration,
		last_activated_at = now(),
		updated_at = now()
	WHERE user_id = caller_id AND contraption_id = p_contraption_id
	RETURNING * INTO item;

	INSERT INTO public.contraption_service_events (
		user_id, contraption_id, kind, amount, metadata
	) VALUES (
		caller_id, p_contraption_id, 'activated', -cost,
		jsonb_build_object('duration', p_duration, 'active_until', item.active_until)
	);

	PERFORM public._process_auto_tickler_user(caller_id);

	RETURN jsonb_build_object(
		'ok', true,
		'contraption_id', item.contraption_id,
		'resource_balance', item.resource_balance,
		'active_until', item.active_until,
		'duration', p_duration,
		'cost', cost
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.contraption_inventory()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	items jsonb;
	events jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	PERFORM public._process_auto_tickler_user(caller_id);

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'contraption_id', c.id,
		'name', c.name,
		'description', c.description,
		'resource_id', c.resource_id,
		'resource_name', c.resource_name,
		'resource_icon', c.resource_icon,
		'resource_balance', uc.resource_balance,
		'active_until', uc.active_until,
		'unlocked_at', uc.unlocked_at
	) ORDER BY uc.unlocked_at), '[]'::jsonb)
	INTO items
	FROM public.user_contraptions uc
	JOIN public.contraption_catalog c ON c.id = uc.contraption_id
	WHERE uc.user_id = caller_id;

	SELECT COALESCE(jsonb_agg(to_jsonb(recent) ORDER BY recent.occurred_at DESC), '[]'::jsonb)
	INTO events
	FROM (
		SELECT kind, amount, metadata, occurred_at
		FROM public.contraption_service_events
		WHERE user_id = caller_id
		ORDER BY occurred_at DESC
		LIMIT 20
	) recent;

	RETURN jsonb_build_object('ok', true, 'items', items, 'events', events);
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_contraption(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.contraption_inventory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_contraption(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contraption_inventory() TO authenticated;

-- The production project already has pg_cron. The exception guard keeps the
-- plain-Postgres test harness usable when its cron stub is absent.
DO $schedule$
BEGIN
	PERFORM cron.schedule(
		'contraption-auto-tickler',
		'*/10 * * * *',
		'SELECT public.sweep_auto_ticklers()'
	);
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'Auto-Tickler cron was not scheduled in this environment: %', SQLERRM;
END;
$schedule$;

-- ---------------------------------------------------------------------------
-- Manual personal Streak
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
	ADD COLUMN current_streak int NOT NULL DEFAULT 0 CHECK (current_streak >= 0),
	ADD COLUMN longest_streak int NOT NULL DEFAULT 0 CHECK (longest_streak >= 0),
	ADD COLUMN last_streak_bump_at timestamptz;

CREATE OR REPLACE FUNCTION public.streak_mod(p_streak int)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $function$
	SELECT CASE
		WHEN COALESCE(p_streak, 0) <= 1 THEN 1.0
		WHEN p_streak >= 30 THEN 0.75
		ELSE 1.0 - (p_streak - 1) * (0.25 / 29.0)
	END;
$function$;

REVOKE ALL ON FUNCTION public.streak_mod(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.streak_mod(int) TO authenticated;

-- Keep the existing historical ritual integration intact and add Streak as a
-- lazy/current-value multiplier, matching happiness/alignment semantics.
ALTER FUNCTION public._regen_secs_for_wallow_at(uuid, int, timestamptz)
	RENAME TO _regen_secs_for_wallow_at_before_streak;

REVOKE ALL ON FUNCTION public._regen_secs_for_wallow_at_before_streak(uuid, int, timestamptz)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._regen_secs_for_wallow_at(
	uid uuid,
	p_wallow_count int,
	p_at timestamptz
)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		public._regen_secs_for_wallow_at_before_streak(uid, p_wallow_count, p_at)
		* public.streak_mod(COALESCE((
			SELECT CASE
				WHEN last_streak_bump_at IS NULL
					OR last_streak_bump_at < p_at - interval '36 hours'
				THEN 0 ELSE current_streak
			END
			FROM public.profiles WHERE id = uid
		), 0))
	)::int);
$function$;

REVOKE ALL ON FUNCTION public._regen_secs_for_wallow_at(uuid, int, timestamptz)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._apply_manual_streak_bump(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	current_value int;
	longest_value int;
	last_credit timestamptz;
	new_value int;
BEGIN
	SELECT current_streak, longest_streak, last_streak_bump_at
	INTO current_value, longest_value, last_credit
	FROM public.profiles
	WHERE id = p_user_id
	FOR UPDATE;

	IF last_credit IS NULL THEN
		new_value := 1;
	ELSIF now() < last_credit + interval '24 hours' THEN
		RETURN jsonb_build_object(
			'current_streak', current_value,
			'longest_streak', longest_value,
			'credited', false,
			'last_streak_bump_at', last_credit
		);
	ELSIF now() <= last_credit + interval '36 hours' THEN
		new_value := current_value + 1;
	ELSE
		new_value := 1;
	END IF;

	UPDATE public.profiles
	SET current_streak = new_value,
		longest_streak = GREATEST(longest_streak, new_value),
		last_streak_bump_at = now()
	WHERE id = p_user_id
	RETURNING current_streak, longest_streak, last_streak_bump_at
	INTO current_value, longest_value, last_credit;

	RETURN jsonb_build_object(
		'current_streak', current_value,
		'longest_streak', longest_value,
		'credited', true,
		'last_streak_bump_at', last_credit
	);
END;
$function$;

REVOKE ALL ON FUNCTION public._apply_manual_streak_bump(uuid)
	FROM PUBLIC, anon, authenticated;

-- Only the manual Home tickle RPC receives the bump. The Auto-Tickler updates
-- standings directly and therefore cannot accidentally preserve this Streak.
ALTER FUNCTION public.update_profile_and_item_count(uuid)
	RENAME TO _update_profile_and_item_count_before_streak;

REVOKE ALL ON FUNCTION public._update_profile_and_item_count_before_streak(uuid)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_profile_and_item_count(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	result jsonb;
	streak jsonb;
BEGIN
	IF auth.uid() IS NULL OR auth.uid() <> uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
	END IF;
	result := public._update_profile_and_item_count_before_streak(uid);
	IF result ? 'global_counter' THEN
		streak := public._apply_manual_streak_bump(uid);
		RETURN result || streak;
	END IF;
	RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_profile_and_item_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_profile_and_item_count(uuid) TO authenticated;

-- Extend the current one-round-trip Barn payload without duplicating its
-- cosmetic and season joins.
ALTER FUNCTION public.home_stats() RENAME TO _home_stats_before_streak;
REVOKE ALL ON FUNCTION public._home_stats_before_streak()
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	base jsonb;
	profile_streak record;
	live_streak int;
BEGIN
	base := public._home_stats_before_streak();
	IF caller_id IS NULL OR NOT COALESCE((base->>'ok')::boolean, false) THEN
		RETURN base;
	END IF;

	SELECT current_streak, longest_streak, last_streak_bump_at
	INTO profile_streak FROM public.profiles WHERE id = caller_id;
	live_streak := CASE
		WHEN profile_streak.last_streak_bump_at IS NULL
			OR profile_streak.last_streak_bump_at < now() - interval '36 hours'
		THEN 0 ELSE profile_streak.current_streak
	END;

	RETURN base || jsonb_build_object(
		'current_streak', live_streak,
		'longest_streak', COALESCE(profile_streak.longest_streak, 0),
		'streak_ends_at', CASE
			WHEN live_streak > 0 THEN profile_streak.last_streak_bump_at + interval '36 hours'
			ELSE NULL
		END
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.home_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

-- ---------------------------------------------------------------------------
-- Shared per-friend Visit Streaks (Pair Flames replacement)
-- ---------------------------------------------------------------------------

CREATE TABLE public.visit_streaks (
	user_low uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	user_high uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	current_streak int NOT NULL DEFAULT 1 CHECK (current_streak >= 1),
	longest_streak int NOT NULL DEFAULT 1 CHECK (longest_streak >= 1),
	last_credit_at timestamptz NOT NULL,
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_low, user_high),
	CHECK (user_low < user_high)
);

ALTER TABLE public.visit_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Friends can view their shared Visit Streak"
	ON public.visit_streaks FOR SELECT TO authenticated
	USING (auth.uid() = user_low OR auth.uid() = user_high);

CREATE OR REPLACE FUNCTION public._credit_visit_streak(
	p_user_a uuid,
	p_user_b uuid,
	p_visited_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	low_id uuid;
	high_id uuid;
	streak_row public.visit_streaks%ROWTYPE;
	new_value int;
BEGIN
	IF p_user_a IS NULL OR p_user_b IS NULL OR p_user_a = p_user_b THEN
		RETURN;
	END IF;
	IF NOT public.are_friends(p_user_a, p_user_b) THEN
		RETURN;
	END IF;
	low_id := LEAST(p_user_a, p_user_b);
	high_id := GREATEST(p_user_a, p_user_b);

	INSERT INTO public.visit_streaks (
		user_low, user_high, current_streak, longest_streak, last_credit_at
	) VALUES (
		low_id, high_id, 1, 1, p_visited_at
	)
	ON CONFLICT (user_low, user_high) DO NOTHING;
	IF FOUND THEN RETURN; END IF;

	SELECT * INTO streak_row
	FROM public.visit_streaks
	WHERE user_low = low_id AND user_high = high_id
	FOR UPDATE;

	-- Either direction calls this helper, but only the first qualifying visit
	-- after 24h can credit the shared pair. Same-session taps and reciprocal
	-- visits inside that window are idempotent.
	IF p_visited_at < streak_row.last_credit_at + interval '24 hours' THEN
		RETURN;
	END IF;
	IF p_visited_at <= streak_row.last_credit_at + interval '36 hours' THEN
		new_value := streak_row.current_streak + 1;
	ELSE
		new_value := 1;
	END IF;

	UPDATE public.visit_streaks
	SET current_streak = new_value,
		longest_streak = GREATEST(longest_streak, new_value),
		last_credit_at = p_visited_at,
		updated_at = now()
	WHERE user_low = low_id AND user_high = high_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._credit_visit_streak(uuid, uuid, timestamptz)
	FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.credit_visit_streak_on_barn_tap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
	PERFORM public._credit_visit_streak(
		NEW.visitor_id,
		NEW.target_id,
		COALESCE(NEW.visit_started_at, NEW.created_at)
	);
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_visit_streak_on_barn_tap()
	FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS barn_visits_credit_visit_streak ON public.barn_visits;
CREATE TRIGGER barn_visits_credit_visit_streak
	AFTER INSERT ON public.barn_visits
	FOR EACH ROW EXECUTE FUNCTION public.credit_visit_streak_on_barn_tap();

CREATE OR REPLACE FUNCTION public.friend_visit_streaks(p_targets uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rows jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF COALESCE(array_length(p_targets, 1), 0) > 100 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_many_targets');
	END IF;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
		'target_id', target_id,
		'current_streak', CASE
			WHEN vs.last_credit_at IS NULL
				OR vs.last_credit_at < now() - interval '36 hours'
			THEN 0 ELSE vs.current_streak
		END,
		'longest_streak', COALESCE(vs.longest_streak, 0),
		'last_credit_at', vs.last_credit_at,
		'active', vs.last_credit_at >= now() - interval '36 hours'
	) ORDER BY target_id), '[]'::jsonb)
	INTO rows
	FROM unnest(COALESCE(p_targets, ARRAY[]::uuid[])) AS target_id
	LEFT JOIN public.visit_streaks vs
		ON vs.user_low = LEAST(caller_id, target_id)
		AND vs.user_high = GREATEST(caller_id, target_id)
	WHERE target_id <> caller_id
		AND public.are_friends(caller_id, target_id);

	RETURN jsonb_build_object('ok', true, 'streaks', rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.friend_visit_streaks(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_visit_streaks(uuid[]) TO authenticated;

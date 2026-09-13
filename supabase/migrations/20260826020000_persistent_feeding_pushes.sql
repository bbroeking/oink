-- Persistent, account-level Truffle Patch opening notifications.
--
-- The old client reminder scheduled one local notification and disappeared
-- after it fired. The account now owns a durable preference; a one-minute cron
-- calls an idempotent dispatcher at every Feeding. A delivery ledger keyed by
-- (user, window) prevents duplicate pushes even when cron overlaps or retries.
--
-- Eligibility is checked at delivery time. A player must still belong to a
-- real Sounder, have a registered/permissioned push token, and not have already
-- submitted this Feeding. Leaving a Sounder, revoking permission, signing out,
-- opting out, or digging before a delayed sweep all suppress delivery.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS expo_push_token text,
	ADD COLUMN IF NOT EXISTS push_permission_granted boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS feeding_push_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_feeding_push_enabled_idx
	ON public.profiles (id)
	WHERE feeding_push_enabled = true;

CREATE TABLE IF NOT EXISTS public.feeding_push_deliveries (
	user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
	window_index bigint NOT NULL,
	queued_at timestamptz NOT NULL DEFAULT now(),
	request_id bigint,
	PRIMARY KEY (user_id, window_index)
);

ALTER TABLE public.feeding_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.feeding_push_deliveries FROM PUBLIC, anon, authenticated;

-- Account-synchronized read. Kept behind an RPC so authored-but-unpushed
-- clients fail dark through utils/rpc.ts and so notification-token columns do
-- not need to be exposed to direct profile reads.
CREATE OR REPLACE FUNCTION public.feeding_push_preference()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	enabled boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT feeding_push_enabled INTO enabled
	FROM public.profiles
	WHERE id = caller_id;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
	END IF;

	RETURN jsonb_build_object('ok', true, 'enabled', enabled);
END;
$function$;

REVOKE ALL ON FUNCTION public.feeding_push_preference() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.feeding_push_preference() TO authenticated;

-- Enabling fails closed unless this account currently has a server-registered
-- token. Disabling is always allowed, including after permission was revoked.
CREATE OR REPLACE FUNCTION public.set_feeding_push_preference(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	updated boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	UPDATE public.profiles
	SET feeding_push_enabled = p_enabled
	WHERE id = caller_id
		AND (
			p_enabled = false
			OR (
				push_permission_granted = true
				AND expo_push_token IS NOT NULL
				AND expo_push_token <> ''
			)
		)
	RETURNING feeding_push_enabled INTO updated;

	IF NOT FOUND THEN
		IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = caller_id) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
		END IF;
		RETURN jsonb_build_object('ok', false, 'reason', 'notifications_unavailable');
	END IF;

	RETURN jsonb_build_object('ok', true, 'enabled', updated);
END;
$function$;

REVOKE ALL ON FUNCTION public.set_feeding_push_preference(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_feeding_push_preference(boolean) TO authenticated;

-- Cron-only entry point. p_at is a deterministic test seam; production calls
-- the no-argument/default signature. _patch_clock is the single server-owned
-- source for both the legacy uniform and Eastern commuter schedules.
CREATE OR REPLACE FUNCTION public.dispatch_feeding_open_pushes(
	p_at timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	clock record;
	target record;
	delivery_window bigint;
	push_result jsonb;
	queued int := 0;
	suppressed int := 0;
BEGIN
	SELECT * INTO clock FROM public._patch_clock(p_at);

	IF NOT clock.phase_open THEN
		RETURN jsonb_build_object(
			'ok', true,
			'window_index', clock.window_index,
			'phase_open', false,
			'queued', 0,
			'suppressed', 0
		);
	END IF;

	FOR target IN
		SELECT DISTINCT p.id
		FROM public.profiles p
		JOIN public.crew_members cm ON cm.user_id = p.id
		JOIN public.crews c ON c.id = cm.crew_id AND c.is_bot = false
		WHERE p.feeding_push_enabled = true
			AND p.push_permission_granted = true
			AND p.expo_push_token IS NOT NULL
			AND p.expo_push_token <> ''
			AND NOT EXISTS (
				SELECT 1
				FROM public.feeding_push_deliveries fd
				WHERE fd.user_id = p.id
					AND fd.window_index = clock.window_index
			)
			AND NOT EXISTS (
				SELECT 1
				FROM public.war_rootings wr
				WHERE wr.user_id = p.id
					AND wr.window_index = clock.window_index
					AND wr.submitted_at IS NOT NULL
			)
	LOOP
		delivery_window := NULL;
		INSERT INTO public.feeding_push_deliveries (user_id, window_index, queued_at)
		VALUES (target.id, clock.window_index, p_at)
		ON CONFLICT (user_id, window_index) DO NOTHING
		RETURNING window_index INTO delivery_window;

		IF delivery_window IS NULL THEN
			suppressed := suppressed + 1;
			CONTINUE;
		END IF;

		BEGIN
			push_result := public.send_push_to_user(
				target.id,
				'The patch is open',
				'The Hungerer is gorging — come dig with your Sounder.',
				jsonb_build_object(
					'kind', 'feeding_open',
					'screen', 'season',
					'window_index', clock.window_index
				)
			);

			IF COALESCE((push_result->>'ok')::boolean, false) THEN
				UPDATE public.feeding_push_deliveries
				SET request_id = NULLIF(push_result->>'request_id', '')::bigint
				WHERE user_id = target.id AND window_index = clock.window_index;
				queued := queued + 1;
			ELSE
				DELETE FROM public.feeding_push_deliveries
				WHERE user_id = target.id AND window_index = clock.window_index;
				suppressed := suppressed + 1;
			END IF;
		EXCEPTION WHEN OTHERS THEN
			-- A transport/helper failure must not poison the dedupe ledger. Delete
			-- the reservation so the next cron minute can retry this Feeding.
			DELETE FROM public.feeding_push_deliveries
			WHERE user_id = target.id AND window_index = clock.window_index;
			suppressed := suppressed + 1;
		END;
	END LOOP;

	RETURN jsonb_build_object(
		'ok', true,
		'window_index', clock.window_index,
		'phase_open', true,
		'queued', queued,
		'suppressed', suppressed
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.dispatch_feeding_open_pushes(timestamptz)
	FROM PUBLIC, anon, authenticated;

-- One-minute cadence keeps delivery close to the opening boundary. The
-- dispatcher itself is safe to run for every minute of the open phase.
DO $$ BEGIN
	PERFORM cron.schedule(
		'feeding-open-pushes',
		'* * * * *',
		'SELECT public.dispatch_feeding_open_pushes()'
	);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

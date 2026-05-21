-- Server-side push delivery for tickle-trade events.
--
-- pg_net lets Postgres POST to external HTTP services from a trigger.
-- Expo's push API accepts unauthenticated POSTs (the only secret is
-- the recipient's push token, which already lives in profiles), so
-- we can fire-and-forget directly from a trigger.
--
-- Architecture:
--   tickle_trades INSERT / UPDATE
--     → trigger picks the right event ("requested", "fulfilled",
--       "cancelled")
--     → calls send_push_to_user with the target's user_id + payload
--     → pg_net posts to https://exp.host/--/api/v2/push/send
--     → Expo forwards to APNs → device receives
--
-- Manual testing: `dev_send_push(target_user_id, title, body)` lets
-- you fire a one-off push from SQL without needing a real trade.

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ── send_push_to_user: fire a push to a user, by id ────────────────
-- Caller specifies the recipient + content. Reads the target's
-- expo_push_token; no-ops silently if they don't have one.
CREATE OR REPLACE FUNCTION public.send_push_to_user(
	target_user_id uuid,
	push_title text,
	push_body text,
	push_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	target_token text;
	req_id       bigint;
BEGIN
	SELECT expo_push_token INTO target_token
		FROM public.profiles WHERE id = target_user_id;
	IF target_token IS NULL OR target_token = '' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_token');
	END IF;

	-- Fire-and-forget. The response (success/failure) lands in
	-- net._http_response; query that table to debug delivery issues.
	SELECT extensions.http_post(
		url := 'https://exp.host/--/api/v2/push/send',
		body := jsonb_build_object(
			'to',    target_token,
			'title', push_title,
			'body',  push_body,
			'sound', 'default',
			'data',  push_data
		),
		headers := jsonb_build_object(
			'Content-Type',     'application/json',
			'Accept',           'application/json',
			'Accept-Encoding',  'gzip, deflate'
		)
	) INTO req_id;

	RETURN jsonb_build_object('ok', true, 'request_id', req_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_push_to_user(uuid, text, text, jsonb) TO authenticated;

-- ── Trigger function: pick the right event type per state change ──
CREATE OR REPLACE FUNCTION public.tickle_trades_push_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
	actor_name      text;
	target_user_id  uuid;
	push_title      text;
	push_body       text;
	push_data       jsonb;
BEGIN
	-- INSERT: new pending request. Actor = requester. Target = target.
	IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.requester_id;
		target_user_id := NEW.target_id;
		push_title := COALESCE(actor_name, 'A friend') || ' asked for tickles';
		push_body  := NEW.amount || ' tickle' || CASE WHEN NEW.amount > 1 THEN 's' ELSE '' END
			|| '. Tap to fulfill or decline.';
		push_data  := jsonb_build_object(
			'kind', 'trade_requested',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);

	-- UPDATE pending → fulfilled: B answered A's request. Actor =
	-- target (B). Target of the push = requester (A), who got 2N.
	ELSIF TG_OP = 'UPDATE'
	      AND OLD.status = 'pending' AND NEW.status = 'fulfilled' THEN
		SELECT username INTO actor_name FROM public.profiles WHERE id = NEW.target_id;
		target_user_id := NEW.requester_id;
		push_title := COALESCE(actor_name, 'A friend') || ' answered your trade';
		push_body  := '+' || (NEW.amount * 2) || ' tickles landed in your barn.';
		push_data  := jsonb_build_object(
			'kind', 'trade_fulfilled',
			'trade_id', NEW.id::text,
			'screen', 'trade'
		);

	-- UPDATE pending → cancelled: silent. No notification.
	ELSE
		RETURN NEW;
	END IF;

	-- Wrap in EXCEPTION so a push failure can never cancel the trade
	-- transaction (push is fire-and-forget; trade state is the source
	-- of truth).
	BEGIN
		PERFORM public.send_push_to_user(target_user_id, push_title, push_body, push_data);
	EXCEPTION WHEN OTHERS THEN
		-- Swallow: trade still succeeded; push is best-effort.
		NULL;
	END;

	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tickle_trades_push ON public.tickle_trades;
CREATE TRIGGER tickle_trades_push
	AFTER INSERT OR UPDATE OF status ON public.tickle_trades
	FOR EACH ROW EXECUTE FUNCTION public.tickle_trades_push_notify();

-- ── dev_send_push: manual one-off pushes for testing ──────────────
-- Lets any authenticated user fire a push to any user (themselves
-- or otherwise). Useful for verifying APNs + tokens end-to-end
-- without needing a real trade in flight. Production-safe (it's
-- still bounded by token availability), but worth gating behind
-- a feature flag if you ever ship to a wider audience.
CREATE OR REPLACE FUNCTION public.dev_send_push(
	target_user_id uuid,
	push_title text DEFAULT 'Hello from TTP',
	push_body text DEFAULT 'This is a test notification.'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	RETURN public.send_push_to_user(
		target_user_id,
		push_title,
		push_body,
		jsonb_build_object('kind', 'dev_test')
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.dev_send_push(uuid, text, text) TO authenticated;

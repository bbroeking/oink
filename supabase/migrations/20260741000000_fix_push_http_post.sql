-- Fix: server pushes have NEVER been delivered — send_push_to_user calls
-- extensions.http_post, which does not exist. pg_net hard-codes its
-- functions into the `net` schema (the `WITH SCHEMA extensions` clause on
-- CREATE EXTENSION only moves the extension's metadata, not pg_net's
-- objects), and no migration ever installed the separate pgsql-http
-- extension that WOULD have provided extensions.http_post. So every call
-- raised "function extensions.http_post(...) does not exist" — and because
-- every caller (tickle_trades_push_notify, the six dig-off push paths)
-- correctly wraps the call in a fail-soft EXCEPTION block so a push
-- failure can never roll back game state, the error was swallowed
-- silently, 100% of the time, since 20260520050000 shipped. Players had
-- permission granted and tokens stored; nothing ever arrived.
--
-- (Why the harness never caught it: scripts/db-harness/00_stub.sql
-- replaces send_push_to_user with a push_outbox stub, so the real
-- http_post line was never executed in any smoke.)
--
-- The fix is the one-word schema correction: extensions.http_post →
-- net.http_post. The named parameters (url/body/headers) and the bigint
-- request-id return already match pg_net's real signature. Carried
-- verbatim from 20260520050000_push_delivery.sql otherwise.

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
	SELECT net.http_post(
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

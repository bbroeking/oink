CREATE EXTENSION IF NOT EXISTS dblink;

INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000761');
UPDATE public.login_gift_campaigns SET active = true WHERE campaign_key = 'halloween_2026_login_gift_v1';

DO $concurrency$
DECLARE
	u uuid := '00000000-0000-0000-0000-000000000761';
	r1 jsonb;
	r2 jsonb;
	dsn text := 'dbname=' || current_database();
BEGIN
	PERFORM dblink_connect('gift_a', dsn);
	PERFORM dblink_connect('gift_b', dsn);
	PERFORM dblink_send_query('gift_a', format(
		'WITH c AS (SELECT set_config(''request.jwt.claim.sub'', %L, false)), t AS (SELECT set_config(''ttp.fake_now'', ''2026-10-20 12:00:00+00'', false)) SELECT public.claim_halloween_login_gift(1,1) FROM c,t', u::text));
	PERFORM dblink_send_query('gift_b', format(
		'WITH c AS (SELECT set_config(''request.jwt.claim.sub'', %L, false)), t AS (SELECT set_config(''ttp.fake_now'', ''2026-10-20 12:00:00+00'', false)) SELECT public.claim_halloween_login_gift(1,1) FROM c,t', u::text));
	SELECT result INTO r1 FROM dblink_get_result('gift_a') AS x(result jsonb);
	SELECT result INTO r2 FROM dblink_get_result('gift_b') AS x(result jsonb);
	PERFORM dblink_disconnect('gift_a');
	PERFORM dblink_disconnect('gift_b');

	IF ARRAY[r1->>'status', r2->>'status'] @> ARRAY['new','replay'] IS NOT TRUE
		OR r1->'receipt'->>'receiptId' <> r2->'receipt'->>'receiptId' THEN
		RAISE EXCEPTION 'parallel claims did not converge on one receipt';
	END IF;
	IF (SELECT count(*) FROM public.login_gift_receipts WHERE user_id = u) <> 1
		OR (SELECT count(*) FROM public.owned_costume_instances WHERE user_id = u) <> 1
		OR (SELECT count(*) FROM public.user_seasonal_cards WHERE user_id = u AND quantity = 1) <> 1 THEN
		RAISE EXCEPTION 'parallel claim minted duplicate ownership';
	END IF;
END
$concurrency$;

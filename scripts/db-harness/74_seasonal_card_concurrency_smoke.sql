-- Parallel-session regression for two different grants with opposite card order.
-- Apply after 00_stub.sql + migration 20261014180000 + 73 smoke.
CREATE EXTENSION IF NOT EXISTS dblink;

INSERT INTO auth.users(id) VALUES ('00000000-0000-0000-0000-000000000741');
INSERT INTO public.hats(id) VALUES ('parallel_hat_a'), ('parallel_hat_b');
UPDATE public.seasonal_card_sets SET active = true WHERE set_key = 'halloween_2026_v1';
INSERT INTO public.seasonal_card_catalog(set_key, card_id, display_name, item_id) VALUES
	('halloween_2026_v1', 'parallel_a', 'Parallel A', 'parallel_hat_a'),
	('halloween_2026_v1', 'parallel_b', 'Parallel B', 'parallel_hat_b');
INSERT INTO public.seasonal_card_pack_grants(id, user_id, set_key, source, source_ref) VALUES
	('00000000-0000-0000-0000-000000000742', '00000000-0000-0000-0000-000000000741', 'halloween_2026_v1', 'harness', 'parallel_1'),
	('00000000-0000-0000-0000-000000000743', '00000000-0000-0000-0000-000000000741', 'halloween_2026_v1', 'harness', 'parallel_2');
INSERT INTO public.seasonal_card_pack_grant_cards(grant_id, set_key, position, card_id) VALUES
	('00000000-0000-0000-0000-000000000742', 'halloween_2026_v1', 1, 'parallel_a'),
	('00000000-0000-0000-0000-000000000742', 'halloween_2026_v1', 2, 'parallel_b'),
	('00000000-0000-0000-0000-000000000743', 'halloween_2026_v1', 1, 'parallel_b'),
	('00000000-0000-0000-0000-000000000743', 'halloween_2026_v1', 2, 'parallel_a');

DO $smoke$
DECLARE
	u uuid := '00000000-0000-0000-0000-000000000741';
	g1 uuid := '00000000-0000-0000-0000-000000000742';
	g2 uuid := '00000000-0000-0000-0000-000000000743';
	r1 jsonb;
	r2 jsonb;
	dsn text := 'dbname=' || current_database();
BEGIN
	PERFORM dblink_connect('seasonal_a', dsn);
	PERFORM dblink_connect('seasonal_b', dsn);
	PERFORM dblink_send_query('seasonal_a', format(
		'WITH a AS (SELECT set_config(''request.jwt.claim.sub'', %L, false)) SELECT public.open_seasonal_card_pack(%L::uuid) FROM a', u::text, g1::text));
	PERFORM dblink_send_query('seasonal_b', format(
		'WITH a AS (SELECT set_config(''request.jwt.claim.sub'', %L, false)) SELECT public.open_seasonal_card_pack(%L::uuid) FROM a', u::text, g2::text));
	SELECT result INTO r1 FROM dblink_get_result('seasonal_a') AS x(result jsonb);
	SELECT result INTO r2 FROM dblink_get_result('seasonal_b') AS x(result jsonb);
	PERFORM dblink_disconnect('seasonal_a');
	PERFORM dblink_disconnect('seasonal_b');

	IF r1->>'replayed' <> 'false' OR r2->>'replayed' <> 'false' THEN
		RAISE EXCEPTION 'parallel initial opening was treated as replay';
	END IF;
	IF EXISTS (
		SELECT 1 FROM (VALUES ('parallel_a'), ('parallel_b')) expected(card_id)
		WHERE (SELECT quantity FROM public.user_seasonal_cards i WHERE i.user_id = u AND i.set_key = 'halloween_2026_v1' AND i.card_id = expected.card_id) <> 2
	) THEN RAISE EXCEPTION 'parallel inventory quantity incorrect'; END IF;
	IF EXISTS (
		SELECT 1 FROM (VALUES ('parallel_a'), ('parallel_b')) expected(card_id)
		WHERE (SELECT array_agg(c.quantity_before ORDER BY c.quantity_before)
			FROM public.seasonal_card_pack_opening_cards c
			JOIN public.seasonal_card_pack_openings o ON o.id = c.opening_id
			WHERE o.user_id = u AND c.card_id = expected.card_id) <> ARRAY[0,1]
	) THEN RAISE EXCEPTION 'parallel receipts did not serialize 0->1 then 1->2'; END IF;
	IF EXISTS (
		SELECT 1 FROM (VALUES ('parallel_a'), ('parallel_b')) expected(card_id)
		WHERE (SELECT count(*) FROM public.seasonal_card_item_grants ig WHERE ig.user_id = u AND ig.card_id = expected.card_id) <> 1
	) THEN RAISE EXCEPTION 'parallel opening duplicated an item grant receipt'; END IF;
END
$smoke$;

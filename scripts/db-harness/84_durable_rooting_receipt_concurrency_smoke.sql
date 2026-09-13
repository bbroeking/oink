\set ON_ERROR_STOP on

-- True two-session overlap for the durable rooting wrapper. Connection A holds
-- the wrapper's exact advisory key while both overloads are dispatched, making
-- connection B wait until A has committed its original reward and receipt.
DO $concurrent_receipt_setup$
DECLARE
	pig uuid := '00000000-0000-0000-0000-000000084001';
	crew uuid := '00000000-0000-0000-0000-000000084010';
	opened jsonb;
BEGIN
	INSERT INTO auth.users(id) VALUES(pig) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone)
	VALUES(pig,'receipt-racer','America/New_York')
	ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone;
	INSERT INTO public.crews(id,name,leader_id,is_bot)
	VALUES(crew,'Receipt Race Crew',pig,false) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role)
	VALUES(crew,pig,'leader') ON CONFLICT DO NOTHING;
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb
	WHERE key='feeding_schedule';
	PERFORM set_config('smoke.uid',pig::text,true);
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);
	opened := public.open_rooting();
	IF NOT COALESCE((opened->>'ok')::boolean,false) THEN
		RAISE EXCEPTION 'concurrency setup open failed: %',opened;
	END IF;
END;
$concurrent_receipt_setup$;

DO $concurrent_receipt$
DECLARE
	conn text := 'host=127.0.0.1 dbname=postgres user=postgres password=postgres options=-cstatement_timeout=5000';
	pig uuid := '00000000-0000-0000-0000-000000084001';
	win bigint;
	seed_value int;
	first_result jsonb;
	retry_result jsonb;
	finds text[];
	before_counter bigint;
	after_counter bigint;
BEGIN
	SELECT window_index,seed INTO win,seed_value FROM public.war_rootings
	WHERE user_id=pig AND submitted_at IS NULL;
	SELECT public.rooting_finds(seed_value) INTO finds;
	SELECT golden_truffles INTO before_counter FROM public.profiles WHERE id=pig;

	PERFORM dblink_connect('receipt_a',conn);
	PERFORM dblink_connect('receipt_b',conn);
	PERFORM dblink_exec('receipt_a','SET smoke.uid='''||pig||'''');
	PERFORM dblink_exec('receipt_b','SET smoke.uid='''||pig||'''');
	PERFORM dblink_exec('receipt_a','SET ttp.fake_now=''2026-07-16 12:01+00''');
	PERFORM dblink_exec('receipt_b','SET ttp.fake_now=''2026-07-16 12:01+00''');

	-- Hold the same transaction-scoped key used by submit_rooting, then dispatch
	-- both overloads on independent server sessions before releasing it.
	PERFORM dblink_exec('receipt_a','BEGIN');
	PERFORM dblink_send_query(
		'receipt_a',
		'SELECT pg_advisory_xact_lock(hashtextextended('''||pig||':'||win||''',0)) IS NULL'
	);
	PERFORM locked FROM dblink_get_result('receipt_a') x(locked boolean);
	PERFORM locked FROM dblink_get_result('receipt_a') x(locked boolean);
	PERFORM dblink_send_query(
		'receipt_a',
		'SELECT public.submit_rooting('''||finds::text||'''::text[],20,ARRAY[]::text[])'
	);
	PERFORM dblink_send_query(
		'receipt_b',
		'SELECT public.submit_rooting(ARRAY[]::text[],0)'
	);
	SELECT data INTO first_result FROM dblink_get_result('receipt_a') x(data jsonb);
	PERFORM data FROM dblink_get_result('receipt_a') x(data jsonb);
	PERFORM dblink_exec('receipt_a','COMMIT');
	SELECT data INTO retry_result FROM dblink_get_result('receipt_b') x(data jsonb);
	PERFORM data FROM dblink_get_result('receipt_b') x(data jsonb);

	IF first_result IS DISTINCT FROM retry_result THEN
		RAISE EXCEPTION 'overlapping overloads returned different receipts: % %',first_result,retry_result;
	END IF;
	IF (SELECT count(*) FROM public.rooting_receipts WHERE user_id=pig AND window_index=win)<>1 THEN
		RAISE EXCEPTION 'overlap wrote other than one receipt: first %, retry %, rows %',first_result,retry_result,(SELECT count(*) FROM public.rooting_receipts WHERE user_id=pig AND window_index=win);
	END IF;
	IF (SELECT count(*) FROM public.war_rootings WHERE user_id=pig AND window_index=win AND submitted_at IS NOT NULL)<>1 THEN
		RAISE EXCEPTION 'overlap submitted rooting other than once';
	END IF;
	IF (SELECT count(*) FROM public.race_digs WHERE user_id=pig AND window_index=win)<>1 THEN
		RAISE EXCEPTION 'overlap wrote race reward ledger other than once';
	END IF;
	SELECT golden_truffles INTO after_counter FROM public.profiles WHERE id=pig;
	IF after_counter-before_counter IS DISTINCT FROM COALESCE((first_result->>'truffles')::bigint,0) THEN
		RAISE EXCEPTION 'currency reward duplicated: before %, after %, receipt %',before_counter,after_counter,first_result;
	END IF;

	PERFORM dblink_disconnect('receipt_a');
	PERFORM dblink_disconnect('receipt_b');
	RAISE NOTICE 'chk durable rooting receipt concurrency: overlapping 3arg + 2arg share one receipt and reward';
END;
$concurrent_receipt$;

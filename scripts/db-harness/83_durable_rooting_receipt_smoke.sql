\set ON_ERROR_STOP on

DO $durable_receipt$
DECLARE
	pig uuid:='00000000-0000-0000-0000-000000083001';
	crew uuid:='00000000-0000-0000-0000-000000083010';
	opened jsonb; first_result jsonb; retry_result jsonb; recovered jsonb; rejected jsonb; win bigint;
BEGIN
	INSERT INTO auth.users(id) VALUES(pig) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles(id,username,feeding_time_zone)
	VALUES(pig,'receipt-pig','America/New_York') ON CONFLICT(id) DO UPDATE SET feeding_time_zone=EXCLUDED.feeding_time_zone;
	INSERT INTO public.crews(id,name,leader_id,is_bot) VALUES(crew,'Receipt Crew',pig,false) ON CONFLICT DO NOTHING;
	INSERT INTO public.crew_members(crew_id,user_id,role) VALUES(crew,pig,'leader') ON CONFLICT DO NOTHING;
	UPDATE public.app_settings SET value='{"mode":"commuter_local"}'::jsonb WHERE key='feeding_schedule';
	PERFORM set_config('smoke.uid',pig::text,true);
	PERFORM set_config('ttp.fake_now','2026-07-16 12:01+00',true);
	opened:=public.open_rooting(); win:=(opened->>'window_index')::bigint;
	IF NOT (opened->>'ok')::boolean THEN RAISE EXCEPTION 'receipt open failed: %',opened; END IF;
	rejected:=public.submit_rooting_checked('00000000-0000-0000-0000-000000083099',win,ARRAY[]::text[],0,ARRAY[]::text[]);
	IF (rejected->>'reason')<>'account_changed' THEN RAISE EXCEPTION 'checked submit accepted wrong owner: %',rejected; END IF;
	rejected:=public.submit_rooting_checked(pig,win+1,ARRAY[]::text[],0,ARRAY[]::text[]);
	IF (rejected->>'reason')<>'window_changed' THEN RAISE EXCEPTION 'checked submit accepted wrong window: %',rejected; END IF;
	IF EXISTS(SELECT 1 FROM public.race_digs WHERE user_id=pig AND window_index IN(win,win+1)) THEN
		RAISE EXCEPTION 'checked mismatch minted a reward';
	END IF;
	first_result:=public.submit_rooting_checked(pig,win,ARRAY[]::text[],0,ARRAY[]::text[]);
	IF NOT (first_result->>'ok')::boolean THEN RAISE EXCEPTION 'receipt submit failed: %',first_result; END IF;
	IF (SELECT count(*) FROM public.rooting_receipts WHERE user_id=pig AND window_index=win)<>1 THEN
		RAISE EXCEPTION 'atomic receipt missing';
	END IF;
	retry_result:=public.submit_rooting(ARRAY['truffle_l']::text[],20,ARRAY[]::text[]);
	IF retry_result IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'duplicate did not return original receipt'; END IF;
	retry_result:=public.submit_rooting(ARRAY['truffle_d']::text[],20);
	IF retry_result IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'legacy two-arg submit bypassed receipt'; END IF;
	IF (SELECT count(*) FROM public.race_digs WHERE user_id=pig AND window_index=win)<>1 THEN
		RAISE EXCEPTION 'duplicate submit changed race ledger';
	END IF;
	PERFORM set_config('ttp.fake_now','2026-07-16 20:01+00',true);
	recovered:=public.rooting_receipt(win);
	IF recovered IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'receipt not recoverable after rollover'; END IF;
	recovered:=public.submit_rooting_checked(pig,win,ARRAY['truffle_l']::text[],20,ARRAY[]::text[]);
	IF recovered IS DISTINCT FROM first_result THEN RAISE EXCEPTION 'checked historical retry did not return receipt'; END IF;
	IF (public.rooting_receipt(win+99)->>'reason')<>'no_receipt' THEN RAISE EXCEPTION 'missing receipt response wrong'; END IF;
	PERFORM set_config('smoke.uid','00000000-0000-0000-0000-000000082002',true);
	IF (public.rooting_receipt(win)->>'reason')<>'no_receipt' THEN RAISE EXCEPTION 'receipt leaked across accounts'; END IF;
	RAISE NOTICE 'chk durable rooting receipt: checked owner/window + atomic retry + rollover isolation OK';
END;
$durable_receipt$;

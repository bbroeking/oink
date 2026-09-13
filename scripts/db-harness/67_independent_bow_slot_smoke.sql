-- Independent Hat/Bow persistence smoke
-- (20260826030000_independent_bow_slot.sql).

\set ON_ERROR_STOP on

DO $independent_bow_slot$
DECLARE
	player uuid := '00000000-0000-0000-0000-000000067001';
	res jsonb;
	hat_value text;
	bow_value text;
	home_definition text;
BEGIN
	SELECT active_hat_id, active_bow_id
	INTO hat_value, bow_value
	FROM public.profiles WHERE id = player;
	IF hat_value IS NOT NULL OR bow_value <> 'bow_slot_legacy' THEN
		RAISE EXCEPTION 'bow slot: legacy wearer was not preserved: hat %, bow %',
			hat_value, bow_value;
	END IF;

	PERFORM set_config('smoke.uid', player::text, true);
	res := public.equip_cosmetic('bow_slot_hat');
	IF NOT (res->>'ok')::boolean
		OR res->'update'->>'active_hat_id' <> 'bow_slot_hat' THEN
		RAISE EXCEPTION 'bow slot: hat equip failed: %', res;
	END IF;
	SELECT active_hat_id, active_bow_id
	INTO hat_value, bow_value
	FROM public.profiles WHERE id = player;
	IF hat_value <> 'bow_slot_hat' OR bow_value <> 'bow_slot_legacy' THEN
		RAISE EXCEPTION 'bow slot: hat equip changed bow: hat %, bow %',
			hat_value, bow_value;
	END IF;

	res := public.equip_cosmetic('bow_slot_fresh');
	IF NOT (res->>'ok')::boolean
		OR res->'update'->>'active_bow_id' <> 'bow_slot_fresh' THEN
		RAISE EXCEPTION 'bow slot: bow equip failed: %', res;
	END IF;
	SELECT active_hat_id, active_bow_id
	INTO hat_value, bow_value
	FROM public.profiles WHERE id = player;
	IF hat_value <> 'bow_slot_hat' OR bow_value <> 'bow_slot_fresh' THEN
		RAISE EXCEPTION 'bow slot: bow equip changed hat: hat %, bow %',
			hat_value, bow_value;
	END IF;

	res := public.equip_cosmetic(NULL, 'bow');
	SELECT active_hat_id, active_bow_id
	INTO hat_value, bow_value
	FROM public.profiles WHERE id = player;
	IF NOT (res->>'ok')::boolean
		OR res->'update'->'active_bow_id' <> 'null'::jsonb
		OR hat_value <> 'bow_slot_hat'
		OR bow_value IS NOT NULL THEN
		RAISE EXCEPTION 'bow slot: independent unequip failed: % / hat %, bow %',
			res, hat_value, bow_value;
	END IF;

	SELECT pg_get_functiondef('public.home_stats()'::regprocedure)
	INTO home_definition;
	IF position('active_bow_id' IN home_definition) = 0
		OR position('active_bow' IN home_definition) = 0 THEN
		RAISE EXCEPTION 'bow slot: home_stats omits the Bow payload';
	END IF;

	IF has_function_privilege('anon', 'public.equip_cosmetic(text,text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'bow slot: anon can execute equip_cosmetic';
	END IF;

	RAISE NOTICE 'chk independent_bow_slot: migration + equip + clear + payload OK';
END;
$independent_bow_slot$;

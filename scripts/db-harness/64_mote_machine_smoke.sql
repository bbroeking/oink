-- Functional Mote Machine smoke: historical backfill, future shimmer credit,
-- exact single-Mote debit, Tickle-bank grant, and idempotent replay.
\set ON_ERROR_STOP on

DO $smoke_mote_machine$
DECLARE
	digger uuid := '00000000-0000-0000-0000-000000063002';
	digger_crew uuid;
	res jsonb;
	reward int;
	bank_before int;
	spins int;
BEGIN
	SELECT crew_id INTO digger_crew
	FROM public.war_rootings
	WHERE user_id = digger
	LIMIT 1;

	INSERT INTO public.user_items (user_id, item_count)
	VALUES (digger, 7)
	ON CONFLICT (user_id) DO UPDATE SET item_count = EXCLUDED.item_count;

	PERFORM set_config('smoke.uid', digger::text, true);
	res := public.mote_machine_state();
	IF NOT (res->>'ok')::boolean OR (res->>'motes')::int <> 1 THEN
		RAISE EXCEPTION 'mote machine: historical shimmer should backfill one Mote, got %', res;
	END IF;

	SELECT item_count INTO bank_before FROM public.user_items WHERE user_id = digger;
	res := public.spin_mote_machine('smoke-request-one', 2, 1, 0);
	reward := (res->>'reward_tickles')::int;
	IF NOT (res->>'ok')::boolean
		OR reward NOT IN (0, 3, 5, 10, 25)
		OR (res->>'warmth')::int <> 2
		OR (res->>'whirl')::int <> 1
		OR (res->>'resonance')::int <> 0
		OR (res->>'motes_remaining')::int <> 0
		OR (res->>'tickles_balance')::int <> bank_before + reward
		OR (res->>'replayed')::boolean THEN
		RAISE EXCEPTION 'mote machine: first confirmed spin is wrong, got %', res;
	END IF;

	-- Same request returns the durable receipt without another debit or grant.
	res := public.spin_mote_machine('smoke-request-one', 2, 1, 0);
	IF NOT (res->>'ok')::boolean
		OR (res->>'reward_tickles')::int <> reward
		OR NOT (res->>'replayed')::boolean THEN
		RAISE EXCEPTION 'mote machine: idempotent replay changed the result, got %', res;
	END IF;
	SELECT count(*)::int INTO spins
	FROM public.mote_machine_spins
	WHERE user_id = digger;
	IF spins <> 1 THEN
		RAISE EXCEPTION 'mote machine: replay minted % receipts instead of one', spins;
	END IF;

	res := public.spin_mote_machine('smoke-request-empty', 0, 0, 0);
	IF (res->>'reason') <> 'no_motes' THEN
		RAISE EXCEPTION 'mote machine: empty wallet should refuse, got %', res;
	END IF;

	-- A newly submitted shimmer credits exactly one fresh Mote through the
	-- rooting trigger. Rewriting the timestamp cannot credit it twice.
	INSERT INTO public.war_rootings (
		user_id, crew_id, window_index, seed, dig_day, opened_at
	) VALUES (
		digger, digger_crew, 64001, 7, current_date, now()
	);
	UPDATE public.war_rootings
	SET submitted_at = now(), finds = ARRAY['shimmer'], credited_finds = 1
	WHERE user_id = digger AND window_index = 64001;
	UPDATE public.war_rootings
	SET submitted_at = submitted_at
	WHERE user_id = digger AND window_index = 64001;

	res := public.mote_machine_state();
	IF (res->>'motes')::int <> 1 THEN
		RAISE EXCEPTION 'mote machine: future shimmer should credit exactly one Mote, got %', res;
	END IF;

	RAISE NOTICE 'chk mote_machine: backfill + exact debit + Tickles + idempotency OK';
END $smoke_mote_machine$;

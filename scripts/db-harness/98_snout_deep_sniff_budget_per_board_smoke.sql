-- 98 — the sniff budget per board (20260917150000_snout_deep_sniff_budget_per_board.sql).
-- The 4-arg threshold is unchanged (97 pins it); the carried core now resets
-- its running sniff count when the layer changes, so five sniffs come back on
-- every board.
\echo chk 98 snout deep sniff budget per board
DO $$
DECLARE
	body text := (SELECT prosrc FROM pg_proc WHERE proname = '_submit_rooting_deep_core');
BEGIN
	IF (SELECT count(*) FROM pg_proc WHERE proname = '_submit_rooting_deep_core') <> 1 THEN
		RAISE EXCEPTION 'expected one core'; END IF;
	-- the count still feeds the 4-arg threshold …
	IF position('thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);' IN body) = 0 THEN
		RAISE EXCEPTION 'the core does not count sniffs'; END IF;
	-- … and resets when the layer changes, BEFORE the threshold is read
	IF position('IF lyr <> sniff_layer THEN prior_sniffs := 0; sniff_layer := lyr; END IF;' IN body) = 0 THEN
		RAISE EXCEPTION 'the core does not refill the budget on descent'; END IF;
	IF position('IF lyr <> sniff_layer THEN' IN body) > position('thr := public._snout_deep_wake_threshold(lyr, verb, row_r.coop_at_open, prior_sniffs);' IN body) THEN
		RAISE EXCEPTION 'the reset comes after the threshold read'; END IF;
	-- the threshold table did not drift with the carry
	IF public._snout_deep_wake_threshold(0,'s',false,5) <> 1 OR public._snout_deep_wake_threshold(1,'s',false,0) <> 3 THEN
		RAISE EXCEPTION 'threshold drifted'; END IF;
	RAISE NOTICE 'chk 98 ok: core counts sniffs per layer, reset before the read, threshold unchanged';
END $$;

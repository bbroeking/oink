-- 97 — the sniff budget (20260917130000_snout_deep_sniff_attention.sql).
-- The 4-arg threshold: inside the budget the base; past it +1 per extra
-- sniff, capped at the layer's shove; rub and shove untouched; co-op's
-- halved root sniff still takes attention on top.
\echo chk 97 snout deep sniff attention
DO $$
BEGIN
	-- topsoil: five free, then 1, 2, 3 … up to the shove's 10
	IF public._snout_deep_wake_threshold(0,'s',false,0) <> 0
	OR public._snout_deep_wake_threshold(0,'s',false,4) <> 0
	OR public._snout_deep_wake_threshold(0,'s',false,5) <> 1
	OR public._snout_deep_wake_threshold(0,'s',false,6) <> 2
	OR public._snout_deep_wake_threshold(0,'s',false,14) <> 10
	OR public._snout_deep_wake_threshold(0,'s',false,40) <> 10 THEN
		RAISE EXCEPTION 'topsoil sniff attention wrong: % % % % % %',
			public._snout_deep_wake_threshold(0,'s',false,0), public._snout_deep_wake_threshold(0,'s',false,4),
			public._snout_deep_wake_threshold(0,'s',false,5), public._snout_deep_wake_threshold(0,'s',false,6),
			public._snout_deep_wake_threshold(0,'s',false,14), public._snout_deep_wake_threshold(0,'s',false,40); END IF;
	-- the mud and the root: base + attention, capped at the shove
	IF public._snout_deep_wake_threshold(1,'s',false,5) <> 4
	OR public._snout_deep_wake_threshold(1,'s',false,30) <> 20
	OR public._snout_deep_wake_threshold(2,'s',false,7) <> 10
	OR public._snout_deep_wake_threshold(2,'s',true,5) <> 5 THEN
		RAISE EXCEPTION 'deeper sniff attention wrong'; END IF;
	-- rub and shove never take attention; NULL counts as none
	IF public._snout_deep_wake_threshold(0,'r',false,40) <> 1
	OR public._snout_deep_wake_threshold(2,'h',false,40) <> 40
	OR public._snout_deep_wake_threshold(0,'s',false,NULL) <> 0 THEN
		RAISE EXCEPTION 'rub/shove/NULL wrong'; END IF;
	-- the 3-arg base still answers the table (harness 87 pins it too)
	IF public._snout_deep_wake_threshold(0,'s',false) <> 0 OR public._snout_deep_wake_threshold(2,'r',true) <> 8 THEN
		RAISE EXCEPTION 'base threshold drifted'; END IF;
	-- the carried core reads the 4-arg call with a running sniff count
	IF (SELECT count(*) FROM pg_proc WHERE proname = '_submit_rooting_deep_core') <> 1 THEN
		RAISE EXCEPTION 'expected one core'; END IF;
	IF position('prior_sniffs' IN (SELECT prosrc FROM pg_proc WHERE proname = '_submit_rooting_deep_core')) = 0 THEN
		RAISE EXCEPTION 'the core does not count sniffs'; END IF;
	RAISE NOTICE 'chk 97 ok: budget 5, +1 per extra sniff, capped at shove, rub/shove untouched, core counts sniffs';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROOTING_FINDS SHIMMER CAST — fix the real 22P02 "malformed array literal"
--
-- WHY: in PL/pgSQL, `finds || 'shimmer'` resolves the untyped literal via the
-- anyarray||anyarray overload and tries to PARSE 'shimmer' as an array literal
-- → 22P02 on EVERY seed that rolls a shimmer (50% of boards, draw 3 of the
-- minstd stream). The junk line survives only because its CASE expression
-- types the value to text, which resolves anyarray||anyelement instead.
--
-- HISTORY: this error was live since 20260704100000 and was misdiagnosed as a
-- client transport bug ("a bare shimmer string reached PostgREST") — the
-- client-side pouch normalizer (utils/rooting.ts normalizePouch, kept) never
-- touched the real fault. The db-harness masked it too: 20260704100000 isn't
-- in the harness chain, and 00_stub.sql's copy was exercised with fixed
-- boards. Found live on-device 2026-07-07 (submit_rooting → rooting_finds
-- line 14).
--
-- PARITY: output is byte-identical to before for seeds without a shimmer and
-- to the CLIENT's generateBoard (utils/rooting.ts) for all seeds — this is a
-- type-resolution fix, not a logic change. MUST stay in lockstep with
-- generateBoard's find list.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rooting_finds(p_seed int)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
	state   bigint := p_seed;
	orient  int;   -- draw 1 (layout-only, but consumes the stream)
	vert    int;   -- draw 2 (layout-only)
	shimmer int;   -- draw 3
	junk    int;   -- draw 4
	finds   text[] := ARRAY['truffle_l', 'truffle_d'];
BEGIN
	state := (state * 16807) % 2147483647; orient  := (state % 4)::int;
	state := (state * 16807) % 2147483647; vert    := (state % 2)::int;
	state := (state * 16807) % 2147483647; shimmer := (state % 2)::int;
	state := (state * 16807) % 2147483647; junk    := (state % 2)::int;
	-- ::text cast is THE fix — see header. Never append an untyped literal to
	-- a text[] in PL/pgSQL.
	IF shimmer = 1 THEN finds := finds || 'shimmer'::text; END IF;
	finds := finds || (CASE junk WHEN 0 THEN 'junk_boot' ELSE 'junk_wrap' END);
	RETURN finds;
END;
$$;

-- Sanity: the function must run clean across seeds and produce shimmers on
-- roughly half of them (this raises if the 22P02 ever regresses).
DO $$
DECLARE
	s int;
	with_shimmer int := 0;
	f text[];
BEGIN
	FOR s IN 1..32 LOOP
		f := public.rooting_finds(s);
		IF 'shimmer' = ANY (f) THEN with_shimmer := with_shimmer + 1; END IF;
	END LOOP;
	IF with_shimmer = 0 OR with_shimmer = 32 THEN
		RAISE EXCEPTION 'rooting_finds shimmer distribution looks wrong: %/32', with_shimmer;
	END IF;
END;
$$;

-- Pair bonds — the friendship-as-mechanics ledger made VISIBLE and RANKED.
-- For every unordered pair of players we accumulate lifetime counts of the
-- three "bond" actions (trades fulfilled, blessings sent, barn visits) and
-- surface a global "Strongest Pairs" board plus a per-friend keepsake read.
--
-- The bond is the SUM of the three friendship acts. Curses are deliberately
-- EXCLUDED — mischief isn't bond. System blessings (the war_winner_regen /
-- chorus_glow self-rows the herd grants itself) are excluded too: a bond is
-- one pig doing something FOR another specific pig.
--
-- Canonical pair: (user_a, user_b) with CHECK user_a < user_b, so a bond
-- between two pigs lands on ONE row no matter which direction the action ran.
-- Every bump routes through bump_pair_bond(a, b, col) which orders the pair
-- before touching the table, so the trigger callers never think about order.
--
-- Maintenance is trigger-driven and FAIL-SOFT: a bond bump must NEVER break
-- the underlying action (a trade fulfillment, a blessing, a visit). Each
-- trigger body is wrapped BEGIN...EXCEPTION WHEN OTHERS THEN NULL, so a bond
-- write that trips (bad state, a future column rename) is swallowed and the
-- real action still commits.

-- ── Ledger table ───────────────────────────────────────────────────
-- bond is a STORED generated column (trades + blessings + visits) so the
-- board can order on it directly with a plain index and never drift from the
-- three components. PK is the canonical pair; RLS on, zero policies — the
-- table is reached only through the SECURITY DEFINER RPCs below.
CREATE TABLE IF NOT EXISTS public.pair_bonds (
	user_a     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	user_b     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	trades     int  NOT NULL DEFAULT 0,
	blessings  int  NOT NULL DEFAULT 0,
	visits     int  NOT NULL DEFAULT 0,
	bond       int  GENERATED ALWAYS AS (trades + blessings + visits) STORED,
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_a, user_b),
	CHECK (user_a < user_b)
);

-- The board orders by bond DESC; a plain descending index carries the top-N
-- scan. Tie-break on the pair keys stays deterministic via the PK.
CREATE INDEX IF NOT EXISTS pair_bonds_bond_desc_idx
	ON public.pair_bonds (bond DESC);

ALTER TABLE public.pair_bonds ENABLE ROW LEVEL SECURITY;
-- No policies: RPC-only. The definer functions below are the sole readers.

-- ── The single bump path ───────────────────────────────────────────
-- Canonicalizes the pair (a < b), then upserts +1 into the named component
-- column. p_col is one of 'trades' | 'blessings' | 'visits'. A self-pair or
-- a null side is a no-op. updated_at is refreshed on every bump.
CREATE OR REPLACE FUNCTION public.bump_pair_bond(
	p_x uuid, p_y uuid, p_col text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	lo uuid;
	hi uuid;
BEGIN
	IF p_x IS NULL OR p_y IS NULL OR p_x = p_y THEN
		RETURN;
	END IF;
	IF p_x < p_y THEN lo := p_x; hi := p_y; ELSE lo := p_y; hi := p_x; END IF;

	-- One statement per component so the +1 lands on the right column without
	-- dynamic SQL. The generated `bond` recomputes automatically.
	IF p_col = 'trades' THEN
		INSERT INTO public.pair_bonds (user_a, user_b, trades)
			VALUES (lo, hi, 1)
			ON CONFLICT (user_a, user_b) DO UPDATE
			SET trades = public.pair_bonds.trades + 1, updated_at = now();
	ELSIF p_col = 'blessings' THEN
		INSERT INTO public.pair_bonds (user_a, user_b, blessings)
			VALUES (lo, hi, 1)
			ON CONFLICT (user_a, user_b) DO UPDATE
			SET blessings = public.pair_bonds.blessings + 1, updated_at = now();
	ELSIF p_col = 'visits' THEN
		INSERT INTO public.pair_bonds (user_a, user_b, visits)
			VALUES (lo, hi, 1)
			ON CONFLICT (user_a, user_b) DO UPDATE
			SET visits = public.pair_bonds.visits + 1, updated_at = now();
	END IF;
END;
$function$;

-- ── Triggers (fail-soft) ────────────────────────────────────────────
-- Trades: a trade "counts" once, when it flips pending → fulfilled. Fires on
-- that transition only. The pair is (requester_id, target_id).
CREATE OR REPLACE FUNCTION public.pair_bond_on_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		IF OLD.status = 'pending' AND NEW.status = 'fulfilled' THEN
			PERFORM public.bump_pair_bond(NEW.requester_id, NEW.target_id, 'trades');
		END IF;
	EXCEPTION WHEN OTHERS THEN
		-- A bond bump must never break a trade fulfillment.
		NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pair_bond_trade_trig ON public.tickle_trades;
CREATE TRIGGER pair_bond_trade_trig
	AFTER UPDATE OF status ON public.tickle_trades
	FOR EACH ROW
	WHEN (OLD.status = 'pending' AND NEW.status = 'fulfilled')
	EXECUTE FUNCTION public.pair_bond_on_trade();

-- Blessings: one bond per real player-to-player blessing. Excludes the
-- system self-rows (war_winner_regen / chorus_glow have sender_id = receiver_id).
-- sender_id is NOT NULL in prod; the null guard is defensive.
CREATE OR REPLACE FUNCTION public.pair_bond_on_blessing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		IF NEW.sender_id IS NOT NULL AND NEW.sender_id <> NEW.receiver_id THEN
			PERFORM public.bump_pair_bond(NEW.sender_id, NEW.receiver_id, 'blessings');
		END IF;
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pair_bond_blessing_trig ON public.blessings;
CREATE TRIGGER pair_bond_blessing_trig
	AFTER INSERT ON public.blessings
	FOR EACH ROW
	EXECUTE FUNCTION public.pair_bond_on_blessing();

-- Barn visits: one bond per visit session. In the current model each
-- tickle_at_barn call inserts exactly one barn_visits row (visit_cap = 1),
-- and the 24h pairwise lock means one row per pair per day — so one INSERT is
-- one countable visit session. The pair is (visitor_id, target_id).
CREATE OR REPLACE FUNCTION public.pair_bond_on_visit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	BEGIN
		PERFORM public.bump_pair_bond(NEW.visitor_id, NEW.target_id, 'visits');
	EXCEPTION WHEN OTHERS THEN
		NULL;
	END;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS pair_bond_visit_trig ON public.barn_visits;
CREATE TRIGGER pair_bond_visit_trig
	AFTER INSERT ON public.barn_visits
	FOR EACH ROW
	EXECUTE FUNCTION public.pair_bond_on_visit();

-- ── One-time backfill from history ──────────────────────────────────
-- Seed the ledger from every durable historical record so the board opens
-- reflecting the friendships that already exist, not a cold zero.
--   trades   — fulfilled tickle_trades rows, canonicalized + counted per pair.
--   blessings— every player-to-player blessing (sender <> receiver), which
--              already excludes the system self-rows.
--   visits   — every barn_visits row (each row is one visit session).
-- Each source is aggregated to per-pair counts, then merged. Wrapped so a
-- backfill hiccup can't fail the whole migration — the ledger simply starts
-- counting live from the triggers above.
DO $backfill$
BEGIN
	WITH canon AS (
		-- Trades: canonical pair + count of fulfilled rows.
		SELECT
			LEAST(requester_id, target_id)    AS ua,
			GREATEST(requester_id, target_id) AS ub,
			count(*)::int AS n_trades,
			0::int AS n_blessings,
			0::int AS n_visits
		FROM public.tickle_trades
		WHERE status = 'fulfilled'
		  AND requester_id IS NOT NULL AND target_id IS NOT NULL
		  AND requester_id <> target_id
		GROUP BY 1, 2

		UNION ALL

		-- Blessings: real player-to-player rows only.
		SELECT
			LEAST(sender_id, receiver_id),
			GREATEST(sender_id, receiver_id),
			0, count(*)::int, 0
		FROM public.blessings
		WHERE sender_id IS NOT NULL AND receiver_id IS NOT NULL
		  AND sender_id <> receiver_id
		GROUP BY 1, 2

		UNION ALL

		-- Visits: one bond per visit-ledger row.
		SELECT
			LEAST(visitor_id, target_id),
			GREATEST(visitor_id, target_id),
			0, 0, count(*)::int
		FROM public.barn_visits
		WHERE visitor_id IS NOT NULL AND target_id IS NOT NULL
		  AND visitor_id <> target_id
		GROUP BY 1, 2
	),
	rolled AS (
		SELECT ua, ub,
			sum(n_trades)::int    AS trades,
			sum(n_blessings)::int AS blessings,
			sum(n_visits)::int    AS visits
		FROM canon
		GROUP BY ua, ub
	)
	INSERT INTO public.pair_bonds (user_a, user_b, trades, blessings, visits)
	SELECT ua, ub, trades, blessings, visits FROM rolled
	ON CONFLICT (user_a, user_b) DO UPDATE
	SET trades    = EXCLUDED.trades,
	    blessings = EXCLUDED.blessings,
	    visits    = EXCLUDED.visits,
	    updated_at = now();
EXCEPTION WHEN OTHERS THEN
	-- If any source table isn't shaped as expected, the ledger just starts
	-- counting live. The board is never worse than empty.
	NULL;
END;
$backfill$;

-- ── RPC: the Strongest Pairs board ─────────────────────────────────
-- Top pairs by bond DESC with both usernames, the per-action breakdown, a
-- 1..N rank, and an is_self flag when the caller is in the pair. When the
-- caller's OWN best pair falls outside the returned top slice, it's appended
-- as the trailing "you" row (is_self true, its true global rank) so the
-- player always sees where their strongest bond sits.
CREATE OR REPLACE FUNCTION public.pair_leaderboard(p_limit int DEFAULT 25)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_limit   int  := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
	v_rows    jsonb;
	v_you     jsonb;
	v_in_top  boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Global ranking. bond DESC, then the pair keys for a stable tie-break so
	-- the rank is deterministic across calls (and paging never repeats a pair).
	WITH ranked AS (
		SELECT
			pb.user_a, pb.user_b,
			pb.trades, pb.blessings, pb.visits, pb.bond,
			row_number() OVER (ORDER BY pb.bond DESC, pb.user_a, pb.user_b) AS rnk
		FROM public.pair_bonds pb
		WHERE pb.bond > 0
	),
	top AS (
		SELECT * FROM ranked WHERE rnk <= v_limit
	)
	SELECT jsonb_agg(
		jsonb_build_object(
			'rank', t.rnk,
			'user_a', t.user_a,
			'user_b', t.user_b,
			'name_a', pa.username,
			'name_b', pb2.username,
			'trades', t.trades,
			'blessings', t.blessings,
			'visits', t.visits,
			'bond', t.bond,
			'is_self', (caller_id = t.user_a OR caller_id = t.user_b)
		)
		ORDER BY t.rnk
	)
	INTO v_rows
	FROM top t
	JOIN public.profiles pa  ON pa.id  = t.user_a
	JOIN public.profiles pb2 ON pb2.id = t.user_b;

	-- Is the caller already visible in the returned slice? If so, no extra row.
	SELECT EXISTS (
		SELECT 1 FROM jsonb_array_elements(COALESCE(v_rows, '[]'::jsonb)) e
		WHERE (e->>'is_self')::boolean
	) INTO v_in_top;

	-- The caller's OWN best pair + its true global rank, for the trailing
	-- "you" row when it's outside the top slice.
	IF NOT v_in_top THEN
		WITH ranked AS (
			SELECT
				pb.user_a, pb.user_b,
				pb.trades, pb.blessings, pb.visits, pb.bond,
				row_number() OVER (ORDER BY pb.bond DESC, pb.user_a, pb.user_b) AS rnk
			FROM public.pair_bonds pb
			WHERE pb.bond > 0
		),
		mine AS (
			SELECT * FROM ranked
			WHERE user_a = caller_id OR user_b = caller_id
			ORDER BY rnk
			LIMIT 1
		)
		SELECT jsonb_build_object(
			'rank', m.rnk,
			'user_a', m.user_a,
			'user_b', m.user_b,
			'name_a', pa.username,
			'name_b', pb2.username,
			'trades', m.trades,
			'blessings', m.blessings,
			'visits', m.visits,
			'bond', m.bond,
			'is_self', true
		)
		INTO v_you
		FROM mine m
		JOIN public.profiles pa  ON pa.id  = m.user_a
		JOIN public.profiles pb2 ON pb2.id = m.user_b;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'pairs', COALESCE(v_rows, '[]'::jsonb),
		'you', v_you  -- null when the caller is in the top slice or has no bond
	);
END;
$function$;

-- ── RPC: the keepsake read ──────────────────────────────────────────
-- The caller's bond with ONE friend: {trades, blessings, visits, bond}, all
-- zeros when no row exists yet. Canonicalizes the pair before the lookup so
-- the order the caller passes never matters.
CREATE OR REPLACE FUNCTION public.pair_bond_with(p_other uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	lo uuid;
	hi uuid;
	v_row public.pair_bonds%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_other IS NULL OR p_other = caller_id THEN
		RETURN jsonb_build_object('ok', true, 'trades', 0, 'blessings', 0, 'visits', 0, 'bond', 0);
	END IF;

	IF caller_id < p_other THEN lo := caller_id; hi := p_other;
	ELSE lo := p_other; hi := caller_id; END IF;

	SELECT * INTO v_row FROM public.pair_bonds
	WHERE user_a = lo AND user_b = hi;

	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', true, 'trades', 0, 'blessings', 0, 'visits', 0, 'bond', 0);
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'trades', v_row.trades,
		'blessings', v_row.blessings,
		'visits', v_row.visits,
		'bond', v_row.bond
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.pair_leaderboard(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pair_bond_with(uuid) TO authenticated;

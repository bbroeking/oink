-- Porch Round — an additive scrapbook over successful Barn visits.
-- Authored for review; do not push without Brian's explicit "go".
--
-- Stops have no expiry, reward, currency, or client-writable table policy.
-- A constrained RPC verifies the latest successful barn_visits row, then keeps
-- that visit once. Three distinct pigs finish a page; a partial page simply
-- remains a warm record and can be continued on any later day.

CREATE TABLE public.porch_round_stops (
	id bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_started_at timestamptz NOT NULL,
	page_number int NOT NULL CHECK (page_number >= 1),
	stop_number int NOT NULL CHECK (stop_number BETWEEN 1 AND 3),
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT porch_round_stops_not_self CHECK (visitor_id <> target_id),
	CONSTRAINT porch_round_stops_one_per_visit
		UNIQUE (visitor_id, target_id, visit_started_at),
	CONSTRAINT porch_round_stops_one_slot
		UNIQUE (visitor_id, page_number, stop_number),
	CONSTRAINT porch_round_stops_distinct_pig_per_page
		UNIQUE (visitor_id, page_number, target_id)
);

CREATE INDEX porch_round_stops_visitor_page_idx
	ON public.porch_round_stops (visitor_id, page_number DESC, stop_number);

ALTER TABLE public.porch_round_stops ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.porch_round_stops FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.porch_round_stops_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_porch_stop(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_start timestamptz;
	existing public.porch_round_stops%ROWTYPE;
	last_page int;
	last_stop int;
	next_page int;
	next_stop int;
	saved public.porch_round_stops%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_target IS NULL OR p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_target');
	END IF;
	IF public.are_blocked(caller_id, p_target) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;

	SELECT bv.visit_started_at
	INTO v_start
	FROM public.barn_visits bv
	WHERE bv.visitor_id = caller_id
	  AND bv.target_id = p_target
	  AND bv.visit_started_at IS NOT NULL
	  AND bv.created_at > now() - interval '24 hours'
	ORDER BY bv.created_at DESC
	LIMIT 1;

	IF v_start IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_recent_visit');
	END IF;

	SELECT * INTO existing
	FROM public.porch_round_stops s
	WHERE s.visitor_id = caller_id
	  AND s.target_id = p_target
	  AND s.visit_started_at = v_start;
	IF FOUND THEN
		RETURN jsonb_build_object(
			'ok', true,
			'created', false,
			'page_number', existing.page_number,
			'stop_number', existing.stop_number
		);
	END IF;

	-- Serialize page-slot assignment for one visitor without locking unrelated
	-- players. A repeated pig cannot fill two panels on the same page.
	PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));

	-- A second caller may have inserted while this transaction waited.
	SELECT * INTO existing
	FROM public.porch_round_stops s
	WHERE s.visitor_id = caller_id
	  AND s.target_id = p_target
	  AND s.visit_started_at = v_start;
	IF FOUND THEN
		RETURN jsonb_build_object(
			'ok', true,
			'created', false,
			'page_number', existing.page_number,
			'stop_number', existing.stop_number
		);
	END IF;

	SELECT s.page_number, s.stop_number
	INTO last_page, last_stop
	FROM public.porch_round_stops s
	WHERE s.visitor_id = caller_id
	ORDER BY s.page_number DESC, s.stop_number DESC
	LIMIT 1;

	IF last_page IS NULL THEN
		next_page := 1;
		next_stop := 1;
	ELSIF last_stop >= 3 OR EXISTS (
		SELECT 1 FROM public.porch_round_stops s
		WHERE s.visitor_id = caller_id
		  AND s.page_number = last_page
		  AND s.target_id = p_target
	) THEN
		next_page := last_page + 1;
		next_stop := 1;
	ELSE
		next_page := last_page;
		next_stop := last_stop + 1;
	END IF;

	INSERT INTO public.porch_round_stops (
		visitor_id, target_id, visit_started_at, page_number, stop_number
	)
	VALUES (caller_id, p_target, v_start, next_page, next_stop)
	RETURNING * INTO saved;

	RETURN jsonb_build_object(
		'ok', true,
		'created', true,
		'page_number', saved.page_number,
		'stop_number', saved.stop_number
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_porch_round(p_limit int DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	safe_limit int := LEAST(GREATEST(COALESCE(p_limit, 60), 1), 120);
	stop_rows jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT COALESCE(jsonb_agg(row_data ORDER BY page_number DESC, stop_number), '[]'::jsonb)
	INTO stop_rows
	FROM (
		SELECT
			s.page_number,
			s.stop_number,
			jsonb_build_object(
				'id', s.id,
				'page_number', s.page_number,
				'stop_number', s.stop_number,
				'target_user_id', s.target_id,
				'target_name', COALESCE(NULLIF(trim(p.username), ''), 'A friendly pig'),
				'visited_at', s.created_at,
				'active_hat_id', p.active_hat_id,
				'wallow_count', COALESCE(p.wallow_count, 0)
			) AS row_data
		FROM public.porch_round_stops s
		JOIN public.profiles p ON p.id = s.target_id
		WHERE s.visitor_id = caller_id
		  AND NOT public.are_blocked(caller_id, s.target_id)
		ORDER BY s.page_number DESC, s.stop_number
		LIMIT safe_limit
	) recent;

	RETURN jsonb_build_object('ok', true, 'stops', stop_rows);
END;
$function$;

REVOKE ALL ON FUNCTION public.record_porch_stop(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_porch_round(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_porch_stop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_porch_round(int) TO authenticated;

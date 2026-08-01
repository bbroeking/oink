-- Barn guestbook stamps — an optional, permanent trace after a successful
-- visit. Authored for review; do not push without Brian's explicit "go".
--
-- Stamps do not award currency, alter barn_visits, or affect visit limits.
-- The table has zero client policies: a visitor writes through one constrained
-- RPC and a host reads only their own book through another.

CREATE TABLE public.barn_guestbook_stamps (
	id bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_started_at timestamptz NOT NULL,
	stamp_id text NOT NULL CHECK (
		stamp_id IN ('hoofprint', 'heart', 'sunshine', 'sparkle')
	),
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT barn_guestbook_stamps_not_self CHECK (visitor_id <> host_id),
	CONSTRAINT barn_guestbook_stamps_one_per_visit
		UNIQUE (visitor_id, host_id, visit_started_at)
);

CREATE INDEX barn_guestbook_stamps_host_recent_idx
	ON public.barn_guestbook_stamps (host_id, created_at DESC);

ALTER TABLE public.barn_guestbook_stamps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.barn_guestbook_stamps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.barn_guestbook_stamps_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.leave_barn_guestbook_stamp(
	p_host uuid,
	p_stamp_id text DEFAULT 'hoofprint'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_start timestamptz;
	stamp_row public.barn_guestbook_stamps%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_host IS NULL OR p_host = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host');
	END IF;
	IF p_stamp_id IS NULL OR p_stamp_id NOT IN (
		'hoofprint', 'heart', 'sunshine', 'sparkle'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_stamp');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_host) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'host_not_found');
	END IF;
	IF public.are_blocked(caller_id, p_host) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;

	-- A stamp is valid only after an actual successful tickle in the current
	-- visit. Reusing visit_started_at keeps it compatible with every existing
	-- per-pair and per-window visit limit without wrapping tickle_at_barn.
	SELECT bv.visit_started_at
	INTO v_start
	FROM public.barn_visits bv
	WHERE bv.visitor_id = caller_id
	  AND bv.target_id = p_host
	  AND bv.visit_started_at IS NOT NULL
	  AND bv.created_at > now() - interval '24 hours'
	ORDER BY bv.created_at DESC
	LIMIT 1;

	IF v_start IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_recent_visit');
	END IF;

	INSERT INTO public.barn_guestbook_stamps (
		visitor_id,
		host_id,
		visit_started_at,
		stamp_id
	)
	VALUES (caller_id, p_host, v_start, p_stamp_id)
	RETURNING * INTO stamp_row;

	RETURN jsonb_build_object(
		'ok', true,
		'stamp_id', stamp_row.stamp_id,
		'stamped_at', stamp_row.created_at
	);
EXCEPTION WHEN unique_violation THEN
	RETURN jsonb_build_object('ok', false, 'reason', 'already_stamped');
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_barn_guestbook(p_limit int DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	safe_limit int := LEAST(GREATEST(COALESCE(p_limit, 60), 1), 100);
	entries jsonb;
	entry_total int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;

	SELECT count(*)
	INTO entry_total
	FROM public.barn_guestbook_stamps s
	WHERE s.host_id = caller_id
	  AND NOT public.are_blocked(s.visitor_id, caller_id);

	SELECT COALESCE(jsonb_agg(row_data ORDER BY stamped_at DESC), '[]'::jsonb)
	INTO entries
	FROM (
		SELECT
			s.created_at AS stamped_at,
			jsonb_build_object(
				'id', s.id,
				'stamp_id', s.stamp_id,
				'visitor_name', COALESCE(NULLIF(trim(p.username), ''), 'A friendly pig'),
				'stamped_at', s.created_at
			) AS row_data
		FROM public.barn_guestbook_stamps s
		JOIN public.profiles p ON p.id = s.visitor_id
		WHERE s.host_id = caller_id
		  AND NOT public.are_blocked(s.visitor_id, caller_id)
		ORDER BY s.created_at DESC
		LIMIT safe_limit
	) recent;

	RETURN jsonb_build_object(
		'ok', true,
		'total', entry_total,
		'entries', entries
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_barn_guestbook_stamp(uuid, text)
	FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_barn_guestbook_stamp(uuid, text)
	TO authenticated;
REVOKE ALL ON FUNCTION public.my_barn_guestbook(int)
	FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_barn_guestbook(int)
	TO authenticated;

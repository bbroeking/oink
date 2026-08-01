-- ════════════════════════════════════════════════════════════════════════════
-- Dig postcards — a completed Truffle Patch receipt can be left with one
-- accepted friend, who may add one durable, non-economic hoof cheer.
--
-- Additive and non-expiring: rows are never swept or consumed. The share-grid
-- snapshot reuses the client receipt's spoiler-light vocabulary; the server
-- independently verifies that the sender submitted the referenced rooting.
-- Authored only. Applying this migration still requires the founder's explicit
-- database-push "go".
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.dig_postcards (
	id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	sender_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	recipient_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	feeding_number      bigint      NOT NULL,
	cells               text[]      NOT NULL,
	digs                int         NOT NULL CHECK (digs BETWEEN 0 AND 30),
	finds               int         NOT NULL CHECK (finds BETWEEN 0 AND 30),
	golden_in_digs      int,
	created_at          timestamptz NOT NULL DEFAULT now(),
	recipient_opened_at timestamptz,
	cheered_at          timestamptz,
	CONSTRAINT dig_postcards_not_self CHECK (sender_id <> recipient_id),
	CONSTRAINT dig_postcards_cells_bounded CHECK (cardinality(cells) BETWEEN 0 AND 30),
	CONSTRAINT dig_postcards_cells_known CHECK (
		cells <@ ARRAY['mud', 'truffle', 'shimmer', 'unique']::text[]
	),
	CONSTRAINT dig_postcards_golden_valid CHECK (
		golden_in_digs IS NULL OR golden_in_digs BETWEEN 1 AND digs
	),
	-- A dig leaves one social artifact, not a fan-out notification campaign.
	CONSTRAINT dig_postcards_one_per_dig UNIQUE (sender_id, feeding_number)
);

CREATE INDEX IF NOT EXISTS dig_postcards_recipient_created_idx
	ON public.dig_postcards (recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dig_postcards_sender_created_idx
	ON public.dig_postcards (sender_id, created_at DESC);

ALTER TABLE public.dig_postcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Postcard participants can read" ON public.dig_postcards;
CREATE POLICY "Postcard participants can read"
	ON public.dig_postcards
	FOR SELECT
	USING (
		(auth.uid() = sender_id OR auth.uid() = recipient_id)
		AND NOT public.are_blocked(sender_id, recipient_id)
	);

-- Writes stay RPC-only so clients cannot forge friendship, rooting, open, or
-- cheer state through direct table mutations.

CREATE OR REPLACE FUNCTION public.create_dig_postcard(
	p_recipient_id uuid,
	p_feeding_number bigint,
	p_cells text[],
	p_digs int,
	p_golden_in_digs int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	postcard_id uuid;
	find_count int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_recipient_id IS NULL OR p_recipient_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_recipient');
	END IF;
	IF public.are_blocked(caller_id, p_recipient_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;
	IF p_cells IS NULL
		OR cardinality(p_cells) > 30
		OR p_cells <@ ARRAY['mud', 'truffle', 'shimmer', 'unique']::text[] IS NOT TRUE
		OR p_digs IS NULL
		OR p_digs NOT BETWEEN 0 AND 30
		OR cardinality(p_cells) > p_digs
		OR (p_golden_in_digs IS NOT NULL AND p_golden_in_digs NOT BETWEEN 1 AND p_digs)
	THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_snapshot');
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM public.friendships f
		WHERE f.status = 'accepted'
			AND (
				(f.requester_id = caller_id AND f.receiver_id = p_recipient_id)
				OR (f.receiver_id = caller_id AND f.requester_id = p_recipient_id)
			)
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	-- The source of truth is the existing rooting receipt. Snapshot fields are
	-- cosmetic, but only a real, submitted dig owned by the caller may create
	-- the postcard.
	IF NOT EXISTS (
		SELECT 1
		FROM public.war_rootings r
		WHERE r.user_id = caller_id
			AND r.window_index = p_feeding_number
			AND r.submitted_at IS NOT NULL
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'dig_not_found');
	END IF;

	SELECT count(*)::int
	INTO find_count
	FROM unnest(p_cells) AS cell
	WHERE cell <> 'mud';

	INSERT INTO public.dig_postcards (
		sender_id,
		recipient_id,
		feeding_number,
		cells,
		digs,
		finds,
		golden_in_digs
	)
	VALUES (
		caller_id,
		p_recipient_id,
		p_feeding_number,
		p_cells,
		p_digs,
		find_count,
		p_golden_in_digs
	)
	ON CONFLICT (sender_id, feeding_number) DO NOTHING
	RETURNING id INTO postcard_id;

	IF postcard_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_sent');
	END IF;

	RETURN jsonb_build_object('ok', true, 'id', postcard_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.my_dig_postcards(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
	FROM (
		SELECT
			d.id,
			d.sender_id,
			d.recipient_id,
			d.feeding_number,
			d.cells,
			d.digs,
			d.finds,
			d.golden_in_digs,
			d.created_at,
			d.recipient_opened_at,
			d.cheered_at,
			s.username AS sender_username,
			r.username AS recipient_username
		FROM public.dig_postcards d
		LEFT JOIN public.profiles s ON s.id = d.sender_id
		LEFT JOIN public.profiles r ON r.id = d.recipient_id
		WHERE auth.uid() IN (d.sender_id, d.recipient_id)
			AND NOT public.are_blocked(d.sender_id, d.recipient_id)
		ORDER BY d.created_at DESC
		LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100)
	) q;
$function$;

CREATE OR REPLACE FUNCTION public.open_dig_postcards(p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	opened int;
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	UPDATE public.dig_postcards
	SET recipient_opened_at = COALESCE(recipient_opened_at, now())
	WHERE recipient_id = auth.uid()
		AND id = ANY(COALESCE(p_ids, ARRAY[]::uuid[]))
		AND NOT public.are_blocked(sender_id, recipient_id)
		AND recipient_opened_at IS NULL;
	GET DIAGNOSTICS opened = ROW_COUNT;
	RETURN jsonb_build_object('ok', true, 'opened', opened);
END;
$function$;

CREATE OR REPLACE FUNCTION public.cheer_dig_postcard(p_postcard_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	changed int;
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	UPDATE public.dig_postcards
	SET cheered_at = now(),
		recipient_opened_at = COALESCE(recipient_opened_at, now())
	WHERE id = p_postcard_id
		AND recipient_id = auth.uid()
		AND NOT public.are_blocked(sender_id, recipient_id)
		AND cheered_at IS NULL;
	GET DIAGNOSTICS changed = ROW_COUNT;
	IF changed = 0 THEN
		IF EXISTS (
			SELECT 1 FROM public.dig_postcards
			WHERE id = p_postcard_id
				AND recipient_id = auth.uid()
				AND NOT public.are_blocked(sender_id, recipient_id)
				AND cheered_at IS NOT NULL
		) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'already_cheered');
		END IF;
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_dig_postcard(uuid, bigint, text[], int, int)
	FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_dig_postcards(int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.open_dig_postcards(uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cheer_dig_postcard(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_dig_postcard(uuid, bigint, text[], int, int)
	TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_dig_postcards(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_dig_postcards(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cheer_dig_postcard(uuid) TO authenticated;

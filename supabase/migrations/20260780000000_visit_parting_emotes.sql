-- Slop Club parting emotes. Held for review: do not push without Brian's
-- explicit "go".

INSERT INTO public.app_settings (key, value)
VALUES (
	'visit_emotes',
	'{"ids":["slop_thanks","snout_boop","confetti_oink","mud_bath","sleepy_pig","golden_wave"]}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE TABLE public.visit_emotes (
	id bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_started_at timestamptz NOT NULL,
	emote_id text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (visitor_id, host_id, visit_started_at)
);
ALTER TABLE public.visit_emotes ENABLE ROW LEVEL SECURITY;
-- No client policies: the definer RPC owns the single write and the recipient
-- sees the result through system_announcements.

-- Tag the existing first-tap barn announcement with its visit identity so the
-- parting RPC can enrich that same while-away line instead of creating a
-- second surface.
ALTER FUNCTION public.tickle_at_barn(uuid)
	RENAME TO _tickle_at_barn_before_visit_emotes;

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	result jsonb := public._tickle_at_barn_before_visit_emotes(p_target);
	v_start timestamptz;
	visitor_name text;
BEGIN
	IF COALESCE((result->>'ok')::boolean, false) THEN
		SELECT visit_started_at INTO v_start
		FROM public.barn_visits
		WHERE visitor_id = caller_id AND target_id = p_target
		ORDER BY created_at DESC LIMIT 1;
		SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;

		UPDATE public.system_announcements
		SET data = data || jsonb_build_object(
			'visitor_id', caller_id,
			'visit_started_at', v_start
		)
		WHERE id = (
			SELECT id FROM public.system_announcements
			WHERE user_id = p_target
			  AND kind = 'barn_visit'
			  AND dispatched_at >= v_start
			  AND body = COALESCE(visitor_name, 'A friend') || ' came by and tickled your pig!'
			ORDER BY dispatched_at DESC LIMIT 1
		);
	END IF;
	RETURN result;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_visit_emote(
	p_host uuid,
	p_emote_id text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	v_start timestamptz;
	visitor_name text;
	allowed_ids jsonb;
	announcement_id bigint;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF NOT COALESCE((SELECT is_vip FROM public.profiles WHERE id = caller_id), false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'members_only');
	END IF;

	SELECT COALESCE(
		(SELECT value->'ids' FROM public.app_settings WHERE key = 'visit_emotes'),
		'["slop_thanks","snout_boop","confetti_oink","mud_bath","sleepy_pig","golden_wave"]'::jsonb
	) INTO allowed_ids;
	IF NOT allowed_ids ? p_emote_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unknown_emote');
	END IF;

	SELECT visit_started_at INTO v_start
	FROM public.barn_visits
	WHERE visitor_id = caller_id
	  AND target_id = p_host
	  AND visit_started_at > now() - interval '24 hours'
	ORDER BY created_at DESC LIMIT 1;
	IF v_start IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_visit');
	END IF;
	IF EXISTS (
		SELECT 1 FROM public.visit_emotes
		WHERE visitor_id = caller_id AND host_id = p_host
		  AND visit_started_at = v_start
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_left');
	END IF;

	INSERT INTO public.visit_emotes
		(visitor_id, host_id, visit_started_at, emote_id)
	VALUES (caller_id, p_host, v_start, p_emote_id);

	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	UPDATE public.system_announcements
	SET title = 'A note from your Barn',
		body = COALESCE(visitor_name, 'A friend') || ' came by and left a parting note.',
		data = data || jsonb_build_object(
			'visitor_id', caller_id,
			'visit_started_at', v_start,
			'emote_id', p_emote_id
		)
	WHERE id = (
		SELECT id FROM public.system_announcements
		WHERE user_id = p_host
		  AND kind = 'barn_visit'
		  AND data->>'visitor_id' = caller_id::text
		  AND (data->>'visit_started_at')::timestamptz = v_start
		ORDER BY dispatched_at DESC LIMIT 1
	)
	RETURNING id INTO announcement_id;

	-- Compatibility fallback for a visit begun before the tagging wrapper was
	-- installed. It still lands in the same Notes from the barn pipeline.
	IF announcement_id IS NULL THEN
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			p_host,
			'barn_visit',
			'A note from your Barn',
			COALESCE(visitor_name, 'A friend') || ' came by and left a parting note.',
			jsonb_build_object(
				'visitor_id', caller_id,
				'visit_started_at', v_start,
				'emote_id', p_emote_id
			)
		)
		RETURNING id INTO announcement_id;
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'emote_id', p_emote_id,
		'announcement_id', announcement_id
	);
EXCEPTION WHEN unique_violation THEN
	RETURN jsonb_build_object('ok', false, 'reason', 'already_left');
END;
$function$;
REVOKE ALL ON FUNCTION public.leave_visit_emote(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_visit_emote(uuid, text) TO authenticated;

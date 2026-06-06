-- Barn visiting backend (social feature, idea 2): tickle another player's pig
-- FOR them. The visitor gives the target tickles (their bank, over-cap allowed),
-- rate-limited to once per target per hour, and the target gets an in-app
-- "someone visited" notification. Numbered 20260590 to sit after the soccer
-- ball (20260589) already in prod — no version collision on merge.

-- Visit ledger — powers the per-target cooldown + a future "recent visitors"
-- view. Only the SECURITY DEFINER RPC writes it; no client policies.
CREATE TABLE IF NOT EXISTS public.barn_visits (
	id         bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	target_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	tickles    int  NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS barn_visits_pair_idx
	ON public.barn_visits (visitor_id, target_id, created_at DESC);

ALTER TABLE public.barn_visits ENABLE ROW LEVEL SECURITY;
-- No policies: the table is reached only through tickle_at_barn (definer).

CREATE OR REPLACE FUNCTION public.tickle_at_barn(p_target uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cooldown  constant interval := '1 hour';
	reward    constant int := 3;
	last_at   timestamptz;
	visitor_name text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;
	IF p_target = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'error', 'self');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'error', 'no_target');
	END IF;

	-- One tickle per target per hour (anti-farm).
	SELECT max(created_at) INTO last_at
	FROM public.barn_visits
	WHERE visitor_id = caller_id AND target_id = p_target;

	IF last_at IS NOT NULL AND last_at > now() - cooldown THEN
		RETURN jsonb_build_object(
			'ok', false, 'error', 'cooldown',
			'next_at', last_at + cooldown
		);
	END IF;

	-- Gift the target tickles (bank, over-cap allowed via grant_tickles).
	PERFORM public.grant_tickles(p_target, reward);

	INSERT INTO public.barn_visits (visitor_id, target_id, tickles)
	VALUES (caller_id, p_target, reward);

	-- In-app notification (persists in the while-away modal even without push).
	SELECT username INTO visitor_name FROM public.profiles WHERE id = caller_id;
	PERFORM public.send_system_announcement(
		p_target, 'barn_visit',
		'Someone visited your Barn!',
		COALESCE(visitor_name, 'A friend') || ' tickled your pig — +'
			|| reward || ' tickles for you.',
		'{}'::jsonb
	);

	RETURN jsonb_build_object('ok', true, 'tickles', reward);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.tickle_at_barn(uuid) TO authenticated;

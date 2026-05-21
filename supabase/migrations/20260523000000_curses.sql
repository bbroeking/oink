-- Phase 2 of Season 1: daily Curses (the goblin-coded ritual).
--
-- Symmetric to blessings: one per (sender, receiver) per UTC day,
-- 3 casts per sender per day, daily-rotating kind. Casting shifts
-- the sender -1 alignment.
--
-- Anti-grief (locked in with the user):
--   - coin_pinch snout loss is capped at -10/day per RECEIVER across
--     all incoming curses. Past the cap the curse still records (for
--     lore / the "bob cursed you" notification) but deducts nothing.
--   - regen-debuff curses are recorded with expires_at; the Barn caps
--     total debuff time to 2h/day when it reads my_active_effects.
--   - a blessing received while cursed clears curses (see
--     clear_curses_on_blessing trigger).
--   - cleanse_curses() spends 5 snouts to wipe active curses.

CREATE TABLE IF NOT EXISTS public.curses (
	id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	receiver_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	kind        text        NOT NULL
		CHECK (kind IN ('sluggish_snout', 'phantom_itch', 'goblin_whisper', 'coin_pinch')),
	sent_at     timestamptz NOT NULL DEFAULT now(),
	sent_on     date        GENERATED ALWAYS AS ((sent_at AT TIME ZONE 'UTC')::date) STORED,
	expires_at  timestamptz,
	cleared_at  timestamptz,
	-- How many snouts this curse actually deducted (0 if cap was hit).
	snouts_taken int        NOT NULL DEFAULT 0,
	CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS curses_one_per_pair_per_day
	ON public.curses (sender_id, receiver_id, sent_on);
CREATE INDEX IF NOT EXISTS curses_receiver_active_idx
	ON public.curses (receiver_id) WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS curses_sender_day_idx
	ON public.curses (sender_id, sent_on);

ALTER TABLE public.curses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View curses you sent or received" ON public.curses;
CREATE POLICY "View curses you sent or received"
	ON public.curses FOR SELECT
	USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.daily_curse_kind()
RETURNS text
LANGUAGE sql
STABLE
AS $$
	SELECT (ARRAY['sluggish_snout', 'phantom_itch', 'goblin_whisper', 'coin_pinch'])[
		(EXTRACT(DOY FROM (now() AT TIME ZONE 'UTC'))::int % 4) + 1
	];
$$;

CREATE OR REPLACE FUNCTION public.send_curse(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id     uuid := auth.uid();
	kind_today    text := public.daily_curse_kind();
	casts_today   int;
	taken_today   int;
	this_take     int := 0;
	new_id        uuid;
	exp           timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF caller_id = target_user_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');
	END IF;
	IF NOT public.are_friends(caller_id, target_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;

	SELECT COUNT(*) INTO casts_today
		FROM public.curses
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= 3 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	exp := CASE kind_today
		WHEN 'sluggish_snout' THEN now() + interval '1 hour'
		WHEN 'goblin_whisper' THEN now() + interval '4 hours'
		WHEN 'phantom_itch'   THEN now() + interval '24 hours'  -- next 3 taps
		ELSE NULL                                               -- coin_pinch
	END;

	-- coin_pinch: cap total snout loss at 10/day per RECEIVER.
	IF kind_today = 'coin_pinch' THEN
		SELECT COALESCE(SUM(snouts_taken), 0) INTO taken_today
			FROM public.curses
			WHERE receiver_id = target_user_id
			  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
		this_take := LEAST(3, GREATEST(0, 10 - taken_today));
	END IF;

	BEGIN
		INSERT INTO public.curses
			(sender_id, receiver_id, kind, expires_at, snouts_taken)
			VALUES (caller_id, target_user_id, kind_today, exp, this_take)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_cursed_today');
	END;

	IF this_take > 0 THEN
		UPDATE public.profiles
			SET counter = GREATEST(0, counter - this_take)
			WHERE id = target_user_id;
	END IF;

	-- Casting a curse is active mischief → -1 alignment to sender.
	PERFORM public.shift_alignment(caller_id, -1);

	RETURN jsonb_build_object(
		'ok', true, 'kind', kind_today, 'curse_id', new_id,
		'snouts_taken', this_take
	);
END;
$function$;

-- ── cleanse_curses: spend 5 snouts to clear all active incoming
-- curses on the caller. No-op (still costs nothing) if none active.
CREATE OR REPLACE FUNCTION public.cleanse_curses()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	active_n  int;
	balance   int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT COUNT(*) INTO active_n
		FROM public.curses
		WHERE receiver_id = caller_id
		  AND cleared_at IS NULL
		  AND (expires_at IS NULL OR expires_at > now());
	IF active_n = 0 THEN
		RETURN jsonb_build_object('ok', true, 'cleared', 0);
	END IF;

	SELECT counter INTO balance FROM public.profiles WHERE id = caller_id;
	IF balance < 5 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_snouts');
	END IF;

	UPDATE public.profiles SET counter = counter - 5 WHERE id = caller_id;
	UPDATE public.curses SET cleared_at = now()
		WHERE receiver_id = caller_id AND cleared_at IS NULL;

	RETURN jsonb_build_object('ok', true, 'cleared', active_n);
END;
$function$;

-- ── trigger: a blessing received while cursed clears the curses.
-- "Receiving any blessing while cursed → both cancel."
CREATE OR REPLACE FUNCTION public.blessing_clears_curses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	UPDATE public.curses SET cleared_at = now()
		WHERE receiver_id = NEW.receiver_id AND cleared_at IS NULL;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS blessing_clears_curses_trig ON public.blessings;
CREATE TRIGGER blessing_clears_curses_trig
	AFTER INSERT ON public.blessings
	FOR EACH ROW EXECUTE FUNCTION public.blessing_clears_curses();

-- ── my_active_effects: the Barn polls this to honor live effects.
-- Returns un-expired, un-cleared blessings + curses for the caller.
CREATE OR REPLACE FUNCTION public.my_active_effects()
RETURNS TABLE (
	source     text,   -- 'blessing' | 'curse'
	kind       text,
	expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	SELECT 'blessing'::text, b.kind, b.expires_at
		FROM public.blessings b
		WHERE b.receiver_id = auth.uid()
		  AND b.cleared_at IS NULL
		  AND b.expires_at IS NOT NULL
		  AND b.expires_at > now()
	UNION ALL
	SELECT 'curse'::text, c.kind, c.expires_at
		FROM public.curses c
		WHERE c.receiver_id = auth.uid()
		  AND c.cleared_at IS NULL
		  AND c.expires_at IS NOT NULL
		  AND c.expires_at > now();
$$;

GRANT EXECUTE ON FUNCTION public.daily_curse_kind() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_curse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanse_curses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_active_effects() TO authenticated;

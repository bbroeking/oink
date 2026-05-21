-- Phase 2 of Season 1: daily Blessings (the angel-coded ritual).
--
-- One blessing per (sender, receiver) per UTC day, capped at 3 total
-- casts per sender per day. The kind available to send rotates daily
-- so the ritual stays fresh. Sending a blessing shifts the sender +1
-- alignment (active kindness).
--
-- Effects are recorded as rows with an expires_at; the Barn reads
-- my_active_effects() to honor regen multipliers / glow / etc.
-- Instant effects (bountiful_snouts) apply immediately and carry a
-- NULL expires_at.

CREATE TABLE IF NOT EXISTS public.blessings (
	id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	sender_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	receiver_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	kind        text        NOT NULL
		CHECK (kind IN ('warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts')),
	sent_at     timestamptz NOT NULL DEFAULT now(),
	-- Generated UTC date for the one-per-friend-per-day unique index.
	sent_on     date        GENERATED ALWAYS AS ((sent_at AT TIME ZONE 'UTC')::date) STORED,
	expires_at  timestamptz,
	cleared_at  timestamptz,
	CHECK (sender_id <> receiver_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS blessings_one_per_pair_per_day
	ON public.blessings (sender_id, receiver_id, sent_on);
CREATE INDEX IF NOT EXISTS blessings_receiver_active_idx
	ON public.blessings (receiver_id) WHERE cleared_at IS NULL;
CREATE INDEX IF NOT EXISTS blessings_sender_day_idx
	ON public.blessings (sender_id, sent_on);

ALTER TABLE public.blessings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View blessings you sent or received" ON public.blessings;
CREATE POLICY "View blessings you sent or received"
	ON public.blessings FOR SELECT
	USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
-- Mutations go through the SECURITY DEFINER RPC only.

-- ── daily_blessing_kind: today's castable kind, rotating across the
-- 4 kinds by day-of-year so the rotation is deterministic + global.
CREATE OR REPLACE FUNCTION public.daily_blessing_kind()
RETURNS text
LANGUAGE sql
STABLE
AS $$
	SELECT (ARRAY['warm_tea', 'sun_beam', 'halo_kiss', 'bountiful_snouts'])[
		(EXTRACT(DOY FROM (now() AT TIME ZONE 'UTC'))::int % 4) + 1
	];
$$;

-- ── send_blessing: cast today's blessing on a friend.
CREATE OR REPLACE FUNCTION public.send_blessing(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id    uuid := auth.uid();
	kind_today   text := public.daily_blessing_kind();
	casts_today  int;
	new_id       uuid;
	exp          timestamptz;
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

	-- Cap: 3 casts per sender per UTC day.
	SELECT COUNT(*) INTO casts_today
		FROM public.blessings
		WHERE sender_id = caller_id
		  AND sent_on = (now() AT TIME ZONE 'UTC')::date;
	IF casts_today >= 3 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'daily_cap');
	END IF;

	-- Effect duration per kind. Instant kinds get NULL expires_at.
	exp := CASE kind_today
		WHEN 'warm_tea'  THEN now() + interval '1 hour'
		WHEN 'halo_kiss' THEN now() + interval '6 hours'
		WHEN 'sun_beam'  THEN now() + interval '24 hours'  -- "next lucky pig"
		ELSE NULL                                          -- bountiful_snouts
	END;

	BEGIN
		INSERT INTO public.blessings (sender_id, receiver_id, kind, expires_at)
			VALUES (caller_id, target_user_id, kind_today, exp)
			RETURNING id INTO new_id;
	EXCEPTION WHEN unique_violation THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_blessed_today');
	END;

	-- Instant payout.
	IF kind_today = 'bountiful_snouts' THEN
		UPDATE public.profiles SET counter = counter + 5
			WHERE id = target_user_id;
	END IF;

	-- Casting a blessing is active kindness → +1 alignment to sender.
	PERFORM public.shift_alignment(caller_id, 1);

	RETURN jsonb_build_object('ok', true, 'kind', kind_today, 'blessing_id', new_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.daily_blessing_kind() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_blessing(uuid) TO authenticated;

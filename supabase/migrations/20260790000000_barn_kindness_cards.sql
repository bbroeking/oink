-- Barn kindness cards — optionally attach the current blessing to a completed
-- stamped visit. Authored for review; do not push without Brian's explicit go.
--
-- The existing send_blessing RPC remains the sole owner of ritual rotation,
-- caps, pair cooldowns, effects, rewards, alignment, XP, and Chorus behavior.

ALTER TABLE public.barn_guestbook_stamps
  ADD COLUMN blessing_id uuid REFERENCES public.blessings(id) ON DELETE SET NULL;

ALTER TABLE public.barn_guestbook_stamps
  ADD CONSTRAINT barn_guestbook_stamps_one_blessing UNIQUE (blessing_id);

CREATE OR REPLACE FUNCTION public.barn_kindness_card_status(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  casts_today int;
  cast_cap constant int := 3;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_host IS NULL OR p_host = caller_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host');
  END IF;

  -- Eligibility belongs to one successful, stamped visit. The join prevents a
  -- forged/orphaned stamp from becoming a ritual entry point.
  IF NOT EXISTS (
    SELECT 1
    FROM public.barn_guestbook_stamps s
    JOIN public.barn_visits bv
      ON bv.visitor_id = s.visitor_id
     AND bv.target_id = s.host_id
     AND bv.visit_started_at = s.visit_started_at
    WHERE s.visitor_id = caller_id
      AND s.host_id = p_host
      AND s.blessing_id IS NULL
      AND s.created_at > now() - interval '24 hours'
  ) THEN
    RETURN jsonb_build_object('ok', true, 'eligible', false, 'reason', 'no_eligible_visit');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.blessings b
    WHERE b.sender_id = caller_id
      AND b.receiver_id = p_host
      AND b.sent_on = (now() AT TIME ZONE 'UTC')::date
  ) THEN
    RETURN jsonb_build_object('ok', true, 'eligible', false, 'reason', 'already_blessed_today');
  END IF;

  SELECT count(*) INTO casts_today
  FROM public.blessings b
  WHERE b.sender_id = caller_id
    AND b.sent_on = (now() AT TIME ZONE 'UTC')::date
    AND b.kind NOT IN ('war_winner_regen', 'chorus_glow');

  RETURN jsonb_build_object(
    'ok', true,
    'eligible', casts_today < cast_cap,
    'reason', CASE WHEN casts_today >= cast_cap THEN 'daily_cap' ELSE NULL END,
    'blessing_kind', public.daily_blessing_kind(),
    'bless_remaining', GREATEST(0, cast_cap - casts_today)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.leave_barn_kindness_card(p_host uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  stamp_row public.barn_guestbook_stamps%ROWTYPE;
  blessing_result jsonb;
  new_blessing_id uuid;
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  -- Lock the one eligible stamp so double taps cannot link two blessings.
  SELECT s.*
  INTO stamp_row
  FROM public.barn_guestbook_stamps s
  JOIN public.barn_visits bv
    ON bv.visitor_id = s.visitor_id
   AND bv.target_id = s.host_id
   AND bv.visit_started_at = s.visit_started_at
  WHERE s.visitor_id = caller_id
    AND s.host_id = p_host
    AND s.blessing_id IS NULL
    AND s.created_at > now() - interval '24 hours'
  ORDER BY s.created_at DESC
  LIMIT 1
  FOR UPDATE OF s;

  IF stamp_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_eligible_visit');
  END IF;

  blessing_result := public.send_blessing(p_host);
  IF COALESCE((blessing_result->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN blessing_result;
  END IF;

  new_blessing_id := (blessing_result->>'blessing_id')::uuid;
  UPDATE public.barn_guestbook_stamps
  SET blessing_id = new_blessing_id
  WHERE id = stamp_row.id;

  RETURN blessing_result || jsonb_build_object(
    'ok', true,
    'guestbook_stamp_id', stamp_row.id
  );
END;
$function$;

-- Extend the existing owner-only read model. Old clients ignore the new keys.
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

  SELECT count(*) INTO entry_total
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
        'stamped_at', s.created_at,
        'blessing_kind', b.kind,
        'blessing_sent_at', b.sent_at
      ) AS row_data
    FROM public.barn_guestbook_stamps s
    JOIN public.profiles p ON p.id = s.visitor_id
    LEFT JOIN public.blessings b ON b.id = s.blessing_id
    WHERE s.host_id = caller_id
      AND NOT public.are_blocked(s.visitor_id, caller_id)
    ORDER BY s.created_at DESC
    LIMIT safe_limit
  ) recent;

  RETURN jsonb_build_object('ok', true, 'total', entry_total, 'entries', entries);
END;
$function$;

REVOKE ALL ON FUNCTION public.barn_kindness_card_status(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.barn_kindness_card_status(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.leave_barn_kindness_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_barn_kindness_card(uuid) TO authenticated;

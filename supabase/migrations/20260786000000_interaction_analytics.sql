-- Privacy-light first-party interaction analytics.
--
-- Raw rows are never client-readable. Authenticated clients may only write
-- through record_interaction_event(), whose event vocabulary, surfaces, target
-- kinds, result tokens, identifiers, and property keys are all allow-listed.
-- No usernames, device ids, free-form text, or message content are collected.

CREATE TABLE public.interaction_analytics_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  event_name text NOT NULL,
  surface text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  target_kind text,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result text,
  content_id text,
  experiment text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT interaction_analytics_properties_object
    CHECK (jsonb_typeof(properties) = 'object'),
  CONSTRAINT interaction_analytics_target_kind_token
    CHECK (target_kind IS NULL OR (
      length(target_kind) BETWEEN 1 AND 40
      AND target_kind ~ '^[a-z0-9][a-z0-9_.:-]*$'
    )),
  CONSTRAINT interaction_analytics_result_token
    CHECK (result IS NULL OR (
      length(result) BETWEEN 1 AND 40
      AND result ~ '^[a-z0-9][a-z0-9_.:-]*$'
    )),
  CONSTRAINT interaction_analytics_content_id_token
    CHECK (content_id IS NULL OR (
      length(content_id) BETWEEN 1 AND 80
      AND content_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
    )),
  CONSTRAINT interaction_analytics_experiment_token
    CHECK (experiment IS NULL OR (
      length(experiment) BETWEEN 1 AND 80
      AND experiment ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
    ))
);

CREATE INDEX interaction_analytics_events_occurred_idx
  ON public.interaction_analytics_events (occurred_at DESC);
CREATE INDEX interaction_analytics_events_name_occurred_idx
  ON public.interaction_analytics_events (event_name, occurred_at DESC);
CREATE INDEX interaction_analytics_events_actor_name_occurred_idx
  ON public.interaction_analytics_events (user_id, event_name, occurred_at DESC);
CREATE INDEX interaction_analytics_events_target_occurred_idx
  ON public.interaction_analytics_events (target_user_id, occurred_at DESC)
  WHERE target_user_id IS NOT NULL;

ALTER TABLE public.interaction_analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.interaction_analytics_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.interaction_analytics_events_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_interaction_event(
  p_session_id uuid,
  p_event_name text,
  p_surface text,
  p_target_kind text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_result text DEFAULT NULL,
  p_content_id text DEFAULT NULL,
  p_experiment text DEFAULT NULL,
  p_properties jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
  safe_properties jsonb := coalesce(p_properties, '{}'::jsonb);
BEGIN
  IF caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF p_session_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM (VALUES
      ('barn_opened', 'barn'), ('barn_opened', 'visit'),
      ('barn_tickle_succeeded', 'visit'),
      ('visit_stamp_left', 'visit'), ('visit_stamp_left', 'guestbook'),
      ('guestbook_opened', 'barn'), ('guestbook_opened', 'guestbook'),
      ('porch_round_started', 'porch_round'),
      ('porch_stop_completed', 'porch_round'), ('porch_stop_completed', 'visit'),
      ('porch_round_completed', 'porch_round'),
      ('ritual_picker_opened', 'ritual'), ('ritual_picker_opened', 'visit'),
      ('blessing_cast', 'ritual'), ('blessing_cast', 'visit'),
      ('curse_cast', 'ritual'),
      ('kindness_card_offered', 'visit'),
      ('kindness_card_left', 'visit'),
      ('kindness_card_opened', 'inbox'),
      ('rooting_opened', 'feeding'),
      ('rooting_submitted', 'feeding'),
      ('find_revealed', 'feeding'),
      ('dig_postcard_created', 'feeding'), ('dig_postcard_created', 'share'),
      ('dig_postcard_opened', 'inbox'),
      ('dig_postcard_cheered', 'inbox'),
      ('lounge_entered', 'lounge'),
      ('emote_sent', 'lounge'),
      ('seat_claimed', 'lounge'),
      ('item_previewed', 'shop'), ('item_previewed', 'closet'),
      ('item_bought', 'shop'),
      ('item_equipped', 'shop'), ('item_equipped', 'closet'),
      ('season_opened', 'season'),
      ('bounty_claimed', 'season'),
      ('tier_claimed', 'season'),
      ('share_created', 'share'),
      ('share_sheet_completed', 'share'),
      ('oinkogram_created', 'oinkogram'),
      ('oinkogram_shared', 'oinkogram'), ('oinkogram_shared', 'share')
    ) AS allowed(event_name, surface)
    WHERE allowed.event_name = p_event_name
      AND allowed.surface = p_surface
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_event');
  END IF;

  IF p_target_kind IS NOT NULL AND p_target_kind NOT IN (
    'barn', 'bounty', 'find', 'item', 'oinkogram', 'pig', 'postcard', 'tier'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_target_kind');
  END IF;

  IF p_result IS NOT NULL AND p_result NOT IN (
    'cancelled', 'completed', 'failed', 'succeeded', 'unavailable'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_result');
  END IF;

  IF p_content_id IS NOT NULL AND (
    length(p_content_id) NOT BETWEEN 1 AND 80
    OR p_content_id !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_content_id');
  END IF;

  IF p_experiment IS NOT NULL AND (
    length(p_experiment) NOT BETWEEN 1 AND 80
    OR p_experiment !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_experiment');
  END IF;

  IF jsonb_typeof(safe_properties) <> 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(safe_properties) AS key
      WHERE key NOT IN ('count', 'is_member', 'item_kind', 'share_method', 'source', 'variant')
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_each(safe_properties) AS property
      WHERE jsonb_typeof(property.value) NOT IN ('boolean', 'number', 'string')
        OR (jsonb_typeof(property.value) = 'string' AND length(property.value #>> '{}') > 40)
    )
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_properties');
  END IF;

  IF safe_properties ? 'count' AND (
    jsonb_typeof(safe_properties->'count') <> 'number'
    OR (safe_properties->>'count')::numeric < 0
    OR (safe_properties->>'count')::numeric > 10000
    OR trunc((safe_properties->>'count')::numeric) <> (safe_properties->>'count')::numeric
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_properties');
  END IF;

  IF (safe_properties ? 'is_member' AND jsonb_typeof(safe_properties->'is_member') <> 'boolean')
    OR (safe_properties ? 'item_kind' AND safe_properties->>'item_kind' NOT IN (
      'background', 'habitat', 'pig', 'wearable'
    ))
    OR (safe_properties ? 'share_method' AND safe_properties->>'share_method' NOT IN (
      'copy', 'native_sheet', 'save'
    ))
    OR (safe_properties ? 'source' AND safe_properties->>'source' NOT IN (
      'cta', 'inbox', 'notification', 'organic'
    ))
    OR (safe_properties ? 'variant' AND (
      length(safe_properties->>'variant') NOT BETWEEN 1 AND 40
      OR safe_properties->>'variant' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'
    ))
  THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_properties');
  END IF;

  -- Analytics must not be a cheap unbounded-write endpoint.
  IF (
    SELECT count(*)
    FROM public.interaction_analytics_events
    WHERE user_id = caller_id AND occurred_at >= now() - interval '1 hour'
  ) >= 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
  END IF;

  INSERT INTO public.interaction_analytics_events (
    user_id, session_id, event_name, surface, target_kind,
    target_user_id, result, content_id, experiment, properties
  )
  VALUES (
    caller_id, p_session_id, p_event_name, p_surface, p_target_kind,
    p_target_user_id, p_result, p_content_id, p_experiment, safe_properties
  );

  -- Opportunistic retention keeps the pseudonymous raw data bounded without a
  -- scheduler dependency. The aggregate endpoint itself reads at most 90 days.
  DELETE FROM public.interaction_analytics_events
  WHERE occurred_at < now() - interval '180 days';

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_interaction_event(
  uuid, text, text, text, uuid, text, text, text, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_interaction_event(
  uuid, text, text, text, uuid, text, text, text, jsonb
) TO authenticated;

-- Aggregate-only dashboard read. "Repeat" means another same-name event within
-- seven days; "return" means any later analytics event 24h–7d after the first.
-- Funnel conversion requires a success after exposure and within seven days.
CREATE OR REPLACE FUNCTION public.analytics_interaction_overview(p_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  WITH
  bounds AS (
    SELECT greatest(1, least(coalesce(p_days, 14), 90)) AS days
  ),
  real_events AS (
    SELECT e.*
    FROM public.interaction_analytics_events e
    JOIN public.profiles p ON p.id = e.user_id
    CROSS JOIN bounds b
    WHERE coalesce(p.is_test, false) = false
      AND e.occurred_at >= now() - make_interval(days => b.days)
  ),
  event_actor_first AS (
    SELECT event_name, surface, user_id, min(occurred_at) AS first_at
    FROM real_events
    GROUP BY event_name, surface, user_id
  ),
  event_rollups AS (
    SELECT
      f.event_name,
      f.surface,
      count(*) AS events,
      count(DISTINCT f.user_id) AS actors,
      count(DISTINCT f.target_user_id) FILTER (WHERE f.target_user_id IS NOT NULL) AS recipients,
      round(count(*)::numeric / nullif(count(DISTINCT f.user_id), 0), 2) AS actions_per_actor,
      round(
        100.0 * count(DISTINCT af.user_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM real_events later
          WHERE later.user_id = af.user_id
            AND later.event_name = af.event_name
            AND later.surface = af.surface
            AND later.occurred_at > af.first_at
            AND later.occurred_at <= af.first_at + interval '7 days'
        ) AND af.first_at <= now() - interval '7 days')
        / nullif(
          count(DISTINCT af.user_id) FILTER (
            WHERE af.first_at <= now() - interval '7 days'
          ),
          0
        ),
        1
      ) AS repeat_7d_pct,
      round(
        100.0 * count(DISTINCT af.user_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM public.interaction_analytics_events later
          WHERE later.user_id = af.user_id
            AND later.occurred_at >= af.first_at + interval '24 hours'
            AND later.occurred_at <= af.first_at + interval '7 days'
        ) AND af.first_at <= now() - interval '7 days')
        / nullif(
          count(DISTINCT af.user_id) FILTER (
            WHERE af.first_at <= now() - interval '7 days'
          ),
          0
        ),
        1
      ) AS actor_return_7d_pct
    FROM real_events f
    JOIN event_actor_first af
      ON af.event_name = f.event_name
     AND af.surface = f.surface
     AND af.user_id = f.user_id
    GROUP BY f.event_name, f.surface
  ),
  funnel_definitions(family, exposure_event, success_event) AS (
    VALUES
      ('barn', 'barn_opened', 'barn_tickle_succeeded'),
      ('guestbook', 'barn_tickle_succeeded', 'visit_stamp_left'),
      ('ritual_blessing', 'ritual_picker_opened', 'blessing_cast'),
      ('ritual_curse', 'ritual_picker_opened', 'curse_cast'),
      ('feeding', 'rooting_opened', 'rooting_submitted'),
      ('feeding_reveal', 'rooting_submitted', 'find_revealed'),
      ('lounge_emote', 'lounge_entered', 'emote_sent'),
      ('lounge_seat', 'lounge_entered', 'seat_claimed'),
      ('shop_buy', 'item_previewed', 'item_bought'),
      ('shop_equip', 'item_previewed', 'item_equipped'),
      ('season_bounty', 'season_opened', 'bounty_claimed'),
      ('season_tier', 'season_opened', 'tier_claimed'),
      ('sharing', 'share_created', 'share_sheet_completed'),
      ('kindness_card', 'kindness_card_offered', 'kindness_card_left'),
      ('dig_postcard', 'dig_postcard_created', 'dig_postcard_opened'),
      ('oinkogram', 'oinkogram_created', 'oinkogram_shared')
  ),
  funnel_rollups AS (
    SELECT
      d.family,
      d.exposure_event,
      d.success_event,
      count(DISTINCT exposure.user_id) AS exposed_users,
      count(DISTINCT exposure.user_id) FILTER (WHERE EXISTS (
        SELECT 1 FROM real_events success
        WHERE success.user_id = exposure.user_id
          AND success.event_name = d.success_event
          AND success.occurred_at >= exposure.occurred_at
          AND success.occurred_at <= exposure.occurred_at + interval '7 days'
      )) AS converted_users
    FROM funnel_definitions d
    LEFT JOIN real_events exposure ON exposure.event_name = d.exposure_event
    GROUP BY d.family, d.exposure_event, d.success_event
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'days', (SELECT days FROM bounds),
    'events', coalesce((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.actors DESC, r.events DESC)
      FROM event_rollups r
    ), '[]'::jsonb),
    'funnels', coalesce((
      SELECT jsonb_agg(
        to_jsonb(f) || jsonb_build_object(
          'conversion_pct',
          round(100.0 * f.converted_users / nullif(f.exposed_users, 0), 1)
        )
        ORDER BY f.exposed_users DESC, f.family
      )
      FROM funnel_rollups f
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.analytics_interaction_overview(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.analytics_interaction_overview(integer) TO authenticated;

-- Rewarded-ad reporting: keep sponsored home taps visible as their own receipt
-- lane and accept only the small, privacy-light ad funnel vocabulary.

CREATE OR REPLACE FUNCTION public.tickle_breakdown(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_boundary timestamptz;
	v_total bigint;
	v_ads bigint;
	v_visit bigint;
	v_dig bigint;
	v_pass bigint;
	v_trades bigint;
	v_lucky bigint;
	v_home bigint;
BEGIN
	SELECT starts_at INTO v_boundary FROM public.active_season();
	SELECT COALESCE(tickles_earned, 0) INTO v_total
		FROM public.profiles WHERE id = p_user;
	v_total := COALESCE(v_total, 0);

	IF v_boundary IS NULL THEN
		RETURN jsonb_build_object(
			'total', v_total, 'boundary', NULL,
			'home_taps', v_total, 'ads', 0, 'visit_taps', 0, 'dig_finds', 0,
			'pass_tiers', 0, 'trades', 0, 'lucky', 0);
	END IF;

	SELECT count(*) INTO v_ads FROM public.rewarded_ad_consumptions
		WHERE user_id = p_user AND consumed_at > v_boundary;
	SELECT count(*) INTO v_visit FROM public.barn_visits
		WHERE visitor_id = p_user AND created_at > v_boundary;
	SELECT count(*) * 5 INTO v_dig FROM public.truffle_digs
		WHERE digger_id = p_user AND dug_at > v_boundary;
	SELECT COALESCE(SUM(COALESCE(
			(st.reward_value->>'amount')::int,
			(st.reward_value->>'tickles')::int, 0)), 0)
		INTO v_pass
		FROM public.user_tier_claims utc
		JOIN public.season_tiers st
			ON st.season_id = utc.season_id
			AND st.tier = utc.tier
			AND st.track = utc.track
		WHERE utc.user_id = p_user
			AND utc.claimed_at > v_boundary
			AND st.reward_type IN ('tickles', 'tickle');
	SELECT COALESCE(SUM(amount * 2), 0) INTO v_trades
		FROM public.tickle_trades
		WHERE requester_id = p_user AND fulfilled_at > v_boundary;
	SELECT count(*) * 5 INTO v_lucky FROM public.daily_lucky_claims
		WHERE user_id = p_user AND claimed_at > v_boundary;

	v_home := GREATEST(
		0,
		v_total - (v_ads + v_visit + v_dig + v_pass + v_trades + v_lucky)
	);
	RETURN jsonb_build_object(
		'total', v_total,
		'boundary', v_boundary,
		'home_taps', v_home,
		'ads', v_ads,
		'visit_taps', v_visit,
		'dig_finds', v_dig,
		'pass_tiers', v_pass,
		'trades', v_trades,
		'lucky', v_lucky);
END;
$function$;

REVOKE ALL ON FUNCTION public.tickle_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickle_breakdown(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_rewarded_ad_interaction(
	p_session_id uuid,
	p_event_name text,
	p_result text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_session_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
	END IF;
	IF p_event_name NOT IN (
		'rewarded_ad_offer_opened',
		'rewarded_ad_started',
		'rewarded_ad_finished'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_event');
	END IF;
	IF p_result IS NOT NULL AND p_result NOT IN (
		'cancelled', 'failed', 'succeeded', 'unavailable'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_result');
	END IF;
	IF (
		SELECT count(*) FROM public.interaction_analytics_events
		WHERE user_id = caller_id AND occurred_at >= now() - interval '1 hour'
	) >= 500 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited');
	END IF;

	INSERT INTO public.interaction_analytics_events(
		user_id, session_id, event_name, surface, target_kind, result
	) VALUES (
		caller_id, p_session_id, p_event_name, 'ad_refill', 'barn', p_result
	);
	RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.record_rewarded_ad_interaction(uuid,text,text)
	FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_rewarded_ad_interaction(uuid,text,text)
	TO authenticated;

-- Rewarded AdMob refill — authored locally, feature-dark, never pushed without
-- the founder's explicit go.

ALTER TABLE public.user_items
	ADD COLUMN IF NOT EXISTS sponsor_tickle_count integer NOT NULL DEFAULT 0
	CHECK (sponsor_tickle_count >= 0);

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS ads_age_eligible boolean DEFAULT NULL,
	ADD COLUMN IF NOT EXISTS ads_age_confirmed_at timestamptz;

INSERT INTO public.app_config(key, enabled, description)
VALUES ('rewarded_ads', false, 'Optional zero-bank rewarded-ad refill')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.rewarded_ad_settings (
	placement text PRIMARY KEY,
	enabled boolean NOT NULL DEFAULT false,
	reward_amount integer NOT NULL DEFAULT 3 CHECK (reward_amount BETWEEN 1 AND 5),
	rolling_limit integer NOT NULL DEFAULT 1 CHECK (rolling_limit BETWEEN 1 AND 5),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CHECK (placement = 'ad_refill')
);

INSERT INTO public.rewarded_ad_settings(placement, enabled, reward_amount, rolling_limit)
VALUES ('ad_refill', false, 3, 1);

CREATE TABLE public.rewarded_ad_attempts (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	placement text NOT NULL DEFAULT 'ad_refill' CHECK (placement = 'ad_refill'),
	provider text NOT NULL DEFAULT 'admob' CHECK (provider = 'admob'),
	reward_amount integer NOT NULL CHECK (reward_amount BETWEEN 1 AND 5),
	rolling_limit integer NOT NULL CHECK (rolling_limit BETWEEN 1 AND 5),
	status text NOT NULL DEFAULT 'reserved'
		CHECK (status IN ('reserved', 'started', 'client_abandoned', 'verified', 'rejected')),
	reserved_at timestamptz NOT NULL DEFAULT now(),
	started_at timestamptz,
	expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
	verified_at timestamptz,
	provider_transaction_id text UNIQUE,
	provider_response_id text,
	CHECK (provider_response_id IS NULL OR length(provider_response_id) <= 200)
);

CREATE INDEX rewarded_ad_attempts_user_window_idx
	ON public.rewarded_ad_attempts(user_id, reserved_at DESC);
CREATE INDEX rewarded_ad_attempts_live_idx
	ON public.rewarded_ad_attempts(user_id, expires_at)
	WHERE status IN ('reserved', 'started');

CREATE TABLE public.rewarded_ad_grants (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	provider text NOT NULL CHECK (provider = 'admob'),
	provider_transaction_id text NOT NULL,
	attempt_id uuid NOT NULL UNIQUE REFERENCES public.rewarded_ad_attempts(id) ON DELETE RESTRICT,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	amount integer NOT NULL CHECK (amount BETWEEN 1 AND 5),
	granted_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE(provider, provider_transaction_id)
);

CREATE INDEX rewarded_ad_grants_user_window_idx
	ON public.rewarded_ad_grants(user_id, granted_at DESC);

CREATE TABLE public.rewarded_ad_consumptions (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	consumed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rewarded_ad_consumptions_user_time_idx
	ON public.rewarded_ad_consumptions(user_id, consumed_at DESC);

CREATE TABLE public.rewarded_ad_reports (
	id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	attempt_id uuid NOT NULL REFERENCES public.rewarded_ad_attempts(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	reason text NOT NULL CHECK (reason IN ('inappropriate', 'age_inappropriate', 'misleading', 'other')),
	provider_response_id text,
	reported_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE(attempt_id, user_id)
);

ALTER TABLE public.rewarded_ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewarded_ad_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewarded_ad_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewarded_ad_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewarded_ad_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rewarded_ad_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rewarded_ad_attempts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rewarded_ad_grants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rewarded_ad_consumptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rewarded_ad_reports FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rewarded_ad_grants_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rewarded_ad_consumptions_id_seq FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rewarded_ad_reports_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.rewarded_ad_offer_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	caller_id uuid := auth.uid();
	settings public.rewarded_ad_settings%ROWTYPE;
	age_eligible boolean;
	ordinary_balance integer;
	sponsor_balance integer;
	used_slots integer;
	next_at timestamptz;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'kind', 'hidden', 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO settings FROM public.rewarded_ad_settings WHERE placement = 'ad_refill';
	IF NOT FOUND OR NOT settings.enabled OR NOT COALESCE(
		(SELECT enabled FROM public.app_config WHERE key = 'rewarded_ads'), false
	) THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'hidden');
	END IF;

	SELECT ads_age_eligible INTO age_eligible FROM public.profiles WHERE id = caller_id;
	IF age_eligible IS DISTINCT FROM true THEN
		RETURN jsonb_build_object(
			'ok', true,
			'kind', 'age_required',
			'reward_amount', settings.reward_amount
		);
	END IF;

	ordinary_balance := COALESCE((public.tickle_info(caller_id)->>'balance')::integer, 0);
	SELECT sponsor_tickle_count INTO sponsor_balance
	FROM public.user_items WHERE user_id = caller_id;
	IF ordinary_balance + COALESCE(sponsor_balance, 0) > 0 THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'hidden', 'reason', 'bank_not_empty');
	END IF;

	SELECT COUNT(*)::integer INTO used_slots
	FROM (
		SELECT granted_at AS slot_at, granted_at + interval '24 hours' AS releases_at
		FROM public.rewarded_ad_grants
		WHERE user_id = caller_id AND granted_at > now() - interval '24 hours'
		UNION ALL
		SELECT reserved_at, expires_at
		FROM public.rewarded_ad_attempts
		WHERE user_id = caller_id
		  AND status IN ('reserved', 'started')
		  AND expires_at > now()
	) slots;

	IF used_slots >= settings.rolling_limit THEN
		SELECT MIN(releases_at) INTO next_at FROM (
			SELECT granted_at + interval '24 hours' AS releases_at
			FROM public.rewarded_ad_grants
			WHERE user_id = caller_id AND granted_at > now() - interval '24 hours'
			UNION ALL
			SELECT expires_at FROM public.rewarded_ad_attempts
			WHERE user_id = caller_id
			  AND status IN ('reserved', 'started')
			  AND expires_at > now()
		) releases;
		RETURN jsonb_build_object(
			'ok', true,
			'kind', 'limit_reached',
			'next_eligible_at', next_at
		);
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'kind', 'available',
		'reward_amount', settings.reward_amount,
		'remaining_slots', settings.rolling_limit - used_slots
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_rewarded_ad_age_eligibility(p_is_13_or_older boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	UPDATE public.profiles
	SET ads_age_eligible = COALESCE(p_is_13_or_older, false),
		ads_age_confirmed_at = now()
	WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true, 'eligible', COALESCE(p_is_13_or_older, false));
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_rewarded_ad()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	caller_id uuid := auth.uid();
	settings public.rewarded_ad_settings%ROWTYPE;
	ordinary_balance integer;
	sponsor_balance integer;
	used_slots integer;
	attempt uuid;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	PERFORM 1 FROM public.profiles WHERE id = caller_id FOR UPDATE;
	SELECT * INTO settings FROM public.rewarded_ad_settings
	WHERE placement = 'ad_refill' FOR UPDATE;
	IF NOT FOUND OR NOT settings.enabled OR NOT COALESCE(
		(SELECT enabled FROM public.app_config WHERE key = 'rewarded_ads'), false
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'disabled');
	END IF;
	IF (SELECT ads_age_eligible FROM public.profiles WHERE id = caller_id) IS DISTINCT FROM true THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'age_required');
	END IF;

	ordinary_balance := public.settle_tickles(caller_id);
	SELECT sponsor_tickle_count INTO sponsor_balance
	FROM public.user_items WHERE user_id = caller_id FOR UPDATE;
	IF ordinary_balance + COALESCE(sponsor_balance, 0) > 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bank_not_empty');
	END IF;

	SELECT COUNT(*)::integer INTO used_slots FROM (
		SELECT id::text FROM public.rewarded_ad_grants
		WHERE user_id = caller_id AND granted_at > now() - interval '24 hours'
		UNION ALL
		SELECT id::text FROM public.rewarded_ad_attempts
		WHERE user_id = caller_id AND status IN ('reserved', 'started') AND expires_at > now()
	) slots;
	IF used_slots >= settings.rolling_limit THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
	END IF;

	INSERT INTO public.rewarded_ad_attempts(user_id, reward_amount, rolling_limit)
	VALUES (caller_id, settings.reward_amount, settings.rolling_limit)
	RETURNING id INTO attempt;
	RETURN jsonb_build_object(
		'ok', true,
		'attempt_id', attempt,
		'reward_amount', settings.reward_amount
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_rewarded_ad_started(
	p_attempt_id uuid,
	p_provider_response_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_provider_response_id IS NOT NULL AND length(p_provider_response_id) > 200 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_response_id');
	END IF;
	UPDATE public.rewarded_ad_attempts
	SET status = 'started', started_at = now(), expires_at = now() + interval '24 hours',
		provider_response_id = p_provider_response_id
	WHERE id = p_attempt_id AND user_id = caller_id AND status = 'reserved' AND expires_at > now();
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_attempt');
	END IF;
	RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_rewarded_ad_attempt(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	UPDATE public.rewarded_ad_attempts
	SET status = 'client_abandoned', expires_at = now()
	WHERE id = p_attempt_id AND user_id = caller_id AND status IN ('reserved', 'started');
	RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.rewarded_ad_attempt_status(p_attempt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	caller_id uuid := auth.uid();
	attempt public.rewarded_ad_attempts%ROWTYPE;
	balance integer;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'kind', 'rejected', 'reason', 'unauthenticated');
	END IF;
	SELECT * INTO attempt FROM public.rewarded_ad_attempts
	WHERE id = p_attempt_id AND user_id = caller_id;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'kind', 'rejected', 'reason', 'not_found');
	END IF;
	IF attempt.status = 'verified' THEN
		SELECT COALESCE((public.tickle_info(caller_id)->>'balance')::integer, 0)
			+ sponsor_tickle_count INTO balance
		FROM public.user_items WHERE user_id = caller_id;
		RETURN jsonb_build_object(
			'ok', true, 'kind', 'verified',
			'reward_amount', attempt.reward_amount, 'balance', balance
		);
	END IF;
	IF attempt.status IN ('client_abandoned', 'rejected') THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'rejected', 'reason', attempt.status);
	END IF;
	RETURN jsonb_build_object('ok', true, 'kind', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_rewarded_ad(
	p_attempt_id uuid,
	p_provider_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	attempt public.rewarded_ad_attempts%ROWTYPE;
	existing public.rewarded_ad_grants%ROWTYPE;
	grant_id bigint;
	grants_in_window integer;
	balance integer;
BEGIN
	IF p_provider_transaction_id IS NULL
		OR length(p_provider_transaction_id) NOT BETWEEN 1 AND 200
		OR p_provider_transaction_id !~ '^[A-Za-z0-9._:-]+$' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_transaction');
	END IF;

	SELECT * INTO existing FROM public.rewarded_ad_grants
	WHERE provider = 'admob' AND provider_transaction_id = p_provider_transaction_id;
	IF FOUND THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'idempotent');
	END IF;

	SELECT * INTO attempt FROM public.rewarded_ad_attempts
	WHERE id = p_attempt_id FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_attempt');
	END IF;
	IF attempt.status = 'verified' THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'idempotent');
	END IF;
	IF attempt.status NOT IN ('reserved', 'started') OR attempt.expires_at <= now() THEN
		UPDATE public.rewarded_ad_attempts SET status = 'rejected' WHERE id = attempt.id;
		RETURN jsonb_build_object('ok', false, 'reason', 'expired_attempt');
	END IF;

	PERFORM 1 FROM public.profiles WHERE id = attempt.user_id FOR UPDATE;
	SELECT COUNT(*)::integer INTO grants_in_window
	FROM public.rewarded_ad_grants
	WHERE user_id = attempt.user_id AND granted_at > now() - interval '24 hours';
	IF grants_in_window >= attempt.rolling_limit THEN
		UPDATE public.rewarded_ad_attempts SET status = 'rejected' WHERE id = attempt.id;
		RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
	END IF;

	INSERT INTO public.rewarded_ad_grants(
		provider, provider_transaction_id, attempt_id, user_id, amount
	) VALUES (
		'admob', p_provider_transaction_id, attempt.id, attempt.user_id, attempt.reward_amount
	)
	ON CONFLICT DO NOTHING
	RETURNING id INTO grant_id;
	IF grant_id IS NULL THEN
		RETURN jsonb_build_object('ok', true, 'kind', 'idempotent');
	END IF;

	UPDATE public.user_items
	SET sponsor_tickle_count = sponsor_tickle_count + attempt.reward_amount
	WHERE user_id = attempt.user_id;
	UPDATE public.rewarded_ad_attempts
	SET status = 'verified', verified_at = now(),
		provider_transaction_id = p_provider_transaction_id
	WHERE id = attempt.id;

	SELECT COALESCE((public.tickle_info(attempt.user_id)->>'balance')::integer, 0)
		+ sponsor_tickle_count INTO balance
	FROM public.user_items WHERE user_id = attempt.user_id;
	RETURN jsonb_build_object(
		'ok', true, 'kind', 'verified',
		'reward_amount', attempt.reward_amount, 'balance', balance
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_home_tickle(uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	result jsonb;
	sponsored boolean := false;
	sponsor_remaining integer;
BEGIN
	IF auth.uid() IS NULL OR auth.uid() <> uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_owner');
	END IF;
	PERFORM 1 FROM public.user_items WHERE user_id = uid FOR UPDATE;
	UPDATE public.user_items
	SET sponsor_tickle_count = sponsor_tickle_count - 1,
		item_count = item_count + 1
	WHERE user_id = uid AND sponsor_tickle_count > 0;
	sponsored := FOUND;

	result := public.update_profile_and_item_count(uid);
	IF sponsored THEN
		INSERT INTO public.rewarded_ad_consumptions(user_id) VALUES (uid);
	END IF;
	SELECT sponsor_tickle_count INTO sponsor_remaining
	FROM public.user_items WHERE user_id = uid;
	RETURN result || jsonb_build_object(
		'balance', COALESCE((result->>'balance')::integer, 0) + sponsor_remaining,
		'sponsor_balance', sponsor_remaining,
		'sponsored', sponsored
	);
END;
$$;

CREATE OR REPLACE FUNCTION public.report_rewarded_ad(p_attempt_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
	caller_id uuid := auth.uid();
	response_id text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_reason NOT IN ('inappropriate', 'age_inappropriate', 'misleading', 'other') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_reason');
	END IF;
	SELECT provider_response_id INTO response_id FROM public.rewarded_ad_attempts
	WHERE id = p_attempt_id AND user_id = caller_id;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	INSERT INTO public.rewarded_ad_reports(attempt_id, user_id, reason, provider_response_id)
	VALUES (p_attempt_id, caller_id, p_reason, response_id)
	ON CONFLICT (attempt_id, user_id) DO UPDATE
	SET reason = EXCLUDED.reason, reported_at = now();
	RETURN jsonb_build_object('ok', true);
END;
$$;

-- Latest home_stats() with the personal balance added to the Barn-only total.
CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof record;
	tickle jsonb;
	season jsonb;
	sponsor_balance integer;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	SELECT counter, tickles_earned, active_hat_id, active_glasses_id,
		active_mask_id, active_neck_id, active_aura_id, active_background_id,
		active_held_id, active_tickle_particle_id, active_flag_id, seen_67_at
	INTO prof FROM public.profiles WHERE id = caller_id;
	tickle := public.tickle_info(caller_id);
	season := public.season_state();
	SELECT sponsor_tickle_count INTO sponsor_balance
	FROM public.user_items WHERE user_id = caller_id;

	RETURN jsonb_build_object(
		'ok', true,
		'counter', COALESCE(prof.counter, 0),
		'tickles_earned', COALESCE(prof.tickles_earned, 0),
		'happiness', public.happiness_now(caller_id),
		'active_hat_id', prof.active_hat_id,
		'active_hat', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_hat_id),
		'active_glasses_id', prof.active_glasses_id,
		'active_glasses', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_glasses_id),
		'active_mask_id', prof.active_mask_id,
		'active_mask', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_mask_id),
		'active_neck_id', prof.active_neck_id,
		'active_neck', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_neck_id),
		'active_aura_id', prof.active_aura_id,
		'active_aura', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_aura_id),
		'active_background_id', prof.active_background_id,
		'active_background', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_background_id),
		'active_held_id', prof.active_held_id,
		'active_held', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_held_id),
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_tickle_particle_id),
		'active_flag_id', prof.active_flag_id,
		'active_flag', (SELECT jsonb_build_object('id', h.id, 'category', h.category, 'emoji', h.emoji) FROM public.hats h WHERE h.id = prof.active_flag_id),
		'balance', COALESCE((tickle->>'balance')::int, 0) + COALESCE(sponsor_balance, 0),
		'sponsor_balance', COALESCE(sponsor_balance, 0),
		'cap', COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds', tickle->'next_regen_seconds',
		'regen_seconds', public.regen_secs_for(caller_id),
		'seen_67_at', prof.seen_67_at,
		'current_tier', COALESCE((season->>'current_tier')::int, 1),
		'total_tiers', COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.rewarded_ad_offer_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_rewarded_ad_age_eligibility(boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reserve_rewarded_ad() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_rewarded_ad_started(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_rewarded_ad_attempt(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rewarded_ad_attempt_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_home_tickle(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_rewarded_ad(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.finalize_rewarded_ad(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.home_stats() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rewarded_ad_offer_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_rewarded_ad_age_eligibility(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_rewarded_ad() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_rewarded_ad_started(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_rewarded_ad_attempt(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rewarded_ad_attempt_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_home_tickle(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_rewarded_ad(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_rewarded_ad(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

-- pgTAP integration tests for the rewarded-ad server contract.
-- Run with: npx supabase test db

BEGIN;
SELECT plan(14);

DO $$
DECLARE
	viewer uuid := '00000000-0000-4000-8000-0000000000a1';
	requester uuid := '00000000-0000-4000-8000-0000000000a2';
BEGIN
	DELETE FROM auth.users WHERE id IN (viewer, requester);
	INSERT INTO auth.users (id, email, created_at) VALUES
		(viewer, 'reward-viewer@test.local', now()),
		(requester, 'reward-requester@test.local', now());
	INSERT INTO public.profiles(id, username, ads_age_eligible, ads_age_confirmed_at)
	VALUES
		(viewer, 'adviewer', true, now()),
		(requester, 'adrequester', true, now())
	ON CONFLICT (id) DO UPDATE SET
		ads_age_eligible = EXCLUDED.ads_age_eligible,
		ads_age_confirmed_at = EXCLUDED.ads_age_confirmed_at;
	INSERT INTO public.user_items(user_id, item_count, sponsor_tickle_count, last_increment)
	VALUES
		(viewer, 0, 0, now()),
		(requester, 0, 0, now())
	ON CONFLICT (user_id) DO UPDATE SET
		item_count = EXCLUDED.item_count,
		sponsor_tickle_count = EXCLUDED.sponsor_tickle_count,
		last_increment = EXCLUDED.last_increment;
	UPDATE public.app_config SET enabled = true WHERE key = 'rewarded_ads';
	UPDATE public.rewarded_ad_settings
		SET enabled = true, reward_amount = 3, rolling_limit = 1
		WHERE placement = 'ad_refill';
	PERFORM set_config(
		'request.jwt.claims',
		'{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}',
		true
	);
END
$$;

SELECT is(
	public.rewarded_ad_offer_status()->>'kind',
	'available',
	'an eligible empty bank receives the ad-refill offer'
);

CREATE TEMP TABLE test_rewarded_ad_state(attempt_id uuid PRIMARY KEY, reserve_result jsonb);
INSERT INTO test_rewarded_ad_state
SELECT (result->>'attempt_id')::uuid, result
FROM (SELECT public.reserve_rewarded_ad() AS result) reserved;

SELECT ok(
	(SELECT (reserve_result->>'ok')::boolean FROM test_rewarded_ad_state),
	'first reservation succeeds'
);

SELECT is(
	public.reserve_rewarded_ad()->>'reason',
	'limit_reached',
	'a live reservation prevents a second-device over-cap attempt'
);

CREATE TEMP TABLE test_rewarded_ad_finalize(result jsonb);
INSERT INTO test_rewarded_ad_finalize
SELECT public.finalize_rewarded_ad(
	(SELECT attempt_id FROM test_rewarded_ad_state),
	'admob-test-transaction-1'
);

SELECT ok(
	(SELECT (result->>'ok')::boolean FROM test_rewarded_ad_finalize),
	'service finalization succeeds'
);

SELECT is(
	(SELECT sponsor_tickle_count FROM public.user_items
	 WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
	3,
	'verified callback grants three personal tickles'
);

SELECT is(
	public.finalize_rewarded_ad(
		(SELECT attempt_id FROM test_rewarded_ad_state),
		'admob-test-transaction-1'
	)->>'kind',
	'idempotent',
	'a duplicate provider callback is acknowledged idempotently'
);

SELECT is(
	(SELECT sponsor_tickle_count FROM public.user_items
	 WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
	3,
	'a duplicate callback does not double-grant'
);

CREATE TEMP TABLE test_rewarded_ad_trade(result jsonb);
DO $$
DECLARE
	trade_id uuid;
BEGIN
	INSERT INTO public.tickle_trades(requester_id, target_id, amount, status)
	VALUES (
		'00000000-0000-4000-8000-0000000000a2',
		'00000000-0000-4000-8000-0000000000a1',
		1,
		'pending'
	) RETURNING id INTO trade_id;
	INSERT INTO test_rewarded_ad_trade
	SELECT public.fulfill_tickle_trade(trade_id);
END
$$;

SELECT is(
	(SELECT result->>'reason' FROM test_rewarded_ad_trade),
	'insufficient_bank',
	'personal tickles cannot fund trades'
);

CREATE TEMP TABLE test_rewarded_ad_home_before(counter bigint);
INSERT INTO test_rewarded_ad_home_before
SELECT counter FROM public.profiles
WHERE id = '00000000-0000-4000-8000-0000000000a1';
DO $$
BEGIN
	PERFORM public.update_home_tickle('00000000-0000-4000-8000-0000000000a1');
END
$$;

SELECT is(
	(SELECT sponsor_tickle_count FROM public.user_items
	 WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
	2,
	'a home tap consumes the personal balance first'
);
SELECT is(
	(SELECT counter FROM public.profiles
	 WHERE id = '00000000-0000-4000-8000-0000000000a1')
		- (SELECT counter FROM test_rewarded_ad_home_before),
	1::bigint,
	'a sponsored home tap scores exactly once'
);
SELECT is(
	(SELECT count(*)::int FROM public.rewarded_ad_consumptions
	 WHERE user_id = '00000000-0000-4000-8000-0000000000a1'),
	1,
	'sponsored consumption is ledgered for the leaderboard receipt'
);

SELECT is(
	(public.tickle_breakdown('00000000-0000-4000-8000-0000000000a1')->>'ads')::int,
	1,
	'the receipt reports sponsored home taps in the ad-refill lane'
);

SELECT ok(
	NOT has_function_privilege('authenticated', 'public.finalize_rewarded_ad(uuid,text)', 'EXECUTE'),
	'authenticated clients cannot finalize rewards'
);
SELECT ok(
	has_function_privilege('service_role', 'public.finalize_rewarded_ad(uuid,text)', 'EXECUTE'),
	'the Edge Function service role can finalize rewards'
);

SELECT * FROM finish();
ROLLBACK;

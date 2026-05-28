-- pgTAP integration tests for the referral engagement gate.
--
-- These are FIXTURE-based tests that create two auth.users, exercise
-- the full referral flow end-to-end, and assert every state transition.
-- Unlike 00_pure_functions.sql (which tests fixture-free pure logic),
-- this test commits NO state — everything runs inside a transaction
-- that ROLLBACKs at the end.
--
-- Run with:  npx supabase test db   (requires `supabase start` first)
--
-- Companion to docs/referrals-debug.md and docs/referrals.md.
-- If this test fails, the engagement gate is broken — the inviter
-- credit either won't fire or fires at the wrong time. Most likely
-- cause: a future migration redefined update_profile_and_item_count
-- without re-including the engagement-gate block at the bottom.

BEGIN;
SELECT plan(15);

-- ── Fixture setup ────────────────────────────────────────────────
-- Two auth.users: one inviter, one invitee. The handle_new_user
-- trigger should auto-create profile rows + a referral_code for
-- each via the trigger defined in 20260566000000_referrals.sql:143.

-- Use deterministic UUIDs so failure messages are readable.
DO $$
DECLARE
    inviter_uid uuid := '00000000-0000-0000-0000-000000000001';
    invitee_uid uuid := '00000000-0000-0000-0000-000000000002';
BEGIN
    -- Clean slate: in case a previous run left stale fixtures around.
    DELETE FROM auth.users WHERE id IN (inviter_uid, invitee_uid);

    -- Create inviter. The handle_new_user trigger creates profile +
    -- user_items + referral_code. Username is set after-the-fact since
    -- the trigger leaves it NULL (per the spec).
    INSERT INTO auth.users (id, email, created_at)
    VALUES (inviter_uid, 'inviter@test.local', now() - interval '7 days');

    -- Create invitee — 1 hour old so they're inside the 24h redemption
    -- window but past any "just-created" edge cases.
    INSERT INTO auth.users (id, email, created_at)
    VALUES (invitee_uid, 'invitee@test.local', now() - interval '1 hour');

    -- Set usernames so my_referral_summary regenerates the codes
    -- with a real prefix (otherwise they'd stay as PIGXX-XXXX).
    UPDATE public.profiles SET username = 'invitr' WHERE id = inviter_uid;
    UPDATE public.profiles SET username = 'inviti' WHERE id = invitee_uid;

    -- Force the code regeneration path so we get a stable, predictable
    -- code on the inviter.
    UPDATE public.profiles SET referral_code = NULL WHERE id = inviter_uid;
    PERFORM public.generate_referral_code(inviter_uid);
END
$$;

-- ── Smoke: fixtures exist ────────────────────────────────────────

SELECT ok(
    EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
    'inviter profile auto-created via handle_new_user trigger'
);

SELECT ok(
    EXISTS (SELECT 1 FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
    'invitee profile auto-created via handle_new_user trigger'
);

SELECT ok(
    (SELECT referral_code FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001') IS NOT NULL,
    'inviter has a referral code'
);

-- ── Redemption: invitee enters the inviter's code ────────────────
-- Impersonate the invitee. SECURITY DEFINER on redeem_referral_code
-- uses auth.uid() — we set it via local config.

DO $$
DECLARE
    inviter_code text;
    result jsonb;
BEGIN
    SELECT referral_code INTO inviter_code FROM public.profiles
        WHERE id = '00000000-0000-0000-0000-000000000001';

    -- Set JWT claims to the invitee so auth.uid() returns invitee_uid.
    PERFORM set_config(
        'request.jwt.claims',
        '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}',
        true
    );

    result := public.redeem_referral_code(inviter_code);

    -- Verify the result shape.
    PERFORM ok(
        (result->>'ok')::boolean = true,
        'redeem_referral_code returned ok=true: ' || result::text
    );
    PERFORM is(
        result->>'inviter_username',
        'invitr',
        'redeem returned the inviter username'
    );
END
$$;

-- ── State after redemption ───────────────────────────────────────

SELECT is(
    (SELECT referred_by FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
    '00000000-0000-0000-0000-000000000001'::uuid,
    'invitee.referred_by is set to the inviter'
);

SELECT ok(
    (SELECT referral_redeemed_at FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002') IS NOT NULL,
    'invitee.referral_redeemed_at is set'
);

SELECT cmp_ok(
    (SELECT counter FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
    '>=',
    50,
    'invitee got the +50 snouts from redemption'
);

SELECT ok(
    (SELECT referral_completed_at FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002') IS NULL,
    'engagement gate has NOT fired yet (invitee has 0 tickles)'
);

-- ── Cross the engagement gate ────────────────────────────────────
-- Bypass the tickle-bank regen math by writing directly to the
-- profile + active-days columns. The gate reads from profiles, so
-- this is a faithful simulation of the threshold-crossing tickle.
--
-- Strategy: set invitee to (tickles_earned = 99, distinct_active_days
-- = 3, last_active_date = today - 1 day) so the next call to
-- update_profile_and_item_count bumps tickles_earned to 100 AND
-- triggers the active-day bump (yesterday→today), crossing both
-- conditions on a single tickle.

DO $$
BEGIN
    UPDATE public.profiles
        SET tickles_earned       = 99,
            distinct_active_days = 2,   -- next tickle bumps to 3
            last_active_date     = CURRENT_DATE - interval '1 day'
        WHERE id = '00000000-0000-0000-0000-000000000002';

    -- The tickle-bank machinery needs a non-zero item_count to do the
    -- decrement, otherwise the function returns early before reaching
    -- the gate block. Ensure the invitee has at least 1 tickle to spend.
    UPDATE public.user_items
        SET item_count = 5,
            last_increment = now()
        WHERE user_id = '00000000-0000-0000-0000-000000000002';
END
$$;

-- Snapshot inviter state pre-gate.
SELECT cmp_ok(
    (SELECT counter FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001'),
    '>=',
    0,
    'inviter pre-gate counter is queryable'
);

-- Fire the tickle as the invitee.
DO $$
DECLARE
    pre_inviter_snouts bigint;
    post_inviter_snouts bigint;
    post_completed_count int;
BEGIN
    SELECT counter INTO pre_inviter_snouts FROM public.profiles
        WHERE id = '00000000-0000-0000-0000-000000000001';

    PERFORM set_config(
        'request.jwt.claims',
        '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}',
        true
    );

    PERFORM public.update_profile_and_item_count('00000000-0000-0000-0000-000000000002'::uuid);

    SELECT counter, referrals_completed
        INTO post_inviter_snouts, post_completed_count
        FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';

    PERFORM is(
        post_inviter_snouts - pre_inviter_snouts,
        100::bigint,
        'inviter counter went up by exactly 100 (engagement gate fired)'
    );

    PERFORM is(
        post_completed_count,
        1,
        'inviter referrals_completed incremented to 1'
    );
END
$$;

-- ── State after gate fires ───────────────────────────────────────

SELECT ok(
    (SELECT referral_completed_at FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002') IS NOT NULL,
    'invitee.referral_completed_at is now set'
);

SELECT cmp_ok(
    (SELECT tickles_earned FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
    '>=',
    100,
    'invitee tickles_earned is at or above the threshold'
);

SELECT cmp_ok(
    (SELECT distinct_active_days FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000002'),
    '>=',
    3,
    'invitee distinct_active_days is at or above the threshold'
);

-- ── Idempotency: gate must NOT fire twice ────────────────────────
-- Another tickle should be a no-op for the referral subsystem.

DO $$
DECLARE
    pre_inviter_snouts bigint;
    post_inviter_snouts bigint;
BEGIN
    SELECT counter INTO pre_inviter_snouts FROM public.profiles
        WHERE id = '00000000-0000-0000-0000-000000000001';

    -- Refill the invitee's bank for one more tickle.
    UPDATE public.user_items
        SET item_count = 5,
            last_increment = now()
        WHERE user_id = '00000000-0000-0000-0000-000000000002';

    PERFORM set_config(
        'request.jwt.claims',
        '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}',
        true
    );

    PERFORM public.update_profile_and_item_count('00000000-0000-0000-0000-000000000002'::uuid);

    SELECT counter INTO post_inviter_snouts FROM public.profiles
        WHERE id = '00000000-0000-0000-0000-000000000001';

    -- Gate should NOT have fired again — inviter counter only changes
    -- by the +5 from a lucky tickle (if landed), never by +100 again.
    PERFORM cmp_ok(
        post_inviter_snouts - pre_inviter_snouts,
        '<',
        100::bigint,
        'inviter did NOT get another +100 — gate is idempotent'
    );
END
$$;

-- ── Cleanup ──────────────────────────────────────────────────────
SELECT finish();
ROLLBACK;

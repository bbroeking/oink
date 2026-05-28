-- diagnose-referral.sql
--
-- Paste into Supabase Studio's SQL editor with the invitee's username
-- substituted on the WHERE clause below. Returns one row showing every
-- field the referral engagement gate cares about, plus a derived
-- 'gate_state' column that names exactly which condition is failing.
--
-- Use this when someone reports "my friend used my code and I never
-- got my +100 snouts." Run with the INVITEE's username (the friend
-- who entered the code), not the inviter's.
--
-- Companion to docs/referrals-debug.md.

WITH invitee AS (
    SELECT
        p.id                       AS invitee_id,
        p.username                 AS invitee_username,
        p.referred_by              AS referred_by_id,
        p.referral_redeemed_at,
        p.referral_completed_at,
        p.tickles_earned,
        p.distinct_active_days,
        p.last_active_date,
        p.counter                  AS invitee_snouts,
        p.created_at               AS invitee_created_at
    FROM public.profiles p
    WHERE p.username = '<INVITEE_USERNAME>'   -- ← edit me
),
inviter AS (
    SELECT
        p.username                 AS inviter_username,
        p.counter                  AS inviter_snouts,
        p.referrals_completed      AS inviter_completed_count,
        p.referral_code            AS inviter_code
    FROM public.profiles p
    JOIN invitee i ON p.id = i.referred_by_id
)
SELECT
    i.invitee_username,
    i.invitee_id,
    i.invitee_created_at,
    inv.inviter_username,
    inv.inviter_code,
    i.referral_redeemed_at,
    i.tickles_earned,
    i.distinct_active_days,
    i.last_active_date,
    i.referral_completed_at,
    inv.inviter_completed_count,
    inv.inviter_snouts,
    i.invitee_snouts,
    -- Derived state: which condition (if any) is blocking the gate?
    CASE
        WHEN i.referred_by_id IS NULL THEN
            'BLOCKED: invitee never redeemed (no referred_by)'
        WHEN i.referral_completed_at IS NOT NULL THEN
            'COMPLETE: gate already fired at ' || i.referral_completed_at::text
        WHEN i.tickles_earned < 100 AND i.distinct_active_days < 3 THEN
            'PENDING: needs ' || (100 - i.tickles_earned)::text
            || ' more tickles AND '
            || (3 - i.distinct_active_days)::text || ' more active days'
        WHEN i.tickles_earned < 100 THEN
            'PENDING: needs ' || (100 - i.tickles_earned)::text || ' more tickles'
        WHEN i.distinct_active_days < 3 THEN
            'PENDING: needs ' || (3 - i.distinct_active_days)::text || ' more active days'
        ELSE
            'BUG: thresholds met but referral_completed_at is NULL — check function definition'
    END AS gate_state
FROM invitee i
LEFT JOIN inviter inv ON true;

-- If gate_state ends with "check function definition", run this to
-- verify the engagement-gate block is still present in the live
-- update_profile_and_item_count function:
--
--   SELECT pg_get_functiondef('public.update_profile_and_item_count'::regproc);
--
-- The output must contain the comment "── Referral engagement gate ───".
-- If it doesn't, a future migration redefined the function without
-- preserving the gate block. Restore by re-running the relevant section
-- of 20260566000000_referrals.sql.

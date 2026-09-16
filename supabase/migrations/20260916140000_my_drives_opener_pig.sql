-- The Trough by the counter (Storefront build 2, SKILL.md 2026-09-16): each open
-- drive is a row with the OPENER'S PIG at its head, the way the sounder stands
-- at the counter wearing today's buys. my_drives() carried its rows without
-- the opener's pig, so the client could only draw Rosie; this adds
-- `opener_pig_id` (profiles.active_pig_id — the companion the opener has out,
-- 'rosie' for everyone without one).
--
-- my_drives() carried VERBATIM from 20260622000000_trough_clarity_and_xp.sql
-- (the latest definition — 20260782 only stamped receipts; it did not redefine
-- the function) plus the one new key. Carry-latest-def rule: nothing else here
-- changes.

CREATE OR REPLACE FUNCTION public.my_drives()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'balance', COALESCE((SELECT counter FROM public.profiles WHERE id = caller_id), 0),
		'donated_today', EXISTS (
			SELECT 1 FROM public.item_drive_donations
			WHERE donor_user_id = caller_id
			  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
		),
		'drives', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', dr.id, 'item_id', dr.item_id,
				'item_name', h.name,
				'opener_id', dr.opener_user_id,
				'opener_name', op.username,
				'opener_pig_id', op.active_pig_id,
				'target', dr.target_snouts, 'raised', dr.raised_snouts,
				'status', dr.status, 'closes_at', dr.closes_at,
				'is_mine', dr.opener_user_id = caller_id,
				'donor_count', (
					SELECT count(DISTINCT dd.donor_user_id)
					FROM public.item_drive_donations dd WHERE dd.drive_id = dr.id),
				'my_contribution', (
					SELECT COALESCE(sum(dd.snouts), 0)
					FROM public.item_drive_donations dd
					WHERE dd.drive_id = dr.id AND dd.donor_user_id = caller_id)
			) ORDER BY dr.closes_at ASC)
			FROM public.item_drives dr
			JOIN public.profiles op ON op.id = dr.opener_user_id
			LEFT JOIN public.hats h ON h.id = dr.item_id
			WHERE dr.status = 'open' AND dr.closes_at > now()
			  AND (dr.opener_user_id = caller_id
			       OR public.are_friends(caller_id, dr.opener_user_id))
		), '[]'::jsonb),
		'claimable', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'donation_id', dd.id, 'drive_id', dd.drive_id,
				'tickle_reward', dd.tickle_reward, 'item_id', dr.item_id,
				'item_name', h.name))
			FROM public.item_drive_donations dd
			JOIN public.item_drives dr ON dr.id = dd.drive_id
			LEFT JOIN public.hats h ON h.id = dr.item_id
			WHERE dd.donor_user_id = caller_id
			  AND dd.reward_claimed_at IS NULL
			  AND dr.status = 'funded'
		), '[]'::jsonb)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_drives() TO authenticated;

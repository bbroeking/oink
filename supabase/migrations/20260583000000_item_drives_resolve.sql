-- The Trough — backend part 2: expiry/refund, reward claiming, read RPCs.
-- Depends on grant_tickles (settle_tickles migration) for the over-cap reward.

-- ── resolve_expired_drives: refund everyone on any open drive past its 48h ──
-- window that never funded. Lazy-callable (read/donate paths) and cron-safe.
CREATE OR REPLACE FUNCTION public.resolve_expired_drives()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	d        record;
	donated  int;
	seed     int;
	n        int := 0;
BEGIN
	FOR d IN
		SELECT * FROM public.item_drives
		WHERE status = 'open' AND closes_at <= now()
		FOR UPDATE SKIP LOCKED
	LOOP
		-- Refund every donor their snouts.
		UPDATE public.profiles p
			SET counter = counter + dd.snouts
			FROM public.item_drive_donations dd
			WHERE dd.drive_id = d.id AND p.id = dd.donor_user_id;

		-- Refund the opener's seed (raised minus everything donated).
		SELECT COALESCE(SUM(snouts), 0) INTO donated
			FROM public.item_drive_donations WHERE drive_id = d.id;
		seed := d.raised_snouts - donated;
		IF seed > 0 THEN
			UPDATE public.profiles SET counter = counter + seed
				WHERE id = d.opener_user_id;
		END IF;

		UPDATE public.item_drives SET status = 'expired' WHERE id = d.id;
		n := n + 1;
	END LOOP;
	RETURN n;
END;
$function$;

-- ── claim_drive_reward: donor banks their tickle reward once the drive funded ─
CREATE OR REPLACE FUNCTION public.claim_drive_reward(donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	don       public.item_drive_donations;
	drive_status text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO don FROM public.item_drive_donations
		WHERE id = donation_id FOR UPDATE;
	IF don.id IS NULL OR don.donor_user_id <> caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
	END IF;
	IF don.reward_claimed_at IS NOT NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
	END IF;

	SELECT status INTO drive_status FROM public.item_drives WHERE id = don.drive_id;
	IF drive_status <> 'funded' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_funded');
	END IF;

	-- Over-cap grant — the reward can push past the tickle cap.
	PERFORM public.grant_tickles(caller_id, don.tickle_reward);
	UPDATE public.item_drive_donations SET reward_claimed_at = now()
		WHERE id = donation_id;

	RETURN jsonb_build_object('ok', true, 'tickles', don.tickle_reward);
END;
$function$;

-- ── my_drives: open Troughs in the caller's Sounder (friends' + own), plus the
-- caller's claimable rewards. Resolves expiries first so the list is fresh. ──
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
		'drives', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'id', dr.id, 'item_id', dr.item_id,
				'opener_id', dr.opener_user_id,
				'opener_name', op.username,
				'target', dr.target_snouts, 'raised', dr.raised_snouts,
				'status', dr.status, 'closes_at', dr.closes_at,
				'is_mine', dr.opener_user_id = caller_id
			) ORDER BY dr.closes_at ASC)
			FROM public.item_drives dr
			JOIN public.profiles op ON op.id = dr.opener_user_id
			WHERE dr.status = 'open' AND dr.closes_at > now()
			  AND (dr.opener_user_id = caller_id
			       OR public.are_friends(caller_id, dr.opener_user_id))
		), '[]'::jsonb),
		'claimable', COALESCE((
			SELECT jsonb_agg(jsonb_build_object(
				'donation_id', dd.id, 'drive_id', dd.drive_id,
				'tickle_reward', dd.tickle_reward, 'item_id', dr.item_id))
			FROM public.item_drive_donations dd
			JOIN public.item_drives dr ON dr.id = dd.drive_id
			WHERE dd.donor_user_id = caller_id
			  AND dd.reward_claimed_at IS NULL
			  AND dr.status = 'funded'
		), '[]'::jsonb)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resolve_expired_drives() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_drive_reward(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_drives() TO authenticated;

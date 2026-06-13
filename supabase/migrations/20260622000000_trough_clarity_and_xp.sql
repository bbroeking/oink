-- Trough (item-drive) clarity + rewards pass.
--
-- 1. my_drives(): surface what the card needs to be legible —
--    • balance         : caller's snouts (so the UI can show "you have N" + cap Max)
--    • donated_today   : has the caller donated to ANY drive today (UTC)? — drives
--                        the "+5 XP" affordance, since XP is first-donation-per-day
--    • per drive: item_name (was only item_id), donor_count, my_contribution
--    • claimable rows also carry item_name now.
--
-- 2. donate_to_drive(): two reward changes (rebased on the 20260619 inline-
--    announcement fix — that fix is preserved here verbatim):
--    • Tickle reward rate 2:1 → 10:1 (floor(snouts/10)). Still paid out only when
--      the drive funds. "Give 10, get 1."
--    • +5 season XP on the caller's FIRST donation of the UTC day (anti-farm,
--      mirrors bury_truffle / send_blessing). Returns `xp` so the client confirms.

-- ── my_drives v2 ─────────────────────────────────────────────────────────────
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

-- ── donate_to_drive v3 ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.donate_to_drive(drive_id uuid, snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id   uuid := auth.uid();
	d           public.item_drives;
	bal         bigint;
	reward      int;
	now_raised  int;
	item_name   text;
	op_name     text;
	donor_row   record;
	first_today boolean;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_amount');
	END IF;

	SELECT * INTO d FROM public.item_drives WHERE id = drive_id FOR UPDATE;
	IF d.id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_drive');
	END IF;
	IF d.status <> 'open' OR d.closes_at <= now() THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'drive_closed');
	END IF;
	IF d.opener_user_id = caller_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'self');  -- opener seeds via open
	END IF;
	-- Sounder-scoped: only the opener's friends can donate.
	IF NOT public.are_friends(caller_id, d.opener_user_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	-- Donating cooldown: once every 12 hours.
	IF EXISTS (
		SELECT 1 FROM public.item_drive_donations
		WHERE donor_user_id = caller_id AND created_at > now() - interval '12 hours'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'donate_cooldown');
	END IF;

	-- Never take more than the remaining gap.
	snouts := LEAST(snouts, d.target_snouts - d.raised_snouts);
	IF snouts <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_funded');
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', snouts);
	END IF;

	-- First donation of the UTC day? (checked before this donation's row exists)
	SELECT NOT EXISTS (
		SELECT 1 FROM public.item_drive_donations
		WHERE donor_user_id = caller_id
		  AND (created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date
	) INTO first_today;

	UPDATE public.profiles SET counter = counter - snouts WHERE id = caller_id;

	reward := floor(snouts / 10.0);  -- 10 snouts -> 1 tickle (paid out when funded)
	INSERT INTO public.item_drive_donations (drive_id, donor_user_id, snouts, tickle_reward)
		VALUES (drive_id, caller_id, snouts, reward);

	now_raised := d.raised_snouts + snouts;
	UPDATE public.item_drives SET raised_snouts = now_raised WHERE id = drive_id;

	-- Funded → grant the item to the opener; donor rewards become claimable;
	-- tell the opener + every donor. (Inline INSERTs, not send_system_announcement,
	-- which is admin-gated and would roll back the donation for non-admins.)
	IF now_raised >= d.target_snouts THEN
		UPDATE public.item_drives
			SET status = 'funded', granted_at = now() WHERE id = drive_id;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (d.opener_user_id, d.item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		SELECT username INTO op_name FROM public.profiles WHERE id = d.opener_user_id;

		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_funded',
			'Your Trough filled!',
			'Your Sounder came through — the ' || COALESCE(item_name, 'item')
				|| ' is yours!',
			jsonb_build_object('drive_id', drive_id));

		FOR donor_row IN
			SELECT DISTINCT donor_user_id FROM public.item_drive_donations
			WHERE drive_id = d.id
		LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				donor_row.donor_user_id, 'trough_funded',
				'You helped land it!',
				'Thanks to you, ' || COALESCE(op_name, 'a friend') || ' got the '
					|| COALESCE(item_name, 'item') || '. Claim your tickles!',
				jsonb_build_object('drive_id', drive_id));
		END LOOP;
	END IF;

	-- Reward the donor's engagement: +5 season XP on the first donation of the day.
	IF first_today THEN PERFORM public.grant_season_xp(caller_id, 5); END IF;

	RETURN jsonb_build_object('ok', true, 'reward', reward,
		'raised', now_raised, 'target', d.target_snouts,
		'funded', now_raised >= d.target_snouts,
		'xp', CASE WHEN first_today THEN 5 ELSE 0 END);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

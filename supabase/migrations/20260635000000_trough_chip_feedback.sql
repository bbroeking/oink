-- Trough opener feedback: every chip-in notifies the opener (WhileAway note
-- with who/how much/how far to go). Funded chips skip the extra note — the
-- trough_funded announcement already covers that moment. Body carried from
-- 20260633 (latest) apart from this block; op_name/item_name vars are
-- DECLAREd already and re-SELECTed safely by the funded path.

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
	-- Donating cooldown: once every 12 hours PER DRIVE (was global across all
	-- drives — chipping into one friend's Trough locked out every other
	-- friend's for 12h). dd. alias is load-bearing: unqualified drive_id here
	-- is ambiguous against the function parameter (the 20260626 42702 bug).
	IF EXISTS (
		SELECT 1 FROM public.item_drive_donations dd
		WHERE dd.donor_user_id = caller_id
		  AND dd.drive_id = d.id
		  AND dd.created_at > now() - interval '12 hours'
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

	-- Opener-side feedback: every chip-in drops a note into the opener's
	-- WhileAway feed ("Jen chipped in 25 — 1,775 to go"). Funded chips skip
	-- this — the funded announcement below already covers the moment.
	-- (Inline INSERT, never send_system_announcement: admin-gated rollback.)
	IF now_raised < d.target_snouts THEN
		SELECT username INTO op_name FROM public.profiles WHERE id = caller_id;
		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		INSERT INTO public.system_announcements (user_id, kind, title, body, data)
		VALUES (
			d.opener_user_id, 'trough_chip',
			COALESCE(op_name, 'A friend') || ' chipped in!',
			COALESCE(op_name, 'A friend') || ' put ' || snouts || ' snouts in your '
				|| COALESCE(item_name, 'item') || ' Trough — '
				|| (d.target_snouts - now_raised) || ' to go.',
			jsonb_build_object('drive_id', drive_id));
	END IF;

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
			SELECT DISTINCT dd.donor_user_id FROM public.item_drive_donations dd
			WHERE dd.drive_id = d.id
		LOOP
			INSERT INTO public.system_announcements (user_id, kind, title, body, data)
			VALUES (
				donor_row.donor_user_id, 'trough_funded',
				'You helped land it!',
				'Thanks to you, ' || COALESCE(op_name, 'a friend') || ' got the '
					|| COALESCE(item_name, 'item') || '. Claim your snouts & score!',
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

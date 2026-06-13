-- Fix (same class as 20260618 / dig_truffle): donate_to_drive silently rolled
-- back the ENTIRE donation at the funding moment for every NON-admin donor.
--
-- When a donation pushes a Trough to its target, donate_to_drive called
-- send_system_announcement(...) to notify the opener and every donor. That
-- wrapper is admin-gated (RAISE EXCEPTION 'admin_only' unless caller.is_test —
-- 20260556_system_announcements.sql). donate_to_drive is one SECURITY DEFINER
-- transaction, so for a normal donor the exception rolled back the donor's snout
-- deduction, the donation row, the item grant to the opener, and the
-- status='funded' update. Crowd-funded item drives could never complete for a
-- normal Sounder — the funding donation looked like it spent snouts then
-- refunded them, and the item never granted. It only "worked" when the funding
-- donor happened to be an is_test admin. Earlier (non-funding) donations
-- succeeded because they never enter the IF now_raised >= target branch, making
-- this an intermittent failure that struck exactly at the payoff moment.
--
-- Fix: these are SECURITY DEFINER, so INSERT the announcement rows directly into
-- system_announcements (same pattern as tickle_at_barn and the dig_truffle fix
-- in 20260618). Best-effort push is dropped (push isn't wired yet — missing
-- aps-environment entitlement); the rows surface via the WhileAway modal. Logic
-- is otherwise byte-for-byte the live 20260582 version.

CREATE OR REPLACE FUNCTION public.donate_to_drive(drive_id uuid, snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	d         public.item_drives;
	bal       bigint;
	reward    int;
	now_raised int;
	item_name text;
	op_name   text;
	donor_row record;
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

	UPDATE public.profiles SET counter = counter - snouts WHERE id = caller_id;

	reward := floor(snouts / 2.0);  -- 2 snouts -> 1 tickle
	INSERT INTO public.item_drive_donations (drive_id, donor_user_id, snouts, tickle_reward)
		VALUES (drive_id, caller_id, snouts, reward);

	now_raised := d.raised_snouts + snouts;
	UPDATE public.item_drives SET raised_snouts = now_raised WHERE id = drive_id;

	-- Funded → grant the item to the opener; donor rewards become claimable;
	-- tell the opener + every donor.
	IF now_raised >= d.target_snouts THEN
		UPDATE public.item_drives
			SET status = 'funded', granted_at = now() WHERE id = drive_id;
		INSERT INTO public.user_hats (user_id, hat_id)
			VALUES (d.opener_user_id, d.item_id)
			ON CONFLICT (user_id, hat_id) DO NOTHING;

		SELECT name INTO item_name FROM public.hats WHERE id = d.item_id;
		SELECT username INTO op_name FROM public.profiles WHERE id = d.opener_user_id;

		-- Inline the announcement INSERTs instead of send_system_announcement() —
		-- that wrapper is admin-gated and would abort this whole donation for
		-- non-admins.
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

	RETURN jsonb_build_object('ok', true, 'reward', reward,
		'raised', now_raised, 'target', d.target_snouts,
		'funded', now_raised >= d.target_snouts);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

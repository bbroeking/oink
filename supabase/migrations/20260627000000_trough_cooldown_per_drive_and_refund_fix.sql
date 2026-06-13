-- Trough feedback pass (from live play, build 93 era):
--
-- 1. PER-DRIVE donate cooldown. The 12h cooldown was GLOBAL across all drives:
--    chipping into Jen's Trough blocked you from helping Mors/Sivan/Freddy for
--    12h. Backwards for a social feature — you should be able to help every
--    friend's Trough back-to-back, throttled per-Trough. The cooldown is now
--    scoped to (donor, drive): once per 12h PER TROUGH.
--    Faucet note: this widens the 10:1 tickle-reward throughput from ~2
--    donations/day to ~2/day/drive. Sounder size + the opener's 3-day drive
--    cooldown keep it bounded; revisit with a per-day reward cap if analytics
--    show whale-pair farming.
--
-- 2. EXPIRY REFUND BUG. resolve_expired_drives refunded donors with
--    `UPDATE profiles p SET counter = counter + dd.snouts FROM donations dd`,
--    which applies ONE arbitrary matching row per donor — a donor with
--    multiple chips into the same drive was refunded only one of them.
--    Latent today (multi-chip per drive was possible across days); becomes
--    common with the per-drive cooldown (one chip per 12h per drive). Fixed
--    with a per-donor SUM.
--
-- donate_to_drive body otherwise verbatim from 20260626 (which fixed the
-- funded-loop 42702 ambiguity); cooldown subquery aliased (dd.) to avoid
-- reintroducing the same param-vs-column landmine.

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

-- ── resolve_expired_drives: per-donor SUM refund ─────────────────────────────
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
		-- Refund every donor the SUM of their chips. (The previous
		-- UPDATE ... FROM donations applied ONE arbitrary row per donor,
		-- shorting anyone who chipped more than once into the same drive.)
		UPDATE public.profiles p
			SET counter = p.counter + r.total
			FROM (
				SELECT donor_user_id, SUM(snouts) AS total
				FROM public.item_drive_donations
				WHERE drive_id = d.id
				GROUP BY donor_user_id
			) r
			WHERE p.id = r.donor_user_id;

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

GRANT EXECUTE ON FUNCTION public.resolve_expired_drives() TO authenticated;

-- The Trough — friend-funded item drives (backend, part 1: schema + open/donate).
-- See docs/trough-pool-spec.md. Opener seeds >=10% of an item's price, their
-- Sounder donates the rest; when it funds, the opener gets the item and donors
-- get a claimable tickle reward (2 snouts -> 1 tickle). 48h window. No raffle.
--
-- Part 2 (separate migration) adds expiry/refund resolution, claim_drive_reward,
-- and the read RPCs.

CREATE TABLE IF NOT EXISTS public.item_drives (
	id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	item_id        text        NOT NULL REFERENCES public.hats(id) ON DELETE CASCADE,
	opener_user_id uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	target_snouts  int         NOT NULL,
	raised_snouts  int         NOT NULL DEFAULT 0,
	status         text        NOT NULL DEFAULT 'open',  -- open | funded | expired
	opens_at       timestamptz NOT NULL DEFAULT now(),
	closes_at      timestamptz NOT NULL,
	granted_at     timestamptz
);

CREATE INDEX IF NOT EXISTS item_drives_opener_idx ON public.item_drives (opener_user_id, opens_at DESC);
CREATE INDEX IF NOT EXISTS item_drives_open_idx ON public.item_drives (status, closes_at) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.item_drive_donations (
	id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	drive_id          uuid        NOT NULL REFERENCES public.item_drives(id) ON DELETE CASCADE,
	donor_user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	snouts            int         NOT NULL,
	tickle_reward     int         NOT NULL,
	reward_claimed_at timestamptz,
	created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_drive_donations_drive_idx ON public.item_drive_donations (drive_id);
CREATE INDEX IF NOT EXISTS item_drive_donations_donor_idx ON public.item_drive_donations (donor_user_id, created_at DESC);

ALTER TABLE public.item_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_drive_donations ENABLE ROW LEVEL SECURITY;
-- Reads go through SECURITY DEFINER RPCs (Sounder-scoped); no direct policies.

-- ── open_item_drive: opener seeds >=10% of the item price, 3-day cooldown ──
CREATE OR REPLACE FUNCTION public.open_item_drive(target_item_id text, seed_snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost      int;
	min_seed  int;
	bal       bigint;
	new_id    uuid;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT hats.cost INTO cost FROM public.hats WHERE id = target_item_id;
	IF cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
	END IF;
	IF cost <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');  -- exclusives
	END IF;

	-- One Trough per opener every 3 days.
	IF EXISTS (
		SELECT 1 FROM public.item_drives
		WHERE opener_user_id = caller_id AND opens_at > now() - interval '3 days'
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'opener_cooldown');
	END IF;

	min_seed := CEIL(cost * 0.10);
	IF seed_snouts < min_seed THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'seed_too_low', 'min_seed', min_seed);
	END IF;
	IF seed_snouts > cost THEN
		seed_snouts := cost;  -- can't over-seed past the price
	END IF;

	SELECT counter INTO bal FROM public.profiles WHERE id = caller_id FOR UPDATE;
	IF bal < seed_snouts THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'insufficient', 'have', bal, 'need', seed_snouts);
	END IF;

	UPDATE public.profiles SET counter = counter - seed_snouts WHERE id = caller_id;

	INSERT INTO public.item_drives
		(item_id, opener_user_id, target_snouts, raised_snouts, closes_at)
		VALUES (target_item_id, caller_id, cost, seed_snouts, now() + interval '48 hours')
		RETURNING id INTO new_id;

	RETURN jsonb_build_object('ok', true, 'drive_id', new_id,
		'target', cost, 'raised', seed_snouts);
END;
$function$;

-- ── donate_to_drive: a Sounder friend chips in; funds -> grant + claimable ──
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

		PERFORM public.send_system_announcement(
			d.opener_user_id, 'trough_funded',
			'Your Trough filled!',
			'Your Sounder came through — the ' || COALESCE(item_name, 'item')
				|| ' is yours!',
			jsonb_build_object('drive_id', drive_id));

		FOR donor_row IN
			SELECT DISTINCT donor_user_id FROM public.item_drive_donations
			WHERE drive_id = d.id
		LOOP
			PERFORM public.send_system_announcement(
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

GRANT EXECUTE ON FUNCTION public.open_item_drive(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.donate_to_drive(uuid, int) TO authenticated;

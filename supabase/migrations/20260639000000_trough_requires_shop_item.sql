-- Troughs only open for items currently IN today's daily_shop() rotation
-- (player request). Out-of-rotation items can no longer be Trough-funded;
-- the preview modal hides the CTA, this is the authoritative gate (new
-- reason: 'not_in_shop'). Flags are NOT exempt — they're allegiance picks
-- (choose_allegiance via the Barn flag, see 20260640), not shop goods.
--
-- Also returns the post-spend 'balance' on success so the client can
-- snap the snout chip immediately ("delay when we spend snouts").
--
-- Body otherwise verbatim from 20260582 (latest open_item_drive def).

CREATE OR REPLACE FUNCTION public.open_item_drive(target_item_id text, seed_snouts int)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	cost      int;
	item_cat  text;
	min_seed  int;
	bal       bigint;
	new_bal   bigint;
	new_id    uuid;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT hats.cost, hats.category INTO cost, item_cat
	FROM public.hats WHERE id = target_item_id;
	IF cost IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_such_item');
	END IF;
	IF cost <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_eligible');  -- exclusives
	END IF;

	-- In-shop gate: must be in today's rotation. (item_cat read above is
	-- kept for future category gates; flags never reach here anyway —
	-- daily_shop() excludes them and they're allegiance picks, not buys.)
	IF NOT EXISTS (
		SELECT 1 FROM public.daily_shop() ds WHERE ds.id = target_item_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_shop');
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

	UPDATE public.profiles SET counter = counter - seed_snouts
	WHERE id = caller_id
	RETURNING counter INTO new_bal;

	INSERT INTO public.item_drives
		(item_id, opener_user_id, target_snouts, raised_snouts, closes_at)
		VALUES (target_item_id, caller_id, cost, seed_snouts, now() + interval '48 hours')
		RETURNING id INTO new_id;

	RETURN jsonb_build_object('ok', true, 'drive_id', new_id,
		'target', cost, 'raised', seed_snouts, 'balance', new_bal);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.open_item_drive(text, int) TO authenticated;

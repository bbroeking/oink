-- Spec 15 — Retire the Trough tickle reward + claw back this season's grants.
--
-- Founder call 2026-07-17 (SKILL.md decision log): Troughs no longer pay donors
-- tickles at all. The reward lane is retired going forward, and the tickles
-- already granted for Troughs completed THIS SEASON are removed retroactively
-- from BOTH the spendable bank (profiles.counter) and the season tiebreak stat
-- (profiles.tickles_earned).
--
-- Four moves:
--   1. donate_to_drive — carry the latest body (20260635_trough_chip_feedback)
--      VERBATIM, but `reward := 0` (new donations record no tickle_reward) and
--      drop the "Claim your snouts & score!" CTA from the funded-donor note.
--      Signature FROZEN — deployed builds call donate_to_drive(uuid, int).
--   2. claim_drive_reward — carry the latest body (20260628) but retire the
--      payout: any claim returns {ok:false, reason:'retired'} WITHOUT crediting
--      or stamping. Function + grant kept so old clients get a clean refusal,
--      not a 404.
--   3. Zero pending bait: unclaimed donations lose their tickle_reward — nothing
--      left to claim once the payout is gone.
--   4. Retroactive claw-back (this season only): subtract each donor's claimed
--      Season-1 rewards from counter + tickles_earned, floored at 0.
--
-- Migration AUTHORED ONLY — never `db push` autonomously. The founder re-verifies
-- the boundary constant (below) at push time.

-- ── 1. donate_to_drive — reward retired to 0, funded copy drops the claim CTA ──
-- Body carried VERBATIM from 20260635000000_trough_chip_feedback.sql (the
-- alphabetically-latest def of donate_to_drive; 20260647_mud_fights does NOT
-- touch it) apart from two lines: `reward := 0` and the funded-donor note copy.
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

	-- Tickle reward RETIRED (spec 15): Troughs no longer pay donors tickles.
	-- reward stays in the return shape (frozen for deployed clients) but is 0.
	reward := 0;
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

	-- Funded → grant the item to the opener; tell the opener + every donor.
	-- (Inline INSERTs, not send_system_announcement, which is admin-gated and
	-- would roll back the donation for non-admins.) No tickle claim anymore —
	-- the donor note celebrates the item landing (spec 15, whimsy voice).
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
					|| COALESCE(item_name, 'item') || '. That''s the herd coming through!',
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

-- ── 2. claim_drive_reward — payout retired, clean refusal ─────────────────────
-- Signature + grant kept (latest def: 20260628_trough_reward_to_leaderboard) so
-- deployed clients calling it get {ok:false, reason:'retired'} rather than a 404.
-- Credits nothing, stamps nothing — the whole crediting body is gone.
CREATE OR REPLACE FUNCTION public.claim_drive_reward(donation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	-- Trough tickle rewards are retired (spec 15). No credit, no stamp — any
	-- claim gets a clean refusal. The client hides the claim affordance, so this
	-- only guards old builds that still call in.
	RETURN jsonb_build_object('ok', false, 'reason', 'retired');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_drive_reward(uuid) TO authenticated;

-- ── 3. Zero pending bait ──────────────────────────────────────────────────────
-- Any donation still awaiting a claim loses its tickle_reward — with the payout
-- retired there's nothing to claim, so leave no dangling promise in the data.
UPDATE public.item_drive_donations
	SET tickle_reward = 0
	WHERE reward_claimed_at IS NULL;

-- ── 4. Retroactive claw-back (this season only) ───────────────────────────────
-- Season-1 boundary: the Season-0 finale ran 2026-07-12 00:10:39 UTC and zeroed
-- tickles_earned (docs/specs/reports/07-tiebreak-postmortem.md). Claims stamped
-- AFTER that instant were paid out of the current season's economy; claims from
-- before are part of the settled + archived Season 0 and must NOT be touched.
--
-- >>> FOUNDER: re-verify this boundary timestamp at push time. <<<
-- Subtract each donor's SUM(tickle_reward) over their post-boundary CLAIMED
-- donations from BOTH counter and tickles_earned, each floored at 0 via GREATEST
-- (a donor may have already spent granted snouts below the claw-back amount).
WITH clawback AS (
	SELECT donor_user_id AS uid, SUM(tickle_reward) AS amt
	FROM public.item_drive_donations
	WHERE reward_claimed_at > TIMESTAMPTZ '2026-07-12 00:10:39+00'  -- season-1 boundary
	GROUP BY donor_user_id
)
UPDATE public.profiles p
	SET counter        = GREATEST(0, p.counter - c.amt),
	    tickles_earned = GREATEST(0, p.tickles_earned - c.amt)
	FROM clawback c
	WHERE p.id = c.uid;

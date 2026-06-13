-- pgTAP integration test for Sounder Mud Fights (the war engine).
--
-- Fixture-based, like 01_referrals_gate.sql: creates four auth.users
-- (handle_new_user auto-creates their profiles), runs a full war via the
-- RPCs, and asserts the resolve payout. Commits NO state — everything
-- runs inside a transaction that ROLLBACKs at the end.
--
-- Run with:  npx supabase test db   (requires `supabase start` first)
--
-- Pins the contracts in 20260647000000_mud_fights.sql:
--   • per-capita active average + quorum-2 winner determination
--   • payout = own mud (1:1) + per-capita share of 50% of the loser pot,
--     applied to BOTH counter and tickles_earned (the 20260628 shape)
--   • a war_winner_regen blessing is granted to each winning member
--   • the mud_champion title is granted
--   • resolve_war is IDEMPOTENT (a second call never double-pays)
-- If this fails, the war engine is mis-paying or double-paying.

BEGIN;
SELECT plan(11);

DO $$
DECLARE
	a1 uuid := '00000000-0000-0000-0000-00000000a001';  -- crew A leader
	a2 uuid := '00000000-0000-0000-0000-00000000a002';  -- crew A member
	b1 uuid := '00000000-0000-0000-0000-00000000b001';  -- crew B leader
	b2 uuid := '00000000-0000-0000-0000-00000000b002';  -- crew B member
	crewa uuid;
	crewb uuid;
	war uuid;
	res jsonb;
	today date := (now() AT TIME ZONE 'UTC')::date;
	pre_a1 bigint; pre_a2 bigint; pre_te_a1 bigint;
	post_a1 bigint; post_a2 bigint; post_te_a1 bigint;
	dbl_a1 bigint;
BEGIN
	-- Clean slate.
	DELETE FROM auth.users WHERE id IN (a1, a2, b1, b2);
	INSERT INTO auth.users (id, email, created_at) VALUES
		(a1, 'a1@test.local', now()), (a2, 'a2@test.local', now()),
		(b1, 'b1@test.local', now()), (b2, 'b2@test.local', now());
	UPDATE public.profiles SET username = 'a1' WHERE id = a1;
	UPDATE public.profiles SET username = 'a2' WHERE id = a2;
	UPDATE public.profiles SET username = 'b1' WHERE id = b1;
	UPDATE public.profiles SET username = 'b2' WHERE id = b2;

	-- A1 creates crew A; B1 creates crew B (via the RPCs).
	PERFORM set_config('request.jwt.claims',
		'{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
	crewa := (public.create_crew('The A Team')->>'crew_id')::uuid;
	PERFORM set_config('request.jwt.claims',
		'{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}', true);
	crewb := (public.create_crew('The B Team')->>'crew_id')::uuid;

	PERFORM ok(crewa IS NOT NULL AND crewb IS NOT NULL, 'both crews created via create_crew');

	-- Add the second member to each crew directly (skips the invite
	-- are_friends gate; the war engine is what we're testing).
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES
		(crewa, a2, 'member'), (crewb, b2, 'member');

	-- A1 challenges crew B; B1 accepts.
	PERFORM set_config('request.jwt.claims',
		'{"sub":"00000000-0000-0000-0000-00000000a001","role":"authenticated"}', true);
	res := public.challenge_crew(crewb);
	PERFORM ok((res->>'ok')::boolean, 'challenge_crew created the war: ' || res::text);
	war := (res->>'war_id')::uuid;

	PERFORM set_config('request.jwt.claims',
		'{"sub":"00000000-0000-0000-0000-00000000b001","role":"authenticated"}', true);
	res := public.accept_challenge(war);
	PERFORM ok((res->>'ok')::boolean, 'accept_challenge activated the war');

	-- Deterministic scores via direct sling rows (avoids the per-day
	-- clamp timing): crew A 10+8 (2 active → quorum met, per-capita 9);
	-- crew B only 5 from b1 (1 active → BELOW quorum).
	INSERT INTO public.mud_slings (war_id, crew_id, user_id, slings, war_day) VALUES
		(war, crewa, a1, 10, today),
		(war, crewa, a2, 8,  today),
		(war, crewb, b1, 5,  today);

	-- Force the window closed so resolve_war proceeds.
	UPDATE public.mud_wars SET ends_at = now() - interval '1 minute' WHERE id = war;

	-- Snapshot winners' balances, then resolve.
	SELECT counter, tickles_earned INTO pre_a1, pre_te_a1 FROM public.profiles WHERE id = a1;
	SELECT counter INTO pre_a2 FROM public.profiles WHERE id = a2;

	res := public.resolve_war(war);

	SELECT counter, tickles_earned INTO post_a1, post_te_a1 FROM public.profiles WHERE id = a1;
	SELECT counter INTO post_a2 FROM public.profiles WHERE id = a2;

	-- crew A wins on quorum (B has only 1 active member).
	PERFORM is((SELECT winner_crew FROM public.mud_wars WHERE id = war), crewa,
		'crew A won — B was below quorum');

	-- Payout: loser pot 5, 50% = 2.5, per-capita over 2 active winners =
	-- floor(2.5/2) = 1. A1 = own 10 + 1 = 11; A2 = own 8 + 1 = 9.
	PERFORM is((post_a1 - pre_a1)::int, 11, 'A1 counter += own mud + share (11)');
	PERFORM is((post_te_a1 - pre_te_a1)::int, 11, 'A1 tickles_earned += 11 (leaderboard shape)');
	PERFORM is((post_a2 - pre_a2)::int, 9, 'A2 counter += own mud + share (9)');

	PERFORM ok(EXISTS (
		SELECT 1 FROM public.blessings
		WHERE receiver_id = a1 AND kind = 'war_winner_regen' AND expires_at > now()
	), 'A1 got the war_winner_regen buff');

	PERFORM ok(EXISTS (
		SELECT 1 FROM public.user_titles WHERE user_id = a1 AND title_id = 'mud_champion'
	), 'A1 was granted the mud_champion title');

	PERFORM is((SELECT status FROM public.mud_wars WHERE id = war), 'resolved', 'war marked resolved');

	-- Idempotency: a second resolve must NOT pay again.
	PERFORM public.resolve_war(war);
	SELECT counter INTO dbl_a1 FROM public.profiles WHERE id = a1;
	PERFORM is((dbl_a1 - post_a1)::int, 0, 'double resolve_war is a no-op (no double-pay)');
END
$$;

SELECT finish();
ROLLBACK;

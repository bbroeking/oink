-- Functional smoke for QR redemption (20260732000000_qr_redemption).
-- Exercises redeem_code() end-to-end: auth guard, normalize chokepoint, unknown/
-- expired/exhausted refusals, per-user-once, and all three grant kinds (hat +
-- already_owned, truffles at cap, snouts). Fresh rd-namespace users, no coupling
-- to the war/league chain. auth.uid() → smoke.uid override is installed by
-- 15_coop_dig_smoke.sql (runs earlier in the glob).
\set ON_ERROR_STOP on

-- The harness stub's hats table is minimal (id, war_exclusive, token_cost);
-- prod hats has `name text NOT NULL`. The redeem_code body SELECTs hats.name, so
-- give the stub that column here (idempotent; prod already has it). This runs
-- AFTER the migration is applied — the function body was validated at CREATE
-- against the real prod column, so this only backfills the harness stub for the
-- runtime SELECT.
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common';
UPDATE public.hats SET name = 'Muddy Cap', rarity = 'rare' WHERE id = 'muddy_cap';

INSERT INTO public.profiles (id, username) VALUES
	('00000000-0000-0000-0000-000000deed01', 'rd-one'),
	('00000000-0000-0000-0000-000000deed02', 'rd-two');
INSERT INTO auth.users (id) SELECT id FROM public.profiles
	WHERE id::text LIKE '00000000-0000-0000-0000-000000deed%';

-- Seed codes (stored normalized: UPPER, no dashes).
INSERT INTO public.redemption_codes (code, label, "grant", max_uses, expires_at) VALUES
	('PIGHATAAAA', 'smoke hat',      '{"kind":"hat","id":"muddy_cap"}',    5,   NULL),
	('PIGTRUFAAA', 'smoke truffles', '{"kind":"truffles","amount":50}',    5,   NULL),
	('PIGSNOUTAA', 'smoke snouts',   '{"kind":"snouts","amount":100}',     5,   NULL),
	('PIGEXPAAAA', 'smoke expired',  '{"kind":"snouts","amount":10}',      5,   now() - interval '1 day'),
	('PIGEXHAAAA', 'smoke exhausted','{"kind":"snouts","amount":10}',      1,   NULL),
	('PIGBADGAAA', 'smoke bad grant','{"kind":"hat","id":"no_such_hat"}',  5,   NULL),
	('PIGBADAMTA', 'smoke bad amt',  '{"kind":"snouts"}',                  5,   NULL),
	('PIGNEGAMTA', 'smoke neg amt',  '{"kind":"snouts","amount":-5}',      5,   NULL),
	('PIGFULLAAA', 'smoke pouch full','{"kind":"truffles","amount":50}',   5,   NULL);
-- Pre-exhaust the exhausted code.
UPDATE public.redemption_codes SET uses = 1 WHERE code = 'PIGEXHAAAA';

DO $smoke_rd$
DECLARE
	u1  uuid := '00000000-0000-0000-0000-000000deed01';
	u2  uuid := '00000000-0000-0000-0000-000000deed02';
	res jsonb;
	bal int;
	cnt int;
BEGIN
	-- Unauthenticated → not_signed_in, no write.
	PERFORM set_config('smoke.uid', '', true);
	res := public.redeem_code('PIG-HAT-AAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_signed_in' THEN
		RAISE EXCEPTION 'anon must reject, got %', res; END IF;

	PERFORM set_config('smoke.uid', u1::text, true);

	-- Unknown code.
	res := public.redeem_code('PIG-ZZZZ-ZZZZ');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'unknown' THEN
		RAISE EXCEPTION 'unknown code must reject, got %', res; END IF;

	-- Expired.
	res := public.redeem_code('pig-exp-aaaa');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'expired' THEN
		RAISE EXCEPTION 'expired must reject, got %', res; END IF;

	-- Exhausted.
	res := public.redeem_code('PIGEXHAAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'exhausted' THEN
		RAISE EXCEPTION 'exhausted must reject, got %', res; END IF;

	-- Bad grant (hat id not in hats) → bad_grant, and NO claim consumed.
	res := public.redeem_code('PIGBADGAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_grant' THEN
		RAISE EXCEPTION 'bad grant must reject, got %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.redemption_claims WHERE code = 'PIGBADGAAA') THEN
		RAISE EXCEPTION 'bad grant must NOT consume a claim'; END IF;
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGBADGAAA') <> 0 THEN
		RAISE EXCEPTION 'bad grant must NOT bump uses'; END IF;

	-- Missing amount (NULL) → bad_grant pre-claim, no NOT-NULL blowup, no consume.
	res := public.redeem_code('PIGBADAMTA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_grant' THEN
		RAISE EXCEPTION 'null amount must reject bad_grant, got %', res; END IF;
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGBADAMTA') <> 0 THEN
		RAISE EXCEPTION 'null-amount grant must NOT bump uses'; END IF;

	-- Negative amount → bad_grant (would otherwise DEDUCT snouts silently).
	res := public.redeem_code('PIGNEGAMTA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_grant' THEN
		RAISE EXCEPTION 'negative amount must reject bad_grant, got %', res; END IF;
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGNEGAMTA') <> 0 THEN
		RAISE EXCEPTION 'negative-amount grant must NOT bump uses'; END IF;

	-- Pouch full: put u2 at the 999 cap, then a truffles code must refuse
	-- pouch_full pre-write — ticket survives (uses stays 0, no claim consumed).
	PERFORM set_config('smoke.uid', u2::text, true);
	PERFORM public.mint_truffles(u2, 999, 'smoke:fill-pouch', NULL);
	res := public.redeem_code('PIGFULLAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'pouch_full' THEN
		RAISE EXCEPTION 'pouch-full truffles must refuse pouch_full, got %', res; END IF;
	IF EXISTS (SELECT 1 FROM public.redemption_claims WHERE code = 'PIGFULLAAA' AND user_id = u2) THEN
		RAISE EXCEPTION 'pouch_full must NOT consume a claim'; END IF;
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGFULLAAA') <> 0 THEN
		RAISE EXCEPTION 'pouch_full must NOT bump uses'; END IF;
	PERFORM set_config('smoke.uid', u1::text, true);

	-- Hat grant — normalize chokepoint: dashed+lowercase converges.
	res := public.redeem_code('pig-hat-aaaa');
	IF NOT (res->>'ok')::boolean OR res->>'kind' <> 'hat'
		OR res->>'id' <> 'muddy_cap' OR res->>'name' <> 'Muddy Cap'
		OR res->>'rarity' <> 'rare'
		OR (res->>'already_owned')::boolean THEN
		RAISE EXCEPTION 'hat grant failed: %', res; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u1 AND hat_id = 'muddy_cap') THEN
		RAISE EXCEPTION 'hat not granted to user_hats'; END IF;

	-- Re-redeem the SAME hat code as u1 → already_redeemed (per-user-once).
	res := public.redeem_code('PIGHATAAAA');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'already_redeemed' THEN
		RAISE EXCEPTION 'per-user-once must reject re-redeem, got %', res; END IF;

	-- u2 redeems the same hat code, but already owns it (grant it first) →
	-- ok:true with already_owned:true.
	INSERT INTO public.user_hats (user_id, hat_id) VALUES (u2, 'muddy_cap');
	PERFORM set_config('smoke.uid', u2::text, true);
	res := public.redeem_code('PIGHATAAAA');
	IF NOT (res->>'ok')::boolean OR NOT (res->>'already_owned')::boolean THEN
		RAISE EXCEPTION 'already-owned hat must be ok:true already_owned:true, got %', res; END IF;

	-- Truffles grant — rides mint_truffles (ledgered, 999-clamp).
	PERFORM set_config('smoke.uid', u1::text, true);
	res := public.redeem_code('PIGTRUFAAA');
	IF NOT (res->>'ok')::boolean OR res->>'kind' <> 'truffles'
		OR (res->>'granted_amount')::int <> 50 THEN
		RAISE EXCEPTION 'truffles grant failed: %', res; END IF;
	SELECT golden_truffles INTO bal FROM public.profiles WHERE id = u1;
	IF bal <> 50 THEN RAISE EXCEPTION 'truffles not minted (bal=%)', bal; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.war_truffles
		WHERE user_id = u1 AND reason = 'redemption:PIGTRUFAAA' AND amount = 50) THEN
		RAISE EXCEPTION 'truffle ledger row missing'; END IF;

	-- Snouts grant — profiles.counter bump.
	res := public.redeem_code('PIGSNOUTAA');
	IF NOT (res->>'ok')::boolean OR res->>'kind' <> 'snouts'
		OR (res->>'amount')::int <> 100 THEN
		RAISE EXCEPTION 'snouts grant failed: %', res; END IF;
	SELECT counter INTO cnt FROM public.profiles WHERE id = u1;
	IF cnt <> 100 THEN RAISE EXCEPTION 'snouts not credited (counter=%)', cnt; END IF;

	-- uses bumped exactly once per successful redeem on the multi-use hat code
	-- (u1 success + u2 already-owned success = 2).
	IF (SELECT uses FROM public.redemption_codes WHERE code = 'PIGHATAAAA') <> 2 THEN
		RAISE EXCEPTION 'hat code uses should be 2, got %',
			(SELECT uses FROM public.redemption_codes WHERE code = 'PIGHATAAAA'); END IF;

	RAISE NOTICE 'redemption smoke OK';
END $smoke_rd$;

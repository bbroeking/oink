-- Functional smoke for rename_username (20260738100000): the paid-rename
-- cost ladder (free → 1,000 → 10,000), the atomic snout deduction, and every
-- refusal envelope (same-name no-charge, insufficient snouts, duplicate name,
-- banned name).
--
-- The plain-Postgres stub carries neither the profiles.username unique index,
-- the discriminator column, nor the username-moderation trigger (its migration
-- isn't in the harness chain), so this prep builds the minimal versions the RPC
-- integrates with.
\set ON_ERROR_STOP on

-- auth.uid() reads the smoke.uid GUC so the smoke can act "as" a given pig
-- (idempotent CREATE OR REPLACE — 15_coop_dig_smoke installs the same shim).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Discriminator column the RPC must leave untouched.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discriminator text;
-- Unique index the RPC catches on collision (mirrors profiles_username_key).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (username);

-- Minimal moderation policy + trigger (a banned exact name → reject).
CREATE OR REPLACE FUNCTION public.is_username_allowed(p_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
	SELECT lower(btrim(coalesce(p_name, ''))) NOT IN ('fuck', 'admin', 'rosie')
$$;
CREATE OR REPLACE FUNCTION public.profiles_enforce_username_moderation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.username IS NOT NULL
		AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
		AND NOT public.is_username_allowed(NEW.username)
	THEN
		RAISE EXCEPTION 'username_not_allowed';
	END IF;
	RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profiles_enforce_username_moderation ON public.profiles;
CREATE TRIGGER profiles_enforce_username_moderation
	BEFORE INSERT OR UPDATE OF username ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_username_moderation();

DO $smoke_rename$
DECLARE
	me    uuid := '00000000-0000-0000-0000-000000012001';
	other uuid := '00000000-0000-0000-0000-000000012002';
	res   jsonb;
	nm    text;
	disc  text;
	bal   int;
	used  int;
BEGIN
	-- me: 20,000 snouts, disc '0001', no renames yet. other holds 'taken'.
	INSERT INTO auth.users (id) VALUES (me), (other);
	INSERT INTO public.profiles (id, username, discriminator, counter, renames_used)
		VALUES (me, 'oldname', '0001', 20000, 0),
		       (other, 'taken', '0002', 0, 0);

	-- Unauthenticated → not_authed.
	PERFORM set_config('smoke.uid', '', true);
	res := public.rename_username('whatever');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_authed' THEN
		RAISE EXCEPTION 'rename: no auth must be not_authed, got %', res; END IF;

	PERFORM set_config('smoke.uid', me::text, true);

	-- Bad length (2 chars, and 25 chars) → bad_name, no write.
	res := public.rename_username('ab');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_name' THEN
		RAISE EXCEPTION 'rename: 2 chars must be bad_name, got %', res; END IF;
	res := public.rename_username(repeat('x', 25));
	IF (res->>'ok')::boolean OR res->>'reason' <> 'bad_name' THEN
		RAISE EXCEPTION 'rename: 25 chars must be bad_name, got %', res; END IF;

	-- Same name → same_name, no charge.
	res := public.rename_username('oldname');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'same_name' THEN
		RAISE EXCEPTION 'rename: identical must be same_name, got %', res; END IF;
	SELECT counter, renames_used INTO bal, used FROM public.profiles WHERE id = me;
	IF bal <> 20000 OR used <> 0 THEN
		RAISE EXCEPTION 'rename: same_name must not charge, got bal % used %', bal, used; END IF;

	-- Banned name → not_allowed, no charge (btrim'd whitespace still trips it).
	res := public.rename_username('  admin  ');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_allowed' THEN
		RAISE EXCEPTION 'rename: banned must be not_allowed, got %', res; END IF;
	SELECT username, counter, renames_used INTO nm, bal, used FROM public.profiles WHERE id = me;
	IF nm <> 'oldname' OR bal <> 20000 OR used <> 0 THEN
		RAISE EXCEPTION 'rename: not_allowed must not write, got nm % bal % used %', nm, bal, used; END IF;

	-- Duplicate name → name_taken, no charge.
	res := public.rename_username('taken');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'name_taken' THEN
		RAISE EXCEPTION 'rename: duplicate must be name_taken, got %', res; END IF;
	SELECT counter, renames_used INTO bal, used FROM public.profiles WHERE id = me;
	IF bal <> 20000 OR used <> 0 THEN
		RAISE EXCEPTION 'rename: name_taken must not charge, got bal % used %', bal, used; END IF;

	-- FIRST rename: free (cost 0), name + trim applied, disc untouched,
	-- renames_used → 1, next_cost 1000.
	res := public.rename_username('  freshname  ');
	IF NOT (res->>'ok')::boolean OR (res->>'cost')::int <> 0
		OR (res->>'remaining')::int <> 20000 OR (res->>'next_cost')::int <> 1000 THEN
		RAISE EXCEPTION 'rename: 1st should be free, got %', res; END IF;
	SELECT username, discriminator, counter, renames_used
		INTO nm, disc, bal, used FROM public.profiles WHERE id = me;
	IF nm <> 'freshname' OR disc <> '0001' OR bal <> 20000 OR used <> 1 THEN
		RAISE EXCEPTION 'rename: 1st write wrong, nm % disc % bal % used %', nm, disc, bal, used; END IF;

	-- SECOND rename: 1,000 deducted, next_cost 10000.
	res := public.rename_username('secondname');
	IF NOT (res->>'ok')::boolean OR (res->>'cost')::int <> 1000
		OR (res->>'remaining')::int <> 19000 OR (res->>'next_cost')::int <> 10000 THEN
		RAISE EXCEPTION 'rename: 2nd should cost 1000, got %', res; END IF;
	SELECT counter, renames_used INTO bal, used FROM public.profiles WHERE id = me;
	IF bal <> 19000 OR used <> 2 THEN
		RAISE EXCEPTION 'rename: 2nd balance/used wrong, bal % used %', bal, used; END IF;

	-- THIRD rename: 10,000 deducted, next_cost still 10000.
	res := public.rename_username('thirdname');
	IF NOT (res->>'ok')::boolean OR (res->>'cost')::int <> 10000
		OR (res->>'remaining')::int <> 9000 OR (res->>'next_cost')::int <> 10000 THEN
		RAISE EXCEPTION 'rename: 3rd should cost 10000, got %', res; END IF;
	SELECT counter, renames_used INTO bal, used FROM public.profiles WHERE id = me;
	IF bal <> 9000 OR used <> 3 THEN
		RAISE EXCEPTION 'rename: 3rd balance/used wrong, bal % used %', bal, used; END IF;

	-- FOURTH rename: 10,000 cost but only 9,000 left → not_enough_snouts,
	-- surfaces the cost, no write.
	res := public.rename_username('fourthname');
	IF (res->>'ok')::boolean OR res->>'reason' <> 'not_enough_snouts'
		OR (res->>'cost')::int <> 10000 THEN
		RAISE EXCEPTION 'rename: insufficient must be not_enough_snouts+cost, got %', res; END IF;
	SELECT username, counter, renames_used INTO nm, bal, used FROM public.profiles WHERE id = me;
	IF nm <> 'thirdname' OR bal <> 9000 OR used <> 3 THEN
		RAISE EXCEPTION 'rename: not_enough_snouts must not write, nm % bal % used %', nm, bal, used; END IF;

	RAISE NOTICE 'chk rename_username: ladder(0/1000/10000) + same_name/banned/taken/insufficient no-write OK';
END $smoke_rename$;

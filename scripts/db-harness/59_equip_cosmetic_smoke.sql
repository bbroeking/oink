-- Smoke: equip_cosmetic (20260774000000) moves the cosmetic-equip rule
-- server-side — catalog-sourced category on equip, ownership gate, Face-slot
-- exclusivity (glasses↔mask), unequip-clears-own-column, and the three plain
-- refusal shapes (not_owned / no_such_item / bad_category).
--
-- Self-standing: adds the active_* cosmetic columns the harness stub's profiles
-- lacks + a category column on hats (both additive/IF NOT EXISTS so they no-op
-- against the real shape), seeds its own catalog rows + owner, and drives
-- auth.uid() through the smoke.uid GUC. Assumes 20260774000000 is already applied.
\set ON_ERROR_STOP on

-- Cosmetic slot columns the stub profiles table predates (real shape has them
-- via the hats/glasses/mask/etc. migrations). Additive — no-op on prod.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_hat_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_glasses_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_mask_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_neck_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_aura_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_held_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_background_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_flag_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active_tickle_particle_id text;
-- hats catalog category (stub hats is the minimal race-podium shape).
ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS category text;

-- auth.uid() reads the smoke.uid GUC (idempotent — other smokes install the same).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid', true), '')::uuid $$;

-- Catalog rows for this smoke (ON CONFLICT so re-runs / stub seeds don't clash).
INSERT INTO public.hats (id, category) VALUES
	('eq_tophat',  'hat'),
	('eq_shades',  'glasses'),
	('eq_foxmask', 'mask'),
	('eq_halo',    'aura'),
	('eq_unowned', 'hat')
ON CONFLICT (id) DO UPDATE SET category = EXCLUDED.category;

DO $equip_smoke$
DECLARE
	pig    uuid := '00000000-0000-0000-0000-000000059001';
	stranger uuid := '00000000-0000-0000-0000-000000059002';
	r      jsonb;
	col    text;
BEGIN
	INSERT INTO auth.users (id) VALUES (pig), (stranger);
	INSERT INTO public.profiles (id, username) VALUES (pig, 'equippig'), (stranger, 'stranger');
	-- pig owns everything except eq_unowned.
	INSERT INTO public.user_hats (user_id, hat_id) VALUES
		(pig, 'eq_tophat'), (pig, 'eq_shades'), (pig, 'eq_foxmask'), (pig, 'eq_halo');

	PERFORM set_config('smoke.uid', pig::text, true);

	-- 1. Equip an owned hat → column set, server returns the patch, sibling untouched.
	r := public.equip_cosmetic('eq_tophat');
	IF (r->>'ok')::boolean IS NOT TRUE OR r->'update'->>'active_hat_id' <> 'eq_tophat' THEN
		RAISE EXCEPTION 'equip hat failed: %', r;
	END IF;
	SELECT active_hat_id INTO col FROM public.profiles WHERE id = pig;
	IF col <> 'eq_tophat' THEN RAISE EXCEPTION 'hat column not written: %', col; END IF;
	-- Aura slot must be untouched by a hat equip.
	SELECT active_aura_id INTO col FROM public.profiles WHERE id = pig;
	IF col IS NOT NULL THEN RAISE EXCEPTION 'hat equip touched aura: %', col; END IF;

	-- 2a. Equip glasses → sets glasses. Pre-seed a mask so exclusivity is observable.
	r := public.equip_cosmetic('eq_foxmask');
	IF (r->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'mask pre-equip failed: %', r; END IF;
	r := public.equip_cosmetic('eq_shades');
	-- Server patch clears the mask in the SAME answer.
	IF r->'update'->>'active_glasses_id' <> 'eq_shades'
	   OR r->'update'->'active_mask_id' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'glasses equip did not clear mask in patch: %', r;
	END IF;
	SELECT active_mask_id INTO col FROM public.profiles WHERE id = pig;
	IF col IS NOT NULL THEN RAISE EXCEPTION 'glasses equip left mask set: %', col; END IF;
	SELECT active_glasses_id INTO col FROM public.profiles WHERE id = pig;
	IF col <> 'eq_shades' THEN RAISE EXCEPTION 'glasses not set: %', col; END IF;

	-- 2b. Other direction: equip mask → clears glasses.
	r := public.equip_cosmetic('eq_foxmask');
	IF r->'update'->>'active_mask_id' <> 'eq_foxmask'
	   OR r->'update'->'active_glasses_id' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'mask equip did not clear glasses in patch: %', r;
	END IF;
	SELECT active_glasses_id INTO col FROM public.profiles WHERE id = pig;
	IF col IS NOT NULL THEN RAISE EXCEPTION 'mask equip left glasses set: %', col; END IF;

	-- 3. Unequip clears ONLY its own column. Mask is on; unequip the mask slot,
	--    the hat (still eq_tophat) must survive.
	r := public.equip_cosmetic(NULL, 'mask');
	IF (r->>'ok')::boolean IS NOT TRUE OR r->'update'->'active_mask_id' <> 'null'::jsonb THEN
		RAISE EXCEPTION 'unequip mask failed: %', r;
	END IF;
	SELECT active_mask_id INTO col FROM public.profiles WHERE id = pig;
	IF col IS NOT NULL THEN RAISE EXCEPTION 'unequip left mask set: %', col; END IF;
	SELECT active_hat_id INTO col FROM public.profiles WHERE id = pig;
	IF col <> 'eq_tophat' THEN RAISE EXCEPTION 'unequip mask wiped the hat: %', col; END IF;

	-- 4. not_owned refusal: pig doesn't own eq_unowned. No write.
	r := public.equip_cosmetic('eq_unowned');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'expected not_owned, got: %', r;
	END IF;

	-- 5. no_such_item refusal: id absent from catalog.
	r := public.equip_cosmetic('eq_ghost_item');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'no_such_item' THEN
		RAISE EXCEPTION 'expected no_such_item, got: %', r;
	END IF;

	-- 6. bad_category refusal on unequip: an unmapped slot name.
	r := public.equip_cosmetic(NULL, 'not_a_slot');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'bad_category' THEN
		RAISE EXCEPTION 'expected bad_category, got: %', r;
	END IF;
	-- ...and unequip with NULL category is also bad_category (no column to clear).
	r := public.equip_cosmetic(NULL, NULL);
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'bad_category' THEN
		RAISE EXCEPTION 'expected bad_category for null/null, got: %', r;
	END IF;

	-- 7. unauthenticated refusal (no smoke.uid).
	PERFORM set_config('smoke.uid', '', true);
	r := public.equip_cosmetic('eq_tophat');
	IF (r->>'ok')::boolean IS NOT FALSE OR r->>'reason' <> 'unauthenticated' THEN
		RAISE EXCEPTION 'expected unauthenticated, got: %', r;
	END IF;

	RAISE NOTICE 'chk 59 equip_cosmetic: all assertions passed';
END
$equip_smoke$;

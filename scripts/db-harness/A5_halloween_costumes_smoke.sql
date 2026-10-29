-- Halloween full costumes (20261029240000_halloween_costumes.sql).
--
-- Proves:
--   (a) equip_cosmetic(costume) on Rosie sets active_costume_id and leaves
--       every other active_* slot exactly as it was; the update payload is
--       {active_costume_id: id};
--   (b) equipping a hat while costumed is allowed and keeps the costume;
--   (c) equip_cosmetic(NULL, 'costume') clears only active_costume_id, the
--       outfit underneath is intact;
--   (d) a costume the caller does not own answers not_owned;
--   (e) a non-Rosie active pig answers costume_rosie_only (nothing written);
--       taking a costume off on a non-Rosie pig is still allowed;
--   (f) the FK nulls active_costume_id when the worn row is deleted;
--   (g) home_stats() carries active_costume_id + active_costume {id,category,
--       emoji} (null when bare); my_porch_round() stops carry
--       active_costume_id + active_pig_id;
--   (h) the costume rows: category 'costume', legendary, priced in the
--       legendary band, on the halloween_2026 shelf as 'new', no em dash in
--       a player-facing string, Hollow Jack the top price;
--   (i) costumes never reach daily_shop() nor a mystery box, even with the
--       halloween_2026 shelf OPEN;
--   (j) buy_hat refuses a costume while the shelf is dark or closed
--       (not_in_window) and sells it inside the window;
--   (k) grants: anon cannot execute equip_cosmetic / my_porch_round.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.a5_slots(p uuid) RETURNS jsonb LANGUAGE sql AS $$
	SELECT jsonb_build_object(
		'hat', active_hat_id, 'bow', active_bow_id, 'glasses', active_glasses_id,
		'mask', active_mask_id, 'neck', active_neck_id, 'aura', active_aura_id,
		'held', active_held_id, 'background', active_background_id,
		'flag', active_flag_id, 'tickle_particle', active_tickle_particle_id)
	FROM public.profiles WHERE id = p $$;

-- ── Fixture: a Rosie pig in a full outfit who owns two costumes ────────────
DO $a5fix$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	v uuid := '00000000-0000-0000-0000-0000000a5002';
BEGIN
	INSERT INTO auth.users (id) VALUES (u), (v) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter) VALUES
		(u, 'costumepig', 10000), (v, 'porchpig', 0)
	ON CONFLICT (id) DO UPDATE SET counter = EXCLUDED.counter;
	INSERT INTO public.hats (id, name, cost, category, display_order) VALUES
		('a5_hat',     'A5 Hat',     0, 'hat',             0),
		('a5_hat2',    'A5 Hat 2',   0, 'hat',             0),
		('a5_bow',     'A5 Bow',     0, 'bow',             0),
		('a5_glasses', 'A5 Glasses', 0, 'glasses',         0),
		('a5_scarf',   'A5 Scarf',   0, 'scarf',           0),
		('a5_aura',    'A5 Aura',    0, 'aura',            0),
		('a5_held',    'A5 Held',    0, 'held',            0),
		('a5_bg',      'A5 Bg',      0, 'background',      0),
		('a5_flag',    'A5 Flag',    0, 'flag',            0),
		('a5_tp',      'A5 Particle',0, 'tickle_particle', 0)
	ON CONFLICT (id) DO NOTHING;
	INSERT INTO public.user_hats (user_id, hat_id) VALUES
		(u, 'a5_hat'), (u, 'a5_hat2'), (u, 'a5_bow'), (u, 'a5_glasses'), (u, 'a5_scarf'),
		(u, 'a5_aura'), (u, 'a5_held'), (u, 'a5_bg'), (u, 'a5_flag'), (u, 'a5_tp'),
		(u, 'halloween_2026_hollow_jack_costume'), (u, 'halloween_2026_starspell_costume')
	ON CONFLICT DO NOTHING;
	UPDATE public.profiles SET
		active_pig_id = 'rosie',
		active_hat_id = 'a5_hat', active_bow_id = 'a5_bow',
		active_glasses_id = 'a5_glasses', active_mask_id = NULL,
		active_neck_id = 'a5_scarf', active_aura_id = 'a5_aura',
		active_held_id = 'a5_held', active_background_id = 'a5_bg',
		active_flag_id = 'a5_flag', active_tickle_particle_id = 'a5_tp',
		active_costume_id = NULL
	WHERE id = u;
END
$a5fix$;

-- ── (a)-(e) Equip rules ──────────────────────────────────────────────────────
DO $a5eq$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	r jsonb;
	before_slots jsonb;
	costume text;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	before_slots := pg_temp.a5_slots(u);

	-- (a) Equip a costume on Rosie: only the costume column moves.
	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	IF NOT (r->>'ok')::boolean
	   OR r->'update' <> jsonb_build_object('active_costume_id', 'halloween_2026_hollow_jack_costume') THEN
		RAISE EXCEPTION 'chk costumes a: costume equip failed: %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS DISTINCT FROM 'halloween_2026_hollow_jack_costume' THEN
		RAISE EXCEPTION 'chk costumes a: active_costume_id should be set, got %', costume; END IF;
	IF pg_temp.a5_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes a: a costume moved another slot: % -> %', before_slots, pg_temp.a5_slots(u); END IF;

	-- Swapping costumes is a plain overwrite.
	r := public.equip_cosmetic('halloween_2026_starspell_costume');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR costume <> 'halloween_2026_starspell_costume' THEN
		RAISE EXCEPTION 'chk costumes a: costume swap failed: % / %', r, costume; END IF;
	IF pg_temp.a5_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes a: a costume swap moved another slot'; END IF;

	-- (b) A hat while costumed: allowed, costume kept.
	r := public.equip_cosmetic('a5_hat2');
	IF NOT (r->>'ok')::boolean OR r->'update'->>'active_hat_id' <> 'a5_hat2' THEN
		RAISE EXCEPTION 'chk costumes b: hat equip while costumed failed: %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS DISTINCT FROM 'halloween_2026_starspell_costume' THEN
		RAISE EXCEPTION 'chk costumes b: a hat equip cleared the costume, got %', costume; END IF;
	IF pg_temp.a5_slots(u) <> (before_slots || jsonb_build_object('hat', 'a5_hat2')) THEN
		RAISE EXCEPTION 'chk costumes b: the hat equip moved more than the hat: %', pg_temp.a5_slots(u); END IF;

	-- (c) Take the costume off: the outfit underneath is intact.
	r := public.equip_cosmetic(NULL, 'costume');
	IF NOT (r->>'ok')::boolean OR r->'update' <> '{"active_costume_id": null}'::jsonb THEN
		RAISE EXCEPTION 'chk costumes c: costume unequip failed: %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS NOT NULL THEN
		RAISE EXCEPTION 'chk costumes c: active_costume_id should be NULL, got %', costume; END IF;
	IF pg_temp.a5_slots(u) <> (before_slots || jsonb_build_object('hat', 'a5_hat2')) THEN
		RAISE EXCEPTION 'chk costumes c: unequip touched the outfit: %', pg_temp.a5_slots(u); END IF;

	-- (d) A costume the pig does not own.
	r := public.equip_cosmetic('halloween_2026_little_imp_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'chk costumes d: unowned costume should be not_owned, got %', r; END IF;

	-- (e) Non-Rosie pig: refused, nothing written; unequip still allowed.
	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'chk costumes e: re-equip on Rosie failed: %', r; END IF;
	UPDATE public.profiles SET active_pig_id = 'pepper' WHERE id = u;
	r := public.equip_cosmetic('halloween_2026_starspell_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'costume_rosie_only' THEN
		RAISE EXCEPTION 'chk costumes e: non-Rosie equip should be costume_rosie_only, got %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS DISTINCT FROM 'halloween_2026_hollow_jack_costume' THEN
		RAISE EXCEPTION 'chk costumes e: a refused equip changed the saved costume, got %', costume; END IF;
	-- Not-owned still answers first on a non-Rosie pig.
	r := public.equip_cosmetic('halloween_2026_little_imp_costume');
	IF r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'chk costumes e: not_owned should answer before the pig rule, got %', r; END IF;
	-- Other slots still equip on a non-Rosie pig.
	r := public.equip_cosmetic('a5_hat');
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk costumes e: a hat should still equip on a non-Rosie pig, got %', r; END IF;
	r := public.equip_cosmetic(NULL, 'costume');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR costume IS NOT NULL THEN
		RAISE EXCEPTION 'chk costumes e: unequip on a non-Rosie pig should work: % / %', r, costume; END IF;
	UPDATE public.profiles SET active_pig_id = 'rosie', active_hat_id = 'a5_hat' WHERE id = u;

	RAISE NOTICE 'chk costumes a-e: equip / keep outfit / hat-while-costumed / unequip / not_owned / costume_rosie_only OK';
END
$a5eq$;

-- ── (f) FK: deleting the worn row nulls the slot ───────────────────────────────
BEGIN;
DO $a5fk$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	r jsonb;
	costume text;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	INSERT INTO public.hats (id, name, cost, category, display_order) VALUES ('a5_tmp_costume', 'Tmp', 0, 'costume', 0);
	INSERT INTO public.user_hats (user_id, hat_id) VALUES (u, 'a5_tmp_costume');
	r := public.equip_cosmetic('a5_tmp_costume');
	IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'chk costumes f: equip failed: %', r; END IF;
	DELETE FROM public.hats WHERE id = 'a5_tmp_costume';
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS NOT NULL THEN
		RAISE EXCEPTION 'chk costumes f: FK should null the slot, got %', costume; END IF;
	RAISE NOTICE 'chk costumes f: active_costume_id FK ON DELETE SET NULL OK';
END
$a5fk$;
ROLLBACK;

-- ── (g) Payloads: home_stats() + my_porch_round() ─────────────────────────────
-- home_stats() wraps _home_stats_before_streak(), whose body needs tables the
-- stub lacks; a rolled-back stand-in returns the base {ok:true}.
BEGIN;
CREATE OR REPLACE FUNCTION public._home_stats_before_streak()
RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('ok', true, 'active_hat_id', 'a5_hat') $$;
DO $a5pay$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	v uuid := '00000000-0000-0000-0000-0000000a5002';
	r jsonb;
	stop jsonb;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	-- Bare: the keys are present, as JSON null.
	r := public.home_stats();
	IF NOT (r ? 'active_costume_id') OR jsonb_typeof(r->'active_costume_id') <> 'null'
	   OR NOT (r ? 'active_costume') OR jsonb_typeof(r->'active_costume') <> 'null' THEN
		RAISE EXCEPTION 'chk costumes g: bare home_stats should carry null costume keys: %', r; END IF;
	IF r->>'active_hat_id' <> 'a5_hat' OR NOT (r ? 'current_streak') THEN
		RAISE EXCEPTION 'chk costumes g: home_stats lost its base / streak keys: %', r; END IF;

	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	r := public.home_stats();
	IF r->>'active_costume_id' IS DISTINCT FROM 'halloween_2026_hollow_jack_costume'
	   OR r->'active_costume' <> jsonb_build_object('id', 'halloween_2026_hollow_jack_costume',
	                                                'category', 'costume', 'emoji', NULL) THEN
		RAISE EXCEPTION 'chk costumes g: home_stats costume payload wrong: % / %', r->'active_costume_id', r->'active_costume'; END IF;

	-- No caller: the base comes straight back.
	PERFORM set_config('smoke.uid', '', true);
	r := public.home_stats();
	IF r <> jsonb_build_object('ok', true, 'active_hat_id', 'a5_hat') THEN
		RAISE EXCEPTION 'chk costumes g: no-caller home_stats should return the base, got %', r; END IF;

	-- Porch Round: the visitor's scrapbook shows the visited pig's costume + pig.
	INSERT INTO public.porch_round_stops (visitor_id, target_id, visit_started_at, page_number, stop_number)
	VALUES (v, u, now(), 1, 1);
	PERFORM set_config('smoke.uid', v::text, true);
	r := public.my_porch_round(60);
	IF NOT (r->>'ok')::boolean OR jsonb_array_length(r->'stops') <> 1 THEN
		RAISE EXCEPTION 'chk costumes g: porch round should list one stop: %', r; END IF;
	stop := r->'stops'->0;
	IF stop->>'target_user_id' <> u::text
	   OR stop->>'active_costume_id' IS DISTINCT FROM 'halloween_2026_hollow_jack_costume'
	   OR stop->>'active_pig_id' IS DISTINCT FROM 'rosie'
	   OR stop->>'active_hat_id' IS DISTINCT FROM 'a5_hat'
	   OR NOT (stop ?& ARRAY['id','page_number','stop_number','target_name','visited_at','wallow_count']) THEN
		RAISE EXCEPTION 'chk costumes g: porch stop payload wrong: %', stop; END IF;

	RAISE NOTICE 'chk costumes g: home_stats + my_porch_round carry the costume OK';
END
$a5pay$;
ROLLBACK;

-- ── (h) The costume rows ─────────────────────────────────────────────────────
DO $a5cat$
DECLARE
	n int;
	bad text;
	top text;
BEGIN
	SELECT count(*) INTO n FROM public.hats WHERE category = 'costume' AND id LIKE 'halloween\_2026\_%\_costume';
	-- The parent may pull one or two rows that fail the fit check.
	IF n NOT BETWEEN 9 AND 11 THEN
		RAISE EXCEPTION 'chk costumes h: expected 9-11 costume rows, got %', n; END IF;
	SELECT string_agg(id, ',') INTO bad FROM public.hats
	WHERE category = 'costume' AND id LIKE 'halloween\_2026\_%'
		AND NOT (rarity = 'legendary' AND cost BETWEEN 2000 AND 5000
			AND shelf_key = 'halloween_2026' AND shelf_lane = 'new'
			AND NOT members_only AND NOT pass_exclusive AND emoji IS NULL
			AND name IS NOT NULL AND description IS NOT NULL
			AND position(U&'\2014' IN name || description) = 0
			AND display_order > 1635);
	IF bad IS NOT NULL THEN
		RAISE EXCEPTION 'chk costumes h: costume rows off-spec: %', bad; END IF;
	IF EXISTS (SELECT 1 FROM public.hats WHERE id = 'halloween_2026_hollow_jack_costume') THEN
		SELECT id INTO top FROM public.hats WHERE category = 'costume' AND id LIKE 'halloween\_2026\_%'
		ORDER BY cost DESC, id LIMIT 1;
		IF top <> 'halloween_2026_hollow_jack_costume' THEN
			RAISE EXCEPTION 'chk costumes h: Hollow Jack should be the top price, top is %', top; END IF;
	END IF;
	RAISE NOTICE 'chk costumes h: % costume rows on the halloween_2026 shelf OK', n;
END
$a5cat$;

-- ── (i) Never in the daily drop nor a mystery box, even with the shelf open ───
BEGIN;
UPDATE public.seasonal_shelves
	SET opens_at = now() - interval '1 hour', closes_at = now() + interval '2 days'
	WHERE key = 'halloween_2026';
DO $a5drop$
DECLARE
	b uuid := '00000000-0000-0000-0000-0000000a5003';
	r jsonb;
	n int;
	n_costume int;
BEGIN
	IF NOT public.seasonal_shelf_is_open('halloween_2026') THEN
		RAISE EXCEPTION 'chk costumes i: halloween_2026 should be open in this block'; END IF;
	IF EXISTS (SELECT 1 FROM public.daily_shop() d WHERE d.category = 'costume') THEN
		RAISE EXCEPTION 'chk costumes i: a costume is in the live daily_shop()'; END IF;
	-- Price out everything else: whatever daily_shop returns now could only be a costume.
	UPDATE public.hats SET cost = 0 WHERE category IS DISTINCT FROM 'costume';
	SELECT count(*) INTO n FROM public.daily_shop();
	IF n <> 0 THEN
		RAISE EXCEPTION 'chk costumes i: % costume rows reached daily_shop()', n; END IF;
	SELECT count(*) INTO n_costume FROM public.hats WHERE category = 'costume' AND cost > 0;

	INSERT INTO auth.users (id) VALUES (b) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter) VALUES (b, 'costumebox', 0)
	ON CONFLICT (id) DO UPDATE SET counter = 0;
	-- A box naming the costume category, and the season-pass 'hat' box.
	r := public.grant_mystery_box(b, 'costume');
	IF r->>'granted_hat_id' IS NOT NULL OR (r->>'fallback_snouts')::int <> 150 THEN
		RAISE EXCEPTION 'chk costumes i: a costume box handed out %', r; END IF;
	r := public.grant_mystery_box(b, 'hat');
	IF r->>'granted_hat_id' IS NOT NULL THEN
		RAISE EXCEPTION 'chk costumes i: a hat box handed out %', r; END IF;
	IF EXISTS (SELECT 1 FROM public.user_hats uh JOIN public.hats h ON h.id = uh.hat_id
	           WHERE uh.user_id = b AND h.category = 'costume') THEN
		RAISE EXCEPTION 'chk costumes i: the box pig owns a costume'; END IF;
	RAISE NOTICE 'chk costumes i: % priced costumes kept out of daily_shop + mystery box (shelf open) OK', n_costume;
END
$a5drop$;
ROLLBACK;

-- ── (j) buy_hat sells a costume only inside the shelf window ─────────────────
BEGIN;
DO $a5buy$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	r jsonb;
	bal int;
	price int;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	UPDATE public.profiles SET counter = 10000 WHERE id = u;
	-- The shelf ships dark.
	IF public.seasonal_shelf_is_open('halloween_2026') THEN
		RAISE EXCEPTION 'chk costumes j: halloween_2026 should be dark here'; END IF;
	r := public.buy_hat('halloween_2026_count_snout_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_in_window' THEN
		RAISE EXCEPTION 'chk costumes j: dark shelf should refuse a costume, got %', r; END IF;

	-- Open the window.
	UPDATE public.seasonal_shelves
		SET opens_at = now() - interval '1 hour', closes_at = now() + interval '2 days'
		WHERE key = 'halloween_2026';
	SELECT cost INTO price FROM public.hats WHERE id = 'halloween_2026_count_snout_costume';
	r := public.buy_hat('halloween_2026_count_snout_costume');
	IF NOT (r->>'ok')::boolean OR (r->>'remaining')::int <> 10000 - price THEN
		RAISE EXCEPTION 'chk costumes j: open shelf should sell the costume, got %', r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u;
	IF bal <> 10000 - price THEN RAISE EXCEPTION 'chk costumes j: balance %, expected %', bal, 10000 - price; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u AND hat_id = 'halloween_2026_count_snout_costume') THEN
		RAISE EXCEPTION 'chk costumes j: the bought costume must land in user_hats'; END IF;
	r := public.buy_hat('halloween_2026_count_snout_costume');
	IF r->>'reason' <> 'already_owned' THEN
		RAISE EXCEPTION 'chk costumes j: a second buy should be already_owned, got %', r; END IF;
	-- The bought costume equips.
	r := public.equip_cosmetic('halloween_2026_count_snout_costume');
	IF NOT (r->>'ok')::boolean THEN RAISE EXCEPTION 'chk costumes j: bought costume should equip, got %', r; END IF;

	-- Closed (boarded tail): refused again, nothing spent.
	UPDATE public.seasonal_shelves SET closes_at = now() WHERE key = 'halloween_2026';
	r := public.buy_hat('halloween_2026_moonpuff_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_in_window' THEN
		RAISE EXCEPTION 'chk costumes j: closed shelf should refuse a costume, got %', r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u;
	IF bal <> 10000 - price THEN RAISE EXCEPTION 'chk costumes j: a refusal spent snouts, balance %', bal; END IF;

	RAISE NOTICE 'chk costumes j: buy_hat sells costumes only inside the shelf window OK';
END
$a5buy$;
ROLLBACK;

-- ── (k) Grants ─────────────────────────────────────────────────────────────────
DO $a5grants$
BEGIN
	IF has_function_privilege('anon', 'public.equip_cosmetic(text,text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes k: anon can execute equip_cosmetic'; END IF;
	IF NOT has_function_privilege('authenticated', 'public.equip_cosmetic(text,text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes k: authenticated cannot execute equip_cosmetic'; END IF;
	IF has_function_privilege('anon', 'public.my_porch_round(int)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes k: anon can execute my_porch_round'; END IF;
	IF has_function_privilege('anon', 'public.home_stats()', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes k: anon can execute home_stats'; END IF;
	-- No column-level SELECT ACL on profiles: the table grant covers the new column.
	IF EXISTS (SELECT 1 FROM pg_attribute
	           WHERE attrelid = 'public.profiles'::regclass AND attnum > 0 AND attacl IS NOT NULL
	             AND array_to_string(attacl, ',') ~ 'authenticated=[a-zA-Z]*r') THEN
		RAISE EXCEPTION 'chk costumes k: profiles has column-level SELECT grants; active_costume_id needs one'; END IF;
	RAISE NOTICE 'chk costumes k: grants OK';
END
$a5grants$;

-- Read like a client does (Supabase's table-level grant, rolled back): a direct
-- select of another pig's costume works as authenticated.
BEGIN;
GRANT SELECT ON public.profiles TO authenticated;
SET LOCAL ROLE authenticated;
DO $a5read$
DECLARE
	c text;
BEGIN
	SELECT active_costume_id INTO c FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000a5001';
	RAISE NOTICE 'chk costumes k: authenticated direct select of active_costume_id OK';
END
$a5read$;
ROLLBACK;

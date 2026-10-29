-- Seasonal shelves (20261029220000): seasonal_shelf(), daily_shop(), buy_hat().
--
-- Proves:
--   (a) a dark shelf (NULL opens_at) is hidden: seasonal_shelf() is NULL while
--       it is the only shelf;
--   (b) an open shelf lists its items new-lane first (then display_order, id),
--       with lanes, the caller's owned flags and owned_count, status 'open';
--       the latest-opened open shelf wins; an empty shelf's items is []; no
--       caller means every owned flag is false (no raise);
--   (c) buy_hat refuses a 'new' item whose shelf is dark / not yet open /
--       long closed / missing with 'not_in_window' (balance + inventory
--       untouched), sells a 'new' item of the open shelf and a 'returning'
--       item of a closed shelf; pass_exclusive / members_only keep their order;
--   (d) daily_shop() still rolls 'returning' and untagged items, never 'new';
--   (e) boarded: a shelf closed 1 day ago is 'boarded' with the owned items
--       (most recently closed wins) and refuses its 'new' items; closed 4 days
--       ago means NULL;
--   (f) RLS hides dark / not-yet-open shelves from authenticated + anon;
--       seasonal_shelf() is not executable by anon;
--   (m) grant_mystery_box never hands out a 'new' piece (even of an OPEN
--       shelf): it grants the plain / returning rows, then pays the snout
--       fallback rather than box a debut;
--   (h) when 20261029230000_halloween_2026_catalog.sql is applied: the dark
--       halloween_2026 shelf is hidden (seasonal_shelf, RLS), none of its rows
--       reach daily_shop() or a mystery box, and buy_hat refuses them.
--       Skipped (with a NOTICE) when the catalog is not in the chain.
\set ON_ERROR_STOP on

-- ── (a) A dark shelf alone is hidden ───────────────────────────────────────
DO $a3a$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a3001';
	r jsonb;
BEGIN
	INSERT INTO auth.users (id) VALUES (u) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter) VALUES (u, 'shelfpig', 1000)
	ON CONFLICT (id) DO UPDATE SET counter = 1000;

	-- Dark: a closes_at alone does not open it.
	INSERT INTO public.seasonal_shelves (key, title, opens_at, closes_at)
	VALUES ('a3_dark', 'Dark Shelf', NULL, now() + interval '6 days');
	INSERT INTO public.hats (id, name, cost, category, display_order, shelf_key, shelf_lane, pass_exclusive) VALUES
		('a3_dark_new',  'Dark New',  100, 'hat', 1, 'a3_dark', 'new', false),
		('a3_dark_pass', 'Dark Pass',   0, 'hat', 2, 'a3_dark', 'new', true);

	-- Only dark shelves exist yet (a3_dark, plus halloween_2026 when the
	-- 20261029230000 catalog is applied, which ships dark).
	IF EXISTS (SELECT 1 FROM public.seasonal_shelves WHERE opens_at IS NOT NULL) THEN
		RAISE EXCEPTION 'chk shelf a: expected only dark shelves at this point'; END IF;
	PERFORM set_config('smoke.uid', u::text, true);
	r := public.seasonal_shelf();
	IF r IS NOT NULL THEN
		RAISE EXCEPTION 'chk shelf a: a dark shelf must be hidden, got %', r; END IF;
	RAISE NOTICE 'chk shelf a: dark shelf hidden OK';
END
$a3a$;

-- ── (b) An open shelf lists its items ──────────────────────────────────────
DO $a3b$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a3001';
	r jsonb;
	ids text;
	lanes text;
BEGIN
	INSERT INTO public.hats (id, name, cost, category, display_order) VALUES
		('a3_backdrop', 'Backdrop', 0, 'background', 0);
	INSERT INTO public.seasonal_shelves (key, title, kicker, opens_at, closes_at, backdrop_hat_id, theme) VALUES
		('a3_open', 'Spooky Snouts', NULL, now() - interval '1 day', now() + interval '6 days',
		 'a3_backdrop', '{"accent":"pumpkin"}'::jsonb),
		('a3_old',  'Old Shelf', 'gone', now() - interval '20 days', now() - interval '10 days', NULL, '{}'::jsonb),
		('a3_soon', 'Soon Shelf', NULL, now() + interval '2 days', now() + interval '9 days', NULL, '{}'::jsonb);
	INSERT INTO public.hats (id, name, cost, category, rarity, emoji, image_path, description,
	                         display_order, members_only, shelf_key, shelf_lane) VALUES
		('a3_open_new_b',   'New B',    300, 'hat',  'rare',   NULL, 'hats/b.png', 'b', 2, false, 'a3_open', 'new'),
		('a3_open_new_a',   'New A',    250, 'hat',  'common', NULL, 'hats/a.png', 'a', 2, false, 'a3_open', 'new'),
		('a3_open_new_c',   'New C',    200, 'mask', 'epic',   NULL, 'hats/c.png', 'c', 1, false, 'a3_open', 'new'),
		('a3_open_new_vip', 'New VIP',  400, 'hat',  'rare',   NULL, 'hats/v.png', 'v', 9, true,  'a3_open', 'new'),
		('a3_open_ret_x',   'Ret X',    150, 'hat',  'common', NULL, 'hats/x.png', 'x', 0, false, 'a3_open', 'returning'),
		('a3_open_ret_y',   'Ret Y',    120, 'hat',  'common', NULL, 'hats/y.png', 'y', 5, false, 'a3_open', 'returning'),
		('a3_old_new',      'Old New',  100, 'hat',  'common', NULL, NULL,         NULL, 1, false, 'a3_old',  'new'),
		('a3_old_ret',      'Old Ret',   90, 'hat',  'common', NULL, NULL,         NULL, 2, false, 'a3_old',  'returning'),
		('a3_soon_new',     'Soon New', 100, 'hat',  'common', NULL, NULL,         NULL, 1, false, 'a3_soon', 'new'),
		('a3_orphan_new',   'Orphan',   100, 'hat',  'common', NULL, NULL,         NULL, 1, false, NULL,      'new'),
		('a3_plain',        'Plain',     80, 'hat',  'common', NULL, NULL,         NULL, 1, false, NULL,      NULL);
	-- The caller already owns one returning piece.
	INSERT INTO public.user_hats (user_id, hat_id) VALUES (u, 'a3_open_ret_x');

	PERFORM set_config('smoke.uid', u::text, true);
	r := public.seasonal_shelf();
	IF r IS NULL THEN RAISE EXCEPTION 'chk shelf b: the open shelf must show'; END IF;
	IF r->>'key' <> 'a3_open' OR r->>'title' <> 'Spooky Snouts' OR r->>'status' <> 'open' THEN
		RAISE EXCEPTION 'chk shelf b: wrong shelf / status: %', r; END IF;
	IF NOT (r ? 'kicker') OR jsonb_typeof(r->'kicker') <> 'null' THEN
		RAISE EXCEPTION 'chk shelf b: kicker must be present as JSON null: %', r->'kicker'; END IF;
	IF (r->>'opens_at')::timestamptz <> now() - interval '1 day'
	   OR (r->>'closes_at')::timestamptz <> now() + interval '6 days' THEN
		RAISE EXCEPTION 'chk shelf b: window wrong: % .. %', r->>'opens_at', r->>'closes_at'; END IF;
	IF (r->>'now')::timestamptz <> now() THEN
		RAISE EXCEPTION 'chk shelf b: now should be the server now(), got %', r->>'now'; END IF;
	IF r->>'backdrop_hat_id' <> 'a3_backdrop' OR r->'theme' <> '{"accent":"pumpkin"}'::jsonb THEN
		RAISE EXCEPTION 'chk shelf b: backdrop / theme wrong: % %', r->>'backdrop_hat_id', r->'theme'; END IF;
	IF (r->>'item_count')::int <> 6 OR (r->>'owned_count')::int <> 1 THEN
		RAISE EXCEPTION 'chk shelf b: counts wrong: item_count % owned_count %', r->>'item_count', r->>'owned_count'; END IF;
	IF jsonb_array_length(r->'items') <> 6 THEN
		RAISE EXCEPTION 'chk shelf b: items length %', jsonb_array_length(r->'items'); END IF;

	SELECT string_agg(e->>'id', ',' ORDER BY ord), string_agg(e->>'shelf_lane', ',' ORDER BY ord)
		INTO ids, lanes
	FROM jsonb_array_elements(r->'items') WITH ORDINALITY AS t(e, ord);
	IF ids <> 'a3_open_new_c,a3_open_new_a,a3_open_new_b,a3_open_new_vip,a3_open_ret_x,a3_open_ret_y' THEN
		RAISE EXCEPTION 'chk shelf b: order must be new first, then display_order, id; got %', ids; END IF;
	IF lanes <> 'new,new,new,new,returning,returning' THEN
		RAISE EXCEPTION 'chk shelf b: lanes wrong: %', lanes; END IF;
	IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	               WHERE e->>'id' = 'a3_open_ret_x' AND (e->>'owned')::boolean) THEN
		RAISE EXCEPTION 'chk shelf b: the owned piece must say owned'; END IF;
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	           WHERE e->>'id' <> 'a3_open_ret_x' AND (e->>'owned')::boolean) THEN
		RAISE EXCEPTION 'chk shelf b: only the owned piece may say owned'; END IF;
	-- Every item carries the full client key set.
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	           WHERE NOT (e ?& ARRAY['id','name','cost','rarity','category','emoji','image_path','description',
	                                 'display_order','pass_exclusive','members_only','shelf_lane','owned'])) THEN
		RAISE EXCEPTION 'chk shelf b: an item is missing a client key'; END IF;
	IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	               WHERE e->>'id' = 'a3_open_new_c' AND (e->>'cost')::int = 200 AND e->>'category' = 'mask'
	                 AND e->>'rarity' = 'epic' AND e->>'image_path' = 'hats/c.png' AND e->>'name' = 'New C'
	                 AND (e->>'display_order')::int = 1 AND NOT (e->>'pass_exclusive')::boolean
	                 AND NOT (e->>'members_only')::boolean) THEN
		RAISE EXCEPTION 'chk shelf b: item fields wrong for a3_open_new_c'; END IF;
	-- Nothing from another shelf, nothing untagged.
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e WHERE e->>'id' NOT LIKE 'a3_open_%') THEN
		RAISE EXCEPTION 'chk shelf b: a foreign item leaked onto the shelf'; END IF;

	-- No caller: every owned flag false, no raise.
	PERFORM set_config('smoke.uid', '', true);
	r := public.seasonal_shelf();
	IF r->>'key' <> 'a3_open' OR (r->>'owned_count')::int <> 0
	   OR EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e WHERE (e->>'owned')::boolean) THEN
		RAISE EXCEPTION 'chk shelf b: no caller must mean nothing owned: %', r; END IF;

	RAISE NOTICE 'chk shelf b: open shelf listing OK';
END
$a3b$;

-- (b) The latest-opened open shelf wins; an empty shelf's items is [].
BEGIN;
DO $a3b2$
DECLARE
	r jsonb;
BEGIN
	INSERT INTO public.seasonal_shelves (key, title, opens_at, closes_at)
	VALUES ('a3_empty', 'Empty', now() - interval '1 hour', now() + interval '1 day');
	PERFORM set_config('smoke.uid', '00000000-0000-0000-0000-0000000a3001', true);
	r := public.seasonal_shelf();
	IF r->>'key' <> 'a3_empty' THEN
		RAISE EXCEPTION 'chk shelf b2: the latest opens_at should win, got %', r->>'key'; END IF;
	IF jsonb_typeof(r->'items') <> 'array' OR jsonb_array_length(r->'items') <> 0
	   OR (r->>'item_count')::int <> 0 OR (r->>'owned_count')::int <> 0 THEN
		RAISE EXCEPTION 'chk shelf b2: an empty shelf must carry items [] and zero counts: %', r; END IF;
	RAISE NOTICE 'chk shelf b2: latest-open wins + empty items [] OK';
END
$a3b2$;
ROLLBACK;

-- ── (c) buy_hat honours the window ─────────────────────────────────────────
DO $a3c$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a3001';
	r jsonb;
	bal int;
	refused text;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);

	-- 'new' items outside an open shelf: dark, not yet open, long closed, no shelf.
	FOREACH refused IN ARRAY ARRAY['a3_dark_new', 'a3_soon_new', 'a3_old_new', 'a3_orphan_new'] LOOP
		r := public.buy_hat(refused);
		IF (r->>'ok')::boolean OR r->>'reason' <> 'not_in_window' THEN
			RAISE EXCEPTION 'chk shelf c: % should be not_in_window, got %', refused, r; END IF;
		IF EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u AND hat_id = refused) THEN
			RAISE EXCEPTION 'chk shelf c: % must not be granted', refused; END IF;
	END LOOP;
	SELECT counter INTO bal FROM public.profiles WHERE id = u;
	IF bal <> 1000 THEN RAISE EXCEPTION 'chk shelf c: refusals must not spend, balance %', bal; END IF;

	-- pass_exclusive still answers first; members_only still answers after the window.
	r := public.buy_hat('a3_dark_pass');
	IF r->>'reason' <> 'pass_exclusive' THEN
		RAISE EXCEPTION 'chk shelf c: a pass piece should say pass_exclusive first, got %', r; END IF;
	r := public.buy_hat('a3_open_new_vip');
	IF r->>'reason' <> 'members_only' THEN
		RAISE EXCEPTION 'chk shelf c: an open-shelf members piece should say members_only, got %', r; END IF;

	-- A 'new' item of the open shelf sells.
	r := public.buy_hat('a3_open_new_c');
	IF NOT (r->>'ok')::boolean OR (r->>'remaining')::int <> 800 THEN
		RAISE EXCEPTION 'chk shelf c: an open-shelf new piece should sell, got %', r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u;
	IF bal <> 800 THEN RAISE EXCEPTION 'chk shelf c: balance should be 800, got %', bal; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u AND hat_id = 'a3_open_new_c') THEN
		RAISE EXCEPTION 'chk shelf c: the bought piece must land in user_hats'; END IF;

	-- A 'returning' item of a long-closed shelf sells exactly as before.
	r := public.buy_hat('a3_old_ret');
	IF NOT (r->>'ok')::boolean OR (r->>'remaining')::int <> 710 THEN
		RAISE EXCEPTION 'chk shelf c: a returning piece should sell off-window, got %', r; END IF;
	-- And an untagged one.
	r := public.buy_hat('a3_plain');
	IF NOT (r->>'ok')::boolean OR (r->>'remaining')::int <> 630 THEN
		RAISE EXCEPTION 'chk shelf c: an untagged piece should sell, got %', r; END IF;

	RAISE NOTICE 'chk shelf c: buy_hat window OK';
END
$a3c$;

-- ── (m) A mystery box never hands out a 'new' piece ────────────────────────
-- A box category of its own holds a plain row, a 'returning' row and a 'new'
-- row of the OPEN shelf (the lane rule is not a window rule). Rolled back.
BEGIN;
DO $a3m$
DECLARE
	u2 uuid := '00000000-0000-0000-0000-0000000a3002';
	r jsonb;
	granted text[] := '{}';
	i int;
	bal int;
BEGIN
	INSERT INTO auth.users (id) VALUES (u2) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter) VALUES (u2, 'boxpig', 0)
	ON CONFLICT (id) DO UPDATE SET counter = 0;
	INSERT INTO public.hats (id, name, cost, category, rarity, shelf_key, shelf_lane) VALUES
		('a3_box_plain', 'Box Plain', 100, 'a3box', 'common', NULL,      NULL),
		('a3_box_ret',   'Box Ret',   100, 'a3box', 'common', 'a3_open', 'returning'),
		('a3_box_new',   'Box New',   100, 'a3box', 'common', 'a3_open', 'new');
	IF NOT public.seasonal_shelf_is_open('a3_open') THEN
		RAISE EXCEPTION 'chk shelf m: a3_open should still be open here'; END IF;

	FOR i IN 1..2 LOOP
		r := public.grant_mystery_box(u2, 'a3box');
		IF r->>'granted_hat_id' IS NULL THEN
			RAISE EXCEPTION 'chk shelf m: box % should grant a plain / returning piece, got %', i, r; END IF;
		granted := granted || (r->>'granted_hat_id');
	END LOOP;
	IF NOT (granted @> ARRAY['a3_box_plain', 'a3_box_ret'] AND granted <@ ARRAY['a3_box_plain', 'a3_box_ret']) THEN
		RAISE EXCEPTION 'chk shelf m: the two boxes should be plain + returning, got %', granted; END IF;

	-- Only the 'new' piece is left unowned: the carried fallback pays snouts.
	r := public.grant_mystery_box(u2, 'a3box');
	IF r->>'granted_hat_id' IS NOT NULL OR (r->>'fallback_snouts')::int <> 150 THEN
		RAISE EXCEPTION 'chk shelf m: a box must not hand out a new piece, got %', r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u2;
	IF bal <> 150 THEN RAISE EXCEPTION 'chk shelf m: fallback should pay 150, balance %', bal; END IF;
	IF EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u2 AND hat_id = 'a3_box_new') THEN
		RAISE EXCEPTION 'chk shelf m: the new piece was boxed'; END IF;

	RAISE NOTICE 'chk shelf m: mystery box skips new pieces OK';
END
$a3m$;
ROLLBACK;

-- ── (h) The Halloween 2026 catalog (20261029230000), when applied ──────────
BEGIN;
DO $a3h$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a3001';
	u3 uuid := '00000000-0000-0000-0000-0000000a3003';
	n_new int;
	n int;
	r jsonb;
	piece text;
BEGIN
	IF NOT EXISTS (SELECT 1 FROM public.seasonal_shelves WHERE key = 'halloween_2026') THEN
		RAISE NOTICE 'chk shelf h: halloween_2026 catalog not applied, skipped';
		RETURN;
	END IF;
	IF EXISTS (SELECT 1 FROM public.seasonal_shelves WHERE key = 'halloween_2026' AND opens_at IS NOT NULL) THEN
		RAISE EXCEPTION 'chk shelf h: halloween_2026 should ship dark'; END IF;

	-- Every one of its 'new' rows would otherwise be a drop candidate.
	SELECT count(*) INTO n_new FROM public.hats h
	WHERE h.shelf_key = 'halloween_2026' AND h.shelf_lane = 'new'
		AND h.category NOT IN ('cape', 'flag', 'scarf', 'necklace')
		AND h.cost > 0 AND NOT h.pass_exclusive AND NOT h.members_only;
	IF n_new = 0 THEN
		RAISE EXCEPTION 'chk shelf h: expected priced new-lane Halloween rows'; END IF;

	-- Hidden: the open a3 shelf still wins, and the dark one never shows.
	PERFORM set_config('smoke.uid', u::text, true);
	r := public.seasonal_shelf();
	IF r->>'key' = 'halloween_2026' THEN
		RAISE EXCEPTION 'chk shelf h: the dark Halloween shelf must be hidden'; END IF;

	-- buy_hat refuses a dark-shelf piece.
	SELECT id INTO piece FROM public.hats
	WHERE shelf_key = 'halloween_2026' AND shelf_lane = 'new' AND cost > 0 AND NOT pass_exclusive
	ORDER BY id LIMIT 1;
	r := public.buy_hat(piece);
	IF r->>'reason' <> 'not_in_window' THEN
		RAISE EXCEPTION 'chk shelf h: % should be not_in_window, got %', piece, r; END IF;

	-- daily_shop: with every other row priced out, the drop is empty.
	UPDATE public.hats SET cost = 0 WHERE shelf_key IS DISTINCT FROM 'halloween_2026';
	SELECT count(*) INTO n FROM public.daily_shop();
	IF n <> 0 THEN
		RAISE EXCEPTION 'chk shelf h: % Halloween new rows reached daily_shop()', n; END IF;

	-- Mystery box: only Halloween 'hat' rows left priced, so the box pays the fallback.
	INSERT INTO auth.users (id) VALUES (u3) ON CONFLICT DO NOTHING;
	INSERT INTO public.profiles (id, username, counter) VALUES (u3, 'hallowpig', 0)
	ON CONFLICT (id) DO UPDATE SET counter = 0;
	r := public.grant_mystery_box(u3, 'hat');
	IF r->>'granted_hat_id' IS NOT NULL OR (r->>'fallback_snouts')::int <> 150 THEN
		RAISE EXCEPTION 'chk shelf h: a box handed out a Halloween piece: %', r; END IF;

	RAISE NOTICE 'chk shelf h: halloween_2026 dark + kept out of drop / box / buy (% new rows) OK', n_new;
END
$a3h$;
ROLLBACK;

-- ── (d) daily_shop rolls 'returning', never 'new' ──────────────────────────
-- Inside a rolled-back transaction, every non-a3 catalog row is priced out so
-- the eligible set (a3_open_ret_x, a3_open_ret_y, a3_old_ret, a3_plain) fits
-- daily_shop's LIMIT 8 deterministically.
BEGIN;
UPDATE public.hats SET cost = 0 WHERE id NOT LIKE 'a3\_%';
DO $a3d$
DECLARE
	got text;
BEGIN
	SELECT string_agg(id, ',' ORDER BY id) INTO got FROM public.daily_shop();
	IF got IS DISTINCT FROM 'a3_old_ret,a3_open_ret_x,a3_open_ret_y,a3_plain' THEN
		RAISE EXCEPTION 'chk shelf d: daily_shop should hold exactly the returning + untagged rows, got %', got; END IF;
	IF EXISTS (SELECT 1 FROM public.daily_shop() d WHERE d.shelf_lane = 'new') THEN
		RAISE EXCEPTION 'chk shelf d: a new-lane piece leaked into the daily drop'; END IF;
	RAISE NOTICE 'chk shelf d: daily_shop lane filter OK';
END
$a3d$;
ROLLBACK;

-- ── (e) Boarded tail ───────────────────────────────────────────────────────
DO $a3e$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a3001';
	r jsonb;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	-- Close the open shelf a day ago; pull the old shelf into its tail too,
	-- closed two days ago: the most recently closed wins.
	UPDATE public.seasonal_shelves
		SET opens_at = now() - interval '8 days', closes_at = now() - interval '1 day'
		WHERE key = 'a3_open';
	UPDATE public.seasonal_shelves
		SET opens_at = now() - interval '9 days', closes_at = now() - interval '2 days'
		WHERE key = 'a3_old';
	r := public.seasonal_shelf();
	IF r IS NULL OR r->>'key' <> 'a3_open' OR r->>'status' <> 'boarded' THEN
		RAISE EXCEPTION 'chk shelf e: a shelf closed 1 day ago should be boarded, got %', r; END IF;
	IF (r->>'owned_count')::int <> 2 OR (r->>'item_count')::int <> 6 THEN
		RAISE EXCEPTION 'chk shelf e: boarded counts wrong: owned % items %', r->>'owned_count', r->>'item_count'; END IF;
	IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	               WHERE e->>'id' = 'a3_open_new_c' AND (e->>'owned')::boolean) THEN
		RAISE EXCEPTION 'chk shelf e: the piece bought while open must show owned'; END IF;

	-- Boarded sells nothing new.
	r := public.buy_hat('a3_open_new_a');
	IF r->>'reason' <> 'not_in_window' THEN
		RAISE EXCEPTION 'chk shelf e: a boarded shelf must refuse its new pieces, got %', r; END IF;

	-- Closed four days ago (and the old shelf back out of its tail): nothing to show.
	UPDATE public.seasonal_shelves SET closes_at = now() - interval '4 days' WHERE key = 'a3_open';
	UPDATE public.seasonal_shelves SET closes_at = now() - interval '10 days' WHERE key = 'a3_old';
	r := public.seasonal_shelf();
	IF r IS NOT NULL THEN
		RAISE EXCEPTION 'chk shelf e: a shelf closed 4 days ago must be gone, got %', r; END IF;

	RAISE NOTICE 'chk shelf e: boarded tail OK';
END
$a3e$;

-- ── (f) RLS + grants ───────────────────────────────────────────────────────
BEGIN;
SET LOCAL ROLE authenticated;
DO $a3f$
DECLARE
	seen text;
BEGIN
	SELECT string_agg(key, ',' ORDER BY key) INTO seen
	FROM public.seasonal_shelves WHERE key LIKE 'a3\_%';
	IF seen IS DISTINCT FROM 'a3_old,a3_open' THEN
		RAISE EXCEPTION 'chk shelf f: authenticated should see only opened shelves, saw %', seen; END IF;
	-- The dark Halloween shelf (when the catalog is applied) is invisible too.
	IF EXISTS (SELECT 1 FROM public.seasonal_shelves WHERE key = 'halloween_2026') THEN
		RAISE EXCEPTION 'chk shelf f: authenticated can see the dark halloween_2026 shelf'; END IF;
END
$a3f$;
SET LOCAL ROLE anon;
DO $a3f2$
DECLARE
	seen text;
BEGIN
	SELECT string_agg(key, ',' ORDER BY key) INTO seen
	FROM public.seasonal_shelves WHERE key LIKE 'a3\_%';
	IF seen IS DISTINCT FROM 'a3_old,a3_open' THEN
		RAISE EXCEPTION 'chk shelf f: anon should see only opened shelves, saw %', seen; END IF;
END
$a3f2$;
ROLLBACK;

DO $a3g$
BEGIN
	IF has_function_privilege('anon', 'public.seasonal_shelf()', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk shelf f: anon must not execute seasonal_shelf()'; END IF;
	IF NOT has_function_privilege('authenticated', 'public.seasonal_shelf()', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk shelf f: authenticated must execute seasonal_shelf()'; END IF;
	RAISE NOTICE 'chk shelf f: RLS + grants OK';
END
$a3g$;

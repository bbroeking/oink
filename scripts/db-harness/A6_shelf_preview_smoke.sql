-- Shelf preview (20261029250000_shelf_preview_override.sql): one account sees a
-- dark shelf as open (feature_overrides.shelf_preview) and buys from it.
-- Runs after A3 (seasonal shelves) and A5 (costumes): at this point no shelf
-- is open or boarded, and halloween_2026 is dark (opens_at / closes_at NULL).
-- Fixtures: 00ze_shelf_preview_prep.sql (the founder row, a namesake).
--
-- Proves:
--   (a) the migration set shelf_preview on the founder row only, keeping its
--       world_boss and season_preview keys; the namesake is untouched;
--   (b) the override user sees the dark halloween_2026 shelf as OPEN with
--       preview: true, the synthetic window (now() - 1 day .. now() + 14 days),
--       every item, the client key set; a non-override user and no caller
--       see NULL;
--   (c) the override user buys a 'new' piece (snouts spent, user_hats row,
--       then already_owned, owned on the shelf); a non-override user gets
--       not_in_window with nothing spent;
--   (d) window variants: a real future closes_at is kept; a past one becomes
--       now() + 14 days; a not-yet-open shelf previews too; the preview wins
--       over a really open shelf for the override user, while everyone else
--       gets that open shelf with NO preview key;
--   (e) the preview retires once the shelf has opened for real: an open shelf
--       is the real window (no preview key), a boarded one is boarded and
--       refuses 'new' with not_in_window;
--   (f) an override naming a missing shelf is no override; an override naming
--       another shelf does not open halloween_2026;
--   (g) with the preview active, daily_shop() and grant_mystery_box() still
--       never hand out a 'new' piece, and neither function reads the override;
--   (h) grants unchanged: anon cannot execute seasonal_shelf().
\set ON_ERROR_STOP on

-- ── (a) The founder row, and only it ───────────────────────────────────────
DO $a6a$
DECLARE
	fo jsonb;
BEGIN
	SELECT feature_overrides INTO fo FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000a6001';
	IF fo IS DISTINCT FROM '{"world_boss": true, "season_preview": "snout_season_2", "shelf_preview": "halloween_2026"}'::jsonb THEN
		RAISE EXCEPTION 'chk preview a: founder overrides wrong: %', fo; END IF;
	SELECT feature_overrides INTO fo FROM public.profiles WHERE id = '00000000-0000-0000-0000-0000000a6003';
	IF fo IS DISTINCT FROM '{}'::jsonb THEN
		RAISE EXCEPTION 'chk preview a: the namesake was touched: %', fo; END IF;
	IF (SELECT count(*) FROM public.profiles WHERE feature_overrides ? 'shelf_preview') <> 1 THEN
		RAISE EXCEPTION 'chk preview a: shelf_preview must be on exactly one row'; END IF;
	RAISE NOTICE 'chk preview a: founder-only override, existing keys kept OK';
END
$a6a$;

-- A plain player for the rest of the smoke.
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-0000000a6002') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, username, counter) VALUES ('00000000-0000-0000-0000-0000000a6002', 'plainpig', 100000)
ON CONFLICT (id) DO UPDATE SET counter = 100000;

-- ── (b) The override user sees the dark shelf as open ──────────────────────
DO $a6b$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	u2 uuid := '00000000-0000-0000-0000-0000000a6002';
	r jsonb;
	n_rows int;
BEGIN
	IF EXISTS (SELECT 1 FROM public.seasonal_shelves WHERE key = 'halloween_2026' AND opens_at IS NOT NULL) THEN
		RAISE EXCEPTION 'chk preview b: halloween_2026 should be dark here'; END IF;
	IF EXISTS (SELECT 1 FROM public.seasonal_shelves s WHERE s.opens_at IS NOT NULL AND s.closes_at IS NOT NULL
	           AND s.opens_at <= now() AND now() < s.closes_at + interval '3 days') THEN
		RAISE EXCEPTION 'chk preview b: expected no open / boarded shelf at this point'; END IF;
	SELECT count(*) INTO n_rows FROM public.hats WHERE shelf_key = 'halloween_2026';

	PERFORM set_config('smoke.uid', u1::text, true);
	r := public.seasonal_shelf();
	IF r IS NULL OR r->>'key' IS DISTINCT FROM 'halloween_2026' OR r->>'status' IS DISTINCT FROM 'open' THEN
		RAISE EXCEPTION 'chk preview b: the override user should see halloween_2026 open, got %', r; END IF;
	IF r->'preview' IS DISTINCT FROM 'true'::jsonb THEN
		RAISE EXCEPTION 'chk preview b: preview flag missing: %', r->'preview'; END IF;
	IF (r->>'opens_at')::timestamptz <> now() - interval '1 day'
	   OR (r->>'closes_at')::timestamptz <> now() + interval '14 days' THEN
		RAISE EXCEPTION 'chk preview b: synthetic window wrong: % .. %', r->>'opens_at', r->>'closes_at'; END IF;
	IF (r->>'now')::timestamptz <> now() THEN
		RAISE EXCEPTION 'chk preview b: now should be the server now(), got %', r->>'now'; END IF;
	IF (r->>'item_count')::int <> n_rows OR jsonb_array_length(r->'items') <> n_rows
	   OR (r->>'owned_count')::int <> 0 OR n_rows < 46 THEN
		RAISE EXCEPTION 'chk preview b: items wrong: item_count % length % owned % rows %',
			r->>'item_count', jsonb_array_length(r->'items'), r->>'owned_count', n_rows; END IF;
	-- The payload is the open shelf's key set plus preview.
	IF NOT (r ?& ARRAY['key','title','kicker','opens_at','closes_at','status','backdrop_hat_id','theme',
	                   'now','item_count','owned_count','items','preview'])
	   OR (SELECT count(*) FROM jsonb_object_keys(r)) <> 13 THEN
		RAISE EXCEPTION 'chk preview b: payload keys wrong: %', (SELECT array_agg(k) FROM jsonb_object_keys(r) k); END IF;
	IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	           WHERE NOT (e ?& ARRAY['id','name','cost','rarity','category','emoji','image_path','description',
	                                 'display_order','pass_exclusive','members_only','shelf_lane','owned'])) THEN
		RAISE EXCEPTION 'chk preview b: an item is missing a client key'; END IF;

	-- Everyone else: nothing to show.
	PERFORM set_config('smoke.uid', u2::text, true);
	r := public.seasonal_shelf();
	IF r IS NOT NULL THEN RAISE EXCEPTION 'chk preview b: a plain user must see no shelf, got %', r; END IF;
	PERFORM set_config('smoke.uid', '', true);
	r := public.seasonal_shelf();
	IF r IS NOT NULL THEN RAISE EXCEPTION 'chk preview b: no caller must see no shelf, got %', r; END IF;

	RAISE NOTICE 'chk preview b: dark shelf open for the override user only (% items) OK', n_rows;
END
$a6b$;

-- ── (c) The override user buys; everyone else is refused ───────────────────
DO $a6c$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	u2 uuid := '00000000-0000-0000-0000-0000000a6002';
	piece text;
	price int;
	r jsonb;
	bal int;
BEGIN
	SELECT id, cost INTO piece, price FROM public.hats
	WHERE shelf_key = 'halloween_2026' AND shelf_lane = 'new' AND cost > 0
		AND NOT pass_exclusive AND NOT members_only AND category <> 'costume'
	ORDER BY id LIMIT 1;
	IF piece IS NULL THEN RAISE EXCEPTION 'chk preview c: no sellable Halloween piece'; END IF;

	-- The plain user first: refused, nothing spent.
	PERFORM set_config('smoke.uid', u2::text, true);
	r := public.buy_hat(piece);
	IF (r->>'ok')::boolean OR r->>'reason' IS DISTINCT FROM 'not_in_window' THEN
		RAISE EXCEPTION 'chk preview c: a plain user should get not_in_window for %, got %', piece, r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u2;
	IF bal <> 100000 OR EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u2 AND hat_id = piece) THEN
		RAISE EXCEPTION 'chk preview c: the refusal spent or granted (balance %)', bal; END IF;

	-- The override user buys it.
	PERFORM set_config('smoke.uid', u1::text, true);
	r := public.buy_hat(piece);
	IF NOT (r->>'ok')::boolean OR (r->>'remaining')::int <> 100000 - price THEN
		RAISE EXCEPTION 'chk preview c: the override user should buy %, got %', piece, r; END IF;
	SELECT counter INTO bal FROM public.profiles WHERE id = u1;
	IF bal <> 100000 - price THEN RAISE EXCEPTION 'chk preview c: balance %, expected %', bal, 100000 - price; END IF;
	IF NOT EXISTS (SELECT 1 FROM public.user_hats WHERE user_id = u1 AND hat_id = piece) THEN
		RAISE EXCEPTION 'chk preview c: the bought piece must land in user_hats'; END IF;
	r := public.buy_hat(piece);
	IF r->>'reason' IS DISTINCT FROM 'already_owned' THEN
		RAISE EXCEPTION 'chk preview c: a second buy should be already_owned, got %', r; END IF;
	-- A costume sells too (the legendary 'new' rows on the same shelf).
	r := public.buy_hat('halloween_2026_count_snout_costume');
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk preview c: the override user should buy a costume, got %', r; END IF;

	r := public.seasonal_shelf();
	IF (r->>'owned_count')::int <> 2
	   OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') e
	                  WHERE e->>'id' = piece AND (e->>'owned')::boolean) THEN
		RAISE EXCEPTION 'chk preview c: the bought pieces must show owned, owned_count %', r->>'owned_count'; END IF;

	RAISE NOTICE 'chk preview c: override user buys %, plain user not_in_window OK', piece;
END
$a6c$;

-- ── (d) Window variants (rolled back) ──────────────────────────────────────
BEGIN;
DO $a6d$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	u2 uuid := '00000000-0000-0000-0000-0000000a6002';
	r jsonb;
	piece text;
BEGIN
	SELECT id INTO piece FROM public.hats
	WHERE shelf_key = 'halloween_2026' AND shelf_lane = 'new' AND cost > 0
		AND NOT pass_exclusive AND NOT members_only AND category <> 'costume'
		AND id NOT IN (SELECT hat_id FROM public.user_hats WHERE user_id = u1)
	ORDER BY id LIMIT 1;
	PERFORM set_config('smoke.uid', u1::text, true);

	-- Dark with a real closes_at in the future: kept.
	UPDATE public.seasonal_shelves SET opens_at = NULL, closes_at = now() + interval '5 days'
		WHERE key = 'halloween_2026';
	r := public.seasonal_shelf();
	IF (r->>'closes_at')::timestamptz <> now() + interval '5 days'
	   OR (r->>'opens_at')::timestamptz <> now() - interval '1 day' OR r->'preview' IS DISTINCT FROM 'true'::jsonb THEN
		RAISE EXCEPTION 'chk preview d: a future closes_at should be kept: %', r; END IF;

	-- Dark with a stale closes_at in the past: now() + 14 days.
	UPDATE public.seasonal_shelves SET opens_at = NULL, closes_at = now() - interval '5 days'
		WHERE key = 'halloween_2026';
	r := public.seasonal_shelf();
	IF (r->>'closes_at')::timestamptz <> now() + interval '14 days' OR r->>'status' IS DISTINCT FROM 'open' THEN
		RAISE EXCEPTION 'chk preview d: a past closes_at should become now() + 14 days: %', r; END IF;

	-- Not yet open (a real window in the future): previewed on the synthetic
	-- opens_at with the real closes_at, and the piece sells.
	UPDATE public.seasonal_shelves SET opens_at = now() + interval '2 days', closes_at = now() + interval '9 days'
		WHERE key = 'halloween_2026';
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'halloween_2026' OR r->'preview' IS DISTINCT FROM 'true'::jsonb
	   OR (r->>'opens_at')::timestamptz <> now() - interval '1 day'
	   OR (r->>'closes_at')::timestamptz <> now() + interval '9 days' THEN
		RAISE EXCEPTION 'chk preview d: a not-yet-open shelf should preview: %', r; END IF;
	r := public.buy_hat(piece);
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk preview d: a not-yet-open previewed piece should sell, got %', r; END IF;

	-- A really open shelf elsewhere: the override user still gets the preview;
	-- everyone else gets the open shelf, with no preview key.
	INSERT INTO public.seasonal_shelves (key, title, opens_at, closes_at)
	VALUES ('a6_open', 'Open Elsewhere', now() - interval '1 hour', now() + interval '3 days');
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'halloween_2026' OR r->'preview' IS DISTINCT FROM 'true'::jsonb THEN
		RAISE EXCEPTION 'chk preview d: the preview should win for the override user, got %', r->>'key'; END IF;
	PERFORM set_config('smoke.uid', u2::text, true);
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'a6_open' OR r->>'status' IS DISTINCT FROM 'open' OR r ? 'preview'
	   OR (SELECT count(*) FROM jsonb_object_keys(r)) <> 12 THEN
		RAISE EXCEPTION 'chk preview d: a plain user should get the open shelf, unchanged: %', r; END IF;

	RAISE NOTICE 'chk preview d: synthetic window variants + preview precedence OK';
END
$a6d$;
ROLLBACK;

-- ── (e) The preview retires once the shelf opens for real (rolled back) ────
BEGIN;
DO $a6e$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	r jsonb;
	piece text;
BEGIN
	SELECT id INTO piece FROM public.hats
	WHERE shelf_key = 'halloween_2026' AND shelf_lane = 'new' AND cost > 0
		AND NOT pass_exclusive AND NOT members_only AND category <> 'costume'
		AND id NOT IN (SELECT hat_id FROM public.user_hats WHERE user_id = u1)
	ORDER BY id LIMIT 1;
	PERFORM set_config('smoke.uid', u1::text, true);

	-- Open for real: the real window, no preview key.
	UPDATE public.seasonal_shelves SET opens_at = now() - interval '2 hours', closes_at = now() + interval '6 days'
		WHERE key = 'halloween_2026';
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'halloween_2026' OR r->>'status' IS DISTINCT FROM 'open' OR r ? 'preview'
	   OR (r->>'opens_at')::timestamptz <> now() - interval '2 hours'
	   OR (r->>'closes_at')::timestamptz <> now() + interval '6 days' THEN
		RAISE EXCEPTION 'chk preview e: a really open shelf should be the real thing: %', r; END IF;

	-- Closed for real (boarded tail): boarded, and nothing new sells.
	UPDATE public.seasonal_shelves SET opens_at = now() - interval '8 days', closes_at = now() - interval '1 day'
		WHERE key = 'halloween_2026';
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'halloween_2026' OR r->>'status' IS DISTINCT FROM 'boarded' OR r ? 'preview' THEN
		RAISE EXCEPTION 'chk preview e: a closed shelf should be boarded for the override user too: %', r; END IF;
	r := public.buy_hat(piece);
	IF (r->>'ok')::boolean OR r->>'reason' IS DISTINCT FROM 'not_in_window' THEN
		RAISE EXCEPTION 'chk preview e: a really closed shelf must refuse the override user, got %', r; END IF;

	RAISE NOTICE 'chk preview e: preview retires once the shelf has opened OK';
END
$a6e$;
ROLLBACK;

-- ── (f) A missing / other shelf in the override (rolled back) ──────────────
BEGIN;
DO $a6f$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	r jsonb;
	piece text;
BEGIN
	SELECT id INTO piece FROM public.hats
	WHERE shelf_key = 'halloween_2026' AND shelf_lane = 'new' AND cost > 0
		AND NOT pass_exclusive AND NOT members_only AND category <> 'costume'
		AND id NOT IN (SELECT hat_id FROM public.user_hats WHERE user_id = u1)
	ORDER BY id LIMIT 1;
	PERFORM set_config('smoke.uid', u1::text, true);

	UPDATE public.profiles SET feature_overrides = feature_overrides || '{"shelf_preview": "no_such_shelf"}'
		WHERE id = u1;
	r := public.seasonal_shelf();
	IF r IS NOT NULL THEN RAISE EXCEPTION 'chk preview f: a missing shelf key should be no override, got %', r; END IF;
	r := public.buy_hat(piece);
	IF r->>'reason' IS DISTINCT FROM 'not_in_window' THEN
		RAISE EXCEPTION 'chk preview f: a missing shelf key must not sell %, got %', piece, r; END IF;

	-- Another dark shelf (A3's a3_dark): it previews, halloween_2026 stays shut.
	UPDATE public.profiles SET feature_overrides = feature_overrides || '{"shelf_preview": "a3_dark"}'
		WHERE id = u1;
	r := public.seasonal_shelf();
	IF r->>'key' IS DISTINCT FROM 'a3_dark' OR r->'preview' IS DISTINCT FROM 'true'::jsonb THEN
		RAISE EXCEPTION 'chk preview f: the override should preview a3_dark, got %', r; END IF;
	r := public.buy_hat(piece);
	IF r->>'reason' IS DISTINCT FROM 'not_in_window' THEN
		RAISE EXCEPTION 'chk preview f: another shelf''s preview must not sell %, got %', piece, r; END IF;
	r := public.buy_hat('a3_dark_new');
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk preview f: a3_dark_new should sell under its preview, got %', r; END IF;
	-- The pass-only piece on that shelf still says pass_exclusive.
	r := public.buy_hat('a3_dark_pass');
	IF r->>'reason' IS DISTINCT FROM 'pass_exclusive' THEN
		RAISE EXCEPTION 'chk preview f: pass_exclusive must still answer first, got %', r; END IF;

	RAISE NOTICE 'chk preview f: missing / other shelf overrides OK';
END
$a6f$;
ROLLBACK;

-- ── (g) Drop and box still exclude new pieces with the preview on ──────────
BEGIN;
DO $a6g$
DECLARE
	u1 uuid := '00000000-0000-0000-0000-0000000a6001';
	r jsonb;
	n int;
BEGIN
	PERFORM set_config('smoke.uid', u1::text, true);
	IF public.seasonal_shelf()->>'key' IS DISTINCT FROM 'halloween_2026' THEN
		RAISE EXCEPTION 'chk preview g: the preview should be active here'; END IF;
	IF EXISTS (SELECT 1 FROM public.daily_shop() d WHERE d.shelf_lane = 'new') THEN
		RAISE EXCEPTION 'chk preview g: a new piece is in the live daily_shop()'; END IF;
	-- Price out everything but the Halloween shelf: the drop is empty.
	UPDATE public.hats SET cost = 0 WHERE shelf_key IS DISTINCT FROM 'halloween_2026';
	SELECT count(*) INTO n FROM public.daily_shop();
	IF n <> 0 THEN RAISE EXCEPTION 'chk preview g: % previewed rows reached daily_shop()', n; END IF;
	-- Boxes: only Halloween rows are priced, so both boxes pay the fallback.
	r := public.grant_mystery_box(u1, 'hat');
	IF r->>'granted_hat_id' IS NOT NULL OR (r->>'fallback_snouts')::int <> 150 THEN
		RAISE EXCEPTION 'chk preview g: a hat box handed out %', r; END IF;
	r := public.grant_mystery_box(u1, 'costume');
	IF r->>'granted_hat_id' IS NOT NULL OR (r->>'fallback_snouts')::int <> 150 THEN
		RAISE EXCEPTION 'chk preview g: a costume box handed out %', r; END IF;
	-- Neither function reads the override.
	IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
	           AND proname IN ('daily_shop', 'grant_mystery_box') AND prosrc LIKE '%shelf_preview%') THEN
		RAISE EXCEPTION 'chk preview g: daily_shop / grant_mystery_box must not read shelf_preview'; END IF;
	RAISE NOTICE 'chk preview g: drop + mystery box exclude new pieces with the preview on OK';
END
$a6g$;
ROLLBACK;

-- ── (h) Grants unchanged ───────────────────────────────────────────────────
DO $a6h$
BEGIN
	IF has_function_privilege('anon', 'public.seasonal_shelf()', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk preview h: anon must not execute seasonal_shelf()'; END IF;
	IF NOT has_function_privilege('authenticated', 'public.seasonal_shelf()', 'EXECUTE')
	   OR NOT has_function_privilege('authenticated', 'public.buy_hat(text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk preview h: authenticated must execute seasonal_shelf() and buy_hat()'; END IF;
	RAISE NOTICE 'chk preview h: grants OK';
END
$a6h$;

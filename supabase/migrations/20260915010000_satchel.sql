-- The Satchel — finds given, never sold or paid for.
-- Spec: docs/satchel-spec.md (2026-09-14). SKILL.md decision 2026-09-14
-- "Satchel finds are given, never sold or paid for".
--
-- The spine, verbatim from docs/barn-visiting-design.md: VISITING IS GIVING,
-- NOT EARNING. Nothing in this file mints currency to the visitor. A find is
-- rolled by the player's OWN Dig, carried to a friend, and handed to that
-- friend's pig when it is the thing the pig is wishing for. Both pigs are
-- tickled (the same tickles a visit tap already pays); the giver keeps a
-- delivery count, a generous alignment tick and a keepsake at 10 / 50 / 100.
-- Rarity lives in Collect (the catalog, the silhouettes), never in the payout:
-- a rare wish pays the same tickles as a common one.
--
-- Shape:
--   1. app_settings.satchel_tuning — the server owns every number; the
--      client boots on constants/satchel.ts and refreshes from app_setting().
--   2. satchel_finds — the catalog (12 at launch). The client mirrors the ids
--      (constants/satchel.ts SATCHEL_FIND_IDS MUST match) for art and names.
--   3. satchel_items (the bag, capped), satchel_met (first-found, for the
--      silhouettes), pig_wishes (one live wish per profile), pig_shelf (what a
--      pig has received), satchel_deliveries (the receipt of every hand-off,
--      idempotent per (giver, host, wish_no)), satchel_keepsakes (10/50/100).
--   4. The Dig hook: a BEFORE INSERT trigger on rooting_receipts rolls 0–2
--      finds for the dig and writes them onto the receipt as `satchel`, so
--      the tally can say "your Satchel got heavier" without carrying the
--      470-line submit core (the carry-latest-def footgun stays untouched).
--   5. RPCs: my_satchel · toss_find · reroll_my_wish · friend_wishes ·
--      fulfil_pig_wish. Every one is fail-closed and returns {ok:false,reason}
--      rather than raising, so a client never sees a silent rollback.
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
INSERT INTO public.app_settings (key, value, description)
SELECT 'satchel_tuning',
	'{"cap": 6,
	  "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
	  "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
	  "wish_reroll_hours": 48,
	  "tickles": 3,
	  "keepsake_thresholds": [10, 50, 100]}'::jsonb,
	'The Satchel (docs/satchel-spec.md): bag cap, finds-per-dig odds, wish rarity weights, wish timer, tickles per delivery (flat — rarity never pays), keepsake thresholds.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'satchel_tuning');

CREATE OR REPLACE FUNCTION public._satchel_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'satchel_tuning'),
		'{"cap": 6, "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
		  "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
		  "wish_reroll_hours": 48, "tickles": 3,
		  "keepsake_thresholds": [10, 50, 100]}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._satchel_tuning() FROM PUBLIC, anon, authenticated;

-- ── 2. The catalog ───────────────────────────────────────────────────────────
CREATE TABLE public.satchel_finds (
	id text PRIMARY KEY,
	name text NOT NULL,
	rarity text NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare')),
	sort int NOT NULL
);
ALTER TABLE public.satchel_finds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_finds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.satchel_finds TO authenticated;
CREATE POLICY satchel_finds_read ON public.satchel_finds FOR SELECT TO authenticated USING (true);

INSERT INTO public.satchel_finds (id, name, rarity, sort) VALUES
	('river_pebble', 'river pebble',   'common',   10),
	('blue_feather', 'blue feather',   'common',   20),
	('clover',       'four-leaf clover','common',  30),
	('snail_shell',  'snail shell',    'common',   40),
	('brass_button', 'brass button',   'common',   50),
	('wool_tuft',    'tuft of wool',   'common',   60),
	('red_berries',  'red berries',    'common',   70),
	('pinecone',     'pinecone',       'common',   80),
	('old_key',      'old key',        'uncommon', 90),
	('honeycomb',    'honeycomb chip', 'uncommon', 100),
	('marble',       'glass marble',   'uncommon', 110),
	('tin_whistle',  'tin whistle',    'rare',     120);

-- ── 3. State ─────────────────────────────────────────────────────────────────
CREATE TABLE public.satchel_items (
	id bigserial PRIMARY KEY,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	found_window_index bigint,
	created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX satchel_items_user_idx ON public.satchel_items (user_id, created_at);
ALTER TABLE public.satchel_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.satchel_items_id_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE public.satchel_met (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	first_found_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, find_id)
);
ALTER TABLE public.satchel_met ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_met FROM PUBLIC, anon, authenticated;

CREATE TABLE public.pig_wishes (
	user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	-- Monotonic per profile: the idempotency key of a fulfilment. A wish that
	-- rerolls (fulfilled, timed out, or the owner's one "not this one") gets
	-- the next number, so a delivery can never land on a wish that is gone.
	wish_no bigint NOT NULL DEFAULT 1,
	rolled_at timestamptz NOT NULL DEFAULT now(),
	expires_at timestamptz NOT NULL,
	-- The owner's single free nudge per wish.
	owner_rerolled boolean NOT NULL DEFAULT false
);
ALTER TABLE public.pig_wishes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pig_wishes FROM PUBLIC, anon, authenticated;

CREATE TABLE public.pig_shelf (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	count int NOT NULL DEFAULT 0 CHECK (count >= 0),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, find_id)
);
ALTER TABLE public.pig_shelf ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pig_shelf FROM PUBLIC, anon, authenticated;

CREATE TABLE public.satchel_deliveries (
	id bigserial PRIMARY KEY,
	giver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	wish_no bigint NOT NULL,
	find_id text NOT NULL REFERENCES public.satchel_finds(id),
	created_at timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT satchel_deliveries_not_self CHECK (giver_id <> host_id),
	CONSTRAINT satchel_deliveries_one_per_wish UNIQUE (giver_id, host_id, wish_no)
);
CREATE INDEX satchel_deliveries_giver_idx ON public.satchel_deliveries (giver_id, created_at DESC);
ALTER TABLE public.satchel_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.satchel_deliveries_id_seq FROM PUBLIC, anon, authenticated;

CREATE TABLE public.satchel_keepsakes (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	threshold int NOT NULL,
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, threshold)
);
ALTER TABLE public.satchel_keepsakes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_keepsakes FROM PUBLIC, anon, authenticated;

-- ── Helpers ──────────────────────────────────────────────────────────────────

-- One catalog id, weighted by rarity from the tuning row. `p_not` is excluded
-- (a reroll never picks the thing just received).
CREATE OR REPLACE FUNCTION public._satchel_roll_find(p_not text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._satchel_tuning();
	w_common numeric := COALESCE((t->'rarity_weights'->>'common')::numeric, 70);
	w_uncommon numeric := COALESCE((t->'rarity_weights'->>'uncommon')::numeric, 25);
	w_rare numeric := COALESCE((t->'rarity_weights'->>'rare')::numeric, 5);
	pick_rarity text;
	r numeric := random() * (w_common + w_uncommon + w_rare);
	out_id text;
BEGIN
	pick_rarity := CASE
		WHEN r < w_common THEN 'common'
		WHEN r < w_common + w_uncommon THEN 'uncommon'
		ELSE 'rare' END;
	SELECT id INTO out_id FROM public.satchel_finds
		WHERE rarity = pick_rarity AND (p_not IS NULL OR id <> p_not)
		ORDER BY random() LIMIT 1;
	IF out_id IS NULL THEN
		SELECT id INTO out_id FROM public.satchel_finds
			WHERE p_not IS NULL OR id <> p_not ORDER BY random() LIMIT 1;
	END IF;
	RETURN out_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._satchel_roll_find(text) FROM PUBLIC, anon, authenticated;

-- Every pig has exactly one live wish. Rolls one for a profile that has none
-- and rerolls one that has timed out (wish_reroll_hours). Returns the row.
CREATE OR REPLACE FUNCTION public._ensure_wish(p_user uuid)
RETURNS public.pig_wishes LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._satchel_tuning();
	hours numeric := COALESCE((t->>'wish_reroll_hours')::numeric, 48);
	w public.pig_wishes%ROWTYPE;
BEGIN
	SELECT * INTO w FROM public.pig_wishes WHERE user_id = p_user FOR UPDATE;
	IF NOT FOUND THEN
		INSERT INTO public.pig_wishes (user_id, find_id, wish_no, rolled_at, expires_at)
		VALUES (p_user, public._satchel_roll_find(NULL), 1, now(), now() + (hours * interval '1 hour'))
		ON CONFLICT (user_id) DO NOTHING;
		SELECT * INTO w FROM public.pig_wishes WHERE user_id = p_user;
		RETURN w;
	END IF;
	IF w.expires_at <= now() THEN
		UPDATE public.pig_wishes SET
			find_id = public._satchel_roll_find(w.find_id),
			wish_no = w.wish_no + 1,
			rolled_at = now(),
			expires_at = now() + (hours * interval '1 hour'),
			owner_rerolled = false
		WHERE user_id = p_user
		RETURNING * INTO w;
	END IF;
	RETURN w;
END;
$function$;
REVOKE ALL ON FUNCTION public._ensure_wish(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._wish_json(w public.pig_wishes)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT jsonb_build_object(
		'find_id', w.find_id,
		'wish_no', w.wish_no,
		'rolled_at', w.rolled_at,
		'expires_at', w.expires_at,
		'owner_rerolled', w.owner_rerolled);
$function$;

-- ── 4. The Dig hook ──────────────────────────────────────────────────────────
-- Fires once per receipt (the table is insert-once: ON CONFLICT DO NOTHING in
-- the submit core). A re-submit that conflicts still runs BEFORE triggers, so
-- the existing-receipt check keeps the roll idempotent. The finds land in the
-- bag up to the cap; overflow is listed `lost` on the receipt and discarded —
-- never queued. The receipt gains:
--   satchel: {found: [id], lost: [id], count: <bag size after>, cap: <cap>}
CREATE OR REPLACE FUNCTION public.rooting_receipts_roll_satchel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._satchel_tuning();
	cap int := COALESCE((t->>'cap')::int, 6);
	p_none numeric := COALESCE((t->'find_odds'->>'none')::numeric, 0.30);
	p_one numeric := COALESCE((t->'find_odds'->>'one')::numeric, 0.50);
	r numeric := random();
	n int;
	i int;
	have int;
	fid text;
	found text[] := ARRAY[]::text[];
	lost text[] := ARRAY[]::text[];
BEGIN
	IF EXISTS (SELECT 1 FROM public.rooting_receipts
	           WHERE user_id = NEW.user_id AND window_index = NEW.window_index) THEN
		RETURN NEW;
	END IF;
	n := CASE WHEN r < p_none THEN 0 WHEN r < p_none + p_one THEN 1 ELSE 2 END;
	SELECT COUNT(*)::int INTO have FROM public.satchel_items WHERE user_id = NEW.user_id;
	FOR i IN 1..n LOOP
		fid := public._satchel_roll_find(NULL);
		IF fid IS NULL THEN EXIT; END IF;
		IF have < cap THEN
			INSERT INTO public.satchel_items (user_id, find_id, found_window_index)
			VALUES (NEW.user_id, fid, NEW.window_index);
			INSERT INTO public.satchel_met (user_id, find_id)
			VALUES (NEW.user_id, fid) ON CONFLICT DO NOTHING;
			have := have + 1;
			found := found || fid;
		ELSE
			lost := lost || fid;
		END IF;
	END LOOP;
	IF n > 0 THEN
		NEW.receipt := NEW.receipt || jsonb_build_object('satchel', jsonb_build_object(
			'found', to_jsonb(found), 'lost', to_jsonb(lost), 'count', have, 'cap', cap));
	END IF;
	RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.rooting_receipts_roll_satchel() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS rooting_receipts_roll_satchel ON public.rooting_receipts;
CREATE TRIGGER rooting_receipts_roll_satchel
	BEFORE INSERT ON public.rooting_receipts
	FOR EACH ROW EXECUTE FUNCTION public.rooting_receipts_roll_satchel();

-- ── 5. RPCs ──────────────────────────────────────────────────────────────────

-- The bag, the silhouettes, my pig's wish, the shelf, the count, the keepsakes.
CREATE OR REPLACE FUNCTION public.my_satchel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._satchel_tuning();
	w public.pig_wishes%ROWTYPE;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	w := public._ensure_wish(uid);
	RETURN jsonb_build_object(
		'ok', true,
		'cap', COALESCE((t->>'cap')::int, 6),
		'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'find_id', s.find_id) ORDER BY s.created_at, s.id)
		                   FROM public.satchel_items s WHERE s.user_id = uid), '[]'::jsonb),
		'met', COALESCE((SELECT jsonb_agg(m.find_id ORDER BY m.first_found_at) FROM public.satchel_met m WHERE m.user_id = uid), '[]'::jsonb),
		'wish', public._wish_json(w),
		'shelf', COALESCE((SELECT jsonb_agg(jsonb_build_object('find_id', p.find_id, 'count', p.count) ORDER BY p.updated_at DESC)
		                   FROM public.pig_shelf p WHERE p.user_id = uid AND p.count > 0), '[]'::jsonb),
		'deliveries', (SELECT COUNT(*)::int FROM public.satchel_deliveries d WHERE d.giver_id = uid),
		'keepsakes', COALESCE((SELECT jsonb_agg(k.threshold ORDER BY k.threshold) FROM public.satchel_keepsakes k WHERE k.user_id = uid), '[]'::jsonb)
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.my_satchel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_satchel() TO authenticated;

-- Toss a find out of the bag. The only thing a player can do to a find besides
-- give it — there is no selling.
CREATE OR REPLACE FUNCTION public.toss_find(p_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	n int;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	DELETE FROM public.satchel_items WHERE id = p_item_id AND user_id = uid;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_bag');
	END IF;
	SELECT COUNT(*)::int INTO n FROM public.satchel_items WHERE user_id = uid;
	RETURN jsonb_build_object('ok', true, 'count', n);
END;
$function$;
REVOKE ALL ON FUNCTION public.toss_find(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toss_find(bigint) TO authenticated;

-- The owner's one free "not this one" per wish. Never a picker.
CREATE OR REPLACE FUNCTION public.reroll_my_wish()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._satchel_tuning();
	hours numeric := COALESCE((t->>'wish_reroll_hours')::numeric, 48);
	w public.pig_wishes%ROWTYPE;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	w := public._ensure_wish(uid);
	IF w.owner_rerolled THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_rerolled', 'wish', public._wish_json(w));
	END IF;
	UPDATE public.pig_wishes SET
		find_id = public._satchel_roll_find(w.find_id),
		wish_no = w.wish_no + 1,
		rolled_at = now(),
		expires_at = now() + (hours * interval '1 hour'),
		owner_rerolled = true
	WHERE user_id = uid
	RETURNING * INTO w;
	RETURN jsonb_build_object('ok', true, 'wish', public._wish_json(w));
END;
$function$;
REVOKE ALL ON FUNCTION public.reroll_my_wish() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reroll_my_wish() TO authenticated;

-- The wishes of friends (the Friends row's wish mark; the visit's bubble).
-- Non-friends and blocked pairs are simply absent from the answer. Each
-- entry says whether the CALLER already fulfilled that exact wish.
CREATE OR REPLACE FUNCTION public.friend_wishes(p_targets uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	tid uuid;
	w public.pig_wishes%ROWTYPE;
	acc jsonb := '[]'::jsonb;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	FOREACH tid IN ARRAY COALESCE(p_targets, ARRAY[]::uuid[]) LOOP
		CONTINUE WHEN tid IS NULL OR tid = uid;
		CONTINUE WHEN NOT public.are_friends(uid, tid);
		CONTINUE WHEN public.are_blocked(uid, tid);
		w := public._ensure_wish(tid);
		acc := acc || jsonb_build_object(
			'target_id', tid,
			'find_id', w.find_id,
			'wish_no', w.wish_no,
			'expires_at', w.expires_at,
			'fulfilled_by_me', EXISTS (
				SELECT 1 FROM public.satchel_deliveries d
				WHERE d.giver_id = uid AND d.host_id = tid AND d.wish_no = w.wish_no));
	END LOOP;
	RETURN jsonb_build_object('ok', true, 'wishes', acc);
END;
$function$;
REVOKE ALL ON FUNCTION public.friend_wishes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_wishes(uuid[]) TO authenticated;

-- The hand-off. Validates wish · bag · friendship, then in ONE transaction:
-- the find leaves the giver's bag and lands on the host's shelf; both pigs are
-- tickled the same flat amount (apply_tickles — count + snouts, never the
-- bank); happiness giver 1.0 / host 0.25 (the visit's friend-act rate); a
-- generous tick for the giver; a visit-streak credit for the pair
-- (idempotent per day); a delivery row; keepsakes at the thresholds; the
-- host's while-away line (INLINED — send_system_announcement() is admin-gated
-- and would raise → silent rollback for a normal user). The guestbook was
-- retired 2026-09-12 (20260913020000 dropped the table), so the while-away
-- line IS the host's trace. The wish rerolls last and never to the find just
-- received.
CREATE OR REPLACE FUNCTION public.fulfil_pig_wish(p_host uuid, p_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._satchel_tuning();
	tickles int := GREATEST(0, COALESCE((t->>'tickles')::int, 3));
	hours numeric := COALESCE((t->>'wish_reroll_hours')::numeric, 48);
	thresholds jsonb := COALESCE(t->'keepsake_thresholds', '[10,50,100]'::jsonb);
	w public.pig_wishes%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	giver_name text;
	find_name text;
	delivered int;
	th int;
	new_keepsake int := NULL;
	giver_count int;
	host_count int;
	v_now timestamptz := now();
	next_wish public.pig_wishes%ROWTYPE;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_host IS NULL OR p_host = uid THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host');
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_host) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'host_not_found');
	END IF;
	IF NOT public.are_friends(uid, p_host) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
	END IF;
	IF public.are_blocked(uid, p_host) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'blocked');
	END IF;

	SELECT * INTO item FROM public.satchel_items WHERE id = p_item_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_bag');
	END IF;

	w := public._ensure_wish(p_host);
	IF EXISTS (SELECT 1 FROM public.satchel_deliveries d
	           WHERE d.giver_id = uid AND d.host_id = p_host AND d.wish_no = w.wish_no) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_fulfilled', 'wish', public._wish_json(w));
	END IF;
	IF w.find_id <> item.find_id THEN
		-- The client bounces a wrong find before it ever calls; this is the
		-- honest answer for a stale bubble.
		RETURN jsonb_build_object('ok', false, 'reason', 'wrong_find', 'wish', public._wish_json(w));
	END IF;

	-- The transfer: out of the bag, onto the shelf.
	DELETE FROM public.satchel_items WHERE id = item.id;
	INSERT INTO public.pig_shelf (user_id, find_id, count, updated_at)
	VALUES (p_host, item.find_id, 1, v_now)
	ON CONFLICT (user_id, find_id) DO UPDATE
		SET count = public.pig_shelf.count + 1, updated_at = v_now;

	INSERT INTO public.satchel_deliveries (giver_id, host_id, wish_no, find_id)
	VALUES (uid, p_host, w.wish_no, item.find_id);

	-- Both pigs tickled, flat. The count and the snouts a tickle pays, never
	-- the spendable bank (apply_tickles is the 20260812010000 rule).
	IF tickles > 0 THEN
		host_count := public.apply_tickles(p_host, tickles);
		giver_count := public.apply_tickles(uid, tickles);
	ELSE
		SELECT tickles_earned INTO host_count FROM public.profiles WHERE id = p_host;
		SELECT tickles_earned INTO giver_count FROM public.profiles WHERE id = uid;
	END IF;
	PERFORM public.apply_happiness(uid, 1.0);
	PERFORM public.apply_happiness(p_host, 0.25);
	PERFORM public.shift_alignment(uid, 1);
	PERFORM public._credit_visit_streak(uid, p_host, v_now);

	-- The keepsake: the first threshold this delivery crosses.
	SELECT COUNT(*)::int INTO delivered FROM public.satchel_deliveries WHERE giver_id = uid;
	FOR th IN SELECT (value)::int FROM jsonb_array_elements(thresholds) LOOP
		IF delivered >= th THEN
			INSERT INTO public.satchel_keepsakes (user_id, threshold)
			VALUES (uid, th) ON CONFLICT DO NOTHING;
			IF FOUND AND new_keepsake IS NULL THEN new_keepsake := th; END IF;
		END IF;
	END LOOP;

	-- The host's while-away line. Names the HOST's gain first; the giver is
	-- never "earning".
	SELECT username INTO giver_name FROM public.profiles WHERE id = uid;
	SELECT name INTO find_name FROM public.satchel_finds WHERE id = item.find_id;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'satchel_delivery', 'Your pig got a wish!',
		COALESCE(giver_name, 'A friend') || ' brought your pig the ' || find_name || ' it was hoping for.',
		jsonb_build_object('find_id', item.find_id, 'giver_id', uid)
	);

	-- The wish moves on — never to the thing just received.
	UPDATE public.pig_wishes SET
		find_id = public._satchel_roll_find(item.find_id),
		wish_no = w.wish_no + 1,
		rolled_at = v_now,
		expires_at = v_now + (hours * interval '1 hour'),
		owner_rerolled = false
	WHERE user_id = p_host
	RETURNING * INTO next_wish;

	RETURN jsonb_build_object(
		'ok', true,
		'find_id', item.find_id,
		'tickles', tickles,
		'giver_tickled', giver_count,
		'host_tickled', host_count,
		'deliveries', delivered,
		'keepsake', new_keepsake,
		'next_wish', public._wish_json(next_wish),
		'bag_count', (SELECT COUNT(*)::int FROM public.satchel_items WHERE user_id = uid)
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.fulfil_pig_wish(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfil_pig_wish(uuid, bigint) TO authenticated;

-- The Board's Contend slice: delivery counts for a list of profiles, as
-- {id: count}. Public numbers (a count, never a payout); anyone signed in may
-- read them, the way tickles_earned is read off profiles.
CREATE OR REPLACE FUNCTION public.satchel_deliveries_for(p_targets uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object(
		'ok', true,
		'counts', COALESCE((
			SELECT jsonb_object_agg(d.giver_id::text, d.n)
			FROM (
				SELECT giver_id, COUNT(*)::int AS n
				FROM public.satchel_deliveries
				WHERE giver_id = ANY(COALESCE(p_targets, ARRAY[]::uuid[]))
				GROUP BY giver_id
			) d), '{}'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public.satchel_deliveries_for(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.satchel_deliveries_for(uuid[]) TO authenticated;

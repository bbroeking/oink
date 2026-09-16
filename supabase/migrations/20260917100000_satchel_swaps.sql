-- Finds swap in the barn — the shelf folds into the bag.
-- Spec: docs/design/2026-09-16-satchel-audit-and-barn-trading-plan.md Part 2
-- (wire contract §12, pinned 2026-09-16). Extends 20260915010000_satchel.sql.
--
-- The charter line is unchanged: finds are GIVEN, NEVER SOLD. A swap moves two
-- rows 1:1 between two bags and mints nothing; the only tickles it pays are the
-- flat 3 a hand-off already paid, now capped per pair and per pig per day. No
-- currency, no price, no market. What changes is that the find a host receives
-- lands in a BAG (tossable, giveable on, counted toward the catalog) instead of
-- on a dead-end shelf, and that the visitor may take one of up to three finds
-- the host's bag can spare — chosen by the server, never browsed.
--
-- What / why, section by section:
--   1. Tuning — merge (never clobber) `options`,
--      `paid_swaps_per_pair_per_day`, `paid_swaps_per_pig_per_day` into the
--      app_settings row, and carry them into _satchel_tuning()'s fallback.
--   2. satchel_items gains provenance: `source` (dig | swap | gift |
--      migrated_shelf) and `from_user_id`, so an audit can follow any find.
--   3. satchel_swaps — the ledger that replaces satchel_deliveries. A gift is a
--      swap with took_find_id NULL. `nonce` is the client's idempotency key: a
--      replayed nonce returns the ORIGINAL receipt, never a second hand-off.
--   4. Data moves: every delivery becomes a swap (took NULL, tickles 3); every
--      pig_shelf row becomes bag rows (source 'migrated_shelf', up to cap,
--      overflow dropped — prod 2026-09-16 holds one shelf row, nothing is
--      lost); pig_shelf is dropped; satchel_deliveries is dropped and
--      recreated as a VIEW so build 190 keeps reading.
--   5. Audit fixes that ride along:
--        F1 — the "later visit" rule becomes a server gate: one swap per
--             (giver, host) per UTC day → `already_today`.
--        F3 — _satchel_roll_find is re-declared VOLATILE (it calls random()).
--        F4 — tickle_breakdown, carried from the LATEST def
--             (20260803010000_rewarded_ads_reporting.sql), gains a `swaps`
--             lane so hand-off tickles stop hiding in the home_taps residual.
--        F6 — _ensure_wish is split: _peek_wish reads without a lock and only
--             calls the writing path when the row is missing or expired, so
--             the Friends read stops locking (and rerolling) every friend.
--        F9 — the harness finally runs not_friends / blocked / the 48h
--             timeout (scripts/db-harness/95_satchel_swaps_smoke.sql).
--   6. RPCs: swap_with_host (the trade) · my_satchel · friend_wishes ·
--      satchel_swaps_for · my_satchel_swaps, plus one-build compat aliases
--      (fulfil_pig_wish, satchel_deliveries_for, the satchel_deliveries view)
--      so the binary in the wild keeps working. Every one is fail-closed and
--      answers {ok:false, reason} rather than raising: a raise inside a
--      SECURITY DEFINER RPC is a silent rollback to the client.
--
-- send_system_announcement() is admin-gated and raises admin_only for a normal
-- user, so the host's while-away line is an INLINED INSERT, as in the shipped
-- Satchel.
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
-- Merge, never clobber: the row already carries cap / odds / rarity / hours /
-- tickles / thresholds and a live prod row may have been retuned by hand.
UPDATE public.app_settings
SET value = value || '{"options": 3,
                       "paid_swaps_per_pair_per_day": 3,
                       "paid_swaps_per_pig_per_day": 10}'::jsonb,
    description = 'The Satchel (docs/satchel-spec.md + the 2026-09-16 swap plan): bag cap, finds-per-dig odds, wish rarity weights, wish timer, tickles per hand-off (flat — rarity never pays), keepsake thresholds, swap options per wish, paid-swap caps per pair and per pig per UTC day.'
WHERE key = 'satchel_tuning';

INSERT INTO public.app_settings (key, value, description)
SELECT 'satchel_tuning',
	'{"cap": 6,
	  "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
	  "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
	  "wish_reroll_hours": 48,
	  "tickles": 3,
	  "keepsake_thresholds": [10, 50, 100],
	  "options": 3,
	  "paid_swaps_per_pair_per_day": 3,
	  "paid_swaps_per_pig_per_day": 10}'::jsonb,
	'The Satchel (docs/satchel-spec.md + the 2026-09-16 swap plan): bag cap, finds-per-dig odds, wish rarity weights, wish timer, tickles per hand-off (flat — rarity never pays), keepsake thresholds, swap options per wish, paid-swap caps per pair and per pig per UTC day.'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'satchel_tuning');

CREATE OR REPLACE FUNCTION public._satchel_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT value FROM public.app_settings WHERE key = 'satchel_tuning'),
		'{"cap": 6, "find_odds": {"none": 0.30, "one": 0.50, "two": 0.20},
		  "rarity_weights": {"common": 70, "uncommon": 25, "rare": 5},
		  "wish_reroll_hours": 48, "tickles": 3,
		  "keepsake_thresholds": [10, 50, 100],
		  "options": 3, "paid_swaps_per_pair_per_day": 3,
		  "paid_swaps_per_pig_per_day": 10}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._satchel_tuning() FROM PUBLIC, anon, authenticated;

-- ── 2. Provenance on the bag row ─────────────────────────────────────────────
-- Rows MOVE between bags (UPDATE user_id), never delete-and-reinsert, so a
-- find keeps its id and its history for the life of the account.
ALTER TABLE public.satchel_items
	ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'dig',
	ADD COLUMN IF NOT EXISTS from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.satchel_items
	DROP CONSTRAINT IF EXISTS satchel_items_source_check;
ALTER TABLE public.satchel_items
	ADD CONSTRAINT satchel_items_source_check
	CHECK (source IN ('dig', 'swap', 'gift', 'migrated_shelf'));

-- ── 3. The ledger ────────────────────────────────────────────────────────────
-- One row per hand-off, from the GIVER's point of view: gave_find_id always,
-- took_find_id NULL when it was a gift. `tickles` records what was actually
-- paid (0 once a daily paid cap is spent) so tickle_breakdown can attribute it.
CREATE TABLE public.satchel_swaps (
	id            bigserial PRIMARY KEY,
	nonce         uuid NOT NULL UNIQUE,
	giver_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	host_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	wish_no       bigint NOT NULL,
	gave_find_id  text NOT NULL REFERENCES public.satchel_finds(id),
	took_find_id  text REFERENCES public.satchel_finds(id),
	tickles       int NOT NULL DEFAULT 0,
	created_at    timestamptz NOT NULL DEFAULT now(),
	CONSTRAINT satchel_swaps_not_self CHECK (giver_id <> host_id),
	CONSTRAINT satchel_swaps_one_per_wish UNIQUE (giver_id, host_id, wish_no)
);
CREATE INDEX satchel_swaps_giver_day ON public.satchel_swaps (giver_id, created_at DESC);
CREATE INDEX satchel_swaps_host_day  ON public.satchel_swaps (host_id, created_at DESC);
-- The F1 gate: one swap per (giver, host) per UTC day. `created_at::date` is
-- STABLE (it reads TimeZone), so the indexable expression spells UTC out.
CREATE INDEX satchel_swaps_pair_day
	ON public.satchel_swaps (giver_id, host_id, ((created_at AT TIME ZONE 'UTC')::date));
-- The per-pig paid cap only ever counts paid rows.
CREATE INDEX satchel_swaps_giver_paid_day
	ON public.satchel_swaps (giver_id, ((created_at AT TIME ZONE 'UTC')::date))
	WHERE tickles > 0;

ALTER TABLE public.satchel_swaps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.satchel_swaps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.satchel_swaps_id_seq FROM PUBLIC, anon, authenticated;

-- ── 4. Data moves ────────────────────────────────────────────────────────────
-- Every shipped delivery was a gift that paid the flat 3.
INSERT INTO public.satchel_swaps
	(nonce, giver_id, host_id, wish_no, gave_find_id, took_find_id, tickles, created_at)
SELECT gen_random_uuid(), d.giver_id, d.host_id, d.wish_no, d.find_id, NULL, 3, d.created_at
FROM public.satchel_deliveries d;

-- The shelf folds into the bag: each (user, find, count) becomes `count` rows,
-- up to the cap; overflow is dropped, the way an over-cap dig's finds are.
DO $migrate_shelf$
DECLARE
	cap int := GREATEST(0, COALESCE((public._satchel_tuning()->>'cap')::int, 6));
	r record;
	have int;
	i int;
BEGIN
	FOR r IN
		SELECT user_id, find_id, count, updated_at
		FROM public.pig_shelf WHERE count > 0
		ORDER BY user_id, updated_at, find_id
	LOOP
		SELECT COUNT(*)::int INTO have FROM public.satchel_items WHERE user_id = r.user_id;
		FOR i IN 1..r.count LOOP
			EXIT WHEN have >= cap;
			INSERT INTO public.satchel_items (user_id, find_id, source, created_at)
			VALUES (r.user_id, r.find_id, 'migrated_shelf', r.updated_at);
			have := have + 1;
		END LOOP;
		-- A find on the shelf is a find this pig has met.
		INSERT INTO public.satchel_met (user_id, find_id, first_found_at)
		VALUES (r.user_id, r.find_id, r.updated_at) ON CONFLICT DO NOTHING;
	END LOOP;
END
$migrate_shelf$;

DROP TABLE public.pig_shelf;
DROP TABLE public.satchel_deliveries;

-- One-build alias so build 190's reads keep answering. RPC-only, like the
-- tables it stands in for; dropped in the follow-up migration (plan §7 T7).
CREATE VIEW public.satchel_deliveries AS
	SELECT id, giver_id, host_id, wish_no, gave_find_id AS find_id, created_at
	FROM public.satchel_swaps;
REVOKE ALL ON public.satchel_deliveries FROM PUBLIC, anon, authenticated;

-- ── 5. Helpers ───────────────────────────────────────────────────────────────

-- F3: same body as 20260915010000, re-declared VOLATILE. It calls random();
-- STABLE would let a future single-statement caller (INSERT … SELECT across
-- rows) evaluate it once and hand every row the same find.
CREATE OR REPLACE FUNCTION public._satchel_roll_find(p_not text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
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

-- F6: the read path. No FOR UPDATE, no write, unless the row is missing or has
-- timed out — only then does it fall through to the writer. friend_wishes (N
-- friends per Friends-screen refresh) and my_satchel use this; reroll_my_wish
-- and swap_with_host keep the locking path, because they are about to write.
CREATE OR REPLACE FUNCTION public._peek_wish(p_user uuid)
RETURNS public.pig_wishes LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	w public.pig_wishes%ROWTYPE;
BEGIN
	SELECT * INTO w FROM public.pig_wishes WHERE user_id = p_user;
	IF FOUND AND w.expires_at > now() THEN
		RETURN w;
	END IF;
	RETURN public._ensure_wish(p_user);
END;
$function$;
REVOKE ALL ON FUNCTION public._peek_wish(uuid) FROM PUBLIC, anon, authenticated;

-- The offer tray's contents, and the ONLY definition of them: the host's bag
-- grouped by find, the wished find excluded, biggest stacks first (duplicates
-- are what an owner values least), ties broken deterministically by the wish
-- number so two reads of one wish return the same three. The client renders
-- what friend_wishes hands it and never recomputes this.
CREATE OR REPLACE FUNCTION public._wish_options(p_host uuid, p_wish_no bigint)
RETURNS text[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		array_agg(x.find_id ORDER BY x.n DESC, abs(hashtext(p_wish_no::text || x.find_id)::bigint) ASC),
		ARRAY[]::text[])
	FROM (
		SELECT s.find_id, COUNT(*)::int AS n
		FROM public.satchel_items s
		WHERE s.user_id = p_host
		  AND s.find_id IS DISTINCT FROM (
			SELECT w.find_id FROM public.pig_wishes w WHERE w.user_id = p_host)
		GROUP BY s.find_id
		ORDER BY COUNT(*) DESC, abs(hashtext(p_wish_no::text || s.find_id)::bigint) ASC
		LIMIT GREATEST(0, COALESCE((public._satchel_tuning()->>'options')::int, 3))
	) x;
$function$;
REVOKE ALL ON FUNCTION public._wish_options(uuid, bigint) FROM PUBLIC, anon, authenticated;

-- The caller's live bag, in the shape the client parses. Returned whole by
-- swap_with_host so the client never trims by count (F2).
CREATE OR REPLACE FUNCTION public._satchel_bag_json(p_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((
		SELECT jsonb_agg(jsonb_build_object('id', s.id, 'find_id', s.find_id, 'source', s.source)
		                 ORDER BY s.created_at, s.id)
		FROM public.satchel_items s WHERE s.user_id = p_user), '[]'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._satchel_bag_json(uuid) FROM PUBLIC, anon, authenticated;

-- ── 6. RPCs ──────────────────────────────────────────────────────────────────

-- The bag, the silhouettes, my pig's wish, the swap counts, the keepsakes.
-- `shelf` and `deliveries` are kept for exactly one build: the binary in the
-- wild (190) parses them. `shelf` is always empty now — the shelf folded in.
CREATE OR REPLACE FUNCTION public.my_satchel()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._satchel_tuning();
	per_pig int := GREATEST(0, COALESCE((t->>'paid_swaps_per_pig_per_day')::int, 10));
	w public.pig_wishes%ROWTYPE;
	given int;
	paid_today int;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	w := public._peek_wish(uid);
	SELECT COUNT(*)::int INTO given FROM public.satchel_swaps s WHERE s.giver_id = uid;
	SELECT COUNT(*)::int INTO paid_today FROM public.satchel_swaps s
		WHERE s.giver_id = uid AND s.tickles > 0
		  AND (s.created_at AT TIME ZONE 'UTC')::date = (now() AT TIME ZONE 'UTC')::date;
	RETURN jsonb_build_object(
		'ok', true,
		'cap', COALESCE((t->>'cap')::int, 6),
		'items', public._satchel_bag_json(uid),
		'met', COALESCE((SELECT jsonb_agg(m.find_id ORDER BY m.first_found_at) FROM public.satchel_met m WHERE m.user_id = uid), '[]'::jsonb),
		'wish', public._wish_json(w),
		'shelf', '[]'::jsonb,
		'deliveries', given,
		'swaps_given', given,
		'swaps_received', (SELECT COUNT(*)::int FROM public.satchel_swaps s WHERE s.host_id = uid),
		'paid_left_today', GREATEST(0, per_pig - paid_today),
		'keepsakes', COALESCE((SELECT jsonb_agg(k.threshold ORDER BY k.threshold) FROM public.satchel_keepsakes k WHERE k.user_id = uid), '[]'::jsonb)
	);
END;
$function$;
REVOKE ALL ON FUNCTION public.my_satchel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_satchel() TO authenticated;

-- The wishes of friends, with the tray's contents and the day's gate, so the
-- row mark and the bubble can both stay honest without a second round trip.
CREATE OR REPLACE FUNCTION public.friend_wishes(p_targets uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	tid uuid;
	w public.pig_wishes%ROWTYPE;
	acc jsonb := '[]'::jsonb;
	today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	FOREACH tid IN ARRAY COALESCE(p_targets, ARRAY[]::uuid[]) LOOP
		CONTINUE WHEN tid IS NULL OR tid = uid;
		CONTINUE WHEN NOT public.are_friends(uid, tid);
		CONTINUE WHEN public.are_blocked(uid, tid);
		w := public._peek_wish(tid);
		acc := acc || jsonb_build_object(
			'target_id', tid,
			'find_id', w.find_id,
			'wish_no', w.wish_no,
			'expires_at', w.expires_at,
			'fulfilled_by_me', EXISTS (
				SELECT 1 FROM public.satchel_swaps s
				WHERE s.giver_id = uid AND s.host_id = tid AND s.wish_no = w.wish_no),
			'options', to_jsonb(public._wish_options(tid, w.wish_no)),
			'swapped_today', EXISTS (
				SELECT 1 FROM public.satchel_swaps s
				WHERE s.giver_id = uid AND s.host_id = tid
				  AND (s.created_at AT TIME ZONE 'UTC')::date = today));
	END LOOP;
	RETURN jsonb_build_object('ok', true, 'wishes', acc);
END;
$function$;
REVOKE ALL ON FUNCTION public.friend_wishes(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.friend_wishes(uuid[]) TO authenticated;

-- The trade. Hand the host's pig the find it is hoping for and take one of the
-- finds its bag can spare — or take nothing and it is a gift.
--
-- Serialised per host by an advisory lock, so two visitors of one pig queue
-- instead of racing. Every refusal is {ok:false, reason} and changes NOTHING;
-- nothing raises, because a raise inside SECURITY DEFINER is a silent rollback
-- the client reads as success. Reason order is the wire contract's
-- (plan §12): not_authenticated · bad_nonce · invalid_host · host_not_found ·
-- not_friends · blocked · not_in_bag · wish_changed · already_today ·
-- wrong_find · not_offered · option_gone · host_bag_full.
--
-- Effects, in one transaction: both rows MOVE (UPDATE user_id — never
-- delete-and-reinsert, so provenance survives); satchel_met for both
-- receivers; flat tickles to both (apply_tickles: the count + the snouts,
-- never the spendable bank) while either daily paid cap has headroom, else 0
-- and the receipt says so; happiness 1.0 giver / 0.25 host; a generous
-- alignment tick on GIFTS ONLY; the pair's visit-streak credit; the keepsake
-- thresholds; the ledger row; the host's while-away line (INLINED —
-- send_system_announcement() is admin-gated and would raise); and the wish
-- rerolls, never to the find just received.
CREATE OR REPLACE FUNCTION public.swap_with_host(
	p_host uuid,
	p_item_id bigint,
	p_take_find text,
	p_wish_no bigint,
	p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._satchel_tuning();
	flat int := GREATEST(0, COALESCE((t->>'tickles')::int, 3));
	hours numeric := COALESCE((t->>'wish_reroll_hours')::numeric, 48);
	cap int := GREATEST(0, COALESCE((t->>'cap')::int, 6));
	per_pair int := GREATEST(0, COALESCE((t->>'paid_swaps_per_pair_per_day')::int, 3));
	per_pig int := GREATEST(0, COALESCE((t->>'paid_swaps_per_pig_per_day')::int, 10));
	thresholds jsonb := COALESCE(t->'keepsake_thresholds', '[10,50,100]'::jsonb);
	today date := (now() AT TIME ZONE 'UTC')::date;
	prior public.satchel_swaps%ROWTYPE;
	w public.pig_wishes%ROWTYPE;
	next_wish public.pig_wishes%ROWTYPE;
	item public.satchel_items%ROWTYPE;
	take_item public.satchel_items%ROWTYPE;
	opts text[];
	is_gift boolean := p_take_find IS NULL;
	host_bag int;
	paid boolean;
	pair_paid int;
	pig_paid int;
	tickles int;
	giver_count int;
	host_count int;
	given int;
	th int;
	new_keepsake int := NULL;
	giver_name text;
	gave_name text;
	took_name text;
	v_now timestamptz := now();
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay. The nonce is the client's idempotency key: a retry after a
	-- dropped connection must return the ORIGINAL receipt, never trade again.
	SELECT * INTO prior FROM public.satchel_swaps WHERE nonce = p_nonce;
	IF FOUND THEN
		IF prior.giver_id <> uid THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
		END IF;
		SELECT COUNT(*)::int INTO given FROM public.satchel_swaps s WHERE s.giver_id = uid;
		SELECT * INTO w FROM public.pig_wishes WHERE user_id = prior.host_id;
		SELECT tickles_earned INTO giver_count FROM public.profiles WHERE id = uid;
		SELECT tickles_earned INTO host_count FROM public.profiles WHERE id = prior.host_id;
		RETURN jsonb_build_object(
			'ok', true,
			'replay', true,
			'gave_find_id', prior.gave_find_id,
			'took_find_id', prior.took_find_id,
			'tickles', prior.tickles,
			'paid', prior.tickles > 0,
			'giver_tickled', COALESCE(giver_count, 0),
			'host_tickled', COALESCE(host_count, 0),
			'swaps_given', given,
			'keepsake', NULL,
			'next_wish', CASE WHEN w.user_id IS NULL THEN NULL ELSE public._wish_json(w) END,
			'bag', public._satchel_bag_json(uid));
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

	-- Two visitors of one pig serialise here; the whole trade runs inside it.
	PERFORM pg_advisory_xact_lock(hashtext('wish:' || p_host::text)::bigint);

	-- 3. The giver's find, locked.
	SELECT * INTO item FROM public.satchel_items
		WHERE id = p_item_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_in_bag');
	END IF;

	-- 4. The host's wish, locked, and it must be the one the tray was drawn from.
	w := public._ensure_wish(p_host);
	opts := public._wish_options(p_host, w.wish_no);
	IF p_wish_no IS NULL OR w.wish_no <> p_wish_no THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'wish_changed',
			'wish', public._wish_json(w), 'options', to_jsonb(opts));
	END IF;

	-- 5. F1: one swap per pair per UTC day. The spec's "later visit" rule,
	-- enforced by the server instead of by the client's memory.
	IF EXISTS (
		SELECT 1 FROM public.satchel_swaps s
		WHERE s.giver_id = uid AND s.host_id = p_host
		  AND (s.created_at AT TIME ZONE 'UTC')::date = today
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_today',
			'wish', public._wish_json(w));
	END IF;

	-- 6. The find must be the thing the pig is hoping for.
	IF w.find_id <> item.find_id THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'wrong_find',
			'wish', public._wish_json(w), 'options', to_jsonb(opts));
	END IF;

	IF NOT is_gift THEN
		-- 7. The take must be one the server offered. Two ways that can fail,
		-- and they are NOT the same story:
		--   · the host still holds the find but it was never among the
		--     three — the rule diverged between server and client.
		--     `not_offered`: a Sentry error, never a toast.
		--   · the host no longer holds it at all — the ordinary case, the
		--     owner tossed it between the tray being drawn and the tap.
		--     `option_gone` + fresh options; the tray redraws warmly.
		IF NOT (p_take_find = ANY(opts)) THEN
			IF EXISTS (SELECT 1 FROM public.satchel_items
			           WHERE user_id = p_host AND find_id = p_take_find) THEN
				RETURN jsonb_build_object('ok', false, 'reason', 'not_offered',
					'options', to_jsonb(opts));
			END IF;
			RETURN jsonb_build_object('ok', false, 'reason', 'option_gone',
				'options', to_jsonb(opts));
		END IF;
		-- 8. …and the host must still hold one. Oldest row, locked. (The one
		-- race the advisory lock cannot cover: the OWNER's own session tossing
		-- it between the two statements above.)
		SELECT * INTO take_item FROM public.satchel_items
			WHERE user_id = p_host AND find_id = p_take_find
			ORDER BY created_at, id LIMIT 1 FOR UPDATE;
		IF NOT FOUND THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'option_gone',
				'options', to_jsonb(public._wish_options(p_host, w.wish_no)));
		END IF;
	ELSE
		-- 9. A gift adds a find to the host's bag; a swap does not (one in,
		-- one out), so only a gift can be refused for a full bag.
		SELECT COUNT(*)::int INTO host_bag FROM public.satchel_items WHERE user_id = p_host;
		IF host_bag >= cap THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'host_bag_full',
				'wish', public._wish_json(w));
		END IF;
	END IF;

	-- 10. The move. Rows change hands; they are never destroyed and remade.
	UPDATE public.satchel_items SET
		user_id = p_host,
		source = CASE WHEN is_gift THEN 'gift' ELSE 'swap' END,
		from_user_id = uid,
		created_at = v_now
	WHERE id = item.id;
	INSERT INTO public.satchel_met (user_id, find_id)
		VALUES (p_host, item.find_id) ON CONFLICT DO NOTHING;

	IF NOT is_gift THEN
		UPDATE public.satchel_items SET
			user_id = uid,
			source = 'swap',
			from_user_id = p_host,
			created_at = v_now
		WHERE id = take_item.id;
		INSERT INTO public.satchel_met (user_id, find_id)
			VALUES (uid, take_item.find_id) ON CONFLICT DO NOTHING;
	END IF;

	-- 11. The pay. Flat, to both, while the day's paid caps have headroom.
	SELECT COUNT(*)::int INTO pair_paid FROM public.satchel_swaps s
		WHERE s.giver_id = uid AND s.host_id = p_host AND s.tickles > 0
		  AND (s.created_at AT TIME ZONE 'UTC')::date = today;
	SELECT COUNT(*)::int INTO pig_paid FROM public.satchel_swaps s
		WHERE s.giver_id = uid AND s.tickles > 0
		  AND (s.created_at AT TIME ZONE 'UTC')::date = today;
	paid := flat > 0 AND pair_paid < per_pair AND pig_paid < per_pig;
	tickles := CASE WHEN paid THEN flat ELSE 0 END;

	IF tickles > 0 THEN
		host_count := public.apply_tickles(p_host, tickles);
		giver_count := public.apply_tickles(uid, tickles);
	ELSE
		SELECT tickles_earned INTO host_count FROM public.profiles WHERE id = p_host;
		SELECT tickles_earned INTO giver_count FROM public.profiles WHERE id = uid;
	END IF;
	PERFORM public.apply_happiness(uid, 1.0);
	PERFORM public.apply_happiness(p_host, 0.25);
	-- Generous is for giving something away, not for trading.
	IF is_gift THEN
		PERFORM public.shift_alignment(uid, 1);
	END IF;
	PERFORM public._credit_visit_streak(uid, p_host, v_now);

	-- 12. The ledger, the keepsake, the host's trace, the next wish.
	INSERT INTO public.satchel_swaps
		(nonce, giver_id, host_id, wish_no, gave_find_id, took_find_id, tickles, created_at)
	VALUES (p_nonce, uid, p_host, w.wish_no, item.find_id, p_take_find, tickles, v_now);

	SELECT COUNT(*)::int INTO given FROM public.satchel_swaps s WHERE s.giver_id = uid;
	FOR th IN SELECT (value)::int FROM jsonb_array_elements(thresholds) LOOP
		IF given >= th THEN
			INSERT INTO public.satchel_keepsakes (user_id, threshold)
			VALUES (uid, th) ON CONFLICT DO NOTHING;
			IF FOUND AND new_keepsake IS NULL THEN new_keepsake := th; END IF;
		END IF;
	END LOOP;

	SELECT username INTO giver_name FROM public.profiles WHERE id = uid;
	SELECT name INTO gave_name FROM public.satchel_finds WHERE id = item.find_id;
	IF NOT is_gift THEN
		SELECT name INTO took_name FROM public.satchel_finds WHERE id = p_take_find;
	END IF;
	INSERT INTO public.system_announcements (user_id, kind, title, body, data)
	VALUES (
		p_host, 'satchel_swap', 'Your pig got a wish!',
		CASE WHEN is_gift
			THEN COALESCE(giver_name, 'A friend') || ' brought your pig the ' || gave_name || ' it was hoping for.'
			ELSE COALESCE(giver_name, 'A friend') || ' swapped your pig the ' || gave_name || ' it was hoping for and took the ' || took_name || '.'
		END,
		jsonb_build_object(
			'screen', 'barn',
			'find_id', item.find_id,
			'took_find_id', p_take_find,
			'giver_id', uid));

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
		'replay', false,
		'gave_find_id', item.find_id,
		'took_find_id', p_take_find,
		'tickles', tickles,
		'paid', paid,
		'giver_tickled', COALESCE(giver_count, 0),
		'host_tickled', COALESCE(host_count, 0),
		'swaps_given', given,
		'keepsake', new_keepsake,
		'next_wish', public._wish_json(next_wish),
		'bag', public._satchel_bag_json(uid));
END;
$function$;
REVOKE ALL ON FUNCTION public.swap_with_host(uuid, bigint, text, bigint, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.swap_with_host(uuid, bigint, text, bigint, uuid) TO authenticated;

-- One-build compat alias. Build 190 calls this and parses find_id /
-- deliveries / bag_count; it knows `already_fulfilled`, not `already_today`.
CREATE OR REPLACE FUNCTION public.fulfil_pig_wish(p_host uuid, p_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	w public.pig_wishes%ROWTYPE;
	res jsonb;
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

	w := public._ensure_wish(p_host);
	res := public.swap_with_host(p_host, p_item_id, NULL, w.wish_no, gen_random_uuid());

	IF (res->>'ok')::boolean THEN
		RETURN res || jsonb_build_object(
			'find_id', res->'gave_find_id',
			'deliveries', res->'swaps_given',
			'bag_count', COALESCE(jsonb_array_length(res->'bag'), 0));
	END IF;
	IF res->>'reason' = 'already_today' THEN
		RETURN jsonb_set(res, '{reason}', '"already_fulfilled"'::jsonb);
	END IF;
	RETURN res;
END;
$function$;
REVOKE ALL ON FUNCTION public.fulfil_pig_wish(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fulfil_pig_wish(uuid, bigint) TO authenticated;

-- The Board's Contend slice: gifts + swaps GIVEN, as {id: count}. Public
-- numbers (a count, never a payout).
CREATE OR REPLACE FUNCTION public.satchel_swaps_for(p_targets uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object(
		'ok', true,
		'counts', COALESCE((
			SELECT jsonb_object_agg(d.giver_id::text, d.n)
			FROM (
				SELECT giver_id, COUNT(*)::int AS n
				FROM public.satchel_swaps
				WHERE giver_id = ANY(COALESCE(p_targets, ARRAY[]::uuid[]))
				GROUP BY giver_id
			) d), '{}'::jsonb));
$function$;
REVOKE ALL ON FUNCTION public.satchel_swaps_for(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.satchel_swaps_for(uuid[]) TO authenticated;

-- One-build alias for build 190's Board read.
CREATE OR REPLACE FUNCTION public.satchel_deliveries_for(p_targets uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.satchel_swaps_for(p_targets);
$function$;
REVOKE ALL ON FUNCTION public.satchel_deliveries_for(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.satchel_deliveries_for(uuid[]) TO authenticated;

-- The caller's swap history, both directions, newest first. `gave` and `took`
-- are always read from the GIVER's side, whichever side the caller is on.
CREATE OR REPLACE FUNCTION public.my_satchel_swaps(p_limit int DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	lim int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 100);
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	RETURN jsonb_build_object('ok', true, 'swaps', COALESCE((
		SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.created_at DESC, x.id DESC)
		FROM (
			SELECT s.id,
				CASE WHEN s.giver_id = uid THEN 'given' ELSE 'received' END AS direction,
				CASE WHEN s.giver_id = uid THEN s.host_id ELSE s.giver_id END AS partner_id,
				p.username AS partner_username,
				p.discriminator AS partner_discriminator,
				s.gave_find_id,
				s.took_find_id,
				s.tickles,
				s.created_at
			FROM public.satchel_swaps s
			LEFT JOIN public.profiles p
				ON p.id = CASE WHEN s.giver_id = uid THEN s.host_id ELSE s.giver_id END
			WHERE s.giver_id = uid OR s.host_id = uid
			ORDER BY s.created_at DESC, s.id DESC
			LIMIT lim
		) x), '[]'::jsonb));
END;
$function$;
REVOKE ALL ON FUNCTION public.my_satchel_swaps(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_satchel_swaps(int) TO authenticated;

-- ── 7. F4: the glass box gets its swaps lane ─────────────────────────────────
-- Carried VERBATIM from the LATEST definition,
-- 20260803010000_rewarded_ads_reporting.sql (the carry-latest-def footgun:
-- rebuilding from 20260753000000 would silently delete the `ads` lane). The
-- ONLY change is the `swaps` lane and its place in the residual.
CREATE OR REPLACE FUNCTION public.tickle_breakdown(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	v_boundary timestamptz;
	v_total bigint;
	v_ads bigint;
	v_visit bigint;
	v_dig bigint;
	v_pass bigint;
	v_trades bigint;
	v_lucky bigint;
	v_swaps bigint;
	v_home bigint;
BEGIN
	SELECT starts_at INTO v_boundary FROM public.active_season();
	SELECT COALESCE(tickles_earned, 0) INTO v_total
		FROM public.profiles WHERE id = p_user;
	v_total := COALESCE(v_total, 0);

	IF v_boundary IS NULL THEN
		RETURN jsonb_build_object(
			'total', v_total, 'boundary', NULL,
			'home_taps', v_total, 'ads', 0, 'visit_taps', 0, 'dig_finds', 0,
			'pass_tiers', 0, 'trades', 0, 'lucky', 0, 'swaps', 0);
	END IF;

	SELECT count(*) INTO v_ads FROM public.rewarded_ad_consumptions
		WHERE user_id = p_user AND consumed_at > v_boundary;
	SELECT count(*) INTO v_visit FROM public.barn_visits
		WHERE visitor_id = p_user AND created_at > v_boundary;
	SELECT count(*) * 5 INTO v_dig FROM public.truffle_digs
		WHERE digger_id = p_user AND dug_at > v_boundary;
	SELECT COALESCE(SUM(COALESCE(
			(st.reward_value->>'amount')::int,
			(st.reward_value->>'tickles')::int, 0)), 0)
		INTO v_pass
		FROM public.user_tier_claims utc
		JOIN public.season_tiers st
			ON st.season_id = utc.season_id
			AND st.tier = utc.tier
			AND st.track = utc.track
		WHERE utc.user_id = p_user
			AND utc.claimed_at > v_boundary
			AND st.reward_type IN ('tickles', 'tickle');
	SELECT COALESCE(SUM(amount * 2), 0) INTO v_trades
		FROM public.tickle_trades
		WHERE requester_id = p_user AND fulfilled_at > v_boundary;
	SELECT count(*) * 5 INTO v_lucky FROM public.daily_lucky_claims
		WHERE user_id = p_user AND claimed_at > v_boundary;
	-- The Satchel's hand-offs pay both sides the same flat amount; the row
	-- records what was actually paid (0 once a daily cap is spent).
	SELECT COALESCE(SUM(tickles), 0) INTO v_swaps
		FROM public.satchel_swaps
		WHERE (giver_id = p_user OR host_id = p_user) AND created_at > v_boundary;

	v_home := GREATEST(
		0,
		v_total - (v_ads + v_visit + v_dig + v_pass + v_trades + v_lucky + v_swaps)
	);
	RETURN jsonb_build_object(
		'total', v_total,
		'boundary', v_boundary,
		'home_taps', v_home,
		'ads', v_ads,
		'visit_taps', v_visit,
		'dig_finds', v_dig,
		'pass_tiers', v_pass,
		'trades', v_trades,
		'lucky', v_lucky,
		'swaps', v_swaps);
END;
$function$;
REVOKE ALL ON FUNCTION public.tickle_breakdown(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tickle_breakdown(uuid) TO authenticated;

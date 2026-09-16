-- ════════════════════════════════════════════════════════════════════════════
-- T5 — the two-account swap check, on PROD, AFTER the push.
--
--   npx supabase db query --linked -f scripts/swaps/prod-two-account-check.sql
--
-- Runbook + when to run it: scripts/swaps/prod-two-account-check.md.
-- DO NOT RUN THIS BEFORE `20260917100000_satchel_swaps.sql` HAS BEEN PUSHED on
-- the founder's explicit "go". It calls swap_with_host / friend_wishes /
-- my_satchel_swaps / satchel_swaps_for, none of which exist before it.
--
-- Actors: demohelper1@ticklethepig.com is the HOST (its pig does the wishing);
-- demo@ticklethepig.com (DemoPig, the reviewer account the simulator signs in
-- as) is the GIVER. The two are already friends on prod. The simulator's own
-- parallel pass must use a DIFFERENT helper (demohelper2) — one swap per pair
-- per UTC day is the whole point of step E, so two runs against helper1 on one
-- day would collide.
--
-- How it reads: `supabase db query` returns only the LAST result set and runs
-- the file as ONE implicit transaction, so every step writes one PASS/FAIL row
-- into a temp table and the file ends with a single SELECT of the log. A FAIL
-- is a row, not an error — the run continues so you see every line.
--
-- What it leaves behind (deliberately): two ledger rows, one announcement, two
-- moved find rows, +3 tickles on each test profile, a pair visit-streak credit
-- and possibly a `met` row. Section G cleans up the first three; read its
-- header before running it.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE ttp_check (n int, step text, verdict text, detail text);
CREATE TEMP TABLE ttp_res (k text PRIMARY KEY, v jsonb);

-- The two nonces this runbook owns — the client would generate these; here they
-- are fixed so step D can replay one and section G can clean up by them. They
-- must parse as uuids. Swap in fresh ones (`uuidgen | tr 'A-F' 'a-f'`) if a
-- previous run's rows are still on prod and you want a clean pair.
SELECT set_config('ttp.nonce1', '00000000-0000-4000-8000-0000000c1ea1', false),
       set_config('ttp.nonce2', '00000000-0000-4000-8000-0000000c1ea2', false);

-- ── 0. Who ──────────────────────────────────────────────────────────────────
-- Placeholders for the two uuids. The lookup fills them from the test emails;
-- if your shell has them already, hard-code them here instead:
--   set_config('ttp.host', '<DEMOHELPER1_UUID>', false)
--   set_config('ttp.giver','<DEMO_UUID>', false)
SELECT set_config('ttp.host',  (SELECT id::text FROM auth.users WHERE email = 'demohelper1@ticklethepig.com'), false),
       set_config('ttp.giver', (SELECT id::text FROM auth.users WHERE email = 'demo@ticklethepig.com'), false),
       set_config('ttp.t0', now()::text, false);

-- Stop here, before anything is written, if either account is missing.
DO $who$
BEGIN
	IF COALESCE(current_setting('ttp.host', true), '') = ''
	   OR COALESCE(current_setting('ttp.giver', true), '') = '' THEN
		RAISE EXCEPTION 'demo@ticklethepig.com or demohelper1@ticklethepig.com not found on this database — fill the two uuids in by hand at section 0';
	END IF;
END
$who$;

INSERT INTO ttp_check
SELECT 0, 'accounts resolved + friends',
	CASE WHEN current_setting('ttp.host', true) IS NOT NULL
	      AND current_setting('ttp.giver', true) IS NOT NULL
	      AND public.are_friends(current_setting('ttp.giver')::uuid, current_setting('ttp.host')::uuid)
	     THEN 'PASS' ELSE 'FAIL' END,
	'host=' || COALESCE(current_setting('ttp.host', true), 'NULL')
	  || ' giver=' || COALESCE(current_setting('ttp.giver', true), 'NULL');

-- ── A. As demohelper1: read the bag, then rig the wish and the options ──────
-- The read first, as the host would see it. `my_satchel()` is SECURITY DEFINER
-- on auth.uid(), so we become the helper for one statement.
SELECT set_config('request.jwt.claim.sub', current_setting('ttp.host'), false),
       set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('ttp.host'), 'role', 'authenticated')::text, false);

INSERT INTO ttp_res VALUES ('host_satchel_before', public.my_satchel());

INSERT INTO ttp_check
SELECT 1, 'A · host my_satchel() reads',
	CASE WHEN (v->>'ok')::boolean THEN 'PASS' ELSE 'FAIL' END,
	'bag=' || COALESCE(jsonb_array_length(v->'items'), 0)
	  || ' wish=' || COALESCE(v->'wish'->>'find_id', '-')
	  || ' wish_no=' || COALESCE(v->'wish'->>'wish_no', '-')
	  || ' | BASELINE WISH, copy into section G if you want it restored: '
	  || COALESCE(v->'wish'->>'find_id', '-') || ' / ' || COALESCE(v->'wish'->>'wish_no', '-')
FROM ttp_res WHERE k = 'host_satchel_before';

-- The rig. Direct table writes, as the DB owner — no RPC does this, by design.
-- Every row this runbook inserts is tagged `found_window_index = -991`, which
-- is the handle section G deletes by (the tag travels with the row when the
-- swap moves it, so cleanup works whichever bag it ends in).
DO $rig$
DECLARE
	v_host  uuid := current_setting('ttp.host')::uuid;
	v_giver uuid := current_setting('ttp.giver')::uuid;
	v_cap   int  := GREATEST(1, COALESCE((public._satchel_tuning()->>'cap')::int, 6));
	v_gave  text;
	v_room  int;
	v_spare int;
BEGIN
	-- 1. What the giver will hand over: prefer a find the demo account already
	--    holds (no write, no cap pressure); otherwise plant one.
	SELECT find_id INTO v_gave FROM public.satchel_items
		WHERE user_id = v_giver ORDER BY find_id LIMIT 1;
	IF v_gave IS NULL THEN
		v_gave := 'river_pebble';
		INSERT INTO public.satchel_items (user_id, find_id, found_window_index)
		VALUES (v_giver, v_gave, -991);
	END IF;
	PERFORM set_config('ttp.gave', v_gave, false);

	-- 2. The host's pig wishes for exactly that. wish_no advances so any tray a
	--    client already drew is stale, which is the honest starting state.
	INSERT INTO public.pig_wishes (user_id, find_id, wish_no, rolled_at, expires_at, owner_rerolled)
	VALUES (v_host, v_gave, 1, now(), now() + interval '48 hours', false)
	ON CONFLICT (user_id) DO UPDATE SET
		find_id = EXCLUDED.find_id,
		wish_no = public.pig_wishes.wish_no + 1,
		rolled_at = now(),
		expires_at = now() + interval '48 hours',
		owner_rerolled = false;

	-- 3. The host must hold something OTHER than the wished find, or the tray
	--    is gift-only and there is nothing to take. Two copies of one find make
	--    it the biggest stack, so _wish_options puts it first, deterministically.
	SELECT COUNT(*)::int INTO v_spare FROM public.satchel_items
		WHERE user_id = v_host AND find_id <> v_gave;
	IF v_spare = 0 THEN
		SELECT GREATEST(0, v_cap - COUNT(*)::int) INTO v_room
			FROM public.satchel_items WHERE user_id = v_host;
		IF v_room >= 1 THEN
			INSERT INTO public.satchel_items (user_id, find_id, found_window_index)
			SELECT v_host, CASE WHEN v_gave = 'old_key' THEN 'marble' ELSE 'old_key' END, -991
			FROM generate_series(1, LEAST(2, v_room));
		END IF;
	END IF;
END
$rig$;

INSERT INTO ttp_check
SELECT 2, 'A · rigged: host wishes for what the demo bag holds',
	CASE WHEN EXISTS (SELECT 1 FROM public.pig_wishes w
	                  WHERE w.user_id = current_setting('ttp.host')::uuid
	                    AND w.find_id = current_setting('ttp.gave'))
	      AND EXISTS (SELECT 1 FROM public.satchel_items s
	                  WHERE s.user_id = current_setting('ttp.giver')::uuid
	                    AND s.find_id = current_setting('ttp.gave'))
	      AND EXISTS (SELECT 1 FROM public.satchel_items s
	                  WHERE s.user_id = current_setting('ttp.host')::uuid
	                    AND s.find_id <> current_setting('ttp.gave'))
	     THEN 'PASS' ELSE 'FAIL' END,
	'gave=' || current_setting('ttp.gave')
	  || ' host_spare=' || (SELECT COUNT(*) FROM public.satchel_items
	                        WHERE user_id = current_setting('ttp.host')::uuid
	                          AND find_id <> current_setting('ttp.gave'));

-- ── B. As the demo account: the tray the client will draw ───────────────────
SELECT set_config('request.jwt.claim.sub', current_setting('ttp.giver'), false),
       set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('ttp.giver'), 'role', 'authenticated')::text, false);

INSERT INTO ttp_res VALUES ('friend_wishes',
	public.friend_wishes(ARRAY[current_setting('ttp.host')::uuid]));

-- Freeze what the client would send: the wish_no it drew the tray from, and
-- the first option in the tray (the tile a finger lands on).
SELECT set_config('ttp.wish_no', COALESCE(v->'wishes'->0->>'wish_no', '0'), false),
       set_config('ttp.take',     COALESCE(v->'wishes'->0->'options'->>0, ''), false)
FROM ttp_res WHERE k = 'friend_wishes';

INSERT INTO ttp_check
SELECT 3, 'B · friend_wishes: options offered, not swapped today',
	CASE WHEN (v->>'ok')::boolean
	      AND jsonb_array_length(v->'wishes') = 1
	      AND v->'wishes'->0->>'find_id' = current_setting('ttp.gave')
	      AND jsonb_array_length(v->'wishes'->0->'options') >= 1
	      AND (v->'wishes'->0->>'swapped_today')::boolean IS FALSE
	      AND (v->'wishes'->0->>'fulfilled_by_me')::boolean IS FALSE
	     THEN 'PASS' ELSE 'FAIL' END,
	'wish=' || COALESCE(v->'wishes'->0->>'find_id', '-')
	  || ' wish_no=' || COALESCE(v->'wishes'->0->>'wish_no', '-')
	  || ' options=' || COALESCE((v->'wishes'->0->'options')::text, '-')
	  || ' swapped_today=' || COALESCE(v->'wishes'->0->>'swapped_today', '-')
FROM ttp_res WHERE k = 'friend_wishes';

-- ── C. The swap ─────────────────────────────────────────────────────────────
INSERT INTO ttp_res VALUES ('swap1', public.swap_with_host(
	current_setting('ttp.host')::uuid,
	(SELECT id FROM public.satchel_items
	  WHERE user_id = current_setting('ttp.giver')::uuid
	    AND find_id = current_setting('ttp.gave')
	  ORDER BY created_at, id LIMIT 1),
	NULLIF(current_setting('ttp.take'), ''),
	current_setting('ttp.wish_no')::bigint,
	current_setting('ttp.nonce1')::uuid));

INSERT INTO ttp_check
SELECT 4, 'C · swap_with_host: the finds change hands',
	CASE WHEN (v->>'ok')::boolean
	      AND (v->>'replay')::boolean IS FALSE
	      AND v->>'gave_find_id' = current_setting('ttp.gave')
	      AND v->>'took_find_id' IS NOT DISTINCT FROM NULLIF(current_setting('ttp.take'), '')
	      AND (v->>'tickles')::int >= 0
	      AND v->'next_wish'->>'find_id' <> current_setting('ttp.gave')
	     THEN 'PASS' ELSE 'FAIL' END,
	'gave=' || COALESCE(v->>'gave_find_id', '-')
	  || ' took=' || COALESCE(v->>'took_find_id', 'NULL(gift)')
	  || ' tickles=' || COALESCE(v->>'tickles', '-')
	  || ' paid=' || COALESCE(v->>'paid', '-')
	  || ' swaps_given=' || COALESCE(v->>'swaps_given', '-')
	  || ' next_wish=' || COALESCE(v->'next_wish'->>'find_id', '-')
	  || ' reason=' || COALESCE(v->>'reason', '-')
FROM ttp_res WHERE k = 'swap1';

-- ── D. The same nonce again: a replay, never a second hand-off ──────────────
INSERT INTO ttp_res VALUES ('swap_replay', public.swap_with_host(
	current_setting('ttp.host')::uuid,
	(SELECT id FROM public.satchel_items
	  WHERE user_id = current_setting('ttp.giver')::uuid ORDER BY id LIMIT 1),
	NULLIF(current_setting('ttp.take'), ''),
	current_setting('ttp.wish_no')::bigint,
	current_setting('ttp.nonce1')::uuid));

INSERT INTO ttp_check
SELECT 5, 'D · same nonce replays, nothing moves twice',
	CASE WHEN (v->>'ok')::boolean
	      AND (v->>'replay')::boolean IS TRUE
	      AND v->>'gave_find_id' = (SELECT r.v->>'gave_find_id' FROM ttp_res r WHERE r.k = 'swap1')
	      AND (SELECT COUNT(*) FROM public.satchel_swaps
	           WHERE nonce = current_setting('ttp.nonce1')::uuid) = 1
	     THEN 'PASS' ELSE 'FAIL' END,
	'replay=' || COALESCE(v->>'replay', '-')
	  || ' ledger_rows_for_nonce=' || (SELECT COUNT(*) FROM public.satchel_swaps
	                                   WHERE nonce = current_setting('ttp.nonce1')::uuid)
	  || ' reason=' || COALESCE(v->>'reason', '-')
FROM ttp_res WHERE k = 'swap_replay';

-- ── E. A fresh nonce, same pair, same day: already_today ────────────────────
-- The reason order is not_in_bag → wish_changed → already_today, so this must
-- pass a find the giver really holds and the wish_no that is live NOW (the
-- swap in C rerolled it).
INSERT INTO ttp_res VALUES ('swap_again', public.swap_with_host(
	current_setting('ttp.host')::uuid,
	(SELECT id FROM public.satchel_items
	  WHERE user_id = current_setting('ttp.giver')::uuid ORDER BY id LIMIT 1),
	NULL,
	(SELECT wish_no FROM public.pig_wishes WHERE user_id = current_setting('ttp.host')::uuid),
	current_setting('ttp.nonce2')::uuid));

INSERT INTO ttp_check
SELECT 6, 'E · a second swap with the same friend today is refused',
	CASE WHEN (v->>'ok')::boolean IS FALSE
	      AND v->>'reason' = 'already_today'
	      AND NOT EXISTS (SELECT 1 FROM public.satchel_swaps
	                      WHERE nonce = current_setting('ttp.nonce2')::uuid)
	     THEN 'PASS' ELSE 'FAIL' END,
	'reason=' || COALESCE(v->>'reason', '(ok:true — WRONG)')
	  || ' wish_returned=' || COALESCE(v->'wish'->>'find_id', '-')
FROM ttp_res WHERE k = 'swap_again';

-- ── F. What both sides can now see ──────────────────────────────────────────

-- F1 · the two bags
INSERT INTO ttp_check
SELECT 7, 'F1 · the rows moved, with provenance',
	CASE WHEN EXISTS (SELECT 1 FROM public.satchel_items
	                  WHERE user_id = current_setting('ttp.host')::uuid
	                    AND find_id = current_setting('ttp.gave')
	                    AND source = 'swap'
	                    AND from_user_id = current_setting('ttp.giver')::uuid)
	      AND (current_setting('ttp.take') = ''
	           OR EXISTS (SELECT 1 FROM public.satchel_items
	                      WHERE user_id = current_setting('ttp.giver')::uuid
	                        AND find_id = current_setting('ttp.take')
	                        AND source = 'swap'
	                        AND from_user_id = current_setting('ttp.host')::uuid))
	     THEN 'PASS' ELSE 'FAIL' END,
	'host_bag=' || (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = current_setting('ttp.host')::uuid)
	  || ' giver_bag=' || (SELECT COUNT(*) FROM public.satchel_items WHERE user_id = current_setting('ttp.giver')::uuid);

-- F2 · the ledger row
INSERT INTO ttp_check
SELECT 8, 'F2 · satchel_swaps row is the receipt',
	CASE WHEN EXISTS (
		SELECT 1 FROM public.satchel_swaps s
		WHERE s.nonce = current_setting('ttp.nonce1')::uuid
		  AND s.giver_id = current_setting('ttp.giver')::uuid
		  AND s.host_id = current_setting('ttp.host')::uuid
		  AND s.gave_find_id = current_setting('ttp.gave')
		  AND s.took_find_id IS NOT DISTINCT FROM NULLIF(current_setting('ttp.take'), ''))
	     THEN 'PASS' ELSE 'FAIL' END,
	(SELECT 'wish_no=' || s.wish_no || ' gave=' || s.gave_find_id
	        || ' took=' || COALESCE(s.took_find_id, 'NULL') || ' tickles=' || s.tickles
	 FROM public.satchel_swaps s WHERE s.nonce = current_setting('ttp.nonce1')::uuid);

-- F3 · the host's while-away line, and that it taps through
INSERT INTO ttp_check
SELECT 9, 'F3 · host announcement: kind satchel_swap, screen barn',
	CASE WHEN EXISTS (
		SELECT 1 FROM public.system_announcements a
		WHERE a.user_id = current_setting('ttp.host')::uuid
		  AND a.kind = 'satchel_swap'
		  AND a.data->>'screen' = 'barn'
		  AND a.data->>'giver_id' = current_setting('ttp.giver')
		  AND a.created_at >= current_setting('ttp.t0')::timestamptz)
	     THEN 'PASS' ELSE 'FAIL' END,
	(SELECT a.body FROM public.system_announcements a
	 WHERE a.user_id = current_setting('ttp.host')::uuid
	   AND a.kind = 'satchel_swap'
	   AND a.created_at >= current_setting('ttp.t0')::timestamptz
	 ORDER BY a.created_at DESC LIMIT 1);

-- F4 · the Board's count (still as the demo account)
INSERT INTO ttp_res VALUES ('swaps_for', public.satchel_swaps_for(
	ARRAY[current_setting('ttp.giver')::uuid, current_setting('ttp.host')::uuid]));

INSERT INTO ttp_check
SELECT 10, 'F4 · satchel_swaps_for counts the giver',
	CASE WHEN (v->>'ok')::boolean
	      AND (v->'counts'->>current_setting('ttp.giver'))::int >= 1
	     THEN 'PASS' ELSE 'FAIL' END,
	'counts=' || COALESCE((v->'counts')::text, '-')
FROM ttp_res WHERE k = 'swaps_for';

-- F5 · the giver's history + breakdown
INSERT INTO ttp_res VALUES ('swaps_giver', public.my_satchel_swaps(20));
INSERT INTO ttp_res VALUES ('breakdown_giver', public.tickle_breakdown(current_setting('ttp.giver')::uuid));

INSERT INTO ttp_check
SELECT 11, 'F5 · my_satchel_swaps as the giver reads "given"',
	CASE WHEN (v->>'ok')::boolean
	      AND EXISTS (SELECT 1 FROM jsonb_array_elements(v->'swaps') e
	                  WHERE e->>'direction' = 'given'
	                    AND e->>'partner_id' = current_setting('ttp.host')
	                    AND e->>'gave_find_id' = current_setting('ttp.gave'))
	     THEN 'PASS' ELSE 'FAIL' END,
	'rows=' || COALESCE(jsonb_array_length(v->'swaps'), 0)
	  || ' newest=' || COALESCE((v->'swaps'->0)::text, '-')
FROM ttp_res WHERE k = 'swaps_giver';

INSERT INTO ttp_check
SELECT 12, 'F6 · tickle_breakdown (giver) has a swaps lane',
	CASE WHEN jsonb_exists(v, 'swaps') OR jsonb_exists(COALESCE(v->'lanes', '{}'::jsonb), 'swaps')
	     THEN 'PASS' ELSE 'FAIL' END,
	'breakdown=' || left(v::text, 300)
FROM ttp_res WHERE k = 'breakdown_giver';

-- F6 · the same two reads as the HOST
SELECT set_config('request.jwt.claim.sub', current_setting('ttp.host'), false),
       set_config('request.jwt.claims',
                  json_build_object('sub', current_setting('ttp.host'), 'role', 'authenticated')::text, false);

INSERT INTO ttp_res VALUES ('swaps_host', public.my_satchel_swaps(20));
INSERT INTO ttp_res VALUES ('breakdown_host', public.tickle_breakdown(current_setting('ttp.host')::uuid));
INSERT INTO ttp_res VALUES ('host_satchel_after', public.my_satchel());

INSERT INTO ttp_check
SELECT 13, 'F7 · my_satchel_swaps as the host reads "received"',
	CASE WHEN (v->>'ok')::boolean
	      AND EXISTS (SELECT 1 FROM jsonb_array_elements(v->'swaps') e
	                  WHERE e->>'direction' = 'received'
	                    AND e->>'partner_id' = current_setting('ttp.giver')
	                    AND e->>'gave_find_id' = current_setting('ttp.gave'))
	     THEN 'PASS' ELSE 'FAIL' END,
	'rows=' || COALESCE(jsonb_array_length(v->'swaps'), 0)
FROM ttp_res WHERE k = 'swaps_host';

INSERT INTO ttp_check
SELECT 14, 'F8 · tickle_breakdown (host) has a swaps lane',
	CASE WHEN jsonb_exists(v, 'swaps') OR jsonb_exists(COALESCE(v->'lanes', '{}'::jsonb), 'swaps')
	     THEN 'PASS' ELSE 'FAIL' END,
	'breakdown=' || left(v::text, 300)
FROM ttp_res WHERE k = 'breakdown_host';

INSERT INTO ttp_check
SELECT 15, 'F9 · host my_satchel(): no shelf, swaps counted',
	CASE WHEN (v->>'ok')::boolean
	      AND jsonb_array_length(v->'shelf') = 0
	      AND (v->>'swaps_received')::int >= 1
	     THEN 'PASS' ELSE 'FAIL' END,
	'shelf=' || COALESCE((v->'shelf')::text, '-')
	  || ' swaps_received=' || COALESCE(v->>'swaps_received', '-')
	  || ' swaps_given=' || COALESCE(v->>'swaps_given', '-')
	  || ' paid_left_today=' || COALESCE(v->>'paid_left_today', '-')
	  || ' wish=' || COALESCE(v->'wish'->>'find_id', '-')
FROM ttp_res WHERE k = 'host_satchel_after';

-- Hand the session back to nobody, so a stray statement after this file can't
-- act as a player.
SELECT set_config('request.jwt.claim.sub', '', false),
       set_config('request.jwt.claims', '', false);

-- ════════════════════════════════════════════════════════════════════════════
-- G. CLEANUP — OFF BY DEFAULT.
--
-- Run the file once as-is, take the screenshots, THEN uncomment the single
-- set_config line below and run the file again. On the second run sections
-- A–F will mostly FAIL (the swap has already happened and `already_today` is
-- spent for the day) — that is expected; only the cleanup lines matter.
--
-- What it removes: the two ledger rows (by nonce), the announcement it wrote,
-- and every find row this runbook planted (found_window_index = -991).
-- What it CANNOT undo, by design: the +3 tickles apply_tickles paid into both
-- profiles (count + snouts), the pair's visit-streak credit, the `satchel_met`
-- rows, any keepsake threshold crossed, and the host's wish (which rerolled —
-- restore it by hand from the BASELINE line printed by step 1 if you care;
-- a wish rerolls by itself every 48h anyway). Never hand-edit profiles to
-- claw tickles back.
-- ════════════════════════════════════════════════════════════════════════════

-- SELECT set_config('ttp.cleanup', 'on', false);

DO $cleanup$
DECLARE
	v_on   boolean := COALESCE(current_setting('ttp.cleanup', true), 'off') = 'on';
	v_host uuid := current_setting('ttp.host')::uuid;
	v_giver uuid := current_setting('ttp.giver')::uuid;
	n_swaps int := 0; n_ann int := 0; n_items int := 0;
BEGIN
	IF NOT v_on THEN
		INSERT INTO ttp_check VALUES (99, 'G · cleanup', 'SKIP',
			'off — uncomment the set_config line above and re-run to remove this run''s rows');
		RETURN;
	END IF;

	DELETE FROM public.satchel_swaps
	WHERE nonce IN (current_setting('ttp.nonce1')::uuid, current_setting('ttp.nonce2')::uuid);
	GET DIAGNOSTICS n_swaps = ROW_COUNT;

	DELETE FROM public.system_announcements
	WHERE user_id = v_host
	  AND kind = 'satchel_swap'
	  AND data->>'giver_id' = v_giver::text
	  AND created_at >= current_setting('ttp.t0')::timestamptz;
	GET DIAGNOSTICS n_ann = ROW_COUNT;

	-- Only rows this runbook planted. The tag travels with a row when a swap
	-- moves it, so this catches them in whichever bag they ended up in.
	DELETE FROM public.satchel_items
	WHERE found_window_index = -991 AND user_id IN (v_host, v_giver);
	GET DIAGNOSTICS n_items = ROW_COUNT;

	INSERT INTO ttp_check VALUES (99, 'G · cleanup', 'DONE',
		'swaps=' || n_swaps || ' announcements=' || n_ann || ' planted_items=' || n_items
		|| ' — tickles, visit-streak credit, met rows and the rerolled wish are left as they are');
END
$cleanup$;

-- ── The only result set this file returns ───────────────────────────────────
SELECT n, verdict, step, detail FROM ttp_check ORDER BY n;

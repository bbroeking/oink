-- Pig errands — Build 1 of the scavenging pigs (docs/pig-errands-build-brief.md).
-- The Pen stops being a one-time purchase screen and becomes a daily errand
-- board: a player sends a pig (Rosie, or a Slop Club companion) to look for one
-- of the twelve countryside Finds — usually the one a friend's pig is wishing
-- for — and hours later the pig comes home with it or without it. The Find
-- goes to the friend (the existing gift swap) or into the player's Satchel.
--
-- The spine (spec docs/pig-errands-spec.md; rulings R1–R12 in
-- docs/design/scavenging-plan-2026-09-17.md):
--   · ONLY A FIND IS EVER MINTED. A keep is one satchel_items insert per
--     result (source 'errand'). A give is keep-then-gift: the row lands in the
--     caller's bag and swap_with_host(p_take_find NULL) moves it, so the give
--     is byte-for-byte the existing gift (tickles, caps, ledger, the host's
--     while-away line, provenance source='gift'). A search never touches
--     Contend (R11): no dig finds, no season points, no tickles of its own.
--   · ONE ERRAND PER PIG PER LOCAL DAY (the pig's feeding time zone — the rule
--     the trader keeps). A recall spends the day. A failed send never does.
--   · ROSIE IS SENDABLE (R1). A companion is a second worker at the same rate.
--     While the greeter is out the Auto-Tickler skips the user (R12).
--   · THE ROLL IS A PURE FUNCTION OF A SEED committed at send time, resolved
--     at ends_at by the first read after (lazy) or the minute sweep (push).
--     Every pig has the same pips in Build 1 (R5) — stored as tuning per pig,
--     so Build 2 is a data change.
--   · FAIL CLOSED. Every RPC answers {ok:false, reason}; nothing raises (a
--     raise inside SECURITY DEFINER is a silent rollback the client reads as
--     success). The testable clock is _patch_now() (ttp.fake_now-aware).
--
-- What / why, section by section:
--   1. Tuning — app_settings.errand_tuning (merge, never clobber; the flag
--      ships FALSE — is_test profiles see it on).
--   2. pig_errands — one row per errand; UNIQUE (user_id, pig_id, local_day)
--      is the once-a-day rule; UNIQUE (user_id, nonce) the send's replay key.
--   3. satchel_items.source gains 'errand'.
--   4. Helpers — the zone/day rule, the seeded unit, the roll, the lazy
--      materialiser, the away pig.
--   5. RPCs — send_pig · pig_errands · claim_errand · recall_pig ·
--      dev_summon_return · host_pig_away.
--   6. The push — sweep_errand_returns() on a one-minute cron, one push per
--      errand through send_push_to_user (screen 'pen').
--   7. _process_auto_tickler_user — carried VERBATIM from 20260829000000 plus
--      one early return while the greeter is out.
--   8. unlock_field_guide_page — carried from 20260917170000 plus 'pen'.
--
-- Pronouns (the push body): Rosie / Pepper / Pickles she; Copper / Bandit /
-- Biscuit he — the same map as utils/pigs.ts pigPronouns.
--
-- Authored for review; do not push without Brian's explicit "go".

-- ── 1. Tuning ────────────────────────────────────────────────────────────────
UPDATE public.app_settings
SET value = '{"enabled": false,
              "duration_hours": {"trot1": 6, "trot2": 4, "trot3": 2},
              "target_odds_pts": {"common": 60, "uncommon": 40, "rare": 20},
              "nose_bonus_pts": {"1": 0, "2": 10, "3": 20},
              "anything_weights": {"glint1": [70,25,5], "glint2": [60,30,10], "glint3": [50,35,15]},
              "distracted_pts": 10,
              "board_cap": 3,
              "pigs": {"rosie":   {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
                       "copper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
                       "pepper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
                       "bandit":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
                       "pickles": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
                       "biscuit": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null}}}'::jsonb || value,
    description = 'Pig errands (20260918120000): the flag, hours out per trot pip, target odds by rarity (+ nose bonus), the anything weights per glint pip, the distracted odds, the corkboard cap, and each pig''s pips (Build 1: all 1·2·1·1).'
WHERE key = 'errand_tuning';

INSERT INTO public.app_settings (key, value, description)
SELECT 'errand_tuning',
	'{"enabled": false,
	  "duration_hours": {"trot1": 6, "trot2": 4, "trot3": 2},
	  "target_odds_pts": {"common": 60, "uncommon": 40, "rare": 20},
	  "nose_bonus_pts": {"1": 0, "2": 10, "3": 20},
	  "anything_weights": {"glint1": [70,25,5], "glint2": [60,30,10], "glint3": [50,35,15]},
	  "distracted_pts": 10,
	  "board_cap": 3,
	  "pigs": {"rosie":   {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
	           "copper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
	           "pepper":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
	           "bandit":  {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
	           "pickles": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null},
	           "biscuit": {"nose":1,"trot":2,"pockets":1,"glint":1,"family":null}}}'::jsonb,
	'Pig errands (20260918120000): the flag, hours out per trot pip, target odds by rarity (+ nose bonus), the anything weights per glint pip, the distracted odds, the corkboard cap, and each pig''s pips (Build 1: all 1·2·1·1).'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'errand_tuning');

-- The row MERGED OVER the fallback: a hand-retuned row that dropped a key
-- still answers every key.
CREATE OR REPLACE FUNCTION public._errand_tuning()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT '{"enabled": false,
	         "duration_hours": {"trot1": 6, "trot2": 4, "trot3": 2},
	         "target_odds_pts": {"common": 60, "uncommon": 40, "rare": 20},
	         "nose_bonus_pts": {"1": 0, "2": 10, "3": 20},
	         "anything_weights": {"glint1": [70,25,5], "glint2": [60,30,10], "glint3": [50,35,15]},
	         "distracted_pts": 10,
	         "board_cap": 3,
	         "pigs": {}}'::jsonb
		|| COALESCE((SELECT value FROM public.app_settings WHERE key = 'errand_tuning'), '{}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._errand_tuning() FROM PUBLIC, anon, authenticated;

-- One pig's pips, with the Build 1 generic worker as the fallback.
CREATE OR REPLACE FUNCTION public._errand_pig_stats(t jsonb, p_pig text)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT '{"nose":1,"trot":2,"pockets":1,"glint":1,"family":null}'::jsonb
		|| COALESCE(t->'pigs'->p_pig, '{}'::jsonb);
$function$;
REVOKE ALL ON FUNCTION public._errand_pig_stats(jsonb, text) FROM PUBLIC, anon, authenticated;

-- ── 2. The errands ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pig_errands (
	id              bigserial PRIMARY KEY,
	user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	pig_id          text NOT NULL CHECK (pig_id IN ('rosie','copper','pepper','bandit','pickles','biscuit')),
	-- NULL = anything.
	target_find_id  text NULL REFERENCES public.satchel_finds(id),
	-- The friend whose wish it is, and their wish number at send time.
	for_user_id     uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
	for_wish_no     bigint NULL,
	-- The pig's LOCAL day (feeding time zone) — the once-a-day key.
	local_day       date NOT NULL,
	started_at      timestamptz NOT NULL,
	ends_at         timestamptz NOT NULL,
	-- Committed at send; the roll is a pure function of it.
	seed            text NOT NULL,
	status          text NOT NULL CHECK (status IN ('out','back','kept','given','recalled')),
	result_find_ids text[] NOT NULL DEFAULT '{}',
	resolved_at     timestamptz NULL,
	claimed_at      timestamptz NULL,
	notified_at     timestamptz NULL,
	-- The send's idempotency key (a replay answers the original row).
	nonce           uuid NOT NULL,
	-- The claim's idempotency key and its original answer.
	claim_nonce     uuid NULL,
	claim_result    jsonb NULL,
	created_at      timestamptz NOT NULL DEFAULT now(),
	CHECK (ends_at >= started_at),
	UNIQUE (user_id, pig_id, local_day),
	UNIQUE (user_id, nonce)
);
CREATE INDEX IF NOT EXISTS pig_errands_user_status_idx ON public.pig_errands (user_id, status, ends_at DESC);
CREATE INDEX IF NOT EXISTS pig_errands_due_idx ON public.pig_errands (ends_at) WHERE notified_at IS NULL AND status IN ('out','back');
ALTER TABLE public.pig_errands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.pig_errands FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.pig_errands_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pig_errands TO authenticated;
DROP POLICY IF EXISTS pig_errands_owner_read ON public.pig_errands;
CREATE POLICY pig_errands_owner_read ON public.pig_errands
	FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── 3. A bag row can come from an errand ─────────────────────────────────────
ALTER TABLE public.satchel_items
	DROP CONSTRAINT IF EXISTS satchel_items_source_check;
ALTER TABLE public.satchel_items
	ADD CONSTRAINT satchel_items_source_check
	CHECK (source IN ('dig', 'swap', 'gift', 'migrated_shelf', 'errand'));

-- ── 4. Helpers ───────────────────────────────────────────────────────────────

-- The pig's clock: its feeding time zone (ET when unset) — the same rule the
-- trader's local day follows.
CREATE OR REPLACE FUNCTION public._errand_zone(p_user uuid, p_at timestamptz)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(public._feeding_zone_at(p_user, p_at), 'America/New_York');
$function$;
REVOKE ALL ON FUNCTION public._errand_zone(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._errand_local_day(p_user uuid, p_at timestamptz)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT (p_at AT TIME ZONE public._errand_zone(p_user, p_at))::date;
$function$;
REVOKE ALL ON FUNCTION public._errand_local_day(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- A unit draw in [0, 1) that is a pure function of its key (the trader's).
CREATE OR REPLACE FUNCTION public._errand_unit(p_key text)
RETURNS numeric LANGUAGE sql IMMUTABLE
AS $function$
	SELECT public._trader_unit(p_key);
$function$;
REVOKE ALL ON FUNCTION public._errand_unit(text) FROM PUBLIC, anon, authenticated;

-- One "anything" find, seeded: a rarity by the pig's glint weights, then a
-- find within it by a seeded order. Never NULL while the catalog has rows.
CREATE OR REPLACE FUNCTION public._errand_anything(p_seed text, p_glint int, t jsonb)
RETURNS text LANGUAGE plpgsql STABLE
AS $function$
DECLARE
	w jsonb := COALESCE(t->'anything_weights'->('glint' || GREATEST(1, LEAST(3, p_glint))::text), '[70,25,5]'::jsonb);
	w_common numeric := GREATEST(0, COALESCE((w->>0)::numeric, 70));
	w_uncommon numeric := GREATEST(0, COALESCE((w->>1)::numeric, 25));
	w_rare numeric := GREATEST(0, COALESCE((w->>2)::numeric, 5));
	total numeric := w_common + w_uncommon + w_rare;
	u numeric := public._errand_unit(p_seed || ':rarity');
	pick text;
	out_id text;
BEGIN
	IF total <= 0 THEN total := 100; w_common := 70; w_uncommon := 25; w_rare := 5; END IF;
	pick := CASE
		WHEN u * total < w_common THEN 'common'
		WHEN u * total < w_common + w_uncommon THEN 'uncommon'
		ELSE 'rare' END;
	SELECT f.id INTO out_id FROM public.satchel_finds f
		WHERE f.rarity = pick
		ORDER BY public._errand_unit(p_seed || ':pick:' || f.id), f.sort LIMIT 1;
	IF out_id IS NULL THEN
		SELECT f.id INTO out_id FROM public.satchel_finds f
			ORDER BY public._errand_unit(p_seed || ':pick:' || f.id), f.sort LIMIT 1;
	END IF;
	RETURN out_id;
END;
$function$;
REVOKE ALL ON FUNCTION public._errand_anything(text, int, jsonb) FROM PUBLIC, anon, authenticated;

-- THE ROLL — pure: (seed, target, pig, tuning) → the finds the pig brings back.
--   with a target: hit when u(':find') < target_odds[rarity] + nose_bonus[nose]
--                  → {target}; else distracted (u(':distracted') < distracted_pts)
--                  → one anything find; else {} (muddy trotters).
--   no target:     one anything find.
-- Pockets > 1 (Build 2) appends an anything find per extra pocket at the
-- distracted odds — the loop exists now, gated by the pip.
CREATE OR REPLACE FUNCTION public._errand_roll(p_seed text, p_target text, p_pig text, t jsonb)
RETURNS text[] LANGUAGE plpgsql STABLE
AS $function$
DECLARE
	stats jsonb := public._errand_pig_stats(t, p_pig);
	nose int := GREATEST(1, LEAST(3, COALESCE((stats->>'nose')::int, 1)));
	glint int := GREATEST(1, LEAST(3, COALESCE((stats->>'glint')::int, 1)));
	pockets int := GREATEST(1, LEAST(3, COALESCE((stats->>'pockets')::int, 1)));
	distracted numeric := GREATEST(0, LEAST(100, COALESCE((t->>'distracted_pts')::numeric, 10)));
	rarity text;
	odds numeric;
	found text[] := '{}';
	extra text;
	i int;
BEGIN
	IF p_target IS NOT NULL THEN
		SELECT f.rarity INTO rarity FROM public.satchel_finds f WHERE f.id = p_target;
		odds := GREATEST(0, COALESCE((t->'target_odds_pts'->>COALESCE(rarity, 'common'))::numeric, 60))
			+ GREATEST(0, COALESCE((t->'nose_bonus_pts'->>nose::text)::numeric, 0));
		IF public._errand_unit(p_seed || ':find') * 100 < odds THEN
			found := ARRAY[p_target];
		ELSIF public._errand_unit(p_seed || ':distracted') * 100 < distracted THEN
			extra := public._errand_anything(p_seed || ':anything', glint, t);
			IF extra IS NOT NULL THEN found := ARRAY[extra]; END IF;
		END IF;
	ELSE
		extra := public._errand_anything(p_seed || ':anything', glint, t);
		IF extra IS NOT NULL THEN found := ARRAY[extra]; END IF;
	END IF;
	FOR i IN 2..pockets LOOP
		IF public._errand_unit(p_seed || ':pocket' || i::text) * 100 < distracted THEN
			extra := public._errand_anything(p_seed || ':pocket' || i::text, glint, t);
			IF extra IS NOT NULL THEN found := found || extra; END IF;
		END IF;
	END LOOP;
	RETURN found;
END;
$function$;
REVOKE ALL ON FUNCTION public._errand_roll(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- A deterministic analytics session per errand, the habitat migration's idiom.
CREATE OR REPLACE FUNCTION public._errand_session(p_user uuid, p_id bigint)
RETURNS uuid LANGUAGE sql IMMUTABLE
AS $function$
	SELECT (substr(md5(p_user::text || '|errand|' || p_id::text), 1, 8) || '-' ||
	        substr(md5(p_user::text || '|errand|' || p_id::text), 9, 4) || '-' ||
	        substr(md5(p_user::text || '|errand|' || p_id::text), 13, 4) || '-' ||
	        substr(md5(p_user::text || '|errand|' || p_id::text), 17, 4) || '-' ||
	        substr(md5(p_user::text || '|errand|' || p_id::text), 21, 12))::uuid;
$function$;
REVOKE ALL ON FUNCTION public._errand_session(uuid, bigint) FROM PUBLIC, anon, authenticated;

-- Every out row past its ends_at comes back: the roll lands, the status flips.
-- Idempotent; the first read after the hour or the sweep, whichever is first.
CREATE OR REPLACE FUNCTION public._errand_materialise(p_user uuid)
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._errand_tuning();
	v_now timestamptz := public._patch_now();
	n int;
BEGIN
	UPDATE public.pig_errands e SET
		result_find_ids = public._errand_roll(e.seed, e.target_find_id, e.pig_id, t),
		status = 'back',
		resolved_at = v_now
	WHERE e.user_id = p_user AND e.status = 'out' AND e.ends_at <= v_now;
	GET DIAGNOSTICS n = ROW_COUNT;
	IF n > 0 THEN
		INSERT INTO public.interaction_analytics_events
			(user_id, session_id, event_name, surface, target_kind, result, content_id, properties)
		SELECT e.user_id, public._errand_session(e.user_id, e.id), 'errand_returned', 'pen', 'errand',
			'succeeded', e.pig_id,
			jsonb_build_object('found', COALESCE(array_length(e.result_find_ids, 1), 0), 'errand_id', e.id)
		FROM public.pig_errands e
		WHERE e.user_id = p_user AND e.status = 'back' AND e.resolved_at = v_now;
	END IF;
	RETURN n;
END;
$function$;
REVOKE ALL ON FUNCTION public._errand_materialise(uuid) FROM PUBLIC, anon, authenticated;

-- The pig that greets at Home — pig_roster()'s effective-active rule: the
-- stored pick while the member owns it, else Rosie.
CREATE OR REPLACE FUNCTION public._errand_active_pig(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT CASE
		WHEN COALESCE(p.is_vip, false) AND EXISTS (
			SELECT 1 FROM public.user_pigs up WHERE up.user_id = p.id AND up.pig_id = COALESCE(p.active_pig_id, 'rosie'))
		THEN COALESCE(p.active_pig_id, 'rosie')
		ELSE 'rosie' END
	FROM public.profiles p WHERE p.id = p_user;
$function$;
REVOKE ALL ON FUNCTION public._errand_active_pig(uuid) FROM PUBLIC, anon, authenticated;

-- The active pig's id while it is out looking, else NULL. Reads the live
-- rows (an out row past its hour is still "out" until materialised, and the
-- yard is what materialises it), so callers that care about the hour read
-- through pig_errands() first.
CREATE OR REPLACE FUNCTION public._errand_pig_away(p_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT e.pig_id FROM public.pig_errands e
	WHERE e.user_id = p_user AND e.status = 'out'
	  AND e.ends_at > public._patch_now()
	  AND e.pig_id = public._errand_active_pig(p_user)
	LIMIT 1;
$function$;
REVOKE ALL ON FUNCTION public._errand_pig_away(uuid) FROM PUBLIC, anon, authenticated;

-- The row, as the client parses it.
CREATE OR REPLACE FUNCTION public._errand_json(e public.pig_errands)
RETURNS jsonb LANGUAGE sql IMMUTABLE
AS $function$
	SELECT jsonb_build_object(
		'id', e.id,
		'pig_id', e.pig_id,
		'target_find_id', e.target_find_id,
		'for_user_id', e.for_user_id,
		'for_wish_no', e.for_wish_no,
		'started_at', e.started_at,
		'ends_at', e.ends_at,
		'status', e.status,
		'result_find_ids', to_jsonb(e.result_find_ids));
$function$;
REVOKE ALL ON FUNCTION public._errand_json(public.pig_errands) FROM PUBLIC, anon, authenticated;

-- Whether THIS caller sees the errand: the flag, or a test profile.
CREATE OR REPLACE FUNCTION public._errand_enabled_for(p_user uuid, t jsonb)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE((t->>'enabled')::boolean, false)
		OR COALESCE((SELECT p.is_test FROM public.profiles p WHERE p.id = p_user), false);
$function$;
REVOKE ALL ON FUNCTION public._errand_enabled_for(uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- The pronoun map (utils/pigs.ts pigPronouns).
CREATE OR REPLACE FUNCTION public._errand_pig_he(p_pig text)
RETURNS text LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE WHEN p_pig IN ('copper', 'bandit', 'biscuit') THEN 'He' ELSE 'She' END;
$function$;
REVOKE ALL ON FUNCTION public._errand_pig_he(text) FROM PUBLIC, anon, authenticated;

-- ── 5. RPCs ──────────────────────────────────────────────────────────────────

-- The state, for the Pen and the yard. Materialises first, so a pig past its
-- hour is `back` on the read that finds it.
CREATE OR REPLACE FUNCTION public._errand_state_json(p_user uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	t jsonb := public._errand_tuning();
	v_now timestamptz := public._patch_now();
	today date := public._errand_local_day(p_user, v_now);
	cap int := GREATEST(1, COALESCE((t->>'board_cap')::int, 3));
BEGIN
	PERFORM public._errand_materialise(p_user);
	RETURN jsonb_build_object(
		'ok', true,
		'enabled', public._errand_enabled_for(p_user, t),
		'now', v_now,
		'away', public._errand_pig_away(p_user),
		'today', (
			SELECT COALESCE(jsonb_object_agg(pc.id, EXISTS (
				SELECT 1 FROM public.pig_errands e
				WHERE e.user_id = p_user AND e.pig_id = pc.id AND e.local_day = today)), '{}'::jsonb)
			FROM public.pig_catalog pc),
		'out', COALESCE((
			SELECT jsonb_agg(public._errand_json(e) ORDER BY e.ends_at)
			FROM public.pig_errands e WHERE e.user_id = p_user AND e.status = 'out'), '[]'::jsonb),
		'board', COALESCE((
			SELECT jsonb_agg(public._errand_json(x)) FROM (
				SELECT e.* FROM public.pig_errands e
				WHERE e.user_id = p_user AND e.status = 'back'
				ORDER BY e.resolved_at DESC, e.id DESC LIMIT cap) x), '[]'::jsonb),
		'tuning', t);
END;
$function$;
REVOKE ALL ON FUNCTION public._errand_state_json(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.pig_errands()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('errand:' || uid::text)::bigint);
	RETURN public._errand_state_json(uid);
END;
$function$;
REVOKE ALL ON FUNCTION public.pig_errands() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pig_errands() TO authenticated;

-- Send a pig. Refusals, in order: not_authenticated · bad_nonce · (replay →
-- the original row) · errands_disabled · pig_unknown · pig_not_owned ·
-- pig_resting · pig_already_out · errand_used_today · board_full ·
-- target_unknown · not_friends · target_not_wished (with the live wish).
-- A refusal writes nothing: a failed send never spends the day.
CREATE OR REPLACE FUNCTION public.send_pig(
	p_pig text,
	p_target text DEFAULT NULL,
	p_for uuid DEFAULT NULL,
	p_nonce uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	t jsonb := public._errand_tuning();
	v_now timestamptz := public._patch_now();
	today date;
	cap int := GREATEST(1, COALESCE((t->>'board_cap')::int, 3));
	member boolean;
	owned boolean;
	stats jsonb;
	trot int;
	hours numeric;
	w public.pig_wishes%ROWTYPE;
	prior public.pig_errands%ROWTYPE;
	e public.pig_errands%ROWTYPE;
	waiting int;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;

	-- 0. Replay: the original row, never a second errand.
	SELECT * INTO prior FROM public.pig_errands WHERE user_id = uid AND nonce = p_nonce;
	IF FOUND THEN
		RETURN jsonb_build_object('ok', true, 'replay', true, 'errand', public._errand_json(prior));
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('errand:' || uid::text)::bigint);
	PERFORM public._errand_materialise(uid);
	today := public._errand_local_day(uid, v_now);

	-- 1. The gate.
	IF NOT public._errand_enabled_for(uid, t) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'errands_disabled');
	END IF;

	-- 2. The pig: in the catalog, in this roster, awake.
	IF p_pig IS NULL OR NOT EXISTS (SELECT 1 FROM public.pig_catalog pc WHERE pc.id = p_pig AND pc.available) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pig_unknown');
	END IF;
	SELECT COALESCE(p.is_vip, false) INTO member FROM public.profiles p WHERE p.id = uid;
	owned := p_pig = 'rosie' OR EXISTS (SELECT 1 FROM public.user_pigs up WHERE up.user_id = uid AND up.pig_id = p_pig);
	IF NOT owned THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pig_not_owned');
	END IF;
	-- A lapsed member's companion rests; Rosie always goes (R12).
	IF p_pig <> 'rosie' AND NOT COALESCE(member, false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pig_resting');
	END IF;

	-- 3. One at a time, one a day.
	IF EXISTS (SELECT 1 FROM public.pig_errands x WHERE x.user_id = uid AND x.pig_id = p_pig AND x.status = 'out') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'pig_already_out');
	END IF;
	IF EXISTS (SELECT 1 FROM public.pig_errands x WHERE x.user_id = uid AND x.pig_id = p_pig AND x.local_day = today) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'errand_used_today');
	END IF;

	-- 4. The board: a pig rests until you look.
	SELECT COUNT(*)::int INTO waiting FROM public.pig_errands x WHERE x.user_id = uid AND x.status = 'back';
	IF waiting >= cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'board_full', 'board_cap', cap);
	END IF;

	-- 5. The target: a find we know; a friend's wish must be their LIVE wish.
	IF p_target IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.satchel_finds f WHERE f.id = p_target) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'target_unknown');
	END IF;
	IF p_for IS NOT NULL THEN
		IF p_for = uid OR NOT public.are_friends(uid, p_for) OR public.are_blocked(uid, p_for) THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'not_friends');
		END IF;
		w := public._peek_wish(p_for);
		IF p_target IS NULL OR w.find_id IS NULL OR w.find_id <> p_target THEN
			RETURN jsonb_build_object('ok', false, 'reason', 'target_not_wished',
				'wish', CASE WHEN w.user_id IS NULL THEN NULL ELSE w.find_id END,
				'wish_no', w.wish_no);
		END IF;
	END IF;

	-- 6. Out the gate. Hours from the pig's trot pip; the seed is committed here.
	stats := public._errand_pig_stats(t, p_pig);
	trot := GREATEST(1, LEAST(3, COALESCE((stats->>'trot')::int, 2)));
	hours := GREATEST(0.05, COALESCE((t->'duration_hours'->>('trot' || trot::text))::numeric,
		CASE trot WHEN 1 THEN 6 WHEN 3 THEN 2 ELSE 4 END));
	INSERT INTO public.pig_errands
		(user_id, pig_id, target_find_id, for_user_id, for_wish_no, local_day,
		 started_at, ends_at, seed, status, nonce)
	VALUES
		(uid, p_pig, p_target, p_for, CASE WHEN p_for IS NULL THEN NULL ELSE w.wish_no END, today,
		 v_now, v_now + make_interval(secs => FLOOR(hours * 3600)::int),
		 md5(uid::text || ':' || p_pig || ':' || today::text || ':' || p_nonce::text), 'out', p_nonce)
	RETURNING * INTO e;

	INSERT INTO public.interaction_analytics_events
		(user_id, session_id, event_name, surface, target_kind, target_user_id, result, content_id, properties)
	VALUES (uid, public._errand_session(uid, e.id), 'errand_sent', 'pen', 'errand', p_for, 'succeeded', p_pig,
		jsonb_build_object('errand_id', e.id,
			'target_kind', CASE WHEN p_for IS NOT NULL THEN 'friend' WHEN p_target IS NOT NULL THEN 'own' ELSE 'anything' END));

	RETURN jsonb_build_object('ok', true, 'replay', false, 'errand', public._errand_json(e));
END;
$function$;
REVOKE ALL ON FUNCTION public.send_pig(text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_pig(text, text, uuid, uuid) TO authenticated;

-- Claim a return: keep it (into the Satchel) or give it (keep first, then the
-- swap's gift path — byte-for-byte the existing hand-off). A refused give
-- leaves the find in the caller's bag and the errand `kept`: never lost.
-- Refusals: not_authenticated · bad_nonce · bad_action · not_back ·
-- already_claimed · not_giveable · bag_full · wish_moved · host_bag_full ·
-- (any other swap refusal, verbatim).
CREATE OR REPLACE FUNCTION public.claim_errand(p_id bigint, p_action text, p_nonce uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	st jsonb := public._satchel_tuning();
	cap int := GREATEST(0, COALESCE((st->>'cap')::int, 6));
	v_now timestamptz := public._patch_now();
	e public.pig_errands%ROWTYPE;
	fid text;
	have int;
	kept int := 0;
	first_row bigint := NULL;
	new_row bigint;
	res jsonb;
	reason text;
	answer jsonb;
	final_status text;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_nonce IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_nonce');
	END IF;
	IF p_action IS NULL OR p_action NOT IN ('give', 'keep') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_action');
	END IF;

	PERFORM pg_advisory_xact_lock(hashtext('errand:' || uid::text)::bigint);
	PERFORM public._errand_materialise(uid);

	SELECT * INTO e FROM public.pig_errands WHERE id = p_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_back');
	END IF;
	-- 0. Replay: the original answer.
	IF e.claim_nonce = p_nonce AND e.claim_result IS NOT NULL THEN
		RETURN e.claim_result || jsonb_build_object('replay', true);
	END IF;
	IF e.status IN ('kept', 'given') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed', 'status', e.status);
	END IF;
	IF e.status <> 'back' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_back', 'status', e.status);
	END IF;

	-- 1. A give needs a friend and the thing they asked for.
	IF p_action = 'give' AND (e.for_user_id IS NULL
		OR COALESCE(array_length(e.result_find_ids, 1), 0) = 0
		OR e.result_find_ids[1] IS DISTINCT FROM e.target_find_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_giveable', 'status', e.status);
	END IF;

	-- 2. The keep: every result into the bag, up to the cap. (The cap is
	-- 9999 since 20260918090000, so bag_full is theory; the branch stays
	-- because the number is tunable.)
	SELECT COUNT(*)::int INTO have FROM public.satchel_items s WHERE s.user_id = uid;
	IF COALESCE(array_length(e.result_find_ids, 1), 0) > 0 AND have >= cap THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bag_full', 'status', e.status,
			'bag_count', have, 'cap', cap);
	END IF;
	FOREACH fid IN ARRAY e.result_find_ids LOOP
		EXIT WHEN have >= cap;
		INSERT INTO public.satchel_items (user_id, find_id, source, created_at)
			VALUES (uid, fid, 'errand', v_now)
			RETURNING id INTO new_row;
		INSERT INTO public.satchel_met (user_id, find_id) VALUES (uid, fid) ON CONFLICT DO NOTHING;
		have := have + 1;
		kept := kept + 1;
		-- The FIRST row is the one a give hands over.
		IF first_row IS NULL THEN first_row := new_row; END IF;
	END LOOP;

	final_status := 'kept';
	answer := jsonb_build_object('ok', true, 'replay', false, 'action', 'keep', 'status', 'kept',
		'tickles', 0, 'kept', kept, 'bag_count', have);

	-- 3. The give: the existing gift, on the row just kept.
	IF p_action = 'give' THEN
		res := public.swap_with_host(e.for_user_id, first_row, NULL, e.for_wish_no, p_nonce);
		IF COALESCE((res->>'ok')::boolean, false) THEN
			final_status := 'given';
			answer := jsonb_build_object('ok', true, 'replay', false, 'action', 'give', 'status', 'given',
				'tickles', COALESCE((res->>'tickles')::int, 0),
				'paid', COALESCE((res->>'paid')::boolean, false),
				'giver_tickled', res->'giver_tickled',
				'host_tickled', res->'host_tickled',
				'keepsake', res->'keepsake',
				'bag_count', COALESCE(jsonb_array_length(res->'bag'), have - 1),
				'bag', res->'bag');
		ELSE
			reason := CASE res->>'reason'
				WHEN 'wrong_find' THEN 'wish_moved'
				WHEN 'wish_changed' THEN 'wish_moved'
				WHEN 'already_today' THEN 'wish_moved'
				WHEN 'host_bag_full' THEN 'host_bag_full'
				ELSE COALESCE(res->>'reason', 'unknown') END;
			answer := jsonb_build_object('ok', false, 'reason', reason, 'status', 'kept',
				'wish', res->'wish'->>'find_id', 'kept', kept, 'bag_count', have);
		END IF;
	END IF;

	UPDATE public.pig_errands SET
		status = final_status,
		claimed_at = v_now,
		claim_nonce = p_nonce,
		claim_result = answer
	WHERE id = e.id;

	INSERT INTO public.interaction_analytics_events
		(user_id, session_id, event_name, surface, target_kind, target_user_id, result, content_id, properties)
	VALUES (uid, public._errand_session(uid, e.id), 'errand_claimed', 'pen', 'errand', e.for_user_id,
		CASE WHEN COALESCE((answer->>'ok')::boolean, false) THEN 'succeeded' ELSE 'refused' END, e.pig_id,
		jsonb_build_object('errand_id', e.id, 'action', p_action, 'outcome', final_status,
			'found', COALESCE(array_length(e.result_find_ids, 1), 0)));

	RETURN answer;
END;
$function$;
REVOKE ALL ON FUNCTION public.claim_errand(bigint, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_errand(bigint, text, uuid) TO authenticated;

-- Call a pig home now: empty-handed, and the day stays spent (R3).
CREATE OR REPLACE FUNCTION public.recall_pig(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	v_now timestamptz := public._patch_now();
	e public.pig_errands%ROWTYPE;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('errand:' || uid::text)::bigint);
	PERFORM public._errand_materialise(uid);
	SELECT * INTO e FROM public.pig_errands WHERE id = p_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND OR e.status <> 'out' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_out', 'status', e.status);
	END IF;
	UPDATE public.pig_errands SET
		status = 'recalled', result_find_ids = '{}', resolved_at = v_now, notified_at = COALESCE(notified_at, v_now)
	WHERE id = e.id RETURNING * INTO e;
	INSERT INTO public.interaction_analytics_events
		(user_id, session_id, event_name, surface, target_kind, result, content_id, properties)
	VALUES (uid, public._errand_session(uid, e.id), 'errand_recalled', 'pen', 'errand', 'succeeded', e.pig_id,
		jsonb_build_object('errand_id', e.id));
	RETURN jsonb_build_object('ok', true, 'errand', public._errand_json(e));
END;
$function$;
REVOKE ALL ON FUNCTION public.recall_pig(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recall_pig(bigint) TO authenticated;

-- DEV ONLY (profiles.is_test, the dev_summon_trader gate): the pig is home
-- now — ends_at is pulled to the clock and the row materialised, so the
-- homecoming can be seen without waiting the hours.
CREATE OR REPLACE FUNCTION public.dev_summon_return(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	caller_is_test boolean;
	v_now timestamptz := public._patch_now();
	e public.pig_errands%ROWTYPE;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	SELECT COALESCE(p.is_test, false) INTO caller_is_test FROM public.profiles p WHERE p.id = uid;
	IF NOT COALESCE(caller_is_test, false) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'admin_only');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtext('errand:' || uid::text)::bigint);
	SELECT * INTO e FROM public.pig_errands WHERE id = p_id AND user_id = uid FOR UPDATE;
	IF NOT FOUND OR e.status <> 'out' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_out', 'status', e.status);
	END IF;
	UPDATE public.pig_errands SET ends_at = LEAST(ends_at, v_now) WHERE id = e.id;
	PERFORM public._errand_materialise(uid);
	SELECT * INTO e FROM public.pig_errands WHERE id = e.id;
	RETURN jsonb_build_object('ok', true, 'errand', public._errand_json(e));
END;
$function$;
REVOKE ALL ON FUNCTION public.dev_summon_return(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_summon_return(bigint) TO authenticated;

-- The visit's read: is the host's greeter out, and until when. A public
-- fact about the yard (the visitor sees the empty yard either way).
CREATE OR REPLACE FUNCTION public.host_pig_away(p_host uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	uid uuid := auth.uid();
	away text;
	until_at timestamptz;
BEGIN
	IF uid IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
	END IF;
	IF p_host IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_host');
	END IF;
	away := public._errand_pig_away(p_host);
	IF away IS NOT NULL THEN
		SELECT e.ends_at INTO until_at FROM public.pig_errands e
			WHERE e.user_id = p_host AND e.pig_id = away AND e.status = 'out' LIMIT 1;
	END IF;
	RETURN jsonb_build_object('ok', true, 'away', away, 'ends_at', until_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.host_pig_away(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.host_pig_away(uuid) TO authenticated;

-- ── 6. The push ──────────────────────────────────────────────────────────────
-- Every minute: each errand past its hour that has not been announced is
-- materialised (the roll lands) and announced ONCE. The body never reveals
-- empty hands — "come and see" — except to say what a friend's pig got.
CREATE OR REPLACE FUNCTION public.sweep_errand_returns()
RETURNS int LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	v_now timestamptz := public._patch_now();
	r record;
	n int := 0;
	pig_name text;
	friend_name text;
	thing text;
	ttl text;
	line text;
BEGIN
	FOR r IN
		SELECT DISTINCT e.user_id FROM public.pig_errands e
		WHERE e.status IN ('out', 'back') AND e.ends_at <= v_now AND e.notified_at IS NULL
	LOOP
		PERFORM pg_advisory_xact_lock(hashtext('errand:' || r.user_id::text)::bigint);
		PERFORM public._errand_materialise(r.user_id);
	END LOOP;

	FOR r IN
		SELECT e.* FROM public.pig_errands e
		WHERE e.status = 'back' AND e.ends_at <= v_now AND e.notified_at IS NULL
		ORDER BY e.ends_at, e.id
		FOR UPDATE SKIP LOCKED
	LOOP
		SELECT pc.name INTO pig_name FROM public.pig_catalog pc WHERE pc.id = r.pig_id;
		pig_name := COALESCE(pig_name, initcap(r.pig_id));
		ttl := pig_name || '''s back';
		IF r.for_user_id IS NOT NULL AND r.target_find_id IS NOT NULL
			AND COALESCE(array_length(r.result_find_ids, 1), 0) > 0
			AND r.result_find_ids[1] = r.target_find_id THEN
			SELECT p.username INTO friend_name FROM public.profiles p WHERE p.id = r.for_user_id;
			SELECT f.name INTO thing FROM public.satchel_finds f WHERE f.id = r.target_find_id;
			line := public._errand_pig_he(r.pig_id) || ' found the ' || COALESCE(thing, 'thing') || ' '
				|| COALESCE(friend_name, 'a friend') || '''s pig was hoping for.';
		ELSE
			line := 'Back from the hedge — come and see.';
		END IF;
		BEGIN
			PERFORM public.send_push_to_user(r.user_id, ttl, line,
				jsonb_build_object('screen', 'pen', 'errand_id', r.id, 'pig_id', r.pig_id));
		EXCEPTION WHEN OTHERS THEN
			RAISE NOTICE 'errand push failed for %: %', r.id, SQLERRM;
		END;
		UPDATE public.pig_errands SET notified_at = v_now WHERE id = r.id;
		n := n + 1;
	END LOOP;
	RETURN n;
END;
$function$;
REVOKE ALL ON FUNCTION public.sweep_errand_returns() FROM PUBLIC, anon, authenticated;

-- Tolerate pg_cron being absent (the plain-Postgres harness stubs cron.*).
DO $schedule$
BEGIN
	PERFORM cron.schedule('pig_errands_returns', '* * * * *', 'SELECT public.sweep_errand_returns()');
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'pig_errands_returns cron was not scheduled in this environment: %', SQLERRM;
END;
$schedule$;

-- ── 7. The Auto-Tickler skips a pig that is out (R12) ────────────────────────
-- Carried VERBATIM from the LATEST definition,
-- 20260829000000_contraptions_and_streaks.sql (the carry-latest-def footgun).
-- The ONLY change is the early return while the greeter is out.
CREATE OR REPLACE FUNCTION public._process_auto_tickler_user(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	service public.user_contraptions%ROWTYPE;
	cap_val int;
	reserve_val int;
	balance int;
	spent int;
BEGIN
	-- Nobody is in the yard to tickle: the greeter is out looking (2026-09-18).
	IF public._errand_pig_away(p_user_id) IS NOT NULL THEN
		RETURN 0;
	END IF;

	SELECT * INTO service
	FROM public.user_contraptions
	WHERE user_id = p_user_id
		AND contraption_id = 'auto_tickler'
	FOR UPDATE;

	IF service.user_id IS NULL OR service.active_until IS NULL
		OR service.active_until <= now()
	THEN
		RETURN 0;
	END IF;

	-- settle_tickles is the canonical fractional-regen checkpoint. The service
	-- then consumes only the surplus over the player's personal cap minus five.
	balance := public.settle_tickles(p_user_id);
	SELECT CASE WHEN COALESCE(is_vip, false) THEN 50 ELSE 25 END
	INTO cap_val FROM public.profiles WHERE id = p_user_id;
	reserve_val := GREATEST(0, cap_val - 5);
	spent := GREATEST(0, balance - reserve_val);

	IF spent > 0 THEN
		UPDATE public.user_items
		SET item_count = item_count - spent
		WHERE user_id = p_user_id;

		-- Deliberately no apply_streak_bump, happiness, Lucky Pig, or season XP.
		-- Automatic tickles are real standings play and normal Snouts, but the
		-- personal-engagement Streak remains manual-only.
		UPDATE public.profiles
		SET counter = counter + spent,
			tickles_earned = tickles_earned + spent
		WHERE id = p_user_id;

		INSERT INTO public.contraption_service_events (
			user_id, contraption_id, kind, amount, metadata
		) VALUES (
			p_user_id, 'auto_tickler', 'auto_tickles', spent,
			jsonb_build_object('reserve', reserve_val, 'cap', cap_val)
		);
	END IF;

	UPDATE public.user_contraptions
	SET last_processed_at = now(), updated_at = now()
	WHERE user_id = p_user_id AND contraption_id = 'auto_tickler';

	RETURN spent;
END;
$function$;

REVOKE ALL ON FUNCTION public._process_auto_tickler_user(uuid)
	FROM PUBLIC, anon, authenticated;

-- ── 8. The Field Guide learns the Pen ────────────────────────────────────────
-- Carried from the LATEST definition (20260917170000_ghost_sheep_trader.sql);
-- the only change is the one id.
CREATE OR REPLACE FUNCTION public.unlock_field_guide_page(p_page text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN; -- unauthenticated: silent no-op
	END IF;
	IF p_page NOT IN (
		'truffle', 'golden_truffle', 'lucky_number', 'trough',
		'mud_wrap', 'rituals', 'snouts', 'exchange', 'feeding_windows',
		'satchel', 'trader', 'pen'
	) THEN
		RAISE EXCEPTION 'unknown field guide page: %', p_page
			USING ERRCODE = 'check_violation';
	END IF;
	INSERT INTO public.field_guide_pages (user_id, page_id)
		VALUES (auth.uid(), p_page)
		ON CONFLICT (user_id, page_id) DO NOTHING;
END;
$function$;
REVOKE ALL ON FUNCTION public.unlock_field_guide_page(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlock_field_guide_page(text) TO authenticated;

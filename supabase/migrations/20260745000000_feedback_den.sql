-- ════════════════════════════════════════════════════════════════════════
-- The Den — player feedback & ideas, archived by the founder.
--
-- Players whisper structured feedback (an idea / something's broken / a love
-- note) tied to their username; the founder archives it ("folds it into the
-- Den") off a pull script. Two submission doors:
--
--   • IN-APP   — submit_feedback() (authenticated; username snapshot from
--                profiles; source 'app'; 3-per-UTC-day cozy rate limit).
--   • WEB      — submit_feedback_web() (anon OR authenticated; free-text name
--                clamped, defaulting to 'a passing pig'; source 'web';
--                20-per-rolling-hour global cap; honeypot for bots).
--
-- The founder's archive script pulls with feedback_dump() (secret-gated) and
-- marks rows 'seen'/'folded' with feedback_mark().
--
-- USERNAME SNAPSHOT: username is captured at submit time, NOT a live FK — a
-- later profile rename must NOT rewrite the history the founder reads back.
--
-- NO announcements, NO pushes: a whisper is quiet by design.
--
-- RPC-ONLY TABLE (the codes-table idiom): RLS on with ZERO policies means
-- direct PostgREST access is fully denied; every read/write flows through the
-- SECURITY DEFINER RPCs below.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Table — feedback (RPC-only, RLS with zero policies) ───────────────────
CREATE TABLE IF NOT EXISTS public.feedback (
	id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
	-- null user_id = a web/anon submission (no account behind it).
	user_id    uuid,
	-- SNAPSHOT at submit time (never an FK): app = the caller's profile
	-- username; web = the trimmed/clamped free-text name or 'a passing pig'.
	username   text        NOT NULL,
	kind       text        NOT NULL CHECK (kind IN ('idea', 'bug', 'love')),
	body       text        NOT NULL CHECK (char_length(body) BETWEEN 3 AND 1000),
	source     text        NOT NULL CHECK (source IN ('app', 'web')),
	status     text        NOT NULL DEFAULT 'new'
		CHECK (status IN ('new', 'seen', 'folded')),
	created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
-- Deliberately zero policies — RPC-only access.

-- ── 2. submit_feedback — the in-app door (authenticated) ─────────────────────
-- Validates kind/body against the SAME checks the table enforces (returning a
-- named-reason envelope rather than letting the CHECK raise), rate-limits to
-- 3 per caller per UTC day (the cozy 'resting' refusal), snapshots the caller's
-- username from profiles, inserts source 'app'. NEVER raises — every refusal is
-- a { ok:false, reason } envelope so the client fail-softs.
CREATE OR REPLACE FUNCTION public.submit_feedback(p_kind text, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	body      text := p_body;
	today_n   int;
	snap_name text;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	IF p_kind IS NULL OR p_kind NOT IN ('idea', 'bug', 'love') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_kind');
	END IF;
	IF body IS NULL OR char_length(body) < 3 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_short');
	END IF;
	IF char_length(body) > 1000 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_long');
	END IF;
	-- 3 whispers per caller per UTC day — the den's ears fill up.
	SELECT count(*) INTO today_n FROM public.feedback
		WHERE user_id = caller_id
		  AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
	IF today_n >= 3 THEN RETURN jsonb_build_object('ok', false, 'reason', 'resting'); END IF;

	SELECT username INTO snap_name FROM public.profiles WHERE id = caller_id;

	INSERT INTO public.feedback (user_id, username, kind, body, source)
		VALUES (caller_id, COALESCE(snap_name, 'a passing pig'), p_kind, body, 'app');

	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 3. submit_feedback_web — the website door (anon OR authenticated) ────────
-- Honeypot (p_honey): a filled honeypot means a bot — we LIE with a silent
-- { ok:true } and insert nothing. Global cap of 20 web submissions per rolling
-- hour ('resting'). p_name is trimmed + clamped to 24 chars; empty → 'a
-- passing pig'. Always source 'web', user_id null (no account behind a web whisper).
CREATE OR REPLACE FUNCTION public.submit_feedback_web(
	p_kind text, p_body text, p_name text, p_honey text DEFAULT ''
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	body      text := p_body;
	snap_name text;
	web_n     int;
BEGIN
	-- Honeypot: a bot filled the hidden field. Lie — pretend success, insert nothing.
	IF COALESCE(p_honey, '') <> '' THEN RETURN jsonb_build_object('ok', true); END IF;

	IF p_kind IS NULL OR p_kind NOT IN ('idea', 'bug', 'love') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_kind');
	END IF;
	IF body IS NULL OR char_length(body) < 3 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_short');
	END IF;
	IF char_length(body) > 1000 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'too_long');
	END IF;
	-- Global cap: 20 web submissions per rolling hour (blunt anti-flood; the
	-- honeypot handles the honest bots, this handles the volume).
	SELECT count(*) INTO web_n FROM public.feedback
		WHERE source = 'web' AND created_at >= now() - interval '1 hour';
	IF web_n >= 20 THEN RETURN jsonb_build_object('ok', false, 'reason', 'resting'); END IF;

	snap_name := left(trim(COALESCE(p_name, '')), 24);
	IF snap_name = '' THEN snap_name := 'a passing pig'; END IF;

	INSERT INTO public.feedback (user_id, username, kind, body, source)
		VALUES (NULL, snap_name, p_kind, body, 'web');

	RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ── 4. app_settings seed — the founder's pull secret ─────────────────────────
-- REPO-VISIBLE PULL SECRET (threat-model-acceptable): this literal lives in the
-- migration on purpose. feedback_dump()/feedback_mark() are the ONLY readers of
-- the feedback table, and the worst a leaked secret buys is read + status-mark
-- of feedback rows (no PII beyond a self-chosen username, no writes to the
-- feedback body). It gates the founder's archive script, not a user surface.
-- ROTATE with a single UPDATE:
--   UPDATE public.app_settings SET value = to_jsonb('den-<new hex>'::text)
--     WHERE key = 'feedback_dump_secret';
INSERT INTO public.app_settings (key, value, description)
VALUES (
	'feedback_dump_secret',
	to_jsonb('den-0ce9a84f7ef87f9cd2267bcd'::text),
	'Repo-visible pull secret for the founder''s Den archive script (rotatable via one UPDATE).'
)
ON CONFLICT (key) DO NOTHING;

-- ── 5. feedback_dump — the founder's archive pull (secret-gated) ─────────────
-- Wrong/missing secret → { ok:false } (no leak of whether the key exists).
-- Correct → { ok:true, rows:[...] } ordered created_at asc (oldest first, so an
-- append-only archive stays chronological).
CREATE OR REPLACE FUNCTION public.feedback_dump(p_secret text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	real_secret text;
	rows        jsonb;
BEGIN
	SELECT value #>> '{}' INTO real_secret FROM public.app_settings WHERE key = 'feedback_dump_secret';
	IF real_secret IS NULL OR p_secret IS NULL OR p_secret <> real_secret THEN
		RETURN jsonb_build_object('ok', false);
	END IF;

	SELECT COALESCE(jsonb_agg(jsonb_build_object(
			'id', id, 'username', username, 'kind', kind, 'body', body,
			'source', source, 'status', status, 'created_at', created_at
		) ORDER BY created_at ASC), '[]'::jsonb) INTO rows
		FROM public.feedback;

	RETURN jsonb_build_object('ok', true, 'rows', rows);
END;
$function$;

-- ── 6. feedback_mark — archive-and-mark (same secret gate) ───────────────────
-- After pulling, the founder's script marks rows 'seen' (skimmed) / 'folded'
-- (archived into the Den). Same secret gate as the dump.
CREATE OR REPLACE FUNCTION public.feedback_mark(p_secret text, p_ids uuid[], p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	real_secret text;
	n           int;
BEGIN
	SELECT value #>> '{}' INTO real_secret FROM public.app_settings WHERE key = 'feedback_dump_secret';
	IF real_secret IS NULL OR p_secret IS NULL OR p_secret <> real_secret THEN
		RETURN jsonb_build_object('ok', false);
	END IF;
	IF p_status IS NULL OR p_status NOT IN ('new', 'seen', 'folded') THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_status');
	END IF;

	WITH upd AS (
		UPDATE public.feedback SET status = p_status
			WHERE id = ANY(COALESCE(p_ids, '{}'::uuid[]))
			RETURNING 1
	)
	SELECT count(*) INTO n FROM upd;

	RETURN jsonb_build_object('ok', true, 'marked', n);
END;
$function$;

-- ── 7. Grants — REVOKE from PUBLIC everywhere, then grant exactly as stated ──
REVOKE ALL ON FUNCTION public.submit_feedback(text, text)                 FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_feedback_web(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feedback_dump(text)                         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.feedback_mark(text, uuid[], text)           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.submit_feedback(text, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback_web(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feedback_dump(text)                         TO anon;
GRANT EXECUTE ON FUNCTION public.feedback_mark(text, uuid[], text)           TO anon;

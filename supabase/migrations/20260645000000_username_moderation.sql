-- Username moderation: server-side enforcement of the banned/reserved
-- name policy. Authoritative copy of the policy in
-- constants/bannedWords.ts — keep the two curations in sync (Tier 1
-- substrings must match exactly; Tier 2 / reserved may drift slightly).
--
-- Policy: normalize (NFKC → lowercase → leet-map → strip everything
-- outside [a-z0-9]), then:
--   1. Tier 1 (substrings) — banned wherever they appear. Only strings
--      with no real innocent superstring belong here.
--   2. Tier 2 (exact) — banned only as the WHOLE normalized name.
--      Too short or too embeddable to scan as substrings ("cunt" ⊂
--      scunthorpe, "rapist" ⊂ therapist, "pedo" ⊂ torpedo, "ass" ⊂
--      bassman/classic, "cock" ⊂ hancock, "sex" ⊂ sussex, "shit" ⊂
--      matsushita, "cum" ⊂ cucumber...).
--   3. Reserved — names the barn itself owns. Exact match only.
--
-- Enforced by a BEFORE INSERT OR UPDATE OF username trigger that fires
-- only when the username actually changes, raising
-- 'username_not_allowed' (the exact token UsernameSetup.tsx maps to
-- player-facing copy). handle_new_user inserts username NULL, so
-- signup never trips it; existing rows are untouched because unchanged
-- usernames short-circuit on IS DISTINCT FROM.

-- ── policy check ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_username_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
	-- Tier 1: banned anywhere in the normalized name. Must match
	-- BANNED_SUBSTRINGS in constants/bannedWords.ts.
	v_banned_substrings text[] := ARRAY[
		'nigger', 'nigga', 'faggot', 'kike', 'chink', 'wetback',
		'beaner', 'tranny', 'whore', 'slut', 'bitch', 'fucker',
		'fucking', 'motherfuck', 'cocksuck', 'dickhead', 'asshole',
		'pedophile', 'paedo', 'childporn', 'hitler', 'nazi',
		'kukluxklan', 'lynchnig', 'goatfuck', 'pigfuck'
	];
	-- Tier 2: banned only as the whole normalized name.
	v_banned_exact text[] := ARRAY[
		'fuck', 'shit', 'piss', 'cock', 'dick', 'twat', 'cunt',
		'rapist', 'pedo', 'loli', 'clit', 'fag', 'ass', 'arse',
		'anus', 'sex', 'cum', 'jizz', 'tit', 'tits', 'hoe', 'rape',
		'spic', 'kys', 'porn', 'penis', 'vagina', 'boobs', 'nude',
		'nudes', 'hooker', 'prostitute'
	];
	-- Reserved: the barn owns these. Exact match only.
	v_reserved text[] := ARRAY[
		'rosie', 'admin', 'administrator', 'mod', 'moderator',
		'system', 'support', 'staff', 'official', 'owner', 'dev',
		'developer', 'gamemaster', 'ticklethepig', 'ttp'
	];
	v_norm text;
	v_word text;
BEGIN
	IF p_name IS NULL THEN
		RETURN true;
	END IF;

	-- NFKC folds fullwidth lookalikes (ｆｕｃｋ→fuck, １→1) before the
	-- leet map. Leet map mirrors LEET_MAP in constants/bannedWords.ts:
	-- 0→o 1→i 3→e 4→a 5→s 7→t 8→b $→s @→a !→i +→t.
	v_norm := lower(normalize(p_name, NFKC));
	v_norm := translate(v_norm, '0134578$@!+', 'oieastbsait');
	v_norm := regexp_replace(v_norm, '[^a-z0-9]', '', 'g');

	FOREACH v_word IN ARRAY v_banned_substrings LOOP
		IF position(v_word IN v_norm) > 0 THEN
			RETURN false;
		END IF;
	END LOOP;

	IF v_norm = ANY(v_banned_exact) OR v_norm = ANY(v_reserved) THEN
		RETURN false;
	END IF;

	RETURN true;
END;
$function$;

-- Trigger execution doesn't strictly need this (privilege is checked
-- against the function the trigger calls as the operating role, and
-- PUBLIC keeps default EXECUTE), but the explicit grant is cheap
-- insurance against revoked default privileges and lets the client
-- call it directly someday.
GRANT EXECUTE ON FUNCTION public.is_username_allowed(text) TO authenticated;

-- ── enforcement trigger ─────────────────────────────────────────────
-- Fires only on actual username change. OLD is referenced only behind
-- the TG_OP = 'INSERT' short-circuit — same pattern as the in-prod
-- profiles_assign_discriminator (20260520000000). Alphabetical BEFORE
-- ordering runs profiles_assign_discriminator first; a RAISE here
-- aborts the whole statement atomically, discriminator included.
CREATE OR REPLACE FUNCTION public.profiles_enforce_username_moderation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	IF NEW.username IS NOT NULL
		AND (TG_OP = 'INSERT' OR NEW.username IS DISTINCT FROM OLD.username)
		AND NOT public.is_username_allowed(NEW.username)
	THEN
		-- Exact token UsernameSetup.tsx matches on (message.includes).
		RAISE EXCEPTION 'username_not_allowed';
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS profiles_enforce_username_moderation ON public.profiles;
CREATE TRIGGER profiles_enforce_username_moderation
	BEFORE INSERT OR UPDATE OF username ON public.profiles
	FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_username_moderation();

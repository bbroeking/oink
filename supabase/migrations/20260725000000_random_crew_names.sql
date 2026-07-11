-- ═══════════════════════════════════════════════════════════════════════════
-- RANDOM SOUNDER NAMES AT CREATION — server-authoritative, so it applies to the
-- ALREADY-LIVE build (which passes a user-typed name) without shipping a binary.
--
-- Decision 2026-07-10 (founder): every new Sounder is born with a random fun
-- name; the leader renames later (rename_crew, 20260723 — its UI ships with the
-- 1.1 build in review). create_crew now IGNORES p_name and always assigns a
-- server-generated name. p_name stays in the signature for backward-compat
-- (old + new clients call create_crew(p_name) unchanged; the arg is simply
-- dropped). The 1.1 found-form name input becomes vestigial → remove in 1.2.
--
-- Pools MIRROR utils/crewNames.ts EXACTLY (12 adj × 12 noun, "The {adj} {noun}",
-- drop "The " if > 24 chars). No uniqueness constraint on crew name (parity with
-- the client generator); collisions are fine — rename differentiates.
--
-- FOOTGUN honored: carry-latest-def — create_crew carried VERBATIM from
-- 20260706600000_one_sounder_invariant.sql (auth check, one-Sounder guard,
-- moot-pending-invites), with ONLY the name source swapped to random_crew_name()
-- and the now-dead p_name length validation removed.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Server-side random name generator (mirror of utils/crewNames.ts) ──────────
CREATE OR REPLACE FUNCTION public.random_crew_name()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
	WITH pick AS (
		SELECT
			(ARRAY['Muddy','Velvet','Truffle','Puddle','Acorn','Snuffling',
			       'Rooting','Cozy','Thundering','Bramble','Clover','Dozy']
			)[(floor(random() * 12) + 1)::int] AS adj,
			(ARRAY['Snouts','Hooves','Rooters','Diggers','Rascals','Barons',
			       'Puddlers','Sniffers','Trotters','Wallowers','Scoundrels','Herd']
			)[(floor(random() * 12) + 1)::int] AS noun
	)
	SELECT CASE
		WHEN char_length('The ' || adj || ' ' || noun) > 24 THEN adj || ' ' || noun
		ELSE 'The ' || adj || ' ' || noun
	END
	FROM pick;
$function$;
REVOKE ALL ON FUNCTION public.random_crew_name() FROM PUBLIC, anon;
-- create_crew is SECURITY DEFINER (runs as owner), so it calls this regardless;
-- no direct grant to authenticated needed.

-- ── create_crew — carried from 20260706600000; name source → random ───────────
CREATE OR REPLACE FUNCTION public.create_crew(p_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	caller_id uuid := auth.uid();
	new_name  text := public.random_crew_name();
	new_id    uuid;
BEGIN
	IF caller_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated'); END IF;
	-- p_name is intentionally ignored — names are server-random at birth.
	IF EXISTS (SELECT 1 FROM public.crew_members WHERE user_id = caller_id) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_in_crew');
	END IF;
	INSERT INTO public.crews (name, leader_id, is_bot) VALUES (new_name, caller_id, false)
		RETURNING id INTO new_id;
	INSERT INTO public.crew_members (crew_id, user_id, role) VALUES (new_id, caller_id, 'leader');
	-- CARRY DIFF: founding moots the founder's pending invites (mirrors
	-- accept_crew_invite / join_crew) — one Sounder at a time, no stale asks.
	UPDATE public.crew_invites SET status = 'declined'
		WHERE invitee_id = caller_id AND status = 'pending';
	-- Return the assigned name so newer clients can show it immediately.
	RETURN jsonb_build_object('ok', true, 'crew_id', new_id, 'name', new_name);
END;
$function$;

-- ── One-time: reroll EVERY existing (non-bot) Sounder to a random name ────────
-- Founder ask 2026-07-10: existing Sounders join the random-name world too, so
-- naming is uniform (random at birth, rename later). random_crew_name() is
-- VOLATILE, so it's evaluated PER ROW here → each crew gets its own name, not
-- one shared name. Bot/seed crews are left alone (they don't rank and may carry
-- meaningful fixture names). This runs once (migration is applied once).
UPDATE public.crews SET name = public.random_crew_name()
	WHERE COALESCE(is_bot, false) = false;

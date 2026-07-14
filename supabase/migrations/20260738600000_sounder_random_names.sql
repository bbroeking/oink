-- ═══════════════════════════════════════════════════════════════════════════
-- NO-NAME FOUNDING — a Sounder is born with a random name; the leader never
-- types one at creation (rename_crew, 20260723, stays the only way to change it
-- later). This is server-authoritative continuation of 20260725000000: that
-- migration already made create_crew IGNORE p_name and assign a random name, so
-- the live build's name input was already vestigial. Here we (a) widen the name
-- pools (16 adj × 12 noun ≈ 192 combos, so collisions stay rare enough that the
-- no-unique-constraint parity holds) and (b) ship the client that drops the
-- input entirely (1.2). p_name stays in the signature for backward-compat — old
-- and new clients call create_crew(p_name)/create_crew(null) unchanged.
--
-- Pools MIRROR utils/crewNames.ts EXACTLY ("The {adj} {noun}", drop "The " if
-- > 24 chars). NO uniqueness constraint on crew name (checked crews in 20260647
-- — plain text column, no unique index); collisions are fine, rename sorts it.
--
-- FOOTGUN honored: carry-latest-def — create_crew carried VERBATIM from
-- 20260725000000_random_crew_names.sql (auth check, one-Sounder guard, random
-- name, moot-pending-invites, name-in-envelope), with ONLY random_crew_name()'s
-- pools widened. No send_system_announcement() call (none in the base).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Server-side random name generator (widened; mirror of utils/crewNames.ts) ─
CREATE OR REPLACE FUNCTION public.random_crew_name()
RETURNS text LANGUAGE sql VOLATILE
AS $function$
	WITH pick AS (
		SELECT
			(ARRAY['Muddy','Velvet','Truffle','Puddle','Acorn','Snuffling',
			       'Rooting','Cozy','Thundering','Bramble','Clover','Dozy',
			       'Snouty','Wallowing','Bristle','Marsh']
			)[(floor(random() * 16) + 1)::int] AS adj,
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

-- ── create_crew — carried VERBATIM from 20260725000000; name stays random ─────
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

-- create_crew's GRANT is unchanged from 20260647000000 (EXECUTE to authenticated);
-- CREATE OR REPLACE preserves it, so no re-grant needed.

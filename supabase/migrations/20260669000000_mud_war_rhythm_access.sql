-- Phase 1d (P5) — SONGS OF THE BOG access fuel. HELD FOR REVIEW; push only on go.
--
-- The "send tickles / visit a teammate's barn to give them the opportunity to play"
-- lever. When a crewmate visits your barn DURING an active rhythm war, you (the host)
-- are minted ONE access token = one extra Hold-day rhythm run (roster relief: a
-- short-handed crew can cover a third area). This is the ONLY place tickles/barns
-- touch the war.
--
-- NORMALIZATION (Pillar 3, sim-locked): grant_war_access (20260668) caps it at
-- ATTEMPT_TOKEN_CAP=1 per recipient per UTC day and re-checks crew membership, so VIP
-- tickle-wealth and alt-ring barn-visiting net AT MOST one token/day for a real crew
-- member — it buys an EXTRA ATTEMPT (roster coverage), never a per-hit power-up, and the
-- run it enables scores the SUBMITTED song, not best-of-N.
--
-- FLAG-SAFE OFF-PATH: the hook only fires for mw.rhythm_enabled = true active wars. With
-- mud_rhythm_on() = false there are no rhythm wars, so the SELECT finds nothing and the
-- trigger is a pure no-op on every barn visit — byte-identical to today's barn flow.
--
-- DEFERRED (still): the cosmetic per-area snout_coffer (the "stolen snouts" flourish) is
-- pure juice, firewalled from the rope, and is rendered client-side for v1 — not persisted
-- here. Add it only if a server-authoritative coffer is wanted later.

CREATE OR REPLACE FUNCTION public.mint_war_access_on_visit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
	w_id uuid;
BEGIN
	-- A barn visit between two DISTINCT members of the SAME crew that's in an active
	-- RHYTHM war grants the HOST (NEW.target_id) an access token — the visitor is "giving
	-- the opportunity to play." (Self-visits and cross-crew visits mint nothing.)
	IF NEW.visitor_id = NEW.target_id THEN RETURN NEW; END IF;

	SELECT mw.id INTO w_id
	FROM public.mud_wars mw
	JOIN public.crew_members cm_h ON cm_h.user_id = NEW.target_id
		AND cm_h.crew_id IN (mw.challenger_crew, mw.defender_crew)
	JOIN public.crew_members cm_v ON cm_v.user_id = NEW.visitor_id
		AND cm_v.crew_id = cm_h.crew_id            -- visitor must be on the host's crew
	WHERE mw.status = 'active' AND mw.rhythm_enabled = true
	LIMIT 1;

	IF w_id IS NOT NULL THEN
		-- grant_war_access enforces the 1/recipient/day cap + crew-membership re-check.
		-- Wrapped so access-minting can NEVER break the barn visit itself.
		BEGIN
			PERFORM public.grant_war_access(w_id, NEW.target_id);
		EXCEPTION WHEN OTHERS THEN NULL;
		END;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_mint_war_access ON public.barn_visits;
CREATE TRIGGER trg_mint_war_access AFTER INSERT ON public.barn_visits
	FOR EACH ROW EXECUTE FUNCTION public.mint_war_access_on_visit();

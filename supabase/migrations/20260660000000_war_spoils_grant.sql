-- War Spoils (P1): mud-war winners now actually RECEIVE a war-exclusive cosmetic.
--
-- (1) Mark the 25 mud-war cosmetics war_exclusive (they were plain cost=0 catalog
--     rows; cost=0 also tags season-pass exclusives, so a dedicated flag is needed).
-- (2) An AFTER-UPDATE trigger on mud_wars grants each CONTRIBUTING member of the
--     winning crew ONE random unowned war cosmetic when a war resolves. Decoupled
--     from resolve_war (no rewrite of that large fn). The memberless bot crew has
--     no contributors so a bot "win" grants nothing, and the 5-day war cadence
--     caps the rate — no fast farm. Idempotent: resolve_war flips status→resolved
--     exactly once (resolved_at guard), and ON CONFLICT/unowned-filter dedupe.

ALTER TABLE public.hats ADD COLUMN IF NOT EXISTS war_exclusive boolean NOT NULL DEFAULT false;

UPDATE public.hats SET war_exclusive = true WHERE id IN (
	'muddy_cap','slop_bucket_hat','reed_hat','bog_helmet','swamp_crown',
	'slop_bucket','mud_shovel','mud_pie','golden_truffle','crew_pennant',
	'mud_splatter_aura','swamp_bubble_aura','firefly_aura','golden_bog_aura','heirloom_mire_aura',
	'mud_pit_bg','reed_marsh_bg','mud_derby_bg','bog_dusk_bg','golden_mire_bg','festival_night_bg',
	'rosette_cap','prize_sash','festival_pennant','confetti_aura'
);

CREATE OR REPLACE FUNCTION public.grant_war_spoils_on_resolve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	m    record;
	pick text;
BEGIN
	-- Fire once, only on the transition into 'resolved' with a real winning crew.
	IF NEW.status = 'resolved'
	   AND COALESCE(OLD.status, '') <> 'resolved'
	   AND NEW.winner_crew IS NOT NULL
	THEN
		FOR m IN
			SELECT s.user_id
			FROM public.mud_slings s
			WHERE s.war_id = NEW.id AND s.crew_id = NEW.winner_crew
			GROUP BY s.user_id
			HAVING SUM(s.slings) > 0   -- contributed at least one sling
		LOOP
			-- one random war cosmetic the winner doesn't own yet
			SELECT h.id INTO pick
			FROM public.hats h
			WHERE h.war_exclusive = true
			  AND NOT EXISTS (
				SELECT 1 FROM public.user_hats uh
				WHERE uh.user_id = m.user_id AND uh.hat_id = h.id
			  )
			ORDER BY random()
			LIMIT 1;

			IF pick IS NOT NULL THEN
				INSERT INTO public.user_hats (user_id, hat_id)
					VALUES (m.user_id, pick)
					ON CONFLICT (user_id, hat_id) DO NOTHING;
				-- Gift-framed announcement — inline INSERT (never the admin-gated
				-- send_system_announcement wrapper), guarded so an announce failure
				-- can't undo the grant.
				BEGIN
					INSERT INTO public.system_announcements (user_id, kind, title, body, data)
					VALUES (
						m.user_id, 'war_spoils', 'War Spoils! 🏆',
						'Your Sounder won the mud war — you snagged a war-exclusive cosmetic.',
						jsonb_build_object('hat_id', pick, 'war_id', NEW.id)
					);
				EXCEPTION WHEN OTHERS THEN NULL;
				END;
			END IF;
		END LOOP;
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_grant_war_spoils ON public.mud_wars;
CREATE TRIGGER trg_grant_war_spoils
	AFTER UPDATE OF status ON public.mud_wars
	FOR EACH ROW
	EXECUTE FUNCTION public.grant_war_spoils_on_resolve();

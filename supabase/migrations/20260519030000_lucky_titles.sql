-- Lucky-pig title drops.
--
-- When a lucky pig fires (5% client-rolled trigger), the client also
-- rolls a 20% chance to unlock a random Eastern-European-folklore
-- lucky title the user doesn't yet own. These titles are exclusive to
-- the lucky drop — not purchasable, not battle-pass.
--
-- Schema:
--   titles.source = 'battle_pass' | 'shop' | 'lucky'  (NULL = legacy)
--
-- RPC `unlock_random_lucky_title()` does the pick + insert atomically
-- and returns the title it granted (or null if the user owns them all).

ALTER TABLE public.titles
	ADD COLUMN IF NOT EXISTS source text
		CHECK (source IN ('battle_pass', 'shop', 'lucky'));

-- Backfill: titles seeded by 20260511 are battle-pass titles; titles
-- with for_sale=true (20260519010000) are shop titles.
UPDATE public.titles SET source = 'shop'
	WHERE for_sale = true AND source IS NULL;
UPDATE public.titles SET source = 'battle_pass'
	WHERE source IS NULL;

-- ── seed the lucky-drop titles ────────────────────────────────────
-- Names lifted from German / Slavic / Romanian lucky-pig folklore:
--   Glücksschwein / Schwein gehabt — German idiom + new-year tradition
--   Silvester Sow                  — German New Year's Eve (Silvester)
--   Klee-Schwein                   — pig + four-leaf clover charm
--   Marzipan Heir                  — marzipan-pig gift tradition
--   Szerencsemalac                 — Hungarian "lucky pig"
--   Šťastné Prase                  — Czech "lucky pig"
--   Skarbonka                      — Polish piggy bank
--   Forward-Rooter                 — pigs root forward → good omen
--   Fortuna's Hog                  — Roman goddess of fortune + pig
INSERT INTO public.titles
	(id, name, placement, description, source, for_sale, display_order)
VALUES
	('gluecksschwein',  'Glücksschwein',   'pre',  'German "lucky pig" — bringer of new-year fortune.',    'lucky', false, 100),
	('schwein_gehabt',  'Schwein gehabt',  'post', 'German for "had a pig" — i.e., got lucky.',            'lucky', false, 101),
	('silvester_sow',   'Silvester Sow',   'pre',  'Marzipan-shaped gift for the new year.',               'lucky', false, 102),
	('klee_schwein',    'Klee-Schwein',    'pre',  'Pig and clover. Doubly lucky.',                        'lucky', false, 103),
	('marzipan_heir',   'Marzipan Heir',   'pre',  'A century of sugar pigs, all yours.',                  'lucky', false, 104),
	('szerencsemalac',  'Szerencsemalac',  'pre',  'Hungarian for "lucky pig".',                           'lucky', false, 105),
	('stastne_prase',   'Šťastné Prase',   'pre',  'Czech for "lucky pig" — eats forward, never back.',    'lucky', false, 106),
	('skarbonka',       'Skarbonka',       'pre',  'Polish piggy bank — keeper of coins.',                 'lucky', false, 107),
	('forward_rooter',  'Forward-Rooter',  'post', 'Pigs root forward; the year follows.',                 'lucky', false, 108),
	('fortunas_hog',    'Fortuna''s Hog',  'pre',  'Roman goddess of fortune, in pig form.',               'lucky', false, 109)
ON CONFLICT (id) DO NOTHING;

-- ── unlock_random_lucky_title() RPC ───────────────────────────────
-- Picks a random lucky title the caller doesn't yet own and grants
-- it. Returns the granted title or null if the user owns them all.
CREATE OR REPLACE FUNCTION public.unlock_random_lucky_title()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	chosen    record;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	-- Pick uniformly random over lucky titles the caller doesn't own.
	SELECT t.id, t.name, t.placement, t.description
		INTO chosen
		FROM public.titles t
		WHERE t.source = 'lucky'
		  AND NOT EXISTS (
			SELECT 1 FROM public.user_titles ut
			WHERE ut.user_id = caller_id AND ut.title_id = t.id
		  )
		ORDER BY random()
		LIMIT 1;

	-- All lucky titles already owned — return ok=true, granted=null.
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', true, 'granted', null);
	END IF;

	INSERT INTO public.user_titles (user_id, title_id)
		VALUES (caller_id, chosen.id)
		ON CONFLICT (user_id, title_id) DO NOTHING;

	RETURN jsonb_build_object(
		'ok', true,
		'granted', jsonb_build_object(
			'id',          chosen.id,
			'name',        chosen.name,
			'placement',   chosen.placement,
			'description', chosen.description
		)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.unlock_random_lucky_title() TO authenticated;

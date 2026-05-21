-- Phase 4 of Season 1: Judgement Day — the season finale.
--
-- finalize_season() is the climactic admin/cron RPC: it ranks every
-- user by alignment, grants tiered rewards (top 3 / top 10 / all
-- participants / neutral), records the outcome in season_finales,
-- then resets every user's alignment_score to 0 for Season 2.
--
-- my_finale_result() lets the client show a user their verdict in
-- the JudgementDayModal after the season is finalized.

-- Extend the titles source CHECK to allow finale ('season') titles.
ALTER TABLE public.titles DROP CONSTRAINT IF EXISTS titles_source_check;
ALTER TABLE public.titles
	ADD CONSTRAINT titles_source_check
	CHECK (source IS NULL OR source IN
		('battle_pass', 'shop', 'lucky', 'sounder', 'achievement', 'season'));

INSERT INTO public.titles (id, name, placement, description, source, for_sale, display_order)
VALUES
	('halo_bearer_2026',  'Halo Bearer 2026',  'pre',  'Top 3 most generous, Season 1.',   'season', false, 400),
	('goblin_king_2026',  'Goblin King 2026',  'pre',  'Top 3 most greedy, Season 1.',     'season', false, 401),
	('gilded_2026',       'Gilded',            'pre',  'Top 10 of a side, Season 1.',      'season', false, 402),
	('schism_survivor',   'Schism Survivor',   'post', 'Picked a side in Season 1.',       'season', false, 403),
	('calm_in_the_storm', 'Calm in the Storm', 'post', 'Stayed Neutral all of Season 1.',  'season', false, 404)
ON CONFLICT (id) DO NOTHING;

-- Per-user finale record. season_key is a free-text label (e.g.
-- 'season_1') so re-running finalize_season for the same key is a
-- no-op via the unique (user_id, season_key).
CREATE TABLE IF NOT EXISTS public.season_finales (
	user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	season_key  text        NOT NULL,
	final_score int         NOT NULL,
	side        text        NOT NULL,   -- 'generous' | 'greedy' | 'neutral'
	side_rank   int,                    -- rank within side (NULL for neutral)
	bracket     text        NOT NULL,   -- 'top3' | 'top10' | 'participant' | 'neutral'
	title_id    text        REFERENCES public.titles(id) ON DELETE SET NULL,
	snouts      int         NOT NULL DEFAULT 0,
	finalized_at timestamptz NOT NULL DEFAULT now(),
	seen_at     timestamptz,
	PRIMARY KEY (user_id, season_key)
);

ALTER TABLE public.season_finales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own finale" ON public.season_finales;
CREATE POLICY "View own finale"
	ON public.season_finales FOR SELECT
	USING (auth.uid() = user_id);

-- ── finalize_season: rank everyone, grant rewards, reset alignment.
-- Idempotent per season_key (ON CONFLICT DO NOTHING on the insert).
-- SECURITY DEFINER but gated to service_role / explicit call — not
-- granted to authenticated, so a normal client can't trigger it.
CREATE OR REPLACE FUNCTION public.finalize_season(season_key text DEFAULT 'season_1')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	r            record;
	bracket      text;
	title_id     text;
	snouts       int;
	granted      int := 0;
BEGIN
	FOR r IN
		SELECT
			p.id,
			p.alignment_score AS score,
			CASE
				WHEN p.alignment_score >  0 THEN 'generous'
				WHEN p.alignment_score <  0 THEN 'greedy'
				ELSE 'neutral'
			END AS side,
			CASE
				WHEN p.alignment_score > 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score > 0)
						ORDER BY p.alignment_score DESC, p.id)
				WHEN p.alignment_score < 0 THEN
					ROW_NUMBER() OVER (PARTITION BY (p.alignment_score < 0)
						ORDER BY p.alignment_score ASC, p.id)
				ELSE NULL
			END AS side_rank
		FROM public.profiles p
		WHERE p.username IS NOT NULL AND p.username <> ''
	LOOP
		-- Bracket + reward by side_rank.
		IF r.side = 'neutral' THEN
			bracket := 'neutral'; title_id := 'calm_in_the_storm'; snouts := 100;
		ELSIF r.side_rank <= 3 THEN
			bracket := 'top3';
			title_id := CASE r.side WHEN 'generous' THEN 'halo_bearer_2026'
			                        ELSE 'goblin_king_2026' END;
			snouts := 500;
		ELSIF r.side_rank <= 10 THEN
			bracket := 'top10'; title_id := 'gilded_2026'; snouts := 250;
		ELSE
			bracket := 'participant'; title_id := 'schism_survivor'; snouts := 100;
		END IF;

		INSERT INTO public.season_finales
			(user_id, season_key, final_score, side, side_rank, bracket, title_id, snouts)
			VALUES (r.id, season_key, r.score, r.side, r.side_rank, bracket, title_id, snouts)
			ON CONFLICT (user_id, season_key) DO NOTHING;

		IF FOUND THEN
			-- Grant the title + snouts (titles are idempotent on conflict).
			INSERT INTO public.user_titles (user_id, title_id)
				VALUES (r.id, title_id) ON CONFLICT DO NOTHING;
			UPDATE public.profiles SET counter = counter + snouts WHERE id = r.id;
			granted := granted + 1;
		END IF;
	END LOOP;

	-- Wipe the slate for Season 2.
	UPDATE public.profiles
		SET alignment_score = 0, alignment_updated_at = now()
		WHERE alignment_score <> 0;

	RETURN jsonb_build_object('ok', true, 'granted', granted, 'season_key', season_key);
END;
$function$;
-- NOT granted to authenticated — call from SQL console / service role.

-- ── my_finale_result: the JudgementDayModal reads this. Returns the
-- caller's most recent unseen finale, or null.
CREATE OR REPLACE FUNCTION public.my_finale_result()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	f         record;
	t_name    text;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT * INTO f FROM public.season_finales
		WHERE user_id = caller_id AND seen_at IS NULL
		ORDER BY finalized_at DESC LIMIT 1;
	IF f IS NULL THEN
		RETURN jsonb_build_object('pending', false);
	END IF;

	SELECT name INTO t_name FROM public.titles WHERE id = f.title_id;

	RETURN jsonb_build_object(
		'pending',     true,
		'season_key',  f.season_key,
		'final_score', f.final_score,
		'side',        f.side,
		'side_rank',   f.side_rank,
		'bracket',     f.bracket,
		'title_id',    f.title_id,
		'title_name',  t_name,
		'snouts',      f.snouts
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_finale_seen(target_season_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false);
	END IF;
	UPDATE public.season_finales SET seen_at = now()
		WHERE user_id = caller_id AND season_key = target_season_key
		  AND seen_at IS NULL;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.my_finale_result() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_finale_seen(text) TO authenticated;

-- Fix: finalize_season() dies at runtime with 42702 "column reference
-- \"season_key\" is ambiguous" — BEFORE granting anything or wiping alignment.
--
-- Root cause: the function's parameter is named `season_key`, which is also a
-- column of season_finales. plpgsql's default variable_conflict = error makes
-- the conflict target in
--
--     ON CONFLICT (user_id, season_key) DO NOTHING
--
-- a runtime 42702 (the column list of an ON CONFLICT target is parsed with the
-- table's columns in scope, and plpgsql also offers the parameter — genuine
-- ambiguity). Latent since 20260526 and never seen because finalize_season has
-- never executed on prod; the 20260704500000 Judgement-Day cron calls it at
-- 00:00 UTC Jul 13 (8 PM ET Jul 12), so it MUST land before then. Found by the
-- migration harness (db-push-safety pass, 2026-07-03), reproduced twice.
--
-- Fix (same convention as 20260626_fix_trough_fill_ambiguity: carry the latest
-- body VERBATIM, change only the broken reference): name the conflict by its
-- constraint instead of its columns —
--
--     ON CONFLICT ON CONSTRAINT season_finales_pkey DO NOTHING
--
-- season_finales_pkey is the auto-generated name of the table's
-- PRIMARY KEY (user_id, season_key) from 20260526 (verified on the harness).
-- We deliberately do NOT use `#variable_conflict use_column`: it is safe today
-- (verified — the only genuinely ambiguous site is the conflict target; every
-- other collision-named reference sits in VALUES/RETURN clauses with no column
-- scope, and profiles has no `snouts` column), but it would silently flip
-- meaning if a colliding column is ever added later, whereas the default
-- semantics fail loud. Signature unchanged (the cron + 20260579/20260658 call
-- it positionally; my_finale_result/mark_finale_seen untouched).
--
-- Carried from: 20260526000000_finale.sql (the latest and only definition —
-- verified no later redefinition exists).
--
-- Verify after push:
--   SELECT public.finalize_season('season_1_dryrun_probe');  -- on a throwaway
--   key this still writes rows; prefer verifying on the harness instead. The
--   real proof is the Jul 12 cron (or a manual run) completing with
--   {"ok": true, ...}.

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
			ON CONFLICT ON CONSTRAINT season_finales_pkey DO NOTHING;

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
-- NOT granted to authenticated — call from SQL console / service role / the
-- judgement-day cron (20260704500000). CREATE OR REPLACE preserves existing
-- ACLs, so no re-REVOKE is needed; stated for the reviewer.

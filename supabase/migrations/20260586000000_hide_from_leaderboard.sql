-- Hide specific accounts from the public leaderboards without granting them
-- anything. NOTE: is_test is NOT reusable for this — it's overloaded as an
-- admin/owner flag (gates send_system_announcement + admin_tickle_overview),
-- so flipping it on a demo/junk account would hand it admin powers. Hence a
-- dedicated, side-effect-free flag.
--
-- Targets: the App Store reviewer demo account (demo_rosie) + junk usernames
-- that someone signed up with (a pasted "Termos de Serviço" header, a
-- SQL-injection-flavored name, a bare "test").

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS hide_from_leaderboard boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET hide_from_leaderboard = true
FROM (VALUES
	('demo_rosie',              '0001'),
	('# Termos de Serviço do G','4581'),
	('DELETE * FROM *',         '1173'),
	('test',                    '4549')
) AS j(username, discriminator)
WHERE p.username = j.username
  AND p.discriminator = j.discriminator;

-- alignment_leaderboard: exclude hidden accounts from both sides. Signature
-- unchanged, so CREATE OR REPLACE (body mirrors 20260575_leaderboard_flag.sql
-- with the extra hide_from_leaderboard filter).
CREATE OR REPLACE FUNCTION public.alignment_leaderboard(per_side int DEFAULT 20)
RETURNS TABLE (
	user_id         uuid,
	username        text,
	active_hat_id   text,
	active_flag_id  text,
	alignment_score int,
	side            text,
	side_rank       int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'generous'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score DESC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score > 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score DESC, p.id
		LIMIT per_side
	)
	UNION ALL
	(
		SELECT
			p.id, p.username, p.active_hat_id, p.active_flag_id, p.alignment_score,
			'greedy'::text AS side,
			ROW_NUMBER() OVER (ORDER BY p.alignment_score ASC, p.id)::int AS side_rank
		FROM public.profiles p
		WHERE p.alignment_score < 0
		  AND p.username IS NOT NULL AND p.username <> ''
		  AND COALESCE(p.hide_from_leaderboard, false) = false
		ORDER BY p.alignment_score ASC, p.id
		LIMIT per_side
	);
$$;

GRANT EXECUTE ON FUNCTION public.alignment_leaderboard(int) TO authenticated;

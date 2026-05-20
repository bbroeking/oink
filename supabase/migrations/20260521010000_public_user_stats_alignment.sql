-- Extend public_user_stats to include alignment_score + alignment_label.
-- UserSheet shows these as a chip above the existing GIVEN/RECEIVED
-- stats row, surfacing the user's current Season 1 standing.
--
-- DROP + recreate because Postgres won't let CREATE OR REPLACE change
-- the return type signature.

DROP FUNCTION IF EXISTS public.public_user_stats(uuid);

CREATE OR REPLACE FUNCTION public.public_user_stats(target_user_id uuid)
RETURNS TABLE (
	user_id                uuid,
	username               text,
	discriminator          text,
	active_hat_id          text,
	active_title_id        text,
	active_title_name      text,
	active_title_placement text,
	given_total            int,
	received_total         int,
	generous_tier_name     text,
	greedy_tier_name       text,
	friendship_status      text,
	alignment_score        int,
	alignment_label        text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	fs        text;
BEGIN
	IF caller_id IS NULL THEN
		RAISE EXCEPTION 'unauthenticated';
	END IF;

	IF target_user_id = caller_id THEN
		fs := 'self';
	ELSE
		SELECT CASE
			WHEN status = 'accepted' THEN 'friends'
			WHEN status = 'pending' AND requester_id = caller_id THEN 'pending_outgoing'
			WHEN status = 'pending' AND requester_id = target_user_id THEN 'pending_incoming'
		END INTO fs
		FROM public.friendships
		WHERE (requester_id = caller_id    AND receiver_id = target_user_id)
		   OR (requester_id = target_user_id AND receiver_id = caller_id)
		LIMIT 1;
		IF fs IS NULL THEN fs := 'none'; END IF;
	END IF;

	RETURN QUERY
	SELECT
		p.id AS user_id,
		p.username,
		p.discriminator,
		p.active_hat_id,
		t.id   AS active_title_id,
		t.name AS active_title_name,
		t.placement AS active_title_placement,
		public.trade_given_total(p.id)    AS given_total,
		public.trade_received_total(p.id) AS received_total,
		(
			SELECT a.name FROM public.user_achievements ua
				JOIN public.achievements a ON a.id = ua.achievement_id
				WHERE ua.user_id = p.id AND a.category = 'trade_giver'
				ORDER BY a.tier DESC LIMIT 1
		) AS generous_tier_name,
		(
			SELECT a.name FROM public.user_achievements ua
				JOIN public.achievements a ON a.id = ua.achievement_id
				WHERE ua.user_id = p.id AND a.category = 'trade_receiver'
				ORDER BY a.tier DESC LIMIT 1
		) AS greedy_tier_name,
		fs                                       AS friendship_status,
		p.alignment_score                        AS alignment_score,
		public.alignment_label(p.alignment_score) AS alignment_label
	FROM public.profiles p
	LEFT JOIN public.titles t ON t.id = p.active_title_id
	WHERE p.id = target_user_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.public_user_stats(uuid) TO authenticated;

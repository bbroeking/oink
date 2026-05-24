-- Admin RPC for the dev-tools/admin-tickles.html dashboard.
--
-- Returns a per-user tickle/equip/alignment snapshot for everyone
-- in the system. Gated on caller.is_test = true so production
-- users hitting this RPC get a hard refusal (RAISE EXCEPTION
-- bubbles back to the client as a Postgres error code).
--
-- Fields:
--   user_id, username, discriminator
--   tickles_earned  — lifetime, the leaderboard stat
--   balance_raw     — user_items.item_count as stored
--   balance_now     — item_count + regen catch-up (what the user
--                      would see if they opened the app right now)
--   cap             — 25 normal, 50 VIP (matches tickle_info)
--   regen_secs      — current effective interval per the
--                      ritual_effects modifier
--   next_regen_secs — seconds until next tickle regens; NULL at cap
--   alignment_score — signed; positive=angel, negative=goblin
--   active_hat_id, active_hat_name
--   last_increment  — last regen anchor; proxy for "last activity"
--   is_test, created_at

set check_function_bodies = off;

-- DROP first because Postgres won't let CREATE OR REPLACE change the
-- return-type signature in place, and an earlier draft of this file
-- shipped with the wrong column types.
DROP FUNCTION IF EXISTS public.admin_tickle_overview();

CREATE OR REPLACE FUNCTION public.admin_tickle_overview()
RETURNS TABLE (
	user_id          uuid,
	username         text,
	discriminator    text,
	tickles_earned   bigint,
	balance_raw      int,
	balance_now      int,
	cap              int,
	regen_secs       int,
	next_regen_secs  int,
	alignment_score  int,
	active_hat_id    text,
	active_hat_name  text,
	last_increment   timestamp,
	is_test          boolean,
	created_at       timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_is_test boolean;
BEGIN
	SELECT COALESCE(p.is_test, false) INTO caller_is_test
		FROM public.profiles p WHERE p.id = auth.uid();
	IF NOT COALESCE(caller_is_test, false) THEN
		RAISE EXCEPTION 'admin_only';
	END IF;

	RETURN QUERY
	SELECT
		p.id AS user_id,
		p.username,
		p.discriminator,
		p.tickles_earned,
		ui.item_count AS balance_raw,
		LEAST(
			CASE WHEN p.is_vip THEN 50 ELSE 25 END,
			ui.item_count + GREATEST(0, FLOOR(
				EXTRACT(EPOCH FROM (now() - ui.last_increment))
				/ public.regen_secs_for(p.id)
			)::int)
		) AS balance_now,
		(CASE WHEN p.is_vip THEN 50 ELSE 25 END)::int AS cap,
		public.regen_secs_for(p.id)::int AS regen_secs,
		CASE
			WHEN ui.item_count >= (CASE WHEN p.is_vip THEN 50 ELSE 25 END) THEN NULL
			ELSE (
				public.regen_secs_for(p.id)
				- (EXTRACT(EPOCH FROM (now() - ui.last_increment))::int
				   % public.regen_secs_for(p.id))
			)::int
		END AS next_regen_secs,
		p.alignment_score,
		p.active_hat_id,
		h.name AS active_hat_name,
		ui.last_increment,
		COALESCE(p.is_test, false) AS is_test,
		u.created_at
	FROM public.profiles p
	LEFT JOIN public.user_items ui ON ui.user_id = p.id
	LEFT JOIN public.hats h        ON h.id = p.active_hat_id
	LEFT JOIN auth.users u         ON u.id = p.id
	ORDER BY p.tickles_earned DESC NULLS LAST;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_tickle_overview() TO authenticated;

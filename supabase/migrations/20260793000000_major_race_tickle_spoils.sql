-- Make the weekly Dig-Off tickle spoils feel like a real Monday jackpot.
--
-- Early-retention tuning: one week should bank a meaningful runway of play,
-- not merely reimburse a handful of taps. First place is worth twenty normal
-- 25-tickle refills; the participation floor is one full refill. Golden
-- Truffles and the underlying find rate stay unchanged.
-- race_standings() reads this helper when it builds its `prizes` payload, and
-- _race_pay_cycle() reads the same helper when it pays, so display and grants
-- remain server-authoritative and cannot drift.

CREATE OR REPLACE FUNCTION public._race_tickles_for_rank(p_rank int, p_ranked int)
RETURNS int LANGUAGE sql IMMUTABLE
AS $function$
	SELECT CASE
		WHEN p_rank = 1 THEN 500
		WHEN p_rank = 2 THEN 300
		WHEN p_rank = 3 THEN 200
		WHEN p_rank >= 4 AND p_rank <= ceil(p_ranked / 2.0)::int THEN 100
		WHEN p_rank >= 4 THEN 50
		ELSE 25   -- participation floor (rank 0)
	END;
$function$;
REVOKE ALL ON FUNCTION public._race_tickles_for_rank(int, int)
	FROM PUBLIC, anon, authenticated;

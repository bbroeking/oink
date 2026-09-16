-- The Storefront, build 2 (SKILL.md 2026-09-16): "the sounder stands at the
-- counter wearing today's buys". This is the one sounder-scoped "bought today"
-- RPC that ruling asked for.
--
-- sounder_counter_buys() lists what the caller's crewmates (crew_members of
-- the caller's crew, never the friends list — the Sounder is the crew) put on
-- today, in the shop's own UTC day. Each row is one acquisition: who, which
-- pig they run, which item, when. The client resolves the item against the
-- catalog it already holds and shows the friend at the counter; a tap opens
-- the same preview sheet, and buy_hat sells the item exactly as it sells a
-- shelf item — buy_hat never checked daily_shop membership, only price,
-- pass_exclusive, members_only and ownership, so no change there.
--
-- Rules carried from daily_shop(): only priced (cost > 0), non-pass items in a
-- placeable category are shown — a crewmate's pass reward or a scarf is not a
-- thing you can walk up and buy. Members-only items DO show (with their lock
-- for non-members): a crewmate's Slop Club piece is part of why the counter is
-- worth a look. The caller's own buys are excluded — you are not your own
-- neighbour. A friend who bought nothing has no row (never a public zero).
--
-- Migration AUTHORED ONLY — never `db push` autonomously (CLAUDE.md).
CREATE OR REPLACE FUNCTION public.sounder_counter_buys()
RETURNS TABLE (
	user_id     uuid,
	username    text,
	pig_id      text,
	hat_id      text,
	acquired_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT
		uh.user_id,
		p.username,
		p.active_pig_id,
		uh.hat_id,
		uh.acquired_at
	FROM public.crew_members me
	JOIN public.crew_members cm
		ON cm.crew_id = me.crew_id AND cm.user_id <> me.user_id
	JOIN public.user_hats uh ON uh.user_id = cm.user_id
	JOIN public.hats h ON h.id = uh.hat_id
	JOIN public.profiles p ON p.id = cm.user_id
	WHERE me.user_id = auth.uid()
		-- The shop's day is the UTC day (daily_shop hashes current_date).
		AND (uh.acquired_at AT TIME ZONE 'utc')::date = (now() AT TIME ZONE 'utc')::date
		AND h.cost > 0
		AND NOT h.pass_exclusive
		AND h.category NOT IN ('cape', 'flag', 'scarf', 'necklace')
	ORDER BY uh.acquired_at DESC, uh.user_id, uh.hat_id
	LIMIT 24;
$function$;

REVOKE ALL ON FUNCTION public.sounder_counter_buys() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sounder_counter_buys() TO authenticated;

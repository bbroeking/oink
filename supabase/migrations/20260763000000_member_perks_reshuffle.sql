-- Slop Club perks reshuffle: the membership stops touching the economy.
--
-- Founder call 2026-07-21: member benefits must run PARALLEL to the core
-- loop, never multiply it (docs/design/member-expansion-backlog.md — the
-- governing principle). Two perks violate that and are removed:
--
-- 1. 2× tickle regen. ALREADY REMOVED ONCE — 20260679_remove_vip_regen_
--    paytowin stripped the `is_vip THEN 1800 ELSE 3600` base ("money buys
--    advantage" — the charter refuses it), and then 20260704900000 /
--    20260705100000 carried their regen_secs_for from a pre-20260679 base
--    and SILENTLY RESURRECTED the VIP branch (the carry-latest-def footgun,
--    second sighting — see docs re build 93). This migration re-removes it;
--    the def below is VERBATIM 20260705100000 (chorus_glow + mud_wrap in
--    the blessing set, linear alignment, happiness curve, war-winner buff)
--    with ONLY the base flattened to 3600 for everyone.
--
-- 2. The 250-snout monthly stipend. It prints currency; retired rather
--    than dropped so live 1.3 clients degrade gracefully:
--    - claim_slop_stipend() now always refuses with reason 'retired'
--      (shipped clients treat a non-ok claim as a silent no-op).
--    - slop_stipend_status() now reports is_member=false, which is the
--      flag the shipped Account card gates the whole stipend block on —
--      member clients simply stop showing the claim button.
--    profiles.last_stipend_month stays (history; harmless).
--
-- KEPT on the membership: the bigger tickle bank (cap 50 vs 25 — a
-- convenience reserve, not a speed advantage, per 20260679's rationale)
-- and members-only drops. Replacement perks (parallel-loop: lounge scene,
-- reactions, free bounty reroll, …) ship separately.

-- ── 1. regen_secs_for: same base for everyone (again) ──────────────
-- Carried VERBATIM from 20260705100000_chorus_and_kick apart from the
-- flattened base. Do NOT rebuild this from an older migration.
CREATE OR REPLACE FUNCTION public.regen_secs_for(uid uuid)
RETURNS int
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT GREATEST(60, floor(
		-- Base regen: SAME for everyone. The VIP 2× branch was pay-to-win
		-- (tickles are the Board's metric); removed in 20260679, resurrected
		-- by a stale carry, re-removed here. Keep it flat.
		3600
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind IN ('warm_tea', 'mud_wrap', 'chorus_glow')
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.5 ELSE 1 END)
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.curses
			WHERE receiver_id = uid AND kind = 'sluggish_snout'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 2 ELSE 1 END)
		-- Alignment: LINEAR ±10% cap, full strength at ±25 (was a ±25 step).
		* (1.0 - LEAST(10.0, GREATEST(-10.0,
			COALESCE((SELECT alignment_score FROM public.profiles WHERE id = uid), 0) * 0.4
		  )) / 100.0)
		-- Happiness: 1.15× (sad) → 0.85× (happy), linear.
		* (1.15 - (public.happiness_now(uid) - 20) / 60.0 * 0.30)
		-- Mud Scuffles: winner regen buff — ×0.85 (BUFF_MULT) for 72h after a win.
		* (CASE WHEN EXISTS (
			SELECT 1 FROM public.blessings
			WHERE receiver_id = uid AND kind = 'war_winner_regen'
			  AND cleared_at IS NULL AND expires_at > now()
		   ) THEN 0.85 ELSE 1 END)
	)::int);
$function$;

-- ── 2. Stipend retired (refuse, don't drop) ────────────────────────
CREATE OR REPLACE FUNCTION public.claim_slop_stipend()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object('ok', false, 'reason', 'retired');
$function$;

-- Shipped 1.3 gates the whole stipend UI on is_member — false hides it.
CREATE OR REPLACE FUNCTION public.slop_stipend_status()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT jsonb_build_object(
		'is_member', false,
		'amount', 0,
		'claimed_this_month', true,
		'next_at', NULL
	);
$function$;

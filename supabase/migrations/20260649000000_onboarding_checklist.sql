-- First-Week Checklist ("Rosie's chores") — the onboarding guidance backbone.
-- Spec: docs/onboarding-first-week-checklist-spec.md; design:
-- docs/wiki/onboarding-and-guidance.md.
--
-- A small set of one-time, rewarded milestones that teach the game's breadth and
-- drive the D1-D7 retention actions. SERVER-AUTHORITATIVE + IDEMPOTENT rewards
-- (the cash-faucet lesson from 20260648 / the 2026-06-14 visit-cash review): the
-- client never grants snouts — it calls claim_onboarding(), which re-checks each
-- milestone's done-ness from authoritative state and pays at most once per
-- (user, milestone) via the onboarding_claims PK + ON CONFLICT.
--
-- Deliberately DEDICATED tables (not the shared achievements catalog): onboarding
-- milestones are heterogeneous booleans (tickle / dress / friend / visit / ritual)
-- that don't fit the achievements model's one-progress-int-per-category ladder,
-- and isolating them keeps the achievements screen + the complex my_achievements()
-- SQL untouched (no carry-latest-def risk on that function).
--
-- v1 is 5 items. The spec's 6th ("keep a 3-day streak") is DEFERRED: there is no
-- streak persisted server-side yet (the streak engine is headless) — add it as a
-- milestone row once the streak/Garden ships and exposes a server-readable value.

-- ── 1. Catalog ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_milestones (
	id            text PRIMARY KEY,
	name          text NOT NULL,
	description   text NOT NULL,
	icon          text,
	reward_snouts int  NOT NULL DEFAULT 0,
	display_order int  NOT NULL DEFAULT 0
);

ALTER TABLE public.onboarding_milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read onboarding catalog" ON public.onboarding_milestones;
CREATE POLICY "Read onboarding catalog"
	ON public.onboarding_milestones FOR SELECT USING (true);

INSERT INTO public.onboarding_milestones (id, name, description, icon, reward_snouts, display_order)
VALUES
	('first_tickle', 'First tickle',      'Give Rosie her very first tickle.',        '👆', 25, 10),
	('dress',        'Dress Rosie up',    'Put a hat (or anything) on Rosie.',         '🎩', 25, 20),
	('friend',       'Make a friend',     'Add your first friend.',                    '🤝', 50, 30),
	('visit',        'Visit a Barn',      'Visit a friend''s Barn and tickle their pig.', '🏚', 50, 40),
	('ritual',       'Cast a ritual',     'Bless or curse a friend.',                  '✨', 50, 50)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Claims (idempotency ledger) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_claims (
	user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	milestone_id text        NOT NULL REFERENCES public.onboarding_milestones(id) ON DELETE CASCADE,
	claimed_at   timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, milestone_id)
);

ALTER TABLE public.onboarding_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View own onboarding claims" ON public.onboarding_claims;
CREATE POLICY "View own onboarding claims"
	ON public.onboarding_claims FOR SELECT USING (auth.uid() = user_id);

-- ── 3. Done-ness — single authoritative source, used by BOTH RPCs ──
-- Returns one (milestone_id, done) row per milestone, computed from real state.
-- The grant path re-reads this (never the client) before paying, so a spoofed
-- client can't claim an unearned milestone.
CREATE OR REPLACE FUNCTION public.onboarding_done(uid uuid)
RETURNS TABLE (milestone_id text, done boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT 'first_tickle',
		COALESCE((SELECT tickles_earned FROM public.profiles WHERE id = uid), 0) >= 1
	UNION ALL
	SELECT 'dress',
		EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND (
			active_hat_id IS NOT NULL OR active_glasses_id IS NOT NULL OR
			active_mask_id IS NOT NULL OR active_neck_id IS NOT NULL OR
			active_aura_id IS NOT NULL OR active_held_id IS NOT NULL OR
			active_tickle_particle_id IS NOT NULL))
	UNION ALL
	SELECT 'friend',
		EXISTS (SELECT 1 FROM public.friendships
			WHERE status = 'accepted' AND (requester_id = uid OR receiver_id = uid))
	UNION ALL
	SELECT 'visit',
		EXISTS (SELECT 1 FROM public.barn_visits WHERE visitor_id = uid)
	UNION ALL
	SELECT 'ritual',
		EXISTS (SELECT 1 FROM public.blessings WHERE sender_id = uid)
		OR EXISTS (SELECT 1 FROM public.curses WHERE sender_id = uid);
$function$;

GRANT EXECUTE ON FUNCTION public.onboarding_done(uuid) TO authenticated;

-- ── 4. Read API for the checklist UI ───────────────────────────────
CREATE OR REPLACE FUNCTION public.onboarding_progress()
RETURNS TABLE (
	id            text,
	name          text,
	description   text,
	icon          text,
	reward_snouts int,
	display_order int,
	done          boolean,
	claimed       boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT
		m.id, m.name, m.description, m.icon, m.reward_snouts, m.display_order,
		COALESCE(d.done, false) AS done,
		(oc.user_id IS NOT NULL) AS claimed
	FROM public.onboarding_milestones m
	LEFT JOIN public.onboarding_done(auth.uid()) d ON d.milestone_id = m.id
	LEFT JOIN public.onboarding_claims oc
		ON oc.milestone_id = m.id AND oc.user_id = auth.uid()
	ORDER BY m.display_order;
$function$;

GRANT EXECUTE ON FUNCTION public.onboarding_progress() TO authenticated;

-- ── 5. Grant API — idempotent, server-authoritative ────────────────
-- Pays every milestone that is genuinely done AND not yet claimed. The
-- ON CONFLICT + IF FOUND guard makes it safe under concurrency: only the call
-- that actually inserts the claim pays the snouts. Returns the newly-claimed
-- rows so the client can show a reveal.
CREATE OR REPLACE FUNCTION public.claim_onboarding()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	rec       record;
	newly     jsonb := '[]'::jsonb;
	total     int   := 0;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
	END IF;

	FOR rec IN
		SELECT m.id, m.name, m.icon, m.reward_snouts
		FROM public.onboarding_milestones m
		JOIN public.onboarding_done(caller_id) d
			ON d.milestone_id = m.id AND d.done
		LEFT JOIN public.onboarding_claims oc
			ON oc.milestone_id = m.id AND oc.user_id = caller_id
		WHERE oc.user_id IS NULL
		ORDER BY m.display_order
	LOOP
		INSERT INTO public.onboarding_claims (user_id, milestone_id)
			VALUES (caller_id, rec.id)
			ON CONFLICT (user_id, milestone_id) DO NOTHING;
		-- Pay ONLY on a genuine insert (FOUND is false when ON CONFLICT skipped),
		-- so a concurrent double-claim can't double-pay.
		IF FOUND THEN
			UPDATE public.profiles
				SET counter = counter + rec.reward_snouts
				WHERE id = caller_id;
			newly := newly || jsonb_build_object(
				'id', rec.id, 'name', rec.name, 'icon', rec.icon,
				'reward_snouts', rec.reward_snouts
			);
			total := total + rec.reward_snouts;
		END IF;
	END LOOP;

	RETURN jsonb_build_object('ok', true, 'claimed', newly, 'snouts_granted', total);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.claim_onboarding() TO authenticated;

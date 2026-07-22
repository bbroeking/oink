-- ════════════════════════════════════════════════════════════════════════
-- The Field Guide — evergreen economy-discovery journal (spec 16).
--
-- A second shelf beside the seasonal Burrow Book on the dig-collection screen:
-- eight pages about the game's economy objects. Each page is a silhouette until
-- the player first MEETS the thing, then opens with a ceremony reveal. This
-- migration owns only the UNLOCK STATE — which pages a player has met.
--
-- Detection is CLIENT-OBSERVED (first patch find, first lucky number, first
-- Exchange visit, …) and fired fail-soft: unlock_field_guide_page() is
-- idempotent + whitelisted, so a double-fire or a bad page id is harmless, and
-- the client mirrors unlocks in AsyncStorage so it works against today's prod
-- schema (no table, no RPCs) exactly like storybook_seen (20260747) did. All
-- additive: no CREATE OR REPLACE over an existing definition (no
-- carry-latest-def footgun); no edits to any existing hot function.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Unlock table ──────────────────────────────────────────────────────────
-- One row per (player, met page). unlocked_at is informational (the reveal is
-- client-driven; the row is the durable "this account has met it" bit).
CREATE TABLE IF NOT EXISTS public.field_guide_pages (
	user_id     uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
	page_id     text        NOT NULL,
	unlocked_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, page_id)
);

-- RLS: a player reads ONLY their own pages. There is no client-facing write
-- policy — the sole writer is unlock_field_guide_page() (SECURITY DEFINER),
-- so the whitelist there is the only door in.
ALTER TABLE public.field_guide_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS field_guide_pages_select_own ON public.field_guide_pages;
CREATE POLICY field_guide_pages_select_own
	ON public.field_guide_pages
	FOR SELECT
	USING (user_id = auth.uid());

-- ── 2. unlock_field_guide_page — idempotent, whitelisted write ────────────────
-- SECURITY DEFINER so it can insert past RLS, but scoped to auth.uid() and
-- guarded by the v1 page-id whitelist: an unknown id raises (the client swallows
-- it), so a forged/typo'd id can never seed a junk row. ON CONFLICT DO NOTHING
-- makes a repeat fire a no-op — the client fires this fail-soft on every observed
-- encounter, first or hundredth.
CREATE OR REPLACE FUNCTION public.unlock_field_guide_page(p_page text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
	IF auth.uid() IS NULL THEN
		RETURN; -- unauthenticated: silent no-op
	END IF;
	IF p_page NOT IN (
		'truffle', 'golden_truffle', 'lucky_number', 'trough',
		'mud_wrap', 'snouts', 'exchange', 'feeding_windows'
	) THEN
		RAISE EXCEPTION 'unknown field guide page: %', p_page
			USING ERRCODE = 'check_violation';
	END IF;
	INSERT INTO public.field_guide_pages (user_id, page_id)
		VALUES (auth.uid(), p_page)
		ON CONFLICT (user_id, page_id) DO NOTHING;
END;
$function$;

-- ── 3. get_field_guide_pages — read own unlocked ids ──────────────────────────
-- Returns the caller's unlocked page ids as a text[] (empty array when none).
-- SECURITY DEFINER + auth.uid() scope; the client unions this with its local
-- AsyncStorage mirror and reconciles, same shape as get_storybook_seen().
CREATE OR REPLACE FUNCTION public.get_field_guide_pages()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		array_agg(page_id ORDER BY page_id),
		ARRAY[]::text[]
	)
	FROM public.field_guide_pages
	WHERE user_id = auth.uid();
$function$;

GRANT EXECUTE ON FUNCTION public.unlock_field_guide_page(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_field_guide_pages() TO authenticated;

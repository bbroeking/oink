-- Tickle particles — a new equippable slot driving what spawns
-- above the pig on each tap.
--
-- Default behavior is unchanged: the existing HeartFloats spawn
-- ♥ (or ✦ ~10% of the time) as a typographic text glyph. When a
-- player equips a particle from this catalog, those text glyphs
-- are replaced by the equipped item's PNG asset.
--
-- Catalog rows live in public.hats (same generic registry as every
-- other cosmetic) with category 'tickle_particle'. The new slot
-- column active_tickle_particle_id sits alongside active_hat_id /
-- active_aura_id / active_background_id / active_held_id.
--
-- Pricing follows the post-rebalance bands from 20260546/20260547:
--   common    100-200    heart 100, sparkle 150
--   uncommon  200-400    snout 250, star 300, music_note 320
--   rare      400-800    clover 500, halo 700
--   epic      800-2000   rainbow 1000

-- ── New slot column ─────────────────────────────────────────────
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS active_tickle_particle_id
		text REFERENCES public.hats(id) ON DELETE SET NULL;

-- ── 8 catalog rows ──────────────────────────────────────────────
INSERT INTO public.hats
	(id, name, emoji, cost, display_order, category, rarity, description)
VALUES
	('particle_heart',      'Heart Particle',      NULL, 100,  9100, 'tickle_particle', 'common',   'A soft pink heart that floats up with each tickle.'),
	('particle_sparkle',    'Sparkle Particle',    NULL, 150,  9101, 'tickle_particle', 'common',   'Bright four-point sparks per tap.'),
	('particle_snout',      'Snout Particle',      NULL, 250,  9102, 'tickle_particle', 'uncommon', 'Tiny pig snouts drift up like bubbles.'),
	('particle_star',       'Star Particle',       NULL, 300,  9103, 'tickle_particle', 'uncommon', 'Classic five-point yellow stars.'),
	('particle_music_note', 'Music Note Particle', NULL, 320,  9104, 'tickle_particle', 'uncommon', 'An eighth-note pop per tickle.'),
	('particle_clover',     'Clover Particle',     NULL, 500,  9105, 'tickle_particle', 'rare',     'Four-leaf clovers — feeling lucky?'),
	('particle_halo',       'Halo Particle',       NULL, 700,  9106, 'tickle_particle', 'rare',     'A gold halo ring on every tap.'),
	('particle_rainbow',    'Rainbow Particle',    NULL, 1000, 9107, 'tickle_particle', 'epic',     'Rare full-arc rainbow burst per tickle.')
ON CONFLICT (id) DO NOTHING;

-- ── home_stats(): surface the new slot alongside the others ─────
-- Same shape as the other active_* fields. Rebuilt from the
-- 20260519 version with the new field added.
set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.home_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	prof      record;
	hat       record;
	aura      record;
	bg        record;
	held      record;
	tp        record;
	tickle    jsonb;
	season    jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT counter, tickles_earned, active_hat_id,
		active_aura_id, active_background_id, active_held_id,
		active_tickle_particle_id
		INTO prof
		FROM public.profiles
		WHERE id = caller_id;

	IF prof.active_hat_id IS NOT NULL THEN
		SELECT category, emoji INTO hat
			FROM public.hats WHERE id = prof.active_hat_id;
	END IF;
	IF prof.active_aura_id IS NOT NULL THEN
		SELECT category, emoji INTO aura
			FROM public.hats WHERE id = prof.active_aura_id;
	END IF;
	IF prof.active_background_id IS NOT NULL THEN
		SELECT category, emoji INTO bg
			FROM public.hats WHERE id = prof.active_background_id;
	END IF;
	IF prof.active_held_id IS NOT NULL THEN
		SELECT category, emoji INTO held
			FROM public.hats WHERE id = prof.active_held_id;
	END IF;
	IF prof.active_tickle_particle_id IS NOT NULL THEN
		SELECT category, emoji INTO tp
			FROM public.hats WHERE id = prof.active_tickle_particle_id;
	END IF;

	tickle := public.tickle_info(caller_id);
	season := public.season_state();

	RETURN jsonb_build_object(
		'ok',                  true,
		'counter',             COALESCE(prof.counter, 0),
		'tickles_earned',      COALESCE(prof.tickles_earned, 0),
		'active_hat_id',       prof.active_hat_id,
		'active_hat',          CASE
			WHEN prof.active_hat_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_hat_id,
				'category', hat.category, 'emoji', hat.emoji)
		END,
		'active_aura_id',      prof.active_aura_id,
		'active_aura',         CASE
			WHEN prof.active_aura_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_aura_id,
				'category', aura.category, 'emoji', aura.emoji)
		END,
		'active_background_id', prof.active_background_id,
		'active_background',    CASE
			WHEN prof.active_background_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_background_id,
				'category', bg.category, 'emoji', bg.emoji)
		END,
		'active_held_id',      prof.active_held_id,
		'active_held',         CASE
			WHEN prof.active_held_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_held_id,
				'category', held.category, 'emoji', held.emoji)
		END,
		'active_tickle_particle_id', prof.active_tickle_particle_id,
		'active_tickle_particle',    CASE
			WHEN prof.active_tickle_particle_id IS NULL THEN NULL
			ELSE jsonb_build_object('id', prof.active_tickle_particle_id,
				'category', tp.category, 'emoji', tp.emoji)
		END,
		'balance',             COALESCE((tickle->>'balance')::int, 0),
		'cap',                 COALESCE((tickle->>'cap')::int, 25),
		'next_regen_seconds',  tickle->'next_regen_seconds',
		'current_tier',        COALESCE((season->>'current_tier')::int, 1),
		'total_tiers',         COALESCE((season->'season'->>'total_tiers')::int, 30)
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.home_stats() TO authenticated;

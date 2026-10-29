-- Full costumes on every pig (20261029280000_costumes_all_pigs.sql).
-- run.sh applies the migration after A7, then this file. A5 (earlier in the
-- chain) still proves 20261029240000's Rosie-only rule; this proves the
-- carried equip_cosmetic without it. Reuses A5's fixture pig (a5_* hats, two
-- owned costumes) and resets it first.
--
-- Proves:
--   (a) a member on an owned non-Rosie pig (pepper) equips a costume:
--       {ok:true, update:{active_costume_id}}, the column is set, and every
--       other active_* slot is exactly as it was (no costume_rosie_only);
--   (b) swapping costumes on that pig, and a hat while costumed, keep the
--       rest of the outfit and the costume;
--   (c) ownership is still required: an unowned costume answers not_owned on
--       pepper and on Rosie, nothing written; an unknown id is no_such_item;
--   (d) taking it off clears only active_costume_id;
--   (e) Rosie, a lapsed member on a stored pepper, and a second owned pig
--       (bandit) all still equip;
--   (f) the function no longer mentions costume_rosie_only, and anon still
--       cannot execute it.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION pg_temp.a8_slots(p uuid) RETURNS jsonb LANGUAGE sql AS $$
	SELECT jsonb_build_object(
		'hat', active_hat_id, 'bow', active_bow_id, 'glasses', active_glasses_id,
		'mask', active_mask_id, 'neck', active_neck_id, 'aura', active_aura_id,
		'held', active_held_id, 'background', active_background_id,
		'flag', active_flag_id, 'tickle_particle', active_tickle_particle_id)
	FROM public.profiles WHERE id = p $$;

DO $a8$
DECLARE
	u uuid := '00000000-0000-0000-0000-0000000a5001';
	r jsonb;
	before_slots jsonb;
	costume text;
BEGIN
	PERFORM set_config('smoke.uid', u::text, true);
	-- Fixture: A5's pig, a member on an owned pepper, full outfit, bare.
	INSERT INTO public.user_pigs (user_id, pig_id) VALUES (u, 'pepper'), (u, 'bandit') ON CONFLICT DO NOTHING;
	UPDATE public.profiles SET
		active_pig_id = 'pepper', is_vip = true,
		active_hat_id = 'a5_hat', active_bow_id = 'a5_bow',
		active_glasses_id = 'a5_glasses', active_mask_id = NULL,
		active_neck_id = 'a5_scarf', active_aura_id = 'a5_aura',
		active_held_id = 'a5_held', active_background_id = 'a5_bg',
		active_flag_id = 'a5_flag', active_tickle_particle_id = 'a5_tp',
		active_costume_id = NULL
	WHERE id = u;
	before_slots := pg_temp.a8_slots(u);

	-- (a) A costume on a member's pepper goes on; only its column moves.
	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	IF NOT (r->>'ok')::boolean
	   OR r->'update' <> jsonb_build_object('active_costume_id', 'halloween_2026_hollow_jack_costume') THEN
		RAISE EXCEPTION 'chk costumes all pigs a: equip on pepper should succeed, got %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS DISTINCT FROM 'halloween_2026_hollow_jack_costume' THEN
		RAISE EXCEPTION 'chk costumes all pigs a: active_costume_id should be set, got %', costume; END IF;
	IF pg_temp.a8_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes all pigs a: the costume moved another slot: % -> %', before_slots, pg_temp.a8_slots(u); END IF;
	IF (SELECT active_pig_id FROM public.profiles WHERE id = u) <> 'pepper' THEN
		RAISE EXCEPTION 'chk costumes all pigs a: the equip moved the pig'; END IF;

	-- (b) Swap costumes, then a hat while costumed.
	r := public.equip_cosmetic('halloween_2026_starspell_costume');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR costume <> 'halloween_2026_starspell_costume'
	   OR pg_temp.a8_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes all pigs b: costume swap on pepper wrong: % / % / %', r, costume, pg_temp.a8_slots(u); END IF;
	r := public.equip_cosmetic('a5_hat2');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR costume IS DISTINCT FROM 'halloween_2026_starspell_costume'
	   OR pg_temp.a8_slots(u) <> (before_slots || jsonb_build_object('hat', 'a5_hat2')) THEN
		RAISE EXCEPTION 'chk costumes all pigs b: hat while costumed on pepper wrong: % / % / %', r, costume, pg_temp.a8_slots(u); END IF;
	r := public.equip_cosmetic('a5_hat');

	-- (c) Ownership still required, on pepper and on Rosie; nothing written.
	r := public.equip_cosmetic('halloween_2026_little_imp_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'chk costumes all pigs c: unowned costume on pepper should be not_owned, got %', r; END IF;
	r := public.equip_cosmetic('a8_no_such_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'no_such_item' THEN
		RAISE EXCEPTION 'chk costumes all pigs c: unknown id should be no_such_item, got %', r; END IF;
	UPDATE public.profiles SET active_pig_id = 'rosie' WHERE id = u;
	r := public.equip_cosmetic('halloween_2026_little_imp_costume');
	IF (r->>'ok')::boolean OR r->>'reason' <> 'not_owned' THEN
		RAISE EXCEPTION 'chk costumes all pigs c: unowned costume on Rosie should be not_owned, got %', r; END IF;
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF costume IS DISTINCT FROM 'halloween_2026_starspell_costume' OR pg_temp.a8_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes all pigs c: a refused equip wrote something: % / %', costume, pg_temp.a8_slots(u); END IF;

	-- (d) Off on pepper: only the costume column clears.
	UPDATE public.profiles SET active_pig_id = 'pepper' WHERE id = u;
	r := public.equip_cosmetic(NULL, 'costume');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR r->'update' <> '{"active_costume_id": null}'::jsonb
	   OR costume IS NOT NULL OR pg_temp.a8_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes all pigs d: unequip on pepper wrong: % / % / %', r, costume, pg_temp.a8_slots(u); END IF;

	-- (e) Rosie, a lapsed member on a stored pepper, and bandit all equip.
	UPDATE public.profiles SET active_pig_id = 'rosie', is_vip = false WHERE id = u;
	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk costumes all pigs e: Rosie equip should succeed, got %', r; END IF;
	UPDATE public.profiles SET active_pig_id = 'pepper', is_vip = false WHERE id = u;
	r := public.equip_cosmetic('halloween_2026_starspell_costume');
	IF NOT (r->>'ok')::boolean THEN
		RAISE EXCEPTION 'chk costumes all pigs e: lapsed member on stored pepper should equip, got %', r; END IF;
	UPDATE public.profiles SET active_pig_id = 'bandit', is_vip = true WHERE id = u;
	r := public.equip_cosmetic('halloween_2026_hollow_jack_costume');
	SELECT active_costume_id INTO costume FROM public.profiles WHERE id = u;
	IF NOT (r->>'ok')::boolean OR costume IS DISTINCT FROM 'halloween_2026_hollow_jack_costume'
	   OR pg_temp.a8_slots(u) <> before_slots THEN
		RAISE EXCEPTION 'chk costumes all pigs e: bandit equip wrong: % / % / %', r, costume, pg_temp.a8_slots(u); END IF;

	-- (f) The rule is gone from the body; anon still locked out.
	IF pg_get_functiondef('public.equip_cosmetic(text, text)'::regprocedure) LIKE '%costume_rosie_only%' THEN
		RAISE EXCEPTION 'chk costumes all pigs f: equip_cosmetic still carries costume_rosie_only'; END IF;
	IF has_function_privilege('anon', 'public.equip_cosmetic(text, text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes all pigs f: anon must not execute equip_cosmetic'; END IF;
	IF NOT has_function_privilege('authenticated', 'public.equip_cosmetic(text, text)', 'EXECUTE') THEN
		RAISE EXCEPTION 'chk costumes all pigs f: authenticated must execute equip_cosmetic'; END IF;

	-- Leave the fixture as A5 left it.
	UPDATE public.profiles SET active_pig_id = 'rosie', is_vip = false, active_costume_id = NULL WHERE id = u;

	RAISE NOTICE 'chk costumes all pigs: non-Rosie equip / outfit kept / not_owned / unequip / every pig / no rosie rule / grants OK';
END
$a8$;

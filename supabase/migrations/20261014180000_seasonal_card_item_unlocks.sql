-- Durable, server-authored seasonal card packs and first-copy cosmetic unlocks.
-- Halloween is deliberately seeded inactive and without card mappings.

CREATE TABLE public.seasonal_card_sets (
	set_key text PRIMARY KEY CHECK (set_key ~ '^[a-z0-9]+(_[a-z0-9]+)*_v[1-9][0-9]*$'),
	display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
	mapping_version integer NOT NULL CHECK (mapping_version > 0),
	active boolean NOT NULL DEFAULT false,
	max_pack_cards integer NOT NULL DEFAULT 3 CHECK (max_pack_cards BETWEEN 1 AND 10),
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seasonal_card_catalog (
	set_key text NOT NULL REFERENCES public.seasonal_card_sets(set_key) ON DELETE CASCADE,
	card_id text NOT NULL CHECK (card_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
	item_id text REFERENCES public.hats(id) ON DELETE RESTRICT,
	unlock_rule text NOT NULL DEFAULT 'first_copy' CHECK (unlock_rule = 'first_copy'),
	PRIMARY KEY (set_key, card_id)
);

CREATE TABLE public.seasonal_card_pack_grants (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	set_key text NOT NULL REFERENCES public.seasonal_card_sets(set_key) ON DELETE RESTRICT,
	source text NOT NULL CHECK (source ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 160),
	created_at timestamptz NOT NULL DEFAULT now(),
	opened_at timestamptz,
	UNIQUE (id, set_key),
	UNIQUE (user_id, set_key, source, source_ref)
);

CREATE TABLE public.seasonal_card_pack_grant_cards (
	grant_id uuid NOT NULL REFERENCES public.seasonal_card_pack_grants(id) ON DELETE CASCADE,
	set_key text NOT NULL,
	position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
	card_id text NOT NULL CHECK (card_id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	finish text NOT NULL DEFAULT 'standard' CHECK (finish IN ('standard', 'foil', 'living')),
	PRIMARY KEY (grant_id, position),
	FOREIGN KEY (grant_id, set_key) REFERENCES public.seasonal_card_pack_grants(id, set_key) ON DELETE CASCADE,
	FOREIGN KEY (set_key, card_id) REFERENCES public.seasonal_card_catalog(set_key, card_id) ON DELETE RESTRICT
);

CREATE TABLE public.user_seasonal_cards (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	set_key text NOT NULL,
	card_id text NOT NULL,
	quantity integer NOT NULL CHECK (quantity > 0),
	first_acquired_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, set_key, card_id),
	FOREIGN KEY (set_key, card_id) REFERENCES public.seasonal_card_catalog(set_key, card_id) ON DELETE RESTRICT
);

CREATE TABLE public.seasonal_card_pack_openings (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	grant_id uuid NOT NULL UNIQUE REFERENCES public.seasonal_card_pack_grants(id) ON DELETE CASCADE,
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	set_key text NOT NULL REFERENCES public.seasonal_card_sets(set_key) ON DELETE RESTRICT,
	opened_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.seasonal_card_pack_opening_cards (
	opening_id uuid NOT NULL REFERENCES public.seasonal_card_pack_openings(id) ON DELETE CASCADE,
	position integer NOT NULL CHECK (position BETWEEN 1 AND 10),
	card_id text NOT NULL,
	finish text NOT NULL CHECK (finish IN ('standard', 'foil', 'living')),
	quantity_before integer NOT NULL CHECK (quantity_before >= 0),
	quantity_after integer NOT NULL CHECK (quantity_after = quantity_before + 1),
	newly_owned boolean NOT NULL,
	PRIMARY KEY (opening_id, position)
);

CREATE TABLE public.seasonal_card_item_grants (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	set_key text NOT NULL,
	card_id text NOT NULL,
	item_id text NOT NULL REFERENCES public.hats(id) ON DELETE RESTRICT,
	opening_id uuid NOT NULL REFERENCES public.seasonal_card_pack_openings(id) ON DELETE CASCADE,
	position integer NOT NULL,
	newly_owned boolean NOT NULL,
	granted_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, set_key, card_id, item_id),
	FOREIGN KEY (opening_id, position) REFERENCES public.seasonal_card_pack_opening_cards(opening_id, position) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.prevent_granted_seasonal_card_reward_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $fn$
BEGIN
	IF (NEW.set_key, NEW.card_id, NEW.item_id, NEW.unlock_rule)
		IS DISTINCT FROM (OLD.set_key, OLD.card_id, OLD.item_id, OLD.unlock_rule)
		AND EXISTS (
			SELECT 1 FROM public.seasonal_card_pack_grant_cards gc
			WHERE gc.set_key = OLD.set_key AND gc.card_id = OLD.card_id
		) THEN
		RAISE EXCEPTION 'granted seasonal card reward identity is immutable; create a new versioned set';
	END IF;
	RETURN NEW;
END
$fn$;

CREATE TRIGGER seasonal_card_catalog_freeze_granted_reward
	BEFORE UPDATE ON public.seasonal_card_catalog
	FOR EACH ROW EXECUTE FUNCTION public.prevent_granted_seasonal_card_reward_change();

REVOKE ALL ON FUNCTION public.prevent_granted_seasonal_card_reward_change() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.seasonal_card_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_pack_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_pack_grant_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_seasonal_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_pack_openings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_pack_opening_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasonal_card_item_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY seasonal_card_grants_read_own ON public.seasonal_card_pack_grants
	FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY seasonal_card_grant_cards_read_own ON public.seasonal_card_pack_grant_cards
	FOR SELECT USING (EXISTS (SELECT 1 FROM public.seasonal_card_pack_grants g WHERE g.id = grant_id AND g.user_id = auth.uid()));
CREATE POLICY seasonal_card_inventory_read_own ON public.user_seasonal_cards
	FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY seasonal_card_openings_read_own ON public.seasonal_card_pack_openings
	FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY seasonal_card_opening_cards_read_own ON public.seasonal_card_pack_opening_cards
	FOR SELECT USING (EXISTS (SELECT 1 FROM public.seasonal_card_pack_openings o WHERE o.id = opening_id AND o.user_id = auth.uid()));
CREATE POLICY seasonal_card_item_grants_read_own ON public.seasonal_card_item_grants
	FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.seasonal_card_sets, public.seasonal_card_catalog,
	public.seasonal_card_pack_grants, public.seasonal_card_pack_grant_cards,
	public.user_seasonal_cards, public.seasonal_card_pack_openings,
	public.seasonal_card_pack_opening_cards, public.seasonal_card_item_grants
	FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.seasonal_card_pack_grants, public.seasonal_card_pack_grant_cards,
	public.user_seasonal_cards, public.seasonal_card_pack_openings,
	public.seasonal_card_pack_opening_cards, public.seasonal_card_item_grants TO authenticated;

CREATE OR REPLACE FUNCTION public.seasonal_card_opening_receipt(p_opening_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
	SELECT jsonb_build_object(
		'openingId', o.id, 'grantId', o.grant_id, 'ownerId', o.user_id, 'setKey', o.set_key,
		'cards', COALESCE(jsonb_agg(jsonb_build_object(
			'position', c.position, 'cardId', c.card_id, 'finish', c.finish,
			'quantityBefore', c.quantity_before, 'quantityAfter', c.quantity_after,
			'newlyOwned', c.newly_owned, 'itemUnlock', CASE WHEN ig.item_id IS NULL THEN NULL ELSE
				jsonb_build_object('itemId', ig.item_id, 'newlyOwned', ig.newly_owned) END
		) ORDER BY c.position), '[]'::jsonb)
	)
	FROM public.seasonal_card_pack_openings o
	LEFT JOIN public.seasonal_card_pack_opening_cards c ON c.opening_id = o.id
	LEFT JOIN public.seasonal_card_item_grants ig ON ig.opening_id = o.id AND ig.position = c.position
	WHERE o.id = p_opening_id
	GROUP BY o.id, o.grant_id, o.user_id, o.set_key
$fn$;

REVOKE ALL ON FUNCTION public.seasonal_card_opening_receipt(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_seasonal_card_pack(
	p_user_id uuid, p_set_key text, p_source text, p_source_ref text, p_cards jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
	v_grant public.seasonal_card_pack_grants%ROWTYPE;
	v_max integer;
	v_count integer;
	v_existing jsonb;
BEGIN
	IF p_user_id IS NULL OR p_source IS NULL OR p_source_ref IS NULL
		OR p_source !~ '^[a-z0-9]+(_[a-z0-9]+)*$' OR length(p_source_ref) NOT BETWEEN 1 AND 160 THEN
		RAISE EXCEPTION 'invalid seasonal card pack identity';
	END IF;
	SELECT max_pack_cards INTO v_max FROM public.seasonal_card_sets WHERE set_key = p_set_key AND active;
	IF v_max IS NULL THEN RAISE EXCEPTION 'seasonal card set is inactive or unknown'; END IF;
	IF p_cards IS NULL OR jsonb_typeof(p_cards) <> 'array' THEN RAISE EXCEPTION 'cards must be an ordered array'; END IF;
	v_count := jsonb_array_length(p_cards);
	IF v_count < 1 OR v_count > v_max THEN RAISE EXCEPTION 'invalid seasonal card pack size'; END IF;
	IF EXISTS (
		SELECT 1 FROM jsonb_array_elements(p_cards) card
		WHERE NOT (card ? 'card_id') OR COALESCE(card->>'finish', 'standard') NOT IN ('standard','foil','living')
			OR NOT EXISTS (SELECT 1 FROM public.seasonal_card_catalog cc WHERE cc.set_key = p_set_key AND cc.card_id = card->>'card_id')
	) THEN RAISE EXCEPTION 'pack contains an unknown card or finish'; END IF;

	INSERT INTO public.seasonal_card_pack_grants(user_id, set_key, source, source_ref)
	VALUES (p_user_id, p_set_key, p_source, p_source_ref)
	ON CONFLICT (user_id, set_key, source, source_ref) DO NOTHING;
	SELECT * INTO v_grant FROM public.seasonal_card_pack_grants
	WHERE user_id = p_user_id AND set_key = p_set_key AND source = p_source AND source_ref = p_source_ref FOR UPDATE;
	SELECT COALESCE(jsonb_agg(jsonb_build_object('card_id', gc.card_id, 'finish', gc.finish) ORDER BY gc.position), '[]'::jsonb)
	INTO v_existing FROM public.seasonal_card_pack_grant_cards gc WHERE gc.grant_id = v_grant.id;
	IF jsonb_array_length(v_existing) > 0 THEN
		IF v_existing <> (SELECT jsonb_agg(jsonb_build_object('card_id', card->>'card_id', 'finish', COALESCE(card->>'finish','standard')) ORDER BY ord)
			FROM jsonb_array_elements(p_cards) WITH ORDINALITY AS x(card, ord)) THEN
			RAISE EXCEPTION 'seasonal card grant source reference conflict';
		END IF;
		RETURN jsonb_build_object('ok', true, 'grantId', v_grant.id, 'replayed', true);
	END IF;
	INSERT INTO public.seasonal_card_pack_grant_cards(grant_id, set_key, position, card_id, finish)
	SELECT v_grant.id, p_set_key, ord::integer, card->>'card_id', COALESCE(card->>'finish','standard')
	FROM jsonb_array_elements(p_cards) WITH ORDINALITY AS x(card, ord);
	RETURN jsonb_build_object('ok', true, 'grantId', v_grant.id, 'replayed', false);
END
$fn$;

REVOKE ALL ON FUNCTION public.grant_seasonal_card_pack(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_seasonal_card_pack(uuid, text, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.open_seasonal_card_pack(p_grant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
	v_user uuid := auth.uid();
	v_grant public.seasonal_card_pack_grants%ROWTYPE;
	v_opening_id uuid;
	v_card record;
	v_before integer;
	v_inserted integer;
	v_item_new boolean;
BEGIN
	IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
	SELECT * INTO v_grant FROM public.seasonal_card_pack_grants WHERE id = p_grant_id FOR UPDATE;
	IF NOT FOUND OR v_grant.user_id <> v_user THEN RAISE EXCEPTION 'seasonal card grant not found'; END IF;
	SELECT id INTO v_opening_id FROM public.seasonal_card_pack_openings WHERE grant_id = v_grant.id;
	IF v_opening_id IS NOT NULL THEN
		RETURN jsonb_build_object('ok', true, 'replayed', true, 'receipt', public.seasonal_card_opening_receipt(v_opening_id));
	END IF;
	IF NOT EXISTS (SELECT 1 FROM public.seasonal_card_sets WHERE set_key = v_grant.set_key AND active) THEN
		RAISE EXCEPTION 'seasonal card set is inactive';
	END IF;
	-- Different grants may contain the same cards in different orders. Serialize
	-- all inventory mutations for one player/set so receipt quantities are exact
	-- and card-row lock ordering cannot deadlock.
	PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || v_grant.set_key, 0));
	INSERT INTO public.seasonal_card_pack_openings(grant_id, user_id, set_key)
	VALUES (v_grant.id, v_user, v_grant.set_key) RETURNING id INTO v_opening_id;
	FOR v_card IN
		SELECT gc.position, gc.card_id, gc.finish, cc.item_id, cc.unlock_rule
		FROM public.seasonal_card_pack_grant_cards gc
		JOIN public.seasonal_card_catalog cc ON cc.set_key = gc.set_key AND cc.card_id = gc.card_id
		WHERE gc.grant_id = v_grant.id ORDER BY gc.position
	LOOP
		SELECT COALESCE((SELECT quantity FROM public.user_seasonal_cards
			WHERE user_id = v_user AND set_key = v_grant.set_key AND card_id = v_card.card_id FOR UPDATE), 0) INTO v_before;
		INSERT INTO public.user_seasonal_cards(user_id, set_key, card_id, quantity)
		VALUES (v_user, v_grant.set_key, v_card.card_id, 1)
		ON CONFLICT (user_id, set_key, card_id) DO UPDATE
		SET quantity = public.user_seasonal_cards.quantity + 1, updated_at = now();
		INSERT INTO public.seasonal_card_pack_opening_cards(opening_id, position, card_id, finish, quantity_before, quantity_after, newly_owned)
		VALUES (v_opening_id, v_card.position, v_card.card_id, v_card.finish, v_before, v_before + 1, v_before = 0);
		IF v_before = 0 AND v_card.item_id IS NOT NULL AND v_card.unlock_rule = 'first_copy' THEN
			INSERT INTO public.user_hats(user_id, hat_id) VALUES (v_user, v_card.item_id) ON CONFLICT DO NOTHING;
			GET DIAGNOSTICS v_inserted = ROW_COUNT;
			v_item_new := v_inserted = 1;
			INSERT INTO public.seasonal_card_item_grants(user_id, set_key, card_id, item_id, opening_id, position, newly_owned)
			VALUES (v_user, v_grant.set_key, v_card.card_id, v_card.item_id, v_opening_id, v_card.position, v_item_new)
			ON CONFLICT (user_id, set_key, card_id, item_id) DO NOTHING;
		END IF;
	END LOOP;
	UPDATE public.seasonal_card_pack_grants SET opened_at = now() WHERE id = v_grant.id;
	RETURN jsonb_build_object('ok', true, 'replayed', false, 'receipt', public.seasonal_card_opening_receipt(v_opening_id));
END
$fn$;

REVOKE ALL ON FUNCTION public.open_seasonal_card_pack(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_seasonal_card_pack(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.seasonal_card_snapshot()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
	SELECT jsonb_build_object(
		'ok', true,
		'sets', COALESCE((SELECT jsonb_agg(jsonb_build_object('setKey', s.set_key, 'name', s.display_name, 'mappingVersion', s.mapping_version) ORDER BY s.set_key)
			FROM public.seasonal_card_sets s WHERE s.active), '[]'::jsonb),
		'inventory', COALESCE((SELECT jsonb_agg(jsonb_build_object('setKey', i.set_key, 'cardId', i.card_id, 'quantity', i.quantity, 'firstAcquiredAt', i.first_acquired_at) ORDER BY i.set_key, i.card_id)
			FROM public.user_seasonal_cards i WHERE i.user_id = auth.uid()), '[]'::jsonb),
		'grants', COALESCE((SELECT jsonb_agg(jsonb_build_object('grantId', g.id, 'setKey', g.set_key, 'source', g.source, 'sourceRef', g.source_ref, 'opened', g.opened_at IS NOT NULL) ORDER BY g.created_at)
			FROM public.seasonal_card_pack_grants g WHERE g.user_id = auth.uid()), '[]'::jsonb)
	)
$fn$;

REVOKE ALL ON FUNCTION public.seasonal_card_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seasonal_card_snapshot() TO authenticated;

INSERT INTO public.seasonal_card_sets(set_key, display_name, mapping_version, active, max_pack_cards)
VALUES ('halloween_2026_v1', 'Spooky Snouts', 1, false, 3);

-- One-time Halloween 2026 login gift. The campaign is deliberately seeded
-- inactive: applying this migration does not make any account eligible.
--
-- Costumes are consumable instances, not permanent hats. Keep their ownership
-- and provenance out of user_hats so a future consume/equip flow can retire an
-- instance without rewriting the historical gift receipt.

CREATE TABLE public.costume_catalog (
	id text PRIMARY KEY CHECK (id ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
	fit_policy_version integer NOT NULL CHECK (fit_policy_version > 0),
	active boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.login_gift_campaigns (
	campaign_key text PRIMARY KEY CHECK (campaign_key ~ '^[a-z0-9]+(_[a-z0-9]+)*_v[1-9][0-9]*$'),
	grant_key text NOT NULL CHECK (grant_key ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
	display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
	active boolean NOT NULL DEFAULT false,
	opens_at timestamptz NOT NULL,
	closes_at timestamptz NOT NULL CHECK (closes_at > opens_at),
	minimum_client_build integer NOT NULL CHECK (minimum_client_build > 0),
	fit_policy_version integer NOT NULL CHECK (fit_policy_version > 0),
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (campaign_key, grant_key)
);

CREATE TABLE public.login_gift_campaign_pool (
	campaign_key text NOT NULL REFERENCES public.login_gift_campaigns(campaign_key) ON DELETE RESTRICT,
	position integer NOT NULL CHECK (position > 0),
	costume_id text NOT NULL REFERENCES public.costume_catalog(id) ON DELETE RESTRICT,
	set_key text NOT NULL,
	card_id text NOT NULL,
	PRIMARY KEY (campaign_key, position),
	UNIQUE (campaign_key, costume_id),
	UNIQUE (campaign_key, card_id),
	FOREIGN KEY (set_key, card_id) REFERENCES public.seasonal_card_catalog(set_key, card_id) ON DELETE RESTRICT
);

CREATE TABLE public.login_gift_receipts (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	campaign_key text NOT NULL REFERENCES public.login_gift_campaigns(campaign_key) ON DELETE RESTRICT,
	grant_key text NOT NULL,
	costume_id text NOT NULL REFERENCES public.costume_catalog(id) ON DELETE RESTRICT,
	set_key text NOT NULL,
	card_id text NOT NULL,
	claimed_at timestamptz NOT NULL DEFAULT now(),
	acknowledged_at timestamptz,
	UNIQUE (user_id, grant_key),
	UNIQUE (id, user_id),
	FOREIGN KEY (campaign_key, grant_key) REFERENCES public.login_gift_campaigns(campaign_key, grant_key) ON DELETE RESTRICT,
	FOREIGN KEY (campaign_key, costume_id) REFERENCES public.login_gift_campaign_pool(campaign_key, costume_id) ON DELETE RESTRICT,
	FOREIGN KEY (campaign_key, card_id) REFERENCES public.login_gift_campaign_pool(campaign_key, card_id) ON DELETE RESTRICT,
	FOREIGN KEY (set_key, card_id) REFERENCES public.seasonal_card_catalog(set_key, card_id) ON DELETE RESTRICT
);

CREATE TABLE public.owned_costume_instances (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	costume_id text NOT NULL REFERENCES public.costume_catalog(id) ON DELETE RESTRICT,
	source_kind text NOT NULL CHECK (source_kind = 'login_gift'),
	source_receipt_id uuid NOT NULL,
	acquired_at timestamptz NOT NULL DEFAULT now(),
	consumed_at timestamptz,
	CHECK (consumed_at IS NULL OR consumed_at >= acquired_at),
	UNIQUE (source_receipt_id),
	FOREIGN KEY (source_receipt_id, user_id) REFERENCES public.login_gift_receipts(id, user_id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION public.prevent_login_gift_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $fn$
BEGIN
	IF TG_TABLE_NAME = 'login_gift_receipts' THEN
		IF (NEW.id, NEW.user_id, NEW.campaign_key, NEW.grant_key, NEW.costume_id, NEW.set_key, NEW.card_id, NEW.claimed_at)
			IS DISTINCT FROM
			(OLD.id, OLD.user_id, OLD.campaign_key, OLD.grant_key, OLD.costume_id, OLD.set_key, OLD.card_id, OLD.claimed_at) THEN
			RAISE EXCEPTION 'login gift receipt identity is immutable';
		END IF;
	ELSIF TG_TABLE_NAME = 'owned_costume_instances' THEN
		IF (NEW.id, NEW.user_id, NEW.costume_id, NEW.source_kind, NEW.source_receipt_id, NEW.acquired_at)
			IS DISTINCT FROM
			(OLD.id, OLD.user_id, OLD.costume_id, OLD.source_kind, OLD.source_receipt_id, OLD.acquired_at) THEN
			RAISE EXCEPTION 'owned costume provenance is immutable';
		END IF;
	END IF;
	RETURN NEW;
END
$fn$;

CREATE TRIGGER login_gift_receipt_identity_immutable
	BEFORE UPDATE ON public.login_gift_receipts
	FOR EACH ROW EXECUTE FUNCTION public.prevent_login_gift_identity_change();
CREATE TRIGGER owned_costume_provenance_immutable
	BEFORE UPDATE ON public.owned_costume_instances
	FOR EACH ROW EXECUTE FUNCTION public.prevent_login_gift_identity_change();

CREATE OR REPLACE FUNCTION public.prevent_login_gift_pool_change_after_claim()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
	v_old_campaign text;
	v_new_campaign text;
BEGIN
	v_old_campaign := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.campaign_key ELSE NULL END;
	v_new_campaign := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.campaign_key ELSE NULL END;
	IF EXISTS (
		SELECT 1 FROM public.login_gift_receipts
		WHERE campaign_key = v_old_campaign OR campaign_key = v_new_campaign
	) THEN
		RAISE EXCEPTION 'claimed login gift pool is frozen; create a new versioned campaign';
	END IF;
	IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
	RETURN NEW;
END
$fn$;

CREATE TRIGGER login_gift_pool_frozen_after_claim
	BEFORE INSERT OR UPDATE OR DELETE ON public.login_gift_campaign_pool
	FOR EACH ROW EXECUTE FUNCTION public.prevent_login_gift_pool_change_after_claim();

ALTER TABLE public.costume_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_gift_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_gift_campaign_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_gift_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owned_costume_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY login_gift_receipts_read_own ON public.login_gift_receipts
	FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY owned_costume_instances_read_own ON public.owned_costume_instances
	FOR SELECT USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.costume_catalog, public.login_gift_campaigns,
	public.login_gift_campaign_pool, public.login_gift_receipts,
	public.owned_costume_instances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.login_gift_receipts, public.owned_costume_instances TO authenticated;
REVOKE ALL ON FUNCTION public.prevent_login_gift_identity_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_login_gift_pool_change_after_claim() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.halloween_login_gift_receipt(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
	SELECT jsonb_build_object(
		'receiptId', r.id,
		'campaignKey', r.campaign_key,
		'costumeId', r.costume_id,
		'cardId', r.card_id,
		'claimedAt', r.claimed_at,
		'acknowledgedAt', r.acknowledged_at
	)
	FROM public.login_gift_receipts r
	WHERE r.id = p_receipt_id
$fn$;

REVOKE ALL ON FUNCTION public.halloween_login_gift_receipt(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_halloween_login_gift(
	p_client_build integer,
	p_fit_policy_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
	v_user uuid := auth.uid();
	v_campaign constant text := 'halloween_2026_login_gift_v1';
	v_grant_key constant text := 'halloween_2026_login_gift';
	v_config public.login_gift_campaigns%ROWTYPE;
	v_receipt public.login_gift_receipts%ROWTYPE;
	v_pick public.login_gift_campaign_pool%ROWTYPE;
	v_pool_size integer;
	v_now timestamptz := public._patch_now();
BEGIN
	IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

	-- A settled receipt always wins over current campaign state and client gates.
	SELECT * INTO v_receipt FROM public.login_gift_receipts
	WHERE user_id = v_user AND grant_key = v_grant_key;
	IF FOUND THEN
		RETURN jsonb_build_object('ok', true, 'status', 'replay',
			'receipt', public.halloween_login_gift_receipt(v_receipt.id));
	END IF;

	SELECT * INTO v_config FROM public.login_gift_campaigns WHERE campaign_key = v_campaign;
	IF NOT FOUND OR NOT v_config.active OR v_now < v_config.opens_at OR v_now >= v_config.closes_at THEN
		RETURN jsonb_build_object('ok', true, 'status', 'inactive');
	END IF;
	IF p_client_build IS NULL OR p_client_build < v_config.minimum_client_build THEN
		RETURN jsonb_build_object('ok', true, 'status', 'inactive', 'reason', 'client_build');
	END IF;
	IF p_fit_policy_version IS NULL OR p_fit_policy_version <> v_config.fit_policy_version THEN
		RETURN jsonb_build_object('ok', true, 'status', 'inactive', 'reason', 'fit_policy');
	END IF;

	-- Serialize first claim attempts for this account. The unique receipt is the
	-- final guard; the lock keeps card discovery and instance minting on one path.
	PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':' || v_campaign, 0));
	SELECT * INTO v_receipt FROM public.login_gift_receipts
	WHERE user_id = v_user AND grant_key = v_grant_key;
	IF FOUND THEN
		RETURN jsonb_build_object('ok', true, 'status', 'replay',
			'receipt', public.halloween_login_gift_receipt(v_receipt.id));
	END IF;

	-- Recheck activation after waiting for the lock so deactivation closes the gate.
	SELECT * INTO v_config FROM public.login_gift_campaigns WHERE campaign_key = v_campaign;
	IF NOT FOUND OR NOT v_config.active OR v_now < v_config.opens_at OR v_now >= v_config.closes_at
		OR p_client_build IS NULL OR p_client_build < v_config.minimum_client_build
		OR p_fit_policy_version IS NULL OR p_fit_policy_version <> v_config.fit_policy_version THEN
		RETURN jsonb_build_object('ok', true, 'status', 'inactive');
	END IF;

	SELECT count(*) INTO v_pool_size
	FROM public.login_gift_campaign_pool p
	JOIN public.costume_catalog c ON c.id = p.costume_id
	WHERE p.campaign_key = v_campaign
		AND p.set_key = 'halloween_2026_v1'
		AND p.costume_id IN (
			'halloween_2026_linen_lurker_costume', 'halloween_2026_starspell_costume',
			'halloween_2026_bat_nap_costume', 'halloween_2026_little_imp_costume',
			'halloween_2026_marshmallow_boo_costume'
		)
		AND c.active AND c.fit_policy_version = v_config.fit_policy_version;
	IF (SELECT count(*) FROM public.login_gift_campaign_pool WHERE campaign_key = v_campaign) <> 5 THEN
		RAISE EXCEPTION 'Halloween login gift pool is not the frozen five-item allowlist';
	END IF;
	IF v_pool_size <> 5 THEN
		RETURN jsonb_build_object('ok', true, 'status', 'inactive', 'reason', 'costume_catalog');
	END IF;

	SELECT p.* INTO v_pick
	FROM public.login_gift_campaign_pool p
	JOIN public.costume_catalog c ON c.id = p.costume_id
	WHERE p.campaign_key = v_campaign AND c.active
	ORDER BY p.position
	OFFSET floor(random() * v_pool_size)::integer LIMIT 1;

	INSERT INTO public.login_gift_receipts(user_id, campaign_key, grant_key, costume_id, set_key, card_id, claimed_at)
	VALUES (v_user, v_campaign, v_grant_key, v_pick.costume_id, v_pick.set_key, v_pick.card_id, v_now)
	RETURNING * INTO v_receipt;
	INSERT INTO public.owned_costume_instances(user_id, costume_id, source_kind, source_receipt_id, acquired_at)
	VALUES (v_user, v_pick.costume_id, 'login_gift', v_receipt.id, v_receipt.claimed_at);
	INSERT INTO public.user_seasonal_cards(user_id, set_key, card_id, quantity, first_acquired_at, updated_at)
	VALUES (v_user, v_pick.set_key, v_pick.card_id, 1, v_receipt.claimed_at, v_receipt.claimed_at)
	ON CONFLICT (user_id, set_key, card_id) DO UPDATE
	SET quantity = public.user_seasonal_cards.quantity + 1, updated_at = EXCLUDED.updated_at;

	RETURN jsonb_build_object('ok', true, 'status', 'new',
		'receipt', public.halloween_login_gift_receipt(v_receipt.id));
END
$fn$;

CREATE OR REPLACE FUNCTION public.acknowledge_halloween_login_gift(p_receipt_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $fn$
DECLARE
	v_user uuid := auth.uid();
	v_receipt public.login_gift_receipts%ROWTYPE;
BEGIN
	IF v_user IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
	UPDATE public.login_gift_receipts
	SET acknowledged_at = COALESCE(acknowledged_at, now())
	WHERE id = p_receipt_id AND user_id = v_user AND grant_key = 'halloween_2026_login_gift'
	RETURNING * INTO v_receipt;
	IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'status', 'inactive'); END IF;
	RETURN jsonb_build_object('ok', true, 'status', 'replay',
		'receipt', public.halloween_login_gift_receipt(v_receipt.id));
END
$fn$;

REVOKE ALL ON FUNCTION public.claim_halloween_login_gift(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acknowledge_halloween_login_gift(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_halloween_login_gift(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_halloween_login_gift(uuid) TO authenticated;

INSERT INTO public.costume_catalog(id, display_name, fit_policy_version, active) VALUES
	('halloween_2026_linen_lurker_costume', 'Linen Lurker', 1, false),
	('halloween_2026_starspell_costume', 'Starspell', 1, false),
	('halloween_2026_bat_nap_costume', 'Bat Nap', 1, false),
	('halloween_2026_little_imp_costume', 'Little Imp', 1, false),
	('halloween_2026_marshmallow_boo_costume', 'Marshmallow Boo', 1, false);

INSERT INTO public.seasonal_card_catalog(set_key, card_id, display_name, item_id) VALUES
	('halloween_2026_v1', 'halloween_2026_card_linen_lurker_costume', 'Linen Lurker', NULL),
	('halloween_2026_v1', 'halloween_2026_card_starspell_costume', 'Starspell', NULL),
	('halloween_2026_v1', 'halloween_2026_card_bat_nap_costume', 'Bat Nap', NULL),
	('halloween_2026_v1', 'halloween_2026_card_little_imp_costume', 'Little Imp', NULL),
	('halloween_2026_v1', 'halloween_2026_card_marshmallow_boo_costume', 'Marshmallow Boo', NULL)
ON CONFLICT (set_key, card_id) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO public.login_gift_campaigns(
	campaign_key, grant_key, display_name, active, opens_at, closes_at, minimum_client_build, fit_policy_version
) VALUES (
	'halloween_2026_login_gift_v1', 'halloween_2026_login_gift', 'Halloween 2026 Login Gift', false,
	'-infinity'::timestamptz, 'infinity'::timestamptz, 1, 1
);

INSERT INTO public.login_gift_campaign_pool(campaign_key, position, costume_id, set_key, card_id) VALUES
	('halloween_2026_login_gift_v1', 1, 'halloween_2026_linen_lurker_costume', 'halloween_2026_v1', 'halloween_2026_card_linen_lurker_costume'),
	('halloween_2026_login_gift_v1', 2, 'halloween_2026_starspell_costume', 'halloween_2026_v1', 'halloween_2026_card_starspell_costume'),
	('halloween_2026_login_gift_v1', 3, 'halloween_2026_bat_nap_costume', 'halloween_2026_v1', 'halloween_2026_card_bat_nap_costume'),
	('halloween_2026_login_gift_v1', 4, 'halloween_2026_little_imp_costume', 'halloween_2026_v1', 'halloween_2026_card_little_imp_costume'),
	('halloween_2026_login_gift_v1', 5, 'halloween_2026_marshmallow_boo_costume', 'halloween_2026_v1', 'halloween_2026_card_marshmallow_boo_costume');

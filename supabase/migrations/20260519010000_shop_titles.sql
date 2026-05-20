-- Shop-purchasable titles. Extends the existing `titles` catalog with
-- cost / rarity / display_order / for_sale, and adds:
--   - shop_titles()  → list of for-sale titles + ownership flag
--   - buy_title()    → atomic spend + grant
--
-- Battle-pass titles (the existing 9) stay for_sale=false so they
-- remain pass-exclusive. New titles below are flagged for_sale=true.

ALTER TABLE public.titles
	ADD COLUMN IF NOT EXISTS cost          integer,
	ADD COLUMN IF NOT EXISTS rarity        text
		CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
	ADD COLUMN IF NOT EXISTS display_order integer,
	ADD COLUMN IF NOT EXISTS for_sale      boolean NOT NULL DEFAULT false;

-- ── seed the new shop titles ──────────────────────────────────────
INSERT INTO public.titles
	(id, name, placement, description, cost, rarity, display_order, for_sale)
VALUES
	('mud_connoisseur', 'Mud Connoisseur', 'pre',  'Knows the good puddles.',         60,   'common',     10, true),
	('truffle_hunter',  'Truffle Hunter',  'pre',  'Sniffs out the rare bits.',       90,   'common',     11, true),
	('curly_tail',      'Curly Tail',      'post', 'Twirly, never tangled.',          75,   'common',     12, true),
	('ham_whisperer',   'Ham Whisperer',   'pre',  'Talks to the deli.',              220,  'uncommon',   20, true),
	('squeal_master',   'Squeal Master',   'pre',  'At full volume.',                 280,  'uncommon',   21, true),
	('sow_supreme',     'Sow Supreme',     'pre',  'A pig''s pig.',                   750,  'rare',       30, true),
	('notorious_pig',   'Notorious P.I.G.','pre',  'Iconic.',                         1200, 'rare',       31, true),
	('pork_royalty',    'Pork Royalty',    'post', 'Crowned by the pen.',             2800, 'epic',       40, true),
	('hog_of_honor',    'Hog of Honor',    'pre',  'Earned, not given.',              3500, 'epic',       41, true),
	('sty_sovereign',   'Sty Sovereign',   'pre',  'Reigns over the pen.',            8000, 'legendary',  50, true)
ON CONFLICT (id) DO NOTHING;

-- ── shop_titles RPC ───────────────────────────────────────────────
-- Returns every for-sale title with rarity / cost + whether the caller
-- already owns it. UI uses `owned` to gray out + swap CTA.
CREATE OR REPLACE FUNCTION public.shop_titles()
RETURNS TABLE (
	id            text,
	name          text,
	placement     text,
	description   text,
	cost          integer,
	rarity        text,
	display_order integer,
	owned         boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
	SELECT
		t.id,
		t.name,
		t.placement,
		t.description,
		t.cost,
		t.rarity,
		t.display_order,
		EXISTS (
			SELECT 1 FROM public.user_titles ut
			WHERE ut.user_id = auth.uid() AND ut.title_id = t.id
		) AS owned
	FROM public.titles t
	WHERE t.for_sale = true
	ORDER BY t.display_order NULLS LAST, t.id;
$function$;

GRANT EXECUTE ON FUNCTION public.shop_titles() TO authenticated;

-- ── buy_title RPC ─────────────────────────────────────────────────
-- Atomic: checks ownership, checks balance, debits counter, inserts
-- user_titles row. Returns ok + new_balance + reason on failure.
CREATE OR REPLACE FUNCTION public.buy_title(target_title_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id  uuid := auth.uid();
	title_row  record;
	prof_row   record;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT * INTO title_row FROM public.titles
		WHERE id = target_title_id AND for_sale = true;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'not_for_sale');
	END IF;
	IF title_row.cost IS NULL OR title_row.cost <= 0 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'invalid_price');
	END IF;

	-- Already owned → no-op success so the UI just marks it owned.
	IF EXISTS (
		SELECT 1 FROM public.user_titles
		WHERE user_id = caller_id AND title_id = target_title_id
	) THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'already_owned');
	END IF;

	SELECT counter INTO prof_row FROM public.profiles WHERE id = caller_id;
	IF NOT FOUND THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_profile');
	END IF;
	IF prof_row.counter < title_row.cost THEN
		RETURN jsonb_build_object(
			'ok', false, 'reason', 'insufficient_funds',
			'balance', prof_row.counter, 'cost', title_row.cost
		);
	END IF;

	-- Spend + grant in one transaction (RPC body is atomic).
	UPDATE public.profiles
		SET counter = counter - title_row.cost
		WHERE id = caller_id;
	INSERT INTO public.user_titles (user_id, title_id)
		VALUES (caller_id, target_title_id);

	RETURN jsonb_build_object(
		'ok', true,
		'title_id', target_title_id,
		'new_balance', prof_row.counter - title_row.cost
	);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buy_title(text) TO authenticated;

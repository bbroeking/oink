-- Truffle Patch relic rolls only choose undiscovered Burrow Book entries.
--
-- The board-level relic chance remains unchanged in open_rooting (40%). Once
-- that chance hits, roll_unique() now weights only pool entries the caller has
-- not unlocked. A complete Book therefore returns NULL and the board carries no
-- relic. Keeping the filter in the server roll makes every open_rooting caller
-- inherit the rule without carrying that large RPC body forward again.

-- Parameterized implementation also lets this migration repair already-open
-- boards without impersonating their owners. It is deliberately not granted to
-- clients; open_rooting invokes the zero-argument wrapper as its definer.
CREATE OR REPLACE FUNCTION public.roll_unique(p_user_id uuid)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	total numeric;
	pick  numeric;
	acc   numeric := 0;
	rec   record;
BEGIN
	SELECT sum(p.weight) INTO total
	FROM public.unique_pool() p
	WHERE NOT EXISTS (
		SELECT 1 FROM public.user_uniques u
		WHERE u.user_id = p_user_id AND u.unique_id = p.unique_id
	);

	-- No undiscovered entries remain: the caller's Book is complete.
	IF total IS NULL OR total <= 0 THEN
		RETURN NULL;
	END IF;

	pick := random() * total;
	FOR rec IN
		SELECT p.unique_id, p.weight
		FROM public.unique_pool() p
		WHERE NOT EXISTS (
			SELECT 1 FROM public.user_uniques u
			WHERE u.user_id = p_user_id AND u.unique_id = p.unique_id
		)
		ORDER BY p.unique_id
	LOOP
		acc := acc + rec.weight;
		IF pick < acc THEN RETURN rec.unique_id; END IF;
	END LOOP;

	-- Numeric edge: return the last eligible id, never an owned one.
	RETURN (
		SELECT p.unique_id
		FROM public.unique_pool() p
		WHERE NOT EXISTS (
			SELECT 1 FROM public.user_uniques u
			WHERE u.user_id = p_user_id AND u.unique_id = p.unique_id
		)
		ORDER BY p.unique_id DESC
		LIMIT 1
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.roll_unique()
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.roll_unique(auth.uid());
$function$;

REVOKE ALL ON FUNCTION public.roll_unique(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.roll_unique() FROM PUBLIC, anon, authenticated;

-- A duplicate may already be sitting on an unsubmitted board created before
-- this migration. Swap it for an undiscovered weighted pick (or NULL for a
-- complete Book) so an in-progress dig cannot still award an owned relic.
UPDATE public.war_rootings wr
SET unique_id = public.roll_unique(wr.user_id)
WHERE wr.submitted_at IS NULL
  AND wr.unique_id IS NOT NULL
  AND EXISTS (
	SELECT 1 FROM public.user_uniques u
	WHERE u.user_id = wr.user_id AND u.unique_id = wr.unique_id
  );

-- Likewise, discard legacy carry-over relics that have since been unlocked.
-- New carry slots cannot hit this state because their originating board now
-- contains only an undiscovered relic.
DELETE FROM public.user_patch_carry c
WHERE c.kind = 'unique'
  AND EXISTS (
	SELECT 1 FROM public.user_uniques u
	WHERE u.user_id = c.user_id AND u.unique_id = c.unique_id
  );

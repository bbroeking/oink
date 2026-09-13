-- Mote Machine economy boundary.
--
-- A submitted Truffle Patch containing a shimmer credits exactly one Mote.
-- One idempotent spin spends exactly one Mote and grants a server-selected
-- bundle to the caller's spendable Tickle pool. Rive is presentation only.
--
-- Authored only. Applying this migration still requires the founder's explicit
-- database-push "go".

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS mote_balance int NOT NULL DEFAULT 0
	CHECK (mote_balance >= 0);

-- Existing submitted shimmers predate the spendable wallet. At migration time
-- none can have been spent, so the canonical submitted-rooting history is the
-- complete opening balance.
UPDATE public.profiles p
SET mote_balance = earned.motes
FROM (
	SELECT r.user_id, count(*)::int AS motes
	FROM public.war_rootings r
	WHERE r.submitted_at IS NOT NULL
		AND 'shimmer' = ANY (COALESCE(r.finds, ARRAY[]::text[]))
	GROUP BY r.user_id
) earned
WHERE p.id = earned.user_id;

CREATE OR REPLACE FUNCTION public.credit_rooting_mote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
	IF OLD.submitted_at IS NULL
		AND NEW.submitted_at IS NOT NULL
		AND 'shimmer' = ANY (COALESCE(NEW.finds, ARRAY[]::text[]))
	THEN
		UPDATE public.profiles
		SET mote_balance = mote_balance + 1
		WHERE id = NEW.user_id;
	END IF;
	RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.credit_rooting_mote() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS war_rootings_credit_mote ON public.war_rootings;
CREATE TRIGGER war_rootings_credit_mote
	AFTER UPDATE OF submitted_at ON public.war_rootings
	FOR EACH ROW EXECUTE FUNCTION public.credit_rooting_mote();

-- Durable receipt + idempotency ledger. The app supplies a fresh request id
-- per lever pull and may safely repeat the same request after an uncertain
-- network result without spending a second Mote.
CREATE TABLE public.mote_machine_spins (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	request_id text NOT NULL CHECK (length(request_id) BETWEEN 8 AND 128),
	warmth smallint NOT NULL CHECK (warmth BETWEEN 0 AND 2),
	whirl smallint NOT NULL CHECK (whirl BETWEEN 0 AND 2),
	resonance smallint NOT NULL CHECK (resonance BETWEEN 0 AND 2),
	reward_tickles int NOT NULL CHECK (reward_tickles IN (0, 3, 5, 10, 25)),
	motes_remaining int NOT NULL CHECK (motes_remaining >= 0),
	tickles_balance int NOT NULL CHECK (tickles_balance >= 0),
	spun_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (user_id, request_id)
);

ALTER TABLE public.mote_machine_spins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View your Mote Machine receipts"
	ON public.mote_machine_spins FOR SELECT
	USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mote_machine_state()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	balance int;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;

	SELECT mote_balance INTO balance
	FROM public.profiles
	WHERE id = caller_id;

	IF balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
	END IF;

	RETURN jsonb_build_object(
		'ok', true,
		'motes', balance,
		'rewards', jsonb_build_array(
			jsonb_build_object('tickles', 0,  'chance', 20),
			jsonb_build_object('tickles', 3,  'chance', 34),
			jsonb_build_object('tickles', 5,  'chance', 25),
			jsonb_build_object('tickles', 10, 'chance', 14),
			jsonb_build_object('tickles', 25, 'chance', 7)
		)
	);
END;
$function$;

CREATE OR REPLACE FUNCTION public.spin_mote_machine(
	p_request_id text,
	p_warmth int,
	p_whirl int,
	p_resonance int
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
	balance int;
	draw double precision;
	reward int;
	zero_weight int;
	three_weight int;
	five_weight int;
	ten_weight int;
	twenty_five_weight int;
	new_tickle_balance int;
	prior public.mote_machine_spins%ROWTYPE;
	receipt public.mote_machine_spins%ROWTYPE;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	IF p_request_id IS NULL OR length(p_request_id) NOT BETWEEN 8 AND 128 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_request_id');
	END IF;
	IF p_warmth IS NULL
		OR p_whirl IS NULL
		OR p_resonance IS NULL
		OR p_warmth NOT BETWEEN 0 AND 2
		OR p_whirl NOT BETWEEN 0 AND 2
		OR p_resonance NOT BETWEEN 0 AND 2
	THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_recipe');
	END IF;

	-- The profile lock serializes every spin for this pig. Re-check the receipt
	-- after acquiring it so two concurrent copies of one request collapse to the
	-- same confirmed result.
	SELECT mote_balance INTO balance
	FROM public.profiles
	WHERE id = caller_id
	FOR UPDATE;

	IF balance IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'profile_missing');
	END IF;

	SELECT * INTO prior
	FROM public.mote_machine_spins
	WHERE user_id = caller_id AND request_id = p_request_id;

	IF prior.id IS NOT NULL THEN
		RETURN jsonb_build_object(
			'ok', true,
			'spin_id', prior.id,
			'reward_tickles', prior.reward_tickles,
			'warmth', prior.warmth,
			'whirl', prior.whirl,
			'resonance', prior.resonance,
			'motes_remaining', prior.motes_remaining,
			'tickles_balance', prior.tickles_balance,
			'replayed', true
		);
	END IF;

	IF balance < 1 THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'no_motes', 'motes', 0);
	END IF;

	-- Reward choice is server-owned. Each control changes a set of weights. Each
	-- recipe still allows all five results, and every recipe sums to 100.
	zero_weight := 20
		+ CASE p_warmth WHEN 0 THEN 5 WHEN 2 THEN -5 ELSE 0 END
		+ CASE p_whirl WHEN 0 THEN 2 WHEN 2 THEN -2 ELSE 0 END
		+ CASE p_resonance WHEN 0 THEN -3 WHEN 2 THEN 3 ELSE 0 END;
	three_weight := 34
		+ CASE p_warmth WHEN 0 THEN 2 WHEN 2 THEN -2 ELSE 0 END
		+ CASE p_whirl WHEN 0 THEN 5 WHEN 2 THEN -5 ELSE 0 END
		+ CASE p_resonance WHEN 0 THEN 3 WHEN 2 THEN -3 ELSE 0 END;
	five_weight := 25
		+ CASE p_warmth WHEN 0 THEN -4 WHEN 2 THEN 4 ELSE 0 END
		+ CASE p_whirl WHEN 0 THEN 1 WHEN 2 THEN -1 ELSE 0 END
		+ CASE p_resonance WHEN 0 THEN 3 WHEN 2 THEN -3 ELSE 0 END;
	ten_weight := 14
		+ CASE p_warmth WHEN 0 THEN -2 WHEN 2 THEN 2 ELSE 0 END
		+ CASE p_whirl WHEN 0 THEN -5 WHEN 2 THEN 5 ELSE 0 END
		+ CASE p_resonance WHEN 0 THEN -2 WHEN 2 THEN 2 ELSE 0 END;
	twenty_five_weight := 7
		+ CASE p_warmth WHEN 0 THEN -1 WHEN 2 THEN 1 ELSE 0 END
		+ CASE p_whirl WHEN 0 THEN -3 WHEN 2 THEN 3 ELSE 0 END
		+ CASE p_resonance WHEN 0 THEN -1 WHEN 2 THEN 1 ELSE 0 END;

	IF zero_weight + three_weight + five_weight + ten_weight + twenty_five_weight <> 100 THEN
		RAISE EXCEPTION 'Mote Alchemy weights must sum to 100';
	END IF;

	draw := random() * 100;
	reward := CASE
		WHEN draw < zero_weight THEN 0
		WHEN draw < zero_weight + three_weight THEN 3
		WHEN draw < zero_weight + three_weight + five_weight THEN 5
		WHEN draw < zero_weight + three_weight + five_weight + ten_weight THEN 10
		ELSE 25
	END;

	UPDATE public.profiles
	SET mote_balance = mote_balance - 1
	WHERE id = caller_id
	RETURNING mote_balance INTO balance;

	new_tickle_balance := public.grant_tickles(caller_id, reward);

	INSERT INTO public.mote_machine_spins (
		user_id, request_id, warmth, whirl, resonance,
		reward_tickles, motes_remaining, tickles_balance
	) VALUES (
		caller_id, p_request_id, p_warmth, p_whirl, p_resonance,
		reward, balance, new_tickle_balance
	)
	RETURNING * INTO receipt;

	RETURN jsonb_build_object(
		'ok', true,
		'spin_id', receipt.id,
		'reward_tickles', receipt.reward_tickles,
		'warmth', receipt.warmth,
		'whirl', receipt.whirl,
		'resonance', receipt.resonance,
		'motes_remaining', receipt.motes_remaining,
		'tickles_balance', receipt.tickles_balance,
		'replayed', false
	);
END;
$function$;

REVOKE ALL ON FUNCTION public.mote_machine_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.spin_mote_machine(text, int, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mote_machine_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spin_mote_machine(text, int, int, int) TO authenticated;

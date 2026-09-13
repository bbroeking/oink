-- Durable, owner-readable Truffle Patch receipts.
-- Wraps the latest three-argument reward function without changing its client
-- signature. The receipt insert commits atomically with every reward mutation.

CREATE TABLE public.rooting_receipts (
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	window_index bigint NOT NULL,
	receipt jsonb NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY(user_id,window_index),
	CHECK (receipt->>'ok' = 'true')
);
ALTER TABLE public.rooting_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rooting_receipts FROM PUBLIC,anon,authenticated;

ALTER FUNCTION public.submit_rooting(text[],int,text[])
	RENAME TO _submit_rooting_reward_v1;
REVOKE ALL ON FUNCTION public._submit_rooting_reward_v1(text[],int,text[])
	FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.rooting_receipt(p_window_index bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT COALESCE(
		(SELECT rr.receipt FROM public.rooting_receipts rr
		 WHERE rr.user_id=auth.uid() AND rr.window_index=p_window_index),
		jsonb_build_object('ok',false,'reason','no_receipt')
	);
$function$;
REVOKE ALL ON FUNCTION public.rooting_receipt(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rooting_receipt(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_rooting(
	p_finds text[],p_actions int,p_missed text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid:=auth.uid(); v_now timestamptz:=public._patch_now();
	clock record; prior jsonb; result jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok',false,'reason','unauthenticated');
	END IF;
	SELECT * INTO clock FROM public._patch_clock(v_now);
	-- Serialize the read/reward/write sequence. A concurrent retry waits for the
	-- first transaction, then observes and returns its exact stored receipt.
	PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text||':'||clock.window_index::text,0));
	SELECT receipt INTO prior FROM public.rooting_receipts
	WHERE user_id=caller_id AND window_index=clock.window_index;
	IF prior IS NOT NULL THEN RETURN prior; END IF;

	result:=public._submit_rooting_reward_v1(p_finds,p_actions,p_missed);
	IF COALESCE((result->>'ok')::boolean,false) THEN
		INSERT INTO public.rooting_receipts(user_id,window_index,receipt)
		VALUES(caller_id,clock.window_index,result)
		ON CONFLICT(user_id,window_index) DO NOTHING;
		SELECT receipt INTO result FROM public.rooting_receipts
		WHERE user_id=caller_id AND window_index=clock.window_index;
	END IF;
	RETURN result;
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[],int,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[],int,text[]) TO authenticated;

-- Preserve the legacy two-argument RPC, but route it through the protected
-- three-argument entry point rather than its renamed function dependency.
CREATE OR REPLACE FUNCTION public.submit_rooting(p_finds text[],p_actions int)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
	SELECT public.submit_rooting(p_finds,p_actions,ARRAY[]::text[]);
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting(text[],int) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting(text[],int) TO authenticated;

-- New clients bind the board owner and server-issued window into the database
-- call itself. An old receipt remains readable after rollover, while a new
-- reward can only be minted for the authenticated owner in the current window.
CREATE OR REPLACE FUNCTION public.submit_rooting_checked(
	p_user_id uuid,p_window_index bigint,p_finds text[],p_actions int,p_missed text[]
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid:=auth.uid(); clock record; prior jsonb;
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok',false,'reason','unauthenticated');
	END IF;
	IF caller_id IS DISTINCT FROM p_user_id THEN
		RETURN jsonb_build_object('ok',false,'reason','account_changed');
	END IF;
	PERFORM pg_advisory_xact_lock(hashtextextended(caller_id::text||':'||p_window_index::text,0));
	SELECT receipt INTO prior FROM public.rooting_receipts
	WHERE user_id=caller_id AND window_index=p_window_index;
	IF prior IS NOT NULL THEN RETURN prior; END IF;
	SELECT * INTO clock FROM public._patch_clock(public._patch_now());
	IF clock.window_index IS DISTINCT FROM p_window_index THEN
		RETURN jsonb_build_object('ok',false,'reason','window_changed');
	END IF;
	RETURN public.submit_rooting(p_finds,p_actions,p_missed);
END;
$function$;
REVOKE ALL ON FUNCTION public.submit_rooting_checked(uuid,bigint,text[],int,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_rooting_checked(uuid,bigint,text[],int,text[]) TO authenticated;

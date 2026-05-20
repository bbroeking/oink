-- Expo push token storage + helpers.
--
-- The token comes from expo-notifications on the client and looks like
-- `ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]`. We POST it (along with a
-- payload) to https://exp.host/--/api/v2/push/send when we want to
-- deliver a notification; Expo's service forwards it to APNs.
--
-- Server-side delivery via Postgres trigger lives in a follow-up
-- migration once Apple Push credentials are wired in EAS.

ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS expo_push_token text,
	ADD COLUMN IF NOT EXISTS push_permission_granted boolean NOT NULL DEFAULT false;

-- Self-update RPC so the client doesn't need direct UPDATE rights on
-- profiles.expo_push_token (the rest of the row is RLS-protected).
CREATE OR REPLACE FUNCTION public.set_push_token(token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
	caller_id uuid := auth.uid();
BEGIN
	IF caller_id IS NULL THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'unauthenticated');
	END IF;
	-- Loose validation: Expo tokens are alphanumeric inside brackets.
	IF token IS NOT NULL AND token !~ '^ExponentPushToken\[[A-Za-z0-9_-]+\]$' THEN
		RETURN jsonb_build_object('ok', false, 'reason', 'bad_token_format');
	END IF;
	UPDATE public.profiles
		SET expo_push_token = token,
		    push_permission_granted = (token IS NOT NULL)
		WHERE id = caller_id;
	RETURN jsonb_build_object('ok', true);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_push_token(text) TO authenticated;

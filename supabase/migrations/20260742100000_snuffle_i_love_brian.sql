-- One-off: a thank-you push to the player "I Love Brian" — and, not
-- incidentally, the first REAL end-to-end delivery test of the push lane
-- since 20260741000000 fixed it (send_push_to_user is server-only as of
-- 20260741100000, so a migration — running as postgres — is the sending
-- lane). Founder-directed.
--
-- Fail-soft by construction: if the exact username isn't found, it lists
-- lookalikes in a NOTICE and sends nothing; the envelope (no_token vs
-- request_id) is NOTICEd either way. In the local harness the profile
-- won't exist, so replays no-op.

DO $$
DECLARE
	target record;
	result jsonb;
BEGIN
	SELECT id, username,
	       (expo_push_token IS NOT NULL AND expo_push_token <> '') AS has_token
		INTO target
		FROM public.profiles
		WHERE username = 'I Love Brian';

	IF target.id IS NULL THEN
		RAISE NOTICE 'snuffle: no exact profile "I Love Brian"; candidates: %',
			COALESCE((SELECT string_agg(username, ' | ')
			          FROM public.profiles WHERE username ILIKE '%brian%'), '(none)');
		RETURN;
	END IF;

	RAISE NOTICE 'snuffle: target "%" (has_token: %)', target.username, target.has_token;
	result := public.send_push_to_user(
		target.id,
		'oink!',
		'a little snuffle of thanks from the bog — the pigs are glad you''re here.',
		jsonb_build_object('kind', 'founder_hello')
	);
	RAISE NOTICE 'snuffle: send envelope %', result;
END $$;

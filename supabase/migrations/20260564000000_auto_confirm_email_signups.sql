-- Auto-confirm email signups so the email/password fallback path
-- works without a verification round-trip.
--
-- Why: the email/password flow added in SupaAuth gives players
-- without an Apple ID a way to make an account. Supabase's default
-- behavior is to send a confirmation email containing a magic link
-- — but that link points at Supabase's hosted page, which doesn't
-- deep-link back into the app cleanly. For v1 we'd rather let the
-- user sign in immediately after signup; configuring the redirect
-- + universal-link wiring can come later if email-verified
-- accounts become a meaningful spam vector.
--
-- Security: Supabase still hashes passwords (bcrypt) and rate-limits
-- signup. The auto-confirm only sets email_confirmed_at — it doesn't
-- bypass any other auth check. Apple Sign-In remains the primary
-- recommended path; this is a fallback.
--
-- Apple Sign-In already creates rows with email_confirmed_at = now()
-- (the OIDC flow is verified by Apple). Only the email provider is
-- affected here.

CREATE OR REPLACE FUNCTION public.auto_confirm_email_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
	-- Only fire for fresh email-provider signups whose email isn't
	-- already confirmed (Supabase's email + password flow). Other
	-- providers leave the field set themselves.
	IF NEW.email_confirmed_at IS NULL
	   AND NEW.raw_app_meta_data->>'provider' = 'email' THEN
		NEW.email_confirmed_at := now();
	END IF;
	RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS auto_confirm_email_signup ON auth.users;
CREATE TRIGGER auto_confirm_email_signup
	BEFORE INSERT ON auth.users
	FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_email_signup();

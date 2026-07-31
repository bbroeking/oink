-- Minimal production dependency for the Sounder recruiting migration.
-- Block behavior itself is covered elsewhere; this harness fixture keeps every
-- synthetic player mutually visible so recruiting behavior can be isolated.
ALTER TABLE public.profiles
	ADD COLUMN IF NOT EXISTS discriminator text;

CREATE OR REPLACE FUNCTION public.are_blocked(uuid, uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;

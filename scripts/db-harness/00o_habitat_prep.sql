-- Minimal production dependencies for the housing migration. The full harness
-- deliberately does not replay the older guestbook migration.
CREATE EXTENSION IF NOT EXISTS dblink;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
	SELECT NULLIF(current_setting('smoke.uid',true),'')::uuid $$;
CREATE TABLE IF NOT EXISTS public.barn_guestbook_stamps (
	id bigserial PRIMARY KEY,
	visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	visit_started_at timestamptz NOT NULL,
	stamp_id text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE(visitor_id,host_id,visit_started_at)
);
CREATE OR REPLACE FUNCTION public.are_blocked(a uuid,b uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
	SELECT current_setting('smoke.blocked_pair',true)=a::text||':'||b::text
		OR current_setting('smoke.blocked_pair',true)=b::text||':'||a::text $$;

-- Add the four social tables to the supabase_realtime publication
-- so the client can subscribe to per-user Postgres changes (Tier 1
-- realtime scope — see Friends/Inbox + Barn wiring landing in
-- the same commit pair).
--
-- Tables:
--   curses          — receiver gets a chip + miasma overlay
--   blessings       — receiver gets a chip + glow overlay
--   tickle_trades   — both parties see the trade flip in/out of inbox
--   friendships     — both parties see acceptance flip the list
--
-- All four already enforce RLS that restricts SELECT to rows
-- the caller is party to (SELECT policies were added in their
-- original migrations). Realtime piggybacks on those policies —
-- a client subscribing to "all changes on table X" only receives
-- rows it can SELECT, so adding the tables to the publication is
-- safe without per-row filtering at the publication layer.
--
-- REPLICA IDENTITY:
--   • curses, blessings, tickle_trades — PRIMARY KEY (id uuid).
--     DEFAULT replica identity is sufficient for INSERT + UPDATE
--     replication (only PK columns + changed columns ship).
--   • friendships — composite PRIMARY KEY (requester_id,
--     receiver_id). Also fine with DEFAULT — both PK columns ship,
--     plus any column that changed (e.g. status pending → accepted).
--
-- Each ALTER PUBLICATION is wrapped in a DO block that no-ops if
-- the table is already in the publication, so this migration is
-- safe to re-run.

DO $$
DECLARE
	pub_name   constant text := 'supabase_realtime';
	tbl_names  constant text[] := ARRAY[
		'curses', 'blessings', 'tickle_trades', 'friendships'
	];
	tbl text;
BEGIN
	FOREACH tbl IN ARRAY tbl_names LOOP
		IF NOT EXISTS (
			SELECT 1
			FROM pg_publication_tables
			WHERE pubname = pub_name
			  AND schemaname = 'public'
			  AND tablename = tbl
		) THEN
			EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.%I', pub_name, tbl);
		END IF;
	END LOOP;
END $$;

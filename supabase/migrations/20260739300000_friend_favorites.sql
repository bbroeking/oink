-- Friend favorites — pin friends to the top of the Friends list.
--
-- A tiny owner-only join table: (user_id, friend_id). No RPC — the client
-- reads/writes it directly through PostgREST under RLS, exactly like the other
-- small self-scoped tables (user_blocks, user_uniques, user_patch_carry). The
-- star toggle inserts/deletes one row; the list load selects the caller's set.
--
-- RLS is owner-only on user_id (auth.uid()): you can only see, pin, and unpin
-- YOUR OWN favorites. friend_id is not gated (it's just the pinned target) —
-- the row is private to the pinner either way, and a favorite is a one-way,
-- personal ordering hint, not a mutual relationship.

CREATE TABLE IF NOT EXISTS public.friend_favorites (
	user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	friend_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	created_at timestamptz NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, friend_id)
);

ALTER TABLE public.friend_favorites ENABLE ROW LEVEL SECURITY;

-- Owner-only select / insert / delete. Mirrors user_blocks' "view own"
-- style, extended to the write paths the client needs for the star toggle.
DROP POLICY IF EXISTS "view own favorites" ON public.friend_favorites;
CREATE POLICY "view own favorites"
	ON public.friend_favorites FOR SELECT
	USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pin own favorites" ON public.friend_favorites;
CREATE POLICY "pin own favorites"
	ON public.friend_favorites FOR INSERT
	WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "unpin own favorites" ON public.friend_favorites;
CREATE POLICY "unpin own favorites"
	ON public.friend_favorites FOR DELETE
	USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.friend_favorites TO authenticated;

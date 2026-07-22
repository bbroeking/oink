-- Lounge realtime hardening (P2-final, docs/lounge-farm-spec.md):
-- members-only authorization for the lounge:* channels. Private channels +
-- RLS on realtime.messages: only Slop Club members (profiles.is_vip) may
-- join/broadcast/track presence on lounge shards. The client flips
-- { config: { private: true } } when this lands.
CREATE POLICY "lounge_members_read" ON realtime.messages
	FOR SELECT TO authenticated
	USING (
		realtime.topic() LIKE 'lounge:%'
		AND EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = (SELECT auth.uid()) AND p.is_vip
		)
	);
CREATE POLICY "lounge_members_write" ON realtime.messages
	FOR INSERT TO authenticated
	WITH CHECK (
		realtime.topic() LIKE 'lounge:%'
		AND EXISTS (
			SELECT 1 FROM public.profiles p
			WHERE p.id = (SELECT auth.uid()) AND p.is_vip
		)
	);

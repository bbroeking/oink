-- ============================================================================
-- Make demo_rosie a Slop Club member (VIP) — scoped preview of every membership
-- benefit: premium battle-pass unlocked, members-only shop band, 250 stipend,
-- double tickle bank (50). Reverse with scripts/simulate_rosie_vip_undo.sql.
-- Touches NO other account. Run in Supabase SQL editor or via
--   npx supabase db query --linked --file scripts/simulate_rosie_vip.sql
-- ============================================================================
UPDATE public.profiles
   SET is_vip    = true,
       vip_until = now() + interval '1 year'
 WHERE lower(username) = 'demo_rosie';

-- Undo the demo_rosie VIP preview (scripts/simulate_rosie_vip.sql).
UPDATE public.profiles
   SET is_vip    = false,
       vip_until = NULL
 WHERE lower(username) = 'demo_rosie';

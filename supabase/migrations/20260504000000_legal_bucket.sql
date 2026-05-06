-- Public storage bucket for legal docs (privacy policy, ToS).
-- After this migration, upload privacy-policy.html via Supabase dashboard:
--   Storage → legal → Upload → privacy-policy.html
-- It will be available at:
--   https://wbcnhvvakptoinwkulmn.supabase.co/storage/v1/object/public/legal/privacy-policy.html

INSERT INTO storage.buckets (id, name, public)
VALUES ('legal', 'legal', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow anyone to read (public bucket)
CREATE POLICY "Legal docs are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'legal');

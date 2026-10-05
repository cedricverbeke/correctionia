/*
# Create storage bucket for assignment files (énoncé/corrigé PDFs)

1. Storage
- Create a public bucket `assignment-files` for teacher-uploaded énoncé and corrigé PDFs.
- Public read so students can download subject/correction files.
- Allow anon + authenticated to upload and delete (teacher manages).
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anon_upload_assignment_files" ON storage.objects;
CREATE POLICY "anon_upload_assignment_files" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'assignment-files');

DROP POLICY IF EXISTS "anon_read_assignment_files" ON storage.objects;
CREATE POLICY "anon_read_assignment_files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'assignment-files');

DROP POLICY IF EXISTS "anon_delete_assignment_files" ON storage.objects;
CREATE POLICY "anon_delete_assignment_files" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'assignment-files');

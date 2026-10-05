/*
# Create storage bucket for homework files

1. Storage
- Create a public bucket `homework-files` to store student uploads (PDFs, images, text files).
- Public read so teachers can preview/download attachments.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-files', 'homework-files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload and read files in the homework-files bucket
DROP POLICY IF EXISTS "anon_upload_homework_files" ON storage.objects;
CREATE POLICY "anon_upload_homework_files" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'homework-files');

DROP POLICY IF EXISTS "anon_read_homework_files" ON storage.objects;
CREATE POLICY "anon_read_homework_files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'homework-files');

DROP POLICY IF EXISTS "anon_delete_homework_files" ON storage.objects;
CREATE POLICY "anon_delete_homework_files" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'homework-files');

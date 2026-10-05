/*
# Create homework submissions table

1. New Tables
- `submissions`
  - `id` (uuid, primary key)
  - `student_name` (text, name of the student)
  - `subject` (text, subject/class selected by student)
  - `exercise_title` (text, the assignment title/instructions)
  - `text_answer` (text, free-text answer if no file uploaded)
  - `file_url` (text, public URL of uploaded file in storage)
  - `file_name` (text, original filename)
  - `file_type` (text, mime type of uploaded file)
  - `ai_note` (numeric, AI suggested grade out of 20, nullable until analysis completes)
  - `ai_points_forts` (text[], list of strengths identified by AI)
  - `ai_axes_amelioration` (text[], list of improvement areas)
  - `ai_commentaire` (text, overall constructive comment)
  - `ai_status` (text, status of AI analysis: 'pending', 'analyzed', 'failed')
  - `validation_status` (text, teacher validation: 'a_relire', 'valide', 'modifie', default 'a_relire')
  - `final_note` (numeric, teacher-validated grade, nullable)
  - `final_comment` (text, teacher-validated comment, nullable)
  - `created_at` (timestamptz, submission timestamp)

2. Security
- Enable RLS on `submissions`.
- Single-tenant no-auth app: allow anon + authenticated CRUD (data is intentionally shared within the classroom).
*/

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  subject text NOT NULL,
  exercise_title text NOT NULL,
  text_answer text,
  file_url text,
  file_name text,
  file_type text,
  ai_note numeric(4,1),
  ai_points_forts text[] DEFAULT '{}',
  ai_axes_amelioration text[] DEFAULT '{}',
  ai_commentaire text,
  ai_status text NOT NULL DEFAULT 'pending',
  validation_status text NOT NULL DEFAULT 'a_relire',
  final_note numeric(4,1),
  final_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_submissions" ON submissions;
CREATE POLICY "anon_select_submissions" ON submissions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_submissions" ON submissions;
CREATE POLICY "anon_insert_submissions" ON submissions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_submissions" ON submissions;
CREATE POLICY "anon_update_submissions" ON submissions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_submissions" ON submissions;
CREATE POLICY "anon_delete_submissions" ON submissions FOR DELETE
  TO anon, authenticated USING (true);

-- Index for dashboard sorting by most recent
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);

/*
# Retry: Add students, assignments, auth functions, and teacher settings

## New Tables
- students: MPSI students with name and hashed 4-digit PIN
- assignments: math assignments with title, enonce/corrige/bareme text, optional PDF URLs
- teacher_settings: single-row table holding the teacher password hash

## New Views
- student_list: exposes only id and name from students (NOT pin_hash)

## Modified Tables
- submissions: added student_id, assignment_id, ai_detail

## Security
- RLS enabled on students, assignments, teacher_settings
- SECURITY DEFINER functions for PIN/password verification and student management
- student_list view grants SELECT to anon

## Default Data
- Teacher password: "MPSI2026!"
- 5 sample MPSI students with default PINs
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE VIEW student_list AS
SELECT id, name FROM students ORDER BY name ASC;

CREATE TABLE IF NOT EXISTS assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  enonce_text text,
  corrige_text text,
  bareme_text text,
  enonce_url text,
  enonce_name text,
  corrige_url text,
  corrige_name text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_settings (
  id int PRIMARY KEY DEFAULT 1,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS student_id uuid;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS assignment_id uuid;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS ai_detail text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_student_id_fkey') THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_student_id_fkey
      FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'submissions_assignment_id_fkey') THEN
    ALTER TABLE submissions ADD CONSTRAINT submissions_assignment_id_fkey
      FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_assignments" ON assignments;
CREATE POLICY "anon_select_assignments" ON assignments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_assignments" ON assignments;
CREATE POLICY "anon_insert_assignments" ON assignments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_assignments" ON assignments;
CREATE POLICY "anon_update_assignments" ON assignments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_assignments" ON assignments;
CREATE POLICY "anon_delete_assignments" ON assignments FOR DELETE
  TO anon, authenticated USING (true);

GRANT SELECT ON student_list TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_student_pin(p_name text, p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_hash text;
BEGIN
  SELECT id, pin_hash INTO v_id, v_hash FROM students WHERE name = p_name LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Élève introuvable');
  END IF;
  IF v_hash = crypt(p_pin, v_hash) THEN
    RETURN json_build_object('success', true, 'student_id', v_id, 'name', p_name);
  ELSE
    RETURN json_build_object('success', false, 'error', 'Code PIN incorrect');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_teacher_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM teacher_settings WHERE id = 1;
  IF NOT FOUND THEN RETURN false; END IF;
  RETURN v_hash = crypt(p_password, v_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_student(p_name text, p_pin text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO students (name, pin_hash) VALUES (p_name, crypt(p_pin, gen_salt('bf')))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_student_pin(p_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE students SET pin_hash = crypt(p_pin, gen_salt('bf')) WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_student(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM students WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_teacher_password(p_old text, p_new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_hash text;
BEGIN
  SELECT password_hash INTO v_hash FROM teacher_settings WHERE id = 1;
  IF NOT FOUND OR v_hash != crypt(p_old, v_hash) THEN RETURN false; END IF;
  UPDATE teacher_settings SET password_hash = crypt(p_new, gen_salt('bf')) WHERE id = 1;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_student_pin(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_teacher_password(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_student(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_student_pin(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_student(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_teacher_password(text, text) TO anon, authenticated;

INSERT INTO teacher_settings (id, password_hash)
VALUES (1, crypt('MPSI2026!', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;

INSERT INTO students (name, pin_hash) VALUES
  ('Alice Bernard', crypt('1234', gen_salt('bf'))),
  ('Thomas Chen', crypt('2345', gen_salt('bf'))),
  ('Marine Dubois', crypt('3456', gen_salt('bf'))),
  ('Lucas Martin', crypt('4567', gen_salt('bf'))),
  ('Emma Petit', crypt('5678', gen_salt('bf')))
ON CONFLICT (name) DO NOTHING;

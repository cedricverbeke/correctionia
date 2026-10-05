/*
# Fix crypt/gen_salt schema issue

The pgcrypto extension installs crypt() and gen_salt() in the "extensions" schema,
not "public". The SECURITY DEFINER functions had search_path = public, so they
could not find crypt(). This migration:

1. Drops and recreates all SECURITY DEFINER functions with search_path = 'extensions, public'
2. Re-seeds default students and teacher password using schema-qualified crypt/gen_salt
*/

-- Drop old functions
DROP FUNCTION IF EXISTS public.verify_student_pin(text, text);
DROP FUNCTION IF EXISTS public.verify_teacher_password(text);
DROP FUNCTION IF EXISTS public.add_student(text, text);
DROP FUNCTION IF EXISTS public.update_student_pin(uuid, text);
DROP FUNCTION IF EXISTS public.delete_student(uuid);
DROP FUNCTION IF EXISTS public.change_teacher_password(text, text);

-- Recreate with correct search_path including extensions schema
CREATE OR REPLACE FUNCTION public.verify_student_pin(p_name text, p_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
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
SET search_path = extensions, public
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
SET search_path = extensions, public
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
SET search_path = extensions, public
AS $$
BEGIN
  UPDATE students SET pin_hash = crypt(p_pin, gen_salt('bf')) WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_student(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
AS $$
BEGIN
  DELETE FROM students WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_teacher_password(p_old text, p_new text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = extensions, public
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

-- Re-seed teacher password (in case it was never set due to the earlier error)
INSERT INTO teacher_settings (id, password_hash)
VALUES (1, extensions.crypt('MPSI2026!', extensions.gen_salt('bf')))
ON CONFLICT (id) DO UPDATE
SET password_hash = extensions.crypt('MPSI2026!', extensions.gen_salt('bf'));

-- Re-seed students (in case they were never set due to the earlier error)
INSERT INTO students (name, pin_hash) VALUES
  ('Alice Bernard', extensions.crypt('1234', extensions.gen_salt('bf'))),
  ('Thomas Chen', extensions.crypt('2345', extensions.gen_salt('bf'))),
  ('Marine Dubois', extensions.crypt('3456', extensions.gen_salt('bf'))),
  ('Lucas Martin', extensions.crypt('4567', extensions.gen_salt('bf'))),
  ('Emma Petit', extensions.crypt('5678', extensions.gen_salt('bf')))
ON CONFLICT (name) DO UPDATE
SET pin_hash = EXCLUDED.pin_hash;

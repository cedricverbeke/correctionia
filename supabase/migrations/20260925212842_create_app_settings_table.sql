/*
# Create app_settings table for configurable Gemini model

1. New Tables
- `app_settings`
  - `id` (int, primary key, always 1 — singleton row)
  - `gemini_model` (text, not null, default 'gemini-3.5-flash-lite')
  - `updated_at` (timestamptz, auto-updated)
2. Security
- Enable RLS on `app_settings`.
- Allow authenticated users (teachers) to read and update the model setting.
- Insert/Update/Delete scoped to authenticated only.
3. Notes
- This table holds a single row (id = 1) that stores app-wide configuration.
- The edge function reads `gemini_model` from this table at the start of each analysis.
- Teachers can change the model from the UI without code changes or redeployment.
*/

CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  gemini_model text NOT NULL DEFAULT 'gemini-3.5-flash-lite',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Insert the singleton row if it doesn't exist
INSERT INTO app_settings (id, gemini_model)
VALUES (1, 'gemini-3.5-flash-lite')
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to read settings
DROP POLICY IF EXISTS "select_app_settings" ON app_settings;
CREATE POLICY "select_app_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);

-- Allow authenticated users to update settings
DROP POLICY IF EXISTS "update_app_settings" ON app_settings;
CREATE POLICY "update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- Allow authenticated users to insert the singleton row
DROP POLICY IF EXISTS "insert_app_settings" ON app_settings;
CREATE POLICY "insert_app_settings" ON app_settings FOR INSERT
  TO authenticated WITH CHECK (true);

-- Allow authenticated users to delete (for reset purposes)
DROP POLICY IF EXISTS "delete_app_settings" ON app_settings;
CREATE POLICY "delete_app_settings" ON app_settings FOR DELETE
  TO authenticated USING (true);

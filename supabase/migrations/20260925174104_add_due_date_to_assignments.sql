/*
# Add due_date column to assignments

1. Modified Tables
- `assignments`: Add `due_date` (timestamptz, nullable) — optional deadline for homework submissions.
  When set, students cannot submit after this date.
2. Security
- No changes to existing RLS policies.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'due_date'
  ) THEN
    ALTER TABLE assignments ADD COLUMN due_date timestamptz;
  END IF;
END $$;

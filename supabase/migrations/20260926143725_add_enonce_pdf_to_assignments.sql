/*
# Add PDF subject columns to assignments

1. Modified Tables
- `assignments`: added `enonce_pdf_url` (text, nullable) — public URL of the PDF subject file shown to students
- `assignments`: added `enonce_pdf_name` (text, nullable) — original filename of the PDF subject

2. Rationale
- The teacher can now upload both a .tex file (sent to Gemini for AI correction) and a compiled PDF (shown to students for download).
- The existing `enonce_url` / `enonce_name` fields continue to hold the .tex (or other) énoncé file used by the AI.
- The new `enonce_pdf_url` / `enonce_pdf_name` fields hold the student-facing PDF.

3. Security
- No policy changes — the existing anon/authenticated CRUD policies on `assignments` already cover the new columns.
*/

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS enonce_pdf_url text;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS enonce_pdf_name text;
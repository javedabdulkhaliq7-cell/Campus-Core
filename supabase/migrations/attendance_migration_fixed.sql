-- ============================================================
-- CAMPUS CORE — Attendance Migration (FIXED)
-- Uses correct column name: attendance_date (not date)
-- Run this in Supabase SQL Editor
-- ============================================================

-- STEP 1: Add weekly_off_days to school_settings
ALTER TABLE school_settings
  ADD COLUMN IF NOT EXISTS weekly_off_days integer[] DEFAULT '{}';

-- STEP 2: Add correction tracking columns to attendance_records
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS correction_reason text,
  ADD COLUMN IF NOT EXISTS is_corrected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS corrected_at timestamptz;

-- STEP 3: Remove duplicate (school_id, student_id, attendance_date) rows
-- Keeps the most recently created one
DELETE FROM attendance_records a
USING attendance_records b
WHERE a.ctid < b.ctid
  AND a.school_id = b.school_id
  AND a.student_id = b.student_id
  AND a.attendance_date = b.attendance_date;

-- STEP 4: Add unique constraint so upsert works correctly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'attendance_records_school_student_date_unique'
  ) THEN
    ALTER TABLE attendance_records
      ADD CONSTRAINT attendance_records_school_student_date_unique
      UNIQUE (school_id, student_id, attendance_date);
  END IF;
END $$;

-- STEP 5: Create school_holidays table
CREATE TABLE IF NOT EXISTS school_holidays (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id   uuid        NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  date        date        NOT NULL,
  reason      text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (school_id, date)
);

-- STEP 6: Enable RLS on school_holidays
ALTER TABLE school_holidays ENABLE ROW LEVEL SECURITY;

-- STEP 7: RLS policy for school_holidays
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'school_holidays'
      AND policyname = 'school_holidays_school_isolation'
  ) THEN
    CREATE POLICY school_holidays_school_isolation ON school_holidays
      FOR ALL
      USING (
        school_id IN (
          SELECT school_id FROM school_members WHERE user_id = auth.uid()
        )
      )
      WITH CHECK (
        school_id IN (
          SELECT school_id FROM school_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- STEP 8: Indexes for performance
CREATE INDEX IF NOT EXISTS idx_school_holidays_school_date
  ON school_holidays (school_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_school_attendance_date
  ON attendance_records (school_id, attendance_date);

-- Done! ✅
-- Verify:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'attendance_records';
-- SELECT tablename FROM pg_tables WHERE tablename = 'school_holidays';

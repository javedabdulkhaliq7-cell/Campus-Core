-- =============================================
-- CAMPUS CORE - Complete Database Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- 1. SCHOOLS table
CREATE TABLE IF NOT EXISTS schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read schools"
  ON schools FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert schools"
  ON schools FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update schools"
  ON schools FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. SCHOOL MEMBERS table (links users to schools)
CREATE TABLE IF NOT EXISTS school_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, user_id)
);
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read members"
  ON school_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert members"
  ON school_members FOR INSERT TO authenticated WITH CHECK (true);

-- 3. SCHOOL SETTINGS table
CREATE TABLE IF NOT EXISTS school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE UNIQUE,
  school_name text NOT NULL DEFAULT 'My School',
  principal_name text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  website text DEFAULT '',
  registration_number text DEFAULT '',
  established_year integer DEFAULT 2000,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE school_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read settings"
  ON school_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert settings"
  ON school_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update settings"
  ON school_settings FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. CLASSES table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  section text NOT NULL DEFAULT 'A',
  grade integer NOT NULL,
  academic_year integer NOT NULL,
  class_teacher text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, grade, section, academic_year)
);
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert classes"
  ON classes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update classes"
  ON classes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete classes"
  ON classes FOR DELETE TO authenticated USING (true);

-- 5. STUDENTS table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  roll_number text NOT NULL,
  full_name text NOT NULL,
  father_name text NOT NULL,
  cnic_or_b_form text,
  date_of_birth date,
  gender text NOT NULL DEFAULT 'Male',
  address text,
  phone text,
  parent_phone text NOT NULL,
  class_id uuid REFERENCES classes(id),
  current_grade integer NOT NULL,
  current_section text NOT NULL DEFAULT 'A',
  enrollment_year integer NOT NULL,
  is_active boolean DEFAULT true,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, roll_number)
);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read students"
  ON students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert students"
  ON students FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update students"
  ON students FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete students"
  ON students FOR DELETE TO authenticated USING (true);

-- 6. FEE STRUCTURES table
CREATE TABLE IF NOT EXISTS fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade integer NOT NULL,
  academic_year integer NOT NULL,
  monthly_tuition integer NOT NULL DEFAULT 0,
  admission_fee integer NOT NULL DEFAULT 0,
  exam_fee integer NOT NULL DEFAULT 0,
  lab_fee integer NOT NULL DEFAULT 0,
  sports_fee integer NOT NULL DEFAULT 0,
  other_fee integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, grade, academic_year)
);
ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fee structures"
  ON fee_structures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fee structures"
  ON fee_structures FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fee structures"
  ON fee_structures FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete fee structures"
  ON fee_structures FOR DELETE TO authenticated USING (true);

-- 7. FEE RECORDS table
CREATE TABLE IF NOT EXISTS fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_month integer NOT NULL,
  fee_year integer NOT NULL,
  tuition_fee integer NOT NULL DEFAULT 0,
  admission_fee integer NOT NULL DEFAULT 0,
  exam_fee integer NOT NULL DEFAULT 0,
  lab_fee integer NOT NULL DEFAULT 0,
  sports_fee integer NOT NULL DEFAULT 0,
  other_fee integer NOT NULL DEFAULT 0,
  total_amount integer NOT NULL DEFAULT 0,
  amount_paid integer NOT NULL DEFAULT 0,
  discount integer NOT NULL DEFAULT 0,
  fine integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid',
  payment_date date,
  payment_method text DEFAULT 'Cash',
  receipt_number text,
  remarks text,
  collected_by text,
  sms_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, student_id, fee_month, fee_year)
);
ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read fee records"
  ON fee_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert fee records"
  ON fee_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update fee records"
  ON fee_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 8. ATTENDANCE RECORDS table
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'Present',
  remarks text,
  marked_by text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(school_id, student_id, attendance_date)
);
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read attendance"
  ON attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert attendance"
  ON attendance_records FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update attendance"
  ON attendance_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 9. ANNOUNCEMENTS table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'General',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read announcements"
  ON announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert announcements"
  ON announcements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update announcements"
  ON announcements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- =============================================
-- AUTO-SETUP: Creates a default school and
-- links every new user to it automatically
-- =============================================

-- Insert a default school
INSERT INTO schools (id, name, slug, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'My School', 'my-school', true)
ON CONFLICT (slug) DO NOTHING;

-- Insert default school settings
INSERT INTO school_settings (school_id, school_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'My School')
ON CONFLICT (school_id) DO NOTHING;

-- Auto-link any existing auth users to the default school
INSERT INTO school_members (school_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', id, 'admin'
FROM auth.users
ON CONFLICT (school_id, user_id) DO NOTHING;

-- Trigger: auto-link every NEW user to the default school
CREATE OR REPLACE FUNCTION auto_add_user_to_school()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO school_members (school_id, user_id, role)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auto_add_user_to_school();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(current_grade);
CREATE INDEX IF NOT EXISTS idx_fee_records_school ON fee_records(school_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_year_month ON fee_records(fee_year, fee_month);
CREATE INDEX IF NOT EXISTS idx_attendance_school ON attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);

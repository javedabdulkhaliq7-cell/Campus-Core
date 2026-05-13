
/*
  # School Management System - Complete Schema

  ## Tables Created:
  1. **classes** - School classes/grades (1-12, with sections)
  2. **students** - Student records spanning a decade (enrollment year tracked)
  3. **fee_structures** - Monthly fee plans per class per year
  4. **fee_records** - Individual student fee payment records
  5. **attendance_records** - Daily attendance per student

  ## Security:
  - RLS enabled on all tables
  - Authenticated users (staff/admin) can read/write
*/

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  section text NOT NULL DEFAULT 'A',
  grade integer NOT NULL,
  academic_year integer NOT NULL,
  class_teacher text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grade, section, academic_year)
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read classes"
  ON classes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert classes"
  ON classes FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update classes"
  ON classes FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number text NOT NULL UNIQUE,
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
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read students"
  ON students FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert students"
  ON students FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update students"
  ON students FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Fee structures
CREATE TABLE IF NOT EXISTS fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grade integer NOT NULL,
  academic_year integer NOT NULL,
  monthly_tuition integer NOT NULL DEFAULT 0,
  admission_fee integer NOT NULL DEFAULT 0,
  exam_fee integer NOT NULL DEFAULT 0,
  lab_fee integer NOT NULL DEFAULT 0,
  sports_fee integer NOT NULL DEFAULT 0,
  other_fee integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(grade, academic_year)
);

ALTER TABLE fee_structures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fee structures"
  ON fee_structures FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fee structures"
  ON fee_structures FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fee structures"
  ON fee_structures FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Fee records
CREATE TABLE IF NOT EXISTS fee_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, fee_month, fee_year)
);

ALTER TABLE fee_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fee records"
  ON fee_records FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert fee records"
  ON fee_records FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update fee records"
  ON fee_records FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Attendance records
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id),
  attendance_date date NOT NULL,
  status text NOT NULL DEFAULT 'Present',
  remarks text,
  marked_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, attendance_date)
);

ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read attendance"
  ON attendance_records FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attendance"
  ON attendance_records FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update attendance"
  ON attendance_records FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Announcements / notices from principal
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'General',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read announcements"
  ON announcements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert announcements"
  ON announcements FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update announcements"
  ON announcements FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_active ON students(is_active);
CREATE INDEX IF NOT EXISTS idx_students_grade ON students(current_grade);
CREATE INDEX IF NOT EXISTS idx_fee_records_student ON fee_records(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_records_year_month ON fee_records(fee_year, fee_month);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);

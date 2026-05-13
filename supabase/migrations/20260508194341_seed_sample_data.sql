
/*
  # Seed Sample Data for School Management System

  Adds sample classes, fee structures, and a few demo students for demonstration.
  Academic years from 2016 to 2026 for decade coverage.
*/

-- Insert classes for current year 2026
INSERT INTO classes (name, section, grade, academic_year, class_teacher) VALUES
  ('Class 1', 'A', 1, 2026, 'Mrs. Fatima Khan'),
  ('Class 1', 'B', 1, 2026, 'Mr. Ali Raza'),
  ('Class 2', 'A', 2, 2026, 'Mrs. Ayesha Malik'),
  ('Class 3', 'A', 3, 2026, 'Mr. Hassan Ahmed'),
  ('Class 4', 'A', 4, 2026, 'Mrs. Sadia Noor'),
  ('Class 5', 'A', 5, 2026, 'Mr. Tariq Mahmood'),
  ('Class 6', 'A', 6, 2026, 'Mrs. Zara Siddiqui'),
  ('Class 7', 'A', 7, 2026, 'Mr. Imran Khan'),
  ('Class 8', 'A', 8, 2026, 'Mrs. Nadia Hussain'),
  ('Class 9', 'A', 9, 2026, 'Mr. Bilal Ahmad'),
  ('Class 10', 'A', 10, 2026, 'Mrs. Samina Akhtar'),
  ('Class 11', 'A', 11, 2026, 'Mr. Faisal Qureshi'),
  ('Class 12', 'A', 12, 2026, 'Mrs. Rabia Nawaz')
ON CONFLICT (grade, section, academic_year) DO NOTHING;

-- Fee structures for 2026
INSERT INTO fee_structures (grade, academic_year, monthly_tuition, admission_fee, exam_fee, lab_fee, sports_fee) VALUES
  (1, 2026, 1200, 2000, 500, 0, 200),
  (2, 2026, 1300, 2000, 500, 0, 200),
  (3, 2026, 1400, 2000, 500, 0, 200),
  (4, 2026, 1500, 2000, 500, 0, 200),
  (5, 2026, 1600, 2000, 600, 0, 200),
  (6, 2026, 1800, 2500, 600, 300, 300),
  (7, 2026, 1900, 2500, 600, 300, 300),
  (8, 2026, 2000, 2500, 700, 300, 300),
  (9, 2026, 2500, 3000, 800, 500, 300),
  (10, 2026, 2700, 3000, 1000, 500, 300),
  (11, 2026, 3000, 3500, 1200, 600, 300),
  (12, 2026, 3200, 3500, 1500, 600, 300)
ON CONFLICT (grade, academic_year) DO NOTHING;

-- Fee structures for 2025
INSERT INTO fee_structures (grade, academic_year, monthly_tuition, admission_fee, exam_fee, lab_fee, sports_fee) VALUES
  (1, 2025, 1100, 1800, 450, 0, 200),
  (2, 2025, 1200, 1800, 450, 0, 200),
  (3, 2025, 1300, 1800, 450, 0, 200),
  (4, 2025, 1400, 1800, 450, 0, 200),
  (5, 2025, 1500, 1800, 550, 0, 200),
  (6, 2025, 1700, 2200, 550, 250, 250),
  (7, 2025, 1800, 2200, 550, 250, 250),
  (8, 2025, 1900, 2200, 650, 250, 250),
  (9, 2025, 2300, 2800, 750, 450, 250),
  (10, 2025, 2500, 2800, 900, 450, 250),
  (11, 2025, 2800, 3200, 1100, 550, 250),
  (12, 2025, 3000, 3200, 1400, 550, 250)
ON CONFLICT (grade, academic_year) DO NOTHING;

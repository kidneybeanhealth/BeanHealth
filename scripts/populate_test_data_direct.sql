-- DIRECT SQL INSERT FOR PATIENT HARISH
-- Patient ID: 97d7a52c-f082-483e-b1f7-8d2b4bf45ecf
-- Run this in Supabase SQL Editor

-- ==========================================
-- STEP 1: Clean up any existing data
-- ==========================================
DELETE FROM lab_results WHERE patient_id = '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf';
DELETE FROM prescriptions WHERE patient_id = '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf';

-- ==========================================
-- STEP 2: Get a doctor ID (run this first to see available doctors)
-- ==========================================
-- SELECT id, name FROM users WHERE role = 'doctor' LIMIT 5;
-- Use the doctor_id from above in the inserts below, or use a placeholder

-- ==========================================
-- STEP 3: Insert Lab Results
-- ==========================================

-- Visit 1: December 1, 2025 (baseline)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name) VALUES
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'creatinine', 2.1, 'mg/dL', 'abnormal', 0.7, 1.3, '2025-12-01', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'egfr', 35, 'mL/min/1.73m²', 'abnormal', 60, 120, '2025-12-01', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bun', 32, 'mg/dL', 'abnormal', 7, 20, '2025-12-01', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'potassium', 5.4, 'mmol/L', 'borderline', 3.5, 5.0, '2025-12-01', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'hemoglobin', 10.5, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-01', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bicarbonate', 19, 'mmol/L', 'abnormal', 22, 29, '2025-12-01', 'City Lab');

-- Visit 2: December 15, 2025 (improvement)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name) VALUES
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'creatinine', 1.9, 'mg/dL', 'abnormal', 0.7, 1.3, '2025-12-15', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'egfr', 40, 'mL/min/1.73m²', 'abnormal', 60, 120, '2025-12-15', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bun', 28, 'mg/dL', 'borderline', 7, 20, '2025-12-15', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'potassium', 4.8, 'mmol/L', 'borderline', 3.5, 5.0, '2025-12-15', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'hemoglobin', 11.2, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-15', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bicarbonate', 21, 'mmol/L', 'borderline', 22, 29, '2025-12-15', 'City Lab');

-- Visit 3: December 29, 2025 (stable)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name) VALUES
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'creatinine', 1.7, 'mg/dL', 'borderline', 0.7, 1.3, '2025-12-29', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'egfr', 45, 'mL/min/1.73m²', 'borderline', 60, 120, '2025-12-29', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bun', 24, 'mg/dL', 'borderline', 7, 20, '2025-12-29', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'potassium', 4.5, 'mmol/L', 'normal', 3.5, 5.0, '2025-12-29', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'hemoglobin', 11.8, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-29', 'City Lab'),
('97d7a52c-f082-483e-b1f7-8d2b4bf45ecf', 'bicarbonate', 23, 'mmol/L', 'normal', 22, 29, '2025-12-29', 'City Lab');

-- ==========================================
-- STEP 4: Insert Prescriptions (3 visits)
-- Replace DOCTOR_ID below with an actual doctor ID from your database
-- ==========================================

-- First, find a doctor ID:
-- SELECT id, name FROM users WHERE role = 'doctor' LIMIT 1;

-- Visit 1 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
VALUES (
    '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf',
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[{"name": "Lisinopril", "dosage": "10", "unit": "mg", "frequency": "once daily", "instructions": "Take in the morning"}, {"name": "Calcium Carbonate", "dosage": "500", "unit": "mg", "frequency": "three times daily", "instructions": "Take with meals"}, {"name": "Sodium Bicarbonate", "dosage": "650", "unit": "mg", "frequency": "twice daily", "instructions": "For metabolic acidosis"}]'::jsonb,
    'Initial visit. CKD Stage 3b. Starting conservative management. Diet: Low sodium (<2g/day), low potassium.',
    'active',
    '2025-12-01T10:00:00Z'
);

-- Visit 2 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
VALUES (
    '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf',
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[{"name": "Lisinopril", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Increased from 10mg"}, {"name": "Calcium Carbonate", "dosage": "500", "unit": "mg", "frequency": "three times daily", "instructions": "Take with meals"}, {"name": "Furosemide", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "For fluid management"}]'::jsonb,
    'Follow-up visit. Labs improving. Increased ACE inhibitor. Diet: Continue low sodium.',
    'active',
    '2025-12-15T10:00:00Z'
);

-- Visit 3 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
VALUES (
    '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf',
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[{"name": "Lisinopril", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Continue"}, {"name": "Furosemide", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Continue"}, {"name": "Epoetin Alfa", "dosage": "4000", "unit": "units", "frequency": "weekly", "instructions": "For anemia"}, {"name": "Iron Sucrose", "dosage": "200", "unit": "mg", "frequency": "weekly", "instructions": "Iron supplement"}]'::jsonb,
    'Labs continuing to stabilize. Adding EPO for anemia. Diet: Continue restrictions.',
    'active',
    '2025-12-29T10:00:00Z'
);

-- ==========================================
-- STEP 5: Update Patient Profile
-- ==========================================
UPDATE users 
SET 
    condition = 'Chronic Kidney Disease Stage 3b',
    ckd_stage = '3b',
    age = 58
WHERE id = '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf';

-- ==========================================
-- VERIFICATION
-- ==========================================
-- Run these to verify data was inserted:
SELECT 'Prescriptions:' as table_name, COUNT(*) as count FROM prescriptions WHERE patient_id = '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf'
UNION ALL
SELECT 'Lab Results:', COUNT(*) FROM lab_results WHERE patient_id = '97d7a52c-f082-483e-b1f7-8d2b4bf45ecf';

-- Test Data Population SQL for BeanHealth
-- Patient: harishsaravanan1310@gmail.com
-- CKD Stage 3b with 3 visits worth of data

-- First, get the patient ID (you'll need to replace this with the actual ID)
-- Run this query first to get the patient ID:
-- SELECT id, name, email FROM users WHERE email = 'harishsaravanan1310@gmail.com';

-- Replace 'PATIENT_ID_HERE' with the actual patient ID from the above query
-- Replace 'DOCTOR_ID_HERE' with a doctor's ID from: SELECT id, name FROM users WHERE role = 'doctor' LIMIT 1;

-- ==========================================
-- STEP 1: Update Patient CKD Profile
-- ==========================================
UPDATE users 
SET 
    condition = 'Chronic Kidney Disease Stage 3b',
    ckd_stage = '3b',
    comorbidities = ARRAY['Hypertension', 'Type 2 Diabetes Mellitus', 'Anemia of CKD'],
    age = 58,
    baseline_weight = 72,
    daily_fluid_target = 1500
WHERE email = 'harishsaravanan1310@gmail.com';

-- ==========================================
-- STEP 2: Delete existing data (optional - for clean slate)
-- ==========================================
DELETE FROM lab_results WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com');
DELETE FROM prescriptions WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com');
DELETE FROM patient_case_details WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com');

-- ==========================================
-- STEP 3: Insert Lab Results for 3 Visits
-- ==========================================

-- Visit 1: December 1, 2025 (baseline - concerning values)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'creatinine', 2.1, 'mg/dL', 'abnormal', 0.7, 1.3, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'egfr', 35, 'mL/min/1.73m²', 'abnormal', 60, 120, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bun', 32, 'mg/dL', 'abnormal', 7, 20, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'potassium', 5.4, 'mmol/L', 'borderline', 3.5, 5.0, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'hemoglobin', 10.5, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bicarbonate', 19, 'mmol/L', 'abnormal', 22, 29, '2025-12-01', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

-- Visit 2: December 15, 2025 (some improvement)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'creatinine', 1.9, 'mg/dL', 'abnormal', 0.7, 1.3, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'egfr', 40, 'mL/min/1.73m²', 'abnormal', 60, 120, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bun', 28, 'mg/dL', 'borderline', 7, 20, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'potassium', 4.8, 'mmol/L', 'borderline', 3.5, 5.0, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'hemoglobin', 11.2, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bicarbonate', 21, 'mmol/L', 'borderline', 22, 29, '2025-12-15', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

-- Visit 3: December 29, 2025 (continued improvement)
INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'creatinine', 1.7, 'mg/dL', 'borderline', 0.7, 1.3, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'egfr', 45, 'mL/min/1.73m²', 'borderline', 60, 120, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bun', 24, 'mg/dL', 'borderline', 7, 20, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'potassium', 4.5, 'mmol/L', 'normal', 3.5, 5.0, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'hemoglobin', 11.8, 'g/dL', 'borderline', 12.0, 16.0, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

INSERT INTO lab_results (patient_id, test_type, value, unit, status, reference_range_min, reference_range_max, test_date, lab_name)
SELECT id, 'bicarbonate', 23, 'mmol/L', 'normal', 22, 29, '2025-12-29', 'City Medical Lab' FROM users WHERE email = 'harishsaravanan1310@gmail.com';

-- ==========================================
-- STEP 4: Insert Prescriptions for 3 Visits
-- ==========================================

-- Visit 1 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
SELECT 
    u.id,
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[
        {"name": "Lisinopril", "dosage": "10", "unit": "mg", "frequency": "once daily", "instructions": "Take in the morning"},
        {"name": "Calcium Carbonate", "dosage": "500", "unit": "mg", "frequency": "three times daily", "instructions": "Take with meals"},
        {"name": "Sodium Bicarbonate", "dosage": "650", "unit": "mg", "frequency": "twice daily", "instructions": "For metabolic acidosis"}
    ]'::jsonb,
    'Initial visit. CKD Stage 3b. Starting conservative management.
Diet: Low sodium (<2g/day), low potassium, moderate protein restriction.
Follow up in 2 weeks.',
    'active',
    '2025-12-01 10:00:00'::timestamptz
FROM users u WHERE u.email = 'harishsaravanan1310@gmail.com';

-- Visit 2 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
SELECT 
    u.id,
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[
        {"name": "Lisinopril", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Increased from 10mg"},
        {"name": "Calcium Carbonate", "dosage": "500", "unit": "mg", "frequency": "three times daily", "instructions": "Take with meals"},
        {"name": "Sodium Bicarbonate", "dosage": "650", "unit": "mg", "frequency": "twice daily", "instructions": "Continue for acidosis"},
        {"name": "Furosemide", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "New - for fluid management"}
    ]'::jsonb,
    'Follow-up visit. Labs showing improvement. Increasing ACE inhibitor.
Diet: Continue low sodium. Patient reports improved energy.
Follow up in 2 weeks.',
    'active',
    '2025-12-15 10:00:00'::timestamptz
FROM users u WHERE u.email = 'harishsaravanan1310@gmail.com';

-- Visit 3 Prescription
INSERT INTO prescriptions (patient_id, doctor_id, medications, notes, status, created_at)
SELECT 
    u.id,
    (SELECT id FROM users WHERE role = 'doctor' LIMIT 1),
    '[
        {"name": "Lisinopril", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Continue current dose"},
        {"name": "Calcium Carbonate", "dosage": "500", "unit": "mg", "frequency": "three times daily", "instructions": "Take with meals"},
        {"name": "Furosemide", "dosage": "20", "unit": "mg", "frequency": "once daily", "instructions": "Continue for fluid management"},
        {"name": "Epoetin Alfa", "dosage": "4000", "unit": "units", "frequency": "weekly", "instructions": "New - for CKD anemia"},
        {"name": "Iron Sucrose", "dosage": "200", "unit": "mg", "frequency": "weekly", "instructions": "New - iron supplementation"}
    ]'::jsonb,
    'Labs continuing to improve. Blood pressure well controlled.
Diet: Continue dietary restrictions. Good compliance.
Adding EPO for anemia management.',
    'active',
    '2025-12-29 10:00:00'::timestamptz
FROM users u WHERE u.email = 'harishsaravanan1310@gmail.com';

-- ==========================================
-- STEP 5: Insert Case Details
-- ==========================================
INSERT INTO patient_case_details (patient_id, primary_condition, latest_complaint, complaint_date, medical_history)
SELECT 
    id,
    'Chronic Kidney Disease Stage 3b',
    'Mild fatigue, improved from last visit. No edema. Good appetite.',
    '2025-12-29',
    ARRAY['Hypertension (10 years)', 'Type 2 Diabetes Mellitus (8 years)', 'CKD Stage 3b (diagnosed 6 months ago)', 'Anemia of CKD', 'Metabolic acidosis']
FROM users WHERE email = 'harishsaravanan1310@gmail.com'
ON CONFLICT (patient_id) DO UPDATE SET
    primary_condition = EXCLUDED.primary_condition,
    latest_complaint = EXCLUDED.latest_complaint,
    complaint_date = EXCLUDED.complaint_date,
    medical_history = EXCLUDED.medical_history;

-- ==========================================
-- STEP 6: Insert Latest Vitals
-- ==========================================
INSERT INTO vitals (patient_id, blood_pressure_value, blood_pressure_unit, blood_pressure_trend, heart_rate_value, heart_rate_unit, heart_rate_trend, temperature_value, temperature_unit, weight_value, weight_unit, spo2_value, spo2_unit, recorded_at)
SELECT 
    id, 
    '128/82', 'mmHg', 'down',
    '76', 'bpm', 'stable',
    '98.4', '°F',
    71.5, 'kg',
    '97', '%',
    '2025-12-29 10:00:00'::timestamptz
FROM users WHERE email = 'harishsaravanan1310@gmail.com';

-- ==========================================
-- Verification Queries
-- ==========================================
-- Check lab results:
-- SELECT * FROM lab_results WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com') ORDER BY test_date, test_type;

-- Check prescriptions:
-- SELECT * FROM prescriptions WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com') ORDER BY created_at;

-- Check case details:
-- SELECT * FROM patient_case_details WHERE patient_id = (SELECT id FROM users WHERE email = 'harishsaravanan1310@gmail.com');

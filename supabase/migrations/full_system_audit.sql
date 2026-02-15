-- COMPREHENSIVE SYSTEM INTEGRITY AUDIT
-- This script checks all enterprise tables for:
-- 1. CROSS-HOSPITAL MISMATCHES (e.g., patient hospital != prescription hospital)
-- 2. ORPHANED RECORDS (e.g., records pointing to non-existent patients/doctors)
-- 3. SCHEMA CONSISTENCY

-- =============================================
-- 1. HOSPITAL ISOLATION MISMATCHES
-- =============================================

-- Prescription vs Patient Ownership
SELECT 'PRESCRIPTION_PATIENT_MISMATCH' as issue, p.id as prescription_id, p.hospital_id as p_hosp, pat.hospital_id as pat_hosp
FROM public.hospital_prescriptions p
JOIN public.hospital_patients pat ON p.patient_id = pat.id
WHERE p.hospital_id != pat.hospital_id;

-- Isolation Error Tracking Table
CREATE TEMP TABLE isolation_errors AS
SELECT 'HOSPITAL_MISMATCH'::text as type, 'hospital_prescriptions'::text as table_name, p.id::text as record_id, p.hospital_id::text as hospital_id, pat.hospital_id::text as correct_id
FROM public.hospital_prescriptions p
JOIN public.hospital_patients pat ON p.patient_id = pat.id
WHERE p.hospital_id != pat.hospital_id;

-- Queues vs Patient Ownership
INSERT INTO isolation_errors
SELECT 'HOSPITAL_MISMATCH', 'hospital_queues', q.id::text, q.hospital_id::text, pat.hospital_id::text
FROM public.hospital_queues q
JOIN public.hospital_patients pat ON q.patient_id = pat.id
WHERE q.hospital_id != pat.hospital_id;

-- Reviews vs Patient Ownership
INSERT INTO isolation_errors
SELECT 'HOSPITAL_MISMATCH', 'hospital_patient_reviews', r.id::text, r.hospital_id::text, pat.hospital_id::text
FROM public.hospital_patient_reviews r
JOIN public.hospital_patients pat ON r.patient_id = pat.id
WHERE r.hospital_id != pat.hospital_id;

-- Assistants vs Hospital Ownership
INSERT INTO isolation_errors
SELECT 'HOSPITAL_MISMATCH', 'hospital_doctor_assistants', a.id::text, a.hospital_id::text, d.hospital_id::text
FROM public.hospital_doctor_assistants a
JOIN public.hospital_doctors d ON a.chief_doctor_id = d.id
WHERE a.hospital_id != d.hospital_id;

-- Doctors vs Hospital Profile (just to be sure hospital_id exists in users)
INSERT INTO isolation_errors
SELECT 'INVALID_HOSPITAL_ID', 'hospital_doctors', d.id::text, d.hospital_id::text, NULL
FROM public.hospital_doctors d
LEFT JOIN public.users u ON d.hospital_id = u.id
WHERE u.id IS NULL;

-- =============================================
-- 2. REFERENTIAL INTEGRITY (ORPHANS)
-- =============================================

-- Prescriptions without Doctors
CREATE TEMP TABLE orphan_records AS
SELECT 'ORPHAN_DOCTOR'::text as type, 'hospital_prescriptions'::text as table_name, p.id::text as record_id, p.doctor_id::text as target_id
FROM public.hospital_prescriptions p
LEFT JOIN public.hospital_doctors d ON p.doctor_id = d.id
WHERE p.doctor_id IS NOT NULL AND d.id IS NULL;

-- Prescriptions without Patients
INSERT INTO orphan_records
SELECT 'ORPHAN_PATIENT', 'hospital_prescriptions', p.id::text, p.patient_id::text
FROM public.hospital_prescriptions p
LEFT JOIN public.hospital_patients pat ON p.patient_id = pat.id
WHERE pat.id IS NULL;

-- Queues without Patients
INSERT INTO orphan_records
SELECT 'ORPHAN_PATIENT', 'hospital_queues', q.id::text, q.patient_id::text
FROM public.hospital_queues q
LEFT JOIN public.hospital_patients pat ON q.patient_id = pat.id
WHERE pat.id IS NULL;

-- =============================================
-- 3. SUMMARY RESULTS
-- =============================================

-- Isolation Error Summary
SELECT type, table_name, COUNT(*) 
FROM isolation_errors 
GROUP BY type, table_name;

-- Orphan Record Summary
SELECT type, table_name, COUNT(*) 
FROM orphan_records 
GROUP BY type, table_name;

-- Detailed Audit (only if any issues found)
SELECT * FROM isolation_errors LIMIT 50;
SELECT * FROM orphan_records LIMIT 50;

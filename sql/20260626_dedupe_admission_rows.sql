-- One-time cleanup: remove duplicate ACTIVE admission rows.
--
-- Context: reception "Admitted → Add Patient" (admitPatientDirectly) inserted a
-- hospital_queues row with status='completed', admission_status='admitted' each
-- time it was called. Patients admitted more than once (e.g. DURAISAMY,
-- SUBBULAKSHMI) ended up with multiple admission rows, which surfaced as
-- duplicates in both the Admitted section and the History Log.
--
-- This keeps the MOST RECENT admission row per (hospital_id, patient_id) and
-- deletes the older duplicates. It ONLY touches rows that are currently
-- admission_status='admitted' — discharged/deceased rows and normal completed
-- consults are left untouched. Admission rows carry no real token
-- (queue_number = 0), so this does not affect token assignment.
--
-- Review first (optional): see which rows would be deleted.
-- WITH ranked AS (
--   SELECT id, hospital_id, patient_id, admitted_at,
--          ROW_NUMBER() OVER (
--            PARTITION BY hospital_id, patient_id
--            ORDER BY admitted_at DESC NULLS LAST, created_at DESC
--          ) AS rn
--   FROM public.hospital_queues
--   WHERE admission_status = 'admitted'
-- )
-- SELECT * FROM ranked WHERE rn > 1;

WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY hospital_id, patient_id
               ORDER BY admitted_at DESC NULLS LAST, created_at DESC
           ) AS rn
    FROM public.hospital_queues
    WHERE admission_status = 'admitted'
)
DELETE FROM public.hospital_queues
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

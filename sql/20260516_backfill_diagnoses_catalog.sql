-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill shared hospital diagnosis catalog from historical prescriptions
-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnoses have always been stored as free text inside hospital_prescriptions.notes
-- in the format: "Diagnosis: CKD, Hypertension, Anemia"
-- This migration extracts every unique diagnosis ever written and inserts it into
-- hospital_saved_diagnoses so all doctors in the same hospital can see them
-- as autocomplete suggestions going forward.
--
-- Safe to run multiple times — ON CONFLICT DO NOTHING skips existing entries.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO hospital_saved_diagnoses (hospital_id, name, normalized_name)
SELECT DISTINCT
    hp.hospital_id,
    INITCAP(TRIM(t.diagnosis_entry))          AS name,
    UPPER(TRIM(t.diagnosis_entry))            AS normalized_name
FROM hospital_prescriptions hp
-- Extract the value after "Diagnosis:" up to the next newline
CROSS JOIN LATERAL regexp_matches(
    hp.notes,
    'Diagnosis:\s*([^\n]+)',
    'g'
) AS m(match)
-- Split comma-separated diagnoses into individual rows
CROSS JOIN LATERAL unnest(
    string_to_array(m.match[1], ',')
) AS t(diagnosis_entry)
WHERE hp.notes LIKE '%Diagnosis:%'
  AND TRIM(t.diagnosis_entry) <> ''
  AND LENGTH(TRIM(t.diagnosis_entry)) > 1   -- skip stray single characters
ON CONFLICT (hospital_id, normalized_name) DO NOTHING;

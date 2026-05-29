-- ─────────────────────────────────────────────────────────────────────────────
-- Widen hospital_patients.age from INTEGER to TEXT
-- ─────────────────────────────────────────────────────────────────────────────
-- Reception needs to register babies whose age is best expressed as
-- "7 months", "3 weeks", etc. The previous INTEGER constraint forced
-- conversion to a misleading 0 (or 7 interpreted as years) for under-1
-- patients. Widening to TEXT lets the typed string round-trip end-to-end.
--
-- Existing integer values are cast in place ("65" → "65"). No data loss.
-- Display sites format text-without-units as "N yrs" and pass text-with-
-- units through unchanged (e.g. "7 months").
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE hospital_patients
    ALTER COLUMN age TYPE TEXT USING age::TEXT;

-- Add dosages column to hospital_doctor_drugs table
ALTER TABLE hospital_doctor_drugs ADD COLUMN IF NOT EXISTS dosages text[] DEFAULT '{}';

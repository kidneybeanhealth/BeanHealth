ALTER TABLE hospital_doctor_drugs
ADD COLUMN IF NOT EXISTS default_timing VARCHAR(20) DEFAULT NULL;

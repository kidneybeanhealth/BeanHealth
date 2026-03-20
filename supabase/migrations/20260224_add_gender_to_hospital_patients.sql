-- Migration: Add gender column to hospital_patients table
-- Date: 2026-02-24

ALTER TABLE hospital_patients
ADD COLUMN IF NOT EXISTS gender TEXT;

-- Add preparing_by indicator to hospital_queues
-- This column stores the display name of the PA/doctor currently preparing a prescription.
-- NULL = no one is currently preparing. Cleared on modal close or send-to-pharmacy.

ALTER TABLE public.hospital_queues
  ADD COLUMN IF NOT EXISTS preparing_by TEXT DEFAULT NULL;

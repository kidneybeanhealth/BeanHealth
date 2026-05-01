-- Add token_number to hospital_queues so each queue entry has its own token
-- (supports same patient in queue for multiple doctors with different token numbers)
ALTER TABLE public.hospital_queues
    ADD COLUMN IF NOT EXISTS token_number TEXT;

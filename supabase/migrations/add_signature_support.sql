-- 1. Add signature_url column to hospital_doctors table
-- This is safe to run.
ALTER TABLE public.hospital_doctors 
ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- 2. Create the storage bucket (This usually works in SQL, but if it fails, use the UI)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('doctor-signatures', 'doctor-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- REMOVED: The ALTER TABLE storage.objects commands that caused the error.
-- Please configure policies in the Supabase Dashboard -> Storage -> Policies if needed.
-- By default, a public bucket often allows public reads, but you may need to add a policy for "Authenticated Insert" in the UI.

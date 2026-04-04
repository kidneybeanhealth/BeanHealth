-- Migration: Add pharmacy queue table for patient calling system
-- This table tracks patients being called to the pharmacy counter

-- Create pharmacy queue table
CREATE TABLE IF NOT EXISTS hospital_pharmacy_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prescription_id UUID REFERENCES hospital_prescriptions(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    token_number TEXT NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'calling', 'dispensed', 'skipped')),
    called_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pharmacy_queue_hospital ON hospital_pharmacy_queue(hospital_id);
CREATE INDEX IF NOT EXISTS idx_pharmacy_queue_status ON hospital_pharmacy_queue(status);
CREATE INDEX IF NOT EXISTS idx_pharmacy_queue_created ON hospital_pharmacy_queue(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pharmacy_queue_prescription_id
    ON hospital_pharmacy_queue(prescription_id)
    WHERE prescription_id IS NOT NULL;

-- Enable RLS
ALTER TABLE hospital_pharmacy_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow hospitals to manage their own pharmacy queue
CREATE POLICY "Hospitals can manage their pharmacy queue"
    ON hospital_pharmacy_queue
    FOR ALL
    USING (hospital_id = auth.uid())
    WITH CHECK (hospital_id = auth.uid());

-- Allow public read access for queue display (no auth required for display screens)
CREATE POLICY "Public can view pharmacy queue"
    ON hospital_pharmacy_queue
    FOR SELECT
    USING (true);

-- Enable realtime for pharmacy queue
ALTER PUBLICATION supabase_realtime ADD TABLE hospital_pharmacy_queue;

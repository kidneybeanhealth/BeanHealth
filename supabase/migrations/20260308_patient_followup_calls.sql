-- ============================================================
-- Patient Follow-up Call Tracking
-- Tracks call attempts made by reception for review patients
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_patient_followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL,
    review_id UUID NOT NULL REFERENCES public.hospital_patient_reviews(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    called_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    call_status TEXT NOT NULL CHECK (call_status IN ('picked', 'not_picked', 'busy', 'not_reachable')),
    patient_response TEXT NULL,
    next_followup_date DATE NULL,
    attended BOOLEAN NULL,
    created_by_name TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_patient_followups_review_id
    ON public.hospital_patient_followups(review_id);

CREATE INDEX IF NOT EXISTS idx_hospital_patient_followups_hospital_id
    ON public.hospital_patient_followups(hospital_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospital_patient_followups_patient_id
    ON public.hospital_patient_followups(patient_id, called_at DESC);

-- RLS
ALTER TABLE public.hospital_patient_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospital_patient_followups_hospital_owner" ON public.hospital_patient_followups;
CREATE POLICY "hospital_patient_followups_hospital_owner"
    ON public.hospital_patient_followups
    FOR ALL
    USING (hospital_id = auth.uid())
    WITH CHECK (hospital_id = auth.uid());

COMMIT;

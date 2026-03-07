-- ============================================================
-- patient_follow_up_calls
-- Tracks every call reception staff makes to follow up with
-- patients who have a pending/overdue review.
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_follow_up_calls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id       UUID NOT NULL REFERENCES hospital_patient_reviews(id) ON DELETE CASCADE,
    hospital_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL, -- denormalised for fast per-patient queries
    called_by_name  TEXT NOT NULL DEFAULT '',
    called_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    outcome         TEXT NOT NULL CHECK (outcome IN (
                        'confirmed',
                        'reschedule_requested',
                        'no_answer',
                        'refused',
                        'hospitalised'
                    )),
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_pfuc_hospital_id  ON patient_follow_up_calls (hospital_id);
CREATE INDEX IF NOT EXISTS idx_pfuc_review_id    ON patient_follow_up_calls (review_id);
CREATE INDEX IF NOT EXISTS idx_pfuc_patient_id   ON patient_follow_up_calls (patient_id);
CREATE INDEX IF NOT EXISTS idx_pfuc_called_at    ON patient_follow_up_calls (called_at DESC);

-- Enable Row Level Security
ALTER TABLE patient_follow_up_calls ENABLE ROW LEVEL SECURITY;

-- Reception & doctors of the same hospital can read call logs
CREATE POLICY "hospital_select_follow_up_calls"
    ON patient_follow_up_calls FOR SELECT
    USING (hospital_id = auth.uid());

-- Reception staff can insert call logs for their hospital
CREATE POLICY "hospital_insert_follow_up_calls"
    ON patient_follow_up_calls FOR INSERT
    WITH CHECK (hospital_id = auth.uid());

-- Reception staff can delete their own call log entries (data corrections)
CREATE POLICY "hospital_delete_follow_up_calls"
    ON patient_follow_up_calls FOR DELETE
    USING (hospital_id = auth.uid());

-- Drug Intelligence Platform — Phase 0 Foundation
-- Run this migration before using the CKD Snapshot analysis engine.

BEGIN;

-- ── reference_drugs ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reference_drugs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_name      TEXT NOT NULL UNIQUE,
    generic_name    TEXT,
    category        TEXT,
    atc_code        TEXT,
    components      TEXT[] DEFAULT '{}',
    cdsco_schedule  TEXT,
    jan_aushadhi    BOOLEAN DEFAULT FALSE,
    renal_precaution BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reference_drugs_brand ON public.reference_drugs (brand_name);

-- ── drug_review_queue ──────────────────────────────────────────────────────
-- Receives unknown brand strings encountered during prescription analysis.
-- Surfaced to pharmacy/admin for curation within 24h.
CREATE TABLE IF NOT EXISTS public.drug_review_queue (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    brand_name          TEXT NOT NULL,
    raw_names           TEXT[] NOT NULL DEFAULT '{}',
    status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    proposed_generic    TEXT,
    proposed_category   TEXT,
    reviewed_by_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT drug_review_queue_unique UNIQUE (hospital_id, brand_name)
);
CREATE INDEX IF NOT EXISTS idx_drug_review_queue_hospital_status ON public.drug_review_queue (hospital_id, status);

-- ── drug_resolution_events ─────────────────────────────────────────────────
-- Telemetry: every time the analysis engine runs on a prescription.
CREATE TABLE IF NOT EXISTS public.drug_resolution_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id         UUID REFERENCES public.users(id) ON DELETE SET NULL,
    doctor_id           UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    patient_id          UUID REFERENCES public.hospital_patients(id) ON DELETE SET NULL,
    prescription_id     UUID,
    total_drugs         INTEGER NOT NULL DEFAULT 0,
    resolved_count      INTEGER NOT NULL DEFAULT 0,
    pending_review_count INTEGER NOT NULL DEFAULT 0,
    resolved_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drug_resolution_events_hospital ON public.drug_resolution_events (hospital_id, resolved_at DESC);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.reference_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_review_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drug_resolution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reference_drugs_read" ON public.reference_drugs;
CREATE POLICY "reference_drugs_read" ON public.reference_drugs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "reference_drugs_write" ON public.reference_drugs;
CREATE POLICY "reference_drugs_write" ON public.reference_drugs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "drug_review_queue_hospital" ON public.drug_review_queue;
CREATE POLICY "drug_review_queue_hospital" ON public.drug_review_queue FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

DROP POLICY IF EXISTS "drug_resolution_events_hospital" ON public.drug_resolution_events;
CREATE POLICY "drug_resolution_events_hospital" ON public.drug_resolution_events FOR ALL TO authenticated
    USING (hospital_id = auth.uid()) WITH CHECK (hospital_id = auth.uid());

COMMIT;

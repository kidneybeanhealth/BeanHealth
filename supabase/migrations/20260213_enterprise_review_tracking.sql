-- Enterprise review tracking persistence (no notification pipeline in this migration)
-- 1) Structured review fields on prescriptions
-- 2) Dedicated hospital_patient_reviews table
-- 3) Trigger to sync prescription review fields -> hospital_patient_reviews
-- 4) Backfill structured fields and review rows from legacy notes

BEGIN;

-- 1) Structured fields on prescriptions
ALTER TABLE public.hospital_prescriptions
ADD COLUMN IF NOT EXISTS next_review_date DATE,
ADD COLUMN IF NOT EXISTS tests_to_review TEXT,
ADD COLUMN IF NOT EXISTS specialists_to_review TEXT;

CREATE INDEX IF NOT EXISTS idx_hospital_prescriptions_next_review_date
ON public.hospital_prescriptions(next_review_date);

-- 2) Review tracking table
CREATE TABLE IF NOT EXISTS public.hospital_patient_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL,
    patient_id UUID NOT NULL REFERENCES public.hospital_patients(id) ON DELETE CASCADE,
    doctor_id UUID NULL REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    source_prescription_id UUID UNIQUE REFERENCES public.hospital_prescriptions(id) ON DELETE CASCADE,
    source_queue_id UUID NULL REFERENCES public.hospital_queues(id) ON DELETE SET NULL,
    next_review_date DATE NULL,
    tests_to_review TEXT NULL,
    specialists_to_review TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'rescheduled', 'completed', 'cancelled')),
    checked_in_queue_id UUID NULL REFERENCES public.hospital_queues(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hospital_patient_reviews_hospital_status_date
ON public.hospital_patient_reviews(hospital_id, status, next_review_date);

CREATE INDEX IF NOT EXISTS idx_hospital_patient_reviews_patient
ON public.hospital_patient_reviews(patient_id, next_review_date DESC);

-- 3) Trigger function: keep one review row synced with each prescription
CREATE OR REPLACE FUNCTION public.sync_hospital_review_from_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- If review date is removed, cancel existing review cycle for this prescription.
    IF NEW.next_review_date IS NULL THEN
        UPDATE public.hospital_patient_reviews
        SET
            next_review_date = NULL,
            tests_to_review = NEW.tests_to_review,
            specialists_to_review = NEW.specialists_to_review,
            status = 'cancelled',
            cancelled_at = COALESCE(cancelled_at, now()),
            updated_at = now()
        WHERE source_prescription_id = NEW.id;
        RETURN NEW;
    END IF;

    INSERT INTO public.hospital_patient_reviews (
        hospital_id,
        patient_id,
        doctor_id,
        source_prescription_id,
        source_queue_id,
        next_review_date,
        tests_to_review,
        specialists_to_review,
        status
    )
    VALUES (
        NEW.hospital_id,
        NEW.patient_id,
        NEW.doctor_id,
        NEW.id,
        NEW.queue_id,
        NEW.next_review_date,
        NEW.tests_to_review,
        NEW.specialists_to_review,
        'pending'
    )
    ON CONFLICT (source_prescription_id)
    DO UPDATE SET
        hospital_id = EXCLUDED.hospital_id,
        patient_id = EXCLUDED.patient_id,
        doctor_id = EXCLUDED.doctor_id,
        source_queue_id = EXCLUDED.source_queue_id,
        next_review_date = EXCLUDED.next_review_date,
        tests_to_review = EXCLUDED.tests_to_review,
        specialists_to_review = EXCLUDED.specialists_to_review,
        status = CASE
            WHEN public.hospital_patient_reviews.status IN ('completed', 'cancelled') THEN public.hospital_patient_reviews.status
            ELSE CASE
                WHEN public.hospital_patient_reviews.status = 'rescheduled' THEN 'rescheduled'
                ELSE 'pending'
            END
        END,
        updated_at = now();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_hospital_review_from_prescription ON public.hospital_prescriptions;
CREATE TRIGGER trg_sync_hospital_review_from_prescription
AFTER INSERT OR UPDATE OF queue_id, next_review_date, tests_to_review, specialists_to_review
ON public.hospital_prescriptions
FOR EACH ROW
EXECUTE FUNCTION public.sync_hospital_review_from_prescription();

-- 4) Backfill structured columns from legacy notes text
WITH parsed AS (
    SELECT
        hp.id,
        NULLIF(TRIM(SUBSTRING(hp.notes FROM 'Review:\s*([^\n\r]+)')), '') AS review_raw,
        NULLIF(TRIM(SUBSTRING(hp.notes FROM 'Tests:\s*([^\n\r]+)')), '') AS tests_raw,
        NULLIF(TRIM(SUBSTRING(hp.notes FROM 'SpecialistToReview:\s*([^\n\r]+)')), '') AS specialists_raw
    FROM public.hospital_prescriptions hp
)
UPDATE public.hospital_prescriptions hp
SET
    next_review_date = COALESCE(
        hp.next_review_date,
        CASE
            WHEN p.review_raw ~ '^\d{4}-\d{2}-\d{2}$' THEN p.review_raw::date
            WHEN p.review_raw ~ '^\d{1,2}/\d{1,2}/\d{4}$' THEN to_date(p.review_raw, 'DD/MM/YYYY')
            WHEN p.review_raw ~ '^\d{1,2}-\d{1,2}-\d{4}$' THEN to_date(p.review_raw, 'DD-MM-YYYY')
            ELSE NULL
        END
    ),
    tests_to_review = COALESCE(NULLIF(hp.tests_to_review, ''), p.tests_raw),
    specialists_to_review = COALESCE(NULLIF(hp.specialists_to_review, ''), p.specialists_raw)
FROM parsed p
WHERE hp.id = p.id
  AND (
    hp.next_review_date IS NULL
    OR NULLIF(hp.tests_to_review, '') IS NULL
    OR NULLIF(hp.specialists_to_review, '') IS NULL
  );

-- Backfill review rows for prescriptions with review dates
INSERT INTO public.hospital_patient_reviews (
    hospital_id,
    patient_id,
    doctor_id,
    source_prescription_id,
    source_queue_id,
    next_review_date,
    tests_to_review,
    specialists_to_review,
    status
)
SELECT
    hp.hospital_id,
    hp.patient_id,
    hp.doctor_id,
    hp.id,
    hp.queue_id,
    hp.next_review_date,
    hp.tests_to_review,
    hp.specialists_to_review,
    'pending'
FROM public.hospital_prescriptions hp
WHERE hp.next_review_date IS NOT NULL
ON CONFLICT (source_prescription_id)
DO NOTHING;

COMMIT;

-- Shared hospital-level catalog for saved drugs and diagnoses.
-- This migration is additive and keeps existing doctor-level tables intact.

BEGIN;

CREATE TABLE IF NOT EXISTS public.hospital_saved_drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    drug_type VARCHAR DEFAULT NULL,
    default_timing VARCHAR DEFAULT NULL,
    dosages TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    updated_by_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hospital_saved_drugs_unique_name_per_hospital UNIQUE (hospital_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS public.hospital_saved_diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hospital_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    updated_by_doctor_id UUID REFERENCES public.hospital_doctors(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT hospital_saved_diagnoses_unique_name_per_hospital UNIQUE (hospital_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_hospital_saved_drugs_hospital_name
    ON public.hospital_saved_drugs (hospital_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_hospital_saved_drugs_hospital_updated
    ON public.hospital_saved_drugs (hospital_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_hospital_saved_diagnoses_hospital_name
    ON public.hospital_saved_diagnoses (hospital_id, normalized_name);

CREATE INDEX IF NOT EXISTS idx_hospital_saved_diagnoses_hospital_updated
    ON public.hospital_saved_diagnoses (hospital_id, updated_at DESC);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE proname = 'update_updated_at_column'
    ) THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'set_hospital_saved_drugs_updated_at'
        ) THEN
            CREATE TRIGGER set_hospital_saved_drugs_updated_at
            BEFORE UPDATE ON public.hospital_saved_drugs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'set_hospital_saved_diagnoses_updated_at'
        ) THEN
            CREATE TRIGGER set_hospital_saved_diagnoses_updated_at
            BEFORE UPDATE ON public.hospital_saved_diagnoses
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
        END IF;
    END IF;
END $$;

ALTER TABLE public.hospital_saved_drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_saved_diagnoses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hospitals can manage their shared drugs" ON public.hospital_saved_drugs;
CREATE POLICY "Hospitals can manage their shared drugs"
ON public.hospital_saved_drugs
FOR ALL
USING (hospital_id = auth.uid())
WITH CHECK (hospital_id = auth.uid());

DROP POLICY IF EXISTS "Hospitals can manage their shared diagnoses" ON public.hospital_saved_diagnoses;
CREATE POLICY "Hospitals can manage their shared diagnoses"
ON public.hospital_saved_diagnoses
FOR ALL
USING (hospital_id = auth.uid())
WITH CHECK (hospital_id = auth.uid());

-- Backfill shared drugs from doctor-scoped rows.
INSERT INTO public.hospital_saved_drugs (
    hospital_id,
    name,
    normalized_name,
    drug_type,
    default_timing,
    dosages,
    created_by_doctor_id,
    updated_by_doctor_id,
    created_at,
    updated_at
)
SELECT
    src.hospital_id,
    src.normalized_name,
    src.normalized_name,
    src.drug_type,
    src.default_timing,
    src.dosages,
    src.doctor_id,
    src.doctor_id,
    src.created_at,
    src.updated_at
FROM (
    SELECT DISTINCT ON (
        COALESCE(hdd.hospital_id, hd.hospital_id),
        UPPER(TRIM(hdd.name))
    )
        COALESCE(hdd.hospital_id, hd.hospital_id) AS hospital_id,
        hdd.doctor_id,
        UPPER(TRIM(hdd.name)) AS normalized_name,
        NULLIF(hdd.drug_type, '') AS drug_type,
        NULLIF(hdd.default_timing, '') AS default_timing,
        COALESCE(hdd.dosages, '{}'::text[]) AS dosages,
        hdd.created_at,
        hdd.updated_at
    FROM public.hospital_doctor_drugs hdd
    LEFT JOIN public.hospital_doctors hd ON hd.id = hdd.doctor_id
    WHERE NULLIF(TRIM(hdd.name), '') IS NOT NULL
      AND COALESCE(hdd.hospital_id, hd.hospital_id) IS NOT NULL
    ORDER BY
        COALESCE(hdd.hospital_id, hd.hospital_id),
        UPPER(TRIM(hdd.name)),
        hdd.created_at ASC NULLS LAST,
        hdd.id ASC
) AS src
ON CONFLICT (hospital_id, normalized_name)
DO UPDATE SET
    dosages = (
        SELECT COALESCE(
            ARRAY_AGG(DISTINCT UPPER(TRIM(v)))
                FILTER (WHERE NULLIF(TRIM(v), '') IS NOT NULL),
            '{}'::text[]
        )
        FROM unnest(
            COALESCE(hospital_saved_drugs.dosages, '{}'::text[])
            || COALESCE(EXCLUDED.dosages, '{}'::text[])
        ) AS merged(v)
    ),
    default_timing = COALESCE(
        NULLIF(hospital_saved_drugs.default_timing, ''),
        NULLIF(EXCLUDED.default_timing, ''),
        hospital_saved_drugs.default_timing
    ),
    drug_type = COALESCE(
        NULLIF(hospital_saved_drugs.drug_type, ''),
        NULLIF(EXCLUDED.drug_type, ''),
        hospital_saved_drugs.drug_type
    ),
    updated_by_doctor_id = COALESCE(EXCLUDED.updated_by_doctor_id, hospital_saved_drugs.updated_by_doctor_id),
    updated_at = GREATEST(hospital_saved_drugs.updated_at, EXCLUDED.updated_at);

-- Backfill shared diagnoses from doctor-scoped rows.
INSERT INTO public.hospital_saved_diagnoses (
    hospital_id,
    name,
    normalized_name,
    created_by_doctor_id,
    updated_by_doctor_id,
    created_at,
    updated_at
)
SELECT
    src.hospital_id,
    src.normalized_name,
    src.normalized_name,
    src.doctor_id,
    src.doctor_id,
    src.created_at,
    src.updated_at
FROM (
    SELECT DISTINCT ON (
        COALESCE(hdd.hospital_id, hd.hospital_id),
        UPPER(TRIM(hdd.name))
    )
        COALESCE(hdd.hospital_id, hd.hospital_id) AS hospital_id,
        hdd.doctor_id,
        UPPER(TRIM(hdd.name)) AS normalized_name,
        hdd.created_at,
        hdd.updated_at
    FROM public.hospital_doctor_diagnoses hdd
    LEFT JOIN public.hospital_doctors hd ON hd.id = hdd.doctor_id
    WHERE NULLIF(TRIM(hdd.name), '') IS NOT NULL
      AND COALESCE(hdd.hospital_id, hd.hospital_id) IS NOT NULL
    ORDER BY
        COALESCE(hdd.hospital_id, hd.hospital_id),
        UPPER(TRIM(hdd.name)),
        hdd.created_at ASC NULLS LAST,
        hdd.id ASC
) AS src
ON CONFLICT (hospital_id, normalized_name)
DO UPDATE SET
    updated_by_doctor_id = COALESCE(EXCLUDED.updated_by_doctor_id, hospital_saved_diagnoses.updated_by_doctor_id),
    updated_at = GREATEST(hospital_saved_diagnoses.updated_at, EXCLUDED.updated_at);

COMMIT;

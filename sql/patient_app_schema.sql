-- ═══════════════════════════════════════════════════════════
-- Patient App — New Database Tables
-- Run against your Supabase project
-- ═══════════════════════════════════════════════════════════

-- 1. Daily Vitals per hospital patient
CREATE TABLE public.hospital_patient_vitals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  bp_systole integer,
  bp_diastole integer,
  blood_glucose numeric,
  blood_glucose_type text CHECK (blood_glucose_type IS NULL OR blood_glucose_type = ANY (ARRAY['fasting'::text, 'post_meal'::text, 'random'::text])),
  weight numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hospital_patient_vitals_pkey PRIMARY KEY (id),
  CONSTRAINT hospital_patient_vitals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.hospital_patients(id),
  CONSTRAINT hospital_patient_vitals_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.users(id),
  CONSTRAINT hospital_patient_vitals_unique_daily UNIQUE (patient_id, recorded_date)
);

-- 2. Timestamped urine output entries
CREATE TABLE public.hospital_patient_urine_outputs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  amount_ml integer NOT NULL CHECK (amount_ml > 0),
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hospital_patient_urine_outputs_pkey PRIMARY KEY (id),
  CONSTRAINT hospital_patient_urine_outputs_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.hospital_patients(id),
  CONSTRAINT hospital_patient_urine_outputs_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.users(id)
);

-- 3. Daily intakes (salt + fluid)
CREATE TABLE public.hospital_patient_intakes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  recorded_date date NOT NULL DEFAULT CURRENT_DATE,
  salt_intake_gm numeric,
  fluid_intake_ml numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hospital_patient_intakes_pkey PRIMARY KEY (id),
  CONSTRAINT hospital_patient_intakes_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.hospital_patients(id),
  CONSTRAINT hospital_patient_intakes_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.users(id),
  CONSTRAINT hospital_patient_intakes_unique_daily UNIQUE (patient_id, recorded_date)
);

-- ─── Indexes ──────────────────────────────────────────────
CREATE INDEX idx_hp_vitals_patient_date ON public.hospital_patient_vitals(patient_id, recorded_date DESC);
CREATE INDEX idx_hp_urine_patient_date ON public.hospital_patient_urine_outputs(patient_id, recorded_at DESC);
CREATE INDEX idx_hp_intakes_patient_date ON public.hospital_patient_intakes(patient_id, recorded_date DESC);

-- ─── RLS Policies ─────────────────────────────────────────
ALTER TABLE public.hospital_patient_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_patient_urine_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_patient_intakes ENABLE ROW LEVEL SECURITY;

-- Allow service role / anon full access (patient app uses anon key with MR ID lookup)
CREATE POLICY "Allow all for anon" ON public.hospital_patient_vitals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.hospital_patient_urine_outputs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON public.hospital_patient_intakes FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- 4. App Access Controls
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.hospital_patients 
ADD COLUMN IF NOT EXISTS app_access_enabled BOOLEAN DEFAULT false;

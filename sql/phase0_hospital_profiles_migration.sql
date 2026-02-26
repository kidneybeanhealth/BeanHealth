-- ============================================================
-- PHASE 0: hospital_profiles — ADD multi-tenant columns
-- ============================================================
-- The table ALREADY EXISTS in your DB. This script only ADDS new columns.
-- Safe to run while KKC is live.
-- Safe to re-run (all statements use IF NOT EXISTS / ON CONFLICT).
--
-- What this does:
--   1. Adds new columns: display_name, city, phone, emergency_phone,
--      working_hours, footer_phone, footer_instagram, primary_color,
--      setup_completed, config
--   2. Copies hospital_name → display_name, contact_number → phone
--   3. Seeds KKC's full config (prescription: "kkc", receipt: "kkc")
--   4. Creates RLS policies if they don't already exist
--
-- What this does NOT do:
--   ✗ Does NOT rename hospital_name or contact_number
--   ✗ Does NOT drop any existing columns
--   ✗ Does NOT touch existing KKC data in old columns
-- ============================================================


-- ─── STEP 1: Add new multi-tenant columns ─────────────────────────
ALTER TABLE public.hospital_profiles
    ADD COLUMN IF NOT EXISTS display_name     TEXT,
    ADD COLUMN IF NOT EXISTS city             TEXT,
    ADD COLUMN IF NOT EXISTS phone            TEXT,
    ADD COLUMN IF NOT EXISTS emergency_phone  TEXT,
    ADD COLUMN IF NOT EXISTS working_hours    TEXT,
    ADD COLUMN IF NOT EXISTS footer_phone     TEXT,
    ADD COLUMN IF NOT EXISTS footer_instagram TEXT,
    ADD COLUMN IF NOT EXISTS primary_color    TEXT DEFAULT '#1a56db',
    ADD COLUMN IF NOT EXISTS setup_completed  BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS config           JSONB DEFAULT '{
        "prescription": "standard",
        "receipt": "standard",
        "show_religious_header": false,
        "religious_header_text": null,
        "enable_bilingual_prescription": false,
        "doctor_sort_order": []
    }'::jsonb;


-- ─── STEP 2: Copy existing data into new column aliases ───────────
-- Only fills rows where the new columns are still NULL
UPDATE public.hospital_profiles
SET
    display_name = hospital_name,
    phone        = contact_number
WHERE display_name IS NULL;


-- ─── STEP 3: Seed KKC's full multi-tenant config ─────────────────
-- ON CONFLICT DO UPDATE: safe to re-run, updates only the new fields
INSERT INTO public.hospital_profiles (
    id,
    hospital_name,         -- existing column (keep for live code)
    display_name,          -- new alias for TenantContext
    address,
    city,
    contact_number,        -- existing column (keep for live code)
    phone,                 -- new alias for TenantContext
    emergency_phone,
    working_hours,
    footer_phone,
    footer_instagram,
    setup_completed,
    config
)
VALUES (
    '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1',   -- KKC UUID
    'KONGUNAD KIDNEY CENTRE',
    'KONGUNAD KIDNEY CENTRE',
    'Coimbatore',
    '641 012',
    '0422 - 2494333, 73588 41555, 73588 41666',
    '0422 - 2494333, 73588 41555, 73588 41666',
    '0422 4316000',
    '8:00 am to 6:00 pm',
    '8056391682',
    '@kongunad_kidney_centre',
    TRUE,
    '{
        "prescription": "kkc",
        "receipt": "kkc",
        "show_religious_header": true,
        "religious_header_text": "~~~ Om Muruga ~~~",
        "enable_bilingual_prescription": true,
        "doctor_sort_order": ["prabhakar", "divakar"]
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    display_name      = EXCLUDED.display_name,
    city              = EXCLUDED.city,
    phone             = EXCLUDED.phone,
    emergency_phone   = EXCLUDED.emergency_phone,
    working_hours     = EXCLUDED.working_hours,
    footer_phone      = EXCLUDED.footer_phone,
    footer_instagram  = EXCLUDED.footer_instagram,
    setup_completed   = EXCLUDED.setup_completed,
    config            = EXCLUDED.config;
-- NOTE: hospital_name and contact_number are intentionally NOT updated here
-- so the live code that writes to those columns is never disrupted.


-- ─── STEP 4: RLS Policies (skips if already exist) ────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Hospital can view own profile'
    ) THEN
        CREATE POLICY "Hospital can view own profile"
            ON public.hospital_profiles FOR SELECT
            USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Hospital can update own profile'
    ) THEN
        CREATE POLICY "Hospital can update own profile"
            ON public.hospital_profiles FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'hospital_profiles'
        AND policyname = 'Admin full access to hospital_profiles'
    ) THEN
        CREATE POLICY "Admin full access to hospital_profiles"
            ON public.hospital_profiles FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE id = auth.uid() AND role = 'admin'
                )
            );
    END IF;
END $$;


-- ─── VERIFICATION (run these after migration) ─────────────────────

-- Check that all new columns were added:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'hospital_profiles'
-- ORDER BY column_name;

-- Check KKC row is correct:
-- SELECT id, hospital_name, display_name, setup_completed,
--        config->>'prescription' AS prescription_template
-- FROM public.hospital_profiles
-- WHERE id = '1fd98796-61ac-4fdb-bd4e-607b7e35e9b1';
-- Expected: display_name = 'KONGUNAD KIDNEY CENTRE', prescription_template = 'kkc'

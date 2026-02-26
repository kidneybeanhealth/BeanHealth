-- ============================================================
-- DEMO HOSPITAL SETUP
-- ============================================================
-- Creates a "BeanHealth Demo" hospital profile and links
-- the demo account (demo@beanhealth.in) to it.
--
-- Demo account UUID : 5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e
-- Demo hospital UUID: 5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e  (same — hospital_profiles.id FK references users)
--
-- Uses config: prescription=standard, receipt=standard
-- so the demo account tests the non-KKC template path.
--
-- Safe to re-run (uses ON CONFLICT DO UPDATE + WHERE checks).
-- ============================================================

-- ─── STEP 1: Insert into hospitals (users.hospital_id FK → hospitals.id) ──────
INSERT INTO public.hospitals (
    id,
    name,
    address,
    phone,
    email,
    details_completed
)
VALUES (
    '5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e',
    'BeanHealth Demo Clinic',
    '123 Demo Street, Tech Park, Chennai',
    '9999900000',
    'demo@beanhealth.in',
    TRUE
)
ON CONFLICT (id) DO UPDATE SET
    name               = EXCLUDED.name,
    address            = EXCLUDED.address,
    phone              = EXCLUDED.phone,
    details_completed  = EXCLUDED.details_completed;


-- ─── STEP 2: Insert into hospital_profiles (hospital_profiles.id FK → users.id) ──
INSERT INTO public.hospital_profiles (
    id,
    hospital_name,
    display_name,
    address,
    city,
    phone,
    emergency_phone,
    working_hours,
    footer_phone,
    footer_instagram,
    primary_color,
    setup_completed,
    config
)
VALUES (
    '5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e',
    'BeanHealth Demo Clinic',
    'BeanHealth Demo Clinic',
    '123 Demo Street, Tech Park',
    'Chennai',
    '9999900000',
    NULL,
    'Mon–Sat: 9am–6pm',
    '9999900000',
    '@beanhealth_demo',
    '#1a56db',
    TRUE,
    '{
        "prescription": "standard",
        "receipt": "standard",
        "show_religious_header": false,
        "religious_header_text": null,
        "enable_bilingual_prescription": false,
        "doctor_sort_order": []
    }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    display_name      = EXCLUDED.display_name,
    phone             = EXCLUDED.phone,
    footer_phone      = EXCLUDED.footer_phone,
    footer_instagram  = EXCLUDED.footer_instagram,
    city              = EXCLUDED.city,
    address           = EXCLUDED.address,
    working_hours     = EXCLUDED.working_hours,
    primary_color     = EXCLUDED.primary_color,
    setup_completed   = EXCLUDED.setup_completed,
    config            = EXCLUDED.config;


-- ─── STEP 3: Link demo user to the demo hospital ──────────────────
-- users.hospital_id FK → hospitals.id (both using demo user's UUID)
UPDATE public.users
SET hospital_id = '5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e'
WHERE id = '5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e';


-- ─── STEP 4: Verify ───────────────────────────────────────────────
SELECT
    u.email,
    u.hospital_id,
    hp.display_name,
    hp.config->>'prescription' AS prescription_template,
    hp.config->>'receipt'      AS receipt_template
FROM public.users u
JOIN public.hospital_profiles hp ON hp.id = u.hospital_id
WHERE u.id = '5293dae7-7b3e-4d8f-b8c3-1c0cc4405c0e';

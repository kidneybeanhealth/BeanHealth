-- Case-record label layout, per hospital.
--
-- The label is printed on a TSC TTP-244 Pro from the reception PC. The exact
-- stock size is not known until someone prints one and measures it, so every
-- dimension is adjustable at the desk and persisted here rather than compiled
-- into the app. Same shape and same reasoning as printer_settings, which holds
-- the token receipt's spacing.
--
-- NULL means "never calibrated" and the app falls back to its defaults, so this
-- migration is safe to run before or after the deploy.

ALTER TABLE hospital_profiles
    ADD COLUMN IF NOT EXISTS label_settings JSONB NULL;

COMMENT ON COLUMN hospital_profiles.label_settings IS
    'Patient case-record label layout in millimetres (see patientLabel.ts LabelSettings). NULL = use app defaults.';

NOTIFY pgrst, 'reload schema';

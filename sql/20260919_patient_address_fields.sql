-- Patient address lines and a second phone, for the case-record label.
--
-- The hospital's existing label carries a three-line address and two phone
-- numbers. We hold neither: `hospital_patients.place` is a single free-text
-- field reception types at registration, and there is one `phone`. So a label
-- printed from BeanHealth was thinner than the one it replaces.
--
-- `place` is deliberately left alone. It has years of data in it and the
-- registration form still writes it, so the label falls back to it whenever
-- address_line1 is empty. These columns are the structured version that the
-- label editor fills in, one patient at a time, as the desk works through them.
--
-- alt_phone gets no generated E.164 twin on purpose. phone_e164 exists because
-- the WhatsApp work needs ONE reliably dialable number per patient; a second
-- number is contact information printed on a sticker, not a send target.

ALTER TABLE hospital_patients
    ADD COLUMN IF NOT EXISTS address_line1 TEXT NULL,
    ADD COLUMN IF NOT EXISTS address_line2 TEXT NULL,
    ADD COLUMN IF NOT EXISTS city_pincode  TEXT NULL,
    ADD COLUMN IF NOT EXISTS alt_phone     TEXT NULL;

COMMENT ON COLUMN hospital_patients.address_line1 IS 'Street address line 1 for the case-record label. Falls back to place when empty.';
COMMENT ON COLUMN hospital_patients.alt_phone     IS 'Second contact number, printed on the label. Not a WhatsApp send target.';

NOTIFY pgrst, 'reload schema';

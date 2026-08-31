-- Deleting a patient fails on child rows.
--
--   Failed to delete: update or delete on table "hospital_patients" violates
--   foreign key constraint "hospital_patient_vitals_patient_id_fkey"
--
-- handleDeletePatient clears queue rows explicitly, but every table added since
-- — vitals, metrics, followups, reviews, voice calls — has its own FK, and
-- naming them one by one in the app means the next feature silently breaks
-- delete again. The database should enforce it in one place.
--
-- Scoped deliberately: only FKs whose column is patient_id and which point at
-- hospital_patients. That is patient-scoped child data by definition, and a
-- hard delete of a patient should take it with them — leaving orphaned vitals
-- attached to a deleted person is worse than deleting them.
--
-- Idempotent: constraints already ON DELETE CASCADE are skipped.

BEGIN;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT
            con.conname,
            cl.relname AS child_table,
            att.attname AS child_column
        FROM pg_constraint con
        JOIN pg_class cl  ON cl.oid = con.conrelid
        JOIN pg_class ref ON ref.oid = con.confrelid
        JOIN pg_attribute att
             ON att.attrelid = con.conrelid
            AND att.attnum = con.conkey[1]
        WHERE con.contype = 'f'
          AND ref.relname = 'hospital_patients'
          AND att.attname = 'patient_id'
          AND con.confdeltype <> 'c'          -- 'c' = already CASCADE
          AND cl.relnamespace = 'public'::regnamespace
          -- NEVER cascade an audit log. A record of what was done to a patient
          -- that vanishes when the patient is deleted is not an audit log — and
          -- a deletion is precisely the event you would later want to look up.
          -- Left alone deliberately: if a delete blocks on it, that is the table
          -- telling you to decide, not a bug to cascade away.
          AND cl.relname <> 'hospital_activity_audit_log'
    LOOP
        RAISE NOTICE 'cascading %.% (%)', r.child_table, r.child_column, r.conname;
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.child_table, r.conname);
        EXECUTE format(
            'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I)
               REFERENCES public.hospital_patients(id) ON DELETE CASCADE',
            r.child_table, r.conname, r.child_column
        );
    END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

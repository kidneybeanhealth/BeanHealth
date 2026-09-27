-- ═══════════════════════════════════════════════════════════════════════════
-- Patient feedback: show the hospital's logo on the public form
-- Date: 2026-09-27 · Safe to re-run · Optional
--
-- feedback_resolve_location read only hospital_profiles.hospital_logo, which is
-- empty at KKC, so the form a patient opens showed a plain letter tile. The logo
-- reception and the doctors already print on the Past Records sheet lives in
-- avatar_url. This replaces the one function; nothing else changes.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.feedback_resolve_location(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_loc     RECORD;
    v_profile JSONB;
    v_name    TEXT;
BEGIN
    SELECT l.id, l.hospital_id, l.label, l.area, l.is_active
      INTO v_loc
      FROM public.hospital_feedback_locations l
     WHERE UPPER(TRIM(l.code)) = UPPER(TRIM(COALESCE(p_code, '')))
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('found', false);
    END IF;

    IF v_loc.is_active IS NOT TRUE THEN
        RETURN jsonb_build_object('found', true, 'active', false);
    END IF;

    SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_loc.hospital_id;
    -- to_jsonb rather than naming the columns: hospital_logo was added to this
    -- table outside the migration files, so a site that has it and a site that
    -- does not must both resolve a poster rather than erroring on a logo.
    SELECT to_jsonb(p) INTO v_profile
      FROM public.hospital_profiles p WHERE p.id = v_loc.hospital_id;

    RETURN jsonb_build_object(
        'found', true,
        'active', true,
        'location_id', v_loc.id,
        'location_label', v_loc.label,
        'area', v_loc.area,
        'hospital_name', COALESCE(v_profile ->> 'hospital_name', v_name, 'Hospital'),
        -- hospital_logo is empty at KKC; avatar_url is the logo the print
        -- sheets already use. Prefer the first, fall back to the second.
        'hospital_logo', COALESCE(NULLIF(v_profile ->> 'hospital_logo', ''), NULLIF(v_profile ->> 'avatar_url', ''))
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.feedback_resolve_location(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

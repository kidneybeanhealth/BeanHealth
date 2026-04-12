-- Migration: Authoritative Patient App access gate in MR lookup RPC
-- Date: 2026-04-12
-- Goal: Ensure patient_app_lookup_mr enforces app_access_enabled server-side.

CREATE OR REPLACE FUNCTION public.patient_app_lookup_mr(p_mr_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient RECORD;
  v_hospital RECORD;
  v_queue RECORD;
BEGIN
  SELECT
    hp.id,
    hp.hospital_id,
    hp.name,
    hp.age,
    hp.gender,
    hp.father_husband_name,
    hp.place,
    hp.phone,
    hp.mr_number,
    hp.token_number,
    hp.beanhealth_id,
    hp.created_at,
    COALESCE(hp.app_access_enabled, false) AS app_access_enabled
  INTO v_patient
  FROM public.hospital_patients hp
  WHERE UPPER(TRIM(hp.mr_number)) = UPPER(TRIM(p_mr_number))
  ORDER BY hp.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Authoritative gate: deny when access is not enabled.
  IF COALESCE(v_patient.app_access_enabled, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'access_denied', true,
      'reason', 'app_access_disabled',
      'patient', jsonb_build_object(
        'id', v_patient.id,
        'mr_number', v_patient.mr_number,
        'app_access_enabled', false
      )
    );
  END IF;

  SELECT
    u.id,
    u.name AS hospital_name,
    NULL::TEXT AS address,
    NULL::TEXT AS display_name
  INTO v_hospital
  FROM public.users u
  WHERE u.id = v_patient.hospital_id
  LIMIT 1;

  SELECT
    hq.created_at,
    hd.id AS doctor_id,
    hd.name AS doctor_name,
    hd.specialty
  INTO v_queue
  FROM public.hospital_queues hq
  LEFT JOIN public.hospital_doctors hd ON hd.id = hq.doctor_id
  WHERE hq.hospital_id = v_patient.hospital_id
    AND hq.patient_id = v_patient.id
  ORDER BY hq.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'access_denied', false,
    'patient', to_jsonb(v_patient),
    'hospital', CASE
      WHEN v_hospital.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_hospital.id,
        'hospital_name', v_hospital.hospital_name,
        'address', v_hospital.address,
        'display_name', v_hospital.display_name
      )
    END,
    'queue', CASE
      WHEN v_queue.created_at IS NULL THEN NULL
      ELSE to_jsonb(v_queue)
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_app_lookup_mr(TEXT) TO anon, authenticated, service_role;

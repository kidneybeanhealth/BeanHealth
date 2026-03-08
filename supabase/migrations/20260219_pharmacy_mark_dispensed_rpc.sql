-- Migration: Add pharmacy_mark_dispensed RPC
-- Purpose: Atomically mark a prescription as dispensed using server-side time (NOW())
-- This fixes the issue of pharmacy clocks being ahead of doctor/server clocks.

CREATE OR REPLACE FUNCTION public.pharmacy_mark_dispensed(
    p_prescription_id UUID,
    p_dispensing_days INTEGER DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Update prescription status
    UPDATE public.hospital_prescriptions
    SET 
        status = 'dispensed',
        dispensed_days = CASE WHEN p_dispensing_days > 0 THEN p_dispensing_days ELSE NULL END,
        dispensed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_prescription_id;

    -- 2. Update pharmacy queue status
    UPDATE public.hospital_pharmacy_queue
    SET 
        status = 'dispensed'
    WHERE prescription_id = p_prescription_id;
END;
$$;

-- Grant permissions
REVOKE ALL ON FUNCTION public.pharmacy_mark_dispensed(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pharmacy_mark_dispensed(UUID, INTEGER) TO authenticated;

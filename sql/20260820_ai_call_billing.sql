-- AI call billing: a per-hospital rate and a daily cap.
--
-- RATE IS IN PAISE, as an integer. Money in a float is how ₹15.00 becomes
-- ₹14.999999 and a monthly total drifts from the sum of its own line items —
-- on an invoice that is not a rounding curiosity, it is an argument with a
-- customer. Rupees are derived for display only.
--
-- NULL rate = not yet agreed with this hospital. The statement then shows usage
-- without amounts rather than inventing a price; a zero would read as "free".
--
-- DAILY CAP is a circuit breaker, not a business rule. The campaign accepts
-- typed numbers, so one mistyped batch can dial hundreds of strangers from the
-- hospital's own number and drain a prepaid provider balance that every other
-- hospital also depends on. Set it generous enough never to touch normal use.

BEGIN;

ALTER TABLE public.hospital_profiles
    ADD COLUMN IF NOT EXISTS ai_call_rate_paise INTEGER NULL
        CHECK (ai_call_rate_paise IS NULL OR ai_call_rate_paise >= 0),
    ADD COLUMN IF NOT EXISTS ai_call_daily_cap INTEGER NOT NULL DEFAULT 200
        CHECK (ai_call_daily_cap >= 0);

COMMENT ON COLUMN public.hospital_profiles.ai_call_rate_paise IS
    'Charged per CONNECTED call, in paise. NULL = rate not agreed; statement shows usage without amounts.';
COMMENT ON COLUMN public.hospital_profiles.ai_call_daily_cap IS
    'Max calls actually dialled per IST day. Circuit breaker against a mistyped campaign.';

COMMIT;

NOTIFY pgrst, 'reload schema';

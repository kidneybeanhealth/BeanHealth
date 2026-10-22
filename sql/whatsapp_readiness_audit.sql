-- =============================================================================
-- BeanHealth — WhatsApp review-reminder READINESS AUDIT
-- =============================================================================
-- READ-ONLY. Every statement is a SELECT. Nothing writes, alters or migrates.
--
-- PURPOSE: answer the four questions that decide whether the WhatsApp reminder
-- feature is worth building, BEFORE any feature code is written.
--
--   A1. How many patients we can actually reach (phone coverage)
--   A2. Whether the stored numbers are dialable (format sanity)
--   A3. How many messages/month this generates (cost + pricing model)
--   A4. What the current manual call round costs (the thing being replaced)
--
-- Run each block separately in the Supabase SQL editor.
-- Q0 in sql/pitch_metrics.sql tells you the hospital_id. Leave hid NULL for all.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- A1. THE GATE — phone coverage on the population that matters
--
--     "Patients that matter" = alive, follow-up not deliberately stopped, and
--     holding at least one review that was ever scheduled. Anyone else is not a
--     reminder target, so including them would flatter the coverage number.
--
--     DECISION RULE: if reachable_pct < 60, do NOT build the send pipeline yet.
--     Fix data capture first (see A2 + the capture_phone flag). A broadcast
--     feature over 40% coverage is a feature that visibly does nothing.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid),
reviewable AS (
    SELECT DISTINCT hp.id, hp.phone
    FROM public.hospital_patients hp
    CROSS JOIN params p
    JOIN public.hospital_patient_reviews r ON r.patient_id = hp.id
    WHERE (p.hid IS NULL OR hp.hospital_id = p.hid)
      AND COALESCE(hp.is_deceased, FALSE) = FALSE
      AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
),
scored AS (
    SELECT
        id,
        NULLIF(TRIM(COALESCE(phone, '')), '')                   AS raw_phone,
        REGEXP_REPLACE(COALESCE(phone, ''), '\D', '', 'g')      AS digits
    FROM reviewable
)
SELECT
    COUNT(*)                                                        AS reviewable_patients,
    COUNT(*) FILTER (WHERE raw_phone IS NULL)                       AS no_phone_at_all,
    COUNT(*) FILTER (WHERE raw_phone IS NOT NULL
                       AND LENGTH(digits) < 10)                     AS too_short_unusable,
    COUNT(*) FILTER (WHERE raw_phone IS NOT NULL
                       AND LENGTH(digits) > 12)                     AS too_long_suspect,

    -- Dialable = a clean Indian mobile: 10 digits starting 6-9, or the same
    -- with a 91 / 091 / 0 prefix. Anything else needs a human to look at it.
    COUNT(*) FILTER (
        WHERE digits ~ '^(0|91|091)?[6-9][0-9]{9}$'
    )                                                               AS dialable_now,

    ROUND(100.0 * COUNT(*) FILTER (
        WHERE digits ~ '^(0|91|091)?[6-9][0-9]{9}$'
    ) / NULLIF(COUNT(*), 0), 1)                                     AS reachable_pct
FROM scored;


-- ─────────────────────────────────────────────────────────────────────────────
-- A2. FORMAT SPREAD — what shapes are actually in the column
--
--     Registration stores whatever reception typed (no normalization on write).
--     This tells you how big the E.164 backfill migration is, and whether a
--     regex can do it or a human has to.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid),
base AS (
    SELECT REGEXP_REPLACE(COALESCE(hp.phone, ''), '\D', '', 'g') AS digits,
           hp.phone AS raw
    FROM public.hospital_patients hp
    CROSS JOIN params p
    WHERE (p.hid IS NULL OR hp.hospital_id = p.hid)
      AND NULLIF(TRIM(COALESCE(hp.phone, '')), '') IS NOT NULL
)
SELECT
    LENGTH(digits)                                          AS digit_count,
    COUNT(*)                                                AS patients,
    -- has any non-digit character in the stored value (spaces, +, -, /)
    COUNT(*) FILTER (WHERE raw ~ '\D')                       AS contains_punctuation,
    -- two numbers crammed into one field, a classic reception habit
    COUNT(*) FILTER (WHERE raw ~ '[,/]|\s{2,}')              AS looks_like_two_numbers,
    (ARRAY_AGG(raw ORDER BY raw))[1:3]                       AS samples
FROM base
GROUP BY LENGTH(digits)
ORDER BY patients DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- A3. VOLUME + COST — how many reminders per month, at what spend
--
--     Models the proposed default schedule: one message 3 days before the due
--     date, one on the due date, one 3 days after if still not completed.
--     Deduplicated per (patient, due date) — two doctors naming the same day is
--     still one trip for the patient, so it must be one message.
--
--     Cost is left as a parameter: CONFIRM the live India utility-template rate
--     with the BSP before trusting any number here.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT NULL::uuid AS hid,
           0.13::numeric AS rate_inr_per_utility_msg,   -- ← confirm with BSP
           3 AS sends_per_review_cycle
),
due AS (
    SELECT DISTINCT
           r.patient_id,
           r.next_review_date AS due_date,
           date_trunc('month', r.next_review_date)::date AS due_month
    FROM public.hospital_patient_reviews r
    CROSS JOIN params p
    WHERE r.next_review_date IS NOT NULL
      AND COALESCE(r.status, '') NOT IN ('cancelled')
      AND (p.hid IS NULL OR r.hospital_id = p.hid)
),
reachable AS (
    SELECT hp.id
    FROM public.hospital_patients hp
    WHERE COALESCE(hp.is_deceased, FALSE) = FALSE
      AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
      AND REGEXP_REPLACE(COALESCE(hp.phone, ''), '\D', '', 'g') ~ '^(0|91|091)?[6-9][0-9]{9}$'
)
SELECT
    d.due_month,
    COUNT(*)                                                     AS review_cycles_due,
    COUNT(*) FILTER (WHERE rc.id IS NOT NULL)                    AS reachable_cycles,
    COUNT(*) FILTER (WHERE rc.id IS NOT NULL)
        * (SELECT sends_per_review_cycle FROM params)             AS est_messages,
    ROUND(
        COUNT(*) FILTER (WHERE rc.id IS NOT NULL)
        * (SELECT sends_per_review_cycle FROM params)
        * (SELECT rate_inr_per_utility_msg FROM params)
    , 2)                                                          AS est_cost_inr
FROM due d
LEFT JOIN reachable rc ON rc.id = d.patient_id
GROUP BY d.due_month
ORDER BY d.due_month;


-- ─────────────────────────────────────────────────────────────────────────────
-- A4. THE BASELINE — what the manual call round currently achieves
--
--     This is the number the feature has to beat, and the number that justifies
--     the price. Two things it shows: how many due patients get called at all,
--     and how many of those calls connect. Every 'not_picked' is a reminder that
--     cost staff time and delivered nothing.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid)
SELECT
    date_trunc('month', f.called_at AT TIME ZONE 'Asia/Kolkata')::date AS month,
    COUNT(*)                                                    AS calls_logged,
    COUNT(DISTINCT f.patient_id)                                AS patients_called,
    COUNT(*) FILTER (WHERE f.call_status = 'picked')            AS picked,
    COUNT(*) FILTER (WHERE f.call_status = 'not_picked')        AS not_picked,
    COUNT(*) FILTER (WHERE f.call_status = 'busy')              AS busy,
    COUNT(*) FILTER (WHERE f.call_status = 'not_reachable')     AS not_reachable,
    ROUND(100.0 * COUNT(*) FILTER (WHERE f.call_status = 'picked')
          / NULLIF(COUNT(*), 0), 1)                             AS pct_connected
FROM public.hospital_patient_followups f
CROSS JOIN params p
WHERE (p.hid IS NULL OR f.hospital_id = p.hid)
GROUP BY 1
ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- A5. COVERAGE OF THE CALL ROUND — of patients who came due, how many were
--     actually called? This is usually the most uncomfortable number, and it is
--     the strongest argument for automation: reception is not failing at calling,
--     there are simply more due patients than callable hours in a morning.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid, 14 AS window_days),
due AS (
    SELECT DISTINCT r.id AS review_id, r.patient_id, r.next_review_date AS due_date
    FROM public.hospital_patient_reviews r
    CROSS JOIN params p
    WHERE r.next_review_date IS NOT NULL
      AND r.next_review_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND r.next_review_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '6 months'
      AND COALESCE(r.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR r.hospital_id = p.hid)
)
SELECT
    date_trunc('month', d.due_date)::date                       AS due_month,
    COUNT(*)                                                     AS reviews_came_due,
    COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.hospital_patient_followups f
        CROSS JOIN params p2
        WHERE f.review_id = d.review_id
          AND (f.called_at AT TIME ZONE 'Asia/Kolkata')::date
              BETWEEN d.due_date - p2.window_days AND d.due_date + p2.window_days
    ))                                                           AS had_a_call_attempt,
    ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.hospital_patient_followups f
        CROSS JOIN params p2
        WHERE f.review_id = d.review_id
          AND (f.called_at AT TIME ZONE 'Asia/Kolkata')::date
              BETWEEN d.due_date - p2.window_days AND d.due_date + p2.window_days
    )) / NULLIF(COUNT(*), 0), 1)                                 AS pct_called
FROM due d
GROUP BY 1
ORDER BY 1;

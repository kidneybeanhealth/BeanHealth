-- =============================================================================
-- BeanHealth — deployment-site metrics for the pitch deck
-- =============================================================================
-- READ-ONLY. Every statement below is a SELECT. Nothing here writes, alters or
-- migrates anything. This is not a migration file — it lives here so the same
-- numbers can be regenerated later with the same definitions.
--
-- Run each numbered block separately in the Supabase SQL editor and copy the
-- result back. Q0 first — it tells you the hospital_id to use.
--
-- SET THE SCOPE: each block starts with
--     WITH params AS (SELECT NULL::uuid AS hid, ...)
-- Leave hid NULL to cover every hospital, or paste a hospital_id from Q0 to
-- restrict to one site.
--
-- -----------------------------------------------------------------------------
-- DEFINITIONS (these are the ones you'll be asked to defend)
-- -----------------------------------------------------------------------------
-- VISIT            A row in hospital_queues that isn't cancelled. Its created_at
--                  (converted to IST) is the visit date. Admission rows count as
--                  visits — the patient was physically at the hospital. To count
--                  OPD consults only, add: AND q.queue_number > 0
--
-- PROMISED REVIEW  A prescription (hospital_prescriptions) carrying a
--                  next_review_date. This table is append-only — one row per
--                  prescription issued — so it is the only truthful source for a
--                  month-by-month history. See CAVEAT 1 at the bottom.
--
-- KEPT THE REVIEW  The patient has a visit between (due_date - 7) and
--                  (due_date + 30), and strictly AFTER the visit that issued the
--                  prescription. The second condition matters: for short review
--                  intervals the -7 day window would otherwise reach back and
--                  count the originating visit as if it were the return.
--
-- TIMEZONE         All timestamps are stored UTC. Every date here is converted
--                  to Asia/Kolkata first, so month boundaries match the clinic's
--                  working day rather than UTC's.
--
-- EXCLUSIONS       Patients marked deceased, or whose follow-up was deliberately
--                  stopped (transferred_out / inactive_lost_followup), are
--                  reported separately and removed from adherence denominators.
--                  Counting a dead patient as a "missed follow-up" is the first
--                  thing a sharp investor will catch.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- Q0. Scope check — which site, how much data, over what window
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    u.id                                                                AS hospital_id,
    u.name                                                              AS hospital_name,
    (SELECT COUNT(*) FROM public.hospital_patients hp
      WHERE hp.hospital_id = u.id)                                      AS patients_registered,
    (SELECT COUNT(*) FROM public.hospital_queues q
      WHERE q.hospital_id = u.id
        AND COALESCE(q.status, '') <> 'cancelled')                      AS visits_all_time,
    (SELECT MIN((q.created_at AT TIME ZONE 'Asia/Kolkata')::date)
       FROM public.hospital_queues q WHERE q.hospital_id = u.id)        AS first_visit,
    (SELECT MAX((q.created_at AT TIME ZONE 'Asia/Kolkata')::date)
       FROM public.hospital_queues q WHERE q.hospital_id = u.id)        AS last_visit,
    (SELECT COUNT(*) FROM public.hospital_prescriptions pr
      WHERE pr.hospital_id = u.id)                                      AS prescriptions_all_time,
    (SELECT COUNT(*) FROM public.hospital_prescriptions pr
      WHERE pr.hospital_id = u.id AND pr.next_review_date IS NOT NULL)  AS prescriptions_with_review_date,
    (SELECT COUNT(*) FROM public.hospital_patient_followups f
      WHERE f.hospital_id = u.id)                                       AS followup_calls_logged,
    (SELECT MIN((f.called_at AT TIME ZONE 'Asia/Kolkata')::date)
       FROM public.hospital_patient_followups f WHERE f.hospital_id = u.id) AS first_call_logged
FROM public.users u
WHERE u.role = 'enterprise'
ORDER BY patients_registered DESC;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q1. HEADLINE — total patients, and the share dormant 12+ months
--     This is your problem slide.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT NULL::uuid AS hid,
           (now() AT TIME ZONE 'Asia/Kolkata')::date AS today
),
last_visit AS (
    SELECT q.patient_id,
           MAX((q.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS last_visit_on
    FROM public.hospital_queues q
    CROSS JOIN params p
    WHERE COALESCE(q.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR q.hospital_id = p.hid)
    GROUP BY q.patient_id
),
base AS (
    SELECT hp.id,
           COALESCE(hp.is_deceased, FALSE)                          AS is_deceased,
           COALESCE(hp.continuity_status, 'active_followup')        AS continuity_status,
           lv.last_visit_on,
           p.today
    FROM public.hospital_patients hp
    CROSS JOIN params p
    LEFT JOIN last_visit lv ON lv.patient_id = hp.id
    WHERE (p.hid IS NULL OR hp.hospital_id = p.hid)
)
SELECT
    COUNT(*)                                                              AS total_patients,
    COUNT(*) FILTER (WHERE is_deceased)                                   AS deceased,
    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status <> 'active_followup')        AS followup_deliberately_stopped,
    COUNT(*) FILTER (WHERE last_visit_on IS NULL)                         AS never_had_a_visit,

    -- The clean denominator: alive, still expected to come back
    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status = 'active_followup')         AS expected_to_return,

    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status = 'active_followup'
                       AND last_visit_on >= today - INTERVAL '12 months') AS active_last_12m,
    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status = 'active_followup'
                       AND last_visit_on <  today - INTERVAL '12 months') AS dormant_12m_plus,

    ROUND(100.0 * COUNT(*) FILTER (WHERE NOT is_deceased
                                     AND continuity_status = 'active_followup'
                                     AND last_visit_on < today - INTERVAL '12 months')
                / NULLIF(COUNT(*) FILTER (WHERE NOT is_deceased
                                            AND continuity_status = 'active_followup'
                                            AND last_visit_on IS NOT NULL), 0), 1)
                                                                          AS pct_dormant_12m_plus,

    -- Same cut at shorter horizons — shows how fast the leak starts
    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status = 'active_followup'
                       AND last_visit_on <  today - INTERVAL '6 months')  AS dormant_6m_plus,
    COUNT(*) FILTER (WHERE NOT is_deceased
                       AND continuity_status = 'active_followup'
                       AND last_visit_on <  today - INTERVAL '3 months')  AS dormant_3m_plus
FROM base;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q2. Month by month — volume. New patients, visits, unique patients seen.
--     Establishes the site is real and shows growth.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid),
visits AS (
    SELECT date_trunc('month', q.created_at AT TIME ZONE 'Asia/Kolkata')::date AS month,
           q.id,
           q.patient_id
    FROM public.hospital_queues q
    CROSS JOIN params p
    WHERE COALESCE(q.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR q.hospital_id = p.hid)
),
first_seen AS (
    SELECT patient_id, MIN(month) AS first_month
    FROM visits
    GROUP BY patient_id
)
SELECT
    v.month,
    COUNT(*)                                          AS visits,
    COUNT(DISTINCT v.patient_id)                      AS unique_patients_seen,
    COUNT(DISTINCT v.patient_id) FILTER
        (WHERE fs.first_month = v.month)              AS new_patients,
    COUNT(DISTINCT v.patient_id) FILTER
        (WHERE fs.first_month < v.month)              AS returning_patients
FROM visits v
JOIN first_seen fs ON fs.patient_id = v.patient_id
GROUP BY v.month
ORDER BY v.month;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q3. THE CORE SLIDE — month by month, reviews promised vs kept vs missed
--     Bucketed by the month the review was DUE.
--     Only fully-elapsed months appear (due date + 30d grace must have passed),
--     so the newest month isn't shown as artificially bad.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT NULL::uuid AS hid,
           (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
           7   AS early_grace_days,   -- came in up to a week before the due date
           30  AS late_grace_days     -- still counts as "kept" up to 30 days late
),
due AS (
    -- One row per (patient, due date): if two doctors both say "15 Aug",
    -- that is still one return trip for the patient.
    SELECT pr.patient_id,
           pr.next_review_date AS due_date,
           MAX((pr.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS issued_on
    FROM public.hospital_prescriptions pr
    CROSS JOIN params p
    WHERE pr.next_review_date IS NOT NULL
      AND COALESCE(pr.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR pr.hospital_id = p.hid)
      AND pr.next_review_date + p.late_grace_days <= p.today
    GROUP BY pr.patient_id, pr.next_review_date
),
scored AS (
    SELECT d.due_date,
           d.patient_id,
           EXISTS (
               SELECT 1
               FROM public.hospital_queues q
               WHERE q.patient_id = d.patient_id
                 AND COALESCE(q.status, '') <> 'cancelled'
                 AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date > d.issued_on
                 AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN d.due_date - p.early_grace_days
                         AND d.due_date + p.late_grace_days
           ) AS kept
    FROM due d
    CROSS JOIN params p
    JOIN public.hospital_patients hp ON hp.id = d.patient_id
    -- don't blame a patient who died or was deliberately discharged from follow-up
    WHERE COALESCE(hp.is_deceased, FALSE) = FALSE
      AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
)
SELECT
    date_trunc('month', due_date)::date        AS review_due_month,
    COUNT(*)                                   AS reviews_due,
    COUNT(*) FILTER (WHERE kept)               AS showed_up,
    COUNT(*) FILTER (WHERE NOT kept)           AS did_not_show_up,
    ROUND(100.0 * COUNT(*) FILTER (WHERE kept) / NULLIF(COUNT(*), 0), 1)
                                               AS pct_showed_up
FROM scored
GROUP BY 1
ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q4. DOES THE FOLLOW-UP SYSTEM WORK — called vs not called
--     Same review population as Q3, split by whether reception logged a call
--     around the due date. Read CAVEAT 2 before putting this on a slide.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT NULL::uuid AS hid,
           (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
           7 AS early_grace_days, 30 AS late_grace_days,
           14 AS call_lookback_days   -- a call this soon before the due date counts as outreach
),
due AS (
    SELECT pr.patient_id,
           pr.next_review_date AS due_date,
           MAX((pr.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS issued_on
    FROM public.hospital_prescriptions pr
    CROSS JOIN params p
    WHERE pr.next_review_date IS NOT NULL
      AND COALESCE(pr.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR pr.hospital_id = p.hid)
      AND pr.next_review_date + p.late_grace_days <= p.today
    GROUP BY pr.patient_id, pr.next_review_date
),
scored AS (
    SELECT date_trunc('month', d.due_date)::date AS review_due_month,
           EXISTS (
               SELECT 1 FROM public.hospital_queues q
               WHERE q.patient_id = d.patient_id
                 AND COALESCE(q.status, '') <> 'cancelled'
                 AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date > d.issued_on
                 AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN d.due_date - p.early_grace_days AND d.due_date + p.late_grace_days
           ) AS kept,
           EXISTS (
               SELECT 1 FROM public.hospital_patient_followups f
               WHERE f.patient_id = d.patient_id
                 AND (f.called_at AT TIME ZONE 'Asia/Kolkata')::date
                     BETWEEN d.due_date - p.call_lookback_days AND d.due_date + p.late_grace_days
           ) AS was_called
    FROM due d
    CROSS JOIN params p
    JOIN public.hospital_patients hp ON hp.id = d.patient_id
    WHERE COALESCE(hp.is_deceased, FALSE) = FALSE
      AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
)
SELECT
    was_called,
    COUNT(*)                                                             AS reviews_due,
    COUNT(*) FILTER (WHERE kept)                                         AS showed_up,
    ROUND(100.0 * COUNT(*) FILTER (WHERE kept) / NULLIF(COUNT(*), 0), 1) AS pct_showed_up
FROM scored
GROUP BY was_called
ORDER BY was_called;

-- Q4b. Same split, month by month — shows the gap opening up as the system got used
WITH params AS (
    SELECT NULL::uuid AS hid,
           (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
           7 AS early_grace_days, 30 AS late_grace_days, 14 AS call_lookback_days
),
due AS (
    SELECT pr.patient_id, pr.next_review_date AS due_date,
           MAX((pr.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS issued_on
    FROM public.hospital_prescriptions pr
    CROSS JOIN params p
    WHERE pr.next_review_date IS NOT NULL
      AND COALESCE(pr.status, '') <> 'cancelled'
      AND (p.hid IS NULL OR pr.hospital_id = p.hid)
      AND pr.next_review_date + p.late_grace_days <= p.today
    GROUP BY pr.patient_id, pr.next_review_date
),
scored AS (
    SELECT date_trunc('month', d.due_date)::date AS review_due_month,
           EXISTS (SELECT 1 FROM public.hospital_queues q
                   WHERE q.patient_id = d.patient_id
                     AND COALESCE(q.status,'') <> 'cancelled'
                     AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date > d.issued_on
                     AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date
                         BETWEEN d.due_date - p.early_grace_days AND d.due_date + p.late_grace_days) AS kept,
           EXISTS (SELECT 1 FROM public.hospital_patient_followups f
                   WHERE f.patient_id = d.patient_id
                     AND (f.called_at AT TIME ZONE 'Asia/Kolkata')::date
                         BETWEEN d.due_date - p.call_lookback_days AND d.due_date + p.late_grace_days) AS was_called
    FROM due d
    CROSS JOIN params p
    JOIN public.hospital_patients hp ON hp.id = d.patient_id
    WHERE COALESCE(hp.is_deceased, FALSE) = FALSE
      AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
)
SELECT
    review_due_month,
    COUNT(*) FILTER (WHERE was_called)                                     AS due_called,
    COUNT(*) FILTER (WHERE was_called AND kept)                            AS called_showed_up,
    ROUND(100.0 * COUNT(*) FILTER (WHERE was_called AND kept)
                / NULLIF(COUNT(*) FILTER (WHERE was_called), 0), 1)        AS pct_called_showed_up,
    COUNT(*) FILTER (WHERE NOT was_called)                                 AS due_not_called,
    COUNT(*) FILTER (WHERE NOT was_called AND kept)                        AS not_called_showed_up,
    ROUND(100.0 * COUNT(*) FILTER (WHERE NOT was_called AND kept)
                / NULLIF(COUNT(*) FILTER (WHERE NOT was_called), 0), 1)    AS pct_not_called_showed_up
FROM scored
GROUP BY review_due_month
ORDER BY review_due_month;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q5. Outreach volume and what it recovered, month by month
--     "The system is being used, and here's what came of it."
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid),
calls AS (
    SELECT date_trunc('month', f.called_at AT TIME ZONE 'Asia/Kolkata')::date AS month,
           f.patient_id,
           f.call_status,
           (f.called_at AT TIME ZONE 'Asia/Kolkata')::date AS called_on
    FROM public.hospital_patient_followups f
    CROSS JOIN params p
    WHERE (p.hid IS NULL OR f.hospital_id = p.hid)
)
SELECT
    c.month,
    COUNT(*)                                                    AS calls_logged,
    COUNT(DISTINCT c.patient_id)                                AS patients_called,
    COUNT(*) FILTER (WHERE c.call_status = 'picked')            AS picked,
    COUNT(*) FILTER (WHERE c.call_status = 'not_picked')        AS not_picked,
    COUNT(*) FILTER (WHERE c.call_status IN ('busy','not_reachable')) AS busy_or_unreachable,
    COUNT(DISTINCT c.patient_id) FILTER (
        WHERE EXISTS (
            SELECT 1 FROM public.hospital_queues q
            WHERE q.patient_id = c.patient_id
              AND COALESCE(q.status,'') <> 'cancelled'
              AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date
                  BETWEEN c.called_on AND c.called_on + 30
        )
    )                                                           AS patients_who_came_within_30d
FROM calls c
GROUP BY c.month
ORDER BY c.month;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q6. How late do the ones who come back actually come?
--     Median / p75 days past the due date. Useful for "we catch them at N days".
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (
    SELECT NULL::uuid AS hid,
           (now() AT TIME ZONE 'Asia/Kolkata')::date AS today,
           7 AS early_grace_days, 30 AS late_grace_days
),
due AS (
    SELECT pr.patient_id, pr.next_review_date AS due_date,
           MAX((pr.created_at AT TIME ZONE 'Asia/Kolkata')::date) AS issued_on
    FROM public.hospital_prescriptions pr
    CROSS JOIN params p
    WHERE pr.next_review_date IS NOT NULL
      AND COALESCE(pr.status,'') <> 'cancelled'
      AND (p.hid IS NULL OR pr.hospital_id = p.hid)
      AND pr.next_review_date + p.late_grace_days <= p.today
    GROUP BY pr.patient_id, pr.next_review_date
),
returned AS (
    SELECT d.due_date,
           (SELECT MIN((q.created_at AT TIME ZONE 'Asia/Kolkata')::date)
              FROM public.hospital_queues q
             WHERE q.patient_id = d.patient_id
               AND COALESCE(q.status,'') <> 'cancelled'
               AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date > d.issued_on
               AND (q.created_at AT TIME ZONE 'Asia/Kolkata')::date
                   BETWEEN d.due_date - p.early_grace_days AND d.due_date + p.late_grace_days
           ) AS came_on
    FROM due d CROSS JOIN params p
)
SELECT
    COUNT(*) FILTER (WHERE came_on IS NOT NULL)                       AS returns_counted,
    ROUND(AVG(came_on - due_date) FILTER (WHERE came_on IS NOT NULL), 1) AS mean_days_late,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (came_on - due_date))
        FILTER (WHERE came_on IS NOT NULL)                            AS median_days_late,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (came_on - due_date))
        FILTER (WHERE came_on IS NOT NULL)                            AS p75_days_late,
    COUNT(*) FILTER (WHERE came_on IS NOT NULL AND came_on <= due_date) AS came_early_or_on_time
FROM returned;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q7. Retention by joining cohort — of patients first seen in month M,
--     what share came back at all within 90 / 180 / 365 days.
--     Only cohorts old enough for the window are counted (NULL otherwise).
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid, (now() AT TIME ZONE 'Asia/Kolkata')::date AS today),
v AS (
    SELECT q.patient_id, (q.created_at AT TIME ZONE 'Asia/Kolkata')::date AS visit_on
    FROM public.hospital_queues q CROSS JOIN params p
    WHERE COALESCE(q.status,'') <> 'cancelled'
      AND (p.hid IS NULL OR q.hospital_id = p.hid)
),
firsts AS (
    SELECT patient_id, MIN(visit_on) AS first_on FROM v GROUP BY patient_id
)
SELECT
    date_trunc('month', f.first_on)::date AS cohort_month,
    COUNT(*)                              AS patients_in_cohort,
    CASE WHEN MAX(f.first_on) + 90 <= MAX(p.today) THEN
        ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM v WHERE v.patient_id = f.patient_id
              AND v.visit_on > f.first_on AND v.visit_on <= f.first_on + 90)) / COUNT(*), 1)
    END                                   AS pct_returned_90d,
    CASE WHEN MAX(f.first_on) + 180 <= MAX(p.today) THEN
        ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM v WHERE v.patient_id = f.patient_id
              AND v.visit_on > f.first_on AND v.visit_on <= f.first_on + 180)) / COUNT(*), 1)
    END                                   AS pct_returned_180d,
    CASE WHEN MAX(f.first_on) + 365 <= MAX(p.today) THEN
        ROUND(100.0 * COUNT(*) FILTER (WHERE EXISTS (
            SELECT 1 FROM v WHERE v.patient_id = f.patient_id
              AND v.visit_on > f.first_on AND v.visit_on <= f.first_on + 365)) / COUNT(*), 1)
    END                                   AS pct_returned_365d
FROM firsts f CROSS JOIN params p
GROUP BY 1
ORDER BY 1;


-- ─────────────────────────────────────────────────────────────────────────────
-- Q8. Where the book stands right now — the live overdue backlog.
--     This one legitimately uses hospital_patient_reviews, because "current
--     state per patient" is exactly what that table holds.
-- ─────────────────────────────────────────────────────────────────────────────
WITH params AS (SELECT NULL::uuid AS hid, (now() AT TIME ZONE 'Asia/Kolkata')::date AS today)
SELECT
    CASE
        WHEN r.next_review_date >  p.today                          THEN 'upcoming'
        WHEN r.next_review_date >= p.today - 30                     THEN 'overdue 1-30d'
        WHEN r.next_review_date >= p.today - 90                     THEN 'overdue 31-90d'
        WHEN r.next_review_date >= p.today - 365                    THEN 'overdue 91-365d'
        ELSE                                                             'overdue 365d+'
    END                                                             AS bucket,
    COUNT(DISTINCT r.patient_id)                                    AS patients,
    COUNT(DISTINCT r.patient_id) FILTER (
        WHERE EXISTS (SELECT 1 FROM public.hospital_patient_followups f
                       WHERE f.patient_id = r.patient_id
                         AND (f.called_at AT TIME ZONE 'Asia/Kolkata')::date >= r.next_review_date - 14)
    )                                                               AS patients_contacted
FROM public.hospital_patient_reviews r
CROSS JOIN params p
JOIN public.hospital_patients hp ON hp.id = r.patient_id
WHERE r.status IN ('pending', 'rescheduled')
  AND r.next_review_date IS NOT NULL
  AND (p.hid IS NULL OR r.hospital_id = p.hid)
  AND COALESCE(hp.is_deceased, FALSE) = FALSE
  AND COALESCE(hp.continuity_status, 'active_followup') = 'active_followup'
GROUP BY 1
ORDER BY 1;


-- =============================================================================
-- CAVEATS — read before any of this goes in front of an investor
-- =============================================================================
-- CAVEAT 1 — hospital_patient_reviews is NOT a history table.
--   sync_hospital_review_from_prescription() UPDATES the existing active review
--   row in place for a given (hospital, patient, doctor): next_review_date is
--   overwritten and completed_at is reset to NULL each time a new prescription
--   is issued. So that table holds the CURRENT review state per patient+doctor,
--   not one row per review cycle. Any month-over-month series built from it will
--   undercount older months and overweight recent ones. That is why Q3-Q6 read
--   from hospital_prescriptions, which is append-only. Q8 is the one legitimate
--   use of the reviews table, because it asks a "right now" question.
--
-- CAVEAT 2 — the called-vs-not-called comparison in Q4 is not a clean experiment.
--   Reception chooses who to call, and probably calls the patients they judge
--   most likely to lapse — or most likely to be reachable. Either way the two
--   groups differ before the call happens. State it as an observed association,
--   not a causal lift. If a partner pushes, the honest strong version is the
--   before/after cut: call tracking only exists from the date in Q0's
--   first_call_logged, so compare site-wide adherence in the months before that
--   date against the months after it (Q3 gives you exactly that series).
--
-- CAVEAT 3 — visits before the software went live.
--   Q0's first_visit is the first visit RECORDED IN THIS SYSTEM, not the clinic's
--   true first visit. Patients seen at KKC before go-live have no history here,
--   so "dormant 12+ months" in Q1 can only be computed for patients the system
--   has actually observed. If the recorded window is shorter than 12 months, say
--   so on the slide and lead with the 3- and 6-month dormancy figures instead.
-- =============================================================================

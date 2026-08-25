import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

export type ReceptionReviewFilter = 'all' | 'due_today' | 'due_tomorrow' | 'upcoming' | 'overdue' | 'followup_needed' | 'not_completed' | 'review_completed' | 'followup_stopped';

export interface ReceptionVisitRecord {
    id: string;
    patient_id: string;
    token_number: string;
    status: string;
    created_at: string;
    next_review_date: string | null;
    tests_to_review?: string | null;
    specialists_to_review?: string | null;
    medications?: any[];
    notes?: string;
    metadata?: any;
    dispensed_at?: string | null;
    doctor?: {
        id?: string;
        name?: string;
        specialty?: string;
        signature_url?: string;
    };
}

export interface ReceptionCallHistoryEntry {
    id: string;
    called_at: string;
    call_status: string | null;
    patient_response: string | null;
}

/**
 * Doctor-grouped review for a single doctor treating this patient
 */
export interface DoctorReview {
    doctorId: string | null;
    doctorName: string | null;
    doctorSpecialty: string | null;
    reviewDate: string | null;
    reviewStatus: string | null;
    reviewCompletedAt: string | null;
    reviewUpdatedAt: string | null;
    reviewCreatedAt: string | null;
    latestFollowupStatus: string | null;
    reviewCategory: ReceptionReviewFilter;
    /** When this review cycle was set (timestamp of the visit that created it) */
    reviewSetAt: string | null;
    /** What set it: a prescription, a discharge card, or a reception-side entry */
    reviewSource: 'prescription' | 'discharge_card' | 'reception' | null;
    /** Why the patient is being brought back, as typed by whoever scheduled it. */
    reviewReason: string | null;
}

export interface ReceptionPastRecordPatient {
    id: string;
    name: string;
    age: number | string | null;
    gender?: string | null;
    phone?: string | null;
    mr_number?: string | null;
    beanhealth_id?: string | null;
    father_husband_name?: string | null;
    app_access_enabled?: boolean;
    isDeceased?: boolean;
    deceasedAt?: string | null;
    continuityStatus?: string | null;
    followupStoppedAt?: string | null;
    followupStopReason?: string | null;
    created_at?: string;
    latestReviewDate: string | null;
    reviewCategory: ReceptionReviewFilter;
    /** Latest review was completed by a visit BEFORE its due date */
    cameEarly?: boolean;
    lastVisitAt: string | null;
    prescriptions: ReceptionVisitRecord[];
    callHistory: ReceptionCallHistoryEntry[];
    /**
     * NEW: Multi-doctor support
     * Array of reviews grouped by doctor when patient has multiple doctors
     * Used internally for doctor-specific filtering in DoctorPastRecordsPanel
     */
    doctorReviews?: DoctorReview[];
}

export interface ReceptionPastRecordsResult {
    patients: ReceptionPastRecordPatient[];
    totalCount: number;
    hasMore: boolean;
}

/**
 * Admitted Patient — a patient who was admitted directly from the
 * live queue (bypassing prescription). Backed by hospital_queues
 * rows with admission_status = 'admitted'. Stays here until the
 * admission is discharged from the Admitted Patients panel.
 */
export interface AdmittedPatientRecord {
    queueId: string;
    patientId: string;
    admittedAt: string | null;
    dischargedAt: string | null;
    admissionStatus: 'admitted' | 'discharged' | 'deceased';
    doctorId: string | null;
    doctorName: string | null;
    doctorSpecialty: string | null;
    tokenNumber: string | null;
    /** When the underlying queue row was created — decides whether it can go back
     *  to the live queue, which only shows rows created today. */
    createdAt: string | null;
    /** The token issued to THIS queue row (null for direct admissions).
     *  Never the patient's stored token — that one belongs to an earlier visit. */
    queueTokenNumber: string | null;
    preparingBy: string | null;
    patient: {
        id: string;
        name: string;
        age: number | string | null;
        token_number?: string | null;
        gender?: string | null;
        phone?: string | null;
        mr_number?: string | null;
        beanhealth_id?: string | null;
        father_husband_name?: string | null;
    };
    prescriptions: ReceptionVisitRecord[];
}

interface FetchReceptionPastRecordsParams {
    hospitalId: string;
    page: number;
    pageSize: number;
    searchQuery?: string;
    reviewFilter?: ReceptionReviewFilter;
    reviewDate?: string;
}

interface SupabaseResult<T = any> {
    data: T;
    error: any;
    count?: number | null;
}

type ReviewRow = {
    id: string;
    patient_id: string;
    doctor_id?: string | null;
    status?: string | null;
    next_review_date?: string | null;
    source_prescription_id?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    review_reason?: string | null;
};

type FollowupRow = {
    id: string;
    patient_id: string;
    doctor_id?: string | null;
    call_status?: string | null;
    called_at?: string | null;
    patient_response?: string | null;
};

const normalizeDateOnly = (value?: string | null): string | null => {
    if (!value) return null;
    return value.split('T')[0] || null;
};

const startOfDay = (value: string): Date => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const deriveReviewCategory = (
    latestReviewDate: string | null,
    latestReviewStatus: string | null,
    latestReviewCompletedAt: string | null,
    latestReviewUpdatedAt: string | null,
    latestReviewCreatedAt: string | null,
    latestFollowupStatus: string | null,
    latestFollowupAt: string | null = null,
    lastVisitAt: string | null = null,
    /** When this review cycle was ASSIGNED — the visit that set the date. */
    reviewSetAt: string | null = null
): ReceptionReviewFilter => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // An unanswered call flags a patient as needing chasing — but ONLY once their
    // review date has actually passed (or was never set). A patient due today or
    // tomorrow has missed nothing yet: the reminder call simply didn't connect, and
    // they must stay in their Due Today / Due Tomorrow list so reception still
    // calls them. The unanswered status is surfaced on the row either way.
    const dueDay = latestReviewDate ? startOfDay(latestReviewDate) : null;
    const isPastDue = !dueDay || dueDay.getTime() < today.getTime();

    if (latestFollowupStatus === 'not_picked' && isPastDue) {
        // Still open, and no visit since the call — a visit resolves the chase.
        const reviewIsActive = latestReviewStatus === 'pending' || latestReviewStatus === 'rescheduled';
        const visitedAfterCall = Boolean(
            latestFollowupAt && lastVisitAt &&
            new Date(lastVisitAt).getTime() > new Date(latestFollowupAt).getTime()
        );
        if (reviewIsActive && !visitedAfterCall) {
            return 'followup_needed';
        }
    }

    // A closed review is DONE and must never reach the date comparison below.
    //
    // It used to fall through whenever it was closed ON OR AFTER its due date and
    // more than two days ago: too old for the Review Completed window, and not an
    // early completion either, so it dropped past both branches and re-emerged as
    // 'overdue'. That is the whole reason KNH/26/012858 (Divakar, 06 Jul, closed
    // 13 Jul) and KNH/26/009448 (unassigned, 05 Jun, closed 06 Jun) sat in Missed
    // Followup while their cards read "Upcoming" — the collapsed patient category
    // came from their live review, the list matched the dead one.
    //
    // 'cancelled' is included for the same reason. Cancelled rows today are
    // written with next_review_date = NULL so they never reached the comparison,
    // but that is an accident of the current write paths, not a guarantee.
    if (latestReviewStatus === 'completed' || latestReviewStatus === 'cancelled') {
        const completionReference = latestReviewCompletedAt || latestReviewCreatedAt || latestReviewUpdatedAt;
        if (latestReviewStatus === 'completed' && completionReference) {
            const completedAt = startOfDay(completionReference);
            const ageDays = Math.floor((today.getTime() - completedAt.getTime()) / (24 * 60 * 60 * 1000));
            if (ageDays >= 0 && ageDays < 2) {
                return 'review_completed';
            }
        }
        return 'not_completed';
    }

    if (!latestReviewDate) {
        return 'not_completed';
    }

    const parsed = new Date(latestReviewDate);
    parsed.setHours(0, 0, 0, 0);

    if (parsed.getTime() === today.getTime()) {
        return 'due_today';
    }

    if (parsed.getTime() === tomorrow.getTime()) {
        return 'due_tomorrow';
    }

    if (parsed.getTime() >= today.getTime()) {
        return 'upcoming';
    }

    // MISSED FOLLOW-UP MEANS "STILL HASN'T COME", NOT "A DATE WENT PAST".
    //
    // The clinic runs two doctors — a nephrologist and a urologist — and a patient
    // needing both usually finishes both the same day. A review set by one followed
    // by a visit to the other is routine, expected care that the doctor is fully
    // aware of. Reviews are per doctor and a visit closes only the prescribing
    // doctor's, so without this the other doctor's review ages into a false miss.
    //
    // THE TEST IS THE VISIT AGAINST WHEN THE REVIEW WAS ASSIGNED — not against its
    // due date. Comparing to the due date is wrong and was the earlier mistake:
    //
    //     10 Jul  sees Divakar     → review assigned for 10 Aug
    //     05 Aug  sees Prabhakar   → review assigned for 15 Aug
    //
    // On 12 Aug the Divakar review has "passed", but the patient was in the clinic
    // on 5 Aug and the doctor who saw them then set the current plan. The 10 Aug
    // review was superseded at that visit; it is not a missed follow-up. Comparing
    // to the due date (5 Aug < 10 Aug) would keep flagging her forever.
    //
    // So: any visit AFTER the review was assigned supersedes it. `lastVisitAt` is
    // the patient's latest prescription under ANY doctor, which is what makes the
    // cross-referral case work. Equal timestamps mean this review IS the one that
    // visit created, so the comparison is strict.
    //
    // Two rules, both confirmed with the clinic:
    //   • Any later visit clears it, however late, and whichever doctor was seen.
    //     Whether they came late is the Overdue Weekly Report's job; this list is
    //     who still needs chasing today.
    //   • No lookback limit the other way. Someone overdue since March who has not
    //     been seen at all stays listed until they attend, or until follow-up is
    //     formally stopped — the deliberate way to remove a patient for good.
    if (lastVisitAt) {
        const visitedAt = new Date(lastVisitAt).getTime();

        // Superseded by a later visit, whoever they saw.
        const assignedAt = reviewSetAt || latestReviewCreatedAt;
        if (assignedAt && visitedAt > new Date(assignedAt).getTime()) {
            return 'not_completed';
        }

        // Or simply attended on/after the due date — the fallback when we can't
        // tell when the review was assigned.
        if (startOfDay(lastVisitAt).getTime() >= parsed.getTime()) {
            return 'not_completed';
        }
    }

    return 'overdue';
};

const escapeForIlike = (value: string): string => value.replace(/[%_]/g, (m) => `\\${m}`).trim();

const chunkArray = <T>(items: T[], chunkSize: number): T[][] => {
    if (chunkSize <= 0) return [items];
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
    }
    return chunks;
};

const getReviewSortTime = (review: ReviewRow): number => {
    const ref = review.updated_at || review.created_at || review.completed_at || review.next_review_date;
    return ref ? new Date(ref).getTime() : 0;
};

/**
 * DEPRECATED: Use groupReviewsByDoctor() instead
 * Kept for backward compatibility
 */
const pickPrimaryReview = (patientReviews: ReviewRow[]): ReviewRow | null => {
    if (!patientReviews.length) return null;

    const active = patientReviews
        .filter((review) => review.status === 'pending' || review.status === 'rescheduled')
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (active.length > 0) return active[0];

    const dated = patientReviews
        .filter((review) => Boolean(normalizeDateOnly(review.next_review_date || null)))
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (dated.length > 0) return dated[0];

    const completed = patientReviews
        .filter((review) => review.status === 'completed')
        .sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a));
    if (completed.length > 0) return completed[0];

    return patientReviews.sort((a, b) => getReviewSortTime(b) - getReviewSortTime(a))[0];
};

/**
 * Group reviews by doctor and return primary review per doctor
 * Handles multi-doctor scenarios where patient has reviews with multiple doctors
 *
 * @param patientReviews - All reviews for a single patient
 * @param doctorNamesMap - Map of doctor_id → {name, specialty} (from prescriptions)
 * @param followupsByDoctor - Map of doctor_id → latest followup status
 * @returns Array of doctor-grouped reviews with primary review per doctor
 */
const groupReviewsByDoctor = (
    patientReviews: ReviewRow[],
    doctorNamesMap: Map<string, { name: string; specialty: string }>,
    followupsByDoctor: Map<string | null, { status: string | null; calledAt: string | null }>,
    lastVisitAt: string | null = null,
    rxInfoById: Map<string, { createdAt: string; documentType: string | null }> = new Map()
): DoctorReview[] => {
    if (!patientReviews.length) return [];

    // Group reviews by doctor_id
    const reviewsByDoctor = new Map<string | null, ReviewRow[]>();
    for (const review of patientReviews) {
        const doctorId = review.doctor_id || null;
        if (!reviewsByDoctor.has(doctorId)) {
            reviewsByDoctor.set(doctorId, []);
        }
        reviewsByDoctor.get(doctorId)!.push(review);
    }

    // Pick primary review per doctor and build DoctorReview objects
    const doctorReviews: DoctorReview[] = [];
    for (const [doctorId, reviews] of reviewsByDoctor) {
        const primaryReview = pickPrimaryReview(reviews);

        // A CANCELLED review is not an appointment — it was explicitly called off,
        // by the visit-supersedes trigger, a stop-follow-up, a deceased mark, or the
        // 19 Aug backfill collapsing a duplicate. Rendering it alongside the live
        // appointment is what made cancelled ownerless rows look like unassigned
        // patients on Due Tomorrow cards. 'completed' still renders: "seen on X" is
        // real history the caller needs.
        //
        // pickPrimaryReview already prefers an active row, so this only ever drops a
        // doctor whose reviews are ALL cancelled. Patients left with no chip at all
        // fall through to the card's existing single-date fallback.
        if (primaryReview && primaryReview.status === 'cancelled') continue;

        if (primaryReview) {
            const doctorInfo = doctorId ? doctorNamesMap.get(doctorId) : null;
            const reviewDate = normalizeDateOnly(primaryReview.next_review_date || null);
            const followupInfo = doctorId ? followupsByDoctor.get(doctorId) || null : null;
            const latestFollowupStatus = followupInfo?.status || null;

            // Origin: which visit set this review cycle. Drives the "set on" label
            // AND the superseded test — a later visit than this makes the review stale.
            const sourceRx = primaryReview.source_prescription_id
                ? rxInfoById.get(primaryReview.source_prescription_id) || null
                : null;
            // When this cycle was actually ASSIGNED. For a prescription-backed review
            // that is the visit; for a manually-entered one it is when the row was
            // created. Deliberately NOT updated_at — any later touch rewrites it, so
            // a review cancelled by the 19 Aug backfill was labelled "set 20 Aug",
            // making a months-old row look like it had just been created.
            const reviewSetAt = sourceRx?.createdAt || primaryReview.created_at || primaryReview.updated_at || null;

            // deriveReviewCategory still gets the ORIGINAL expression. Feeding it
            // created_at would make more reviews look older than the visit and so
            // supersede more of them — probably correct, but it changes who appears
            // in Missed Followup, which is a clinical call rather than a display fix.
            const assignedAtForCategory = sourceRx?.createdAt || primaryReview.updated_at || primaryReview.created_at || null;

            const reviewCategory = deriveReviewCategory(
                reviewDate,
                primaryReview.status || null,
                primaryReview.completed_at || null,
                primaryReview.updated_at || null,
                primaryReview.created_at || null,
                latestFollowupStatus,
                followupInfo?.calledAt || null,
                lastVisitAt,
                assignedAtForCategory
            );

            const reviewSource: DoctorReview['reviewSource'] = sourceRx
                ? (sourceRx.documentType === 'discharge_card' ? 'discharge_card' : 'prescription')
                : (primaryReview.source_prescription_id ? 'prescription' : 'reception');

            doctorReviews.push({
                doctorId: doctorId || null,
                doctorName: doctorInfo?.name || null,
                doctorSpecialty: doctorInfo?.specialty || null,
                reviewDate,
                reviewStatus: primaryReview.status || null,
                reviewCompletedAt: primaryReview.completed_at || null,
                reviewUpdatedAt: primaryReview.updated_at || null,
                reviewCreatedAt: primaryReview.created_at || null,
                latestFollowupStatus,
                reviewCategory,
                reviewSetAt,
                reviewSource,
                reviewReason: primaryReview.review_reason || null,
            });
        }
    }

    // Sort by review date (newest first)
    doctorReviews.sort((a, b) => {
        const aTime = a.reviewDate ? new Date(a.reviewDate).getTime() : 0;
        const bTime = b.reviewDate ? new Date(b.reviewDate).getTime() : 0;
        return bTime - aTime;
    });

    return doctorReviews;
};

/** Local-timezone YYYY-MM-DD (the app treats "today" as local midnight). */
const localDateKey = (offsetDays = 0): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Patient IDs that could belong to a review-driven filter.
 *
 * Why not just fetch every patient and categorise client-side: an unranged
 * Supabase query is capped at 1000 rows server-side, so on a hospital with
 * thousands of patients the older ones were never fetched and silently vanished
 * from Due Today / Due Tomorrow / Missed Followup. Resolving candidates from the
 * reviews table instead bounds the work by how many reviews are actually due —
 * which stays small no matter how large the patient database grows.
 *
 * THIS MUST RETURN A SUPERSET. It runs *before* deriveReviewCategory, which is
 * the only thing entitled to decide a patient's bucket. Every rule applied here
 * that the derivation does not apply is a patient who silently disappears from
 * the list while their card still shows the bucket they should be in. Two such
 * rules already cost us:
 *
 *   1. `status IN ('pending','rescheduled')` — the derivation only treats
 *      'completed' specially; any other status still falls through to the plain
 *      date comparison. Narrowing here hid those patients.
 *   2. reviews-only — the derivation falls back to the *prescription's*
 *      next_review_date when the primary review row carries no date, so a
 *      patient can legitimately be due on a day with no dated review row.
 *
 * So: over-fetch on purpose, and let the derivation reject. A candidate that
 * turns out not to belong costs one wasted row; a missing candidate costs a
 * patient nobody calls.
 *
 * Returns null when the filter isn't review-date driven (caller keeps the
 * existing paginated path).
 */
const fetchFilterCandidatePatientIds = async (
    hospitalId: string,
    reviewFilter: ReceptionReviewFilter,
    reviewDate: string
): Promise<Set<string> | null> => {
    const isCandidateDriven = Boolean(reviewDate)
        || ['due_today', 'due_tomorrow', 'upcoming', 'overdue', 'followup_needed', 'review_completed'].includes(reviewFilter);
    if (!isCandidateDriven) return null;

    const ids = new Set<string>();
    const PAGE = 1000;

    /** Page through a review query, collecting patient_ids. */
    const collect = async (build: (q: any) => any) => {
        let from = 0;
        while (true) {
            let q = (supabase.from('hospital_patient_reviews' as any) as any)
                .select('patient_id')
                .eq('hospital_id', hospitalId);
            q = build(q).range(from, from + PAGE - 1);
            const res = await withTimeout(q as any, 10000, 'Timed out while resolving filter candidates') as SupabaseResult<any[]>;
            if (res.error) {
                const msg = String(res.error.message || '').toLowerCase();
                if (msg.includes('hospital_patient_reviews')) return; // table missing on older DBs
                throw res.error;
            }
            const rows = res.data || [];
            rows.forEach(r => r.patient_id && ids.add(r.patient_id));
            if (rows.length < PAGE) break;
            from += PAGE;
        }
    };

    /**
     * Page through a prescription query, collecting patient_ids.
     *
     * The card falls back to the prescription's next_review_date whenever the
     * primary review row has none, so a patient can be due on a day that has no
     * dated review row at all. Only used for exact-date filters — the day's
     * prescriptions are a small, bounded set, whereas "every prescription dated
     * before today" would be the entire history of the clinic.
     */
    const collectPrescriptions = async (targetDate: string) => {
        let from = 0;
        while (true) {
            const res = await withTimeout(
                ((supabase.from('hospital_prescriptions' as any) as any)
                    .select('patient_id')
                    .eq('hospital_id', hospitalId)
                    .eq('next_review_date', targetDate)
                    .range(from, from + PAGE - 1)) as any,
                10000,
                'Timed out while resolving prescription-dated candidates'
            ) as SupabaseResult<any[]>;
            if (res.error) return; // non-fatal: review-sourced candidates still stand
            const rows = res.data || [];
            rows.forEach(r => r.patient_id && ids.add(r.patient_id));
            if (rows.length < PAGE) break;
            from += PAGE;
        }
    };

    const today = localDateKey(0);
    const tomorrow = localDateKey(1);

    // No status narrowing on any date branch — the derivation is the arbiter.
    if (reviewDate) {
        await collect(q => q.eq('next_review_date', reviewDate));
        await collectPrescriptions(reviewDate);
    } else if (reviewFilter === 'due_today') {
        await collect(q => q.eq('next_review_date', today));
        await collectPrescriptions(today);
    } else if (reviewFilter === 'due_tomorrow') {
        await collect(q => q.eq('next_review_date', tomorrow));
        await collectPrescriptions(tomorrow);
    } else if (reviewFilter === 'upcoming') {
        await collect(q => q.gt('next_review_date', today));
    } else if (reviewFilter === 'review_completed') {
        // Completed within the last 2 days — matches deriveReviewCategory's window
        const since = localDateKey(-2);
        await collect(q => q.eq('status', 'completed').gte('completed_at', `${since}T00:00:00`));
    } else if (reviewFilter === 'overdue' || reviewFilter === 'followup_needed') {
        // The "Missed Followup" chip covers overdue reviews AND patients whose last
        // call went unanswered — the latter can carry any review date, so both
        // sets are gathered and the derivation decides the final category.
        //
        // Deliberately NOT extended with prescription-dated candidates: "every
        // prescription dated before today" is the clinic's entire history, and
        // pulling it would undo the bound this function exists to create. A patient
        // who is overdue purely via the prescription fallback is reachable through
        // the Review Date filter, which does query both sources.
        await collect(q => q.lt('next_review_date', today));

        let from = 0;
        while (true) {
            const res = await withTimeout(
                ((supabase.from('hospital_patient_followups' as any) as any)
                    .select('patient_id')
                    .eq('hospital_id', hospitalId)
                    .eq('call_status', 'not_picked')
                    .range(from, from + PAGE - 1)) as any,
                10000,
                'Timed out while resolving follow-up candidates'
            ) as SupabaseResult<any[]>;
            if (res.error) {
                const msg = String(res.error.message || '').toLowerCase();
                if (msg.includes('hospital_patient_followups')) break;
                throw res.error;
            }
            const rows = res.data || [];
            rows.forEach(r => r.patient_id && ids.add(r.patient_id));
            if (rows.length < PAGE) break;
            from += PAGE;
        }
    }

    return ids;
};

export async function fetchReceptionPastRecords(
    params: FetchReceptionPastRecordsParams
): Promise<ReceptionPastRecordsResult> {
    const {
        hospitalId,
        page,
        pageSize,
        searchQuery = '',
        reviewFilter = 'all',
        reviewDate = '',
    } = params;

    const from = page * pageSize;
    const to = from + pageSize - 1;
    const needsDerivedFiltering = reviewFilter !== 'all' || Boolean(reviewDate);

    // Review-driven filters resolve their candidates from the reviews table first,
    // so the patient fetch is bounded by how many reviews are due rather than by
    // the size of the patient database (which would silently hit the 1000-row cap).
    const candidateIds = await fetchFilterCandidatePatientIds(hospitalId, reviewFilter, reviewDate);
    if (candidateIds && candidateIds.size === 0) {
        return { patients: [], totalCount: 0, hasMore: false };
    }
    const candidateList = candidateIds ? Array.from(candidateIds) : null;

    const buildPatientsQuery = (includeDeceasedFields: boolean, idChunk?: string[]): any => {
        const selectClause = includeDeceasedFields
            ? 'id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, app_access_enabled, is_deceased, deceased_at, continuity_status, followup_stopped_at, followup_stop_reason, created_at'
            : 'id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, app_access_enabled, created_at';

        let query: any = (supabase
            .from('hospital_patients') as any)
            .select(selectClause, { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false });

        if (idChunk) {
            query = query.in('id', idChunk);
        } else if (!needsDerivedFiltering) {
            query = query.range(from, to);
        }

        // Stopped patients are deliberately invisible to every review bucket —
        // latestReviewDate is forced null for them — so the only way to list them
        // is off continuity_status directly.
        if (reviewFilter === 'followup_stopped' && includeDeceasedFields) {
            // Deceased patients belong here too. markPatientDeceased writes
            // is_deceased and cancels the reviews, but never touches
            // continuity_status — so filtering on that column alone made every
            // patient marked deceased from Admitted Patients unlistable. They are
            // the clearest case of "no longer being followed up", and leaving them
            // out meant the only record of the decision was a badge on a card
            // nobody could navigate to.
            query = query.or('continuity_status.in.(transferred_out,inactive_lost_followup),is_deceased.is.true');
        }

        const trimmedSearch = searchQuery.trim();
        if (trimmedSearch) {
            const escaped = escapeForIlike(trimmedSearch);
            query = query.or(`name.ilike.%${escaped}%,mr_number.ilike.%${escaped}%`);
        }

        return query;
    };

    /** Fetch the candidate patients in chunks so the IN() list never oversizes the URL. */
    const fetchCandidatePatients = async (includeDeceasedFields: boolean): Promise<SupabaseResult<any[]>> => {
        const rows: any[] = [];
        for (const chunk of chunkArray(candidateList as string[], 100)) {
            const res = await withTimeout(
                buildPatientsQuery(includeDeceasedFields, chunk),
                10000,
                'Timed out while loading patient records'
            ) as SupabaseResult<any[]>;
            if (res.error) return res;
            rows.push(...(res.data || []));
        }
        return { data: rows, error: null, count: rows.length };
    };

    let patientsResult = candidateList
        ? await fetchCandidatePatients(true)
        : await withTimeout(
            buildPatientsQuery(true),
            10000,
            'Timed out while loading patient records'
        ) as SupabaseResult<any[]>;

    if (patientsResult.error) {
        const message = String(patientsResult.error.message || '').toLowerCase();
        const missingLifecycleColumns =
            message.includes('is_deceased') ||
            message.includes('deceased_at') ||
            message.includes('continuity_status') ||
            message.includes('followup_stopped_at') ||
            message.includes('followup_stop_reason');
        if (missingLifecycleColumns) {
            patientsResult = candidateList
                ? await fetchCandidatePatients(false)
                : await withTimeout(
                    buildPatientsQuery(false),
                    10000,
                    'Timed out while loading patient records'
                ) as SupabaseResult<any[]>;
        }
    }

    if (patientsResult.error) {
        throw patientsResult.error;
    }

    const basePatients = (patientsResult.data || []) as any[];
    const patientIds = basePatients.map((p) => p.id);

    if (patientIds.length === 0) {
        return {
            patients: [],
            totalCount: patientsResult.count || 0,
            hasMore: false,
        };
    }

    const idChunks = chunkArray(patientIds, 120);
    const prescriptions: ReceptionVisitRecord[] = [];
    const reviews: ReviewRow[] = [];
    const followups: FollowupRow[] = [];

    for (const idChunk of idChunks) {
        const [prescriptionsChunkResult, reviewsChunkResult, followupsChunkResult] = await Promise.all([
            withTimeout(
                (supabase
                    .from('hospital_prescriptions' as any)
                    .select(`
                        id, patient_id, token_number, status, created_at, next_review_date,
                        tests_to_review, specialists_to_review, medications, notes, metadata, dispensed_at,
                        doctor:hospital_doctors(id, name, specialty, signature_url)
                    `)
                    .eq('hospital_id', hospitalId)
                    .in('patient_id', idChunk)
                    .order('created_at', { ascending: false })) as any,
                12000,
                'Timed out while loading prescription history'
            ),
            withTimeout(
                (supabase
                    .from('hospital_patient_reviews' as any)
                    .select('id, patient_id, doctor_id, status, next_review_date, source_prescription_id, completed_at, created_at, updated_at, review_reason')
                    .eq('hospital_id', hospitalId)
                    .in('patient_id', idChunk)
                    .order('updated_at', { ascending: false })) as any,
                10000,
                'Timed out while loading review status'
            ),
            withTimeout(
                (supabase
                    .from('hospital_patient_followups' as any)
                    .select('id, patient_id, doctor_id, call_status, called_at, patient_response')
                    .eq('hospital_id', hospitalId)
                    .in('patient_id', idChunk)
                    .order('called_at', { ascending: false })) as any,
                10000,
                'Timed out while loading follow-up status'
            ),
        ]) as [SupabaseResult<ReceptionVisitRecord[]>, SupabaseResult<ReviewRow[]>, SupabaseResult<FollowupRow[]>];

        if (prescriptionsChunkResult.error) {
            throw prescriptionsChunkResult.error;
        }

        if (reviewsChunkResult.error) {
            const message = String(reviewsChunkResult.error.message || '').toLowerCase();
            if (!message.includes('hospital_patient_reviews')) {
                throw reviewsChunkResult.error;
            }
        }

        if (followupsChunkResult.error) {
            const message = String(followupsChunkResult.error.message || '').toLowerCase();
            if (!message.includes('hospital_patient_followups')) {
                throw followupsChunkResult.error;
            }
        }

        prescriptions.push(...((prescriptionsChunkResult.data || []) as ReceptionVisitRecord[]));
        reviews.push(...((reviewsChunkResult.data || []) as ReviewRow[]));
        followups.push(...((followupsChunkResult.data || []) as FollowupRow[]));
    }

    const prescriptionsByPatient = new Map<string, ReceptionVisitRecord[]>();
    for (const rx of prescriptions) {
        if (!prescriptionsByPatient.has(rx.patient_id)) {
            prescriptionsByPatient.set(rx.patient_id, []);
        }
        prescriptionsByPatient.get(rx.patient_id)!.push(rx);
    }

    for (const [, visitHistory] of prescriptionsByPatient) {
        visitHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    const reviewsByPatient = new Map<string, ReviewRow[]>();
    for (const review of reviews) {
        if (!reviewsByPatient.has(review.patient_id)) {
            reviewsByPatient.set(review.patient_id, []);
        }
        reviewsByPatient.get(review.patient_id)!.push(review);
    }

    const latestFollowupStatusByPatient = new Map<string, string | null>();
    const latestFollowupAtByPatient = new Map<string, string | null>();
    const latestFollowupStatusByDoctorPerPatient = new Map<string, Map<string | null, { status: string | null; calledAt: string | null }>>();
    const followupsByPatient = new Map<string, ReceptionCallHistoryEntry[]>();

    for (const followup of followups) {
        // Latest followup status per patient (backward compatibility)
        if (!latestFollowupStatusByPatient.has(followup.patient_id)) {
            latestFollowupStatusByPatient.set(followup.patient_id, followup.call_status || null);
            latestFollowupAtByPatient.set(followup.patient_id, followup.called_at || null);
        }

        // Latest followup status per doctor per patient (multi-doctor support)
        if (!latestFollowupStatusByDoctorPerPatient.has(followup.patient_id)) {
            latestFollowupStatusByDoctorPerPatient.set(followup.patient_id, new Map());
        }
        const doctorMap = latestFollowupStatusByDoctorPerPatient.get(followup.patient_id)!;
        const doctorId = followup.doctor_id || null;
        if (!doctorMap.has(doctorId)) {
            doctorMap.set(doctorId, { status: followup.call_status || null, calledAt: followup.called_at || null });
        }

        if (!followupsByPatient.has(followup.patient_id)) {
            followupsByPatient.set(followup.patient_id, []);
        }
        followupsByPatient.get(followup.patient_id)!.push({
            id: followup.id,
            called_at: followup.called_at || '',
            call_status: followup.call_status || null,
            patient_response: followup.patient_response || null,
        });
    }

    for (const [, followupEntries] of followupsByPatient) {
        followupEntries.sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
    }

    // Build doctor name map from prescriptions for use in groupReviewsByDoctor
    const doctorNamesMap = new Map<string, { name: string; specialty: string }>();
    for (const rx of prescriptions) {
        if (rx.doctor?.id && rx.doctor.name) {
            doctorNamesMap.set(rx.doctor.id, {
                name: rx.doctor.name,
                specialty: rx.doctor.specialty || '',
            });
        }
    }

    const normalized: ReceptionPastRecordPatient[] = basePatients
        .map((p) => {
            const isDeceased = Boolean(p.is_deceased);
            const continuityStatus = p.continuity_status || 'active_followup';
            const isFollowupStopped = continuityStatus === 'transferred_out' || continuityStatus === 'inactive_lost_followup';
            const visitHistory = prescriptionsByPatient.get(p.id) || [];
            const latestPrescription = visitHistory[0] || null;
            const latestReview = pickPrimaryReview(reviewsByPatient.get(p.id) || []);

            // NEW: Get doctor-grouped reviews for multi-doctor support
            const followupsByDoctorMap = latestFollowupStatusByDoctorPerPatient.get(p.id) || new Map();
            // Prescription lookup for review-origin labels ("set on" + document type).
            // Legacy discharge cards carried a notes marker instead of metadata.
            const rxInfoById = new Map<string, { createdAt: string; documentType: string | null }>();
            for (const rx of visitHistory) {
                const metaType = (rx.metadata as any)?.documentType || null;
                const notesType = typeof rx.notes === 'string' && rx.notes.startsWith('DocType: discharge_card')
                    ? 'discharge_card'
                    : null;
                rxInfoById.set(rx.id, { createdAt: rx.created_at, documentType: metaType || notesType });
            }

            const doctorReviews = (isDeceased || isFollowupStopped)
                ? []
                : groupReviewsByDoctor(
                    reviewsByPatient.get(p.id) || [],
                    doctorNamesMap,
                    followupsByDoctorMap,
                    latestPrescription?.created_at || null,
                    rxInfoById
                );

            // Review rows are the operational source of truth (call logs/reschedules/completions);
            // prescription date is used as a fallback when no review row exists.
            const reviewDateFromReview = normalizeDateOnly(latestReview?.next_review_date || null);
            const fallbackReviewDate = normalizeDateOnly(latestPrescription?.next_review_date || null);
            const latestReviewDate = (isDeceased || isFollowupStopped)
                ? null
                : (reviewDateFromReview || fallbackReviewDate);

            const reviewCategory = (isDeceased || isFollowupStopped)
                ? 'not_completed'
                : deriveReviewCategory(
                    latestReviewDate,
                    latestReview?.status || null,
                    latestReview?.completed_at || null,
                    latestReview?.updated_at || null,
                    latestReview?.created_at || null,
                    latestFollowupStatusByPatient.get(p.id) || null,
                    latestFollowupAtByPatient.get(p.id) || null,
                    latestPrescription?.created_at || null,
                    // When the collapsed review was assigned. The source prescription
                    // is authoritative; the review row's own created_at is stale for a
                    // repointed row, so it is only the fallback.
                    (latestReview?.source_prescription_id
                        ? prescriptionsByPatient.get(p.id)?.find(rx => rx.id === latestReview.source_prescription_id)?.created_at
                        : null)
                        || latestReview?.updated_at
                        || latestReview?.created_at
                        || null
                );

            const completedLocalDate = toLocalDateOnly(latestReview?.completed_at || null);
            const cameEarly = Boolean(
                latestReview?.status === 'completed' &&
                completedLocalDate &&
                reviewDateFromReview &&
                completedLocalDate < reviewDateFromReview
            );

            return {
                ...p,
                isDeceased,
                deceasedAt: p.deceased_at || null,
                continuityStatus,
                followupStoppedAt: p.followup_stopped_at || null,
                followupStopReason: p.followup_stop_reason || null,
                latestReviewDate,
                reviewCategory,
                cameEarly,
                lastVisitAt: latestPrescription?.created_at || p.created_at || null,
                prescriptions: visitHistory,
                callHistory: (followupsByPatient.get(p.id) || []).slice(0, 3),
                doctorReviews,
            } as ReceptionPastRecordPatient;
        })
        .filter((patient) => {
            // A patient treated by two doctors has a bucket PER DOCTOR — that is what
            // doctorReviews carries. `patient.reviewCategory` collapses them into one,
            // chosen by pickPrimaryReview, which sorts active reviews by updated_at.
            // So the *most recently touched* review wins, not the most relevant one:
            // KNH/26/014560 held a pending review for tomorrow under one doctor and a
            // rescheduled 09-Aug review under the other. Rescheduling the older one
            // bumped its updated_at, the collapsed category flipped to 'overdue', and a
            // patient genuinely due tomorrow vanished from Due Tomorrow.
            //
            // Match against every doctor's category. A patient can legitimately be due
            // tomorrow for one doctor and overdue for another, and belongs in both
            // lists — reception needs to chase the missed one AND expect them tomorrow.
            const categories = [
                patient.reviewCategory,
                ...(patient.doctorReviews || []).map((dr) => dr.reviewCategory),
            ];

            // Stop-follow-up is a lifecycle state, not a review category: these
            // patients have no active review by definition, so matching them against
            // reviewCategory would always fail.
            if (reviewFilter === 'followup_stopped') {
                return patient.continuityStatus === 'transferred_out'
                    || patient.continuityStatus === 'inactive_lost_followup'
                    || patient.isDeceased === true;
            }

            if (reviewFilter !== 'all') {
                // 'overdue' chip is surfaced as "Missed Followup" — it consolidates
                // date-overdue patients and not-picked-call (followup_needed) patients.
                const matchesFilter = reviewFilter === 'overdue'
                    ? categories.some((c) => c === 'overdue' || c === 'followup_needed')
                    : categories.some((c) => c === reviewFilter);
                if (!matchesFilter) return false;
            }

            if (reviewDate) {
                const matchesDate = patient.latestReviewDate === reviewDate
                    || (patient.doctorReviews || []).some((dr) => dr.reviewDate === reviewDate);
                if (!matchesDate) return false;
            }

            return true;
        })
        .sort((a, b) => {
            const aTime = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
            const bTime = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
            return bTime - aTime;
        });

    const pagedPatients = needsDerivedFiltering
        ? normalized.slice(from, to + 1)
        : normalized;

    const effectiveTotal = needsDerivedFiltering
        ? normalized.length
        : (patientsResult.count || 0);

    return {
        patients: pagedPatients,
        totalCount: effectiveTotal,
        hasMore: to + 1 < effectiveTotal,
    };
}

interface SyncPrescriptionReviewParams {
    hospitalId: string;
    patientId: string;
    doctorId: string;
    prescriptionId: string;
    nextReviewDate: string | null;
    testsToReview?: string | null;
    specialistsToReview?: string | null;
}

export async function syncReviewFromPrescription(
    params: SyncPrescriptionReviewParams
): Promise<void> {
    const {
        hospitalId,
        patientId,
        doctorId,
        prescriptionId,
        nextReviewDate,
        testsToReview = null,
        specialistsToReview = null,
    } = params;

    if (!hospitalId || !patientId || !doctorId || !prescriptionId || !nextReviewDate) {
        return;
    }

    // Scoped per doctor — the active-review uniqueness rule is per (patient, doctor),
    // and matching by patient alone can update the wrong doctor's review.
    const activeReviewResult = await withTimeout(
        (supabase
            .from('hospital_patient_reviews' as any)
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .eq('doctor_id', doctorId)
            .in('status', ['pending', 'rescheduled'])
            .order('next_review_date', { ascending: false })
            .limit(1)
            .maybeSingle()) as any,
        10000,
        'Timed out while loading active review'
    ) as SupabaseResult<{ id: string } | null>;

    if (activeReviewResult.error) {
        const message = String(activeReviewResult.error.message || '').toLowerCase();
        if (!message.includes('hospital_patient_reviews')) {
            throw activeReviewResult.error;
        }
        return;
    }

    if (activeReviewResult.data?.id) {
        const updateResult = await withTimeout(
            ((supabase
                .from('hospital_patient_reviews' as any) as any)
                .update({
                    next_review_date: nextReviewDate,
                    tests_to_review: testsToReview,
                    specialists_to_review: specialistsToReview,
                    source_prescription_id: prescriptionId,
                    status: 'pending',
                    cancelled_at: null,
                    completed_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', activeReviewResult.data.id)) as any,
            10000,
            'Timed out while updating active review'
        ) as SupabaseResult;

        if (updateResult.error) {
            throw updateResult.error;
        }
        return;
    }

    const insertResult = await withTimeout(
        ((supabase
            .from('hospital_patient_reviews' as any) as any)
            .insert({
                hospital_id: hospitalId,
                patient_id: patientId,
                doctor_id: doctorId,
                source_prescription_id: prescriptionId,
                next_review_date: nextReviewDate,
                tests_to_review: testsToReview,
                specialists_to_review: specialistsToReview,
                status: 'pending',
            })) as any,
        10000,
        'Timed out while creating review record'
    ) as SupabaseResult;

    if (insertResult.error) {
        throw insertResult.error;
    }
}

interface UpdatePatientAppAccessParams {
    hospitalId: string;
    patientId: string;
    enabled: boolean;
}

export interface ScheduleReviewParams {
    hospitalId: string;
    patientId: string;
    /** Required. See the note on unassigned reviews below. */
    doctorId: string;
    /** YYYY-MM-DD */
    reviewDate: string;
    /** Why the patient is being brought back — read by whoever calls them. */
    reviewReason?: string | null;
    testsToReview?: string | null;
    specialistsToReview?: string | null;
    /**
     * Optional correction to hospital_patients.age. Most patients added to
     * follow-up by hand have no age on file; capturing it at the moment someone
     * is already looking at the record is cheaper than a separate cleanup.
     * Only written when a value is supplied — never blanked.
     */
    age?: string | null;
}

/**
 * Put an existing patient into the follow-up loop without a visit.
 *
 * For the patient who needs chasing but isn't being seen today — a lab result to
 * recheck, someone the doctor wants back, a review that was never set at all.
 *
 * doctorId is REQUIRED, deliberately. Reception-created reviews with a null
 * doctor are the "Unassigned" rows that have caused most of the mess in this
 * table: they belong to nobody, so no visit ever closes them, they never appear
 * under a doctor's own list, and they age into false Missed Followups. Every
 * review created here has an owner.
 *
 * Repoints the existing active review rather than inserting a second one.
 * idx_unique_active_review_per_doctor allows only ONE active review per
 * (hospital, patient, doctor), and a blind insert throws
 * "duplicate key value violates idx_unique_active_review_per_doctor" — the same
 * error that broke prescription sends in June. This mirrors what the DB trigger
 * does for prescriptions.
 */
export async function scheduleReviewForPatient(
    params: ScheduleReviewParams
): Promise<{ created: boolean }> {
    const { hospitalId, patientId, doctorId, reviewDate, reviewReason = null, testsToReview = null, specialistsToReview = null, age = null } = params;
    if (!hospitalId || !patientId || !doctorId || !reviewDate) {
        throw new Error('Hospital, patient, doctor and review date are all required');
    }

    const nowIso = new Date().toISOString();

    // Non-fatal by design: a bad age must never stop the follow-up being scheduled,
    // which is the thing the user actually came here to do.
    if (age && String(age).trim()) {
        try {
            await withTimeout(
                ((supabase.from('hospital_patients' as any) as any)
                    .update({ age: String(age).trim() })
                    .eq('hospital_id', hospitalId)
                    .eq('id', patientId)) as any,
                8000,
                'Timed out while updating age'
            );
        } catch (err) {
            console.warn('[scheduleReviewForPatient] age update failed (non-critical)', err);
        }
    }

    const existing = await withTimeout(
        ((supabase.from('hospital_patient_reviews' as any) as any)
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .eq('doctor_id', doctorId)
            .in('status', ['pending', 'rescheduled'])
            .order('next_review_date', { ascending: false })
            .limit(1)
            .maybeSingle()) as any,
        10000,
        'Timed out while checking existing reviews'
    ) as SupabaseResult<{ id: string } | null>;

    if (existing.error) throw existing.error;

    if (existing.data?.id) {
        const updateResult = await withTimeout(
            ((supabase.from('hospital_patient_reviews' as any) as any)
                .update({
                    next_review_date: reviewDate,
                    review_reason: reviewReason,
                    tests_to_review: testsToReview,
                    specialists_to_review: specialistsToReview,
                    status: 'rescheduled',
                    cancelled_at: null,
                    completed_at: null,
                    updated_at: nowIso,
                })
                .eq('id', existing.data.id)) as any,
            10000,
            'Timed out while updating the review'
        ) as SupabaseResult;
        if (updateResult.error) throw updateResult.error;
        return { created: false };
    }

    const insertResult = await withTimeout(
        ((supabase.from('hospital_patient_reviews' as any) as any).insert({
            hospital_id: hospitalId,
            patient_id: patientId,
            doctor_id: doctorId,
            next_review_date: reviewDate,
            review_reason: reviewReason,
            tests_to_review: testsToReview,
            specialists_to_review: specialistsToReview,
            status: 'pending',
        })) as any,
        10000,
        'Timed out while scheduling the review'
    ) as SupabaseResult;

    if (insertResult.error) throw insertResult.error;
    return { created: true };
}

interface StopPatientFollowupParams {
    hospitalId: string;
    patientId: string;
    reason: string;
    notes?: string;
}

/**
 * Stop active follow-up for a patient who has moved care externally.
 *
 * This marks the patient continuity status as transferred_out and cancels
 * all active review rows so they no longer appear in upcoming/pending buckets.
 */
export async function stopPatientFollowup(
    params: StopPatientFollowupParams
): Promise<void> {
    const { hospitalId, patientId, reason, notes = '' } = params;

    if (!hospitalId || !patientId || !reason.trim()) {
        throw new Error('Missing required identifiers or reason');
    }

    const nowIso = new Date().toISOString();

    const patientUpdateResult = await withTimeout(
        ((supabase
            .from('hospital_patients' as any) as any)
            .update({
                continuity_status: 'transferred_out',
                followup_stopped_at: nowIso,
                followup_stop_reason: reason,
                followup_stop_notes: notes || null,
                updated_at: nowIso,
            })
            .eq('hospital_id', hospitalId)
            .eq('id', patientId)) as any,
        10000,
        'Timed out while stopping patient follow-up'
    ) as SupabaseResult;

    if (patientUpdateResult.error) {
        const message = String(patientUpdateResult.error.message || '').toLowerCase();
        const missingLifecycleColumns =
            message.includes('continuity_status') ||
            message.includes('followup_stopped_at') ||
            message.includes('followup_stop_reason') ||
            message.includes('followup_stop_notes') ||
            message.includes('updated_at');

        if (!missingLifecycleColumns) {
            throw patientUpdateResult.error;
        }

        // Backward compatibility: allow review cancellation even when the
        // lifecycle columns have not been migrated yet.
        console.warn('[stopPatientFollowup] lifecycle columns missing, proceeding with review cancellation only');
    }

    const cancelReviewsResult = await withTimeout(
        ((supabase
            .from('hospital_patient_reviews' as any) as any)
            .update({
                status: 'cancelled',
                cancelled_at: nowIso,
                next_review_date: null,
                updated_at: nowIso,
            })
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .in('status', ['pending', 'rescheduled'])) as any,
        10000,
        'Timed out while cancelling active reviews'
    ) as SupabaseResult;

    if (cancelReviewsResult.error) {
        const message = String(cancelReviewsResult.error.message || '').toLowerCase();
        if (!message.includes('hospital_patient_reviews')) {
            throw cancelReviewsResult.error;
        }
    }
}

export async function updatePatientAppAccess(
    params: UpdatePatientAppAccessParams
): Promise<void> {
    const { hospitalId, patientId, enabled } = params;

    if (!hospitalId || !patientId) {
        throw new Error('Missing hospital or patient identifier');
    }

    const updateResult = await withTimeout(
        ((supabase
            .from('hospital_patients' as any) as any)
            .update({
                app_access_enabled: enabled,
            })
            .eq('hospital_id', hospitalId)
            .eq('id', patientId)) as any,
        10000,
        'Timed out while updating patient app access'
    ) as SupabaseResult;

    if (updateResult.error) {
        throw updateResult.error;
    }
}

// ============================================================
// Patient Admission flows (used by both Reception + Doctor)
// ============================================================

interface AdmitPatientFromQueueParams {
    queueId: string;
    hospitalId: string;
}

/**
 * Admit a patient directly from the live queue (no prescription).
 * The queue row is marked completed (so it exits the live queue
 * and flows naturally to Past Records) and stamped with
 * admission_status = 'admitted' + admitted_at timestamp.
 */
export async function admitPatientFromQueue(
    params: AdmitPatientFromQueueParams
): Promise<void> {
    const { queueId, hospitalId } = params;
    if (!queueId || !hospitalId) {
        throw new Error('Missing queue or hospital identifier');
    }

    const nowIso = new Date().toISOString();

    const updateResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .update({
                status: 'completed',
                admission_status: 'admitted',
                admitted_at: nowIso,
                discharged_at: null,
                updated_at: nowIso,
            })
            .eq('id', queueId)
            .eq('hospital_id', hospitalId)) as any,
        10000,
        'Timed out while admitting patient'
    ) as SupabaseResult;

    if (updateResult.error) {
        throw updateResult.error;
    }
}

interface DischargePatientParams {
    queueId: string;
    hospitalId: string;
}

/**
 * Discharge an admitted patient. admission_status flips to
 * 'discharged' and discharged_at gets a timestamp. The row
 * remains in the Past Records view but leaves the
 * Admitted Patients view.
 */
export async function dischargePatient(
    params: DischargePatientParams
): Promise<void> {
    const { queueId, hospitalId } = params;
    if (!queueId || !hospitalId) {
        throw new Error('Missing queue or hospital identifier');
    }

    const nowIso = new Date().toISOString();

    const updateResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .update({
                admission_status: 'discharged',
                discharged_at: nowIso,
                updated_at: nowIso,
            })
            .eq('id', queueId)
            .eq('hospital_id', hospitalId)) as any,
        10000,
        'Timed out while discharging patient'
    ) as SupabaseResult;

    if (updateResult.error) {
        throw updateResult.error;
    }
}

// ── Return an admission to the live queue ───────────────────────────

/** Local YYYY-MM-DD — the live queue works in clinic-local days, not UTC. */
const localDayKey = (value: string | Date): string => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export interface AdmissionReturnEligibility {
    allowed: boolean;
    /** Why it can't go back — shown as the disabled button's tooltip. */
    reason: string | null;
}

/**
 * Can this admission be put back into the live queue?
 *
 * Only same-day admissions that *came from* a live queue qualify. Two hard
 * constraints drive this, and both must hold or the row would disappear from
 * every view at once:
 *
 *   1. The live queue reads `doctor_id = <me>` — a direct admission from
 *      Reception has no doctor_id, so there is no queue for it to return to.
 *   2. The live queue reads `created_at >= today` — restoring a row created on
 *      an earlier day would leave it `pending` but invisible: gone from the
 *      queue (too old), gone from History (not completed), and gone from
 *      Admitted (no admission_status). A silent orphan.
 *
 * Shared by the UI (to gate the button) and the service (to gate the write) so
 * the rule cannot drift between them.
 */
export function getAdmissionReturnEligibility(record: {
    admissionStatus?: string | null;
    doctorId?: string | null;
    admittedAt?: string | null;
    createdAt?: string | null;
}): AdmissionReturnEligibility {
    const today = localDayKey(new Date());

    if ((record.admissionStatus || 'admitted') !== 'admitted') {
        return { allowed: false, reason: 'This admission is already closed.' };
    }
    if (!record.doctorId) {
        return {
            allowed: false,
            reason: 'Added straight to Admitted without a doctor queue — there is no live queue to return to. Register the patient at Reception instead.',
        };
    }
    if (!record.admittedAt || localDayKey(record.admittedAt) !== today) {
        return {
            allowed: false,
            reason: 'Only patients admitted today can be returned to the live queue.',
        };
    }
    if (!record.createdAt || localDayKey(record.createdAt) !== today) {
        return {
            allowed: false,
            reason: "This visit was registered on an earlier day, so it cannot re-enter today's queue.",
        };
    }
    return { allowed: true, reason: null };
}

interface ReturnAdmissionToQueueParams {
    queueId: string;
    hospitalId: string;
}

/**
 * Undo an admission and put the patient back in the live queue.
 *
 * For the common case where a patient is admitted from the queue and then asks
 * to come back another day: the admission stamps are cleared and `status` goes
 * back to 'pending', so the row re-appears in the doctor's queue holding the
 * same token it already had.
 *
 * Eligibility is re-checked against the stored row rather than trusted from the
 * caller — the panel may have been open for a while, and another device could
 * have discharged the patient in the meantime.
 */
export async function returnAdmissionToQueue(
    params: ReturnAdmissionToQueueParams
): Promise<void> {
    const { queueId, hospitalId } = params;
    if (!queueId || !hospitalId) {
        throw new Error('Missing queue or hospital identifier');
    }

    const rowResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .select('id, doctor_id, created_at, admission_status, admitted_at')
            .eq('id', queueId)
            .eq('hospital_id', hospitalId)
            .maybeSingle()) as any,
        8000,
        'Timed out while checking the admission'
    ) as SupabaseResult<any>;

    if (rowResult.error) throw rowResult.error;
    if (!rowResult.data) throw new Error('This admission no longer exists');

    const eligibility = getAdmissionReturnEligibility({
        admissionStatus: rowResult.data.admission_status,
        doctorId: rowResult.data.doctor_id,
        admittedAt: rowResult.data.admitted_at,
        createdAt: rowResult.data.created_at,
    });
    if (!eligibility.allowed) {
        throw new Error(eligibility.reason || 'This admission cannot be returned to the queue');
    }

    const nowIso = new Date().toISOString();

    const updateResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .update({
                status: 'pending',
                admission_status: null,
                admitted_at: null,
                discharged_at: null,
                // A stale "preparing" badge would follow the row back into the
                // queue and read as someone actively working on it.
                preparing_by: null,
                updated_at: nowIso,
            })
            .eq('id', queueId)
            .eq('hospital_id', hospitalId)
            .eq('admission_status', 'admitted')) as any,
        10000,
        'Timed out while returning patient to the queue'
    ) as SupabaseResult;

    if (updateResult.error) throw updateResult.error;
}

interface MarkPatientDeceasedParams {
    queueId: string;
    hospitalId: string;
    patientId: string;
}

/**
 * Mark an admitted patient as deceased.
 *
 * Effects:
 * 1) Patient row is flagged (`is_deceased=true`, `deceased_at=now`).
 * 2) Admission queue row is closed with `admission_status='deceased'`.
 * 3) Any active review rows (`pending`/`rescheduled`) are cancelled and
 *    `next_review_date` is cleared so deceased patients don't remain in
 *    upcoming/overdue review buckets.
 */
export async function markPatientDeceased(
    params: MarkPatientDeceasedParams
): Promise<void> {
    const { queueId, hospitalId, patientId } = params;
    if (!queueId || !hospitalId || !patientId) {
        throw new Error('Missing queue, hospital, or patient identifier');
    }

    const nowIso = new Date().toISOString();

    const patientUpdateResult = await withTimeout(
        ((supabase.from('hospital_patients' as any) as any)
            .update({
                is_deceased: true,
                deceased_at: nowIso,
            })
            .eq('hospital_id', hospitalId)
            .eq('id', patientId)) as any,
        10000,
        'Timed out while marking patient as deceased'
    ) as SupabaseResult;

    if (patientUpdateResult.error) {
        throw patientUpdateResult.error;
    }

    const queueUpdateResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .update({
                admission_status: 'deceased',
                discharged_at: nowIso,
                updated_at: nowIso,
            })
            .eq('id', queueId)
            .eq('hospital_id', hospitalId)) as any,
        10000,
        'Timed out while marking admission as deceased'
    ) as SupabaseResult;

    if (queueUpdateResult.error) {
        throw queueUpdateResult.error;
    }

    const cancelReviewsResult = await withTimeout(
        ((supabase.from('hospital_patient_reviews' as any) as any)
            .update({
                status: 'cancelled',
                cancelled_at: nowIso,
                next_review_date: null,
                updated_at: nowIso,
            })
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .in('status', ['pending', 'rescheduled'])) as any,
        10000,
        'Timed out while cancelling upcoming reviews for deceased patient'
    ) as SupabaseResult;

    if (cancelReviewsResult.error) {
        const message = String(cancelReviewsResult.error.message || '').toLowerCase();
        if (!message.includes('hospital_patient_reviews')) {
            throw cancelReviewsResult.error;
        }
    }
}

export interface AdmitPatientDirectlyParams {
    hospitalId: string;
    patientId: string;
}

/**
 * Admission/discharge event for a patient — used by the Visit Journey timeline.
 * Sourced from hospital_queues rows where this patient was admitted/discharged.
 */
export interface PatientAdmissionEvent {
    queueId: string;
    admittedAt: string | null;
    dischargedAt: string | null;
    admissionStatus: 'admitted' | 'discharged' | 'deceased';
    doctorId: string | null;
    tokenNumber: string | null;
}

/**
 * Fetch ALL prescriptions for a single patient — paginated to bypass the
 * Supabase 1000-row server cap. Used by the Visit History timeline where
 * we need the complete journey, not just the truncated rows from the
 * past-records list query.
 */
export async function fetchAllPatientPrescriptions(
    hospitalId: string,
    patientId: string
): Promise<ReceptionVisitRecord[]> {
    if (!hospitalId || !patientId) return [];

    const PAGE = 1000;
    const all: ReceptionVisitRecord[] = [];
    let from = 0;
    while (true) {
        const result = await withTimeout(
            (supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    id, patient_id, token_number, status, created_at, next_review_date,
                    tests_to_review, specialists_to_review, medications, notes, metadata, dispensed_at,
                    doctor:hospital_doctors(id, name, specialty, signature_url)
                `)
                .eq('hospital_id', hospitalId)
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false })
                .range(from, from + PAGE - 1)) as any,
            12000,
            'Timed out while loading prescription history'
        ) as SupabaseResult<ReceptionVisitRecord[]>;

        if (result.error) throw result.error;
        const rows = (result.data as ReceptionVisitRecord[]) || [];
        if (rows.length === 0) break;
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

/**
 * Fetch all admission/discharge events for a single patient in a hospital.
 * Returns the raw queue rows that ever had an admission attached.
 */
export async function fetchPatientAdmissionEvents(
    hospitalId: string,
    patientId: string
): Promise<PatientAdmissionEvent[]> {
    if (!hospitalId || !patientId) return [];

    const result = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .select('id, patient_id, doctor_id, token_number, admission_status, admitted_at, discharged_at')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .not('admitted_at', 'is', null)
            .order('admitted_at', { ascending: false })) as any,
        10000,
        'Timed out while loading admission history'
    ) as SupabaseResult;

    if (result.error) {
        // hospital_queues.admission_status / admitted_at may not be migrated on older DBs
        const msg = String(result.error.message || '').toLowerCase();
        if (msg.includes('admission_status') || msg.includes('admitted_at')) return [];
        throw result.error;
    }

    return ((result.data as any[]) || []).map(row => ({
        queueId: row.id,
        admittedAt: row.admitted_at || null,
        dischargedAt: row.discharged_at || null,
        admissionStatus: (row.admission_status || 'admitted') as 'admitted' | 'discharged' | 'deceased',
        doctorId: row.doctor_id || null,
        tokenNumber: row.token_number || null,
    }));
}

export interface PendingReviewInfo {
    id: string;
    next_review_date: string | null;
    status: string;
    /** Needed to tell whether a NEW review would clash with this one — the
     *  active-review uniqueness rule is per (hospital, patient, doctor). */
    doctor_id?: string | null;
}

/**
 * Admit a patient directly (not from the live queue).
 * Creates a new completed queue row with admission_status='admitted'
 * and cancels any active review rows so the patient doesn't remain
 * in upcoming/overdue review buckets while admitted.
 */
export async function admitPatientDirectly(
    params: AdmitPatientDirectlyParams
): Promise<void> {
    const { hospitalId, patientId } = params;
    if (!hospitalId || !patientId) {
        throw new Error('Missing hospital or patient identifier');
    }

    const nowIso = new Date().toISOString();

    // Guard: don't create a second admission row if the patient is already admitted.
    // Prevents duplicate admitted-section rows and duplicate History Log entries.
    const existing = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any)
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .eq('admission_status', 'admitted')
            .limit(1)) as any,
        8000,
        'Timed out checking admission status'
    ) as SupabaseResult<any[]>;
    if (existing.error) {
        const msg = String(existing.error.message || '').toLowerCase();
        // Older DBs without admission_status: fall through and insert.
        if (!msg.includes('admission_status')) throw existing.error;
    } else if (Array.isArray(existing.data) && existing.data.length > 0) {
        throw new Error('Patient is already admitted');
    }

    const insertResult = await withTimeout(
        ((supabase.from('hospital_queues' as any) as any).insert({
            hospital_id: hospitalId,
            patient_id: patientId,
            queue_number: 0,
            status: 'completed',
            admission_status: 'admitted',
            admitted_at: nowIso,
            updated_at: nowIso,
        })) as any,
        10000,
        'Timed out while admitting patient'
    ) as SupabaseResult;

    if (insertResult.error) throw insertResult.error;

    const cancelResult = await withTimeout(
        ((supabase.from('hospital_patient_reviews' as any) as any)
            .update({
                status: 'cancelled',
                cancelled_at: nowIso,
                next_review_date: null,
                updated_at: nowIso,
            })
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .in('status', ['pending', 'rescheduled'])) as any,
        10000,
        'Timed out while cancelling reviews for admission'
    ) as SupabaseResult;

    if (cancelResult.error) {
        const msg = String(cancelResult.error.message || '').toLowerCase();
        if (!msg.includes('hospital_patient_reviews')) throw cancelResult.error;
    }
}

/**
 * Fetch active (pending/rescheduled) review rows for a patient.
 * Used by the direct-admit confirmation modal to warn the receptionist
 * that scheduled reviews will be cancelled on admission.
 */
export async function fetchPatientPendingReviews(
    hospitalId: string,
    patientId: string
): Promise<PendingReviewInfo[]> {
    if (!hospitalId || !patientId) return [];
    const result = await withTimeout(
        ((supabase.from('hospital_patient_reviews' as any) as any)
            .select('id, next_review_date, status, doctor_id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .in('status', ['pending', 'rescheduled'])
            .order('next_review_date', { ascending: true })) as any,
        8000,
        'Timed out loading pending reviews'
    ) as SupabaseResult<PendingReviewInfo[]>;
    if (result.error) return [];
    return Array.isArray(result.data) ? result.data : [];
}

interface FetchAdmittedPatientsParams {
    hospitalId: string;
    doctorId?: string | null;
    searchQuery?: string;
}

/**
 * Fetch currently-admitted patients for a hospital (optionally
 * scoped to a single doctor). Returns patient info + any
 * prescriptions linked to the admission queue row (usually 0
 * since admit skips prescribing, but kept for future hybrid flows).
 *
 * Admitted patients are hospital_queues rows where
 * admission_status = 'admitted' (discharged rows are filtered out).
 * Chunked lookups to avoid oversized REST URLs on large hospitals.
 */
export async function fetchAdmittedPatients(
    params: FetchAdmittedPatientsParams
): Promise<AdmittedPatientRecord[]> {
    const { hospitalId, doctorId, searchQuery } = params;
    if (!hospitalId) return [];

    let query = (supabase.from('hospital_queues' as any) as any)
        .select('id, patient_id, doctor_id, queue_number, token_number, created_at, admission_status, admitted_at, discharged_at, preparing_by')
        .eq('hospital_id', hospitalId)
        .eq('admission_status', 'admitted')
        .order('admitted_at', { ascending: false, nullsFirst: false });

    if (doctorId) {
        query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    }

    const queueResult = await withTimeout(query as any, 10000, 'Timed out loading admitted patients') as SupabaseResult<any[]>;
    if (queueResult.error) throw queueResult.error;

    const rawQueueRows = Array.isArray(queueResult.data) ? queueResult.data : [];
    if (rawQueueRows.length === 0) return [];

    // Dedupe by patient: a patient admitted more than once should appear only
    // once. Rows are ordered by admitted_at desc, so the first seen is the latest.
    const seenPatients = new Set<string>();
    const queueRows = rawQueueRows.filter((r: any) => {
        if (!r.patient_id) return true;
        if (seenPatients.has(r.patient_id)) return false;
        seenPatients.add(r.patient_id);
        return true;
    });

    const patientIds = Array.from(new Set(queueRows.map(r => r.patient_id).filter(Boolean))) as string[];
    const doctorIds = Array.from(new Set(queueRows.map(r => r.doctor_id).filter(Boolean))) as string[];
    const queueIds = queueRows.map(r => r.id as string);

    // Chunked patient lookup
    const PATIENT_CHUNK = 50;
    const patientMap = new Map<string, any>();
    for (let i = 0; i < patientIds.length; i += PATIENT_CHUNK) {
        const chunk = patientIds.slice(i, i + PATIENT_CHUNK);
        const res = await withTimeout(
            (supabase.from('hospital_patients' as any) as any)
                .select('id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, token_number')
                .in('id', chunk) as any,
            10000,
            'Timed out loading admitted patient details'
        ) as SupabaseResult<any[]>;
        if (res.error) throw res.error;
        (res.data || []).forEach((p: any) => patientMap.set(p.id, p));
    }

    // Doctor lookup (small, no chunking needed)
    const doctorMap = new Map<string, any>();
    if (doctorIds.length > 0) {
        const res = await withTimeout(
            (supabase.from('hospital_doctors' as any) as any)
                .select('id, name, specialty')
                .in('id', doctorIds) as any,
            10000,
            'Timed out loading doctor details'
        ) as SupabaseResult<any[]>;
        if (!res.error && Array.isArray(res.data)) {
            res.data.forEach((d: any) => doctorMap.set(d.id, d));
        }
    }

    // Prescriptions linked to these admission queue rows (usually empty)
    const prescriptionsByQueue = new Map<string, ReceptionVisitRecord[]>();
    if (queueIds.length > 0) {
        const PRES_CHUNK = 50;
        for (let i = 0; i < queueIds.length; i += PRES_CHUNK) {
            const chunk = queueIds.slice(i, i + PRES_CHUNK);
            const res = await withTimeout(
                (supabase.from('hospital_prescriptions' as any) as any)
                    .select('id, patient_id, queue_id, token_number, status, created_at, next_review_date, tests_to_review, specialists_to_review, medications, notes, metadata, dispensed_at, doctor_id')
                    .in('queue_id', chunk)
                    .order('created_at', { ascending: false }) as any,
                10000,
                'Timed out loading admission prescriptions'
            ) as SupabaseResult<any[]>;
            if (!res.error && Array.isArray(res.data)) {
                for (const row of res.data) {
                    const doc = row.doctor_id ? doctorMap.get(row.doctor_id) : null;
                    const rec: ReceptionVisitRecord = {
                        id: row.id,
                        patient_id: row.patient_id,
                        token_number: row.token_number,
                        status: row.status,
                        created_at: row.created_at,
                        next_review_date: row.next_review_date,
                        tests_to_review: row.tests_to_review,
                        specialists_to_review: row.specialists_to_review,
                        medications: row.medications,
                        notes: row.notes,
                        metadata: row.metadata,
                        dispensed_at: row.dispensed_at,
                        doctor: doc ? { id: doc.id, name: doc.name, specialty: doc.specialty } : undefined,
                    };
                    const arr = prescriptionsByQueue.get(row.queue_id) || [];
                    arr.push(rec);
                    prescriptionsByQueue.set(row.queue_id, arr);
                }
            }
        }
    }

    const results: AdmittedPatientRecord[] = [];
    for (const row of queueRows) {
        const patient = patientMap.get(row.patient_id);
        if (!patient) continue;

        if (searchQuery) {
            const q = searchQuery.trim().toLowerCase();
            if (q) {
                const hay = [
                    patient.name,
                    patient.mr_number,
                    patient.beanhealth_id,
                    patient.phone,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!hay.includes(q)) continue;
            }
        }

        const doc = row.doctor_id ? doctorMap.get(row.doctor_id) : null;
        results.push({
            queueId: row.id,
            patientId: row.patient_id,
            admittedAt: row.admitted_at || null,
            dischargedAt: row.discharged_at || null,
            admissionStatus: (row.admission_status || 'admitted') as 'admitted' | 'discharged' | 'deceased',
            doctorId: row.doctor_id || null,
            doctorName: doc?.name || null,
            doctorSpecialty: doc?.specialty || null,
            tokenNumber: patient.token_number || null,
            createdAt: row.created_at || null,
            queueTokenNumber: row.token_number || null,
            preparingBy: row.preparing_by || null,
            patient: {
                id: patient.id,
                name: patient.name,
                age: patient.age,
                token_number: patient.token_number || null,
                gender: patient.gender,
                phone: patient.phone,
                mr_number: patient.mr_number,
                beanhealth_id: patient.beanhealth_id,
                father_husband_name: patient.father_husband_name,
            },
            prescriptions: prescriptionsByQueue.get(row.id) || [],
        });
    }

    return results;
}

/**
 * Fetch all prescriptions for a specific patient, newest first.
 * Used by the "View Rx" action on Admitted Patients panels.
 */
export async function fetchPatientPrescriptions(
    hospitalId: string,
    patientId: string
): Promise<ReceptionVisitRecord[]> {
    if (!hospitalId || !patientId) return [];

    const result = await withTimeout(
        (supabase.from('hospital_prescriptions' as any) as any)
            .select('id, patient_id, queue_id, token_number, status, created_at, next_review_date, tests_to_review, specialists_to_review, medications, notes, metadata, dispensed_at, doctor_id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .limit(50) as any,
        10000,
        'Timed out loading patient prescriptions'
    ) as SupabaseResult<any[]>;

    if (result.error) throw result.error;
    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length === 0) return [];

    const doctorIds = Array.from(new Set(rows.map(r => r.doctor_id).filter(Boolean))) as string[];
    const doctorMap = new Map<string, any>();
    if (doctorIds.length > 0) {
        const res = await withTimeout(
            (supabase.from('hospital_doctors' as any) as any)
                .select('id, name, specialty, signature_url')
                .in('id', doctorIds) as any,
            10000,
            'Timed out loading doctor details'
        ) as SupabaseResult<any[]>;
        if (!res.error && Array.isArray(res.data)) {
            res.data.forEach((d: any) => doctorMap.set(d.id, d));
        }
    }

    return rows.map((row: any): ReceptionVisitRecord => {
        const doc = row.doctor_id ? doctorMap.get(row.doctor_id) : null;
        return {
            id: row.id,
            patient_id: row.patient_id,
            token_number: row.token_number,
            status: row.status,
            created_at: row.created_at,
            next_review_date: row.next_review_date,
            tests_to_review: row.tests_to_review,
            specialists_to_review: row.specialists_to_review,
            medications: row.medications,
            notes: row.notes,
            metadata: row.metadata,
            dispensed_at: row.dispensed_at,
            doctor: doc ? {
                id: doc.id,
                name: doc.name,
                specialty: doc.specialty,
                signature_url: doc.signature_url,
            } : undefined,
        };
    });
}

// ============================================================================
// HELPER FUNCTIONS: Multi-Doctor Support
// ============================================================================

/**
 * Get doctor-specific reviews for a patient
 * Used by DoctorPastRecordsPanel to show only the logged-in doctor's reviews
 *
 * @param patientRecord - Patient record from fetchReceptionPastRecords
 * @param doctorId - Doctor ID to filter by
 * @returns DoctorReview object for this doctor, or null if no review
 */
export function getDoctorSpecificReview(
    patientRecord: ReceptionPastRecordPatient,
    doctorId: string
): DoctorReview | null {
    if (!patientRecord.doctorReviews) return null;
    return patientRecord.doctorReviews.find((dr) => dr.doctorId === doctorId) || null;
}

/**
 * Get all doctor reviews for a patient (for multi-doctor display)
 * Shows review dates grouped by doctor
 *
 * @param patientRecord - Patient record from fetchReceptionPastRecords
 * @returns Array of doctor reviews, sorted by review date
 */
export function getAllDoctorReviews(patientRecord: ReceptionPastRecordPatient): DoctorReview[] {
    return patientRecord.doctorReviews || [];
}

/**
 * Format doctor reviews for display
 * Example: "Dr. A - May 10 (Due) | Dr. B - May 15 (Upcoming)"
 *
 * @param patientRecord - Patient record with doctorReviews
 * @returns Formatted string for display, or null if no reviews
 */
export function formatDoctorReviewsForDisplay(patientRecord: ReceptionPastRecordPatient): string | null {
    const doctorReviews = getAllDoctorReviews(patientRecord);
    if (doctorReviews.length === 0) return null;

    const formatted = doctorReviews.map((dr) => {
        const doctorName = dr.doctorName || 'Unassigned';
        const dateStr = dr.reviewDate ? new Date(dr.reviewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Unscheduled';
        const categoryLabel = getCategoryLabel(dr.reviewCategory);
        return `${doctorName} - ${dateStr} (${categoryLabel})`;
    });

    return formatted.join(' | ');
}

/**
 * Get user-friendly label for review category
 */
function getCategoryLabel(category: ReceptionReviewFilter): string {
    const labels: Record<ReceptionReviewFilter, string> = {
        'due_today': 'Due Today',
        'due_tomorrow': 'Due Tomorrow',
        'upcoming': 'Upcoming',
        'overdue': 'Overdue',
        'followup_needed': 'Followup Needed',
        'not_completed': 'Not Completed',
        'review_completed': 'Completed',
        'followup_stopped': 'Follow-up Stopped',
        'all': 'All',
    };
    return labels[category] || category;
}

/**
 * Filter patient records by doctor
 * Used by DoctorPastRecordsPanel to show only patients with reviews from this doctor
 *
 * @param patients - Array of patient records
 * @param doctorId - Doctor ID to filter by
 * @returns Filtered array of patients who have reviews from this doctor
 */
export function filterPatientsByDoctor(
    patients: ReceptionPastRecordPatient[],
    doctorId: string
): ReceptionPastRecordPatient[] {
    return patients.filter((p) => {
        const doctorReview = getDoctorSpecificReview(p, doctorId);
        return doctorReview !== null;
    });
}

/* ───────────────────────── Reception activity reports ─────────────────────────
 * Shared data source for the Past Records "Overdue Weekly Report" and
 * "Calendar" views. One ranged fetch returns visits, calls, and due reviews
 * with patient/doctor names resolved; the panels aggregate client-side.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ReceptionActivityVisit {
    queueId: string;
    patientId: string;
    patientName: string;
    mrNumber: string | null;
    tokenNumber: string | null;
    doctorId: string | null;
    doctorName: string | null;
    status: string;
    admissionStatus: string | null;
    createdAt: string;
    /** Patient record created within the fetched range → brand-new registration */
    isNewPatient: boolean;
}

export interface ReceptionActivityCall {
    id: string;
    patientId: string;
    patientName: string;
    mrNumber: string | null;
    doctorId: string | null;
    calledAt: string;
    callStatus: string | null;
    patientResponse: string | null;
    /** attended flag on the call, or a queue visit after the call within range */
    visitedAfter: boolean;
}

export interface ReceptionActivityDue {
    patientId: string;
    patientName: string;
    mrNumber: string | null;
    phone: string | null;
    doctorId: string | null;
    doctorName: string | null;
    reviewDate: string;
    reviewStatus: string | null;
    /** the patient showed up for this review (early, on time, or late) */
    came: boolean;
    /** showed up BEFORE the due date (completion or a visit up to 7 days prior) */
    cameEarly: boolean;
    /** showed up AFTER the due date */
    cameLate: boolean;
    /** local date (YYYY-MM-DD) the patient actually attended, when known */
    attendedDate: string | null;
    /** a follow-up call linked to this review was made (last 14 days before due) */
    wasCalled: boolean;
    latestCallStatus: string | null;
    /** the visit that assigned this review date (its source prescription's date) */
    lastVisitAt: string | null;
}

export interface ReceptionActivityData {
    visits: ReceptionActivityVisit[];
    calls: ReceptionActivityCall[];
    dues: ReceptionActivityDue[];
    doctors: { id: string; name: string }[];
}

/** Local-timezone YYYY-MM-DD for a timestamptz ISO string (avoids UTC day drift). */
const toLocalDateOnly = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export async function fetchReceptionActivity(params: {
    hospitalId: string;
    startDate: string; // YYYY-MM-DD inclusive
    endDate: string;   // YYYY-MM-DD inclusive
}): Promise<ReceptionActivityData> {
    const { hospitalId, startDate, endDate } = params;
    if (!hospitalId || !startDate || !endDate) {
        return { visits: [], calls: [], dues: [], doctors: [] };
    }

    const startIso = new Date(`${startDate}T00:00:00`).toISOString();
    const endExclusive = new Date(`${endDate}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endIso = endExclusive.toISOString();

    // Visits are fetched 7 days before the window so a due date early in the
    // week can still see the patient's early visit; week stats stay window-scoped.
    const inferenceStart = new Date(`${startDate}T00:00:00`);
    inferenceStart.setDate(inferenceStart.getDate() - 7);
    const inferenceStartIso = inferenceStart.toISOString();

    // 1) Queue visits in range (paginated; admission_status guarded for older DBs)
    const PAGE = 1000;
    const fetchQueues = async (withAdmission: boolean): Promise<any[]> => {
        const cols = withAdmission
            ? 'id, patient_id, doctor_id, status, admission_status, created_at, token_number'
            : 'id, patient_id, doctor_id, status, created_at, token_number';
        const rows: any[] = [];
        let from = 0;
        while (true) {
            const res = await withTimeout(
                (supabase
                    .from('hospital_queues' as any) as any)
                    .select(cols)
                    .eq('hospital_id', hospitalId)
                    .gte('created_at', inferenceStartIso)
                    .lt('created_at', endIso)
                    .order('created_at', { ascending: true })
                    .range(from, from + PAGE - 1) as any,
                12000,
                'Timed out while loading visit activity'
            ) as SupabaseResult<any[]>;
            if (res.error) throw res.error;
            const batch = res.data || [];
            rows.push(...batch);
            if (batch.length < PAGE) break;
            from += PAGE;
        }
        return rows;
    };

    let queueRows: any[] = [];
    try {
        queueRows = await fetchQueues(true);
    } catch (err: any) {
        if (String(err?.message || '').toLowerCase().includes('admission_status')) {
            queueRows = await fetchQueues(false);
        } else {
            throw err;
        }
    }

    // 2) Reviews due in range (cancelled excluded — admissions/stop-followup cancel reviews)
    let reviewRows: any[] = [];
    const reviewsRes = await withTimeout(
        (supabase
            .from('hospital_patient_reviews' as any) as any)
            .select('id, patient_id, doctor_id, status, next_review_date, completed_at, source_prescription_id')
            .eq('hospital_id', hospitalId)
            .gte('next_review_date', startDate)
            .lte('next_review_date', endDate)
            .neq('status', 'cancelled') as any,
        10000,
        'Timed out while loading due reviews'
    ) as SupabaseResult<any[]>;
    if (reviewsRes.error) {
        const msg = String(reviewsRes.error.message || '').toLowerCase();
        if (!msg.includes('hospital_patient_reviews')) throw reviewsRes.error;
    } else {
        reviewRows = reviewsRes.data || [];
    }

    // 2a) Source prescriptions — the visit that assigned each review date
    // ("last visited"). Fetched by id since it can predate the viewed window.
    const sourceRxDateById = new Map<string, string>();
    const sourceRxIds = Array.from(new Set(
        reviewRows.map((r) => r.source_prescription_id).filter(Boolean)
    )) as string[];
    for (const chunk of chunkArray(sourceRxIds, 100)) {
        if (chunk.length === 0) continue;
        const res = await withTimeout(
            (supabase
                .from('hospital_prescriptions' as any) as any)
                .select('id, created_at')
                .in('id', chunk) as any,
            10000,
            'Timed out while loading review source visits'
        ) as SupabaseResult<any[]>;
        if (res.error) break;
        (res.data || []).forEach((p: any) => sourceRxDateById.set(p.id, p.created_at));
    }

    // 2b) Calls linked to the due cohort's reviews. Calls for a due date can
    // precede the viewed window (e.g. Monday reviews called the previous week),
    // so link by review_id with a 14-day look-back instead of the week window.
    const reviewCallsByReviewId = new Map<string, any[]>();
    if (reviewRows.length > 0) {
        const lookback = new Date(`${startDate}T00:00:00`);
        lookback.setDate(lookback.getDate() - 14);
        const lookbackIso = lookback.toISOString();
        for (const chunk of chunkArray(reviewRows.map((r) => r.id), 100)) {
            if (chunk.length === 0) continue;
            const res = await withTimeout(
                (supabase
                    .from('hospital_patient_followups' as any) as any)
                    .select('review_id, call_status, called_at')
                    .in('review_id', chunk)
                    .gte('called_at', lookbackIso)
                    .order('called_at', { ascending: false }) as any,
                10000,
                'Timed out while loading review call links'
            ) as SupabaseResult<any[]>;
            if (res.error) {
                const msg = String(res.error.message || '').toLowerCase();
                if (!msg.includes('hospital_patient_followups')) throw res.error;
                break;
            }
            for (const row of (res.data || [])) {
                if (!reviewCallsByReviewId.has(row.review_id)) reviewCallsByReviewId.set(row.review_id, []);
                reviewCallsByReviewId.get(row.review_id)!.push(row);
            }
        }
    }

    // 3) Follow-up calls made in range
    let callRows: any[] = [];
    const callsRes = await withTimeout(
        (supabase
            .from('hospital_patient_followups' as any) as any)
            .select('id, patient_id, doctor_id, called_at, call_status, patient_response, attended')
            .eq('hospital_id', hospitalId)
            .gte('called_at', startIso)
            .lt('called_at', endIso)
            .order('called_at', { ascending: false }) as any,
        10000,
        'Timed out while loading call activity'
    ) as SupabaseResult<any[]>;
    if (callsRes.error) {
        const msg = String(callsRes.error.message || '').toLowerCase();
        if (!msg.includes('hospital_patient_followups') && !msg.includes('attended')) throw callsRes.error;
    } else {
        callRows = callsRes.data || [];
    }

    // 4) Patient details (chunked lookup)
    const patientIds = Array.from(new Set([
        ...queueRows.map((r) => r.patient_id),
        ...reviewRows.map((r) => r.patient_id),
        ...callRows.map((r) => r.patient_id),
    ].filter(Boolean))) as string[];

    const patientMap = new Map<string, any>();
    for (const chunk of chunkArray(patientIds, 100)) {
        if (chunk.length === 0) continue;
        const res = await withTimeout(
            (supabase
                .from('hospital_patients' as any) as any)
                .select('id, name, mr_number, phone, created_at')
                .in('id', chunk) as any,
            10000,
            'Timed out while loading patient details'
        ) as SupabaseResult<any[]>;
        if (res.error) throw res.error;
        (res.data || []).forEach((p: any) => patientMap.set(p.id, p));
    }

    // 5) Doctors (small)
    const doctorsRes = await withTimeout(
        (supabase
            .from('hospital_doctors' as any) as any)
            .select('id, name')
            .eq('hospital_id', hospitalId) as any,
        8000,
        'Timed out while loading doctors'
    ) as SupabaseResult<any[]>;
    const doctors = (doctorsRes.error ? [] : (doctorsRes.data || []))
        .map((d: any) => ({ id: d.id as string, name: (d.name || '') as string }));
    const doctorNameById = new Map(doctors.map((d) => [d.id, d.name]));

    // 6) Assemble
    const visitsByPatient = new Map<string, any[]>();
    for (const q of queueRows) {
        if (!q.patient_id) continue;
        if (!visitsByPatient.has(q.patient_id)) visitsByPatient.set(q.patient_id, []);
        visitsByPatient.get(q.patient_id)!.push(q);
    }

    const rangeStartTime = new Date(startIso).getTime();

    // Rows before the window exist only for early-visit inference — the
    // returned visit stats stay scoped to the requested range.
    const windowQueueRows = queueRows.filter((q) => new Date(q.created_at).getTime() >= rangeStartTime);

    const visits: ReceptionActivityVisit[] = windowQueueRows.map((q) => {
        const p = patientMap.get(q.patient_id) || {};
        const registeredAt = p.created_at ? new Date(p.created_at).getTime() : 0;
        return {
            queueId: q.id,
            patientId: q.patient_id,
            patientName: p.name || 'Unknown',
            mrNumber: p.mr_number || null,
            tokenNumber: q.token_number || null,
            doctorId: q.doctor_id || null,
            doctorName: q.doctor_id ? (doctorNameById.get(q.doctor_id) || null) : null,
            status: q.status || 'pending',
            admissionStatus: q.admission_status || null,
            createdAt: q.created_at,
            isNewPatient: registeredAt >= rangeStartTime,
        };
    });

    const calls: ReceptionActivityCall[] = callRows.map((c) => {
        const p = patientMap.get(c.patient_id) || {};
        const calledAtTime = new Date(c.called_at).getTime();
        const visitedAfter = c.attended === true || (visitsByPatient.get(c.patient_id) || [])
            .some((q) => new Date(q.created_at).getTime() > calledAtTime);
        return {
            id: c.id,
            patientId: c.patient_id,
            patientName: p.name || 'Unknown',
            mrNumber: p.mr_number || null,
            doctorId: c.doctor_id || null,
            calledAt: c.called_at,
            callStatus: c.call_status || null,
            patientResponse: c.patient_response || null,
            visitedAfter,
        };
    });

    // callRows are ordered newest-first, so the first status seen per patient is the latest
    const latestCallStatusByPatient = new Map<string, string | null>();
    for (const c of callRows) {
        if (!latestCallStatusByPatient.has(c.patient_id)) {
            latestCallStatusByPatient.set(c.patient_id, c.call_status || null);
        }
    }

    const shiftDateStr = (dateStr: string, days: number): string => {
        const d = new Date(`${dateStr}T00:00:00`);
        d.setDate(d.getDate() + days);
        const padN = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${padN(d.getMonth() + 1)}-${padN(d.getDate())}`;
    };

    const dues: ReceptionActivityDue[] = reviewRows.map((r) => {
        const p = patientMap.get(r.patient_id) || {};
        const reviewDate = normalizeDateOnly(r.next_review_date) || '';
        const completedDate = toLocalDateOnly(r.completed_at);

        const visitDates = (visitsByPatient.get(r.patient_id) || [])
            .map((q) => toLocalDateOnly(q.created_at) || '')
            .filter(Boolean)
            .sort();
        const onOrAfterDate = visitDates.find((d) => d >= reviewDate) || null;
        // Early-visit inference: any visit up to 7 days before the due date
        const earlyWindowStart = shiftDateStr(reviewDate, -7);
        const earlyVisitDate = [...visitDates].reverse().find((d) => d < reviewDate && d >= earlyWindowStart) || null;

        // Attendance date: completion timestamp wins; else visit on/after due; else the early visit
        const attendedDate = (r.status === 'completed' ? completedDate : null) || onOrAfterDate || earlyVisitDate;
        const came = r.status === 'completed' || Boolean(attendedDate);
        const cameEarly = Boolean(attendedDate && attendedDate < reviewDate);
        const cameLate = Boolean(attendedDate && attendedDate > reviewDate);

        const reviewCalls = reviewCallsByReviewId.get(r.id) || [];
        const wasCalled = reviewCalls.length > 0;
        const lastVisitAt = r.source_prescription_id
            ? (sourceRxDateById.get(r.source_prescription_id) || null)
            : null;

        return {
            patientId: r.patient_id,
            patientName: p.name || 'Unknown',
            mrNumber: p.mr_number || null,
            phone: p.phone || null,
            doctorId: r.doctor_id || null,
            doctorName: r.doctor_id ? (doctorNameById.get(r.doctor_id) || null) : null,
            reviewDate,
            reviewStatus: r.status || null,
            came,
            cameEarly,
            cameLate,
            attendedDate,
            wasCalled,
            latestCallStatus: reviewCalls[0]?.call_status || latestCallStatusByPatient.get(r.patient_id) || null,
            lastVisitAt,
        };
    });

    return { visits, calls, dues, doctors };
}

import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

export type ReceptionReviewFilter = 'all' | 'due_today' | 'due_tomorrow' | 'upcoming' | 'overdue' | 'followup_needed' | 'not_completed' | 'review_completed';

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
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
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
    latestFollowupStatus: string | null
): ReceptionReviewFilter => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (latestFollowupStatus === 'not_picked') {
        return 'followup_needed';
    }

    if (latestReviewStatus === 'completed') {
        const completionReference = latestReviewCompletedAt || latestReviewCreatedAt || latestReviewUpdatedAt;
        if (completionReference) {
            const completedAt = startOfDay(completionReference);
            const ageDays = Math.floor((today.getTime() - completedAt.getTime()) / (24 * 60 * 60 * 1000));
            if (ageDays >= 0 && ageDays < 2) {
                return 'review_completed';
            }
        }
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
    followupsByDoctor: Map<string, string | null>
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
        if (primaryReview) {
            const doctorInfo = doctorId ? doctorNamesMap.get(doctorId) : null;
            const reviewDate = normalizeDateOnly(primaryReview.next_review_date || null);
            const latestFollowupStatus = doctorId ? followupsByDoctor.get(doctorId) || null : null;

            const reviewCategory = deriveReviewCategory(
                reviewDate,
                primaryReview.status || null,
                primaryReview.completed_at || null,
                primaryReview.updated_at || null,
                primaryReview.created_at || null,
                latestFollowupStatus
            );

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

    const buildPatientsQuery = (includeDeceasedFields: boolean): any => {
        const selectClause = includeDeceasedFields
            ? 'id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, app_access_enabled, is_deceased, deceased_at, continuity_status, followup_stopped_at, followup_stop_reason, created_at'
            : 'id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, app_access_enabled, created_at';

        let query: any = (supabase
            .from('hospital_patients') as any)
            .select(selectClause, { count: 'exact' })
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false });

        if (!needsDerivedFiltering) {
            query = query.range(from, to);
        }

        const trimmedSearch = searchQuery.trim();
        if (trimmedSearch) {
            const escaped = escapeForIlike(trimmedSearch);
            query = query.or(`name.ilike.%${escaped}%,mr_number.ilike.%${escaped}%`);
        }

        return query;
    };

    let patientsResult = await withTimeout(
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
            patientsResult = await withTimeout(
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
                    .select('id, patient_id, doctor_id, status, next_review_date, source_prescription_id, completed_at, created_at, updated_at')
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
    const latestFollowupStatusByDoctorPerPatient = new Map<string, Map<string | null, string | null>>();
    const followupsByPatient = new Map<string, ReceptionCallHistoryEntry[]>();
    
    for (const followup of followups) {
        // Latest followup status per patient (backward compatibility)
        if (!latestFollowupStatusByPatient.has(followup.patient_id)) {
            latestFollowupStatusByPatient.set(followup.patient_id, followup.call_status || null);
        }

        // Latest followup status per doctor per patient (multi-doctor support)
        if (!latestFollowupStatusByDoctorPerPatient.has(followup.patient_id)) {
            latestFollowupStatusByDoctorPerPatient.set(followup.patient_id, new Map());
        }
        const doctorMap = latestFollowupStatusByDoctorPerPatient.get(followup.patient_id)!;
        const doctorId = followup.doctor_id || null;
        if (!doctorMap.has(doctorId)) {
            doctorMap.set(doctorId, followup.call_status || null);
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
            const doctorReviews = (isDeceased || isFollowupStopped)
                ? []
                : groupReviewsByDoctor(reviewsByPatient.get(p.id) || [], doctorNamesMap, followupsByDoctorMap);

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
                    latestFollowupStatusByPatient.get(p.id) || null
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
                lastVisitAt: latestPrescription?.created_at || p.created_at || null,
                prescriptions: visitHistory,
                callHistory: (followupsByPatient.get(p.id) || []).slice(0, 3),
                doctorReviews,
            } as ReceptionPastRecordPatient;
        })
        .filter((patient) => {
            if (reviewFilter !== 'all' && patient.reviewCategory !== reviewFilter) {
                return false;
            }

            if (reviewDate && patient.latestReviewDate !== reviewDate) {
                return false;
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

    const activeReviewResult = await withTimeout(
        (supabase
            .from('hospital_patient_reviews' as any)
            .select('id')
            .eq('hospital_id', hospitalId)
            .eq('patient_id', patientId)
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
            .select('id, next_review_date, status')
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
        .select('id, patient_id, doctor_id, queue_number, admission_status, admitted_at, discharged_at, preparing_by')
        .eq('hospital_id', hospitalId)
        .eq('admission_status', 'admitted')
        .order('admitted_at', { ascending: false, nullsFirst: false });

    if (doctorId) {
        query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);
    }

    const queueResult = await withTimeout(query as any, 10000, 'Timed out loading admitted patients') as SupabaseResult<any[]>;
    if (queueResult.error) throw queueResult.error;

    const queueRows = Array.isArray(queueResult.data) ? queueResult.data : [];
    if (queueRows.length === 0) return [];

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
        const doctorName = dr.doctorName || 'Unknown';
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

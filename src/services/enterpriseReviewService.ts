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

export interface ReceptionPastRecordPatient {
    id: string;
    name: string;
    age: number;
    gender?: string | null;
    phone?: string | null;
    mr_number?: string | null;
    beanhealth_id?: string | null;
    father_husband_name?: string | null;
    created_at?: string;
    latestReviewDate: string | null;
    reviewCategory: ReceptionReviewFilter;
    lastVisitAt: string | null;
    prescriptions: ReceptionVisitRecord[];
    callHistory: ReceptionCallHistoryEntry[];
}

export interface ReceptionPastRecordsResult {
    patients: ReceptionPastRecordPatient[];
    totalCount: number;
    hasMore: boolean;
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
    status?: string | null;
    next_review_date?: string | null;
    completed_at?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

type FollowupRow = {
    id: string;
    patient_id: string;
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

    let patientsQuery: any = (supabase
        .from('hospital_patients') as any)
        .select(
            'id, name, age, gender, phone, mr_number, beanhealth_id, father_husband_name, created_at',
            { count: 'exact' }
        )
        .eq('hospital_id', hospitalId)
        .order('created_at', { ascending: false });

    if (!needsDerivedFiltering) {
        patientsQuery = patientsQuery.range(from, to);
    }

    const trimmedSearch = searchQuery.trim();
    if (trimmedSearch) {
        const escaped = escapeForIlike(trimmedSearch);
        patientsQuery = patientsQuery.or(`name.ilike.%${escaped}%,mr_number.ilike.%${escaped}%`);
    }

    const patientsResult = await withTimeout(
        patientsQuery,
        10000,
        'Timed out while loading patient records'
    ) as SupabaseResult<any[]>;

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
                    .select('id, patient_id, status, next_review_date, source_prescription_id, completed_at, created_at, updated_at')
                    .eq('hospital_id', hospitalId)
                    .in('patient_id', idChunk)
                    .order('updated_at', { ascending: false })) as any,
                10000,
                'Timed out while loading review status'
            ),
            withTimeout(
                (supabase
                    .from('hospital_patient_followups' as any)
                    .select('id, patient_id, call_status, called_at, patient_response')
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
    const followupsByPatient = new Map<string, ReceptionCallHistoryEntry[]>();
    for (const followup of followups) {
        if (!latestFollowupStatusByPatient.has(followup.patient_id)) {
            latestFollowupStatusByPatient.set(followup.patient_id, followup.call_status || null);
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

    const normalized: ReceptionPastRecordPatient[] = basePatients
        .map((p) => {
            const visitHistory = prescriptionsByPatient.get(p.id) || [];
            const latestPrescription = visitHistory[0] || null;
            const latestReview = pickPrimaryReview(reviewsByPatient.get(p.id) || []);

            // Review rows are the operational source of truth (call logs/reschedules/completions);
            // prescription date is used as a fallback when no review row exists.
            const reviewDateFromReview = normalizeDateOnly(latestReview?.next_review_date || null);
            const fallbackReviewDate = normalizeDateOnly(latestPrescription?.next_review_date || null);
            const latestReviewDate = reviewDateFromReview || fallbackReviewDate;

            const reviewCategory = deriveReviewCategory(
                latestReviewDate,
                latestReview?.status || null,
                latestReview?.completed_at || null,
                latestReview?.updated_at || null,
                latestReview?.created_at || null,
                latestFollowupStatusByPatient.get(p.id) || null
            );

            return {
                ...p,
                latestReviewDate,
                reviewCategory,
                lastVisitAt: latestPrescription?.created_at || p.created_at || null,
                prescriptions: visitHistory,
                callHistory: (followupsByPatient.get(p.id) || []).slice(0, 3),
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

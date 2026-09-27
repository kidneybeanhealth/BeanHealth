/**
 * feedbackService — patient feedback, in and out
 *
 * Two halves that never meet:
 *
 *   IN   the public form, with no session at all, through two SECURITY DEFINER
 *        RPCs. The table has no anon grant, so these are the only door.
 *   OUT  the doctor dashboard, signed in as the hospital, reading the table
 *        directly under RLS.
 *
 * Aggregation happens here in JavaScript rather than in SQL. Ratings are JSONB
 * keyed by question id so the survey can change without a migration, and the
 * volume is a few hundred responses a month — the same call the dialysis
 * register already makes, for the same reason.
 */
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';
import { ALL_QUESTIONS, NEEDS_ATTENTION_AT, type VisitTypeId } from '../components/feedback/feedbackQuestions';

// ─────────────────────────────────────────────────────────────────────────────
// IN — the public form
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedLocation {
    locationId: string;
    locationLabel: string;
    area: string;
    hospitalName: string;
    hospitalLogo: string | null;
}

export class FeedbackCodeError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FeedbackCodeError';
    }
}

/** Turn a poster code into something the form can put a name on. */
export async function resolveFeedbackLocation(code: string): Promise<ResolvedLocation> {
    const res = await withTimeout(
        (supabase as any).rpc('feedback_resolve_location', { p_code: (code || '').trim() }) as any,
        10000,
        'Timed out while opening the feedback form'
    ) as { data: any; error: any };

    if (res.error) throw res.error;
    const d = res.data || {};
    if (!d.found) throw new FeedbackCodeError('This code does not match any hospital');
    if (!d.active) throw new FeedbackCodeError('This feedback form has been closed');

    return {
        locationId: d.location_id,
        locationLabel: d.location_label || '',
        area: d.area || 'hospital',
        hospitalName: d.hospital_name || 'Hospital',
        hospitalLogo: d.hospital_logo || null,
    };
}

export interface FeedbackSubmission {
    code: string;
    visitType: VisitTypeId | null;
    ratings: Record<string, number>;
    comment: string;
    mrNumber: string;
    shareWithDoctor: boolean;
    language: string;
}

const DEVICE_KEY_STORAGE = 'bh_feedback_device';

/**
 * A random id per browser, used only to stop one phone submitting fifty times.
 *
 * It never leaves this function in the clear: the server hashes it with the
 * location and the date, and stores only the hash. If storage is unavailable —
 * a private window, a locked-down browser — the throttle is skipped rather than
 * the submission refused. Somebody in a dialysis chair does not get a second go
 * at this, so a failed throttle must not cost them their answer.
 */
function deviceKey(): string {
    try {
        let k = localStorage.getItem(DEVICE_KEY_STORAGE);
        if (!k) {
            k = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`);
            localStorage.setItem(DEVICE_KEY_STORAGE, k);
        }
        return k;
    } catch {
        return '';
    }
}

export interface SubmitResult {
    /** True when this browser already answered today. Thanked, not scolded. */
    duplicate: boolean;
    identified: boolean;
}

export async function submitFeedback(s: FeedbackSubmission): Promise<SubmitResult> {
    const res = await withTimeout(
        (supabase as any).rpc('submit_hospital_feedback', {
            p_code: (s.code || '').trim(),
            p_visit_type: s.visitType,
            p_ratings: s.ratings,
            p_comment: (s.comment || '').trim() || null,
            p_mr_number: s.shareWithDoctor ? (s.mrNumber || '').trim() || null : null,
            p_share_with_doctor: !!s.shareWithDoctor,
            p_language: s.language || 'en',
            p_device_key: deviceKey(),
        }) as any,
        15000,
        'Timed out while sending your feedback'
    ) as { data: any; error: any };

    if (res.error) throw res.error;
    const d = res.data || {};
    if (!d.ok) {
        if (d.reason === 'unknown_code') throw new FeedbackCodeError('This code does not match any hospital');
        if (d.reason === 'empty') throw new Error('Please rate at least one thing, or write a comment');
        throw new Error('Could not send your feedback');
    }
    return { duplicate: !!d.duplicate, identified: !!d.identified };
}

// ─────────────────────────────────────────────────────────────────────────────
// OUT — the doctor dashboard
// ─────────────────────────────────────────────────────────────────────────────

export interface FeedbackResponse {
    id: string;
    submittedAt: string;
    visitType: string | null;
    ratings: Record<string, number>;
    comment: string | null;
    locationLabel: string | null;
    /** Null for an anonymous response, which is most of them. */
    patientId: string | null;
    patientName: string | null;
    mrNumber: string | null;
    doctorId: string | null;
    status: string;
    acknowledgedAt: string | null;
    actionNote: string | null;
    /** The lowest score given, or null if they only left a comment. */
    lowestRating: number | null;
}

export interface QuestionAverage {
    id: string;
    label: string;
    average: number;
    count: number;
}

export interface FeedbackRegister {
    responses: FeedbackResponse[];
    total: number;
    /** Responses carrying at least one rating at or below NEEDS_ATTENTION_AT. */
    needsAttention: FeedbackResponse[];
    overall: number | null;
    byQuestion: QuestionAverage[];
    byVisitType: { id: string; label: string; count: number; average: number | null }[];
    byLocation: { id: string; label: string; count: number; average: number | null }[];
}

const mean = (xs: number[]): number | null =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;

/** Every rating in one response, for "how did this visit go" as a single number. */
const responseScores = (r: FeedbackResponse): number[] =>
    Object.values(r.ratings || {}).filter(v => typeof v === 'number' && v >= 1 && v <= 5);

export interface FeedbackQuery {
    hospitalId: string;
    from: string;
    to: string;
    /** When set, the Responses list narrows to this doctor's own patients. */
    doctorId?: string | null;
    limit?: number;
}

/**
 * Read a period's feedback and roll it up.
 *
 * `doctorId` narrows the identified responses only. The averages stay
 * hospital-wide on purpose: a doctor comparing their own ward against the
 * hospital is the useful frame, and an average over the two or three named
 * responses a doctor happens to have is noise dressed up as a metric.
 */
export async function fetchFeedbackRegister(q: FeedbackQuery): Promise<FeedbackRegister> {
    const empty: FeedbackRegister = {
        responses: [], total: 0, needsAttention: [], overall: null,
        byQuestion: [], byVisitType: [], byLocation: [],
    };
    if (!q.hospitalId) return empty;

    const res = await withTimeout(
        (supabase
            .from('hospital_feedback' as any)
            .select(`
                id, submitted_at, visit_type, ratings, comment, patient_id, doctor_id,
                shared_with_doctor, status, acknowledged_at, action_note, location_id,
                hospital_feedback_locations ( id, label ),
                hospital_patients ( id, name, mr_number )
            `)
            .eq('hospital_id', q.hospitalId)
            .gte('submitted_at', q.from)
            .lte('submitted_at', q.to)
            .order('submitted_at', { ascending: false })
            .limit(q.limit ?? 1000)) as any,
        15000,
        'Timed out while loading feedback'
    ) as { data: any[] | null; error: any };

    if (res.error) throw res.error;

    const rows: FeedbackResponse[] = (res.data || []).map((r: any) => {
        const ratings: Record<string, number> = (r.ratings && typeof r.ratings === 'object') ? r.ratings : {};
        const scores = Object.values(ratings).filter(v => typeof v === 'number') as number[];
        // A patient row only comes back when they identified themselves AND
        // ticked the box; anything else stays anonymous on every surface.
        const identified = !!r.patient_id && r.shared_with_doctor === true;
        return {
            id: r.id,
            submittedAt: r.submitted_at,
            visitType: r.visit_type ?? null,
            ratings,
            comment: r.comment ?? null,
            locationLabel: r.hospital_feedback_locations?.label ?? null,
            patientId: identified ? r.patient_id : null,
            patientName: identified ? (r.hospital_patients?.name ?? null) : null,
            mrNumber: identified ? (r.hospital_patients?.mr_number ?? null) : null,
            doctorId: identified ? (r.doctor_id ?? null) : null,
            status: r.status || 'new',
            acknowledgedAt: r.acknowledged_at ?? null,
            actionNote: r.action_note ?? null,
            lowestRating: scores.length ? Math.min(...scores) : null,
        };
    });

    // Aggregates always cover the whole hospital; only the list is scoped.
    const byQuestion: QuestionAverage[] = ALL_QUESTIONS
        .map(qq => {
            const vals = rows.map(r => r.ratings[qq.id]).filter(v => typeof v === 'number') as number[];
            return { id: qq.id, label: qq.label, average: mean(vals) ?? 0, count: vals.length };
        })
        .filter(a => a.count > 0);

    const group = <T extends { key: string; label: string }>(keyOf: (r: FeedbackResponse) => T | null) => {
        const acc = new Map<string, { label: string; scores: number[]; count: number }>();
        for (const r of rows) {
            const k = keyOf(r);
            if (!k) continue;
            const cur = acc.get(k.key) || { label: k.label, scores: [], count: 0 };
            cur.count += 1;
            cur.scores.push(...responseScores(r));
            acc.set(k.key, cur);
        }
        return [...acc.entries()]
            .map(([id, v]) => ({ id, label: v.label, count: v.count, average: mean(v.scores) }))
            .sort((a, b) => b.count - a.count);
    };

    const visible = q.doctorId ? rows.filter(r => r.doctorId === q.doctorId) : rows;

    return {
        responses: visible,
        total: rows.length,
        needsAttention: visible.filter(r => r.lowestRating !== null && r.lowestRating <= NEEDS_ATTENTION_AT && r.status === 'new'),
        overall: mean(rows.flatMap(responseScores)),
        byQuestion,
        byVisitType: group(r => (r.visitType ? { key: r.visitType, label: r.visitType } as any : null)),
        byLocation: group(r => (r.locationLabel ? { key: r.locationLabel, label: r.locationLabel } as any : null)),
    };
}

/** Mark a response as seen, so the attention strip empties as it is worked. */
export async function acknowledgeFeedback(hospitalId: string, id: string, note: string): Promise<void> {
    const res = await withTimeout(
        ((supabase.from('hospital_feedback') as any)
            .update({
                status: 'acknowledged',
                acknowledged_at: new Date().toISOString(),
                action_note: (note || '').trim() || null,
            })
            .eq('hospital_id', hospitalId)
            .eq('id', id)) as any,
        10000,
        'Timed out while saving'
    ) as { error: any };
    if (res.error) throw res.error;
}

export interface FeedbackLocation {
    id: string;
    code: string;
    label: string;
    area: string;
    isActive: boolean;
}

/** The posters this hospital has. One today; more when they split by station. */
export async function fetchFeedbackLocations(hospitalId: string): Promise<FeedbackLocation[]> {
    if (!hospitalId) return [];
    const res = await withTimeout(
        (supabase
            .from('hospital_feedback_locations' as any)
            .select('id, code, label, area, is_active')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: true })) as any,
        10000,
        'Timed out while loading feedback posters'
    ) as { data: any[] | null; error: any };
    if (res.error) throw res.error;
    return (res.data || []).map((r: any) => ({
        id: r.id, code: r.code, label: r.label, area: r.area, isActive: r.is_active !== false,
    }));
}

/**
 * The hospital's logo for the poster header.
 *
 * `hospital_logo` is what the patient app reads, but it is empty at KKC; the
 * logo reception and the doctors actually print on the Past Records sheet lives
 * in `avatar_url`. Selecting `*` rather than naming both, because hospital_logo
 * was added to this table outside the migration files and naming a column a
 * site does not have fails the whole read.
 */
export async function fetchHospitalLogo(hospitalId: string): Promise<string | null> {
    if (!hospitalId) return null;
    try {
        const res = await withTimeout(
            ((supabase as any).from('hospital_profiles').select('*').eq('id', hospitalId).maybeSingle()) as any,
            10000,
            'Timed out while loading the hospital logo'
        ) as { data: any; error: any };
        if (res.error || !res.data) return null;
        return res.data.hospital_logo || res.data.avatar_url || null;
    } catch {
        return null;
    }
}

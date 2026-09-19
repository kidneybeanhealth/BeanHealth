/**
 * dialysisRegisterService — the dialysis attendance register
 * ──────────────────────────────────────────────────────────
 *
 * Dialysis patients never enter the OP queue. The doctor sends a standalone
 * prescription per session, stamped `metadata.visitType = 'dialysis'` by
 * `handleSendDialysisToPharmacy`, with `queue_id` and `token_number` null. That
 * marker has been written since the feature shipped, so this register reads real
 * history with no migration and no backfill.
 *
 * Why this lives outside `enterpriseReviewService`:
 *
 *   Past Records answers "which bucket is this patient in", and its candidate
 *   resolution is load-bearing and has regressed twice. This answers a different
 *   question — "who attended dialysis, and how often" — which is a visit-type
 *   lens, not a review bucket. Folding it into `deriveReviewCategory` would put a
 *   visit type on an axis that only holds review status, and the multi-doctor
 *   bucket matching would have to special-case it forever.
 *
 * A cancelled session still counts. `supersedePreviousPharmacyDocs` cancels any
 * OTHER pending prescription for the same patient and doctor, so when Monday's
 * dialysis Rx has not been dispensed by the time Wednesday's is sent, Monday is
 * marked cancelled — the patient still attended on Monday. Cancellation here is a
 * pharmacy-document lifecycle state, not a statement that the session did not
 * happen. Filtering those out would silently undercount the register, so every
 * row is counted and the status is surfaced per session instead.
 */
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

const PAGE = 1000;
const PATIENT_CHUNK = 100;

const pad = (n: number) => String(n).padStart(2, '0');
/** Local (clinic) calendar day for an ISO timestamp — matches ReceptionActivityPanels. */
export const localDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface DialysisSession {
    id: string;
    patientId: string;
    createdAt: string;
    /** Clinic-local calendar day, so two sessions on one day are visible as such. */
    dateKey: string;
    status: string | null;
    doctorId: string | null;
    doctorName: string | null;
}

export interface DialysisPatientRow {
    id: string;
    name: string;
    mrNumber: string | null;
    age: number | string | null;
    gender: string | null;
    phone: string | null;
    fatherHusbandName: string | null;
    isDeceased: boolean;
    /** Sessions inside the selected period, newest first. */
    sessions: DialysisSession[];
    sessionCount: number;
    /** Distinct clinic-local days attended inside the period. */
    dayCount: number;
    firstSessionAt: string | null;
    lastSessionAt: string | null;
}

export interface DialysisRegister {
    patients: DialysisPatientRow[];
    totalSessions: number;
    totalPatients: number;
    /** Distinct patient-days — the honest "attendances" figure when a patient is prescribed twice in a day. */
    totalDays: number;
}

export interface FetchDialysisRegisterParams {
    hospitalId: string;
    /** Inclusive clinic-local start day, YYYY-MM-DD. Omit for all time. */
    from?: string;
    /** Inclusive clinic-local end day, YYYY-MM-DD. Omit for all time. */
    to?: string;
}

interface SupabaseResult<T> { data: T | null; error: any; count?: number | null }

const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
};

/**
 * Every dialysis prescription in range, with the patient and doctor resolved.
 *
 * Three reads: the marked prescriptions, then the patients they name, then the
 * doctors. Patients are chunked so the IN() list never oversizes the REST URL —
 * the same bound Past Records needs.
 */
export async function fetchDialysisRegister(
    params: FetchDialysisRegisterParams
): Promise<DialysisRegister> {
    const { hospitalId, from, to } = params;
    const empty: DialysisRegister = { patients: [], totalSessions: 0, totalPatients: 0, totalDays: 0 };
    if (!hospitalId) return empty;

    // ── 1. the sessions ──────────────────────────────────────────────────
    const rows: any[] = [];
    let offset = 0;
    for (;;) {
        let q = (supabase.from('hospital_prescriptions' as any) as any)
            .select('id, patient_id, created_at, status, doctor_id')
            .eq('hospital_id', hospitalId)
            .eq('metadata->>visitType', 'dialysis')
            .order('created_at', { ascending: false })
            .range(offset, offset + PAGE - 1);

        // Local day bounds converted to instants: a session logged at 21:00 IST
        // belongs to that clinic day, not to the next UTC one.
        if (from) q = q.gte('created_at', new Date(`${from}T00:00:00`).toISOString());
        if (to) q = q.lte('created_at', new Date(`${to}T23:59:59.999`).toISOString());

        const res = await withTimeout(
            q as any, 15000, 'Timed out while loading the dialysis register'
        ) as SupabaseResult<any[]>;
        if (res.error) throw res.error;

        const page = res.data || [];
        rows.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
    }

    if (rows.length === 0) return empty;

    // ── 2. the patients ──────────────────────────────────────────────────
    const patientIds = Array.from(new Set(rows.map(r => r.patient_id).filter(Boolean))) as string[];
    const patientMap = new Map<string, any>();
    for (const ids of chunk(patientIds, PATIENT_CHUNK)) {
        const res = await withTimeout(
            ((supabase.from('hospital_patients') as any)
                .select('id, name, age, gender, phone, mr_number, father_husband_name, is_deceased')
                .eq('hospital_id', hospitalId)
                .in('id', ids)) as any,
            12000,
            'Timed out while loading dialysis patients'
        ) as SupabaseResult<any[]>;

        if (res.error) {
            // `is_deceased` ships with the deceased-patient migration. A hospital
            // without it must still get its register rather than an error screen.
            const msg = String(res.error.message || '').toLowerCase();
            if (!msg.includes('is_deceased')) throw res.error;
            const retry = await withTimeout(
                ((supabase.from('hospital_patients') as any)
                    .select('id, name, age, gender, phone, mr_number, father_husband_name')
                    .eq('hospital_id', hospitalId)
                    .in('id', ids)) as any,
                12000,
                'Timed out while loading dialysis patients'
            ) as SupabaseResult<any[]>;
            if (retry.error) throw retry.error;
            (retry.data || []).forEach((p: any) => patientMap.set(p.id, p));
            continue;
        }
        (res.data || []).forEach((p: any) => patientMap.set(p.id, p));
    }

    // ── 3. the doctors ───────────────────────────────────────────────────
    const doctorIds = Array.from(new Set(rows.map(r => r.doctor_id).filter(Boolean))) as string[];
    const doctorMap = new Map<string, string>();
    if (doctorIds.length > 0) {
        const res = await withTimeout(
            ((supabase.from('hospital_doctors' as any) as any)
                .select('id, name')
                .in('id', doctorIds)) as any,
            10000,
            'Timed out while loading doctors'
        ) as SupabaseResult<any[]>;
        // A missing doctor name is cosmetic; the session still counts.
        if (!res.error) (res.data || []).forEach((d: any) => doctorMap.set(d.id, d.name));
    }

    // ── 4. fold into patient rows ────────────────────────────────────────
    const byPatient = new Map<string, DialysisSession[]>();
    for (const r of rows) {
        if (!r.patient_id) continue;
        const session: DialysisSession = {
            id: r.id,
            patientId: r.patient_id,
            createdAt: r.created_at,
            dateKey: localDateKey(new Date(r.created_at)),
            status: r.status || null,
            doctorId: r.doctor_id || null,
            doctorName: r.doctor_id ? (doctorMap.get(r.doctor_id) || null) : null,
        };
        if (!byPatient.has(r.patient_id)) byPatient.set(r.patient_id, []);
        byPatient.get(r.patient_id)!.push(session);
    }

    let totalDays = 0;
    const patients: DialysisPatientRow[] = [];
    for (const [patientId, sessions] of byPatient) {
        sessions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const p = patientMap.get(patientId);
        // A prescription whose patient row was deleted still happened. Listing it
        // as "Unknown patient" beats dropping a session out of the month's count.
        const dayCount = new Set(sessions.map(s => s.dateKey)).size;
        totalDays += dayCount;
        patients.push({
            id: patientId,
            name: p?.name || 'Unknown patient',
            mrNumber: p?.mr_number || null,
            age: p?.age ?? null,
            gender: p?.gender || null,
            phone: p?.phone || null,
            fatherHusbandName: p?.father_husband_name || null,
            isDeceased: p?.is_deceased === true,
            sessions,
            sessionCount: sessions.length,
            dayCount,
            firstSessionAt: sessions[sessions.length - 1]?.createdAt || null,
            lastSessionAt: sessions[0]?.createdAt || null,
        });
    }

    // Most sessions first: the heaviest users of the unit head the register.
    patients.sort((a, b) => {
        if (b.sessionCount !== a.sessionCount) return b.sessionCount - a.sessionCount;
        return (a.name || '').localeCompare(b.name || '');
    });

    return {
        patients,
        totalSessions: rows.length,
        totalPatients: patients.length,
        totalDays,
    };
}

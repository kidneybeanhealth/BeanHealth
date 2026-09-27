/**
 * Placing calls, and reading back what happened on them.
 *
 * The browser never talks to the voice provider. It asks the
 * `place-review-call` Edge Function, which holds the key server-side, checks
 * the patient belongs to the signed-in centre, refuses deceased / do-not-call /
 * on-hold patients, enforces the daily cap, and reserves an attempt row before
 * dialling. The outcome arrives minutes later on the provider's webhook; the
 * database trigger in 20260927d_connect.sql turns red flags and callback
 * requests into alerts.
 */
import { db, run } from './db';
import { supabase } from '../../lib/supabase';
import { withTimeout } from '../../utils/requestUtils';
import type { CallPurpose } from '../protocol/settings';
import type { EngineAttempt } from '../protocol/engine';

export interface CallAttempt extends EngineAttempt {
    id: string;
    dialedNumber: string | null;
    providerStatus: string | null;
    durationSeconds: number | null;
    completedAt: string | null;
    disposition: string | null;
    summary: string | null;
    spokeTo: string | null;
    callbackRequested: boolean;
    failureReason: string | null;
}

const readVar = (vars: any, k: string): string | null => {
    const v = vars && typeof vars === 'object' ? vars[k] : null;
    return typeof v === 'string' && v.trim() ? v.trim() : null;
};

const toAttempt = (r: any): CallAttempt => {
    const vars = r.final_agent_variables;
    const disposition = readVar(vars, 'disposition')?.toUpperCase() ?? null;
    return {
        id: r.id,
        patientId: r.patient_id,
        // Every call placed before the purpose column existed was a review reminder.
        purpose: (r.purpose as CallPurpose) || 'review',
        createdAt: r.created_at,
        status: r.status,
        // The agent's end-of-call hook only fires on a call that connected, so a
        // disposition is proof of a conversation even when the carrier status
        // never arrived.
        connected: r.provider_status === 'connected' || !!disposition,
        dialedNumber: r.dialed_number ?? null,
        providerStatus: r.provider_status ?? null,
        durationSeconds: r.duration_seconds ?? null,
        completedAt: r.completed_at ?? null,
        disposition,
        summary: readVar(vars, 'reason_text') || readVar(vars, 'call_summary'),
        spokeTo: readVar(vars, 'spoke_to'),
        callbackRequested: (readVar(vars, 'callback_requested') || '').toLowerCase() === 'yes',
        failureReason: r.failure_reason ?? null,
    };
};

const ATTEMPT_COLUMNS = 'id, patient_id, purpose, created_at, status, provider_status, dialed_number, duration_seconds, completed_at, final_agent_variables, failure_reason';

export async function fetchAttemptsSince(centreId: string, sinceIso: string): Promise<CallAttempt[]> {
    const rows = await run<any[]>(
        db.from('hospital_voice_call_attempts').select(ATTEMPT_COLUMNS)
            .eq('hospital_id', centreId).gte('created_at', sinceIso)
            .order('created_at', { ascending: false }).limit(20000),
        'Could not load calls'
    );
    return (rows || []).map(toAttempt);
}

export interface PlaceCallParams {
    patientId: string;
    purpose: CallPurpose;
    language: string;
    requestedByName: string | null;
    /** Spoken detail for a non-review script, e.g. "Wednesday 24 September session". */
    purposeDetail?: string | null;
}

/**
 * Ask the Edge Function to dial. Throws with the function's own message —
 * "No usable phone", "Daily limit reached", "Agent not configured for …" are
 * things a coordinator can act on, and must not collapse into "failed".
 */
export async function placeCall(p: PlaceCallParams): Promise<{ attemptId: string }> {
    const body: Record<string, unknown> = {
        patientId: p.patientId,
        requestedByName: p.requestedByName,
        language: p.language,
    };
    // Sent only for the newer purposes. The review call keeps the exact body the
    // live function has always accepted, so it works whether or not the
    // purpose-aware function has been deployed yet.
    if (p.purpose !== 'review') {
        body.purpose = p.purpose;
        if (p.purposeDetail) body.purposeDetail = p.purposeDetail;
    }
    const { data, error } = await withTimeout(
        supabase.functions.invoke('place-review-call', { body }) as any,
        30000,
        'Timed out while placing the call'
    ) as { data: any; error: any };

    if (error) {
        let detail = '';
        try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === 'function') {
                const parsed = await ctx.json();
                detail = [parsed?.error, parsed?.detail].filter(Boolean).join(' — ');
            }
        } catch { /* fall back to the generic message */ }
        throw new Error(detail || error.message || 'Could not place the call');
    }
    if (data?.error) throw new Error(data.error);
    return { attemptId: data?.attemptRef };
}

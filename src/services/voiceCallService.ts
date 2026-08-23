/**
 * voiceCallService — trigger a Sarvam voice-agent review reminder
 * ───────────────────────────────────────────────────────────────
 * The browser never talks to Sarvam. It asks the `place-review-call` Edge
 * Function, which holds the API key as a server-side secret; a key in client JS
 * could be lifted from devtools and used to place billable calls to any number.
 *
 * This function only *starts* a call. The outcome arrives minutes later on
 * Sarvam's webhook and is written into hospital_patient_followups by the
 * `sarvam-call-webhook` function, so it shows up in Call History exactly like a
 * call a receptionist typed in.
 */
import { supabase } from '../lib/supabase';
import { withTimeout } from '../utils/requestUtils';

/**
 * Is outbound calling switched on for this build?
 *
 * The Edge Function needs a Sarvam API key, a committed agent, and a bought
 * number before a single call can resolve. Shipping the button before all three
 * exist means anyone in Reception can press it and get a failure they cannot act
 * on — so the UI hides it entirely until this is set.
 *
 * Build-time on purpose: flipping it is a rebuild, which is the same moment the
 * secrets get set. A runtime probe would just add a request that fails.
 */
export const voiceCallsEnabled = (): boolean =>
    String(import.meta.env.VITE_VOICE_CALLS_ENABLED ?? '').toLowerCase() === 'true';

export interface PlaceReviewCallParams {
    patientId: string;
    /** Shown in the attempt record. Reception shares a login, so this is the surface name. */
    requestedByName?: string | null;
    /** Agent opening language. Defaults to Tamil, which is most KKC patients. */
    language?: 'Tamil' | 'English';
    /**
     * A number typed for a campaign, for the majority of patients who have none
     * on file. Used for this call only — never written to the patient record,
     * and only its last two digits reach the attempt row.
     */
    phoneOverride?: string | null;
}

export interface PlaceReviewCallResult {
    attemptRef: string;
    sarvamAttemptId: string | null;
    dialedNumber: string;
}

/**
 * Ask the Edge Function to dial this patient.
 *
 * Throws with the server's message on refusal — those refusals are meaningful
 * and belong in front of the user rather than collapsed into "failed":
 *   422  no usable phone number
 *   409  already deceased / follow-up stopped / a call already in flight
 *   502  Sarvam rejected the request (agent not committed, bad connection, ...)
 */
export async function placeReviewCall(
    params: PlaceReviewCallParams
): Promise<PlaceReviewCallResult> {
    const { patientId, requestedByName = null, language = 'Tamil', phoneOverride = null } = params;
    if (!patientId) throw new Error('Missing patient');

    const { data, error } = await withTimeout(
        supabase.functions.invoke('place-review-call', {
            body: { patientId, requestedByName, language, phoneOverride },
        }) as any,
        30000,
        'Timed out while placing the call'
    ) as { data: any; error: any };

    if (error) {
        // supabase-js buries the function's JSON body inside the error context;
        // dig it out so the user sees "No phone number on file" rather than
        // "Edge Function returned a non-2xx status code".
        let detail = '';
        try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === 'function') {
                const parsed = await ctx.json();
                // `detail` carries the upstream provider's own message and `error` is
                // our generic wrapper, so detail wins — otherwise a Sarvam rejection
                // surfaces as "Could not place the call" and the actual reason
                // (bad version, unknown agent, expired key) is thrown away.
                detail = [parsed?.error, parsed?.detail].filter(Boolean).join(' — ');
            }
        } catch { /* fall through to the generic message */ }
        throw new Error(detail || error.message || 'Could not place the call');
    }

    if (data?.error) throw new Error(data.error);

    return {
        attemptRef: data?.attemptRef,
        sarvamAttemptId: data?.sarvamAttemptId ?? null,
        dialedNumber: data?.dialedNumber,
    };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Usage metering
 *
 * The hospital pays BeanHealth; BeanHealth holds a prepaid balance with the
 * voice provider. The two are not linked per transaction — the provider is a
 * supplier cost, not a pass-through — so what has to be exact is the count of
 * what each hospital used, per month, for the invoice.
 *
 * BILLABLE = a call that connected. A call that never reached the patient is
 * not a service delivered, and a hospital charged for unanswered calls stops
 * trusting the number within one billing cycle.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface VoiceUsageMonth {
    /** YYYY-MM */
    key: string;
    label: string;
    placed: number;
    /** Connected — the billable count */
    connected: number;
    notConnected: number;
    failed: number;
    /** Still awaiting an outcome. Deliberately excluded from every other figure. */
    pending: number;
    /**
     * How many connected calls carry a duration.
     *
     * Duration only ever arrives on the provider's own call-ended webhook, which
     * does not fire for this account; the agent's end-of-call hook carries no
     * duration field. So this is usually far below `connected`, and any
     * per-minute total built from it would be a fraction of reality.
     * Surfaced rather than hidden, because it is the reason to bill per call.
     */
    withDuration: number;
    totalSeconds: number;
}

export async function fetchVoiceUsage(hospitalId: string, months = 12): Promise<VoiceUsageMonth[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - (months - 1));
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const { data, error } = await withTimeout(
        (supabase.from('hospital_voice_call_attempts' as any) as any)
            .select('status, sarvam_status, duration_seconds, created_at')
            .eq('hospital_id', hospitalId)
            .gte('created_at', since.toISOString())
            .order('created_at', { ascending: false })
            .limit(20000) as any,
        15000,
        'Timed out while loading call usage'
    ) as { data: any[]; error: any };

    if (error) throw error;

    const byMonth = new Map<string, VoiceUsageMonth>();
    for (const row of data || []) {
        // Bucketed in IST, not UTC. A call placed at 9pm on the 31st belongs to
        // that month on the invoice, and UTC would push it into the next one.
        const key = new Date(row.created_at).toLocaleDateString('en-CA', {
            timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
        }).slice(0, 7);

        if (!byMonth.has(key)) {
            byMonth.set(key, {
                key,
                label: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
                placed: 0, connected: 0, notConnected: 0, failed: 0, pending: 0,
                withDuration: 0, totalSeconds: 0,
            });
        }
        const m = byMonth.get(key)!;

        if (row.status === 'placing' || row.status === 'placed') { m.pending += 1; continue; }

        m.placed += 1;
        if (row.status === 'failed') m.failed += 1;
        else if (row.sarvam_status === 'connected') {
            m.connected += 1;
            if (typeof row.duration_seconds === 'number' && row.duration_seconds > 0) {
                m.withDuration += 1;
                m.totalSeconds += row.duration_seconds;
            }
        } else m.notConnected += 1;
    }

    return Array.from(byMonth.values()).sort((a, b) => b.key.localeCompare(a.key));
}

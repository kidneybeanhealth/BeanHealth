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
    const { patientId, requestedByName = null, language = 'Tamil' } = params;
    if (!patientId) throw new Error('Missing patient');

    const { data, error } = await withTimeout(
        supabase.functions.invoke('place-review-call', {
            body: { patientId, requestedByName, language },
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

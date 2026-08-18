// Supabase Edge Function — receive Sarvam's outbound call outcome
// Deploy with: supabase functions deploy sarvam-call-webhook --no-verify-jwt
//
// --no-verify-jwt is REQUIRED: Sarvam is an external caller with no Supabase
// session. That makes this endpoint publicly reachable, which is why the token
// check below is the only thing standing between a stranger and fabricated
// entries in patient call histories.
//
// AUTHENTICATION
// --------------
// Sarvam's docs describe no request signature or shared webhook secret. So each
// attempt carries its own single-use random token, minted when the call was
// placed and echoed back in the query string and metadata. A payload is honoured
// only when that token matches a row still awaiting an outcome. An attacker
// would have to guess a 128-bit token that stops working the moment it is used.
//
// If Sarvam later adds request signing, verify that here as well and treat the
// token as defence in depth rather than the sole gate.
//
// WHAT IT WRITES
// --------------
// A row in hospital_patient_followups — the same table reception's Call History
// reads, so an agent call and a human call appear on the card side by side.
//
// WHAT IT REFUSES TO WRITE
// ------------------------
// next_review_date. Never. Even when the patient says "I'll come tomorrow".
// A caller that cannot know whether a doctor saw the patient that afternoon must
// not be allowed to move an appointment — that is exactly how KNH/25/028475 lost
// her 13 Aug review to a 14 Jul call log. The transcript is stored so a human can
// read what was said and reschedule deliberately.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/**
 * Sarvam outcome → the call_status values hospital_patient_followups already
 * accepts. Anything unrecognised becomes 'not_reachable' rather than throwing:
 * a status we don't know about must still land on the card, and sarvam_status
 * keeps the original for anyone investigating later.
 */
const mapCallStatus = (sarvamStatus?: string | null): string => {
    switch ((sarvamStatus || '').toLowerCase()) {
        case 'connected': return 'picked'
        case 'no_answer': return 'not_picked'
        case 'busy': return 'busy'
        case 'failed': return 'not_reachable'
        default: return 'not_reachable'
    }
}

/**
 * The agent sets `disposition` as an output variable before every call ends.
 * Three of them are not just notes — they must change the patient record, or the
 * promise made on the call is broken the next time somebody presses dial.
 */
const readDisposition = (vars: unknown): string | null => {
    if (!vars || typeof vars !== 'object') return null
    const raw = (vars as Record<string, unknown>).disposition
    return typeof raw === 'string' && raw.trim() ? raw.trim().toUpperCase() : null
}

const readVar = (vars: unknown, key: string): string | null => {
    if (!vars || typeof vars !== 'object') return null
    const raw = (vars as Record<string, unknown>)[key]
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null
}

/**
 * `callback_requested` is the one output the agent emits in lowercase
 * ('yes' / 'no') while every other enum is uppercase. Compared case-insensitively
 * so a future normalisation on Sarvam's side cannot silently turn every callback
 * request into a no.
 */
const wantsCallback = (vars: unknown): boolean =>
    (readVar(vars, 'callback_requested') || '').toLowerCase() === 'yes'

/** Flatten the transcript into something readable in the Call History card. */
const summariseTranscript = (transcript: unknown): string | null => {
    if (!Array.isArray(transcript) || transcript.length === 0) return null
    const lines = transcript
        .filter((t: any) => t && typeof t.text === 'string' && t.text.trim())
        .map((t: any) => `${t.role === 'agent' ? 'Agent' : 'Patient'}: ${t.text.trim()}`)
    if (lines.length === 0) return null
    const joined = lines.join(' | ')
    return joined.length > 900 ? `${joined.slice(0, 897)}...` : joined
}

serve(async (req) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    try {
        const url = new URL(req.url)
        const payload = await req.json().catch(() => null)
        if (!payload) return json({ error: 'Invalid JSON' }, 400)

        const token = url.searchParams.get('token')
            || payload?.webhook_config?.metadata?.token
            || null
        if (!token) return json({ error: 'Missing token' }, 401)

        const admin = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SERVICE_ROLE_KEY')!,
        )

        // Single-use: only a row still awaiting an outcome is accepted. A replayed
        // payload finds nothing and is rejected, so the same call can never be
        // written into the patient's history twice.
        const { data: attempt, error: attemptError } = await admin
            .from('hospital_voice_call_attempts')
            .select('id, hospital_id, patient_id, doctor_id, review_id, status')
            .eq('webhook_token', token)
            .in('status', ['placing', 'placed'])
            .maybeSingle()

        if (attemptError) throw attemptError
        if (!attempt) {
            // Deliberately vague: don't tell an unauthenticated caller whether a
            // token was wrong, already used, or never existed.
            return json({ error: 'Unrecognised or already-completed attempt' }, 404)
        }

        const sarvamStatus: string | null = payload?.status ?? null
        const callStatus = mapCallStatus(sarvamStatus)
        const transcript = payload?.interaction_transcript ?? null
        const nowIso = new Date().toISOString()

        // 1) Act on the dispositions that change the record
        //
        // Storing these in JSONB and hoping somebody reads it is how a family who
        // told us the patient had died gets called again next month. The agent's
        // own script calls that "the single most important thing to get right".
        const finalVars = payload?.final_agent_variables ?? null
        const disposition = readDisposition(finalVars)
        const reasonText = readVar(finalVars, 'reason_text')

        if (disposition === 'PATIENT_DECEASED') {
            await admin.from('hospital_patients')
                .update({ is_deceased: true, deceased_at: nowIso })
                .eq('id', attempt.patient_id)
                .eq('hospital_id', attempt.hospital_id)
            // Cancel every open review so they leave the due/overdue buckets too.
            await admin.from('hospital_patient_reviews')
                .update({ status: 'cancelled', cancelled_at: nowIso, next_review_date: null, updated_at: nowIso })
                .eq('hospital_id', attempt.hospital_id)
                .eq('patient_id', attempt.patient_id)
                .in('status', ['pending', 'rescheduled'])
        }

        if (disposition === 'DO_NOT_CALL') {
            await admin.from('hospital_patients')
                .update({ do_not_call: true, do_not_call_at: nowIso, do_not_call_source: 'voice_agent' })
                .eq('id', attempt.patient_id)
                .eq('hospital_id', attempt.hospital_id)
        }

        // 2) The record of the attempt itself
        const { error: updateError } = await admin
            .from('hospital_voice_call_attempts')
            .update({
                status: 'completed',
                sarvam_status: sarvamStatus,
                duration_seconds: typeof payload?.duration === 'number' ? payload.duration : null,
                failure_reason: payload?.failure_reason ?? null,
                interaction_id: payload?.interaction_id ?? null,
                transcript,
                final_agent_variables: finalVars,
                completed_at: nowIso,
            })
            .eq('id', attempt.id)
        if (updateError) throw updateError

        // 3) The entry reception actually sees on the card
        const summary = summariseTranscript(transcript)
        // Red flags have to be unmissable in a list reception skims. Everything
        // else reads as a normal call entry with the outcome on the front.
        const prefix = disposition === 'RED_FLAG_REPORTED'
            ? '*** RED FLAG - REVIEW NOW ***'
            : disposition
                ? `[AI call · ${disposition}]`
                : '[AI call]'
        const body = reasonText || summary || sarvamStatus || 'no outcome reported'

        // The rest of the agent's outputs are what make the entry actionable:
        // who actually answered, whether they asked for a human to ring back, and
        // which day suits them. Without these reception reads an outcome and still
        // has to guess what to do next.
        const spokeTo = readVar(finalVars, 'spoke_to')
        const preferredDay = readVar(finalVars, 'preferred_day')
        const tail = [
            spokeTo && spokeTo !== 'UNKNOWN' ? `spoke to ${spokeTo.toLowerCase()}` : null,
            wantsCallback(finalVars)
                ? `CALLBACK REQUESTED${preferredDay ? ` (${preferredDay})` : ''}`
                : (preferredDay ? `prefers ${preferredDay}` : null),
        ].filter(Boolean).join(' · ')

        const responseText = tail ? `${prefix} ${body} · ${tail}` : `${prefix} ${body}`

        const { error: followupError } = await admin
            .from('hospital_patient_followups')
            .insert({
                hospital_id: attempt.hospital_id,
                review_id: attempt.review_id,
                patient_id: attempt.patient_id,
                doctor_id: attempt.doctor_id,
                called_at: nowIso,
                call_status: callStatus,
                patient_response: responseText,
                created_by_name: 'AI Voice Agent',
                // next_review_date is NOT set here, and must never be. See header.
            })
        if (followupError) {
            // The attempt row is already correct, so the outcome isn't lost —
            // surface the failure rather than 200-ing over a half-written result.
            console.error('[sarvam-call-webhook] followup insert failed', followupError)
            return json({ error: 'Outcome stored, but call history write failed' }, 500)
        }

        return json({ ok: true })
    } catch (err) {
        console.error('[sarvam-call-webhook]', err)
        return json({ error: (err as Error).message ?? 'Unexpected error' }, 500)
    }
})

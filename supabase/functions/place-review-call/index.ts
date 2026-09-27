// Supabase Edge Function — place a Sarvam outbound review-reminder call
// Deploy with: supabase functions deploy place-review-call
//
// WHY THIS IS SERVER-SIDE
// -----------------------
// BeanHealth is a Vite SPA: every VITE_* value is bundled into client JS. The
// Sarvam key can place billable calls to arbitrary numbers, so it cannot go
// anywhere near the browser. This function holds it as a Supabase secret and is
// the only thing that ever talks to Sarvam.
//
// WHAT IT DELIBERATELY DOES NOT DO
// --------------------------------
// It never touches next_review_date. A voice agent has no idea whether a doctor
// saw the patient an hour ago, and an automated writer moving appointments is
// the same failure that lost KNH/25/028475 her 13 Aug review — at scale and
// without a human in the loop. Calls record outcomes; humans move appointments.
//
// Required secrets (supabase secrets set ...):
//   SARVAM_API_KEY              generated in the Sarvam console
//   SARVAM_ORG_ID               019e90c9-a385-71c1-8c7b-9af8e9f40a1e
//   SARVAM_WORKSPACE_ID         019e90c9-a3b9-7b89-83a9-603d4e05449b
//   SARVAM_APP_ID               Conversatio-aaae688f-7e96
//   SARVAM_APP_VERSION          "1" once the agent is committed; omit to track latest
//   SARVAM_CONNECTION_ID        b839c927-ef-d640a95a-d734
//   SARVAM_AGENT_PHONE_NUMBER   +918071581310   (paired with the connection above)
//   SARVAM_WEBHOOK_BASE_URL     https://<project>.functions.supabase.co/sarvam-call-webhook
//   SARVAM_FRONT_DESK_NUMBER    REQUIRED. The agent reads this out digit by digit
//                               when a patient reports a red-flag symptom. Without
//                               it a caller reporting chest pain gets silence, so
//                               this function refuses to dial when it is unset.
//   SARVAM_HOSPITAL_ADDRESS     spoken aloud, e.g. "Kongunad Kidney Centre, Coimbatore"
//   SERVICE_ROLE_KEY            standard Supabase service role

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getProvider } from './providers/index.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

/** Indian mobile → E.164. Mirrors normalize_indian_mobile() and phoneUtils.ts. */
const toE164 = (raw?: string | null): string | null => {
    if (!raw) return null
    const d = String(raw).replace(/\D/g, '')
    if (/^[6-9]\d{9}$/.test(d)) return `+91${d}`
    if (/^0[6-9]\d{9}$/.test(d)) return `+91${d.slice(1)}`
    if (/^91[6-9]\d{9}$/.test(d)) return `+91${d.slice(2)}`
    if (/^091[6-9]\d{9}$/.test(d)) return `+91${d.slice(3)}`
    return null
}

const formatReviewDate = (value?: string | null): string => {
    if (!value) return ''
    try {
        return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
            day: 'numeric', month: 'long', year: 'numeric',
        })
    } catch { return value }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
        const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!

        // ── Caller must be the signed-in hospital ────────────────────────────
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) return json({ error: 'Missing authorization header' }, 401)

        const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
        })
        const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser()
        if (authError || !caller) return json({ error: 'Unauthorized' }, 401)

        const body = await req.json().catch(() => ({}))
        const patientId: string | undefined = body?.patientId
        const requestedByName: string | null = body?.requestedByName ?? null
        const requestedLanguage: string | null = typeof body?.language === 'string' && body.language.trim() ? body.language.trim() : null
        if (!patientId) return json({ error: 'patientId is required' }, 400)

        const admin = createClient(supabaseUrl, serviceRoleKey)

        // ── Resolve the patient, scoped to the caller's hospital ─────────────
        // .eq('hospital_id', caller.id) is the tenancy boundary: without it a
        // signed-in hospital could dial another clinic's patient by guessing an id.
        const { data: patient, error: patientError } = await admin
            .from('hospital_patients')
            .select('id, hospital_id, name, phone, phone_e164, mr_number, is_deceased, continuity_status, do_not_call, call_hold, call_hold_reason, attender_phone, attender_phone_e164')
            .eq('id', patientId)
            .eq('hospital_id', caller.id)
            .maybeSingle()

        if (patientError) throw patientError
        if (!patient) return json({ error: 'Patient not found for this hospital' }, 404)

        // ── Refuse the calls that should never be placed ─────────────────────
        if (patient.is_deceased) {
            return json({ error: 'This patient is marked deceased.' }, 409)
        }
        if (patient.continuity_status === 'transferred_out' || patient.continuity_status === 'inactive_lost_followup') {
            return json({ error: 'Follow-up has been stopped for this patient.' }, 409)
        }
        // Set when a previous call ended in DO_NOT_CALL. Calling again would break
        // the promise the agent made on that call.
        if (patient.do_not_call) {
            return json({ error: 'This patient has asked not to be called again.' }, 409)
        }
        // Temporary hold set by reception — admitted elsewhere, travelling,
        // grieving. Not permanent like do_not_call, but "not now" must mean it.
        if (patient.call_hold) {
            return json({
                error: 'Calls to this patient are on hold.',
                detail: patient.call_hold_reason ? `Reason: ${patient.call_hold_reason}` : 'Clear the hold in the patient record to call them.',
            }, 409)
        }

        // phone_e164 is generated, so it is the authority. Fall back to computing
        // it only when the column is absent (migration not yet applied) — never
        // to the raw string, which is exactly what is not dialable.
        //
        // A campaign may supply the number instead. The hospital stopped collecting
        // phone numbers, so most patients have none on file — a typed number is the
        // only way to reach them, and it is NOT written back to the patient record.
        const suppliedNumber = typeof body?.phoneOverride === 'string' ? toE164(body.phoneOverride) : null
        if (body?.phoneOverride && !suppliedNumber) {
            return json({ error: `"${body.phoneOverride}" is not a usable mobile number.` }, 422)
        }
        // Patient's own number first; the attender's if the patient has none.
        // For an elderly chronic patient the carer's phone is often the only one
        // that gets answered, and half of KKC's answered calls were family.
        const dialedNumber = suppliedNumber
            ?? patient.phone_e164 ?? toE164(patient.phone)
            ?? patient.attender_phone_e164 ?? toE164(patient.attender_phone)
        if (!dialedNumber) {
            return json({
                error: patient.phone
                    ? `"${patient.phone}" is not a usable mobile number.`
                    : 'No phone number on file for this patient.',
            }, 422)
        }

        // What goes in the attempt row.
        //
        // A number the hospital already stores is recorded as-is — it is theirs and
        // already on the patient. A number TYPED for a campaign is not: the chief
        // asked that the software hold no further phone numbers, and writing it to
        // an attempt row would put it back in the database by another door. Only the
        // last two digits are kept, which is enough for reception to confirm they
        // reached the number they meant and useless for dialling.
        const recordedNumber = suppliedNumber
            ? `••••••${dialedNumber.slice(-2)}`
            : dialedNumber

        // The agent cannot handle a red flag without a number to give. Fail loudly
        // here rather than place a call that would go silent in an emergency.
        // Per-hospital voice config. These used to be GLOBAL secrets, which meant
        // a second hospital's red-flag patient would have been read the first
        // hospital's front desk number. The env values remain only as a fallback
        // for a row that predates the migration.
        const { data: voiceCfg } = await admin
            .from('hospital_profiles')
            .select('voice_provider, voice_front_desk_number, voice_hospital_address, default_call_language, ai_call_daily_cap')
            .eq('id', caller.id)
            .maybeSingle()

        const frontDeskNumber = voiceCfg?.voice_front_desk_number || Deno.env.get('SARVAM_FRONT_DESK_NUMBER')
        if (!frontDeskNumber) {
            return json({
                error: 'No front desk number is set for this hospital — refusing to place the call.',
                detail: 'The agent reads this out on a red-flag call. Set voice_front_desk_number on the hospital profile.',
            }, 500)
        }
        const hospitalAddress = voiceCfg?.voice_hospital_address || Deno.env.get('SARVAM_HOSPITAL_ADDRESS') || ''
        const languageName = requestedLanguage || voiceCfg?.default_call_language || 'Tamil'
        const provider = getProvider(voiceCfg?.voice_provider)

        // ── Latest active review, for what the agent actually says ───────────
        const { data: review } = await admin
            .from('hospital_patient_reviews')
            .select('id, doctor_id, next_review_date')
            .eq('hospital_id', caller.id)
            .eq('patient_id', patient.id)
            .in('status', ['pending', 'rescheduled'])
            .order('next_review_date', { ascending: true })
            .limit(1)
            .maybeSingle()

        let doctorName: string | null = null
        if (review?.doctor_id) {
            const { data: doctor } = await admin
                .from('hospital_doctors').select('name').eq('id', review.doctor_id).maybeSingle()
            doctorName = doctor?.name ?? null
        }

        // Last actual visit — the agent opens with it, so it must be a real
        // prescription date, not the registration date.
        const { data: lastRx } = await admin
            .from('hospital_prescriptions')
            .select('created_at')
            .eq('hospital_id', caller.id)
            .eq('patient_id', patient.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        const { data: hospital } = await admin
            .from('users').select('name').eq('id', caller.id).maybeSingle()

        // Whole days between the due date and today, floored at 0. Sent as a number
        // the agent phrases in words — it must never read it out as a statistic.
        const daysOverdue = (() => {
            if (!review?.next_review_date) return 0
            const due = new Date(`${review.next_review_date}T00:00:00`).getTime()
            const today = new Date(new Date().toDateString()).getTime()
            return Math.max(0, Math.floor((today - due) / 86400000))
        })()

        // ── Daily cap ────────────────────────────────────────────────────────
        //
        // A circuit breaker, not a business rule. The campaign accepts typed
        // numbers, so a single mistyped batch can dial hundreds of strangers
        // from the hospital's own number — and the provider balance it drains is
        // prepaid and shared by every hospital, so one clinic's mistake stops
        // calls for all of them.
        //
        // Counts calls that were actually DIALLED. A request rejected upstream
        // before dialling (a 422) costs nothing and reached nobody, so it must
        // not consume the day's allowance and lock out real calls.
        const istDayStart = (() => {
            const nowIst = new Date(Date.now() + 5.5 * 3600_000)
            nowIst.setUTCHours(0, 0, 0, 0)
            return new Date(nowIst.getTime() - 5.5 * 3600_000).toISOString()
        })()

        const dailyCap = typeof voiceCfg?.ai_call_daily_cap === 'number' ? voiceCfg.ai_call_daily_cap : 200

        const { count: dialledToday } = await admin
            .from('hospital_voice_call_attempts')
            .select('id', { count: 'exact', head: true })
            .eq('hospital_id', caller.id)
            .gte('created_at', istDayStart)
            .or('status.in.(placing,placed,completed),provider_call_id.not.is.null')

        if ((dialledToday ?? 0) >= dailyCap) {
            return json({
                error: `Daily limit reached — ${dailyCap} calls have already been placed today.`,
                detail: 'This is a safety limit. Calls resume tomorrow, or raise the cap in hospital settings.',
            }, 429)
        }

        // Expire attempts that never got an outcome.
        //
        // The in-flight uniqueness index is what stops a double-click dialling twice,
        // but it has no timeout: an attempt whose webhook never arrives pins that
        // patient at "a call is already in progress" permanently. A call cannot still
        // be running after 30 minutes, so anything older is stale by definition, and
        // a patient must never become permanently un-callable because a third party
        // failed to tell us how a call ended.
        const STALE_AFTER_MIN = 30
        await admin
            .from('hospital_voice_call_attempts')
            .update({
                status: 'failed',
                failure_reason: `No outcome received within ${STALE_AFTER_MIN} minutes — expired automatically`,
                completed_at: new Date().toISOString(),
            })
            .eq('hospital_id', caller.id)
            .in('status', ['placing', 'placed'])
            .lt('created_at', new Date(Date.now() - STALE_AFTER_MIN * 60_000).toISOString())

        // ── Reserve the attempt BEFORE calling Sarvam ────────────────────────
        // Written first so a webhook that arrives before this function returns
        // still finds its row. The partial unique index on (patient_id) WHERE
        // status IN ('placing','placed') is what stops a double-click dialling
        // the same patient twice.
        const webhookToken = crypto.randomUUID().replace(/-/g, '')
        const { data: attempt, error: attemptError } = await admin
            .from('hospital_voice_call_attempts')
            .insert({
                hospital_id: caller.id,
                patient_id: patient.id,
                doctor_id: review?.doctor_id ?? null,
                review_id: review?.id ?? null,
                dialed_number: recordedNumber,
                provider: provider.name,
                webhook_token: webhookToken,
                status: 'placing',
                requested_by_name: requestedByName,
            })
            .select('id')
            .single()

        if (attemptError) {
            // 23505 = unique_violation on the in-flight index
            if ((attemptError as any).code === '23505') {
                return json({ error: 'A call to this patient is already in progress.' }, 409)
            }
            throw attemptError
        }

        // ── Place the call, through whichever provider this hospital is on ───
        const result = await provider.placeCall({
            attemptId: attempt.id,
            webhookToken,
            dialedNumber,
            languageName,
            // Exactly the nine the agent script declares. An empty string means
            // "we don't know" — the script skips anything blank rather than guess,
            // so never substitute a placeholder here.
            agentVariables: {
                patient_name: patient.name ?? '',
                mr_number: patient.mr_number ?? '',
                doctor_name: doctorName ?? '',
                last_visit_date: lastRx?.created_at ? formatReviewDate(String(lastRx.created_at).slice(0, 10)) : '',
                review_date: formatReviewDate(review?.next_review_date),
                days_overdue: String(daysOverdue),
                hospital_name: hospital?.name ?? '',
                hospital_address: hospitalAddress,
                front_desk_number: frontDeskNumber,
            },
        })

        if (!result.ok) {
            // Close the attempt out so the in-flight index doesn't wedge this
            // patient permanently after a failed placement.
            await admin.from('hospital_voice_call_attempts')
                .update({ status: 'failed', failure_reason: result.detail.slice(0, 500), completed_at: new Date().toISOString() })
                .eq('id', attempt.id)
            return json({
                error: result.notConfigured ? 'Voice calling is not configured' : 'Could not place the call',
                detail: result.detail,
            }, result.status)
        }

        await admin.from('hospital_voice_call_attempts')
            .update({ status: 'placed', provider_call_id: result.providerCallId })
            .eq('id', attempt.id)

        return json({
            ok: true,
            attemptRef: attempt.id,
            provider: provider.name,
            providerCallId: result.providerCallId,
            dialedNumber: recordedNumber,
        })
    } catch (err) {
        console.error('[place-review-call]', err)
        return json({ error: (err as Error).message ?? 'Unexpected error' }, 500)
    }
})

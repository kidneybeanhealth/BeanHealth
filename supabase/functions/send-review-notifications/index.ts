// Supabase Edge Function: send-review-notifications
// Deploy: supabase functions deploy send-review-notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const retryDelayMinutes = [15, 120, 720]

const normalizePhone = (raw: string): string => raw.replace(/[^\d+]/g, '')

const formatReviewDate = (value?: string | null): string => {
  if (!value) return '-'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

const renderTemplate = (template: string, vars: Record<string, string>): string =>
  template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? '')

const resolveSmsTemplate = (settings: any, notificationType: string): string | null => {
  if (notificationType === 'review_d_minus_7') return settings?.sms_template_review_d7 || null
  if (notificationType === 'review_d_minus_1') return settings?.sms_template_review_d1 || null
  if (notificationType === 'review_day') return settings?.sms_template_review_d0 || null
  return settings?.sms_template_manual || settings?.sms_template_review_d1 || null
}

const resolveWhatsappTemplate = (settings: any, notificationType: string): string | null => {
  if (notificationType === 'review_d_minus_7') return settings?.template_review_d7 || null
  if (notificationType === 'review_d_minus_1') return settings?.template_review_d1 || null
  if (notificationType === 'review_day') return settings?.template_review_d0 || null
  return settings?.template_review_manual || settings?.template_review_d1 || null
}

const sendSmsTwilio = async (to: string, body: string) => {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')
  const from = Deno.env.get('TWILIO_FROM_NUMBER')

  if (!sid || !token) throw new Error('missing_twilio_credentials')
  if (!messagingServiceSid && !from) throw new Error('missing_twilio_sender_config')

  const payload = new URLSearchParams()
  payload.set('To', to)
  payload.set('Body', body)
  if (messagingServiceSid) payload.set('MessagingServiceSid', messagingServiceSid)
  else if (from) payload.set('From', from)

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload.toString(),
  })

  const responseJson = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(responseJson?.message || `twilio_http_${response.status}`)
  }

  return {
    providerMessageId: responseJson?.sid || null,
    providerResponse: responseJson,
    providerPayload: Object.fromEntries(payload),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!
    const metaAccessToken = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const limit = Number(body?.limit || 20)

    const { data: jobs, error: claimError } = await supabase.rpc('claim_review_notification_jobs', {
      p_limit: Number.isFinite(limit) ? limit : 20,
    })
    if (claimError) throw claimError

    if (!jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No due jobs' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    let processed = 0
    let sent = 0
    let failed = 0
    let skipped = 0

    for (const claimedJob of jobs) {
      processed += 1

      // Safety fetch for environments where claim RPC has older return shape.
      const { data: jobMeta } = await supabase
        .from('hospital_review_notification_jobs')
        .select('id, channel, template_key, sent_to')
        .eq('id', claimedJob.id)
        .maybeSingle()

      const channel = (jobMeta?.channel || claimedJob?.channel || 'whatsapp') as 'sms' | 'whatsapp'

      try {
        const { data: review, error: reviewError } = await supabase
          .from('hospital_patient_reviews')
          .select(`
            id,
            hospital_id,
            next_review_date,
            status,
            patient:hospital_patients(id, name, phone),
            doctor:hospital_doctors(name)
          `)
          .eq('id', claimedJob.review_id)
          .single()

        if (reviewError || !review) throw new Error('review_not_found')

        if (review.status === 'completed' || review.status === 'cancelled') {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
              error_message: 'review_not_active',
            })
            .eq('id', claimedJob.id)
          skipped += 1
          continue
        }

        const rawPhone = (review as any)?.patient?.phone?.trim?.() || ''
        const to = normalizePhone(rawPhone)
        if (!to) {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'skipped',
              updated_at: new Date().toISOString(),
              error_message: 'missing_phone',
            })
            .eq('id', claimedJob.id)
          await supabase.from('hospital_notification_deliveries').insert({
            job_id: claimedJob.id,
            hospital_id: claimedJob.hospital_id,
            channel,
            status: 'skipped',
            error_message: 'missing_phone',
          })
          skipped += 1
          continue
        }

        const patientName = (review as any)?.patient?.name || 'Patient'
        const doctorName = (review as any)?.doctor?.name || 'Doctor'
        const reviewDate = formatReviewDate((review as any)?.next_review_date)
        const hospitalName = 'Hospital'

        if (channel === 'sms') {
          const { data: smsSettings } = await supabase
            .from('hospital_notification_settings')
            .select('*')
            .eq('hospital_id', claimedJob.hospital_id)
            .maybeSingle()

          if (smsSettings && smsSettings.sms_enabled === false) {
            await supabase
              .from('hospital_review_notification_jobs')
              .update({
                status: 'skipped',
                updated_at: new Date().toISOString(),
                error_message: 'sms_disabled',
              })
              .eq('id', claimedJob.id)
            await supabase.from('hospital_notification_deliveries').insert({
              job_id: claimedJob.id,
              hospital_id: claimedJob.hospital_id,
              channel: 'sms',
              status: 'skipped',
              error_message: 'sms_disabled',
            })
            skipped += 1
            continue
          }

          const template =
            resolveSmsTemplate(smsSettings, claimedJob.notification_type) ||
            'Dear {{patient_name}}, your review is due on {{review_date}}. Please visit {{hospital_name}}. Doctor: {{doctor_name}}.'
          const messageText = renderTemplate(template, {
            patient_name: patientName,
            review_date: reviewDate,
            doctor_name: doctorName,
            hospital_name: hospitalName,
          }).trim()

          const smsResult = await sendSmsTwilio(to, messageText)
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              provider_message_id: smsResult.providerMessageId,
              provider_payload: smsResult.providerPayload,
              provider_response: smsResult.providerResponse,
              sent_to: to,
              error_message: null,
            })
            .eq('id', claimedJob.id)
          await supabase.from('hospital_notification_deliveries').insert({
            job_id: claimedJob.id,
            hospital_id: claimedJob.hospital_id,
            channel: 'sms',
            status: 'sent',
            provider_message_id: smsResult.providerMessageId,
            provider_response: smsResult.providerResponse,
          })
          sent += 1
          continue
        }

        const { data: waSettings } = await supabase
          .from('hospital_whatsapp_settings')
          .select('*')
          .eq('hospital_id', claimedJob.hospital_id)
          .maybeSingle()

        const { data: channelSettings } = await supabase
          .from('hospital_notification_settings')
          .select('whatsapp_enabled')
          .eq('hospital_id', claimedJob.hospital_id)
          .maybeSingle()

        if (channelSettings && channelSettings.whatsapp_enabled === false) {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'skipped',
              updated_at: new Date().toISOString(),
              error_message: 'whatsapp_disabled',
            })
            .eq('id', claimedJob.id)
          await supabase.from('hospital_notification_deliveries').insert({
            job_id: claimedJob.id,
            hospital_id: claimedJob.hospital_id,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: 'whatsapp_disabled',
          })
          skipped += 1
          continue
        }

        if (!waSettings?.enabled) {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'skipped',
              updated_at: new Date().toISOString(),
              error_message: 'whatsapp_not_configured',
            })
            .eq('id', claimedJob.id)
          await supabase.from('hospital_notification_deliveries').insert({
            job_id: claimedJob.id,
            hospital_id: claimedJob.hospital_id,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: 'whatsapp_not_configured',
          })
          skipped += 1
          continue
        }

        if (!metaAccessToken || !waSettings.meta_phone_number_id) {
          throw new Error('missing_meta_configuration')
        }

        const templateName =
          resolveWhatsappTemplate(waSettings, claimedJob.notification_type) ||
          (jobMeta?.template_key && String(jobMeta.template_key)) ||
          null

        if (!templateName) {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'skipped',
              updated_at: new Date().toISOString(),
              error_message: 'template_missing',
            })
            .eq('id', claimedJob.id)
          await supabase.from('hospital_notification_deliveries').insert({
            job_id: claimedJob.id,
            hospital_id: claimedJob.hospital_id,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: 'template_missing',
          })
          skipped += 1
          continue
        }

        const payload = {
          messaging_product: 'whatsapp',
          to: to.replace(/[^\d]/g, ''),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: patientName },
                  { type: 'text', text: reviewDate },
                  { type: 'text', text: doctorName },
                ],
              },
            ],
          },
        }

        const response = await fetch(
          `https://graph.facebook.com/v21.0/${waSettings.meta_phone_number_id}/messages`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${metaAccessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          }
        )

        const responseJson = await response.json().catch(() => ({}))
        if (!response.ok) {
          const errMessage = responseJson?.error?.message || `meta_http_${response.status}`
          throw new Error(errMessage)
        }

        const providerMessageId = responseJson?.messages?.[0]?.id || null
        await supabase
          .from('hospital_review_notification_jobs')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            provider_message_id: providerMessageId,
            provider_payload: payload,
            provider_response: responseJson,
            sent_to: to,
            error_message: null,
          })
          .eq('id', claimedJob.id)
        await supabase.from('hospital_notification_deliveries').insert({
          job_id: claimedJob.id,
          hospital_id: claimedJob.hospital_id,
          channel: 'whatsapp',
          status: 'sent',
          provider_message_id: providerMessageId,
          provider_response: responseJson,
        })
        sent += 1
      } catch (error) {
        const err = error instanceof Error ? error.message : 'unknown_error'
        const attemptCount = Number(claimedJob.attempt_count || 0) + 1
        const maxAttempts = Number(claimedJob.max_attempts || 3)

        if (attemptCount >= maxAttempts) {
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'failed',
              attempt_count: attemptCount,
              updated_at: new Date().toISOString(),
              error_message: err,
            })
            .eq('id', claimedJob.id)
        } else {
          const delay = retryDelayMinutes[Math.min(attemptCount - 1, retryDelayMinutes.length - 1)]
          const retryAt = new Date(Date.now() + delay * 60 * 1000).toISOString()
          await supabase
            .from('hospital_review_notification_jobs')
            .update({
              status: 'retrying',
              attempt_count: attemptCount,
              scheduled_for: retryAt,
              updated_at: new Date().toISOString(),
              error_message: err,
            })
            .eq('id', claimedJob.id)
        }

        await supabase.from('hospital_notification_deliveries').insert({
          job_id: claimedJob.id,
          hospital_id: claimedJob.hospital_id,
          channel,
          status: attemptCount >= maxAttempts ? 'failed' : 'retrying',
          error_message: err,
        })
        failed += 1
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed, sent, failed, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('send-review-notifications error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'unknown_error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

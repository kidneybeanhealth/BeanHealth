/**
 * Sarvam — the first voice provider, and the one in production at KKC.
 *
 * Everything Sarvam-specific lives here and nowhere else: the endpoint shape,
 * the org/workspace-in-the-path quirk, the app_version pin, the callback_token
 * flag. The function that calls this knows nothing about any of it — it hands
 * over a number, a language, a token and nine agent variables, and gets back
 * either a provider call id or a reason it could not dial.
 */
import type { PlaceCallInput, PlaceCallResult, VoiceProvider } from './types.ts'

/**
 * The numbers Sarvam can ring from, each with the connection it was bought
 * under: phone → connection id. A number only works with its own connection.
 *
 * SARVAM_AGENT_LINES lists them as `connection_id=+91number`, separated by
 * commas or new lines. Without it, the original SARVAM_CONNECTION_ID +
 * SARVAM_AGENT_PHONE_NUMBER pair is the one line, as before.
 */
const readLines = (): Map<string, string> => {
    const lines = new Map<string, string>()
    for (const entry of (Deno.env.get('SARVAM_AGENT_LINES') ?? '').split(/[,\n]/)) {
        const [connectionId, phone] = entry.split('=').map((s) => s.trim())
        if (connectionId && phone) lines.set(phone, connectionId)
    }
    if (lines.size === 0) {
        const connectionId = Deno.env.get('SARVAM_CONNECTION_ID')
        const phone = Deno.env.get('SARVAM_AGENT_PHONE_NUMBER')
        if (connectionId && phone) lines.set(phone, connectionId)
    }
    return lines
}

export const sarvamProvider: VoiceProvider = {
    name: 'sarvam',

    callerLines: () => [...readLines().keys()],

    async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
        const orgId = Deno.env.get('SARVAM_ORG_ID')
        const workspaceId = Deno.env.get('SARVAM_WORKSPACE_ID')
        // A purpose with its own script (Connect) brings its own agent; the env
        // pair is the review-reminder agent every KKC call has always used.
        const appId = input.agentOverride?.appId ?? Deno.env.get('SARVAM_APP_ID')
        const apiKey = Deno.env.get('SARVAM_API_KEY')
        const agentPhone = input.callerLine
        const connectionId = readLines().get(agentPhone)
        const webhookBase = Deno.env.get('SARVAM_WEBHOOK_BASE_URL')
        const appVersionRaw = input.agentOverride ? String(input.agentOverride.appVersion) : Deno.env.get('SARVAM_APP_VERSION')

        for (const [k, v] of Object.entries({ SARVAM_ORG_ID: orgId, SARVAM_WORKSPACE_ID: workspaceId, SARVAM_APP_ID: appId, SARVAM_API_KEY: apiKey, SARVAM_WEBHOOK_BASE_URL: webhookBase })) {
            if (!v) return { ok: false, status: 503, notConfigured: true, detail: `${k} is unset.` }
        }
        if (!connectionId) {
            return { ok: false, status: 503, notConfigured: true, detail: `No Sarvam connection is set for ${agentPhone}. Check SARVAM_AGENT_LINES.` }
        }

        // Always an explicit number. Sending null does NOT mean "use the newest
        // commit" — version_filter defaults to 'specific', so the API rejects
        // the call outright:
        //   422 app_config: app_version is required when version_filter is specific
        // Pinning is Sarvam's own guidance for production anyway: unpinned, an
        // edit committed in the console changes what patients hear with no
        // deploy and no record on our side.
        if (!appVersionRaw || !Number.isFinite(Number(appVersionRaw))) {
            return {
                ok: false, status: 503, notConfigured: true,
                detail: 'SARVAM_APP_VERSION is unset. Set it to the agent version committed in the Sarvam console.',
            }
        }

        // Sarvam validates agent_variables against the set the agent declares
        // and rejects the whole call otherwise:
        //   422 Agent variables '{'callback_token'}' not found in agent variables
        // So the token is only sent once the variable exists on the agent.
        const sendCallbackToken =
            String(Deno.env.get('SARVAM_SEND_CALLBACK_TOKEN') ?? '').toLowerCase() === 'true'

        // org/workspace live in the PATH, not the body — easy to miss because the
        // docs render them as {org_id}/{workspace_id} placeholders.
        const endpoint = `https://apps.sarvam.ai/api/outbounds/v1/orgs/${orgId}/workspaces/${workspaceId}/outbounds`

        const payload = {
            app_config: {
                app_id: appId,
                app_type: 'agent',
                app_version: Number(appVersionRaw),
                connection_config: { connection_id: connectionId, agent_phone_number: agentPhone },
                agent_variables: {
                    ...input.agentVariables,
                    ...(sendCallbackToken ? { callback_token: input.webhookToken } : {}),
                },
                app_overrides: { initial_language_name: input.languageName },
            },
            user_config: { user_phone_number: input.dialedNumber },
            webhook_config: {
                url: `${webhookBase}?token=${input.webhookToken}`,
                metadata: { attempt_ref: input.attemptId, token: input.webhookToken },
            },
        }

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey! },
            body: JSON.stringify(payload),
        })
        const text = await res.text()

        if (!res.ok) {
            return { ok: false, status: 502, detail: `Sarvam ${res.status}: ${text.slice(0, 500)}` }
        }

        let parsed: { attempt_id?: string } = {}
        try { parsed = JSON.parse(text || '{}') } catch { /* an empty body is a success with no id */ }
        return { ok: true, providerCallId: parsed?.attempt_id ?? null }
    },
}

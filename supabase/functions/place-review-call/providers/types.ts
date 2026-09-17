/**
 * The seam between "may this patient be called?" and "dial them".
 *
 * Everything above this line — deceased, do-not-call, call hold, phone gate,
 * daily cap, stale sweep, reserving the attempt row — is ours and identical for
 * every provider. Everything below it is the vendor's, and there is exactly one
 * method. A second provider is a second file implementing these three lines,
 * not a fork of the function.
 */
export interface PlaceCallInput {
    attemptId: string
    /** Single-use; the webhook matches the outcome on it. */
    webhookToken: string
    dialedNumber: string
    /** Opening language name, e.g. 'Tamil'. The agent mirrors the patient from there. */
    languageName: string
    /** Exactly the variables the agent script declares. Empty string = "we don't know". */
    agentVariables: Record<string, string>
}

export type PlaceCallResult =
    | { ok: true; providerCallId: string | null }
    | { ok: false; status: number; detail: string; notConfigured?: boolean }

export interface VoiceProvider {
    name: 'sarvam' | 'livekit'
    placeCall(input: PlaceCallInput): Promise<PlaceCallResult>
}

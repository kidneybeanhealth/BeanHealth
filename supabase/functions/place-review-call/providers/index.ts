import type { VoiceProvider } from './types.ts'
import { sarvamProvider } from './sarvam.ts'

/**
 * LiveKit — Stage 1. A stub on purpose.
 *
 * It exists so the seam is real and selectable per hospital today, and so
 * nothing above the seam has to change when the self-hosted stack arrives. It
 * refuses with 503 rather than dialling anything, because the one thing a
 * placeholder provider must never do is reach a patient by accident.
 */
const livekitProvider: VoiceProvider = {
    name: 'livekit',
    async placeCall() {
        return {
            ok: false, status: 503, notConfigured: true,
            detail: 'The self-hosted voice stack is not configured for this hospital yet.',
        }
    },
}

const REGISTRY: Record<VoiceProvider['name'], VoiceProvider> = {
    sarvam: sarvamProvider,
    livekit: livekitProvider,
}

/** Unknown names fall back to Sarvam — the value every existing hospital row carries. */
export const getProvider = (name?: string | null): VoiceProvider =>
    REGISTRY[(name as VoiceProvider['name']) ?? 'sarvam'] ?? sarvamProvider

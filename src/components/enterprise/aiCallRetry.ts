/**
 * aiCallRetry — when the campaign rings a patient again
 *
 * One rule, used by both modes: in manual mode it suggests "Call again"; in
 * automatic mode it puts the patient back in the queue. Kept pure and tested,
 * because it decides whether a person gets a second phone call.
 *
 * A call that reached a decision is never repeated, whatever its summary says:
 * the patient said they will come, said no, said "don't call", is in hospital,
 * has died, raised a red flag, or it was the wrong number. Keywords only apply
 * to calls that ended without one of those.
 */
import { callResultLabel, NO_CONVERSATION_LABEL } from './aiCallReport';

export interface RetryRules {
    notAnswered: boolean;
    busy: boolean;
    couldNotConnect: boolean;
    noConversation: boolean;
    /** Lower-case phrases; a match in the agent's summary or reason means "call again". */
    keywords: string[];
    /** Extra attempts allowed after the first call: 0 means never call again. */
    maxRetries: number;
}

export interface CallOutcome {
    status: string;
    providerStatus: string | null;
    vars: Record<string, unknown> | null;
}

const FINAL_DISPOSITIONS = new Set([
    'WILL_COME', 'WRONG_NUMBER', 'DO_NOT_CALL', 'PATIENT_DECEASED',
    'RED_FLAG_REPORTED', 'PATIENT_HOSPITALISED', 'LANGUAGE_BARRIER',
]);

/** "call ended, Busy ,  later" → ['call ended', 'busy', 'later'] */
export const parseKeywords = (raw: string): string[] =>
    raw.split(/[,\n]/).map((k) => k.trim().toLowerCase()).filter(Boolean);

/**
 * Why this patient should be called again, or null. `attempts` is how many
 * calls have already been placed to them in this list, the one just finished
 * included.
 */
export function retryReason(outcome: CallOutcome, attempts: number, rules: RetryRules): string | null {
    if (attempts > rules.maxRetries) return null;
    if (outcome.status === 'failed') return null; // refused before dialling: a retry would be refused too

    const label = callResultLabel(outcome.status, outcome.providerStatus, outcome.vars);
    if (label === 'Not answered') return rules.notAnswered ? label : null;
    if (label === 'Busy') return rules.busy ? label : null;
    if (label === 'Could not connect') return rules.couldNotConnect ? label : null;

    const v = outcome.vars || {};
    const disposition = typeof v.disposition === 'string' ? v.disposition.trim().toUpperCase() : '';
    if (FINAL_DISPOSITIONS.has(disposition) || disposition.startsWith('REFUSED')) return null;

    if (label === NO_CONVERSATION_LABEL && rules.noConversation) return label;

    if (rules.keywords.length) {
        const text = [v.call_summary, v.reason_text]
            .filter((t): t is string => typeof t === 'string')
            .join(' ')
            .toLowerCase();
        const hit = rules.keywords.find((k) => text.includes(k));
        if (hit) return `Summary mentions "${hit}"`;
    }
    return null;
}

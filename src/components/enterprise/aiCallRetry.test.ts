import { describe, expect, it } from 'vitest';
import { parseKeywords, retryReason, type RetryRules } from './aiCallRetry';

const rules: RetryRules = {
    notAnswered: true, busy: true, couldNotConnect: false, noConversation: true,
    keywords: ['call ended', 'later'], maxRetries: 1,
};
const done = (providerStatus: string | null, vars: Record<string, unknown> | null = null) =>
    ({ status: 'completed', providerStatus, vars });

describe('retryReason', () => {
    it('calls again when the line was busy or not answered', () => {
        expect(retryReason(done('busy'), 1, rules)).toBe('Busy');
        expect(retryReason(done('no_answer'), 1, rules)).toBe('Not answered');
    });

    it('respects the switches', () => {
        expect(retryReason(done('failed'), 1, rules)).toBeNull();
        expect(retryReason(done('busy'), 1, { ...rules, busy: false })).toBeNull();
    });

    it('stops after the allowed number of attempts', () => {
        expect(retryReason(done('busy'), 2, rules)).toBeNull();
        expect(retryReason(done('busy'), 2, { ...rules, maxRetries: 2 })).toBe('Busy');
        expect(retryReason(done('busy'), 1, { ...rules, maxRetries: 0 })).toBeNull();
    });

    it('never repeats a call refused before dialling', () => {
        expect(retryReason({ status: 'failed', providerStatus: null, vars: null }, 1, rules)).toBeNull();
    });

    it('calls again after a pick-up with nothing said', () => {
        expect(retryReason(done('connected', {}), 1, rules)).toBe('Picked up, no conversation');
        expect(retryReason(done('connected', { disposition: 'NOT_REACHABLE', call_summary: 'x' }), 1, rules))
            .toBe('Picked up, no conversation');
    });

    it('never repeats a call that reached a decision, even if a keyword matches', () => {
        for (const disposition of ['WILL_COME', 'REFUSED_COST', 'DO_NOT_CALL', 'PATIENT_DECEASED', 'WRONG_NUMBER', 'RED_FLAG_REPORTED']) {
            expect(retryReason(done('connected', { disposition, call_summary: 'They will come later; call ended' }), 1, rules))
                .toBeNull();
        }
    });

    it('calls again when the summary has a chosen phrase and no decision was reached', () => {
        expect(retryReason(done('connected', { disposition: 'CALLBACK', call_summary: 'Asked us to ring LATER today' }), 1, rules))
            .toBe('Summary mentions "later"');
        expect(retryReason(done('connected', { disposition: 'CALLBACK', call_summary: 'Spoke briefly' }), 1, rules)).toBeNull();
    });
});

describe('parseKeywords', () => {
    it('splits on commas and lines, trims and lower-cases', () => {
        expect(parseKeywords(' Call ended, BUSY ,\nlater,, ')).toEqual(['call ended', 'busy', 'later']);
    });
});

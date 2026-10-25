import { describe, expect, it } from 'vitest';
import { onePerPatient, summarizeReport } from './aiCallReport';

const call = (patientId: string, createdAt: string, providerStatus: string, vars: Record<string, unknown> | null = null, durationSeconds: number | null = null) => ({
    patientId, name: patientId, mrNumber: 'KNH/26/000001', createdAt, status: 'completed', providerStatus, vars, durationSeconds,
});
const spoke = (disposition: string) => ({ disposition, call_summary: 'They talked.' });

describe('onePerPatient', () => {
    it('shows a patient rung twice once, and counts both calls', () => {
        const { inputs, totals } = onePerPatient([
            call('a', '2026-10-25T08:00:00Z', 'no_answer'),
            call('a', '2026-10-25T08:10:00Z', 'connected', spoke('WILL_COME'), 70),
            call('b', '2026-10-25T08:05:00Z', 'busy'),
        ]);
        expect(inputs.map((c) => [c.name, c.attempts])).toEqual([['b', 1], ['a', 2]]);
        expect(totals).toEqual({ callsPlaced: 3, callSeconds: 70, timedCalls: 1 });
    });

    it('keeps the conversation when a later retry went unanswered', () => {
        const { inputs } = onePerPatient([
            call('a', '2026-10-25T08:00:00Z', 'connected', spoke('CALLBACK_REQUESTED')),
            call('a', '2026-10-25T09:00:00Z', 'no_answer'),
        ]);
        expect(inputs).toHaveLength(1);
        expect(inputs[0].createdAt).toBe('2026-10-25T08:00:00Z');
    });

    it('takes the latest of two answered calls', () => {
        const { inputs } = onePerPatient([
            call('a', '2026-10-25T09:00:00Z', 'connected', spoke('WILL_COME')),
            call('a', '2026-10-25T08:00:00Z', 'connected', spoke('CALLBACK_REQUESTED')),
        ]);
        expect(inputs[0].vars?.disposition).toBe('WILL_COME');
    });
});

describe('summarizeReport', () => {
    it('puts call-backs and refusals first, then will come, and unreached last', () => {
        const { inputs, totals } = onePerPatient([
            call('unreached', '2026-10-25T08:00:00Z', 'no_answer'),
            call('coming', '2026-10-25T08:01:00Z', 'connected', spoke('WILL_COME')),
            call('refused', '2026-10-25T08:02:00Z', 'connected', spoke('REFUSED_COST')),
            call('wrong', '2026-10-25T08:03:00Z', 'connected', spoke('WRONG_NUMBER')),
        ]);
        const r = summarizeReport(inputs, totals);
        expect(r.rows.map((x) => [x.name, x.group])).toEqual([
            ['refused', 'action'], ['coming', 'coming'], ['wrong', 'other'], ['unreached', 'unreached'],
        ]);
        expect([r.patients, r.answered, r.coming, r.wontCome, r.unreached]).toEqual([4, 3, 1, 1, 1]);
    });
});

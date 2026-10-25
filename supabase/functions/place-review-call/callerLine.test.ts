import { describe, expect, it } from 'vitest';
import { pickCallerLine } from './callerLine';

const now = Date.parse('2026-10-25T10:00:00Z');
const at = (minAgo: number) => new Date(now - minAgo * 60_000).toISOString();
const A = '+918071581310', B = '+918071581311', C = '+918071581312';

describe('pickCallerLine', () => {
    it('uses the first number when nothing has rung', () => {
        expect(pickCallerLine([A, B, C], [], 1, now)).toBe(A);
    });

    it('skips a number with a call in progress', () => {
        expect(pickCallerLine([A, B, C], [{ caller_line: A, status: 'placed', created_at: at(1) }], 1, now)).toBe(B);
    });

    it('says none is free when every number is in a call', () => {
        const busy = [A, B, C].map((l) => ({ caller_line: l, status: 'placing', created_at: at(0) }));
        expect(pickCallerLine([A, B, C], busy, 1, now)).toBeNull();
        expect(pickCallerLine([A, B, C], busy, 2, now)).toBe(A);
    });

    it('spreads calls to the number that has rung least', () => {
        const done = [
            { caller_line: A, status: 'completed', created_at: at(20) },
            { caller_line: A, status: 'completed', created_at: at(15) },
            { caller_line: B, status: 'completed', created_at: at(10) },
        ];
        expect(pickCallerLine([A, B, C], done, 1, now)).toBe(C);
    });

    it('frees a number whose outcome never arrived after 10 minutes', () => {
        expect(pickCallerLine([A], [{ caller_line: A, status: 'placed', created_at: at(11) }], 1, now)).toBe(A);
    });

    it('ignores numbers that are no longer configured', () => {
        expect(pickCallerLine([B], [{ caller_line: A, status: 'placed', created_at: at(1) }], 1, now)).toBe(B);
    });
});

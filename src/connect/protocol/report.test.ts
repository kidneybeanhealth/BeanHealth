import { describe, it, expect } from 'vitest';
import { buildMonthReport, type ReportAttempt } from './report';
import type { EngineSession } from './engine';

const FROM = '2026-09-01';
const TO = '2026-09-30';

const call = (over: Partial<ReportAttempt>): ReportAttempt => ({
    patientId: 'p1', purpose: 'missed_session', createdAt: '2026-09-11T05:00:00Z',
    status: 'completed', connected: true, disposition: null, callbackRequested: false, ...over,
});

const run = (over: Partial<Parameters<typeof buildMonthReport>[0]>) =>
    buildMonthReport({ from: FROM, to: TO, asOf: '2026-10-15', sessions: [], attempts: [], labs: [], alerts: [], ...over });

describe('sessions', () => {
    it('attendance rate leaves centre-cancelled sessions out of the denominator', () => {
        const sessions: EngineSession[] = [
            { patientId: 'p1', date: '2026-09-02', status: 'attended' },
            { patientId: 'p1', date: '2026-09-04', status: 'attended' },
            { patientId: 'p1', date: '2026-09-07', status: 'attended' },
            { patientId: 'p1', date: '2026-09-09', status: 'missed' },
            { patientId: 'p1', date: '2026-09-11', status: 'cancelled' },
            { patientId: 'p1', date: '2026-08-31', status: 'missed' }, // last month
        ];
        const r = run({ sessions });
        expect(r.sessions).toEqual({ attended: 3, missed: 1, cancelled: 1, attendanceRate: 75 });
    });
});

describe('missed sessions and what followed', () => {
    const base: EngineSession[] = [
        { patientId: 'p1', date: '2026-09-09', status: 'missed' },
        { patientId: 'p1', date: '2026-09-14', status: 'attended' }, // back in 5 days
        { patientId: 'p2', date: '2026-09-09', status: 'missed' },
        { patientId: 'p2', date: '2026-09-25', status: 'attended' }, // back after 16 days — not within 7
        { patientId: 'p3', date: '2026-09-09', status: 'missed' },
        { patientId: 'p3', date: '2026-09-11', status: 'attended' }, // back, never called
    ];

    it('puts reached and never-called patients in separate groups', () => {
        const r = run({
            sessions: base,
            attempts: [
                call({ patientId: 'p1', createdAt: '2026-09-10T05:00:00Z', connected: true }),
                call({ patientId: 'p2', createdAt: '2026-09-10T05:00:00Z', connected: true }),
            ],
        });
        expect(r.missed.total).toBe(3);
        expect(r.missed.called).toBe(2);
        expect(r.missed.reached).toBe(2);
        expect(r.missed.backAfterReached).toEqual({ back: 1, of: 2 });
        expect(r.missed.backWithoutCall).toEqual({ back: 1, of: 1 });
    });

    it('does not count a call made after the call window as being about the miss', () => {
        const r = run({ sessions: base.slice(0, 2), attempts: [call({ createdAt: '2026-09-20T05:00:00Z' })] });
        expect(r.missed.called).toBe(0);
        expect(r.missed.backWithoutCall).toEqual({ back: 1, of: 1 });
    });

    it('leaves called-but-unreached out of both groups', () => {
        const r = run({ sessions: base.slice(0, 2), attempts: [call({ connected: false, createdAt: '2026-09-10T05:00:00Z' })] });
        expect(r.missed.called).toBe(1);
        expect(r.missed.reached).toBe(0);
        expect(r.missed.backAfterReached.of).toBe(0);
        expect(r.missed.backWithoutCall.of).toBe(0);
    });
});

describe('the current month', () => {
    it('does not judge a miss whose return window has not closed yet', () => {
        // Missed Friday 25th, report read on Sunday 27th: next session is Monday.
        const r = buildMonthReport({
            from: FROM, to: TO, asOf: '2026-09-27', attempts: [], labs: [], alerts: [],
            sessions: [
                { patientId: 'p1', date: '2026-09-25', status: 'missed' },
                { patientId: 'p2', date: '2026-09-10', status: 'missed' },
                { patientId: 'p3', date: '2026-09-24', status: 'missed' },
                { patientId: 'p3', date: '2026-09-26', status: 'attended' }, // came back already — decided
            ],
        });
        expect(r.missed.tooRecent).toBe(1);
        expect(r.missed.backWithoutCall).toEqual({ back: 1, of: 2 });
    });

    it('keeps a lab reminder undecided inside its window', () => {
        const r = buildMonthReport({
            from: FROM, to: TO, asOf: '2026-09-27', sessions: [], alerts: [],
            attempts: [call({ patientId: 'a', purpose: 'lab_due', createdAt: '2026-09-20T05:00:00Z' })],
            labs: [],
        });
        expect(r.labs.stillOpen).toBe(1);
        expect(r.labs.doneWithin14Days).toBe(0);
    });
});

describe('calls', () => {
    it('reach rate excludes calls that were never placed with the provider', () => {
        const r = run({ attempts: [
            call({ connected: true }),
            call({ connected: false }),
            call({ connected: false, status: 'failed' }),
            call({ purpose: 'review', connected: true }),
            call({ createdAt: '2026-10-01T05:00:00Z' }), // next month
        ] });
        expect(r.calls.placed).toBe(4);
        expect(r.calls.reached).toBe(2);
        expect(r.calls.reachRate).toBeCloseTo(66.7, 1);
        expect(r.calls.failed).toBe(1);
        expect(r.calls.byPurpose.missed_session).toEqual({ placed: 3, reached: 1 });
        expect(r.calls.byPurpose.review).toEqual({ placed: 1, reached: 1 });
    });
});

describe('labs', () => {
    it('counts a test recorded within 14 days of the first reminder', () => {
        const r = run({
            attempts: [
                call({ patientId: 'a', purpose: 'lab_due', createdAt: '2026-09-05T05:00:00Z' }),
                call({ patientId: 'a', purpose: 'lab_due', createdAt: '2026-09-07T05:00:00Z' }),
                call({ patientId: 'b', purpose: 'lab_due', createdAt: '2026-09-05T05:00:00Z' }),
            ],
            labs: [
                { patientId: 'a', testCode: 'cbc', doneOn: '2026-09-12' },
                { patientId: 'b', testCode: 'cbc', doneOn: '2026-09-25' }, // 20 days — too late
            ],
        });
        expect(r.labs).toEqual({ reminded: 2, doneWithin14Days: 1, stillOpen: 0, recorded: 2 });
    });
});

describe('alerts', () => {
    it('reports the median time to acknowledge a red flag', () => {
        const r = run({ alerts: [
            { kind: 'red_flag', createdAt: '2026-09-10T05:00:00Z', acknowledgedAt: '2026-09-10T05:10:00Z', resolvedAt: '2026-09-10T06:00:00Z' },
            { kind: 'red_flag', createdAt: '2026-09-11T05:00:00Z', acknowledgedAt: '2026-09-11T05:30:00Z', resolvedAt: null },
            { kind: 'red_flag', createdAt: '2026-09-12T05:00:00Z', acknowledgedAt: null, resolvedAt: null },
            { kind: 'callback', createdAt: '2026-09-12T05:00:00Z', acknowledgedAt: null, resolvedAt: null },
        ] });
        expect(r.alerts).toEqual({ redFlags: 3, callbacks: 1, resolved: 1, stillOpen: 2, medianRedFlagAckMinutes: 20 });
    });
});

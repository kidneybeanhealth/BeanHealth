/**
 * Monthly outcome report — what happened this month, and what the calls did.
 *
 * Pure, like the engine: records in, numbers out, covered by report.test.ts.
 * These are the numbers a centre renews on, so each one is defined exactly and
 * none of them claims more than the data can carry.
 *
 * ── Honesty about cause ───────────────────────────────────────────────────
 * "Came back within 7 days" is reported for patients whose missed session was
 * followed by a call that reached them AND for those who got no call, side by
 * side. It does not say the call caused the return — patients come back for
 * many reasons, and a centre that later reads "the AI brought 80% back" into a
 * number that was always 70% stops trusting every other number here. A true
 * effect needs a holdout; this report shows the comparison and names it as one.
 */
import type { CallPurpose } from './settings';
import { addDays, daysBetween, type DateKey, type EngineSession } from './engine';

export interface ReportAttempt {
    patientId: string;
    purpose: CallPurpose;
    createdAt: string;
    status: string;
    connected: boolean;
    disposition: string | null;
    callbackRequested: boolean;
}

export interface ReportAlert {
    kind: 'red_flag' | 'callback';
    createdAt: string;
    acknowledgedAt: string | null;
    resolvedAt: string | null;
}

export interface ReportLab { patientId: string; testCode: string; doneOn: DateKey }

export interface MonthReport {
    from: DateKey;
    to: DateKey;
    sessions: { attended: number; missed: number; cancelled: number; attendanceRate: number | null };
    missed: {
        total: number;
        called: number;
        reached: number;
        /** Came back within 7 days, by group. */
        backAfterReached: { back: number; of: number };
        backWithoutCall: { back: number; of: number };
        /**
         * Misses whose 7-day window has not closed yet. Kept out of both groups:
         * a Friday miss seen on Sunday has not had its next session, and
         * counting it as "did not come back" makes the current month look worse
         * than it is.
         */
        tooRecent: number;
    };
    calls: {
        placed: number;
        reached: number;
        reachRate: number | null;
        byPurpose: Record<CallPurpose, { placed: number; reached: number }>;
        failed: number;
    };
    labs: {
        reminded: number;
        doneWithin14Days: number;
        /** Reminded less than 14 days ago and not done yet — undecided, not failed. */
        stillOpen: number;
        recorded: number;
    };
    alerts: {
        redFlags: number;
        callbacks: number;
        resolved: number;
        stillOpen: number;
        /** Median minutes from a red flag to someone acknowledging it. */
        medianRedFlagAckMinutes: number | null;
    };
}

const pct = (n: number, d: number): number | null => (d > 0 ? Math.round((n / d) * 1000) / 10 : null);
const median = (xs: number[]): number | null => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};
const dayOf = (iso: string): DateKey => iso.slice(0, 10);

/** How long after a miss a call still counts as "about" it. */
export const CALL_WINDOW_DAYS = 3;
/** How long after a miss a return counts as "came back". */
export const RETURN_WINDOW_DAYS = 7;
/** How long after a lab reminder a recorded test counts as "done after reminder". */
export const LAB_WINDOW_DAYS = 14;

export function buildMonthReport(input: {
    from: DateKey;
    to: DateKey;
    /** Today. Anything whose outcome window has not closed by now is not judged. */
    asOf: DateKey;
    sessions: EngineSession[];
    attempts: ReportAttempt[];
    labs: ReportLab[];
    alerts: ReportAlert[];
}): MonthReport {
    const { from, to } = input;
    const inMonth = (k: DateKey) => k >= from && k <= to;

    // ── Sessions ───────────────────────────────────────────────────────
    const monthSessions = input.sessions.filter(s => inMonth(s.date));
    const attended = monthSessions.filter(s => s.status === 'attended').length;
    const missedS = monthSessions.filter(s => s.status === 'missed');
    const cancelled = monthSessions.filter(s => s.status === 'cancelled').length;

    // ── Missed sessions and what followed ──────────────────────────────
    const attendedBy = new Map<string, DateKey[]>();
    for (const s of input.sessions) {
        if (s.status !== 'attended') continue;
        const arr = attendedBy.get(s.patientId);
        if (arr) arr.push(s.date); else attendedBy.set(s.patientId, [s.date]);
    }
    const missCalls = input.attempts.filter(a => a.purpose === 'missed_session');
    let called = 0, reached = 0, tooRecent = 0;
    const afterReached = { back: 0, of: 0 };
    const withoutCall = { back: 0, of: 0 };
    for (const m of missedS) {
        const calls = missCalls.filter(a => a.patientId === m.patientId && dayOf(a.createdAt) >= m.date && daysBetween(m.date, dayOf(a.createdAt)) <= CALL_WINDOW_DAYS);
        const wasCalled = calls.length > 0;
        const wasReached = calls.some(a => a.connected);
        if (wasCalled) called++;
        if (wasReached) reached++;
        const back = (attendedBy.get(m.patientId) || []).some(d => d > m.date && d <= addDays(m.date, RETURN_WINDOW_DAYS));
        // Undecided until the window closes — unless they already came back.
        if (!back && addDays(m.date, RETURN_WINDOW_DAYS) > input.asOf) { tooRecent++; continue; }
        if (wasReached) { afterReached.of++; if (back) afterReached.back++; }
        else if (!wasCalled) { withoutCall.of++; if (back) withoutCall.back++; }
        // Called but not reached sits in neither group: it is neither a
        // conversation nor the absence of an attempt.
    }

    // ── Calls ──────────────────────────────────────────────────────────
    const monthAttempts = input.attempts.filter(a => inMonth(dayOf(a.createdAt)));
    const byPurpose: MonthReport['calls']['byPurpose'] = {
        review: { placed: 0, reached: 0 },
        missed_session: { placed: 0, reached: 0 },
        lab_due: { placed: 0, reached: 0 },
    };
    for (const a of monthAttempts) {
        const b = byPurpose[a.purpose] || byPurpose.review;
        b.placed++;
        if (a.connected) b.reached++;
    }
    const callsReached = monthAttempts.filter(a => a.connected).length;

    // ── Labs ───────────────────────────────────────────────────────────
    const labCalls = monthAttempts.filter(a => a.purpose === 'lab_due');
    const labPatientsReminded = new Map<string, DateKey>();
    for (const a of labCalls) {
        const d = dayOf(a.createdAt);
        const prev = labPatientsReminded.get(a.patientId);
        if (!prev || d < prev) labPatientsReminded.set(a.patientId, d);
    }
    let labDone = 0, labOpen = 0;
    for (const [pid, d] of labPatientsReminded) {
        if (input.labs.some(l => l.patientId === pid && l.doneOn >= d && daysBetween(d, l.doneOn) <= LAB_WINDOW_DAYS)) labDone++;
        else if (addDays(d, LAB_WINDOW_DAYS) > input.asOf) labOpen++;
    }

    // ── Alerts ─────────────────────────────────────────────────────────
    const monthAlerts = input.alerts.filter(a => inMonth(dayOf(a.createdAt)));
    const red = monthAlerts.filter(a => a.kind === 'red_flag');
    const ackMinutes = red
        .filter(a => a.acknowledgedAt)
        .map(a => Math.max(0, Math.round((new Date(a.acknowledgedAt!).getTime() - new Date(a.createdAt).getTime()) / 60000)));

    return {
        from, to,
        sessions: { attended, missed: missedS.length, cancelled, attendanceRate: pct(attended, attended + missedS.length) },
        missed: { total: missedS.length, called, reached, backAfterReached: afterReached, backWithoutCall: withoutCall, tooRecent },
        calls: {
            placed: monthAttempts.length,
            reached: callsReached,
            reachRate: pct(callsReached, monthAttempts.filter(a => a.status !== 'failed').length),
            byPurpose,
            failed: monthAttempts.filter(a => a.status === 'failed').length,
        },
        labs: {
            reminded: labPatientsReminded.size,
            doneWithin14Days: labDone,
            stillOpen: labOpen,
            recorded: input.labs.filter(l => inMonth(l.doneOn)).length,
        },
        alerts: {
            redFlags: red.length,
            callbacks: monthAlerts.filter(a => a.kind === 'callback').length,
            resolved: monthAlerts.filter(a => a.resolvedAt).length,
            stillOpen: monthAlerts.filter(a => !a.resolvedAt && !a.acknowledgedAt).length,
            medianRedFlagAckMinutes: median(ackMinutes),
        },
    };
}

export { pct };

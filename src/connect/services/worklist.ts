/**
 * Load everything the protocol engine needs, and run it.
 *
 * The engine itself (protocol/engine.ts) is pure; this is the only place that
 * fetches for it, so the Today screen and the dashboard can never disagree
 * about who is due — they both call this.
 */
import { buildWorklist, addDays, type WorklistResult } from '../protocol/engine';
import type { Centre } from './centre';
import { fetchPatients, type ConnectPatient } from './patients';
import { fetchActiveReviews, fetchLabs, fetchSessionsSince } from './records';
import { fetchAttemptsSince, type CallAttempt } from './calls';
import { localDateKey } from './db';

export interface WorklistData {
    today: string;
    patients: ConnectPatient[];
    attempts: CallAttempt[];
    result: WorklistResult;
}

export async function loadWorklist(centre: Centre, now = new Date()): Promise<WorklistData> {
    const today = localDateKey(now);
    const sessionsFrom = addDays(today, -Math.max(centre.settings.missedSession.lookbackDays, 14));
    const attemptsFrom = new Date(now.getTime() - 45 * 86_400_000).toISOString();

    const [patients, sessions, labs, reviews, attempts] = await Promise.all([
        fetchPatients(centre.id),
        fetchSessionsSince(centre.id, sessionsFrom),
        fetchLabs(centre.id),
        fetchActiveReviews(centre.id),
        fetchAttemptsSince(centre.id, attemptsFrom),
    ]);

    const result = buildWorklist({
        today,
        now,
        settings: centre.settings,
        patients: patients.map(p => ({
            id: p.id, name: p.name, mrNumber: p.mrNumber, programme: p.programme, dialysisDays: p.dialysisDays,
            phoneE164: p.phoneE164, attenderPhoneE164: p.attenderPhoneE164,
            doNotCall: p.doNotCall, callHold: p.callHold, isDeceased: p.isDeceased, stopped: p.stopped,
        })),
        sessions,
        labs,
        reviews,
        attempts,
    });
    return { today, patients, attempts, result };
}

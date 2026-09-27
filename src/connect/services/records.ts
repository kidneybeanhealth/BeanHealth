/**
 * Attendance and lab records — the facts the protocol engine reasons from.
 *
 * Both are recorded by the centre, because a centre on Connect keeps its own
 * hospital system and BeanHealth sees only what it is told. Marking attendance
 * is the single most important habit for Connect to work: an unmarked session
 * is never treated as missed (see protocol/engine.ts), so without marking there
 * are no missed-session calls at all — which is the safe failure.
 */
import { db, run } from './db';
import type { EngineLab, EngineSession } from '../protocol/engine';

export type SessionStatus = 'attended' | 'missed' | 'cancelled';

export async function fetchSessionsSince(centreId: string, fromDate: string): Promise<EngineSession[]> {
    const rows = await run<any[]>(
        db.from('connect_dialysis_sessions').select('patient_id, session_date, status')
            .eq('hospital_id', centreId).gte('session_date', fromDate).limit(20000),
        'Could not load dialysis sessions'
    );
    return (rows || []).map(r => ({ patientId: r.patient_id, date: r.session_date, status: r.status }));
}

/** Mark one patient-day. Marking again replaces the earlier mark. */
export async function markSession(
    centreId: string, patientId: string, date: string, status: SessionStatus, markedBy: string | null
): Promise<void> {
    await run(
        db.from('connect_dialysis_sessions').upsert(
            { hospital_id: centreId, patient_id: patientId, session_date: date, status, marked_by_name: markedBy },
            { onConflict: 'patient_id,session_date' }
        ),
        'Could not save attendance'
    );
}

/** Undo a mark — back to unmarked, which the engine treats as "unknown". */
export async function clearSession(centreId: string, patientId: string, date: string): Promise<void> {
    await run(
        db.from('connect_dialysis_sessions').delete()
            .eq('hospital_id', centreId).eq('patient_id', patientId).eq('session_date', date),
        'Could not clear attendance'
    );
}

export async function fetchLabs(centreId: string): Promise<EngineLab[]> {
    const rows = await run<any[]>(
        db.from('connect_lab_records').select('patient_id, test_code, done_on')
            .eq('hospital_id', centreId).order('done_on', { ascending: false }).limit(50000),
        'Could not load lab records'
    );
    return (rows || []).map(r => ({ patientId: r.patient_id, testCode: r.test_code, doneOn: r.done_on }));
}

export async function recordLab(centreId: string, patientId: string, testCode: string, doneOn: string): Promise<void> {
    await run(
        db.from('connect_lab_records').upsert(
            { hospital_id: centreId, patient_id: patientId, test_code: testCode, done_on: doneOn },
            { onConflict: 'patient_id,test_code,done_on', ignoreDuplicates: true }
        ),
        'Could not save the lab record'
    );
}

export async function fetchActiveReviews(centreId: string): Promise<{ patientId: string; reviewDate: string }[]> {
    const rows = await run<any[]>(
        db.from('hospital_patient_reviews').select('patient_id, next_review_date')
            .eq('hospital_id', centreId).in('status', ['pending', 'rescheduled'])
            .not('next_review_date', 'is', null).limit(20000),
        'Could not load reviews'
    );
    return (rows || []).map(r => ({ patientId: r.patient_id, reviewDate: r.next_review_date }));
}

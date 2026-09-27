/**
 * Attendance — mark each dialysis session attended, missed, or cancelled.
 *
 * This is the engine's most important input, and its most dangerous one to get
 * wrong. A session nobody marks is "unknown", never "missed" — so forgetting to
 * mark costs a missed-session call, never causes a wrong one. The screen makes
 * marking fast (one tap per patient, "mark the rest attended" for a normal
 * shift) and shows every recent day that still has unmarked sessions.
 *
 * "Cancelled" is the centre calling a session off — machine down, a holiday.
 * It is never held against the patient.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import { fetchPatients, type ConnectPatient } from '../services/patients';
import { clearSession, fetchSessionsSince, markSession, type SessionStatus } from '../services/records';
import { localDateKey } from '../services/db';
import { addDays, isoWeekday, speakDate } from '../protocol/engine';
import { SetupNotice } from '../ui/SetupNotice';
import { Badge, Button, Card, Empty, Modal, Spinner, cx, fmtDays, readOperator } from '../ui/kit';

const STATUS_BTN: { status: SessionStatus; label: string; on: string }[] = [
    { status: 'attended', label: 'Attended', on: 'border-[#5FA01F] bg-[#5FA01F] text-white' },
    { status: 'missed', label: 'Missed', on: 'border-rose-500 bg-rose-500 text-white' },
    { status: 'cancelled', label: 'Centre cancelled', on: 'border-gray-500 bg-gray-500 text-white' },
];

const dayLabel = (k: string, today: string) => {
    if (k === today) return 'Today';
    if (k === addDays(today, -1)) return 'Yesterday';
    return speakDate(k);
};
/** The same day inside a sentence: "today", "yesterday", "on Fri 25 Sep". */
const daySentence = (k: string, today: string) =>
    k === today ? 'today' : k === addDays(today, -1) ? 'yesterday' : `on ${speakDate(k)}`;

const AttendanceScreen: React.FC = () => {
    const centre = useCentre();
    const today = localDateKey();
    const [date, setDate] = useState(today);
    const [patients, setPatients] = useState<ConnectPatient[]>([]);
    const [marks, setMarks] = useState<Map<string, Map<string, SessionStatus>>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);
    const [confirmRest, setConfirmRest] = useState(false);

    const windowStart = addDays(today, -14);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [ps, ss] = await Promise.all([fetchPatients(centre.id), fetchSessionsSince(centre.id, windowStart)]);
            setPatients(ps.filter(p => p.programme === 'dialysis' && !p.isDeceased && !p.stopped));
            const m = new Map<string, Map<string, SessionStatus>>();
            for (const s of ss) {
                if (!m.has(s.date)) m.set(s.date, new Map());
                m.get(s.date)!.set(s.patientId, s.status);
            }
            setMarks(m);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [centre.id, windowStart]);

    useEffect(() => { load(); }, [load]);

    const weekday = isoWeekday(date);
    const dayMarks = marks.get(date) || new Map<string, SessionStatus>();
    const scheduled = useMemo(() => patients.filter(p => p.dialysisDays?.includes(weekday)), [patients, weekday]);
    // Anyone marked on this day shows even if it is not their scheduled day —
    // an extra or swapped session is real and must stay visible once recorded.
    const listed = useMemo(() => {
        if (showAll) return patients;
        const ids = new Set(scheduled.map(p => p.id));
        return patients.filter(p => ids.has(p.id) || dayMarks.has(p.id));
    }, [showAll, patients, scheduled, dayMarks]);
    const unmarkedHere = scheduled.filter(p => !dayMarks.has(p.id));
    const noSchedule = patients.filter(p => !p.dialysisDays?.length).length;

    // Recent days that still have unmarked scheduled sessions — today excluded,
    // the shift may simply not be over.
    const pendingDays = useMemo(() => {
        const out: { date: string; count: number }[] = [];
        for (let k = addDays(today, -1); k >= addDays(today, -centre.settings.missedSession.lookbackDays); k = addDays(k, -1)) {
            const wd = isoWeekday(k);
            const dm = marks.get(k);
            const count = patients.filter(p => p.dialysisDays?.includes(wd) && !dm?.has(p.id)).length;
            if (count) out.push({ date: k, count });
        }
        return out;
    }, [patients, marks, today, centre.settings.missedSession.lookbackDays]);

    const setLocal = (patientId: string, status: SessionStatus | null) => {
        setMarks(prev => {
            const next = new Map(prev);
            const dm = new Map(next.get(date) || []);
            if (status) dm.set(patientId, status); else dm.delete(patientId);
            next.set(date, dm);
            return next;
        });
    };

    const onMark = async (p: ConnectPatient, status: SessionStatus) => {
        const current = dayMarks.get(p.id);
        setBusy(p.id);
        try {
            if (current === status) {
                await clearSession(centre.id, p.id, date);
                setLocal(p.id, null);
            } else {
                await markSession(centre.id, p.id, date, status, readOperator() || null);
                setLocal(p.id, status);
            }
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        } finally {
            setBusy(null);
        }
    };

    const markRestAttended = async () => {
        setConfirmRest(false);
        setBusy('__rest__');
        let done = 0;
        try {
            for (const p of unmarkedHere) {
                await markSession(centre.id, p.id, date, 'attended', readOperator() || null);
                setLocal(p.id, 'attended');
                done++;
            }
            toast.success(`Marked ${done} attended`);
        } catch (e: any) {
            toast.error(`${e?.message || 'Could not save'} — ${done} were marked before it stopped`);
        } finally {
            setBusy(null);
        }
    };

    if (loading && !patients.length) return <Spinner label="Loading attendance…" />;
    if (error) return <SetupNotice error={error} />;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Attendance</h1>
                    <p className="text-sm text-gray-500">Mark each dialysis session. Only sessions marked missed lead to a call.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => setDate(addDays(date, -1))}>← Prev</Button>
                    <input
                        type="date" value={date} max={today}
                        onChange={e => e.target.value && setDate(e.target.value)}
                        className="h-[34px] rounded-xl border border-gray-200 px-2 text-sm"
                    />
                    <Button size="sm" onClick={() => setDate(addDays(date, 1))} disabled={date >= today}>Next →</Button>
                    {date !== today && <Button size="sm" onClick={() => setDate(today)}>Today</Button>}
                </div>
            </div>

            {pendingDays.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-bold text-amber-900">Still to mark</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {pendingDays.map(d => (
                            <button
                                key={d.date} type="button" onClick={() => setDate(d.date)}
                                className={cx('rounded-full border px-2.5 py-1 text-xs font-semibold', d.date === date ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-300 bg-white text-amber-900')}
                            >
                                {dayLabel(d.date, today)} · {d.count}
                            </button>
                        ))}
                    </div>
                </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-gray-800">
                    {dayLabel(date, today)} · {scheduled.length} scheduled
                    {unmarkedHere.length > 0 && <span className="ml-2 font-normal text-gray-500">{unmarkedHere.length} not marked</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-600">
                        <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
                        Show every dialysis patient (extra or swapped sessions)
                    </label>
                    {unmarkedHere.length > 0 && (
                        <Button size="sm" tone="primary" onClick={() => setConfirmRest(true)} disabled={!!busy}>
                            Mark remaining {unmarkedHere.length} attended
                        </Button>
                    )}
                </div>
            </div>

            {patients.length === 0 ? (
                <Empty title="No dialysis patients yet">
                    Set a patient's programme to Dialysis, with their session days, on the Patients tab — or import a list with a Dialysis days column.
                </Empty>
            ) : listed.length === 0 ? (
                <Empty title={`Nobody is scheduled ${daySentence(date, today)}`}>
                    Tick "Show every dialysis patient" to record an extra session.
                </Empty>
            ) : (
                <Card className="divide-y divide-gray-100 overflow-hidden">
                    {listed.map(p => {
                        const current = dayMarks.get(p.id);
                        const offSchedule = !p.dialysisDays?.includes(weekday);
                        return (
                            <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                                <div className="min-w-0 flex-1 basis-48">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                                        {p.mrNumber && <span className="font-mono text-[11px] text-gray-400">{p.mrNumber}</span>}
                                        {offSchedule && <Badge tone="sky">Not their usual day</Badge>}
                                    </div>
                                    <p className="text-[11px] text-gray-500">{fmtDays(p.dialysisDays)}{p.dialysisShift ? ` · ${p.dialysisShift}` : ''}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_BTN.map(b => (
                                        <button
                                            key={b.status} type="button" disabled={busy === p.id || busy === '__rest__'}
                                            onClick={() => onMark(p, b.status)}
                                            aria-pressed={current === b.status}
                                            className={cx(
                                                'min-h-[34px] rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-50',
                                                current === b.status ? b.on : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                                            )}
                                        >
                                            {b.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </Card>
            )}

            {noSchedule > 0 && (
                <p className="text-[11px] text-gray-400">
                    {noSchedule} dialysis patient{noSchedule === 1 ? ' has' : 's have'} no session days set and only appear here with "Show every" ticked. Set their days on the Patients tab.
                </p>
            )}

            <Modal
                open={confirmRest} onClose={() => setConfirmRest(false)} title={`Mark ${unmarkedHere.length} attended?`}
                footer={<><Button onClick={() => setConfirmRest(false)}>Cancel</Button><Button tone="primary" onClick={markRestAttended}>Mark attended</Button></>}
            >
                <p className="text-sm text-gray-600">
                    Everyone scheduled {daySentence(date, today)} who is not marked yet will be marked attended. Mark anyone who did not come as Missed first.
                </p>
                <p className="mt-2 text-xs text-gray-500">{unmarkedHere.map(p => p.name).join(', ')}</p>
            </Modal>
        </div>
    );
};

export default AttendanceScreen;

/**
 * ReceptionActivityPanels — Past Records report views
 * ────────────────────────────────────────────────────
 *  1. WeeklyOverdueReportPanel — week-wise no-show report + activity summary
 *  2. ReceptionCalendarPanel   — month calendar with per-day activity drilldown
 *
 * Both are powered by fetchReceptionActivity (one ranged fetch of
 * visits / calls / due-reviews with names resolved).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
    fetchReceptionActivity,
    ReceptionActivityData,
    ReceptionActivityDue,
} from '../../services/enterpriseReviewService';

/* ─── date helpers (local timezone) ─────────────────────────────── */
const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localDayKey = (iso: string) => dateKey(new Date(iso));
const addDays = (d: Date, n: number) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const mondayOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
    return c;
};
const fmtDM = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtDayLong = (key: string) =>
    new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

/* ─── shared bits ───────────────────────────────────────────────── */
const CALL_STATUS_STYLES: Record<string, string> = {
    picked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    not_picked: 'bg-rose-50 text-rose-700 border-rose-200',
    busy: 'bg-amber-50 text-amber-700 border-amber-200',
    not_reachable: 'bg-gray-100 text-gray-600 border-gray-200',
};
const CALL_STATUS_LABELS: Record<string, string> = {
    picked: 'Picked',
    not_picked: 'Not Picked',
    busy: 'Busy',
    not_reachable: 'Not Reachable',
};

const CallStatusChip: React.FC<{ status: string | null }> = ({ status }) => {
    if (!status) return null;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${CALL_STATUS_STYLES[status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {CALL_STATUS_LABELS[status] || status}
        </span>
    );
};

const StatCard: React.FC<{ label: string; value: React.ReactNode; accent?: string; sub?: React.ReactNode }> = ({ label, value, accent = 'text-gray-900', sub }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black mt-1 ${accent}`}>{value}</p>
        {sub && <div className="mt-1.5 space-y-0.5 text-[11px] text-gray-500 font-medium">{sub}</div>}
    </div>
);

const PanelSpinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
        <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {text}
    </div>
);

const DuePatientRow: React.FC<{ due: ReceptionActivityDue; note?: string }> = ({ due, note }) => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl">
        <span className="text-sm font-bold text-gray-900">{due.patientName}</span>
        {due.mrNumber && <span className="text-[11px] font-mono font-bold text-gray-500">{due.mrNumber}</span>}
        {due.doctorName && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {due.doctorName}
            </span>
        )}
        {due.lastVisitAt && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                Last visit {fmtIsoDM(due.lastVisitAt)}
            </span>
        )}
        {note && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                {note}
            </span>
        )}
        <div className="ml-auto flex items-center gap-2">
            {due.phone && <span className="text-[11px] text-gray-500 font-medium">{due.phone}</span>}
            {due.latestCallStatus
                ? <CallStatusChip status={due.latestCallStatus} />
                : <span className="text-[10px] font-bold text-gray-400 uppercase">Not called</span>}
        </div>
    </div>
);

const fmtIsoDM = (iso: string | null): string =>
    iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '';

/** Narrow hospital-wide activity to a single doctor (doctor dashboard views). */
const scopeActivityToDoctor = (
    data: ReceptionActivityData,
    doctorId?: string | null
): ReceptionActivityData => {
    if (!doctorId) return data;
    return {
        ...data,
        visits: data.visits.filter(v => v.doctorId === doctorId),
        dues: data.dues.filter(d => d.doctorId === doctorId),
        calls: data.calls.filter(c => c.doctorId === doctorId),
    };
};

/* ═══════════════════════════════════════════════════════════════════
 * 1) Weekly Overdue Report
 * ═══════════════════════════════════════════════════════════════════ */
export const WeeklyOverdueReportPanel: React.FC<{ hospitalId: string; doctorId?: string | null }> = ({ hospitalId, doctorId }) => {
    const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(new Date()));
    const [data, setData] = useState<ReceptionActivityData | null>(null);
    const [loading, setLoading] = useState(false);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
    const todayKey = dateKey(new Date());
    const currentWeekStartKey = dateKey(mondayOf(new Date()));
    const isCurrentWeek = dateKey(weekStart) === currentWeekStartKey;

    const load = useCallback(async () => {
        if (!hospitalId) return;
        setLoading(true);
        try {
            const result = await fetchReceptionActivity({
                hospitalId,
                startDate: dateKey(weekStart),
                endDate: dateKey(weekEnd),
            });
            setData(scopeActivityToDoctor(result, doctorId));
        } catch (err) {
            console.error('Weekly report load failed:', err);
            toast.error('Failed to load weekly report');
        } finally {
            setLoading(false);
        }
    }, [hospitalId, weekStart, weekEnd, doctorId]);

    useEffect(() => { load(); }, [load]);

    const summary = useMemo(() => {
        if (!data) return null;
        const { visits, calls, dues } = data;

        const perDoctor = new Map<string, number>();
        for (const v of visits) {
            const name = v.doctorName || 'Unassigned';
            perDoctor.set(name, (perDoctor.get(name) || 0) + 1);
        }

        const uniqueVisitors = new Set(visits.map((v) => v.patientId));
        const newPatientIds = new Set(visits.filter((v) => v.isNewPatient).map((v) => v.patientId));

        // Review funnel — anchored on the due cohort. Primary question:
        // did the patient show up (early / on time / late) or not?
        const showedUp = dues.filter((d) => d.came);
        const showedEarly = showedUp.filter((d) => d.cameEarly).length;
        const showedLate = showedUp.filter((d) => d.cameLate).length;
        const missed = dues.filter((d) => !d.came && d.reviewDate <= todayKey);
        const pendingLater = dues.filter((d) => !d.came && d.reviewDate > todayKey);

        return {
            totalVisits: visits.length,
            completedVisits: visits.filter((v) => v.status === 'completed').length,
            perDoctor: Array.from(perDoctor.entries()).sort((a, b) => b[1] - a[1]),
            admitted: visits.filter((v) => Boolean(v.admissionStatus)).length,
            uniquePatients: uniqueVisitors.size,
            newPatients: newPatientIds.size,
            returningPatients: uniqueVisitors.size - newPatientIds.size,
            callsMade: calls.length,
            callsPicked: calls.filter((c) => c.callStatus === 'picked').length,
            callsNotPicked: calls.filter((c) => c.callStatus && c.callStatus !== 'picked').length,
            dueTotal: dues.length,
            showedUp: showedUp.length,
            showedOnTime: showedUp.length - showedEarly - showedLate,
            showedEarly,
            showedLate,
            showedUpCalled: showedUp.filter((d) => d.wasCalled).length,
            showedUpNotCalled: showedUp.filter((d) => !d.wasCalled).length,
            missedTotal: missed.length,
            missedCalled: missed.filter((d) => d.wasCalled).length,
            missedCalledPicked: missed.filter((d) => d.wasCalled && d.latestCallStatus === 'picked').length,
            missedNeverCalled: missed.filter((d) => !d.wasCalled).length,
            pendingLater: pendingLater.length,
            missed,
        };
    }, [data, todayKey]);

    const missedByDay = useMemo(() => {
        const map = new Map<string, ReceptionActivityDue[]>();
        if (!summary) return map;
        for (const d of summary.missed) {
            if (!map.has(d.reviewDate)) map.set(d.reviewDate, []);
            map.get(d.reviewDate)!.push(d);
        }
        return new Map(Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])));
    }, [summary]);

    const toggleDay = (key: string) => setExpandedDays((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
    });

    return (
        <div className="p-4 sm:p-6 space-y-5">
            {/* Week navigation */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    onClick={() => setWeekStart((w) => addDays(w, -7))}
                    className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold"
                >
                    ‹
                </button>
                <div className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200">
                    <p className="text-sm font-bold text-orange-800">
                        Week: {fmtDM(weekStart)} – {fmtDM(weekEnd)}{isCurrentWeek ? ' (this week)' : ''}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setWeekStart((w) => addDays(w, 7))}
                    disabled={isCurrentWeek}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center font-bold ${isCurrentWeek ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed' : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}`}
                >
                    ›
                </button>
                {summary && !loading && (
                    <span className="ml-auto text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                        {summary.missedTotal} missed follow-up{summary.missedTotal === 1 ? '' : 's'} this week
                    </span>
                )}
            </div>

            {loading ? (
                <PanelSpinner text="Building weekly report…" />
            ) : !summary ? (
                <PanelSpinner text="No data" />
            ) : (
                <>
                    {/* General activity */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatCard
                            label="Total Visits"
                            value={summary.totalVisits}
                            sub={summary.perDoctor.map(([name, count]) => (
                                <p key={name}>{name}: <span className="font-bold text-gray-700">{count}</span></p>
                            ))}
                        />
                        <StatCard
                            label="Patients"
                            value={summary.uniquePatients}
                            sub={<>
                                <p>New: <span className="font-bold text-emerald-700">{summary.newPatients}</span></p>
                                <p>Returning: <span className="font-bold text-gray-700">{summary.returningPatients}</span></p>
                            </>}
                        />
                        <StatCard label="Admitted" value={summary.admitted} accent="text-rose-600" />
                        <StatCard
                            label="Calls Made"
                            value={summary.callsMade}
                            sub={<p>Picked: <span className="font-bold text-emerald-700">{summary.callsPicked}</span> · Not picked: <span className="font-bold text-rose-600">{summary.callsNotPicked}</span></p>}
                        />
                    </div>

                    {/* Review funnel — the primary question: did they show up? */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Review Follow-up — did they show up?</p>
                            {summary.pendingLater > 0 && (
                                <span className="text-[10px] font-bold text-gray-400">+{summary.pendingLater} due later this week (not counted yet)</span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Due this week</p>
                                <p className="text-3xl font-black text-gray-900 mt-0.5">{summary.dueTotal}</p>
                            </div>
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Showed Up</p>
                                <p className="text-3xl font-black text-emerald-700 mt-0.5">{summary.showedUp}</p>
                                <p className="text-[11px] text-gray-600 font-medium mt-1">
                                    On time <span className="font-bold">{summary.showedOnTime}</span> · Early <span className="font-bold text-sky-700">{summary.showedEarly}</span> · Late <span className="font-bold text-amber-700">{summary.showedLate}</span>
                                </p>
                                <p className="text-[11px] text-gray-500 font-medium">
                                    Called <span className="font-bold">{summary.showedUpCalled}</span> · Not called <span className="font-bold">{summary.showedUpNotCalled}</span>
                                </p>
                            </div>
                            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5">
                                <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">Did Not Show</p>
                                <p className="text-3xl font-black text-rose-600 mt-0.5">{summary.missedTotal}</p>
                                <p className="text-[11px] text-gray-600 font-medium mt-1">
                                    Called <span className="font-bold">{summary.missedCalled}</span> (picked {summary.missedCalledPicked}) · Never called <span className="font-bold">{summary.missedNeverCalled}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Day-wise missed list */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Missed follow-ups — day wise</h4>
                            {missedByDay.size > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setExpandedDays(expandedDays.size === missedByDay.size ? new Set() : new Set(missedByDay.keys()))}
                                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700"
                                >
                                    {expandedDays.size === missedByDay.size ? 'Collapse all' : 'Expand all'}
                                </button>
                            )}
                        </div>

                        {missedByDay.size === 0 ? (
                            <div className="text-sm text-gray-400 font-medium bg-gray-50 border border-gray-100 rounded-xl px-4 py-6 text-center">
                                No missed follow-ups {isCurrentWeek ? 'so far this week' : 'this week'} 🎉
                            </div>
                        ) : (
                            Array.from(missedByDay.entries()).map(([day, patients]) => {
                                const isOpen = expandedDays.has(day);
                                const isToday = day === todayKey;
                                return (
                                    <div key={day} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                        <button
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="text-sm font-bold text-gray-900">{fmtDayLong(day)}</span>
                                            {isToday && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                                                    Today — not arrived yet
                                                </span>
                                            )}
                                            <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                                {patients.length} missed
                                            </span>
                                            <svg className={`w-4 h-4 text-gray-400 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isOpen && (
                                            <div className="px-4 pb-4 space-y-2 bg-gray-50/60 border-t border-gray-100 pt-3">
                                                {patients.map((p, i) => <DuePatientRow key={`${p.patientId}-${i}`} due={p} />)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════════
 * 2) Calendar — per-day activity drilldown
 * ═══════════════════════════════════════════════════════════════════ */
export const ReceptionCalendarPanel: React.FC<{ hospitalId: string; doctorId?: string | null }> = ({ hospitalId, doctorId }) => {
    const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
        const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
    });
    const [selectedDay, setSelectedDay] = useState<string>(() => dateKey(new Date()));
    const [data, setData] = useState<ReceptionActivityData | null>(null);
    const [loading, setLoading] = useState(false);

    const todayKey = dateKey(new Date());
    const monthEnd = useMemo(() => {
        const d = new Date(monthAnchor); d.setMonth(d.getMonth() + 1); d.setDate(0); return d;
    }, [monthAnchor]);

    const load = useCallback(async () => {
        if (!hospitalId) return;
        setLoading(true);
        try {
            const result = await fetchReceptionActivity({
                hospitalId,
                startDate: dateKey(monthAnchor),
                endDate: dateKey(monthEnd),
            });
            setData(scopeActivityToDoctor(result, doctorId));
        } catch (err) {
            console.error('Calendar load failed:', err);
            toast.error('Failed to load calendar data');
        } finally {
            setLoading(false);
        }
    }, [hospitalId, monthAnchor, monthEnd, doctorId]);

    useEffect(() => { load(); }, [load]);

    /* Per-day aggregates for calendar badges */
    const dayStats = useMemo(() => {
        const map = new Map<string, { visits: number; missed: number; due: number; calls: number }>();
        if (!data) return map;
        const ensure = (key: string) => {
            if (!map.has(key)) map.set(key, { visits: 0, missed: 0, due: 0, calls: 0 });
            return map.get(key)!;
        };
        for (const v of data.visits) ensure(localDayKey(v.createdAt)).visits += 1;
        for (const c of data.calls) ensure(localDayKey(c.calledAt)).calls += 1;
        for (const d of data.dues) {
            const stat = ensure(d.reviewDate);
            stat.due += 1;
            if (!d.came && d.reviewDate <= todayKey) stat.missed += 1;
        }
        return map;
    }, [data, todayKey]);

    /* Selected-day detail */
    const dayDetail = useMemo(() => {
        if (!data || !selectedDay) return null;
        const visits = data.visits.filter((v) => localDayKey(v.createdAt) === selectedDay);
        const calls = data.calls.filter((c) => localDayKey(c.calledAt) === selectedDay);
        const dues = data.dues.filter((d) => d.reviewDate === selectedDay);

        const perDoctor = new Map<string, typeof visits>();
        for (const v of visits) {
            const name = v.doctorName || 'Unassigned';
            if (!perDoctor.has(name)) perDoctor.set(name, []);
            perDoctor.get(name)!.push(v);
        }

        return {
            visits,
            perDoctor: Array.from(perDoctor.entries()).sort((a, b) => b[1].length - a[1].length),
            admitted: visits.filter((v) => Boolean(v.admissionStatus)),
            calls,
            duesCame: dues.filter((d) => d.came && !d.cameEarly && !d.cameLate),
            duesCameEarly: dues.filter((d) => d.cameEarly),
            duesCameLate: dues.filter((d) => d.cameLate),
            duesMissed: dues.filter((d) => !d.came),
            isFuture: selectedDay > todayKey,
        };
    }, [data, selectedDay, todayKey]);

    /* Calendar grid cells (Monday-first) */
    const gridCells = useMemo(() => {
        const cells: (string | null)[] = [];
        const leading = (monthAnchor.getDay() + 6) % 7;
        for (let i = 0; i < leading; i++) cells.push(null);
        for (let day = 1; day <= monthEnd.getDate(); day++) {
            cells.push(dateKey(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), day)));
        }
        return cells;
    }, [monthAnchor, monthEnd]);

    const monthLabel = monthAnchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return (
        <div className="p-4 sm:p-6 space-y-5">
            {/* Month navigation */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => setMonthAnchor((m) => { const c = new Date(m); c.setMonth(c.getMonth() - 1); return c; })}
                    className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold"
                >
                    ‹
                </button>
                <div className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200">
                    <p className="text-sm font-bold text-orange-800">{monthLabel}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setMonthAnchor((m) => { const c = new Date(m); c.setMonth(c.getMonth() + 1); return c; })}
                    className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold"
                >
                    ›
                </button>
                {loading && (
                    <span className="ml-auto text-xs text-gray-400 font-medium flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Loading…
                    </span>
                )}
            </div>

            {/* Calendar grid */}
            <div className="bg-white border border-gray-200 rounded-2xl p-3 sm:p-4">
                <div className="grid grid-cols-7 gap-1.5 mb-1.5">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                        <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                    {gridCells.map((key, idx) => {
                        if (!key) return <div key={`blank-${idx}`} />;
                        const stat = dayStats.get(key);
                        const isSelected = key === selectedDay;
                        const isToday = key === todayKey;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setSelectedDay(key)}
                                className={`min-h-[58px] sm:min-h-[64px] rounded-xl border p-1.5 flex flex-col items-center justify-start transition-all ${
                                    isSelected
                                        ? 'border-orange-400 bg-orange-50 ring-2 ring-orange-200'
                                        : isToday
                                            ? 'border-orange-200 bg-orange-50/50 hover:border-orange-300'
                                            : 'border-gray-100 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                                }`}
                            >
                                <span className={`text-xs font-bold ${isSelected || isToday ? 'text-orange-700' : 'text-gray-700'}`}>
                                    {Number(key.slice(-2))}
                                </span>
                                <div className="flex flex-wrap items-center justify-center gap-1 mt-1">
                                    {stat && stat.visits > 0 && (
                                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1 leading-tight">
                                            {stat.visits}
                                        </span>
                                    )}
                                    {stat && stat.missed > 0 && (
                                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded px-1 leading-tight">
                                            {stat.missed}
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center gap-4 mt-3 px-1">
                    <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200 inline-block" /> visits
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded bg-rose-100 border border-rose-200 inline-block" /> missed follow-ups
                    </span>
                </div>
            </div>

            {/* Day detail */}
            {dayDetail && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900">{fmtDayLong(selectedDay)}</h4>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                            {dayDetail.visits.length} visit{dayDetail.visits.length === 1 ? '' : 's'}
                        </span>
                        {dayDetail.admitted.length > 0 && (
                            <span className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                {dayDetail.admitted.length} admitted
                            </span>
                        )}
                        <span className="text-[11px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                            {dayDetail.calls.length} call{dayDetail.calls.length === 1 ? '' : 's'}
                        </span>
                    </div>

                    {/* Visits per doctor */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Patients Visited — by doctor</p>
                            {dayDetail.perDoctor.length === 0 ? (
                                <p className="text-sm text-gray-400 font-medium">No visits on this day.</p>
                            ) : dayDetail.perDoctor.map(([doctorName, rows]) => (
                                <div key={doctorName}>
                                    <p className="text-xs font-bold text-indigo-700 mb-1.5">{doctorName} <span className="text-gray-400">({rows.length})</span></p>
                                    <div className="space-y-1.5">
                                        {rows.map((v) => (
                                            <div key={v.queueId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                                                {v.tokenNumber && <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{v.tokenNumber}</span>}
                                                <span className="text-xs font-bold text-gray-900">{v.patientName}</span>
                                                {v.mrNumber && <span className="text-[10px] font-mono font-bold text-gray-500">{v.mrNumber}</span>}
                                                <div className="ml-auto flex items-center gap-1.5">
                                                    {v.isNewPatient && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">New</span>
                                                    )}
                                                    {v.admissionStatus && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase">
                                                            {v.admissionStatus === 'admitted' ? 'Admitted' : v.admissionStatus === 'deceased' ? 'Deceased' : 'Discharged'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Calls + due lists */}
                        <div className="space-y-4">
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calls Made</p>
                                {dayDetail.calls.length === 0 ? (
                                    <p className="text-sm text-gray-400 font-medium">No follow-up calls on this day.</p>
                                ) : dayDetail.calls.map((c) => (
                                    <div key={c.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                                        <span className="text-xs font-bold text-gray-900">{c.patientName}</span>
                                        {c.mrNumber && <span className="text-[10px] font-mono font-bold text-gray-500">{c.mrNumber}</span>}
                                        <span className="text-[10px] text-gray-400 font-medium">{fmtTime(c.calledAt)}</span>
                                        <div className="ml-auto flex items-center gap-1.5">
                                            <CallStatusChip status={c.callStatus} />
                                            {c.visitedAfter && (
                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    ✓ Visited later
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                    Due on this day {dayDetail.isFuture && <span className="text-orange-500">(scheduled)</span>}
                                </p>
                                {dayDetail.duesCame.length === 0 && dayDetail.duesCameEarly.length === 0 && dayDetail.duesCameLate.length === 0 && dayDetail.duesMissed.length === 0 ? (
                                    <p className="text-sm text-gray-400 font-medium">No reviews were due on this day.</p>
                                ) : (
                                    <>
                                        {dayDetail.duesCame.length > 0 && (
                                            <div>
                                                <p className="text-[11px] font-bold text-emerald-700 mb-1.5">✓ Came on time ({dayDetail.duesCame.length})</p>
                                                <div className="space-y-1.5">
                                                    {dayDetail.duesCame.map((d, i) => <DuePatientRow key={`${d.patientId}-c-${i}`} due={d} />)}
                                                </div>
                                            </div>
                                        )}
                                        {dayDetail.duesCameEarly.length > 0 && (
                                            <div>
                                                <p className="text-[11px] font-bold text-sky-700 mb-1.5">⏩ Came early ({dayDetail.duesCameEarly.length})</p>
                                                <div className="space-y-1.5">
                                                    {dayDetail.duesCameEarly.map((d, i) => (
                                                        <DuePatientRow
                                                            key={`${d.patientId}-e-${i}`}
                                                            due={d}
                                                            note={d.attendedDate ? `Visited ${fmtIsoDM(d.attendedDate)}` : 'Visited early'}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {dayDetail.duesCameLate.length > 0 && (
                                            <div>
                                                <p className="text-[11px] font-bold text-amber-700 mb-1.5">⏰ Came late ({dayDetail.duesCameLate.length})</p>
                                                <div className="space-y-1.5">
                                                    {dayDetail.duesCameLate.map((d, i) => (
                                                        <DuePatientRow
                                                            key={`${d.patientId}-l-${i}`}
                                                            due={d}
                                                            note={d.attendedDate ? `Visited ${fmtIsoDM(d.attendedDate)}` : 'Visited late'}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {dayDetail.duesMissed.length > 0 && (
                                            <div>
                                                <p className="text-[11px] font-bold text-rose-600 mb-1.5">
                                                    {dayDetail.isFuture ? `Scheduled (${dayDetail.duesMissed.length})` : `✗ Didn't show (${dayDetail.duesMissed.length})`}
                                                </p>
                                                <div className="space-y-1.5">
                                                    {dayDetail.duesMissed.map((d, i) => <DuePatientRow key={`${d.patientId}-m-${i}`} due={d} />)}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * DialysisRegisterPanel — the Dialysis view inside Past Records
 *
 * Dialysis patients sit outside the OP queue, so before this they existed in
 * Past Records only as ordinary-looking rows inside All, with nothing marking
 * them and no chip that could gather them. This is the surface that answers
 * "who is on dialysis" and "how many came this month".
 *
 * One row per patient with a session count, expandable to the individual dates.
 * It is a register, not a review list: a patient appears here because they
 * attended, never because something is due. Their review state is deliberately
 * absent — that question belongs to the Due Today / Missed Followup chips.
 *
 * Rendered like WeeklyOverdueReportPanel and ReceptionCalendarPanel: a separate
 * panel selected by a Past Records chip, so `enterpriseReviewService` and its
 * load-bearing candidate resolution are untouched.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    fetchDialysisRegister,
    localDateKey,
    type DialysisPatientRow,
    type DialysisRegister,
} from '../../services/dialysisRegisterService';
import { buildDialysisRegisterHtml } from './dialysisRegisterPrint';

type Period = 'week' | 'month' | 'year' | 'all' | 'custom';

const PERIODS: { key: Period; label: string }[] = [
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
    { key: 'year', label: 'This year' },
    { key: 'all', label: 'All time' },
    { key: 'custom', label: 'Custom' },
];

const mondayOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
    return c;
};

/** Clinic-local bounds for a period. Undefined bounds mean "all time". */
const resolveRange = (period: Period, customFrom: string, customTo: string): { from?: string; to?: string } => {
    const now = new Date();
    const today = localDateKey(now);
    if (period === 'week') return { from: localDateKey(mondayOf(now)), to: today };
    if (period === 'month') return { from: localDateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    if (period === 'year') return { from: localDateKey(new Date(now.getFullYear(), 0, 1)), to: today };
    if (period === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    return {};
};

const fmtDay = (iso: string | null): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
const fmtShort = (iso: string): string =>
    new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
const fmtRangeLabel = (period: Period, from?: string, to?: string): string => {
    if (period === 'all') return 'All time';
    if (!from && !to) return 'All time';
    const label = PERIODS.find(p => p.key === period)?.label || '';
    if (period === 'custom') return `${fmtDay(from ? `${from}T00:00:00` : null)} to ${fmtDay(to ? `${to}T00:00:00` : null)}`;
    return `${label} · ${fmtDay(from ? `${from}T00:00:00` : null)} to ${fmtDay(to ? `${to}T00:00:00` : null)}`;
};

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
    <div className="px-4 py-3 rounded-xl bg-white border border-gray-200 min-w-[120px]">
        <div className="text-2xl font-bold text-gray-900 leading-none">{value}</div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mt-1.5">{label}</div>
        {hint && <div className="text-[10px] text-gray-400 mt-0.5">{hint}</div>}
    </div>
);

interface Props {
    hospitalId: string;
    orgLabel?: string;
    /**
     * Open this patient's prescriptions. Passed in rather than rendered here so
     * each dashboard uses its own Rx viewer: reception gets view and download,
     * the doctor additionally gets edit and resend to pharmacy. A dialysis Rx is
     * an ordinary hospital_prescriptions row, so both viewers already handle it —
     * it was simply unreachable from this register.
     */
    onViewRx?: (patient: DialysisPatientRow) => void;
}

const DialysisRegisterPanel: React.FC<Props> = ({ hospitalId, orgLabel = 'Hospital', onViewRx }) => {
    const [period, setPeriod] = useState<Period>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [search, setSearch] = useState('');
    const [data, setData] = useState<DialysisRegister | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadedAt, setLoadedAt] = useState<number | null>(null);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    const range = useMemo(
        () => resolveRange(period, customFrom, customTo),
        [period, customFrom, customTo]
    );

    const load = useCallback(async () => {
        if (!hospitalId) return;
        // A half-typed custom range would query a nonsense window on every keystroke.
        if (period === 'custom' && !(customFrom && customTo)) { setLoading(false); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await fetchDialysisRegister({ hospitalId, from: range.from, to: range.to });
            setData(res);
            setLoadedAt(Date.now());
        } catch (e: any) {
            setError(e?.message || 'Could not load the dialysis register');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [hospitalId, range.from, range.to, period, customFrom, customTo]);

    useEffect(() => { load(); }, [load]);

    // Search filters what is already loaded. Refetching per keystroke would re-run
    // three queries for a list the browser already holds — the same mistake the
    // campaign cohort search made.
    const visible: DialysisPatientRow[] = useMemo(() => {
        const rows = data?.patients || [];
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter(p =>
            (p.name || '').toLowerCase().includes(q) || (p.mrNumber || '').toLowerCase().includes(q)
        );
    }, [data, search]);

    const toggle = (id: string) => setExpanded(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    const printRegister = () => {
        if (!data || visible.length === 0) { toast.error('Nothing to print'); return; }
        const w = window.open('', '_blank', 'width=1200,height=800');
        if (!w) { toast.error('Pop-up blocked — allow pop-ups to print'); return; }
        const sessions = visible.reduce((n, p) => n + p.sessionCount, 0);
        w.document.open();
        w.document.write(buildDialysisRegisterHtml({
            patients: visible,
            orgLabel,
            periodLabel: fmtRangeLabel(period, range.from, range.to),
            totalSessions: sessions,
            totalPatients: visible.length,
            includeDates: true,
        }));
        w.document.close();
    };

    const shownSessions = visible.reduce((n, p) => n + p.sessionCount, 0);

    return (
        <div className="p-4 sm:p-5 bg-gray-50/60">
            {/* Controls */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => setPeriod(p.key)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border transition-colors ${
                            period === p.key
                                ? 'bg-orange-50 text-orange-700 border-orange-300'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
                {period === 'custom' && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                        <span className="text-gray-400">to</span>
                        <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm bg-white" />
                    </div>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <button type="button" onClick={printRegister}
                        className="px-4 py-2 rounded-xl text-sm font-bold border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100">
                        Print register
                    </button>
                </div>
            </div>

            {/* Totals */}
            <div className="flex flex-wrap items-stretch gap-3 mb-4">
                <Stat label="Patients" value={loading ? '—' : (data?.totalPatients ?? 0)} />
                <Stat label="Sessions" value={loading ? '—' : (data?.totalSessions ?? 0)} hint="one prescription = one session" />
                <Stat label="Attendance days" value={loading ? '—' : (data?.totalDays ?? 0)} hint="distinct patient-days" />
                <div className="flex-1 min-w-[220px] flex flex-col justify-center">
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name or MR number…"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                    <div className="text-[11px] text-gray-400 mt-1.5 px-1">
                        {fmtRangeLabel(period, range.from, range.to)}
                        {loadedAt && (
                            <>
                                {' · as of '}
                                {new Date(loadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}{' '}
                                <button type="button" onClick={load} className="font-semibold text-orange-600 hover:underline">Refresh</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            {error ? (
                <div className="p-10 text-center bg-white rounded-2xl border border-rose-200">
                    <p className="text-rose-700 font-semibold text-sm">{error}</p>
                    <button type="button" onClick={load} className="mt-3 px-4 py-2 rounded-xl text-sm font-bold bg-rose-50 text-rose-700 border border-rose-200">Try again</button>
                </div>
            ) : loading ? (
                <div className="p-16 text-center text-gray-400 text-sm bg-white rounded-2xl border border-gray-200">Loading the register…</div>
            ) : period === 'custom' && !(customFrom && customTo) ? (
                <div className="p-16 text-center text-gray-500 text-sm bg-white rounded-2xl border border-dashed border-gray-300">
                    Pick a start and end date.
                </div>
            ) : visible.length === 0 ? (
                <div className="p-16 text-center bg-white rounded-2xl border border-dashed border-gray-300">
                    <p className="text-gray-700 font-medium">No dialysis sessions in this period</p>
                    <p className="text-gray-400 text-sm mt-1">
                        A session appears here when a doctor sends a Dialysis Rx for the patient.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[11px] font-bold uppercase tracking-wide text-gray-500 flex items-center justify-between">
                        <span>{visible.length} patients · {shownSessions} sessions</span>
                        <span className="hidden sm:inline">Tap a row for session dates</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {visible.map((p, i) => {
                            const open = expanded.has(p.id);
                            return (
                                <div key={p.id}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(p.id)}
                                        aria-expanded={open}
                                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-orange-50/40 transition-colors"
                                    >
                                        <span className="w-7 shrink-0 text-xs font-bold text-gray-400 text-center">{i + 1}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-semibold text-gray-900 truncate">
                                                {p.name}
                                                {p.isDeceased && (
                                                    <span className="ml-2 text-[10px] font-bold uppercase text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">Deceased</span>
                                                )}
                                            </span>
                                            <span className="block text-xs text-gray-500 mt-0.5">
                                                {p.mrNumber || 'No MR'}
                                                {p.age ? ` · ${p.age}y` : ''}
                                                {p.gender ? ` · ${p.gender}` : ''}
                                            </span>
                                        </span>
                                        <span className="hidden sm:block text-right text-xs text-gray-500 w-32 shrink-0">
                                            <span className="block">First {fmtShort(p.firstSessionAt || '')}</span>
                                            <span className="block">Last {fmtShort(p.lastSessionAt || '')}</span>
                                        </span>
                                        <span className="text-right shrink-0 w-20">
                                            <span className="block text-lg font-bold text-gray-900 leading-none">{p.sessionCount}</span>
                                            <span className="block text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">sessions</span>
                                        </span>
                                        {onViewRx && (
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                title="Open this patient's prescriptions"
                                                onClick={(e) => { e.stopPropagation(); onViewRx(p); }}
                                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onViewRx(p); } }}
                                                className="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 cursor-pointer"
                                            >
                                                View Rx
                                            </span>
                                        )}
                                        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {open && (
                                        <div className="px-4 pb-4 pt-1 bg-gray-50/70 border-t border-gray-100">
                                            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">
                                                {p.sessionCount} sessions on {p.dayCount} days
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {p.sessions.slice().reverse().map(s => (
                                                    <span
                                                        key={s.id}
                                                        title={`${new Date(s.createdAt).toLocaleString('en-IN')}${s.doctorName ? ` · ${s.doctorName}` : ''}${s.status ? ` · ${s.status}` : ''}`}
                                                        className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold border ${
                                                            s.status === 'cancelled'
                                                                ? 'bg-white text-gray-400 border-gray-200 line-through'
                                                                : 'bg-white text-gray-700 border-gray-300'
                                                        }`}
                                                    >
                                                        {fmtShort(s.createdAt)}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-2 leading-4">
                                                A struck-through date was superseded at the pharmacy by a later prescription.
                                                The patient still attended, so it is counted.
                                                {onViewRx && ' Use View Rx to open, download or resend the prescription itself.'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DialysisRegisterPanel;

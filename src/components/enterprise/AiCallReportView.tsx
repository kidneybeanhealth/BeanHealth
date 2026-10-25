/**
 * AiCallReportView — the AI follow-up call report, on screen and on paper
 *
 * Opens over the campaign in the same tab (a pop-up was easy to lose and could
 * be blocked) and prints from there: the print styles hide the app and keep only
 * this report, so the screen and the PDF are the same document.
 *
 * Read top to bottom the way a doctor reviews a call round: the headline
 * numbers, why patients missed, how old and new patients compare, then the
 * patients themselves, most urgent first (see `summarizeReport`).
 */
import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    summarizeReport, formatCallDuration, REPORT_GROUPS,
    type AiCallReportInput, type AiCallReportRow, type ReportGroup, type ReportTotals,
} from './aiCallReport';

interface Props {
    calls: AiCallReportInput[];
    hospitalName: string;
    title: string;
    periodLabel: string;
    totals?: ReportTotals;
    onDownloadCsv: () => void;
    onClose: () => void;
}

const GROUP_STYLE: Record<ReportGroup, { bar: string; pill: string; heading: string; border: string }> = {
    action: { bar: 'bg-red-500', pill: 'bg-red-50 text-red-800 border-red-200', heading: 'text-red-800', border: 'border-red-200' },
    coming: { bar: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-800 border-emerald-200', heading: 'text-emerald-800', border: 'border-emerald-200' },
    other: { bar: 'bg-sky-500', pill: 'bg-sky-50 text-sky-800 border-sky-200', heading: 'text-sky-800', border: 'border-sky-200' },
    unreached: { bar: 'bg-gray-400', pill: 'bg-gray-100 text-gray-700 border-gray-200', heading: 'text-gray-700', border: 'border-gray-200' },
};

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 12mm; }
  html, body { background: #fff !important; height: auto !important; overflow: visible !important; }
  body > *:not(#ai-call-report) { display: none !important; }
  #ai-call-report { position: static !important; inset: auto !important; overflow: visible !important; height: auto !important; background: #fff !important; }
  #ai-call-report .print-cols { grid-template-columns: 1.1fr 1.3fr 2fr !important; }
  #ai-call-report .no-print { display: none !important; }
  #ai-call-report .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  #ai-call-report * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const Stat: React.FC<{ label: string; value: string; note?: string; tone?: string }> = ({ label, value, note, tone = 'text-gray-900' }) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 avoid-break">
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
        <p className={`text-2xl font-bold tabular-nums mt-0.5 ${tone}`}>{value}</p>
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
);

const PatientCard: React.FC<{ row: AiCallReportRow; index: number }> = ({ row, index }) => {
    const style = GROUP_STYLE[row.group];
    return (
        <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1.3fr_2fr] print-cols gap-x-5 gap-y-2 px-4 py-3 border-t border-gray-100 avoid-break">
            <div className="min-w-0">
                <p className="font-bold text-gray-900 text-sm break-words">
                    <span className="text-gray-400 font-semibold mr-1.5">{index}.</span>{row.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {row.mrNumber || '—'}
                    {row.patientType && (
                        <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${row.patientType === 'New' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                            {row.patientType}
                        </span>
                    )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                    {row.calledAt}{row.duration ? ` · ${row.duration}` : ''}{row.attempts ? ` · ${row.attempts}` : ''}
                </p>
                {row.spokeTo && <p className="text-xs text-gray-500">Spoke to {row.spokeTo.toLowerCase()}</p>}
            </div>
            <div className="min-w-0 space-y-1.5">
                {row.outcome && (
                    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${style.pill}`}>{row.outcome}</span>
                )}
                {(row.reasonLabel || row.reasonText) && (
                    <p className="text-sm text-gray-800 leading-snug">
                        {row.reasonLabel && <span className="font-semibold text-amber-800">{row.reasonLabel}. </span>}
                        {row.reasonText}
                    </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                    {row.redFlag && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">Red flag: call back today</span>}
                    {row.callback && row.outcome !== 'Asked for a call back' && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">Asked for a call back</span>}
                    {row.preferredDay && <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">Will come: {row.preferredDay}</span>}
                </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed min-w-0">{row.summary || <span className="text-gray-400">No account recorded.</span>}</p>
        </div>
    );
};

const AiCallReportView: React.FC<Props> = ({ calls, hospitalName, title, periodLabel, totals, onDownloadCsv, onClose }) => {
    const r = useMemo(() => summarizeReport(calls, totals), [calls, totals]);
    const generated = useMemo(() => new Date().toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
    }), []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
    }, [onClose]);

    const reasonMax = Math.max(1, ...r.reasons.map(([, n]) => n));

    return createPortal(
        <div id="ai-call-report" className="fixed inset-0 z-[100] overflow-y-auto bg-gray-50 text-gray-900" role="dialog" aria-modal="true" aria-label={title}>
            <style>{PRINT_CSS}</style>

            <div className="no-print sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-200">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2">
                    <p className="font-bold text-gray-900 mr-auto">{title}</p>
                    <button type="button" onClick={() => window.print()}
                        className="px-3 py-2 rounded-lg text-sm font-bold text-white bg-violet-600 hover:bg-violet-700">
                        Print / Save as PDF
                    </button>
                    <button type="button" onClick={onDownloadCsv}
                        className="px-3 py-2 rounded-lg text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                        Download for Excel
                    </button>
                    <button type="button" onClick={onClose}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
                <header className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-gray-900 pb-3">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-violet-700">{title}</p>
                        <h1 className="text-2xl font-bold text-gray-900 mt-0.5">{hospitalName || 'Hospital'}</h1>
                        <p className="text-sm text-gray-600">{periodLabel}</p>
                    </div>
                    <p className="text-xs text-gray-500">Generated {generated} · BeanHealth</p>
                </header>

                {/* Headline numbers */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="Patients called" value={String(r.patients)}
                        note={r.callsPlaced !== r.patients ? `${r.callsPlaced} calls placed` : `${r.callsPlaced} calls`} />
                    <Stat label="Reached" value={String(r.answered)} note={`${pct(r.answered, r.patients)} of patients`} tone="text-emerald-700" />
                    <Stat label="Will come" value={String(r.coming)} note={`${pct(r.coming, r.answered)} of those reached`} tone="text-emerald-700" />
                    <Stat label="Needs action" value={String(r.action)} note={`${r.wontCome} will not come`} tone={r.action ? 'text-red-700' : 'text-gray-900'} />
                    <Stat label="Not reached" value={String(r.unreached)} note="no conversation" tone="text-gray-700" />
                    <Stat label="Call time" value={r.timedCalls ? formatCallDuration(r.callSeconds) : '—'}
                        note={r.timedCalls ? (r.timedCalls < r.callsPlaced ? `${r.timedCalls} of ${r.callsPlaced} calls timed` : 'all calls timed') : 'not reported'} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* Outcome overview */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4 avoid-break">
                        <p className="text-sm font-bold text-gray-900 mb-3">How the calls ended</p>
                        <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" aria-hidden="true">
                            {REPORT_GROUPS.map((g) => {
                                const n = r.groups[g.key].length;
                                if (!n) return null;
                                return <div key={g.key} className={GROUP_STYLE[g.key].bar} style={{ width: `${(n / Math.max(1, r.patients)) * 100}%` }} />;
                            })}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-sm">
                            {REPORT_GROUPS.map((g) => (
                                <li key={g.key} className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-sm ${GROUP_STYLE[g.key].bar}`} />
                                    <span className="text-gray-700">{g.title}</span>
                                    <span className="ml-auto font-bold tabular-nums">{r.groups[g.key].length}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Why they missed */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4 avoid-break">
                        <p className="text-sm font-bold text-gray-900 mb-3">Why they missed their review</p>
                        {r.reasons.length === 0 ? (
                            <p className="text-sm text-gray-400">No reasons given yet.</p>
                        ) : (
                            <ul className="space-y-2">
                                {r.reasons.map(([label, n]) => (
                                    <li key={label}>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-700">{label}</span>
                                            <span className="font-bold tabular-nums">{n}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-gray-100 mt-1">
                                            <div className="h-1.5 rounded-full bg-amber-500" style={{ width: `${(n / reasonMax) * 100}%` }} />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Old vs new */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4 avoid-break">
                        <p className="text-sm font-bold text-gray-900 mb-3">Old and new patients</p>
                        <table className="w-full text-sm tabular-nums">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-wide text-gray-500">
                                    <th className="text-left font-bold pb-1.5"></th>
                                    <th className="text-right font-bold pb-1.5">Called</th>
                                    <th className="text-right font-bold pb-1.5">Reached</th>
                                    <th className="text-right font-bold pb-1.5">Will come</th>
                                    <th className="text-right font-bold pb-1.5">Not reached</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(['Old', 'New'] as const).map((t) => (
                                    <tr key={t} className="border-t border-gray-100">
                                        <td className="py-1.5 font-semibold">{t}</td>
                                        <td className="py-1.5 text-right">{r.byType[t].called}</td>
                                        <td className="py-1.5 text-right">{r.byType[t].answered}</td>
                                        <td className="py-1.5 text-right">{r.byType[t].coming}</td>
                                        <td className="py-1.5 text-right">{r.byType[t].unreached}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="text-[11px] text-gray-400 mt-2">Old or new is read from the year in the MR number.</p>
                    </div>
                </div>

                {/* Patients, most urgent first */}
                {REPORT_GROUPS.filter((g) => g.key !== 'unreached').map((g) => {
                    const rows = r.groups[g.key];
                    if (rows.length === 0) return null;
                    const style = GROUP_STYLE[g.key];
                    return (
                        <section key={g.key} className={`rounded-xl border bg-white overflow-hidden ${style.border}`}>
                            <div className="px-4 py-3 flex items-baseline gap-2">
                                <h2 className={`text-base font-bold ${style.heading}`}>{g.title}</h2>
                                <span className="text-sm font-bold text-gray-500">{rows.length}</span>
                                <span className="text-xs text-gray-500 ml-auto">{g.hint}</span>
                            </div>
                            {rows.map((row, i) => <PatientCard key={`${row.mrNumber}-${row.createdAt}`} row={row} index={i + 1} />)}
                        </section>
                    );
                })}

                {r.groups.unreached.length > 0 && (
                    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-3 flex items-baseline gap-2">
                            <h2 className="text-base font-bold text-gray-700">Not reached</h2>
                            <span className="text-sm font-bold text-gray-500">{r.groups.unreached.length}</span>
                            <span className="text-xs text-gray-500 ml-auto">No conversation took place; worth calling again</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-t border-gray-100">
                                        <th className="text-left font-bold px-4 py-2">#</th>
                                        <th className="text-left font-bold px-2 py-2">Patient</th>
                                        <th className="text-left font-bold px-2 py-2">MR number</th>
                                        <th className="text-left font-bold px-2 py-2">Old / New</th>
                                        <th className="text-left font-bold px-2 py-2">What happened</th>
                                        <th className="text-left font-bold pl-2 pr-4 py-2">Called</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {r.groups.unreached.map((row, i) => (
                                        <tr key={`${row.mrNumber}-${row.createdAt}`} className="border-t border-gray-100 avoid-break">
                                            <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                            <td className="px-2 py-2 font-semibold text-gray-900">{row.name}</td>
                                            <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{row.mrNumber || '—'}</td>
                                            <td className="px-2 py-2 text-gray-600">{row.patientType || '—'}</td>
                                            <td className="px-2 py-2 text-gray-700">{row.callResult}{row.attempts ? ` · ${row.attempts}` : ''}</td>
                                            <td className="pl-2 pr-4 py-2 text-gray-500 whitespace-nowrap">{row.calledAt}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                <footer className="text-xs text-gray-500 leading-relaxed border-t border-gray-200 pt-3">
                    Calls were placed by BeanHealth's AI assistant. Reasons and accounts are the assistant's summary of what
                    was said, not a recording. Call time is as reported by the calling platform; a call with no time had none
                    reported. No appointment was changed by these calls.
                </footer>
            </div>
        </div>,
        document.body,
    );
};

export default AiCallReportView;

/**
 * Reports — the dashboard and the monthly outcome report.
 *
 * One month at a time, computed by protocol/report.ts. The printable version is
 * the same numbers on a clean A4 page for the centre's own meetings and for the
 * renewal conversation — printed through a hidden frame, so the coordinator
 * never leaves the screen.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useCentre } from '../session';
import { fetchSessionsSince, fetchLabs } from '../services/records';
import { fetchAttemptsSince } from '../services/calls';
import { fetchAlerts } from '../services/alerts';
import { fetchPatients } from '../services/patients';
import { localDateKey } from '../services/db';
import { addDays } from '../protocol/engine';
import { buildMonthReport, CALL_WINDOW_DAYS, LAB_WINDOW_DAYS, RETURN_WINDOW_DAYS, type MonthReport } from '../protocol/report';
import { CALL_PURPOSES, CALL_PURPOSE_LABEL, PROGRAMMES } from '../protocol/settings';
import { SetupNotice } from '../ui/SetupNotice';
import { Button, Card, Spinner, Stat } from '../ui/kit';

const monthBounds = (ym: string) => {
    const [y, m] = ym.split('-').map(Number);
    const from = `${ym}-01`;
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from, to: `${ym}-${String(last).padStart(2, '0')}` };
};
const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const pctText = (v: number | null) => (v === null ? '—' : `${v}%`);
const ratio = (g: { back: number; of: number }) => (g.of ? `${g.back} of ${g.of} (${Math.round((g.back / g.of) * 100)}%)` : '—');

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function reportHtml(centreName: string, ym: string, r: MonthReport, programmeCounts: [string, number][]): string {
    const row = (k: string, v: string, note = '') => `<tr><td>${esc(k)}</td><td class="v">${esc(v)}</td><td class="n">${esc(note)}</td></tr>`;
    const purposes = CALL_PURPOSES;
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(centreName)} — ${esc(monthLabel(ym))}</title>
<style>
 @page { size: A4; margin: 16mm; }
 :root { color-scheme: only light; }
 body { font-family: Inter, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111827; font-size: 11pt; }
 h1 { font-size: 18pt; margin: 0; } h2 { font-size: 12pt; margin: 18pt 0 6pt; color: #3F7A12; }
 .sub { color: #6b7280; margin-top: 2pt; }
 table { width: 100%; border-collapse: collapse; }
 td { padding: 5pt 4pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
 td.v { width: 26%; font-weight: 700; text-align: right; } td.n { width: 38%; color: #6b7280; font-size: 9pt; }
 .note { margin-top: 18pt; font-size: 9pt; color: #6b7280; line-height: 1.5; }
 .foot { margin-top: 24pt; font-size: 8.5pt; color: #9ca3af; }
</style></head><body>
<h1>${esc(centreName)}</h1>
<div class="sub">Follow-up outcomes · ${esc(monthLabel(ym))} · BeanHealth Connect</div>
<h2>Patients</h2><table>${programmeCounts.map(([k, n]) => row(k, String(n))).join('')}</table>
<h2>Dialysis attendance</h2><table>
${row('Sessions attended', String(r.sessions.attended))}
${row('Sessions missed', String(r.sessions.missed))}
${row('Attendance rate', pctText(r.sessions.attendanceRate), 'attended ÷ (attended + missed); centre-cancelled excluded')}
</table>
<h2>Missed sessions and follow-up</h2><table>
${row('Missed sessions', String(r.missed.total))}
${row('Followed by a call', String(r.missed.called), `within ${CALL_WINDOW_DAYS} days of the miss`)}
${row('Patient reached', String(r.missed.reached))}
${row('Came back — reached by a call', ratio(r.missed.backAfterReached), `attended within ${RETURN_WINDOW_DAYS} days`)}
${row('Came back — no call', ratio(r.missed.backWithoutCall), `attended within ${RETURN_WINDOW_DAYS} days`)}
${r.missed.tooRecent ? row('Too recent to judge', String(r.missed.tooRecent), `the ${RETURN_WINDOW_DAYS}-day window has not closed yet`) : ''}
</table>
<h2>Calls</h2><table>
${row('Calls placed', String(r.calls.placed))}
${row('Reached', `${r.calls.reached} (${pctText(r.calls.reachRate)})`, 'of calls the provider placed')}
${purposes.map(p => row(`  ${CALL_PURPOSE_LABEL[p]}`, `${r.calls.byPurpose[p].placed} placed · ${r.calls.byPurpose[p].reached} reached`)).join('')}
${row('Not placed', String(r.calls.failed), 'refused or failed before dialling')}
</table>
<h2>Labs</h2><table>
${row('Patients reminded', String(r.labs.reminded))}
${row('Test done after reminder', String(r.labs.doneWithin14Days), `recorded within ${LAB_WINDOW_DAYS} days`)}
${r.labs.stillOpen ? row('Reminded, still inside the window', String(r.labs.stillOpen)) : ''}
${row('Tests recorded this month', String(r.labs.recorded))}
</table>
<h2>Alerts</h2><table>
${row('Red flags', String(r.alerts.redFlags))}
${row('Median time to pick up a red flag', r.alerts.medianRedFlagAckMinutes === null ? '—' : `${r.alerts.medianRedFlagAckMinutes} min`)}
${row('Callback requests', String(r.alerts.callbacks))}
${row('Resolved', String(r.alerts.resolved))}
${row('Never picked up', String(r.alerts.stillOpen))}
</table>
<p class="note">"Came back" compares patients reached by a call with patients who got no call. It shows what happened in each group; it does not show that the call caused the return. Sessions count only when marked in Connect, so an unmarked session is in neither the attended nor the missed total.</p>
<p class="foot">Generated ${esc(new Date().toLocaleString('en-IN'))}</p>
</body></html>`;
}

function printHtml(html: string) {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;border:0;width:210mm;height:297mm;';
    document.body.appendChild(frame);
    const doc = frame.contentWindow?.document;
    if (!doc) { frame.remove(); toast.error('Could not start the print'); return; }
    doc.open(); doc.write(html); doc.close();
    window.setTimeout(() => {
        try { frame.contentWindow?.focus(); frame.contentWindow?.print(); } catch { toast.error('Could not start the print'); }
        window.setTimeout(() => frame.remove(), 1000);
    }, 150);
}

const ReportsScreen: React.FC = () => {
    const centre = useCentre();
    const thisMonth = localDateKey().slice(0, 7);
    const [ym, setYm] = useState(thisMonth);
    const [report, setReport] = useState<MonthReport | null>(null);
    const [programmeCounts, setProgrammeCounts] = useState<[string, number][]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<unknown>(null);

    const months = useMemo(() => {
        const out: string[] = [];
        const [y, m] = thisMonth.split('-').map(Number);
        for (let i = 0; i < 12; i++) {
            const d = new Date(Date.UTC(y, m - 1 - i, 1));
            out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
        }
        return out;
    }, [thisMonth]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const { from, to } = monthBounds(ym);
            // Returns and lab completions land after the month ends, so read a
            // little past it; the report only counts events that start inside.
            const [sessions, attempts, labs, alerts, patients] = await Promise.all([
                fetchSessionsSince(centre.id, addDays(from, -1)),
                fetchAttemptsSince(centre.id, new Date(`${addDays(from, -1)}T00:00:00`).toISOString()),
                fetchLabs(centre.id),
                fetchAlerts(centre.id, { sinceIso: new Date(`${from}T00:00:00`).toISOString() }),
                fetchPatients(centre.id),
            ]);
            const horizon = addDays(to, RETURN_WINDOW_DAYS + LAB_WINDOW_DAYS);
            setReport(buildMonthReport({
                from, to, asOf: localDateKey(),
                sessions: sessions.filter(s => s.date <= horizon),
                attempts,
                labs,
                alerts: alerts.map(a => ({ kind: a.kind, createdAt: a.createdAt, acknowledgedAt: a.acknowledgedAt, resolvedAt: a.resolvedAt })),
            }));
            const active = patients.filter(p => !p.isDeceased && !p.stopped);
            setProgrammeCounts([
                ...PROGRAMMES.map(p => [p.label, active.filter(x => x.programme === p.id).length] as [string, number]).filter(([, n]) => n > 0),
                ['Total active patients', active.length],
            ]);
            setError(null);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [centre.id, ym]);

    useEffect(() => { load(); }, [load]);

    if (loading && !report) return <Spinner label="Building the report…" />;
    if (error) return <SetupNotice error={error} />;
    if (!report) return null;
    const r = report;

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Reports</h1>
                    <p className="text-sm text-gray-500">{monthLabel(ym)}{ym === thisMonth ? ' so far' : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={ym} onChange={e => setYm(e.target.value)} className="h-[42px] rounded-xl border border-gray-200 bg-white px-3 text-sm">
                        {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
                    <Button tone="primary" onClick={() => printHtml(reportHtml(centre.name, ym, r, programmeCounts))}>Print monthly report</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Attendance" value={pctText(r.sessions.attendanceRate)} hint={`${r.sessions.attended} attended · ${r.sessions.missed} missed`} />
                <Stat label="Calls placed" value={r.calls.placed} hint={`${r.calls.reached} reached (${pctText(r.calls.reachRate)})`} />
                <Stat label="Red flags" value={r.alerts.redFlags} hint={r.alerts.medianRedFlagAckMinutes === null ? 'none picked up yet' : `picked up in ${r.alerts.medianRedFlagAckMinutes} min (median)`} tone={r.alerts.redFlags ? 'rose' : 'default'} />
                <Stat label="Labs after reminder" value={r.labs.doneWithin14Days} hint={`of ${r.labs.reminded} reminded${r.labs.stillOpen ? ` · ${r.labs.stillOpen} still in window` : ''}`} />
            </div>

            <Card className="p-5">
                <h2 className="text-sm font-bold text-gray-900">Missed sessions and what followed</h2>
                <p className="mt-0.5 text-xs text-gray-500">
                    {r.missed.total} missed · {r.missed.called} followed by a call within {CALL_WINDOW_DAYS} days · {r.missed.reached} reached
                    {r.missed.tooRecent > 0 && ` · ${r.missed.tooRecent} too recent to judge (the ${RETURN_WINDOW_DAYS}-day window is still open)`}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-[#F0F9E6] p-4">
                        <p className="text-xs font-semibold text-[#3F7A12]">Reached by a call</p>
                        <p className="mt-1 text-lg font-bold text-gray-900">{ratio(r.missed.backAfterReached)}</p>
                        <p className="text-[11px] text-gray-500">came back within {RETURN_WINDOW_DAYS} days</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                        <p className="text-xs font-semibold text-gray-600">No call</p>
                        <p className="mt-1 text-lg font-bold text-gray-900">{ratio(r.missed.backWithoutCall)}</p>
                        <p className="text-[11px] text-gray-500">came back within {RETURN_WINDOW_DAYS} days</p>
                    </div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-gray-400">
                    These two groups are side by side, not cause and effect: patients come back for many reasons. Showing that calls
                    cause returns needs a holdout — some patients deliberately not called for a period.
                </p>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="p-5">
                    <h2 className="text-sm font-bold text-gray-900">Calls by reason</h2>
                    <div className="mt-3 space-y-2">
                        {CALL_PURPOSES.map(p => {
                            const b = r.calls.byPurpose[p];
                            return (
                                <div key={p} className="flex items-center justify-between gap-3 text-sm">
                                    <span className="text-gray-700">{CALL_PURPOSE_LABEL[p]}</span>
                                    <span className="font-semibold text-gray-900">{b.placed} placed · {b.reached} reached</span>
                                </div>
                            );
                        })}
                        {r.calls.failed > 0 && <p className="text-[11px] text-gray-400">{r.calls.failed} refused or failed before dialling</p>}
                    </div>
                </Card>
                <Card className="p-5">
                    <h2 className="text-sm font-bold text-gray-900">Alerts</h2>
                    <div className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-700">Red flags</span><span className="font-semibold">{r.alerts.redFlags}</span></div>
                        <div className="flex justify-between"><span className="text-gray-700">Callback requests</span><span className="font-semibold">{r.alerts.callbacks}</span></div>
                        <div className="flex justify-between"><span className="text-gray-700">Resolved</span><span className="font-semibold">{r.alerts.resolved}</span></div>
                        <div className="flex justify-between"><span className="text-gray-700">Never picked up</span><span className={r.alerts.stillOpen ? 'font-semibold text-rose-600' : 'font-semibold'}>{r.alerts.stillOpen}</span></div>
                    </div>
                </Card>
            </div>

            <p className="text-[11px] text-gray-400">
                Sessions count only when marked on the Attendance tab — an unmarked session is in neither total.
            </p>
        </div>
    );
};

export default ReportsScreen;

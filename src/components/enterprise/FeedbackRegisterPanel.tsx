/**
 * FeedbackRegisterPanel — what patients said, on the doctor's dashboard
 *
 * Deliberately shaped like DialysisRegisterPanel: the same period selector, the
 * same stat strip, the same expandable rows. Reception and the doctors learn one
 * interaction for both registers instead of two.
 *
 * ── Aggregates are hospital-wide, the list is not ──────────────────────────
 * A doctor sees every named response that reached them, and the averages of the
 * whole hospital behind it. Averaging over the two or three responses one doctor
 * happens to have is noise dressed up as a metric; the useful frame is "the
 * restroom has been 2.2 for eleven days", not "my three patients said 4".
 *
 * ── Anonymity is structural, not cosmetic ─────────────────────────────────
 * A response carries a name only when the patient typed an MR number AND ticked
 * the box. The service resolves that; this file renders what it is given and
 * never tries to work out who an anonymous response came from. When the hospital
 * splits the QR by dialysis station, add a minimum-count suppression before
 * showing per-station comments — three responses from one chair is trivially
 * de-anonymised by anyone holding the session schedule.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
    fetchFeedbackRegister, acknowledgeFeedback, fetchFeedbackLocations,
    type FeedbackRegister, type FeedbackResponse, type FeedbackLocation,
} from '../../services/feedbackService';
import { visitTypeLabel, questionLabel, NEEDS_ATTENTION_AT } from '../feedback/feedbackQuestions';
import FeedbackPosterModal from './FeedbackPosterModal';

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
const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Clinic-local bounds, widened to whole days so a morning response counts. */
const resolveRange = (period: Period, cFrom: string, cTo: string): { from: string; to: string } => {
    const now = new Date();
    const end = `${dayKey(now)}T23:59:59.999`;
    if (period === 'week') return { from: `${dayKey(mondayOf(now))}T00:00:00`, to: end };
    if (period === 'month') return { from: `${dayKey(new Date(now.getFullYear(), now.getMonth(), 1))}T00:00:00`, to: end };
    if (period === 'year') return { from: `${dayKey(new Date(now.getFullYear(), 0, 1))}T00:00:00`, to: end };
    if (period === 'custom') {
        return {
            from: cFrom ? `${cFrom}T00:00:00` : '1970-01-01T00:00:00',
            to: cTo ? `${cTo}T23:59:59.999` : end,
        };
    }
    return { from: '1970-01-01T00:00:00', to: end };
};

const fmtWhen = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Green at 4+, amber at 3, rose at 2 or below. One rule, used everywhere. */
const toneFor = (v: number | null): string => {
    if (v === null) return 'bg-gray-100 text-gray-500 border-gray-200';
    if (v >= 4) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (v >= 3) return 'bg-amber-50 text-amber-800 border-amber-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
};
const barFor = (v: number): string => (v >= 4 ? 'bg-emerald-500' : v >= 3 ? 'bg-amber-400' : 'bg-rose-500');

const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <p className="mt-1 text-2xl font-bold leading-none text-gray-900">{value}</p>
        {hint && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
    </div>
);

const ScoreChip: React.FC<{ value: number | null; label?: string }> = ({ value, label }) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${toneFor(value)}`}>
        {label && <span className="font-semibold opacity-70">{label}</span>}
        {value === null ? '—' : value.toFixed(1)}
    </span>
);

export interface FeedbackRegisterPanelProps {
    hospitalId: string;
    /** When set, the response list narrows to this doctor's own patients. */
    doctorId?: string | null;
    doctorName?: string | null;
}

const FeedbackRegisterPanel: React.FC<FeedbackRegisterPanelProps> = ({ hospitalId, doctorId, doctorName }) => {
    const [period, setPeriod] = useState<Period>('month');
    const [cFrom, setCFrom] = useState('');
    const [cTo, setCTo] = useState('');
    const [tab, setTab] = useState<'responses' | 'questions'>('responses');
    // Off by default: a doctor opening this wants to see what the hospital is
    // hearing. Scoping to their own named responses is a question they ask
    // second, and on most days the answer is an empty list.
    const [mineOnly, setMineOnly] = useState(false);

    const [data, setData] = useState<FeedbackRegister | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [posterOpen, setPosterOpen] = useState(false);
    const [locations, setLocations] = useState<FeedbackLocation[]>([]);

    const range = useMemo(() => resolveRange(period, cFrom, cTo), [period, cFrom, cTo]);

    const load = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const r = await fetchFeedbackRegister({
                hospitalId,
                from: range.from,
                to: range.to,
                doctorId: mineOnly ? doctorId : null,
            });
            setData(r);
        } catch (e: any) {
            setError(e?.message || 'Could not load feedback');
        } finally {
            setLoading(false);
        }
    }, [hospitalId, range.from, range.to, mineOnly, doctorId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        fetchFeedbackLocations(hospitalId).then(setLocations).catch(() => setLocations([]));
    }, [hospitalId]);

    const ack = async (r: FeedbackResponse) => {
        try {
            await acknowledgeFeedback(hospitalId, r.id, '');
            toast.success('Marked as seen');
            load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not save');
        }
    };

    const rows = data?.responses || [];

    return (
        <div className="p-4 sm:p-6">
            {/* Period + poster */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => setPeriod(p.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${period === p.key ? 'border-sky-300 bg-sky-100 text-sky-800' : 'border-gray-200 bg-white text-gray-600 hover:border-sky-200'}`}
                    >
                        {p.label}
                    </button>
                ))}
                {period === 'custom' && (
                    <span className="flex items-center gap-1.5">
                        <input type="date" value={cFrom} onChange={e => setCFrom(e.target.value)}
                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="date" value={cTo} onChange={e => setCTo(e.target.value)}
                            className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs" />
                    </span>
                )}
                <span className="ml-auto flex items-center gap-2">
                    <button
                        type="button"
                        onClick={load}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={() => setPosterOpen(true)}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
                    >
                        QR poster
                    </button>
                </span>
            </div>

            {error && (
                <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
            )}

            {loading && !data ? (
                <div className="py-20 text-center text-sm text-gray-400">Loading feedback…</div>
            ) : (
                <>
                    {/* Stat strip */}
                    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Stat label="Responses" value={data?.total ?? 0} hint="in this period" />
                        <Stat
                            label="Overall"
                            value={data?.overall !== null && data?.overall !== undefined ? data.overall.toFixed(1) : '—'}
                            hint="average of every rating"
                        />
                        <Stat
                            label="Needs attention"
                            value={data?.needsAttention.length ?? 0}
                            hint={`rated ${NEEDS_ATTENTION_AT} or below`}
                        />
                        <Stat
                            label="Named"
                            value={rows.filter(r => r.patientId).length}
                            hint="the rest are anonymous"
                        />
                    </div>

                    {/* Needs attention, pinned */}
                    {data && data.needsAttention.length > 0 && (
                        <div className="mb-5 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/60">
                            <p className="border-b border-rose-200 px-4 py-2 text-xs font-bold uppercase tracking-wide text-rose-800">
                                Needs attention · {data.needsAttention.length}
                            </p>
                            <div className="divide-y divide-rose-100">
                                {data.needsAttention.slice(0, 8).map(r => (
                                    <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
                                        <span className="text-[11px] font-semibold text-gray-500">{fmtWhen(r.submittedAt)}</span>
                                        <span className="text-[11px] text-gray-400">{visitTypeLabel(r.visitType)}</span>
                                        <ScoreChip value={r.lowestRating} label="lowest" />
                                        {r.comment && (
                                            <span className="min-w-0 flex-1 truncate text-xs text-gray-800">“{r.comment}”</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => ack(r)}
                                            className="ml-auto shrink-0 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                                        >
                                            Mark seen
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        {([['responses', 'Responses'], ['questions', 'By question']] as const).map(([k, label]) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => setTab(k)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${tab === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {label}
                            </button>
                        ))}
                        {doctorId && tab === 'responses' && (
                            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                                <input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} />
                                Only patients shared with {doctorName || 'me'}
                            </label>
                        )}
                    </div>

                    {tab === 'questions' ? (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            {(data?.byQuestion.length ?? 0) === 0 ? (
                                <p className="px-4 py-10 text-center text-sm text-gray-400">Nothing rated in this period yet.</p>
                            ) : (
                                [...(data?.byQuestion || [])]
                                    .sort((a, b) => a.average - b.average)
                                    .map(q => (
                                        <div key={q.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0">
                                            <span className="w-44 shrink-0 text-sm font-semibold text-gray-800">{q.label}</span>
                                            <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                <span
                                                    className={`block h-full rounded-full ${barFor(q.average)}`}
                                                    style={{ width: `${(q.average / 5) * 100}%` }}
                                                />
                                            </span>
                                            <ScoreChip value={q.average} />
                                            <span className="w-12 shrink-0 text-right text-[11px] text-gray-400">{q.count}</span>
                                        </div>
                                    ))
                            )}
                            {(data?.byVisitType.length ?? 0) > 0 && (
                                <div className="border-t border-gray-200 bg-gray-50/70 px-4 py-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">By visit type</p>
                                    <div className="flex flex-wrap gap-2">
                                        {data?.byVisitType.map(v => (
                                            <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
                                                <span className="text-xs font-semibold text-gray-700">{visitTypeLabel(v.id)}</span>
                                                <ScoreChip value={v.average} />
                                                <span className="text-[11px] text-gray-400">{v.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center">
                            <p className="text-sm font-semibold text-gray-600">No responses in this period</p>
                            <p className="mt-1 text-xs text-gray-400">
                                {mineOnly
                                    ? 'Nobody has shared feedback with you yet. Untick the filter to see the whole hospital.'
                                    : 'Print the QR poster and put it where patients wait.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            {rows.map(r => {
                                const open = expanded === r.id;
                                const entries = Object.entries(r.ratings);
                                return (
                                    <div key={r.id} className="border-b border-gray-100 last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(open ? null : r.id)}
                                            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-gray-50"
                                        >
                                            <span className="text-[11px] font-semibold text-gray-500">{fmtWhen(r.submittedAt)}</span>
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                                {visitTypeLabel(r.visitType)}
                                            </span>
                                            {r.patientId ? (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                                    {r.patientName || 'Patient'}
                                                    {r.mrNumber && <span className="font-mono opacity-70">{r.mrNumber}</span>}
                                                </span>
                                            ) : (
                                                <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-bold text-gray-400">
                                                    Anonymous
                                                </span>
                                            )}
                                            <ScoreChip value={r.lowestRating} label="lowest" />
                                            {r.comment && (
                                                <span className="min-w-0 flex-1 truncate text-xs text-gray-700">“{r.comment}”</span>
                                            )}
                                            {r.status !== 'new' && (
                                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Seen</span>
                                            )}
                                            <span className={`ml-auto shrink-0 text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
                                        </button>

                                        {open && (
                                            <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3">
                                                {entries.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {entries.map(([qid, v]) => (
                                                            <ScoreChip key={qid} value={v} label={questionLabel(qid)} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400">No ratings — comment only.</p>
                                                )}
                                                {r.comment && (
                                                    <p className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-800">
                                                        {r.comment}
                                                    </p>
                                                )}
                                                {r.status === 'new' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => ack(r)}
                                                        className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                                                    >
                                                        Mark seen
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {posterOpen && (
                <FeedbackPosterModal
                    locations={locations}
                    onClose={() => setPosterOpen(false)}
                />
            )}
        </div>
    );
};

export default FeedbackRegisterPanel;

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
 * ── Delete, not "seen" ────────────────────────────────────────────────────
 * The hospital works this list by deleting a response once it has been dealt
 * with. Delete is permanent and takes the voice note with it (see
 * deleteFeedback for why the recording goes first), so it asks once to confirm.
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
    fetchFeedbackRegister, deleteFeedback, getFeedbackAudioUrl, fetchFeedbackLocations,
    type FeedbackRegister, type FeedbackResponse, type FeedbackLocation,
} from '../../services/feedbackService';
import { visitTypeLabel, questionLabel, questionSection, SECTIONS, NEEDS_ATTENTION_AT } from '../feedback/feedbackQuestions';
import FeedbackPosterModal from './FeedbackPosterModal';
import TwoStepConfirmModal from '../common/TwoStepConfirmModal';
import { feedbackUrl } from '../feedback/feedbackLinks';

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

const fmtSecs = (s: number | null) => {
    const n = Math.max(0, Math.round(s || 0));
    return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/**
 * Plays a voice note. The signed link is fetched on the first tap rather than
 * for every row up front: most rows are never played, and each link is a
 * storage request.
 */
const VoicePlayer: React.FC<{ path: string; seconds: number | null }> = ({ path, seconds }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    if (url) return <audio controls autoPlay src={url} className="h-10 w-full max-w-md" />;

    return (
        <button
            type="button"
            disabled={busy}
            onClick={async () => {
                setBusy(true);
                try { setUrl(await getFeedbackAudioUrl(path)); }
                catch (e: any) { toast.error(e?.message || 'Could not load the voice note'); }
                finally { setBusy(false); }
            }}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
        >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            {busy ? 'Loading…' : `Play voice note · ${fmtSecs(seconds)}`}
        </button>
    );
};

const MicBadge: React.FC<{ seconds: number | null }> = ({ seconds }) => (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zM19 11a7 7 0 01-14 0M12 18v3" />
        </svg>
        {fmtSecs(seconds)}
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
    // 'all' by default: a doctor opening this wants to see what the hospital is
    // hearing. "About me" (patients who picked this doctor) and "Shared with
    // me" (named patients) are questions they ask second.
    const [scope, setScope] = useState<'all' | 'about' | 'shared'>('all');

    const [data, setData] = useState<FeedbackRegister | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [posterOpen, setPosterOpen] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<FeedbackResponse | null>(null);
    const [deleting, setDeleting] = useState(false);
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
                doctorId: doctorId || null,
                doctorScope: scope,
            });
            setData(r);
        } catch (e: any) {
            setError(e?.message || 'Could not load feedback');
        } finally {
            setLoading(false);
        }
    }, [hospitalId, range.from, range.to, scope, doctorId]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        fetchFeedbackLocations(hospitalId).then(setLocations).catch(() => setLocations([]));
    }, [hospitalId]);

    const confirmDelete = async () => {
        const r = pendingDelete;
        if (!r || deleting) return;
        setDeleting(true);
        try {
            await deleteFeedback(hospitalId, r.id, r.audioPath);
            toast.success('Response deleted');
            setPendingDelete(null);
            if (expanded === r.id) setExpanded(null);
            load();
        } catch (e: any) {
            toast.error(e?.message || 'Could not delete');
        } finally {
            setDeleting(false);
        }
    };

    // Open the form on this device for a patient standing at the desk. Desk
    // mode, so handing the tablet to the next patient is not throttled away.
    // With one QR per place, the desk picks which place's form to open.
    const activeLocations = locations.filter(l => l.isActive);
    const openForm = (code?: string) => {
        const loc = code ? activeLocations.find(l => l.code === code) : activeLocations[0];
        if (!loc) { toast.error('No feedback form is set up yet'); return; }
        window.open(feedbackUrl(loc.code, { desk: true }), '_blank', 'noopener');
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
                    {activeLocations.length > 1 ? (
                        <select
                            value=""
                            onChange={e => { if (e.target.value) openForm(e.target.value); }}
                            title="Opens that place's patient form on this device, for a patient at the desk"
                            className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100"
                        >
                            <option value="">Open form…</option>
                            {activeLocations.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                    ) : (
                        <button
                            type="button"
                            onClick={() => openForm()}
                            title="Opens the patient form on this device, for a patient at the desk"
                            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100"
                        >
                            Open form
                        </button>
                    )}
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
                                        {r.audioPath && <MicBadge seconds={r.audioSeconds} />}
                                        {r.comment && (
                                            <span className="min-w-0 flex-1 truncate text-xs text-gray-800">“{r.comment}”</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // The row lives in the Responses tab; on "By question"
                                                // expanding it alone would do nothing visible.
                                                setTab('responses');
                                                setExpanded(r.id);
                                                window.setTimeout(() => document.getElementById(`fb-${r.id}`)
                                                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
                                            }}
                                            className="ml-auto shrink-0 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:bg-gray-50"
                                        >
                                            Open
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setPendingDelete(r)}
                                            className="shrink-0 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                                        >
                                            Delete
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
                            <span className="ml-auto inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
                                {([
                                    ['all', 'Everyone'],
                                    ['about', `About ${doctorName || 'me'}`],
                                    ['shared', 'Shared with me'],
                                ] as const).map(([k, label]) => (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setScope(k)}
                                        title={k === 'about' ? 'Patients who said they saw you' : k === 'shared' ? 'Named patients who chose to share their feedback with you' : undefined}
                                        className={`px-2.5 py-1 text-[11px] font-bold ${scope === k ? 'bg-sky-100 text-sky-800' : 'text-gray-600 hover:bg-gray-50'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </span>
                        )}
                    </div>

                    {tab === 'questions' ? (
                        <div className="space-y-4">
                            {/* By doctor — the doctor-section ratings only, so a ward
                                meal does not count against the consultant. */}
                            {(data?.byDoctor.length ?? 0) > 0 && (
                                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                    <p className="border-b border-gray-100 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">By doctor</p>
                                    {data!.byDoctor.map(d => (
                                        <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-gray-100 px-4 py-3 last:border-b-0">
                                            <span className="w-44 shrink-0 text-sm font-semibold text-gray-800">{d.name}</span>
                                            <ScoreChip value={d.average} />
                                            {d.byQuestion.filter(x => x.count > 0).map(x => (
                                                <ScoreChip key={x.id} value={x.average} label={questionLabel(x.id)} />
                                            ))}
                                            <span className="ml-auto text-[11px] text-gray-400">{d.count} response{d.count === 1 ? '' : 's'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                                {(data?.byQuestion.length ?? 0) === 0 ? (
                                    <p className="px-4 py-10 text-center text-sm text-gray-400">Nothing rated in this period yet.</p>
                                ) : (
                                    [...SECTIONS.map(sec => ({ id: sec.id as string | null, label: sec.label })), { id: null, label: 'Earlier questions' }]
                                        .map(sec => ({
                                            ...sec,
                                            items: (data?.byQuestion || [])
                                                .filter(q => questionSection(q.id) === sec.id)
                                                .sort((a, b) => a.average - b.average),
                                        }))
                                        .filter(sec => sec.items.length > 0)
                                        .map(sec => (
                                            <div key={sec.id ?? 'retired'}>
                                                <p className="border-b border-gray-100 bg-gray-50/70 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{sec.label}</p>
                                                {sec.items.map(q => (
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
                                                ))}
                                            </div>
                                        ))
                                )}
                                {(data?.byLocation.length ?? 0) > 1 && (
                                    <div className="border-t border-gray-200 bg-gray-50/70 px-4 py-3">
                                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">By QR / place</p>
                                        <div className="flex flex-wrap gap-2">
                                            {data?.byLocation.map(v => (
                                                <span key={v.id} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
                                                    <span className="text-xs font-semibold text-gray-700">{v.label}</span>
                                                    <ScoreChip value={v.average} />
                                                    <span className="text-[11px] text-gray-400">{v.count}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
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
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-16 text-center">
                            <p className="text-sm font-semibold text-gray-600">No responses in this period</p>
                            <p className="mt-1 text-xs text-gray-400">
                                {scope !== 'all'
                                    ? (scope === 'about'
                                        ? 'No patient has picked you on the form in this period. Choose Everyone to see the whole hospital.'
                                        : 'Nobody has shared feedback with you yet. Choose Everyone to see the whole hospital.')
                                    : 'Print the QR poster and put it where patients wait.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                            {rows.map(r => {
                                const open = expanded === r.id;
                                const entries = Object.entries(r.ratings);
                                return (
                                    <div key={r.id} id={`fb-${r.id}`} className="border-b border-gray-100 last:border-b-0">
                                        <button
                                            type="button"
                                            onClick={() => setExpanded(open ? null : r.id)}
                                            className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left hover:bg-gray-50"
                                        >
                                            <span className="text-[11px] font-semibold text-gray-500">{fmtWhen(r.submittedAt)}</span>
                                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                                {visitTypeLabel(r.visitType)}
                                            </span>
                                            {r.ratedDoctorName && (
                                                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                                                    {r.ratedDoctorName}
                                                </span>
                                            )}
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
                                            {r.lowestRating !== null && <ScoreChip value={r.lowestRating} label="lowest" />}
                                            {r.audioPath && <MicBadge seconds={r.audioSeconds} />}
                                            {r.source === 'desk' && (
                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">At desk</span>
                                            )}
                                            {r.comment && (
                                                <span className="min-w-0 flex-1 truncate text-xs text-gray-700">“{r.comment}”</span>
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
                                                    <p className="text-xs text-gray-400">No ratings given.</p>
                                                )}
                                                {r.audioPath && (
                                                    <div className="mt-3">
                                                        <VoicePlayer path={r.audioPath} seconds={r.audioSeconds} />
                                                    </div>
                                                )}
                                                {r.comment && (
                                                    <p className="mt-3 whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-6 text-gray-800">
                                                        {r.comment}
                                                    </p>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setPendingDelete(r)}
                                                    className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"
                                                >
                                                    Delete response
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            <TwoStepConfirmModal
                isOpen={!!pendingDelete}
                singleStep
                title="Delete this response?"
                description={pendingDelete?.audioPath
                    ? 'The ratings, comment and voice note are removed permanently. This cannot be undone.'
                    : 'The ratings and comment are removed permanently. This cannot be undone.'}
                confirmLabel={deleting ? 'Deleting…' : 'Delete'}
                onCancel={() => { if (!deleting) setPendingDelete(null); }}
                onConfirm={confirmDelete}
            />

            {posterOpen && (
                <FeedbackPosterModal
                    hospitalId={hospitalId}
                    locations={locations}
                    onClose={() => setPosterOpen(false)}
                />
            )}
        </div>
    );
};

export default FeedbackRegisterPanel;

/**
 * BeanHealth AI Call Campaign
 * ───────────────────────────
 * Reception picks a cohort, types the numbers, locks the list, and approves each
 * call one at a time. The agent's account of every call lands beside it and, at
 * the same moment, on the patient's Past Records card — both read the same
 * hospital_voice_call_attempts rows, so there is nothing to reconcile.
 *
 * THE PHONE NUMBERS NEVER LEAVE THIS TAB. The hospital stopped collecting them:
 * new registration no longer asks, so most patients have none on file and a
 * typed number is the only way to reach them. It is held in React state, sent
 * with the call, and discarded — the attempt row keeps only the last two digits,
 * enough to confirm the right number was reached and useless for dialling.
 * Closing the tab loses them, which is the correct behaviour, so we warn first.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import {
    fetchReceptionPastRecords,
    type ReceptionPastRecordPatient,
    type ReceptionReviewFilter,
} from '../../services/enterpriseReviewService';
import { placeReviewCall } from '../../services/voiceCallService';
import { formatPastDate } from './PastRecordsPatientCard';
import { buildMissedMonths, missedReviewDate } from './MissedFollowupMonths';

type CohortFilter = Extract<ReceptionReviewFilter, 'all' | 'due_today' | 'due_tomorrow' | 'overdue'>;

const COHORTS: { key: CohortFilter; label: string }[] = [
    { key: 'overdue', label: 'Missed Followup' },
    { key: 'due_today', label: 'Due Today' },
    { key: 'due_tomorrow', label: 'Due Tomorrow' },
    { key: 'all', label: 'All' },
];

/** Mirrors the Edge Function's toE164 so the UI refuses the same numbers it would. */
const toE164 = (raw: string): string | null => {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
    return null;
};

type RunState = 'idle' | 'calling' | 'waiting' | 'done' | 'failed';

interface PlacedCall {
    id: string;
    patientId: string;
    name: string;
    mrNumber: string | null;
    createdAt: string;
    status: string;
    sarvamStatus: string | null;
    dialedNumber: string | null;
    summary: string | null;
    disposition: string | null;
}

interface Row {
    patient: ReceptionPastRecordPatient;
    phone: string;
    state: RunState;
    attemptRef: string | null;
    summary: string | null;
    disposition: string | null;
    error: string | null;
}

interface Props {
    hospitalId: string;
    onBack: () => void;
}

const AICallCampaignPage: React.FC<Props> = ({ hospitalId, onBack }) => {
    // The campaign works a whole cohort, so it must not be paginated. Missed
    // Followup at KKC runs to thousands across years, and a 200-row page hid
    // most of them behind a count that read as complete.
    const CAMPAIGN_FETCH_LIMIT = 5000;

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [missedMonth, setMissedMonth] = useState<string | null>(null);
    const [cohort, setCohort] = useState<CohortFilter>('overdue');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [candidates, setCandidates] = useState<ReceptionPastRecordPatient[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [rows, setRows] = useState<Row[]>([]);
    const [locked, setLocked] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [showScript, setShowScript] = useState(false);
    const [placed, setPlaced] = useState<PlacedCall[]>([]);
    const [placedOpen, setPlacedOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const pollRef = useRef<number | null>(null);

    // ── Cohort ────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchReceptionPastRecords({ hospitalId, page: 0, pageSize: CAMPAIGN_FETCH_LIMIT, reviewFilter: cohort })
            .then((res) => { if (!cancelled) setCandidates(res.patients); })
            .catch((err) => { if (!cancelled) toast.error(err?.message || 'Could not load patients'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [hospitalId, cohort]);
    // NOT keyed on `search`. The cohort fetch pulls the whole list in ~40
    // sequential chunks; re-running it per keystroke left the page pinned on
    // "Loading…" and never settling. Search filters what is already in memory.

    // Typed numbers exist only here. A reload throws away the operator's work.
    useEffect(() => {
        if (!locked && rows.length === 0) return;
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [locked, rows.length]);

    useEffect(() => () => { if (pollRef.current) window.clearInterval(pollRef.current); }, []);

    // Month buckets, Missed Followup only. Built from the full cohort, so the
    // count on each chip is the real total for that month rather than whatever
    // happened to land on a page.
    const missedMonths = useMemo(
        () => (cohort === 'overdue' ? buildMissedMonths(candidates) : []),
        [cohort, candidates]
    );

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        let base = cohort === 'overdue' && missedMonth
            ? candidates.filter((p) => (missedReviewDate(p) || '').slice(0, 7) === missedMonth)
            : candidates;
        if (q) {
            base = base.filter((p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.mr_number || '').toLowerCase().includes(q));
        }
        // Selected float to the top and hold their order, so a long list stays
        // reviewable — the operator can see what they picked without scrolling
        // back through hundreds of unchecked rows.
        const picked: ReceptionPastRecordPatient[] = [];
        const rest: ReceptionPastRecordPatient[] = [];
        for (const p of base) (selectedIds.has(p.id) ? picked : rest).push(p);
        return [...picked, ...rest];
    }, [candidates, cohort, missedMonth, selectedIds, search]);

    const allVisibleSelected = visible.length > 0 && visible.every((p) => selectedIds.has(p.id));

    // Scoped to what is on screen. Selecting across a hidden month would queue
    // calls to patients the operator never looked at.
    const toggleAllVisible = () => setSelectedIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
        else visible.forEach((p) => next.add(p.id));
        return next;
    });

    // Every call this hospital has placed, newest first — campaign or the AI Call
    // button on a card. One list, because "have we already rung them?" does not
    // care which surface started it.
    const loadPlaced = useCallback(async () => {
        const { data, error } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
            .select('id, patient_id, status, sarvam_status, final_agent_variables, created_at, dialed_number, patient:hospital_patients(name, mr_number)')
            .eq('hospital_id', hospitalId)
            .order('created_at', { ascending: false })
            .limit(200);
        if (error) { toast.error('Could not load placed calls'); return; }
        setPlaced((data || []).map((r: any) => ({
            id: r.id,
            patientId: r.patient_id,
            name: r.patient?.name || 'Unknown patient',
            mrNumber: r.patient?.mr_number || null,
            createdAt: r.created_at,
            status: r.status,
            sarvamStatus: r.sarvam_status,
            dialedNumber: r.dialed_number || null,
            summary: typeof r.final_agent_variables?.call_summary === 'string' ? r.final_agent_variables.call_summary : null,
            disposition: typeof r.final_agent_variables?.disposition === 'string' ? r.final_agent_variables.disposition : null,
        })));
    }, [hospitalId]);

    useEffect(() => { loadPlaced(); }, [loadPlaced]);

    const deletePlaced = async (call: PlacedCall) => {
        // The attempt row is the ONLY record of the call. Deleting it clears the
        // campaign entry and the patient's AI Call History together, because both
        // read this table — so say that plainly rather than let it surprise them.
        const ok = window.confirm(
            `Delete the AI call record for ${call.name}?\n\n` +
            `This also removes the summary from their Past Records card, and cannot be undone. ` +
            `You can then call them again from scratch.`
        );
        if (!ok) return;
        setDeletingId(call.id);
        try {
            const { error } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
                .delete().eq('id', call.id).eq('hospital_id', hospitalId);
            if (error) throw error;
            setPlaced((prev) => prev.filter((c) => c.id !== call.id));
            // Clear it from the run column too, so a deleted call cannot keep
            // showing a summary that no longer exists anywhere.
            setRows((prev) => prev.map((r) => r.attemptRef === call.id
                ? { ...r, state: 'idle', attemptRef: null, summary: null, disposition: null, error: null }
                : r));
            toast.success('Call record deleted');
        } catch (err: any) {
            toast.error(err?.message || 'Could not delete the call record');
        } finally {
            setDeletingId(null);
        }
    };

    const toggle = (id: string) => setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const buildList = () => {
        const picked = candidates.filter((p) => selectedIds.has(p.id));
        if (picked.length === 0) { toast.error('Select at least one patient'); return; }
        setRows(picked.map((patient) => ({
            patient,
            // Prefill only what the hospital already holds. Everyone else is typed.
            phone: patient.phone || '',
            state: 'idle', attemptRef: null, summary: null, disposition: null, error: null,
        })));
        setStep(2);
    };

    const readyCount = useMemo(() => rows.filter((r) => toE164(r.phone)).length, [rows]);

    const lockList = () => {
        const bad = rows.filter((r) => !toE164(r.phone));
        if (bad.length > 0) {
            toast.error(`${bad.length} number${bad.length === 1 ? ' is' : 's are'} not a valid mobile number`);
            return;
        }
        setLocked(true);
        setStep(3);
    };

    // ── Running ───────────────────────────────────────────────────────────
    const pollOutcome = useCallback((index: number, attemptRef: string) => {
        if (pollRef.current) window.clearInterval(pollRef.current);
        const startedAt = Date.now();
        pollRef.current = window.setInterval(async () => {
            const { data } = await (supabase.from('hospital_voice_call_attempts' as any) as any)
                .select('status, sarvam_status, final_agent_variables, failure_reason')
                .eq('id', attemptRef).maybeSingle();

            const settled = data && (data.status === 'completed' || data.status === 'failed');
            // Ten minutes without an outcome is not a call still in progress. Stop
            // polling and say so, rather than spinning against a row forever.
            const timedOut = Date.now() - startedAt > 10 * 60_000;
            if (!settled && !timedOut) return;

            if (pollRef.current) window.clearInterval(pollRef.current);
            pollRef.current = null;
            const vars = data?.final_agent_variables || {};
            setRows((prev) => prev.map((r, i) => i !== index ? r : {
                ...r,
                state: data?.status === 'completed' ? 'done' : 'failed',
                summary: typeof vars.call_summary === 'string' ? vars.call_summary : null,
                disposition: typeof vars.disposition === 'string' ? vars.disposition : null,
                error: timedOut && !settled
                    ? 'No outcome came back within 10 minutes.'
                    : (data?.failure_reason || null),
            }));
            loadPlaced();
        }, 5000);
    }, [loadPlaced]);

    const placeCall = async (index: number) => {
        const row = rows[index];
        if (!row) return;
        setRows((prev) => prev.map((r, i) => i === index ? { ...r, state: 'calling', error: null } : r));
        try {
            const res = await placeReviewCall({
                patientId: row.patient.id,
                requestedByName: 'Reception (campaign)',
                phoneOverride: row.phone,
            });
            setRows((prev) => prev.map((r, i) => i === index ? { ...r, state: 'waiting', attemptRef: res.attemptRef } : r));
            pollOutcome(index, res.attemptRef);
        } catch (err: any) {
            setRows((prev) => prev.map((r, i) => i === index ? { ...r, state: 'failed', error: err?.message || 'Call failed' } : r));
        }
    };

    const current = rows[activeIndex] || null;
    const busy = current ? current.state === 'calling' || current.state === 'waiting' : false;

    // What the agent is handed. Shown before the call so reception can see the
    // patient is right and the dates make sense — a wrong doctor or a blank
    // review date is far cheaper to catch here than on the phone.
    const agentParams = (row: Row) => {
        const dr = row.patient.doctorReviews?.[0];
        return [
            ['patient_name', row.patient.name || '—'],
            ['mr_number', row.patient.mr_number || '—'],
            ['doctor_name', dr?.doctorName || '—'],
            ['review_date', dr?.reviewDate ? formatPastDate(dr.reviewDate) : formatPastDate(row.patient.latestReviewDate)],
            ['last_visit_date', row.patient.lastVisitAt ? formatPastDate(row.patient.lastVisitAt) : '—'],
        ] as [string, string][];
    };

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">BeanHealth AI Call Campaign</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Pick the patients, type the numbers, then approve each call.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowScript((v) => !v)}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                        {showScript ? 'Hide script' : 'View call script'}
                    </button>
                    <button type="button" onClick={onBack}
                        className="px-3 py-2 rounded-lg text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                        Back
                    </button>
                </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                Phone numbers typed here are used for the call and then discarded. They are never saved to the
                patient record — only the last two digits are kept, so you can confirm the right number was reached.
            </div>

            {showScript && <CallScript />}

            <div className="rounded-2xl border border-gray-200 bg-white">
                <button type="button" onClick={() => setPlacedOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
                    <span className="text-sm font-bold text-gray-900">
                        Placed Call List
                        {placed.length > 0 && <span className="ml-1.5 text-violet-700">({placed.length})</span>}
                    </span>
                    <span className="text-xs font-semibold text-violet-700">{placedOpen ? 'Hide' : 'Show'}</span>
                </button>
                {placedOpen && (
                    <div className="px-4 pb-4">
                        {placed.length === 0 ? (
                            <p className="text-sm text-gray-500">No AI calls have been placed yet.</p>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto space-y-2">
                                {placed.map((call) => (
                                    <div key={call.id} className="grid grid-cols-1 md:grid-cols-[1.1fr_2fr_auto] gap-3 items-start rounded-xl border border-gray-200 p-3">
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-900 text-sm">{call.name}</p>
                                            <p className="text-xs text-gray-500">{call.mrNumber || '—'}</p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {formatPastDate(call.createdAt)}
                                                {call.dialedNumber ? ` · ${call.dialedNumber}` : ''}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                <StateChip state={
                                                    call.status === 'completed' ? 'done'
                                                        : call.status === 'failed' ? 'failed'
                                                            : 'waiting'
                                                } />
                                                {call.disposition && (
                                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${call.disposition === 'RED_FLAG_REPORTED' ? 'bg-red-100 text-red-800' : 'bg-violet-100 text-violet-800'}`}>
                                                        {call.disposition.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                            </div>
                                            {call.summary
                                                ? <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">{call.summary}</p>
                                                : <p className="text-xs text-gray-400">No summary recorded.</p>}
                                        </div>
                                        <button type="button" onClick={() => deletePlaced(call)} disabled={deletingId === call.id}
                                            className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
                                            {deletingId === call.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <p className="mt-2 text-[11px] text-gray-400">
                            Deleting a call removes its summary from the patient's Past Records card too — both read the
                            same record. Delete when you want to call that patient again from scratch.
                        </p>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold">
                {(['Select patients', 'Confirm & numbers', 'Place calls'] as const).map((label, i) => (
                    <React.Fragment key={label}>
                        <span className={`px-2.5 py-1 rounded-full ${step === i + 1 ? 'bg-violet-600 text-white' : step > i + 1 ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
                            {i + 1}. {label}
                        </span>
                        {i < 2 && <span className="text-gray-300">›</span>}
                    </React.Fragment>
                ))}
            </div>

            {step === 1 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="flex flex-wrap gap-2 mb-3">
                        {COHORTS.map((c) => (
                            <button key={c.key} type="button" onClick={() => { setCohort(c.key); setSelectedIds(new Set()); setMissedMonth(null); }}
                                className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${cohort === c.key ? 'bg-orange-50 text-orange-700 border-orange-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or MR number…"
                        className="w-full mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200" />

                    {cohort === 'overdue' && missedMonths.length > 0 && (
                        <div className="mb-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                                Missed by month — pick one to work through
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => setMissedMonth(null)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${missedMonth === null ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                    All months ({candidates.length})
                                </button>
                                {missedMonths.map((m) => (
                                    <button key={m.key} type="button" onClick={() => setMissedMonth(m.key)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${missedMonth === m.key ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                                        {m.label} ({m.patients.length})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between mb-2 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible}
                                disabled={visible.length === 0} className="w-4 h-4 accent-violet-600" />
                            <span className="font-semibold text-gray-700">
                                {allVisibleSelected ? 'Clear all' : 'Select all'}
                            </span>
                            <span className="text-gray-400">
                                {loading ? 'Loading the full list — this takes a moment…' : `${visible.length} shown`}
                            </span>
                        </label>
                        <span className="font-semibold text-violet-700">{selectedIds.size} selected</span>
                    </div>

                    <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-xl">
                        {visible.map((p) => (
                            <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50/40 cursor-pointer">
                                <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggle(p.id)}
                                    className="w-4 h-4 accent-violet-600" />
                                <span className="flex-1 min-w-0">
                                    <span className="block font-semibold text-gray-900 text-sm truncate">{p.name}</span>
                                    <span className="block text-xs text-gray-500">{p.mr_number || '—'} · Age {p.age ?? '--'}</span>
                                </span>
                                <span className="text-xs text-gray-500 whitespace-nowrap">
                                    {formatPastDate(p.latestReviewDate)}
                                </span>
                            </label>
                        ))}
                        {!loading && visible.length === 0 && (
                            <p className="px-3 py-6 text-center text-sm text-gray-500">No patients in this list.</p>
                        )}
                    </div>

                    <button type="button" onClick={buildList} disabled={selectedIds.size === 0}
                        className="mt-3 w-full py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                        Continue with {selectedIds.size} patient{selectedIds.size === 1 ? '' : 's'}
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <p className="text-sm text-gray-600 mb-3">
                        Check each patient and enter the number to dial. {readyCount} of {rows.length} ready.
                    </p>
                    <div className="max-h-[460px] overflow-y-auto space-y-2">
                        {rows.map((row, i) => {
                            const valid = !!toE164(row.phone);
                            return (
                                <div key={row.patient.id} className="grid grid-cols-1 md:grid-cols-[1.4fr_1.6fr_1fr] gap-3 items-start rounded-xl border border-gray-200 p-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 text-sm">{row.patient.name}</p>
                                        <p className="text-xs text-gray-500">{row.patient.mr_number || '—'}</p>
                                    </div>
                                    <div className="text-xs space-y-0.5">
                                        {agentParams(row).map(([k, v]) => (
                                            <p key={k} className="text-gray-600">
                                                <span className="text-gray-400">{k}:</span> <span className="font-semibold text-gray-800">{v}</span>
                                            </p>
                                        ))}
                                    </div>
                                    <div>
                                        <input value={row.phone} inputMode="numeric" placeholder="10-digit mobile"
                                            onChange={(e) => setRows((prev) => prev.map((r, j) => j === i ? { ...r, phone: e.target.value } : r))}
                                            className={`w-full px-3 py-2 rounded-lg border text-sm ${row.phone && !valid ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                                        {row.phone && !valid && <p className="text-[11px] text-red-600 mt-1">Not a valid mobile number</p>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex gap-2 mt-3">
                        <button type="button" onClick={() => setStep(1)}
                            className="px-4 py-2.5 rounded-xl font-semibold text-gray-700 bg-white border border-gray-300">Back</button>
                        <button type="button" onClick={lockList} disabled={readyCount !== rows.length || rows.length === 0}
                            className="flex-1 py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300">
                            Lock list &amp; continue
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-2">Call queue</p>
                        <div className="max-h-[520px] overflow-y-auto divide-y divide-gray-100">
                            {rows.map((row, i) => (
                                <button key={row.patient.id} type="button" onClick={() => setActiveIndex(i)}
                                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2 ${i === activeIndex ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                                    <span className="w-6 text-xs text-gray-400">{i + 1}</span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900 truncate">{row.patient.name}</span>
                                        <span className="block text-xs text-gray-500">{row.patient.mr_number || '—'}</span>
                                    </span>
                                    <StateChip state={row.state} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        {!current ? <p className="text-sm text-gray-500">Pick a patient.</p> : (
                            <>
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-bold text-gray-900">{current.patient.name}</p>
                                        <p className="text-xs text-gray-500">{current.patient.mr_number || '—'} · dialling ••••••{current.phone.replace(/\D/g, '').slice(-2)}</p>
                                    </div>
                                    <StateChip state={current.state} />
                                </div>

                                <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs space-y-0.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">What the agent will use</p>
                                    {agentParams(current).map(([k, v]) => (
                                        <p key={k} className="text-gray-600">
                                            <span className="text-gray-400">{k}:</span> <span className="font-semibold text-gray-800">{v}</span>
                                        </p>
                                    ))}
                                </div>

                                {current.state === 'idle' && (
                                    <button type="button" onClick={() => placeCall(activeIndex)}
                                        className="mt-3 w-full py-2.5 rounded-xl font-bold text-white bg-violet-600 hover:bg-violet-700">
                                        Place call to {current.patient.name}
                                    </button>
                                )}
                                {busy && (
                                    <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                                        {current.state === 'calling' ? 'Placing the call…' : 'Call in progress — the summary appears here when it ends.'}
                                    </p>
                                )}
                                {current.error && (
                                    <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 break-words">{current.error}</p>
                                )}
                                {current.summary && (
                                    <div className="mt-3 rounded-xl border border-gray-200 p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Agent's account of the call</p>
                                        {current.disposition && (
                                            <span className="inline-block mt-1 text-[11px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-800">
                                                {current.disposition.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        <p className="mt-1 text-sm text-gray-700 leading-relaxed whitespace-pre-line">{current.summary}</p>
                                    </div>
                                )}
                                {(current.state === 'done' || current.state === 'failed') && activeIndex < rows.length - 1 && (
                                    <button type="button" onClick={() => setActiveIndex(activeIndex + 1)}
                                        className="mt-3 w-full py-2.5 rounded-xl font-bold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100">
                                        Next patient →
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const StateChip: React.FC<{ state: RunState }> = ({ state }) => {
    const map: Record<RunState, [string, string]> = {
        idle: ['Not called', 'bg-gray-100 text-gray-600'],
        calling: ['Placing…', 'bg-amber-100 text-amber-800'],
        waiting: ['In progress', 'bg-amber-100 text-amber-800'],
        done: ['Done', 'bg-emerald-100 text-emerald-800'],
        failed: ['Failed', 'bg-red-100 text-red-700'],
    };
    const [label, cls] = map[state];
    return <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${cls}`}>{label}</span>;
};

/**
 * The call outline, so reception knows what the patient will hear.
 *
 * NOT the agent's prompt — that lives in the Sarvam console and is the single
 * source of truth. This is a plain-language summary of the flow, kept here so
 * nobody has to open the console to answer "what did it say to my patient?".
 * The Tamil is what a Tamil-language call sounds like; the agent mirrors the
 * patient's language from the opening.
 */
const CallScript: React.FC = () => (
    <div className="rounded-2xl border border-violet-200 bg-white p-4">
        <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-violet-700">Call script — what the patient hears</p>
            <p className="text-[11px] text-gray-400">Agent “Asha” · Sarvam app_version 8</p>
        </div>
        <p className="text-xs text-gray-500 mb-3">
            Summary of the flow, not the agent's prompt — that lives in the Sarvam console. The call opens in
            Tamil and follows the patient from there.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
                ['Greeting', 'வணக்கம், நான் ஆஷா, {hospital_name}-லிருந்து பேசுகிறேன். {patient_name} பேசுகிறீர்களா, அல்லது குடும்பத்தினரா?',
                    'Hello, this is Asha calling from {hospital_name}. Am I speaking with {patient_name}, or a family member?'],
                ['Why we called', 'உங்கள் மறு பரிசோதனை தேதி {review_date}. அது முடிந்து {days_overdue} நாட்கள் ஆகிவிட்டன.',
                    'Your review was due on {review_date} — that was {days_overdue} days ago.'],
                ['The ask', 'நீங்கள் எப்போது வர முடியும்? நேரம் ஒதுக்க வேண்டாம், OP நேரத்தில் வந்தால் போதும்.',
                    'When can you come? No appointment needed — just come during OP hours.'],
                ['Red flag', 'மூச்சுத் திணறல், வீக்கம், சிறுநீர் குறைவு இருந்தால் — உடனே வாருங்கள். முன் அலுவலகம்: {front_desk_number}',
                    'Breathlessness, swelling, reduced urine — come in now. Front desk: {front_desk_number}'],
            ].map(([label, ta, en]) => (
                <div key={label} className="rounded-xl border border-gray-200 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                    <p className="mt-1 text-gray-900 leading-relaxed">{ta}</p>
                    <p className="mt-1 text-xs text-gray-500 leading-relaxed">{en}</p>
                </div>
            ))}
        </div>
        <p className="mt-3 text-xs text-gray-500">
            The agent never moves an appointment. It records what the patient said; a human reschedules.
        </p>
    </div>
);

export default AICallCampaignPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import {
    FollowUpCallService,
    OUTCOME_META,
    type FollowUpCall,
} from '../../services/followUpCallService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Doctor {
    id: string;
    hospital_id: string;
    name?: string;
}

interface FollowUpCallsViewProps {
    doctor: Doctor;
}

interface ReviewWithCalls {
    id: string;
    patient_id: string;
    next_review_date: string | null;
    status: string;
    followup_notes?: string | null;
    patient?: {
        id: string;
        name: string;
        mr_number?: string;
        phone?: string;
    };
    calls: FollowUpCall[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso?: string | null) => {
    if (!iso) return '--';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${m[3]} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

const formatDateTime = (isoStr: string) => {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        + ' · '
        + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    pending:   { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Pending' },
    rescheduled: { bg: 'bg-blue-50',  text: 'text-blue-700',    label: 'Rescheduled' },
    completed: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Completed' },
    cancelled: { bg: 'bg-gray-100',   text: 'text-gray-500',    label: 'Cancelled' },
};

// ─── Patient Accordion ────────────────────────────────────────────────────────

const PatientCallHistory: React.FC<{ entry: ReviewWithCalls }> = ({ entry }) => {
    const [open, setOpen] = useState(false);
    const statusStyle = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending;
    const latestCall = entry.calls[0];

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
            {/* Collapsed header (always visible) */}
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 p-4 sm:p-5 text-left"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm leading-tight">
                            {entry.patient?.name || 'Unknown Patient'}
                        </span>
                        {entry.patient?.mr_number && (
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                MR: {entry.patient.mr_number}
                            </span>
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.label}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500">
                            Review: {formatDate(entry.next_review_date)}
                        </span>
                        {entry.calls.length > 0 ? (
                            <span className="text-xs font-medium text-gray-600">
                                {entry.calls.length} call{entry.calls.length !== 1 ? 's' : ''} logged
                            </span>
                        ) : (
                            <span className="text-xs text-gray-400">No calls logged</span>
                        )}
                    </div>
                    {/* Preview of latest call */}
                    {latestCall && (
                        <div className="mt-2 flex items-center gap-2">
                            <span className={`text-xs font-bold ${OUTCOME_META[latestCall.outcome].color}`}>
                                {OUTCOME_META[latestCall.outcome].icon} {OUTCOME_META[latestCall.outcome].label}
                            </span>
                            {latestCall.notes && (
                                <span className="text-[11px] text-gray-500 truncate max-w-[200px]">
                                    "{latestCall.notes}"
                                </span>
                            )}
                        </div>
                    )}
                    {/* Follow-up note preview */}
                    {entry.followup_notes && (
                        <div className="mt-1.5 flex items-start gap-1.5">
                            <svg className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span className="text-[11px] text-amber-700 truncate max-w-[240px]">{entry.followup_notes}</span>
                        </div>
                    )}
                </div>
                <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* Expanded call timeline */}
            {open && (
                <div className="border-t border-gray-100 px-4 sm:px-5 py-4 bg-gray-50/50 space-y-4">
                    {/* Follow-up notes from reception */}
                    {entry.followup_notes && (
                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                            <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <div>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">Reception Notes</p>
                                <p className="text-xs text-amber-800 leading-relaxed">{entry.followup_notes}</p>
                            </div>
                        </div>
                    )}
                    {entry.calls.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2 text-center">No calls have been logged for this review.</p>
                    ) : (
                        <ol className="relative border-l border-gray-200 ml-2 space-y-5">
                            {entry.calls.map((call, i) => {
                                const meta = OUTCOME_META[call.outcome];
                                return (
                                    <li key={call.id} className="ml-5">
                                        {/* Timeline dot */}
                                        <span
                                            className={`absolute -left-1.5 w-3 h-3 rounded-full border-2 border-white ${meta.bg.replace('bg-', 'bg-')} ${i === 0 ? 'ring-2 ring-offset-1 ring-gray-300' : ''}`}
                                            style={{ top: undefined }}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-xs font-bold ${meta.color}`}>
                                                    {meta.icon} {meta.label}
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    {formatDateTime(call.called_at)}
                                                </span>
                                                <span className="text-[10px] font-medium text-gray-500">
                                                    by {call.called_by_name}
                                                </span>
                                                {i === 0 && (
                                                    <span className="text-[10px] font-bold bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                                        Latest
                                                    </span>
                                                )}
                                            </div>
                                            {call.notes && (
                                                <p className="mt-1 text-xs text-gray-700 bg-white border border-gray-100 rounded-xl px-3 py-2 leading-relaxed">
                                                    {call.notes}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Bucket helpers ──────────────────────────────────────────────────────────

type DueBucket = 'all' | 'overdue' | 'due_today' | 'future';
type CallStatus = 'all' | 'with_calls' | 'no_calls';

const todayStr = () => new Date().toISOString().slice(0, 10);

const getBucket = (reviewDate: string | null): Exclude<DueBucket, 'all'> => {
    if (!reviewDate) return 'future';
    const today = todayStr();
    if (reviewDate < today) return 'overdue';
    if (reviewDate === today) return 'due_today';
    return 'future';
};

// ─── Main Component ───────────────────────────────────────────────────────────

const FollowUpCallsView: React.FC<FollowUpCallsViewProps> = ({ doctor }) => {
    const [entries, setEntries] = useState<ReviewWithCalls[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<CallStatus>('all');
    const [bucketFilter, setBucketFilter] = useState<DueBucket>('all');

    const fetchData = useCallback(async () => {
        if (!doctor?.id || !doctor?.hospital_id) return;
        setIsLoading(true);
        try {
            // Fetch this doctor's recent reviews — no followup_notes in main select for resilience
            const { data: reviews, error } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select(`
                    id, patient_id, next_review_date, status,
                    patient:hospital_patients(id, name, mr_number, phone)
                `)
                .eq('hospital_id', doctor.hospital_id)
                .eq('doctor_id', doctor.id)
                .order('next_review_date', { ascending: false })
                .limit(200);

            if (error) throw error;
            if (!reviews || reviews.length === 0) { setEntries([]); return; }

            // Try to fetch followup_notes separately — silently skip if column not yet migrated
            const reviewIds = (reviews as any[]).map((r: any) => r.id) as string[];
            const notesMap: Record<string, string | null> = {};
            try {
                const { data: notesData } = await (supabase as any)
                    .from('hospital_patient_reviews')
                    .select('id, followup_notes')
                    .in('id', reviewIds);
                (notesData || []).forEach((n: any) => { notesMap[n.id] = n.followup_notes ?? null; });
            } catch { /* column not yet created */ }

            // Bulk-fetch all calls per review
            const callsByReview: Record<string, FollowUpCall[]> = {};
            reviewIds.forEach(rid => { callsByReview[rid] = []; });

            // We need calls per review — use a direct review-based query
            const { data: callData } = await (supabase as any)
                .from('patient_follow_up_calls')
                .select('*')
                .in('review_id', reviewIds)
                .order('called_at', { ascending: false });

            (callData || []).forEach((c: FollowUpCall) => {
                if (!callsByReview[c.review_id]) callsByReview[c.review_id] = [];
                callsByReview[c.review_id].push(c);
            });

            const built: ReviewWithCalls[] = (reviews as any[]).map((r: any) => ({
                ...r,
                followup_notes: notesMap[r.id] ?? null,
                calls: callsByReview[r.id] || [],
            }));

            setEntries(built);
        } catch (err: any) {
            console.error('FollowUpCallsView fetch error:', err);
            toast.error('Failed to load call history');
        } finally {
            setIsLoading(false);
        }
    }, [doctor?.id, doctor?.hospital_id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim();
        return entries.filter(e => {
            if (q) {
                const text = `${e.patient?.name} ${e.patient?.mr_number} ${e.patient?.phone}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            if (statusFilter === 'with_calls' && e.calls.length === 0) return false;
            if (statusFilter === 'no_calls' && e.calls.length > 0) return false;
            if (bucketFilter !== 'all' && getBucket(e.next_review_date) !== bucketFilter) return false;
            return true;
        });
    }, [entries, query, statusFilter, bucketFilter]);

    const totalCalls = useMemo(() => entries.reduce((s, e) => s + e.calls.length, 0), [entries]);

    return (
        <div className="space-y-5">
            {/* Section header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-gray-900">Follow-up Call History</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {entries.length} reviews · {totalCalls} calls logged
                    </p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={isLoading}
                    className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Search + filters */}
            <div className="flex flex-col gap-2.5">
                {/* Search row */}
                <div className="relative">
                    <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search patient name, MR, phone…"
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                    />
                </div>
                {/* Dropdown filters row */}
                <div className="flex gap-2">
                    {/* Due date bucket */}
                    <div className="relative flex-1">
                        <select
                            value={bucketFilter}
                            onChange={e => setBucketFilter(e.target.value as DueBucket)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 cursor-pointer"
                        >
                            <option value="all">All Due Dates</option>
                            <option value="overdue">Overdue</option>
                            <option value="due_today">Due Today</option>
                            <option value="future">Future</option>
                        </select>
                        <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                    {/* Call status */}
                    <div className="relative flex-1">
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as CallStatus)}
                            className="w-full appearance-none bg-white border border-gray-200 rounded-xl pl-3 pr-8 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 cursor-pointer"
                        >
                            <option value="all">All Call Status</option>
                            <option value="with_calls">Called</option>
                            <option value="no_calls">Not Called</option>
                        </select>
                        <svg className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="py-16 text-center">
                    <div className="w-7 h-7 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Loading call history…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
                    <p className="text-sm font-semibold text-gray-500">No records found</p>
                    {(query || statusFilter !== 'all' || bucketFilter !== 'all') && (
                        <button
                            onClick={() => { setQuery(''); setStatusFilter('all'); setBucketFilter('all'); }}
                            className="mt-2 text-xs text-blue-600 hover:underline"
                        >
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(entry => (
                        <PatientCallHistory key={entry.id} entry={entry} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FollowUpCallsView;

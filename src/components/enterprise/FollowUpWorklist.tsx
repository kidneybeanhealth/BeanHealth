import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
    FollowUpCallService,
    OUTCOME_META,
    type FollowUpCall,
} from '../../services/followUpCallService';
import LogCallModal from '../modals/LogCallModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'pending' | 'rescheduled' | 'completed' | 'cancelled';

interface WorklistRow {
    id: string;
    patient_id: string;
    doctor_id: string | null;
    next_review_date: string | null;
    status: ReviewStatus;
    followup_notes?: string | null;
    patient?: {
        id: string;
        name: string;
        mr_number?: string;
        phone?: string;
        age?: number;
    };
    doctor?: {
        name?: string;
        specialty?: string;
    };
}

type WorklistBucket = 'overdue' | 'due_today' | 'next_7_days';
type CallFilter = 'all' | 'not_called_today';
type BucketFilter = 'all' | 'overdue' | 'due_today' | 'next_7_days';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toLocalISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const daysDiff = (isoDate: string): number => {
    const today = toLocalISO(new Date());
    const ms = new Date(today).getTime() - new Date(isoDate).getTime();
    return Math.round(ms / 86_400_000);
};

const getBucket = (row: WorklistRow): WorklistBucket | null => {
    if (row.status === 'completed' || row.status === 'cancelled') return null;
    if (!row.next_review_date) return null;

    const today = toLocalISO(new Date());
    const in7 = toLocalISO(new Date(Date.now() + 7 * 86_400_000));

    if (row.next_review_date < today) return 'overdue';
    if (row.next_review_date === today) return 'due_today';
    if (row.next_review_date <= in7) return 'next_7_days';
    return null;
};

const formatDate = (iso?: string | null) => {
    if (!iso) return '--';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${m[3]} ${months[parseInt(m[2], 10) - 1]} ${m[1]}`;
};

const wasCalledToday = (call?: FollowUpCall): boolean => {
    if (!call) return false;
    return call.called_at.startsWith(toLocalISO(new Date()));
};

const BUCKET_CONFIG = {
    overdue: {
        label: 'Overdue',
        leftBorder: 'border-l-red-500',
        badgeBg: 'bg-red-50',
        badgeText: 'text-red-700',
        badgeBorder: 'border-red-200',
        dot: 'bg-red-500',
        headerBg: 'bg-red-50/60',
        headerText: 'text-red-700',
        headerBorder: 'border-red-100',
    },
    due_today: {
        label: 'Due Today',
        leftBorder: 'border-l-amber-500',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-700',
        badgeBorder: 'border-amber-200',
        dot: 'bg-amber-500',
        headerBg: 'bg-amber-50/60',
        headerText: 'text-amber-700',
        headerBorder: 'border-amber-100',
    },
    next_7_days: {
        label: 'Due in 7 Days',
        leftBorder: 'border-l-blue-500',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200',
        dot: 'bg-blue-500',
        headerBg: 'bg-blue-50/60',
        headerText: 'text-blue-700',
        headerBorder: 'border-blue-100',
    },
} as const;

// ─── Sub-component: Patient Card ──────────────────────────────────────────────

interface PatientCardProps {
    row: WorklistRow;
    bucket: WorklistBucket;
    lastCall?: FollowUpCall;
    hospitalId: string;
    onCallLogged: () => void;
    onNoteSaved: () => void;
    onReschedule: (row: WorklistRow) => void;
    onMarkComplete: (row: WorklistRow) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({
    row, bucket, lastCall, hospitalId, onCallLogged, onNoteSaved, onReschedule, onMarkComplete,
}) => {
    const [showLogModal, setShowLogModal] = useState(false);
    const [noteText, setNoteText] = useState(row.followup_notes || '');
    const [editingNote, setEditingNote] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    const handleSaveNote = async () => {
        if (noteText === (row.followup_notes || '')) { setEditingNote(false); return; }
        setIsSavingNote(true);
        try {
            await (supabase as any)
                .from('hospital_patient_reviews')
                .update({ followup_notes: noteText.trim() || null, updated_at: new Date().toISOString() })
                .eq('id', row.id);
            toast.success('Note saved');
            setEditingNote(false);
            onNoteSaved();
        } catch (err: any) {
            toast.error('Failed to save note');
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleCancelNote = () => {
        setEditingNote(false);
        setNoteText(row.followup_notes || '');
    };
    const cfg = BUCKET_CONFIG[bucket];
    const calledToday = wasCalledToday(lastCall);
    const overdueDays = bucket === 'overdue' && row.next_review_date ? daysDiff(row.next_review_date) : 0;
    const daysUntil = bucket === 'next_7_days' && row.next_review_date
        ? Math.round((new Date(row.next_review_date).getTime() - new Date(toLocalISO(new Date())).getTime()) / 86_400_000)
        : 0;

    return (
        <>
            <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm border-l-4 ${cfg.leftBorder} overflow-hidden transition-shadow hover:shadow-md`}>
                <div className="p-4 sm:p-5">
                    {/* Top row: patient info + badges */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 text-base leading-tight truncate">
                                    {row.patient?.name || 'Unknown Patient'}
                                </h3>
                                {calledToday && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Called today
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                {row.patient?.mr_number && (
                                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                        MR: {row.patient.mr_number}
                                    </span>
                                )}
                                {row.doctor?.name && (
                                    <span className="text-xs text-gray-500">
                                        Dr. {row.doctor.name.replace(/^dr\.?\s*/i, '')}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Date chip */}
                        <div className={`shrink-0 flex flex-col items-end gap-1`}>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-xl border text-xs font-bold ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}>
                                {formatDate(row.next_review_date)}
                            </span>
                            {bucket === 'overdue' && overdueDays > 0 && (
                                <span className="text-[10px] font-bold text-red-600">
                                    {overdueDays} day{overdueDays !== 1 ? 's' : ''} overdue
                                </span>
                            )}
                            {bucket === 'due_today' && (
                                <span className="text-[10px] font-bold text-amber-600">Due today</span>
                            )}
                            {bucket === 'next_7_days' && daysUntil > 0 && (
                                <span className="text-[10px] font-bold text-blue-600">
                                    in {daysUntil} day{daysUntil !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Last call info */}
                    {lastCall ? (
                        <div className="mt-3 flex items-start gap-2.5 bg-gray-50 rounded-xl px-3.5 py-2.5">
                            <span className={`shrink-0 mt-0.5 text-sm font-bold ${OUTCOME_META[lastCall.outcome].color}`}>
                                {OUTCOME_META[lastCall.outcome].icon}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-xs font-bold ${OUTCOME_META[lastCall.outcome].color}`}>
                                        {OUTCOME_META[lastCall.outcome].label}
                                    </span>
                                    <span className="text-[10px] text-gray-400">
                                        {new Date(lastCall.called_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        {' · '}{lastCall.called_by_name}
                                    </span>
                                </div>
                                {lastCall.notes && (
                                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">"{lastCall.notes}"</p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-3 flex items-center gap-2 bg-gray-50 rounded-xl px-3.5 py-2.5">
                            <span className="text-gray-300 text-sm">📵</span>
                            <span className="text-xs text-gray-400 font-medium">Never called</span>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3.5 flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setShowLogModal(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black transition-colors shadow-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Log Call
                        </button>
                        <button
                            onClick={() => onReschedule(row)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Reschedule
                        </button>
                        <button
                            onClick={() => onMarkComplete(row)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-emerald-700 border border-emerald-200 text-xs font-bold hover:bg-emerald-50 transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mark Done
                        </button>
                    </div>

                    {/* Follow-up Notes */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Follow-up Notes
                            </span>
                            {!editingNote && (
                                <button
                                    onClick={() => { setEditingNote(true); setTimeout(() => noteRef.current?.focus(), 40); }}
                                    className="text-[10px] font-semibold text-blue-600 hover:underline"
                                >
                                    {noteText ? 'Edit' : '+ Add note'}
                                </button>
                            )}
                        </div>
                        {editingNote ? (
                            <div>
                                <textarea
                                    ref={noteRef}
                                    value={noteText}
                                    onChange={e => setNoteText(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') handleCancelNote(); }}
                                    rows={2}
                                    placeholder="Add notes visible to the doctor…"
                                    className="w-full text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
                                />
                                <div className="flex gap-2 mt-1.5">
                                    <button
                                        onClick={handleSaveNote}
                                        disabled={isSavingNote}
                                        className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-bold hover:bg-black disabled:opacity-50 transition-colors"
                                    >
                                        {isSavingNote ? 'Saving…' : 'Save'}
                                    </button>
                                    <button
                                        onClick={handleCancelNote}
                                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-semibold hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : noteText ? (
                            <p
                                onClick={() => { setEditingNote(true); setTimeout(() => noteRef.current?.focus(), 40); }}
                                className="text-xs text-gray-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 leading-relaxed cursor-pointer hover:bg-amber-100 transition-colors"
                            >
                                {noteText}
                            </p>
                        ) : (
                            <button
                                onClick={() => { setEditingNote(true); setTimeout(() => noteRef.current?.focus(), 40); }}
                                className="text-xs text-gray-400 italic hover:text-gray-600 w-full text-left px-1 transition-colors"
                            >
                                No notes yet — tap to add…
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showLogModal && (
                <LogCallModal
                    reviewId={row.id}
                    patientName={row.patient?.name || 'Patient'}
                    patientPhone={row.patient?.phone}
                    hospitalId={hospitalId}
                    patientId={row.patient_id}
                    onClose={() => setShowLogModal(false)}
                    onLogged={() => { setShowLogModal(false); onCallLogged(); }}
                />
            )}
        </>
    );
};

// ─── Main Component ───────────────────────────────────── ─ ─  ─   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ───────

const FollowUpWorklist: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [rows, setRows] = useState<WorklistRow[]>([]);
    const [lastCallMap, setLastCallMap] = useState<Record<string, FollowUpCall>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [callFilter, setCallFilter] = useState<CallFilter>('all');
    const [bucketFilter, setBucketFilter] = useState<BucketFilter>('all');
    const [rescheduleTarget, setRescheduleTarget] = useState<WorklistRow | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [isSavingReschedule, setIsSavingReschedule] = useState(false);

    const fetchData = useCallback(async () => {
        if (!profile?.id) return;
        setIsLoading(true);
        try {
            const in7 = toLocalISO(new Date(Date.now() + 7 * 86_400_000));

            // Main query — no followup_notes here so it works even before migration
            const { data, error } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select(`
                    id, patient_id, doctor_id,
                    next_review_date, status,
                    patient:hospital_patients(id, name, mr_number, phone, age),
                    doctor:hospital_doctors(id, name, specialty)
                `)
                .eq('hospital_id', profile.id)
                .in('status', ['pending', 'rescheduled'])
                .lte('next_review_date', in7)
                .order('next_review_date', { ascending: true });

            if (error) throw error;

            let reviewRows = (data || []) as WorklistRow[];

            // Try to fetch followup_notes separately — silently skip if column not yet migrated
            if (reviewRows.length > 0) {
                try {
                    const ids = reviewRows.map(r => r.id);
                    const { data: notesData } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .select('id, followup_notes')
                        .in('id', ids);
                    if (notesData) {
                        const notesMap: Record<string, string | null> = {};
                        (notesData as any[]).forEach(n => { notesMap[n.id] = n.followup_notes ?? null; });
                        reviewRows = reviewRows.map(r => ({ ...r, followup_notes: notesMap[r.id] ?? null }));
                    }
                } catch {
                    // Column not yet created — notes will just be empty, app still works
                }
            }

            setRows(reviewRows);

            // Bulk-fetch last call for all visible reviews
            if (reviewRows.length > 0) {
                try {
                    const ids = reviewRows.map(r => r.id);
                    const callMap = await FollowUpCallService.getLastCallForEachReview(ids);
                    setLastCallMap(callMap);
                } catch {
                    setLastCallMap({});
                }
            } else {
                setLastCallMap({});
            }
        } catch (err: any) {
            console.error('FollowUpWorklist fetch error:', err);
            toast.error(err?.message || 'Failed to load worklist');
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Count by bucket
    const counts = useMemo(() => {
        const acc = { overdue: 0, due_today: 0, next_7_days: 0, total: 0 };
        rows.forEach(r => {
            const b = getBucket(r);
            if (b) { acc[b]++; acc.total++; }
        });
        return acc;
    }, [rows]);

    // Filtered list
    const filteredByBucket = useMemo<Record<WorklistBucket, WorklistRow[]>>(() => {
        const q = query.toLowerCase().trim();
        const today = toLocalISO(new Date());

        const passes = (row: WorklistRow) => {
            if (q) {
                const text = `${row.patient?.name} ${row.patient?.mr_number} ${row.patient?.phone}`.toLowerCase();
                if (!text.includes(q)) return false;
            }
            if (callFilter === 'not_called_today') {
                const last = lastCallMap[row.id];
                if (wasCalledToday(last)) return false;
            }
            return true;
        };

        const result: Record<WorklistBucket, WorklistRow[]> = {
            overdue: [],
            due_today: [],
            next_7_days: [],
        };

        rows.forEach(row => {
            const b = getBucket(row);
            if (!b) return;
            if (bucketFilter !== 'all' && b !== bucketFilter) return;
            if (passes(row)) result[b].push(row);
        });

        return result;
    }, [rows, query, callFilter, bucketFilter, lastCallMap]);

    const handleMarkComplete = async (row: WorklistRow) => {
        if (!confirm(`Mark ${row.patient?.name || 'this patient'} as completed?`)) return;
        try {
            await (supabase as any)
                .from('hospital_patient_reviews')
                .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
                .eq('id', row.id);
            toast.success('Marked as completed');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to update');
        }
    };

    const handleOpenReschedule = (row: WorklistRow) => {
        const today = toLocalISO(new Date());
        setRescheduleTarget(row);
        setRescheduleDate(row.next_review_date && row.next_review_date >= today ? row.next_review_date : today);
    };

    const handleRescheduleSubmit = async () => {
        if (!rescheduleTarget || !rescheduleDate) return;
        const today = toLocalISO(new Date());
        if (rescheduleDate < today) { toast.error('Date cannot be in the past'); return; }
        setIsSavingReschedule(true);
        try {
            await (supabase as any)
                .from('hospital_patient_reviews')
                .update({
                    next_review_date: rescheduleDate,
                    status: 'rescheduled',
                    cancelled_at: null,
                    completed_at: null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', rescheduleTarget.id);
            toast.success('Review rescheduled');
            setRescheduleTarget(null);
            setRescheduleDate('');
            fetchData();
        } catch (err: any) {
            toast.error(err.message || 'Failed to reschedule');
        } finally {
            setIsSavingReschedule(false);
        }
    };

    const totalVisible = Object.values(filteredByBucket).reduce((s, a) => s + a.length, 0);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/enterprise-dashboard/reception/dashboard')}
                            className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </button>
                        <div>
                            <h1 className="text-base font-bold text-gray-900 leading-tight">Follow-up Worklist</h1>
                            <p className="text-[11px] text-gray-500 leading-tight">
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchData}
                        className="p-2 rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                        title="Refresh"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Summary row — click to filter by bucket */}
                <div className="grid grid-cols-3 gap-3">
                    {((['overdue', 'due_today', 'next_7_days'] as WorklistBucket[])).map(b => {
                        const cfg = BUCKET_CONFIG[b];
                        const c = counts[b];
                        const active = bucketFilter === b;
                        return (
                            <button
                                key={b}
                                onClick={() => setBucketFilter(active ? 'all' : b)}
                                className={`rounded-2xl border px-4 py-3.5 text-left transition-all ${
                                    active
                                        ? `${cfg.headerBg} ${cfg.headerBorder} ring-2 ring-offset-1 ${cfg.dot.replace('bg-', 'ring-')}`
                                        : `${cfg.headerBg} ${cfg.headerBorder} hover:opacity-80`
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                    <span className={`text-xs font-bold uppercase tracking-wide ${cfg.headerText}`}>{cfg.label}</span>
                                    {active && <span className={`ml-auto text-[10px] font-bold ${cfg.headerText} opacity-70`}>✕</span>}
                                </div>
                                <span className={`text-3xl font-black ${cfg.headerText}`}>{c}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Search + filter bar */}
                <div className="flex flex-col gap-2.5">
                    <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                            <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search name, MR number…"
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 transition-colors"
                            />
                        </div>
                        <div className="flex gap-2">
                            {(['all', 'not_called_today'] as CallFilter[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setCallFilter(f)}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${callFilter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                >
                                    {f === 'all' ? 'All' : 'Not called today'}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Bucket filter chips */}
                    <div className="flex flex-wrap gap-2">
                        {([['all', 'All buckets', 'bg-gray-900 text-white border-gray-900', 'bg-white text-gray-600 border-gray-200'],
                          ['overdue', `Overdue (${counts.overdue})`, 'bg-red-600 text-white border-red-600', 'bg-white text-red-700 border-red-200'],
                          ['due_today', `Due Today (${counts.due_today})`, 'bg-amber-500 text-white border-amber-500', 'bg-white text-amber-700 border-amber-200'],
                          ['next_7_days', `Due in 7 Days (${counts.next_7_days})`, 'bg-blue-600 text-white border-blue-600', 'bg-white text-blue-700 border-blue-200'],
                        ] as [BucketFilter, string, string, string][]).map(([val, label, activeClass, inactiveClass]) => (
                            <button
                                key={val}
                                onClick={() => setBucketFilter(val)}
                                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                                    bucketFilter === val ? activeClass : `${inactiveClass} hover:opacity-80`
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoading ? (
                    <div className="py-24 text-center">
                        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Loading worklist…</p>
                    </div>
                ) : totalVisible === 0 ? (
                    <div className="py-24 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-base font-semibold text-gray-700">All clear!</p>
                        <p className="text-sm text-gray-400 mt-1">
                            {query || callFilter !== 'all' || bucketFilter !== 'all'
                                ? 'No patients match your current filter.'
                                : 'No patients are overdue or due within 7 days.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {(['overdue', 'due_today', 'next_7_days'] as WorklistBucket[]).map(b => {
                            const list = filteredByBucket[b];
                            if (list.length === 0) return null;
                            const cfg = BUCKET_CONFIG[b];
                            return (
                                <section key={b}>
                                    {/* Section header */}
                                    <div className={`flex items-center gap-2.5 py-2 mb-3 border-b ${cfg.headerBorder}`}>
                                        <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                                        <h2 className={`text-xs font-bold uppercase tracking-wider ${cfg.headerText}`}>
                                            {cfg.label}
                                        </h2>
                                        <span className={`ml-auto text-xs font-bold ${cfg.headerText} bg-white border ${cfg.badgeBorder} px-2 py-0.5 rounded-full`}>
                                            {list.length} patient{list.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {list.map(row => (
                                            <PatientCard
                                                key={row.id}
                                                row={row}
                                                bucket={b}
                                                lastCall={lastCallMap[row.id]}
                                                hospitalId={profile!.id}
                                                onCallLogged={fetchData}
                                                onNoteSaved={fetchData}
                                                onReschedule={handleOpenReschedule}
                                                onMarkComplete={handleMarkComplete}
                                            />
                                        ))}
                                    </div>
                                </section>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Reschedule modal */}
            {rescheduleTarget && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-base font-bold text-gray-900 mb-1">Reschedule Review</h3>
                        <p className="text-sm text-gray-500 mb-4">{rescheduleTarget.patient?.name}</p>
                        <input
                            type="date"
                            value={rescheduleDate}
                            onChange={e => setRescheduleDate(e.target.value)}
                            min={toLocalISO(new Date())}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                        <div className="mt-4 flex gap-3">
                            <button onClick={() => setRescheduleTarget(null)} className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200">
                                Cancel
                            </button>
                            <button
                                onClick={handleRescheduleSubmit}
                                disabled={isSavingReschedule}
                                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-60"
                            >
                                {isSavingReschedule ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FollowUpWorklist;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PrescriptionModal from '../modals/PrescriptionModal';

type ReviewStatus = 'pending' | 'rescheduled' | 'completed' | 'cancelled';
type ReviewBucket = 'all' | 'overdue' | 'due_today' | 'due_tomorrow' | 'upcoming' | 'completed' | 'cancelled';
type CallStatus = 'picked' | 'not_picked' | 'busy' | 'not_reachable';

interface ReviewRow {
    id: string;
    patient_id: string;
    doctor_id: string | null;
    source_prescription_id: string | null;
    next_review_date: string | null;
    tests_to_review: string | null;
    specialists_to_review: string | null;
    status: ReviewStatus;
    completed_at: string | null;
    cancelled_at: string | null;
    patient?: {
        id: string;
        name: string;
        mr_number?: string;
        phone?: string;
        age?: number;
        father_husband_name?: string;
        place?: string;
        token_number?: string;
        beanhealth_id?: string;
    };
    doctor?: {
        id?: string;
        name?: string;
        specialty?: string;
    };
}

interface FollowupLog {
    id: string;
    review_id: string;
    patient_id: string;
    called_at: string;
    call_status: CallStatus;
    patient_response: string | null;
    next_followup_date: string | null;
    attended: boolean | null;
    created_by_name: string | null;
    created_at: string;
}

const toISODateLocal = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const formatDDMMYYYY = (value?: string | null): string => {
    if (!value) return '--';
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
};

const formatDateTime = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
    });
};

const bucketLabel = (bucket: ReviewBucket): string => {
    if (bucket === 'overdue') return 'Overdue';
    if (bucket === 'due_today') return 'Due Today';
    if (bucket === 'due_tomorrow') return 'Due Tomorrow';
    if (bucket === 'upcoming') return 'Upcoming';
    if (bucket === 'completed') return 'Completed';
    if (bucket === 'cancelled') return 'Cancelled';
    return 'All';
};

const statusChipClass = (status: ReviewStatus): string => {
    if (status === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'cancelled') return 'bg-gray-100 text-gray-600 border-gray-200';
    if (status === 'rescheduled') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-orange-100 text-orange-700 border-orange-200';
};

const bucketChipClass = (bucket: ReviewBucket): string => {
    if (bucket === 'overdue') return 'bg-red-100 text-red-700 border-red-200';
    if (bucket === 'due_today') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (bucket === 'due_tomorrow') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (bucket === 'upcoming') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (bucket === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (bucket === 'cancelled') return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getBucket = (review: ReviewRow): ReviewBucket => {
    if (review.status === 'completed') return 'completed';
    if (review.status === 'cancelled') return 'cancelled';
    if (!review.next_review_date) return 'upcoming';
    const today = toISODateLocal(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = toISODateLocal(tomorrowDate);
    if (review.next_review_date < today) return review.status === 'rescheduled' ? 'upcoming' : 'overdue';
    if (review.next_review_date === today) return 'due_today';
    if (review.next_review_date === tomorrow) return 'due_tomorrow';
    return 'upcoming';
};

const CALL_STATUS_META: Record<CallStatus, { label: string; color: string; bg: string; border: string }> = {
    picked:        { label: 'Picked Up',    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' },
    not_picked:    { label: 'Not Picked',   color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-300'     },
    busy:          { label: 'Busy / Call Back', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300'   },
    not_reachable: { label: 'Not Reachable', color: 'text-gray-600',   bg: 'bg-gray-50',    border: 'border-gray-300'    },
};

// ─────────────────────────────────────────────────────────────────────────────
// CallLogModal
// ─────────────────────────────────────────────────────────────────────────────

interface CallLogModalProps {
    review: ReviewRow;
    history: FollowupLog[];
    submitting: boolean;
    onClose: () => void;
    onSubmit: (status: CallStatus, notes: string, nextDate: string, attended: boolean | null) => Promise<void>;
}

const CallLogModal: React.FC<CallLogModalProps> = ({ review, history, submitting, onClose, onSubmit }) => {
    const [status, setStatus] = useState<CallStatus>('picked');
    const [notes, setNotes] = useState('');
    const [nextDate, setNextDate] = useState('');
    const [attended, setAttended] = useState<boolean | null>(null);
    const notesRef = useRef<HTMLTextAreaElement>(null);

    const needsFollowupDate = status === 'not_picked' || status === 'busy' || status === 'not_reachable';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (status === 'not_picked' && !nextDate) {
            toast.error('A callback date is required when the call was not picked.');
            return;
        }
        await onSubmit(status, notes, nextDate, attended);
        setStatus('picked'); setNotes(''); setNextDate(''); setAttended(null);
    };

    const callStatusIcons: Record<CallStatus, React.ReactElement> = {
        picked: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
        ),
        not_picked: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        busy: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        not_reachable: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
        ),
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-green-700/20 flex items-start justify-between gap-3 bg-gradient-to-r from-green-600 to-green-700 rounded-t-2xl">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Log Follow-up Call
                        </h3>
                        <p className="text-green-100 text-sm mt-0.5 font-medium">
                            {review.patient?.name || 'Patient'}
                            {review.patient?.phone && (
                                <span className="ml-2 font-mono bg-green-700/50 px-2 py-0.5 rounded-full text-xs">{review.patient.phone}</span>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-green-100 hover:text-white hover:bg-green-700/50 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        {/* Info strip */}
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-1 font-semibold">
                                Review: {formatDDMMYYYY(review.next_review_date)}
                            </span>
                            {review.doctor?.name && (
                                <span className="bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 font-medium">
                                    Dr. {review.doctor.name}
                                </span>
                            )}
                            {history.length > 0 && (
                                <span className="bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1 font-semibold">
                                    {history.length} prior call{history.length > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>

                        {/* Call Status selector */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                                Call Status <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(Object.keys(CALL_STATUS_META) as CallStatus[]).map((s) => {
                                    const meta = CALL_STATUS_META[s];
                                    const isSelected = status === s;
                                    return (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setStatus(s)}
                                            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all duration-150 ${
                                                isSelected
                                                    ? `${meta.bg} ${meta.color} ${meta.border} shadow-sm scale-[1.02]`
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className={isSelected ? meta.color : 'text-gray-400'}>{callStatusIcons[s]}</span>
                                            {meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Attended — only for picked */}
                        {status === 'picked' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2.5">
                                    Did the patient attend / confirm attendance?
                                </label>
                                <div className="flex gap-3">
                                    {([{ val: true, label: 'Yes, Attended', icon: '✓', cls: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
                                       { val: false, label: 'No / Not Yet', icon: '✗', cls: 'text-red-600 border-red-300 bg-red-50' }
                                    ] as const).map(({ val, label, icon, cls }) => (
                                        <button
                                            key={String(val)}
                                            type="button"
                                            onClick={() => setAttended(attended === val ? null : val)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all duration-150 ${
                                                attended === val ? cls + ' shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <span className="text-base leading-none">{icon}</span> {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Callback date — for non-picked */}
                        {needsFollowupDate && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                    Schedule Call Back Date
                                    {status === 'not_picked' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <input
                                    type="date"
                                    value={nextDate}
                                    onChange={(e) => setNextDate(e.target.value)}
                                    min={toISODateLocal(new Date())}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-colors"
                                />
                                {status === 'not_picked'
                                    ? <p className="text-xs text-red-500 mt-1">Required — schedule a callback date for unanswered calls.</p>
                                    : <p className="text-xs text-gray-500 mt-1">Leave blank if no specific callback planned.</p>}
                            </div>
                        )}

                        {/* Patient response notes */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Patient Response / Notes
                            </label>
                            <textarea
                                ref={notesRef}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder={
                                    status === 'picked'
                                        ? 'e.g. Patient confirmed appointment, mentioned they feel better...'
                                        : status === 'not_picked'
                                        ? 'e.g. Called twice, no answer. Will retry tomorrow.'
                                        : status === 'busy'
                                        ? 'e.g. Patient said busy, asked to call after 5 PM.'
                                        : 'e.g. Number seems switched off. Will try alternate contact.'
                                }
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none transition-colors"
                            />
                        </div>

                        <div className="flex gap-3 pt-1">
                            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors">
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                            >
                                {submitting ? 'Saving...' : 'Save Call Log'}
                            </button>
                        </div>
                    </form>

                    {/* Call History Timeline */}
                    {history.length > 0 && (
                        <div className="px-6 pb-6 border-t border-gray-100 pt-5">
                            <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Call History ({history.length})
                            </h4>
                            <div className="space-y-3">
                                {history.map((log, idx) => {
                                    const meta = CALL_STATUS_META[log.call_status];
                                    return (
                                        <div key={log.id} className={`relative pl-4 border-l-2 ${idx === 0 ? 'border-green-400' : 'border-gray-200'}`}>
                                            <div className={`absolute -left-1.5 top-1.5 w-3 h-3 rounded-full ${idx === 0 ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <div className={`p-3 rounded-xl border ${meta.bg} ${meta.border}`}>
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className={`text-xs font-bold ${meta.color}`}>{meta.label}</span>
                                                    <span className="text-[11px] text-gray-500">{formatDateTime(log.called_at)}</span>
                                                </div>
                                                {log.attended !== null && (
                                                    <p className={`text-xs font-semibold mb-1 ${log.attended ? 'text-emerald-700' : 'text-red-600'}`}>
                                                        {log.attended ? '✓ Patient attended' : '✗ Patient did not attend'}
                                                    </p>
                                                )}
                                                {log.patient_response && (
                                                    <p className="text-xs text-gray-700 leading-relaxed">{log.patient_response}</p>
                                                )}
                                                {log.next_followup_date && (
                                                    <p className="text-xs text-amber-700 font-semibold mt-1.5">
                                                        📅 Call back on: {formatDDMMYYYY(log.next_followup_date)}
                                                    </p>
                                                )}
                                                {log.created_by_name && (
                                                    <p className="text-[11px] text-gray-400 mt-1">By {log.created_by_name}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main TrackPatientsPage
// ─────────────────────────────────────────────────────────────────────────────

interface TrackPatientsPageProps {
    onBack?: () => void;
    readOnly?: boolean;
}

const TrackPatientsPage: React.FC<TrackPatientsPageProps> = ({ onBack, readOnly = false }) => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [followupLogs, setFollowupLogs] = useState<FollowupLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [bucketFilter, setBucketFilter] = useState<ReviewBucket>('all');
    const [rescheduleReview, setRescheduleReview] = useState<ReviewRow | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [selectedPatientDetails, setSelectedPatientDetails] = useState<any>(null);
    const [showPatientPopup, setShowPatientPopup] = useState(false);
    const [selectedPrintPrescription, setSelectedPrintPrescription] = useState<any>(null);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
    const [callLogReview, setCallLogReview] = useState<ReviewRow | null>(null);
    const [callLogSubmitting, setCallLogSubmitting] = useState(false);
    const [callLogHistory, setCallLogHistory] = useState<FollowupLog[]>([]);

    const fetchReviews = useCallback(async () => {
        if (!profile?.id) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('hospital_patient_reviews' as any)
                .select(`
                    id,
                    patient_id,
                    doctor_id,
                    source_prescription_id,
                    next_review_date,
                    tests_to_review,
                    specialists_to_review,
                    status,
                    completed_at,
                    cancelled_at,
                    patient:hospital_patients(id, name, mr_number, phone, age, father_husband_name, place, token_number, beanhealth_id),
                    doctor:hospital_doctors(id, name, specialty)
                `)
                .eq('hospital_id', profile.id)
                .order('next_review_date', { ascending: true, nullsFirst: false });

            if (error) throw error;
            setReviews((data || []) as ReviewRow[]);
        } catch (error: any) {
            console.error('Error fetching hospital_patient_reviews:', error);
            toast.error(error.message || 'Failed to load tracked patients');
        } finally {
            setIsLoading(false);
        }
    }, [profile?.id]);

    const fetchFollowupLogs = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await (supabase as any)
                .from('hospital_patient_followups')
                .select('*')
                .eq('hospital_id', profile.id)
                .order('called_at', { ascending: false });
            if (error) throw error;
            setFollowupLogs((data || []) as FollowupLog[]);
        } catch (err: any) {
            console.error('Error fetching followup logs:', err);
        }
    }, [profile?.id]);

    useEffect(() => {
        fetchReviews();
        fetchFollowupLogs();
    }, [fetchReviews, fetchFollowupLogs]);

    useEffect(() => {
        const fetchHospitalLogo = async () => {
            if (!profile?.id) return;
            try {
                const { data } = await (supabase as any)
                    .from('hospital_profiles')
                    .select('avatar_url')
                    .eq('id', profile.id)
                    .maybeSingle();
                setHospitalLogo(data?.avatar_url || profile?.avatar_url || null);
            } catch {
                setHospitalLogo(profile?.avatar_url || null);
            }
        };
        fetchHospitalLogo();
    }, [profile?.id, profile?.avatar_url]);

    const counts = useMemo(() => {
        const acc: Record<ReviewBucket, number> = {
            all: reviews.length,
            overdue: 0,
            due_today: 0,
            due_tomorrow: 0,
            upcoming: 0,
            completed: 0,
            cancelled: 0
        };
        reviews.forEach((review) => {
            acc[getBucket(review)] += 1;
        });
        return acc;
    }, [reviews]);

    const filteredReviews = useMemo(() => {
        const q = query.toLowerCase().trim();
        const rowPassesQuery = (row: ReviewRow) => {
            if (!q) return true;
            return (
                (row.patient?.name || '').toLowerCase().includes(q) ||
                (row.patient?.mr_number || '').toLowerCase().includes(q) ||
                (row.patient?.phone || '').toLowerCase().includes(q)
            );
        };
        return reviews.filter((row) => {
            const bucket = getBucket(row);
            const bucketPass = bucketFilter === 'all' ? true : bucket === bucketFilter;
            return bucketPass && rowPassesQuery(row);
        });
    }, [reviews, query, bucketFilter]);

    const fetchPatientDetails = useCallback(async (patientId: string) => {
        if (!profile?.id) return null;
        const { data, error } = await supabase
            .from('hospital_patients' as any)
            .select(`
                *,
                prescriptions:hospital_prescriptions(
                    id, token_number, created_at, notes, medications, status, next_review_date, tests_to_review, specialists_to_review, metadata,
                    doctor:hospital_doctors(id, name, specialty, signature_url)
                )
            `)
            .eq('hospital_id', profile.id)
            .eq('id', patientId)
            .single();

        if (error || !data) throw error ?? new Error('Patient not found');
        const sorted = ((data as any)?.prescriptions || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { ...(data as any), prescriptions: sorted };
    }, [profile?.id]);

    const handleOpenRxPopup = async (row: ReviewRow) => {
        try {
            const details = await fetchPatientDetails(row.patient_id);
            setSelectedPatientDetails(details);
            setShowPatientPopup(true);
        } catch (error: any) {
            console.error('Error loading patient details:', error);
            toast.error(error.message || 'Failed to load patient details');
        }
    };

    const updateReview = async (reviewId: string, patch: Record<string, any>, successMessage: string) => {
        const { error } = await (supabase
            .from('hospital_patient_reviews') as any)
            .update({
                ...patch,
                updated_at: new Date().toISOString()
            })
            .eq('id', reviewId);
        if (error) throw error;
        toast.success(successMessage);
        await fetchReviews();
    };

    const handleCancelReview = async (row: ReviewRow) => {
        if (!confirm('Cancel this review cycle?')) return;
        try {
            await updateReview(row.id, { status: 'cancelled', cancelled_at: new Date().toISOString() }, 'Review cancelled');
        } catch (error: any) {
            toast.error(error.message || 'Failed to cancel review');
        }
    };

    const handleMarkCompleted = async (row: ReviewRow) => {
        if (!confirm('Mark this review as completed?')) return;
        try {
            await updateReview(row.id, { status: 'completed', completed_at: new Date().toISOString() }, 'Review marked completed');
        } catch (error: any) {
            toast.error(error.message || 'Failed to mark completed');
        }
    };


    const handleOpenReschedule = (row: ReviewRow) => {
        const today = toISODateLocal(new Date());
        setRescheduleReview(row);
        if (row.next_review_date && row.next_review_date >= today) {
            setRescheduleDate(row.next_review_date);
        } else {
            setRescheduleDate(today);
        }
    };

    const handleRescheduleSubmit = async () => {
        if (!rescheduleReview || !rescheduleDate) return;
        const today = toISODateLocal(new Date());
        if (rescheduleDate < today) {
            toast.error('Reschedule date cannot be in the past');
            return;
        }
        try {
            await updateReview(
                rescheduleReview.id,
                { next_review_date: rescheduleDate, status: 'rescheduled', cancelled_at: null, completed_at: null },
                'Review rescheduled'
            );
            setRescheduleReview(null);
            setRescheduleDate('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to reschedule');
        }
    };

    const getLogsForReview = useCallback(
        (reviewId: string) => followupLogs.filter((l) => l.review_id === reviewId),
        [followupLogs]
    );

    const getLastCallForReview = useCallback(
        (reviewId: string): FollowupLog | undefined => {
            return [...followupLogs]
                .filter((l) => l.review_id === reviewId)
                .sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime())[0];
        },
        [followupLogs]
    );

    const handleOpenCallLog = (row: ReviewRow) => {
        const sorted = [...followupLogs]
            .filter((l) => l.review_id === row.id)
            .sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
        setCallLogHistory(sorted);
        setCallLogReview(row);
    };

    const handleSubmitCallLog = async (
        status: CallStatus,
        notes: string,
        nextDate: string,
        attended: boolean | null
    ) => {
        if (!callLogReview || !profile?.id) return;
        setCallLogSubmitting(true);
        try {
            const { error } = await (supabase as any)
                .from('hospital_patient_followups')
                .insert({
                    hospital_id: profile.id,
                    review_id: callLogReview.id,
                    patient_id: callLogReview.patient_id,
                    called_at: new Date().toISOString(),
                    call_status: status,
                    patient_response: notes.trim() || null,
                    next_followup_date: (status !== 'picked' && nextDate) ? nextDate : null,
                    attended: status === 'picked' ? attended : null,
                    created_by_name: (profile as any).name || null,
                });
            if (error) throw error;
            toast.success('Call logged successfully');
            await fetchFollowupLogs();
            // refresh modal history
            const refreshed = [...followupLogs]
                .filter((l) => l.review_id === callLogReview.id)
                .sort((a, b) => new Date(b.called_at).getTime() - new Date(a.called_at).getTime());
            setCallLogHistory(refreshed);
        } catch (err: any) {
            toast.error(err.message || 'Failed to log call');
        } finally {
            setCallLogSubmitting(false);
        }
    };

    const handlePrintList = () => {
        const title = bucketLabel(bucketFilter);
        const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        const rows = filteredReviews.map((row, idx) => {
            const lastCall = getLastCallForReview(row.id);
            const callLabel = lastCall ? CALL_STATUS_META[lastCall.call_status].label : '--';
            return `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${row.patient?.name || '--'}</strong></td>
                <td>${row.patient?.mr_number || '--'}</td>
                <td>${row.patient?.phone || '--'}</td>
                <td>${row.patient?.age || '--'}</td>
                <td>${formatDDMMYYYY(row.next_review_date)}</td>
                <td>${row.doctor?.name || '--'}</td>
                <td>${row.tests_to_review || '--'}</td>
                <td>${callLabel}</td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8" />
    <title>${title} — ${dateStr}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 12px; padding: 24px; color: #111; }
        h2 { font-size: 18px; margin-bottom: 4px; }
        .meta { color: #555; font-size: 11px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f3f4f6; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #ddd; }
        td { padding: 7px 8px; border: 1px solid #e5e7eb; vertical-align: top; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { body { padding: 12px; } }
    </style>
</head>
<body>
    <h2>Patient Review List — ${title}</h2>
    <p class="meta">Generated: ${dateStr} &nbsp;·&nbsp; ${filteredReviews.length} patient(s)</p>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>Patient Name</th>
                <th>MR Number</th>
                <th>Phone</th>
                <th>Age</th>
                <th>Review Date</th>
                <th>Doctor</th>
                <th>Tests to Review</th>
                <th>Last Call</th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            win.print();
        }
    };

    const canPrintList = (bucketFilter === 'due_today' || bucketFilter === 'due_tomorrow') && filteredReviews.length > 0;

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                    <div>
                        <button
                            onClick={() => onBack ? onBack() : navigate('/enterprise-dashboard/reception/dashboard')}
                            className="text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
                        >
                            {onBack ? '← Back to Dashboard' : '← Back to Reception'}
                        </button>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Track Patients</h2>
                        <p className="text-sm sm:text-base text-gray-600 mt-1">Review tracking with follow-up call management and patient response notes.</p>
                    </div>
                    <button
                        onClick={async () => { await Promise.all([fetchReviews(), fetchFollowupLogs()]); }}
                        className="w-full sm:w-auto px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 self-start"
                    >
                        Refresh
                    </button>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter by MR number, name, phone..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-sm"
                            />
                            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>

                    <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center gap-2">
                        {(['all', 'overdue', 'due_today', 'due_tomorrow', 'upcoming', 'completed', 'cancelled'] as ReviewBucket[]).map((bucket) => (
                            <button
                                key={bucket}
                                onClick={() => setBucketFilter(bucket)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${bucketFilter === bucket ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                            >
                                {bucketLabel(bucket)} ({counts[bucket] || 0})
                            </button>
                        ))}
                        {canPrintList && (
                            <button
                                onClick={handlePrintList}
                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print List
                            </button>
                        )}
                    </div>

                    <div className="overflow-auto">
                        {isLoading ? (
                            <div className="p-16 text-center text-gray-600">Loading...</div>
                        ) : filteredReviews.length === 0 ? (
                            <div className="p-16 text-center text-gray-600">No tracked patients found.</div>
                        ) : (
                            <>
                                {/* Desktop Table View - Hidden on mobile/tablet */}
                                <div className="hidden lg:block">
                                    <div className="grid grid-cols-[2.4rem_1.1fr_0.8fr_0.85fr_0.75fr_0.7fr_0.8fr_0.95fr_1.55fr] gap-2 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                        <span>#</span>
                                        <span>Patient</span>
                                        <span>MR No.</span>
                                        <span>Phone</span>
                                        <span>Next Review</span>
                                        <span>Bucket</span>
                                        <span>Status</span>
                                        <span>Last Call</span>
                                        <span>{readOnly ? 'Call Details' : 'Actions'}</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {filteredReviews.map((row, idx) => {
                                            const bucket = getBucket(row);
                                            const lastCall = getLastCallForReview(row.id);
                                            const callCount = getLogsForReview(row.id).length;
                                            const lastMeta = lastCall ? CALL_STATUS_META[lastCall.call_status] : null;
                                            return (
                                                <div key={row.id} className="grid grid-cols-[2.4rem_1.1fr_0.8fr_0.85fr_0.75fr_0.7fr_0.8fr_0.95fr_1.55fr] gap-2 px-5 py-3.5 text-sm items-center hover:bg-gray-50 transition-colors">
                                                    <span className="text-gray-400 font-bold">{idx + 1}</span>
                                                    <div className="min-w-0">
                                                        <p className="font-semibold text-gray-900 truncate">{row.patient?.name || 'Unknown'}</p>
                                                        {row.patient?.age && <p className="text-xs text-gray-500">{row.patient.age} yrs</p>}
                                                    </div>
                                                    <span className="text-gray-700 text-xs truncate">{row.patient?.mr_number || '--'}</span>
                                                    <span className="text-gray-700 text-xs truncate font-mono">{row.patient?.phone || '--'}</span>
                                                    <span className={`text-xs font-semibold ${row.next_review_date ? 'text-orange-700' : 'text-gray-400'}`}>{formatDDMMYYYY(row.next_review_date)}</span>
                                                    <span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${bucketChipClass(bucket)}`}>{bucketLabel(bucket)}</span></span>
                                                    <span><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusChipClass(row.status)}`}>{row.status}</span></span>
                                                    <div className="flex flex-col gap-0.5">
                                                        {lastCall && lastMeta ? (
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${lastMeta.bg} ${lastMeta.color} ${lastMeta.border}`}>
                                                                {lastMeta.label}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[11px] text-gray-400">No calls yet</span>
                                                        )}
                                                        {callCount > 0 && <span className="text-[10px] text-gray-400">{callCount} call{callCount > 1 ? 's' : ''}</span>}
                                                        {lastCall?.next_followup_date && lastCall.call_status !== 'picked' && (
                                                            <span className="text-[10px] text-amber-600 font-semibold">📅 {formatDDMMYYYY(lastCall.next_followup_date)}</span>
                                                        )}
                                                    </div>
                                                    {readOnly ? (
                                                        <div className="flex flex-col gap-1">
                                                            {lastCall ? (
                                                                <>
                                                                    {lastCall.attended !== null && (
                                                                        <span className={`text-[10px] font-bold ${lastCall.attended ? 'text-emerald-700' : 'text-red-600'}`}>
                                                                            {lastCall.attended ? '✓ Attended' : '✗ Did not attend'}
                                                                        </span>
                                                                    )}
                                                                    {lastCall.patient_response && (
                                                                        <p className="text-[10px] text-gray-600 leading-relaxed line-clamp-2">{lastCall.patient_response}</p>
                                                                    )}
                                                                    {lastCall.next_followup_date && (
                                                                        <span className="text-[10px] text-amber-600 font-semibold">📅 Callback: {formatDDMMYYYY(lastCall.next_followup_date)}</span>
                                                                    )}
                                                                    {lastCall.attended === null && !lastCall.patient_response && !lastCall.next_followup_date && (
                                                                        <span className="text-[10px] text-gray-400">No additional details</span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400">No calls logged</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <button
                                                                onClick={() => handleOpenCallLog(row)}
                                                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                                            >
                                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                                </svg>
                                                                Call Log
                                                            </button>
                                                            <button onClick={() => handleOpenRxPopup(row)} className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors">Open Rx</button>
                                                            <button onClick={() => handleOpenReschedule(row)} className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors">Reschedule</button>
                                                            <button onClick={() => handleCancelReview(row)} className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
                                                            <button onClick={() => handleMarkCompleted(row)} className="px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors">✓ Done</button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Mobile/Tablet Card View - Hidden on desktop */}
                                <div className="lg:hidden divide-y divide-gray-100">
                                    {filteredReviews.map((row, idx) => {
                                        const bucket = getBucket(row);
                                        const lastCall = getLastCallForReview(row.id);
                                        const callCount = getLogsForReview(row.id).length;
                                        const lastMeta = lastCall ? CALL_STATUS_META[lastCall.call_status] : null;
                                        return (
                                            <div key={row.id} className="p-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                            <h3 className="font-bold text-gray-900 text-base truncate">{row.patient?.name || 'Unknown'}</h3>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                                            {row.patient?.mr_number && <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">MR: {row.patient.mr_number}</span>}
                                                            {row.patient?.phone && <span className="bg-gray-100 px-2 py-0.5 rounded font-medium font-mono">{row.patient.phone}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 items-end shrink-0">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${bucketChipClass(bucket)}`}>{bucketLabel(bucket)}</span>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusChipClass(row.status)}`}>{row.status}</span>
                                                    </div>
                                                </div>

                                                <div className="mb-3 bg-gray-50 rounded-xl p-3">
                                                    <p className="text-xs text-gray-500 mb-0.5">Next Review Date</p>
                                                    <p className={`text-sm font-bold ${row.next_review_date ? 'text-orange-700' : 'text-gray-400'}`}>{formatDDMMYYYY(row.next_review_date)}</p>
                                                </div>

                                                {/* Last call card */}
                                                {lastCall && lastMeta ? (
                                                    <div className={`mb-3 rounded-xl p-3 border ${lastMeta.bg} ${lastMeta.border}`}>
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="text-[11px] text-gray-500 mb-0.5">Last Call</p>
                                                                <p className={`text-xs font-bold ${lastMeta.color}`}>{lastMeta.label}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-[10px] text-gray-500">{callCount} call{callCount > 1 ? 's' : ''}</p>
                                                                {lastCall.next_followup_date && lastCall.call_status !== 'picked' && (
                                                                    <p className="text-[11px] text-amber-600 font-semibold">📅 {formatDDMMYYYY(lastCall.next_followup_date)}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {lastCall.attended !== null && (
                                                            <p className={`text-xs font-semibold mt-1 ${lastCall.attended ? 'text-emerald-700' : 'text-red-600'}`}>
                                                                {lastCall.attended ? '✓ Patient attended' : '✗ Patient did not attend'}
                                                            </p>
                                                        )}
                                                        {lastCall.patient_response && <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">{lastCall.patient_response}</p>}
                                                    </div>
                                                ) : (
                                                    <div className="mb-3 bg-gray-50 rounded-xl p-3 border border-dashed border-gray-200">
                                                        <p className="text-xs text-gray-400 text-center">No follow-up calls logged yet</p>
                                                    </div>
                                                )}

                                                {!readOnly && (
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => handleOpenCallLog(row)}
                                                        className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold rounded-xl border-2 border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                        </svg>
                                                        Log Follow-up Call
                                                    </button>
                                                    <button onClick={() => handleOpenRxPopup(row)} className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white">📋 Open Rx</button>
                                                    <button onClick={() => handleOpenReschedule(row)} className="px-3 py-2 text-xs font-semibold rounded-xl border border-blue-200 text-blue-700 hover:bg-blue-50 bg-white">📅 Reschedule</button>
                                                    <button onClick={() => handleCancelReview(row)} className="px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 bg-white">✕ Cancel</button>
                                                    <button onClick={() => handleMarkCompleted(row)} className="px-3 py-2 text-xs font-semibold rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white">✓ Complete</button>
                                                </div>
                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {rescheduleReview && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3">Reschedule Review</h3>
                        <p className="text-sm text-gray-600 mb-4">{rescheduleReview.patient?.name || 'Patient'}</p>
                        <input
                            type="date"
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                            min={toISODateLocal(new Date())}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                        <div className="mt-5 flex gap-3">
                            <button
                                onClick={() => setRescheduleReview(null)}
                                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRescheduleSubmit}
                                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPatientPopup && selectedPatientDetails && (
                <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedPatientDetails.name}</h3>
                                <p className="text-sm text-gray-500">MR: {selectedPatientDetails.mr_number || '--'} · Phone: {selectedPatientDetails.phone || '--'}</p>
                            </div>
                            <button
                                onClick={() => setShowPatientPopup(false)}
                                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-auto">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-5">
                                <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs">Age</p><p className="font-semibold text-gray-900">{selectedPatientDetails.age || '--'}</p></div>
                                <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs">Place</p><p className="font-semibold text-gray-900">{selectedPatientDetails.place || '--'}</p></div>
                                <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs">Father/Husband</p><p className="font-semibold text-gray-900">{selectedPatientDetails.father_husband_name || '--'}</p></div>
                                <div className="bg-gray-50 rounded-lg p-3"><p className="text-gray-500 text-xs">BeanHealth ID</p><p className="font-semibold text-gray-900">{selectedPatientDetails.beanhealth_id || '--'}</p></div>
                            </div>

                            <h4 className="font-bold text-gray-900 mb-3">Visit History</h4>
                            <div className="space-y-2">
                                {(selectedPatientDetails.prescriptions || []).length === 0 && (
                                    <div className="p-4 text-sm text-gray-500 bg-gray-50 rounded-lg">No prescriptions recorded.</div>
                                )}
                                {(selectedPatientDetails.prescriptions || []).map((rx: any) => (
                                    <div key={rx.id} className="p-3 border border-gray-100 rounded-xl bg-white">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-gray-900 text-sm">
                                                    {new Date(rx.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    <span className="text-gray-400 font-normal"> · {new Date(rx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    Doctor: {rx.doctor?.name || '--'} · Token: {rx.token_number || '--'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setShowPatientPopup(false);
                                                    setSelectedPrintPrescription(rx);
                                                }}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                                            >
                                                View Print
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedPrintPrescription && selectedPatientDetails && (
                <PrescriptionModal
                    doctor={selectedPrintPrescription.doctor || {}}
                    patient={{
                        ...selectedPatientDetails,
                        token_number: selectedPrintPrescription.token_number || selectedPatientDetails?.token_number
                    }}
                    onClose={() => setSelectedPrintPrescription(null)}
                    readOnly={true}
                    existingData={selectedPrintPrescription}
                    clinicLogo={hospitalLogo || undefined}
                />
            )}

            {callLogReview && (
                <CallLogModal
                    review={callLogReview}
                    history={callLogHistory}
                    submitting={callLogSubmitting}
                    onClose={() => setCallLogReview(null)}
                    onSubmit={handleSubmitCallLog}
                />
            )}
        </div>
    );
};

export default TrackPatientsPage;

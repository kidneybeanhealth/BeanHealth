import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PrescriptionModal from '../modals/PrescriptionModal';

type ReviewStatus = 'pending' | 'rescheduled' | 'completed' | 'cancelled';
type ReviewBucket = 'all' | 'overdue' | 'due_today' | 'next_7_days' | 'upcoming_later' | 'no_review_date' | 'completed' | 'cancelled';

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

const bucketLabel = (bucket: ReviewBucket): string => {
    if (bucket === 'overdue') return 'Overdue';
    if (bucket === 'due_today') return 'Due Today';
    if (bucket === 'next_7_days') return 'Next 7 Days';
    if (bucket === 'upcoming_later') return 'Upcoming';
    if (bucket === 'completed') return 'Completed';
    if (bucket === 'cancelled') return 'Cancelled';
    if (bucket === 'no_review_date') return 'No Date';
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
    if (bucket === 'next_7_days') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (bucket === 'upcoming_later') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (bucket === 'completed') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (bucket === 'cancelled') return 'bg-gray-100 text-gray-600 border-gray-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
};

const getBucket = (review: ReviewRow): ReviewBucket => {
    if (review.status === 'completed') return 'completed';
    if (review.status === 'cancelled') return 'cancelled';
    if (!review.next_review_date) return 'no_review_date';

    const today = toISODateLocal(new Date());
    const next7 = toISODateLocal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

    // Rescheduled reviews should not continue showing as overdue.
    if (review.status === 'rescheduled') {
        if (review.next_review_date <= next7) return 'next_7_days';
        return 'upcoming_later';
    }

    if (review.next_review_date < today) return 'overdue';
    if (review.next_review_date === today) return 'due_today';
    if (review.next_review_date <= next7) return 'next_7_days';
    return 'upcoming_later';
};

const TrackPatientsPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [reviews, setReviews] = useState<ReviewRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [bucketFilter, setBucketFilter] = useState<ReviewBucket>('all');
    const [rescheduleReview, setRescheduleReview] = useState<ReviewRow | null>(null);
    const [rescheduleDate, setRescheduleDate] = useState('');
    const [selectedPatientDetails, setSelectedPatientDetails] = useState<any>(null);
    const [showPatientPopup, setShowPatientPopup] = useState(false);
    const [selectedPrintPrescription, setSelectedPrintPrescription] = useState<any>(null);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

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

    useEffect(() => {
        fetchReviews();
    }, [fetchReviews]);

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
            next_7_days: 0,
            upcoming_later: 0,
            no_review_date: 0,
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
                    id, token_number, created_at, notes, medications, status, next_review_date, tests_to_review, specialists_to_review,
                    doctor:hospital_doctors(id, name, specialty)
                )
            `)
            .eq('hospital_id', profile.id)
            .eq('id', patientId)
            .single();

        if (error) throw error;
        const sorted = (data?.prescriptions || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return { ...data, prescriptions: sorted };
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
                {
                    next_review_date: rescheduleDate,
                    status: 'rescheduled',
                    cancelled_at: null,
                    completed_at: null
                },
                'Review rescheduled'
            );
            setRescheduleReview(null);
            setRescheduleDate('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to reschedule');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
                <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                    <div>
                        <button
                            onClick={() => navigate('/enterprise-dashboard/reception/dashboard')}
                            className="text-sm font-semibold text-gray-500 hover:text-gray-800 mb-2 inline-flex items-center gap-1"
                        >
                            ← Back to Reception
                        </button>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Track Patients</h2>
                        <p className="text-sm sm:text-base text-gray-600 mt-1">Review tracking by patient with visit history and prescription print view.</p>
                    </div>
                    <button
                        onClick={fetchReviews}
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

                    <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap gap-2">
                        {(['all', 'overdue', 'due_today', 'next_7_days', 'upcoming_later', 'no_review_date', 'completed', 'cancelled'] as ReviewBucket[]).map((bucket) => (
                            <button
                                key={bucket}
                                onClick={() => setBucketFilter(bucket)}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${bucketFilter === bucket ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                            >
                                {bucketLabel(bucket)} ({counts[bucket] || 0})
                            </button>
                        ))}
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
                                    <div className="grid grid-cols-[2.8rem_1.2fr_0.9fr_0.9fr_0.85fr_0.8fr_0.9fr_1.3fr] gap-2 px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                        <span>#</span>
                                        <span>Patient</span>
                                        <span>MR Number</span>
                                        <span>Phone</span>
                                        <span>Next Review</span>
                                        <span>Bucket</span>
                                        <span>Status</span>
                                        <span>Actions</span>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {filteredReviews.map((row, idx) => {
                                            const bucket = getBucket(row);
                                            return (
                                                <div key={row.id} className="grid grid-cols-[2.8rem_1.2fr_0.9fr_0.9fr_0.85fr_0.8fr_0.9fr_1.3fr] gap-2 px-6 py-3 text-sm items-center hover:bg-gray-50">
                                                    <span className="text-gray-500 font-semibold">{idx + 1}</span>
                                                    <span className="font-semibold text-gray-900 truncate">{row.patient?.name || 'Unknown'}</span>
                                                    <span className="text-gray-800 truncate">{row.patient?.mr_number || '--'}</span>
                                                    <span className="text-gray-800 truncate">{row.patient?.phone || '--'}</span>
                                                    <span className={`${row.next_review_date ? 'text-orange-700 font-semibold' : 'text-gray-400'}`}>{formatDDMMYYYY(row.next_review_date)}</span>
                                                    <span><span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${bucketChipClass(bucket)}`}>{bucketLabel(bucket)}</span></span>
                                                    <span><span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${statusChipClass(row.status)}`}>{row.status}</span></span>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <button
                                                            onClick={() => handleOpenRxPopup(row)}
                                                            className="px-2 py-1 text-[10px] font-semibold rounded-md border border-gray-200 text-gray-700 hover:bg-gray-100"
                                                        >
                                                            Open Rx
                                                        </button>
                                                        <button
                                                            onClick={() => handleOpenReschedule(row)}
                                                            className="px-2 py-1 text-[10px] font-semibold rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50"
                                                        >
                                                            Reschedule
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelReview(row)}
                                                            className="px-2 py-1 text-[10px] font-semibold rounded-md border border-gray-200 text-gray-600 hover:bg-gray-100"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={() => handleMarkCompleted(row)}
                                                            className="px-2 py-1 text-[10px] font-semibold rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                                        >
                                                            Mark Completed
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Mobile/Tablet Card View - Hidden on desktop */}
                                <div className="lg:hidden divide-y divide-gray-100">
                                    {filteredReviews.map((row, idx) => {
                                        const bucket = getBucket(row);
                                        return (
                                            <div key={row.id} className="p-4 hover:bg-gray-50 transition-colors">
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                                                            <h3 className="font-bold text-gray-900 text-base truncate">{row.patient?.name || 'Unknown'}</h3>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                                                            {row.patient?.mr_number && (
                                                                <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">MR: {row.patient.mr_number}</span>
                                                            )}
                                                            {row.patient?.phone && (
                                                                <span className="bg-gray-100 px-2 py-0.5 rounded font-medium">{row.patient.phone}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1.5 items-end">
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${bucketChipClass(bucket)}`}>
                                                            {bucketLabel(bucket)}
                                                        </span>
                                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold border ${statusChipClass(row.status)}`}>
                                                            {row.status}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mb-3 bg-gray-50 rounded-lg p-2.5">
                                                    <p className="text-xs text-gray-500 mb-0.5">Next Review Date</p>
                                                    <p className={`text-sm font-bold ${row.next_review_date ? 'text-orange-700' : 'text-gray-400'}`}>
                                                        {formatDDMMYYYY(row.next_review_date)}
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={() => handleOpenRxPopup(row)}
                                                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white"
                                                    >
                                                        📋 Open Rx
                                                    </button>
                                                    <button
                                                        onClick={() => handleOpenReschedule(row)}
                                                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 bg-white"
                                                    >
                                                        📅 Reschedule
                                                    </button>
                                                    <button
                                                        onClick={() => handleCancelReview(row)}
                                                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 bg-white"
                                                    >
                                                        ✕ Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleMarkCompleted(row)}
                                                        className="px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 bg-white"
                                                    >
                                                        ✓ Complete
                                                    </button>
                                                </div>
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
        </div>
    );
};

export default TrackPatientsPage;

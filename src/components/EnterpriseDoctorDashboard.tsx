import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModalSelector from './prescriptions/PrescriptionModalSelector';
import PrescriptionModal from './modals/PrescriptionModal';
import ManageDrugsModal from './modals/ManageDrugsModal';
import ManageDiagnosesModal from './modals/ManageDiagnosesModal';
import DoctorTeamAuditModal from './modals/DoctorTeamAuditModal';
import TwoStepConfirmModal from './common/TwoStepConfirmModal';
import EnterpriseCKDSnapshotView from './EnterpriseCKDSnapshotView';
import DoctorPastRecordsPanel from './enterprise/DoctorPastRecordsPanel';
import {
    fetchReceptionPastRecords,
    admitPatientFromQueue,
    type ReceptionPastRecordPatient,
    type ReceptionReviewFilter,
} from '../services/enterpriseReviewService';
import AdmittedPatientsPanel, { type AdmittedPrescribeContext } from './enterprise/AdmittedPatientsPanel';
import { LogoIcon } from './icons/LogoIcon';
import DoctorSettingsModal from './modals/DoctorSettingsModal';
import { type DoctorActorSession } from '../utils/doctorActorSession';
import {
    fetchDepartmentQueueMetrics,
    type QueuePatientMetricsSnapshot,
} from '../services/departmentPatientMetricsService';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
    signature_url?: string;
    avatar_url?: string;
}

interface Patient {
    id: string;
    name: string;
    age: number;
    token_number: string;
    mr_number?: string | null;
    app_access_enabled?: boolean | null;
}

interface QueueItem {
    id: string;
    patient_id: string;
    doctor_id: string;
    queue_number: number;
    token_number: string;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    created_at: string;
    updated_at?: string;
    preparing_by?: string | null;
    patient: Patient;
}

interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    instruction: string;
}

// Helper to format doctor name professionally
const formatDoctorName = (name: string) => {
    if (!name) return "";
    // Remove existing Dr prefix and any trailing dots/spaces
    let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
    // Fix initials formatting (e.g., A.Divakar -> A. Divakar)
    cleanName = cleanName.replace(/([A-Z])\.(\S)/g, "$1. $2");
    return `Dr. ${cleanName}`;
};

const toLocalISODate = (date: Date): string => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const getReviewFilterLabel = (filterKey: ReceptionReviewFilter): string => {
    if (filterKey === 'all') return 'All';
    if (filterKey === 'due_today') return 'Due Today';
    if (filterKey === 'due_tomorrow') return 'Due Tomorrow';
    if (filterKey === 'upcoming') return 'Upcoming';
    if (filterKey === 'overdue') return 'Over Due';
    if (filterKey === 'followup_needed') return 'Followup Needed';
    if (filterKey === 'review_completed') return 'Review Completed';
    return 'Not Completed';
};

const getReviewBadgeClass = (category: ReceptionReviewFilter): string => {
    if (category === 'due_today') return 'bg-orange-50 text-orange-700';
    if (category === 'due_tomorrow') return 'bg-sky-50 text-sky-700';
    if (category === 'upcoming') return 'bg-emerald-50 text-emerald-700';
    if (category === 'overdue') return 'bg-rose-50 text-rose-700';
    if (category === 'followup_needed') return 'bg-amber-50 text-amber-700';
    if (category === 'not_completed') return 'bg-red-50 text-red-700';
    return 'bg-gray-100 text-gray-600';
};

const formatPastDate = (value?: string | null): string => {
    if (!value) return '--';
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatMetricsTimestamp = (value?: string | null): string => {
    if (!value) return 'No updates yet';
    return `Updated ${new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

const formatMetricsDate = (value: string): string => {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

type CallLogStatus = 'picked' | 'not_picked';

interface CallLogTarget {
    patientId: string;
    mrNumber: string | null;
    patientName: string;
    reviewDate: string | null;
}

interface CallHistoryEntry {
    id: string;
    called_at: string;
    call_status: string | null;
    patient_response: string | null;
}

interface EnterpriseDoctorDashboardProps {
    doctor: DoctorProfile;
    onBack: () => void;
    actorSession?: DoctorActorSession | null;
    paActorAuthEnabled?: boolean;
}

const EnterpriseDoctorDashboard: React.FC<EnterpriseDoctorDashboardProps> = ({
    doctor,
    onBack,
    actorSession = null,
    paActorAuthEnabled = false,
}) => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [queueSearch, setQueueSearch] = useState('');
    const [queueSearchOpen, setQueueSearchOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showRxModal, setShowRxModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
    const [medications, setMedications] = useState<Medication[]>([
        { name: '', dosage: '', frequency: '', duration: '', instruction: '' }
    ]);
    const [notes, setNotes] = useState('');
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
    const [queueMetricsByPatientId, setQueueMetricsByPatientId] = useState<Record<string, QueuePatientMetricsSnapshot>>({});
    const [queueMetricsLoading, setQueueMetricsLoading] = useState(false);
    const [expandedQueuePatientIds, setExpandedQueuePatientIds] = useState<Set<string>>(new Set());

    const [viewMode, setViewMode] = useState<'queue' | 'history' | 'ckd_snapshot' | 'past_records' | 'admitted'>('queue');
    const [historyList, setHistoryList] = useState<any[]>([]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
    const [showManageDiagnosesModal, setShowManageDiagnosesModal] = useState(false);
    const [showTeamAuditModal, setShowTeamAuditModal] = useState(false);
    // Local doctor state to handle updates (e.g. after signature upload)
    const [currentDoctor, setCurrentDoctor] = useState<DoctorProfile>(doctor);
    const isSendingToPharmacyRef = useRef(false);
    const isPastRxLoadingRef = useRef(false);
    // Fix 5: Ref tracks whether any modal is open — used inside interval/realtime closures
    // (state values go stale inside setInterval/channel callbacks; refs don't)
    const isModalOpenRef = useRef(false);

    const actorType = actorSession?.actorType || 'chief';
    const actorDisplayName = actorSession?.actorDisplayName || formatDoctorName(doctor.name);
    const canManageTeamAudit = Boolean(paActorAuthEnabled && actorSession?.actorType === 'chief' && actorSession?.sessionToken);

    const logViewEvent = useCallback(async (
        eventType: string,
        payload?: {
            eventCategory?: 'view' | 'print' | 'auth' | 'write';
            patientId?: string | null;
            queueId?: string | null;
            prescriptionId?: string | null;
            route?: string;
            metadata?: Record<string, any>;
        }
    ) => {
        if (!paActorAuthEnabled || !actorSession?.sessionToken) return;
        try {
            await (supabase as any).rpc('doctor_log_view_event', {
                p_hospital_id: doctor.hospital_id,
                p_chief_doctor_id: doctor.id,
                p_session_token: actorSession.sessionToken,
                p_event_type: eventType,
                p_event_category: payload?.eventCategory || 'view',
                p_patient_id: payload?.patientId || null,
                p_queue_id: payload?.queueId || null,
                p_prescription_id: payload?.prescriptionId || null,
                p_route: payload?.route || `/enterprise-dashboard/doctors/${doctor.id}/dashboard`,
                p_metadata: payload?.metadata || {},
            });
        } catch (error) {
            console.warn('[EnterpriseDoctorDashboard] logViewEvent failed:', error);
        }
    }, [paActorAuthEnabled, actorSession?.sessionToken, doctor.hospital_id, doctor.id]);

    useEffect(() => {
        setCurrentDoctor(doctor);
    }, [doctor]);

    // Clear any stale "preparing" indicator this PA left from a prior session
    useEffect(() => {
        (supabase as any)
            .from('hospital_queues')
            .update({ preparing_by: null })
            .eq('doctor_id', doctor.id)
            .eq('preparing_by', actorDisplayName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refreshDoctorProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('*')
                .eq('id', doctor.id)
                .single();
            if (data && !error) {
                setCurrentDoctor(data);
            }
        } catch (e) {
            console.error('Error refreshing doctor profile:', e);
        }
    };

    // Helper to get today's ISO date
    const getTodayISO = () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date.toISOString();
    };

    // Memoized fetch functions for background updates
    const fetchQueue = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            console.log('Fetching queue for doctor:', doctor.id);
            const { data, error } = await supabase
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*)
                `)
                .eq('doctor_id', doctor.id)
                .in('status', ['pending', 'in_progress'])
                .gte('created_at', getTodayISO()) // Filter: Today only
                .order('queue_number', { ascending: true });

            if (error) throw error;

            // Sort by token_number numerically (not lexicographically)
            const sortedData = (data || []).sort((a: any, b: any) => {
                const numA = parseInt(a.patient?.token_number?.replace(/\D/g, '') || '0', 10);
                const numB = parseInt(b.patient?.token_number?.replace(/\D/g, '') || '0', 10);
                return numA - numB;
            });
            setQueue(sortedData);
        } catch (error) {
            console.error('Error fetching queue:', error);
            if (!isBackground) toast.error('Failed to load patient list');
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [doctor.id]);

    const toggleQueuePatientMetrics = useCallback((patientId: string) => {
        setExpandedQueuePatientIds(prev => {
            const next = new Set(prev);
            if (next.has(patientId)) {
                next.delete(patientId);
            } else {
                next.add(patientId);
            }
            return next;
        });
    }, []);

    const fetchHistory = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    prescription:hospital_prescriptions!hospital_prescriptions_queue_id_fkey(
                        id,
                        status,
                        dispensed_at,
                        created_at,
                        metadata
                    )
                `)
                .eq('doctor_id', doctor.id)
                .eq('status', 'completed')
                .gte('created_at', getTodayISO()) // Filter: Today only
                .order('updated_at', { ascending: false });

            if (error) throw error;
            setHistoryList(data || []);
        } catch (error) {
            console.error('Error fetching history:', error);
            if (!isBackground) toast.error('Failed to load history');
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [doctor.id]);

    // Patient Database State (Past Records tab)
    const [pastRecords, setPastRecords] = useState<ReceptionPastRecordPatient[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [reviewFilter, setReviewFilter] = useState<ReceptionReviewFilter>('all');
    const [reviewDateFilter, setReviewDateFilter] = useState('');
    const [pastRecordsPage, setPastRecordsPage] = useState(0);
    const [hasMorePastRecords, setHasMorePastRecords] = useState(true);
    const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
    const [pastRecordsTotal, setPastRecordsTotal] = useState(0);
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
    const [rxViewPatient, setRxViewPatient] = useState<any>(null);
    const [rxViewPrescription, setRxViewPrescription] = useState<any>(null);
    const [callLogTarget, setCallLogTarget] = useState<CallLogTarget | null>(null);
    const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
    const [callHistoryLoading, setCallHistoryLoading] = useState(false);
    const [expandedCallHistoryPatientIds, setExpandedCallHistoryPatientIds] = useState<Set<string>>(new Set());
    const [callLogSubmitting, setCallLogSubmitting] = useState(false);
    const [callLogStatus, setCallLogStatus] = useState<CallLogStatus>('picked');
    const [callLogNotes, setCallLogNotes] = useState('');
    const [callLogNextDate, setCallLogNextDate] = useState('');
    const [callLogRescheduleDate, setCallLogRescheduleDate] = useState('');
    const PAST_RECORDS_PER_PAGE = 50;

    const fetchPastRecords = useCallback(async (isBackground = false, page = 0, append = false) => {
        if (!doctor.hospital_id) return;
        if (!isBackground && !append) setLoading(true);
        if (append) setIsLoadingMorePast(true);
        try {
            const result = await fetchReceptionPastRecords({
                hospitalId: doctor.hospital_id,
                page,
                pageSize: PAST_RECORDS_PER_PAGE,
                searchQuery,
                reviewFilter,
                reviewDate: reviewDateFilter,
            });

            setPastRecordsTotal(result.totalCount);
            setHasMorePastRecords(result.hasMore);
            setPastRecords(prev => append ? [...prev, ...result.patients] : result.patients);
            setPastRecordsPage(page);
        } catch (error) {
            console.error('Error fetching patients:', error);
            if (!isBackground) toast.error('Failed to load patients');
        } finally {
            if (!isBackground && !append) setLoading(false);
            if (append) setIsLoadingMorePast(false);
        }
    }, [doctor.hospital_id, searchQuery, reviewFilter, reviewDateFilter]);

    const handlePrintPastRecordsList = () => {
        if (reviewFilter !== 'due_today' && reviewFilter !== 'due_tomorrow') {
            toast.error('Print List is available only for Due Today or Due Tomorrow');
            return;
        }

        if (pastRecords.length === 0) {
            toast.error('No patient records to print');
            return;
        }

        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            toast.error('Pop-up blocked. Please allow pop-ups to print the list.');
            return;
        }

        const generatedAt = new Date().toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });

        const rowsHtml = pastRecords
            .map((patient, index) => {
                const relationLabel = patient.gender === 'F' ? 'W/o' : 'S/o';
                return `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(patient.name || '--')}</td>
                        <td>${patient.age ?? '--'}</td>
                        <td>${relationLabel} ${escapeHtml(patient.father_husband_name || '--')}</td>
                        <td>${escapeHtml(patient.mr_number || '--')}</td>
                        <td>${formatPastDate(patient.latestReviewDate)}</td>
                        <td>${formatPastDate(patient.lastVisitAt)}</td>
                    </tr>
                `;
            })
            .join('');

        const filterLabel = getReviewFilterLabel(reviewFilter);

        const html = `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Past Records Print List</title>
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #1f2937; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
                    .title { font-size: 20px; font-weight: 700; margin: 0; }
                    .meta { font-size: 12px; color: #6b7280; margin-top: 4px; }
                    .pill { display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #fdba74; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 700; margin-right: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
                    thead th { text-align: left; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b7280; background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; }
                    tbody td { border: 1px solid #e5e7eb; padding: 10px; font-size: 12px; vertical-align: top; }
                    tbody tr:nth-child(even) { background: #fcfcfd; }
                    .footer { margin-top: 14px; font-size: 11px; color: #6b7280; }
                    @media print {
                        body { margin: 10mm; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1 class="title">Past Records List</h1>
                        <p class="meta">${escapeHtml(doctor.name || 'Doctor')}</p>
                        <p class="meta">Generated: ${generatedAt}</p>
                    </div>
                    <div>
                        <span class="pill">Filter: ${escapeHtml(filterLabel)}</span>
                        <span class="pill">Total: ${pastRecords.length}</span>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Age</th>
                            <th>S/o / W/o</th>
                            <th>MR ID</th>
                            <th>Due Date</th>
                            <th>Last Visit Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <p class="footer">Printed from Doctor Past Records module.</p>

                <script>
                    window.onload = function () {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const openCallLog = async (patient: ReceptionPastRecordPatient) => {
        if (!doctor.hospital_id) return;
        setCallLogTarget({
            patientId: patient.id,
            mrNumber: patient.mr_number || null,
            patientName: patient.name,
            reviewDate: patient.latestReviewDate,
        });
        setCallHistory([]);
        setCallHistoryLoading(true);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');

        try {
            const { data, error } = await (supabase as any)
                .from('hospital_patient_followups')
                .select('id, called_at, call_status, patient_response')
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', patient.id)
                .order('called_at', { ascending: false })
                .limit(15);

            if (error) throw error;
            setCallHistory((data || []) as CallHistoryEntry[]);
        } catch (error) {
            console.error('Call history fetch error:', error);
            toast.error('Failed to load call history');
            setCallHistory([]);
        } finally {
            setCallHistoryLoading(false);
        }
    };

    const closeCallLog = () => {
        setCallLogTarget(null);
        setCallHistory([]);
        setCallHistoryLoading(false);
        setCallLogSubmitting(false);
        setCallLogStatus('picked');
        setCallLogNotes('');
        setCallLogNextDate('');
        setCallLogRescheduleDate('');
    };

    const togglePatientCallHistory = (patientId: string) => {
        setExpandedCallHistoryPatientIds((prev) => {
            const next = new Set(prev);
            if (next.has(patientId)) {
                next.delete(patientId);
            } else {
                next.add(patientId);
            }
            return next;
        });
    };

    const handleSubmitCallLog = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!doctor.hospital_id || !callLogTarget) return;

        setCallLogSubmitting(true);
        try {
            const effectiveReviewDate = callLogStatus === 'picked'
                ? callLogRescheduleDate
                : callLogNextDate;

            const { data: existingReview, error: existingError } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select('id, patient_id')
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', callLogTarget.patientId)
                .in('status', ['pending', 'rescheduled'])
                .order('next_review_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existingError) throw existingError;

            const reviewPatch = {
                status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                next_review_date: effectiveReviewDate || callLogTarget.reviewDate,
                cancelled_at: null,
                completed_at: null,
                updated_at: new Date().toISOString(),
            };

            if (existingReview?.id) {
                const { error: updateError } = await (supabase as any)
                    .from('hospital_patient_reviews')
                    .update(reviewPatch)
                    .eq('id', existingReview.id);
                if (updateError) throw updateError;
            } else if (callLogTarget.mrNumber) {
                const { data: mrPatient, error: mrLookupError } = await (supabase as any)
                    .from('hospital_patients')
                    .select('id')
                    .eq('hospital_id', doctor.hospital_id)
                    .eq('mr_number', callLogTarget.mrNumber)
                    .maybeSingle();

                if (mrLookupError) throw mrLookupError;

                if (mrPatient?.id) {
                    const { error: insertError } = await (supabase as any)
                        .from('hospital_patient_reviews')
                        .insert({
                            hospital_id: doctor.hospital_id,
                            patient_id: mrPatient.id,
                            doctor_id: doctor.id,
                            next_review_date: effectiveReviewDate || callLogTarget.reviewDate,
                            status: callLogStatus === 'picked' ? 'rescheduled' : 'pending',
                        });
                    if (insertError) throw insertError;
                }
            }

            await (supabase as any)
                .from('hospital_patient_followups')
                .insert({
                    hospital_id: doctor.hospital_id,
                    review_id: existingReview?.id || null,
                    patient_id: callLogTarget.patientId,
                    called_at: new Date().toISOString(),
                    call_status: callLogStatus,
                    patient_response: callLogNotes.trim() || null,
                    next_followup_date: callLogStatus === 'not_picked' ? (callLogNextDate || null) : null,
                    attended: null,
                    created_by_name: doctor.name || null,
                });

            toast.success('Call log saved');
            closeCallLog();
            await fetchPastRecords(false, 0, false);
        } catch (error: any) {
            console.error('Call log save error:', error);
            toast.error(error.message || 'Failed to save call log');
        } finally {
            setCallLogSubmitting(false);
        }
    };

    const handleLoadMorePastRecords = () => {
        fetchPastRecords(true, pastRecordsPage + 1, true);
    };

    const handleSearchPastRecords = async (e: React.FormEvent) => {
        e.preventDefault();
        setPastRecords([]);
        setPastRecordsPage(0);
        setHasMorePastRecords(true);
        await fetchPastRecords(false, 0, false);
    };

    // Loading timeout - prevents infinite loading state
    useEffect(() => {
        if (loading) {
            const timeout = setTimeout(() => {
                setLoading(false);
                toast.error('Loading timed out. Please try refreshing.');
            }, 15000); // 15 second timeout
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    // Initial fetch
    useEffect(() => {
        if (viewMode === 'queue') {
            fetchQueue();
        } else if (viewMode === 'history') {
            fetchHistory();
        } else if (viewMode === 'past_records') {
            fetchPastRecords();
        }
    }, [doctor.id, viewMode, fetchQueue, fetchHistory, fetchPastRecords]);

    useEffect(() => {
        if (viewMode !== 'past_records') return;

        const debounce = setTimeout(() => {
            setPastRecords([]);
            setPastRecordsPage(0);
            setHasMorePastRecords(true);
            fetchPastRecords(true, 0, false);
        }, 350);

        return () => clearTimeout(debounce);
    }, [searchQuery, viewMode, reviewFilter, reviewDateFilter, fetchPastRecords]);

    useEffect(() => {
        const queuePatientIds = queue.map(item => item.patient_id).filter(Boolean);
        if (queuePatientIds.length === 0) {
            setExpandedQueuePatientIds(new Set());
            setQueueMetricsByPatientId({});
            return;
        }

        setExpandedQueuePatientIds(prev => {
            const next = new Set<string>();
            const allowed = new Set(queuePatientIds);
            prev.forEach(patientId => {
                if (allowed.has(patientId)) next.add(patientId);
            });
            return next;
        });
    }, [queue]);

    useEffect(() => {
        if (viewMode !== 'queue') return;

        const queuePatientIds = queue.map(item => item.patient_id).filter(Boolean);
        if (!doctor.hospital_id || queuePatientIds.length === 0) {
            setQueueMetricsByPatientId({});
            return;
        }

        let isActive = true;
        const loadQueueMetrics = async () => {
            setQueueMetricsLoading(true);
            try {
                const metrics = await fetchDepartmentQueueMetrics({
                    hospitalId: doctor.hospital_id,
                    patientIds: queuePatientIds,
                    doctorSpecialty: currentDoctor.specialty || null,
                });
                if (isActive) {
                    setQueueMetricsByPatientId(metrics);
                }
            } catch (error) {
                console.error('Failed to load queue patient metrics:', error);
            } finally {
                if (isActive) setQueueMetricsLoading(false);
            }
        };

        loadQueueMetrics();

        return () => {
            isActive = false;
        };
    }, [viewMode, queue, doctor.hospital_id, currentDoctor.specialty]);

    // Realtime subscription for queue updates with error handling
    useEffect(() => {
        if (!doctor.id) return;

        const channel = supabase
            .channel(`doctor-queue-${doctor.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_queues',
                    filter: `doctor_id=eq.${doctor.id}`
                },
                (payload) => {
                    console.log('Queue update received:', payload.eventType);
                    if (payload.eventType === 'INSERT') {
                        // Check if it's for today
                        if (new Date(payload.new.created_at) >= new Date(new Date().setHours(0, 0, 0, 0))) {
                            toast.success('New patient added to queue!', { duration: 3000 });
                        }
                    }
                    // Fix 5: Skip background refetch while a modal is open to prevent queue reorder
                    if (isModalOpenRef.current) return;

                    // Refetch in background based on viewMode
                    if (viewMode === 'queue') {
                        fetchQueue(true);
                    } else if (viewMode === 'history') {
                        fetchHistory(true);
                    } else if (viewMode === 'past_records') {
                        // Past records are derived from shared review data, so keep the tab in sync.
                        fetchPastRecords(true);
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Doctor realtime error:', err);
                    setTimeout(() => {
                        if (viewMode === 'queue') fetchQueue(true);
                        else if (viewMode === 'history') fetchHistory(true);
                        else if (viewMode === 'past_records') fetchPastRecords(true);
                    }, 3000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [doctor.id, viewMode, fetchQueue, fetchHistory, fetchPastRecords]);

    // Periodic health check - refresh data every 60 seconds when tab is visible
    useEffect(() => {
        const interval = setInterval(() => {
            // Fix 5: Skip polling while a modal is open
            if (document.visibilityState === 'visible' && !isModalOpenRef.current) {
                if (viewMode === 'queue') fetchQueue(true);
                else if (viewMode === 'history') fetchHistory(true);
                else if (viewMode === 'past_records') fetchPastRecords(true);
            }
        }, 60000); // Every 60 seconds
        return () => clearInterval(interval);
    }, [viewMode, fetchQueue, fetchHistory, fetchPastRecords]);

    // Refetch when tab becomes visible (handles browser tab switching)
    useEffect(() => {
        const handleVisibilityChange = () => {
            // Fix 5: Skip refetch while a modal is open
            if (document.visibilityState === 'visible' && !isModalOpenRef.current) {
                if (viewMode === 'queue') fetchQueue(true);
                else if (viewMode === 'history') fetchHistory(true);
                else if (viewMode === 'past_records') fetchPastRecords(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [viewMode, fetchQueue, fetchHistory, fetchPastRecords]);

    useEffect(() => {
        if (viewMode === 'queue') {
            logViewEvent('view.queue.open', {
                route: `/enterprise-dashboard/doctors/${doctor.id}/dashboard`,
            });
        }
    }, [viewMode, logViewEvent, doctor.id]);

    // Fetch hospital logo
    useEffect(() => {
        const fetchHospitalLogo = async () => {
            if (!doctor.hospital_id) return;
            try {
                const { data } = await (supabase
                    .from('users') as any)
                    .select('avatar_url')
                    .eq('id', doctor.hospital_id)
                    .single() as { data: { avatar_url?: string } | null };
                if (data?.avatar_url) {
                    setHospitalLogo(data.avatar_url);
                }
            } catch (err) {
                console.warn('Could not fetch hospital logo:', err);
            }
        };
        fetchHospitalLogo();
    }, [doctor.hospital_id]);

    // Fetch all prescriptions for a history item (queue visit + patient fallback)
    const fetchPrescriptionsForItem = async (historyItem: any, mode: 'view' | 'edit') => {
        const toastId = toast.loading(mode === 'view' ? 'Opening prescription...' : 'Loading prescription...');
        try {
            // Fetch all prescriptions by queue_id
            const byQueue = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    patient:hospital_patients(*)
                `)
                .eq('doctor_id', doctor.id)
                .eq('queue_id', historyItem.id)
                .order('created_at', { ascending: false });

            let results: any[] = (byQueue.data as any[]) || [];

            // Also fetch any resent prescriptions (queue_id IS NULL) for same patient on same day
            if (historyItem.patient_id) {
                const todayStart = getTodayISO();
                const resent = await supabase
                    .from('hospital_prescriptions' as any)
                    .select(`
                        *,
                        patient:hospital_patients(*)
                    `)
                    .eq('doctor_id', doctor.id)
                    .eq('patient_id', historyItem.patient_id)
                    .is('queue_id', null)
                    .gte('created_at', todayStart)
                    .order('created_at', { ascending: false });

                if (resent.data && (resent.data as any[]).length > 0) {
                    // Deduplicate by id
                    const existingIds = new Set(results.map((r: any) => r.id));
                    for (const rx of (resent.data as any[])) {
                        if (!existingIds.has(rx.id)) results.push(rx);
                    }
                }
            }

            // Fallback: if no results by queue_id, try patient_id
            if (results.length === 0 && historyItem.patient_id) {
                const fallback = await supabase
                    .from('hospital_prescriptions' as any)
                    .select(`
                        *,
                        patient:hospital_patients(*)
                    `)
                    .eq('doctor_id', doctor.id)
                    .eq('patient_id', historyItem.patient_id)
                    .order('created_at', { ascending: false })
                    .limit(5);
                results = (fallback.data as any[]) || [];
            }

            if (results.length === 0) {
                toast.dismiss(toastId);
                toast.error('No prescription found for this visit');
                return;
            }

            toast.dismiss(toastId);

            // Sort by created_at descending
            results.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (results.length === 1) {
                // Only 1 prescription — open directly
                if (mode === 'view') {
                    setSelectedHistoryItem(results[0]);
                } else {
                    setEditResendItem(results[0]);
                }
            } else {
                // Multiple prescriptions — show picker
                setPrescriptionPickerItems(results);
                setPrescriptionPickerMode(mode);
            }
        } catch (err) {
            console.error(err);
            toast.dismiss(toastId);
            toast.error('Could not load prescription');
        }
    };

    const handleViewPrescription = async (historyItem: any) => {
        await fetchPrescriptionsForItem(historyItem, 'view');
    };

    const handleEditResend = async (historyItem: any) => {
        await fetchPrescriptionsForItem(historyItem, 'edit');
    };

    const handlePastRxForQueueItem = async (item: any) => {
        // Fix 4: Prevent double-click race — only one Past Rx fetch at a time
        if (isPastRxLoadingRef.current) return;
        isPastRxLoadingRef.current = true;

        setPastRxQueueItem(null);
        setSelectedPatient({
            ...item.patient,
            token_number: item.patient.token_number || item.token_number
        });
        setSelectedQueueId(item.id);

        const toastId = toast.loading('Loading past prescriptions...');
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select('*, patient:hospital_patients(*)')
                .eq('doctor_id', doctor.id)
                .eq('patient_id', item.patient_id)
                .order('created_at', { ascending: false })
                .limit(10);

            toast.dismiss(toastId);

            if (error) throw error;
            const results = (data as any[]) || [];

            if (results.length === 0) {
                toast.error('No past prescriptions found for this patient');
                return;
            }
            if (results.length === 1) {
                setPastRxQueueItem(results[0]);
            } else {
                setPrescriptionPickerItems(results);
                setPrescriptionPickerMode('queue-prescribe');
            }
        } catch (err) {
            toast.dismiss(toastId);
            toast.error('Could not load past prescriptions');
        } finally {
            isPastRxLoadingRef.current = false;
        }
    };

    const handleUpdateStatus = async (queueId: string, status: string) => {
        try {
            let error: any = null;
            if (paActorAuthEnabled && status === 'completed' && !actorSession?.sessionToken) {
                toast.error('Session expired. Please log in again.');
                return;
            }

            if (paActorAuthEnabled && actorSession?.sessionToken && status === 'completed') {
                const rpcResult = await (supabase as any).rpc('doctor_mark_queue_done', {
                    p_hospital_id: doctor.hospital_id,
                    p_chief_doctor_id: doctor.id,
                    p_session_token: actorSession.sessionToken,
                    p_queue_id: queueId,
                });
                error = rpcResult.error;
            } else {
                const updateResult = await (supabase
                    .from('hospital_queues') as any)
                    .update({ status } as any)
                    .eq('id', queueId);
                error = updateResult.error;
            }

            if (error) throw error;
            toast.success(`Patient marked as ${status.replace('_', ' ')}`);
            fetchQueue();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    // Admit a patient directly from the live queue (no prescription).
    // Stamps hospital_queues with admission_status='admitted' and
    // sets status='completed' so the row leaves the live queue.
    const handleAdmitPatient = async (queueId: string) => {
        const toastId = toast.loading('Admitting patient...');
        try {
            await admitPatientFromQueue({ queueId, hospitalId: doctor.hospital_id });
            toast.success('Patient admitted', { id: toastId });
            fetchQueue(true);
            setAdmittedRefreshToken(t => t + 1);
        } catch (err) {
            console.error('[EnterpriseDoctorDashboard] admit failed', err);
            toast.error('Could not admit patient', { id: toastId });
        }
    };

    // Launch the prescribe flow for an already-admitted patient.
    // Reuses the same machinery as queue-row Prescribe: sets
    // selectedPatient + selectedQueueId and opens the Rx modal.
    const handlePrescribeAdmitted = async (ctx: AdmittedPrescribeContext) => {
        setSelectedPatient({
            id: ctx.patient.id,
            name: ctx.patient.name,
            age: ctx.patient.age,
            token_number: ctx.tokenNumber || '',
            mr_number: ctx.patient.mr_number || null,
            app_access_enabled: null,
        });
        setSelectedQueueId(ctx.queueId);
        await setPreparingIndicator(ctx.queueId);
        setAdmittedRefreshToken(t => t + 1);
        setShowRxModal(true);
        logViewEvent('view.patient.open', { patientId: ctx.patientId, queueId: ctx.queueId });
    };

    // ... (rest of handlers like handleMedChange, handleSendToPharmacy remain same)
    const handleAddMedication = () => {
        setMedications([...medications, { name: '', dosage: '', frequency: '', duration: '', instruction: '' }]);
    };

    const handleRemoveMedication = (index: number) => {
        const newMeds = [...medications];
        newMeds.splice(index, 1);
        setMedications(newMeds);
    };

    const handleMedChange = (index: number, field: keyof Medication, value: string) => {
        const newMeds = [...medications];
        newMeds[index][field] = value;
        setMedications(newMeds);
    };

    // Shared helper: keep hospital_patient_reviews in sync with the latest prescription review date.
    // Called from all prescription save paths. Non-critical — errors are warned, never thrown.
    const upsertReviewFromPrescription = async (
        patientId: string,
        prescriptionId: string,
        reviewDate: string | null,
        testsToReview: string | null,
        specialistsToReview: string | null
    ) => {
        if (!doctor.hospital_id) return;
        try {
            // Find the most recent pending/rescheduled review for this patient
            const { data: existing } = await (supabase as any)
                .from('hospital_patient_reviews')
                .select('id')
                .eq('hospital_id', doctor.hospital_id)
                .eq('patient_id', patientId)
                .in('status', ['pending', 'rescheduled'])
                .order('next_review_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (existing?.id) {
                // Update existing review to latest prescription date
                await (supabase as any)
                    .from('hospital_patient_reviews')
                    .update({
                        next_review_date: reviewDate,
                        tests_to_review: testsToReview || null,
                        specialists_to_review: specialistsToReview || null,
                        source_prescription_id: prescriptionId,
                        status: 'pending',
                        cancelled_at: null,
                        completed_at: null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);
            } else {
                // No active review — create one from this prescription
                await (supabase as any)
                    .from('hospital_patient_reviews')
                    .insert({
                        hospital_id: doctor.hospital_id,
                        patient_id: patientId,
                        doctor_id: doctor.id,
                        source_prescription_id: prescriptionId,
                        next_review_date: reviewDate,
                        tests_to_review: testsToReview || null,
                        specialists_to_review: specialistsToReview || null,
                        status: 'pending',
                    });
            }
        } catch (err) {
            console.warn('Review sync from prescription failed (non-critical):', err);
        }
    };

    const setPreparingIndicator = async (queueId: string) => {
        await (supabase as any)
            .from('hospital_queues')
            .update({ preparing_by: actorDisplayName })
            .eq('id', queueId);
    };

    const clearPreparingIndicator = async (queueId: string | null) => {
        if (!queueId) return;
        await (supabase as any)
            .from('hospital_queues')
            .update({ preparing_by: null })
            .eq('id', queueId);
    };

    const handleConfirmPrescribe = async () => {
        if (!prescribeCandidate) return;
        const { queueItem, mode } = prescribeCandidate;
        setPrescribeCandidate(null);
        await setPreparingIndicator(queueItem.id);
        setSelectedPatient({
            ...queueItem.patient,
            token_number: queueItem.patient.token_number || queueItem.token_number
        });
        setSelectedQueueId(queueItem.id);
        if (mode === 'new') {
            setShowRxModal(true);
            logViewEvent('view.patient.open', { patientId: queueItem.patient_id, queueId: queueItem.id });
        } else {
            await handlePastRxForQueueItem(queueItem);
        }
    };

    const handleSendToPharmacy = async (
        prescriptionMeds: any[],
        prescriptionNotes: string,
        reviewContext?: { nextReviewDate: string | null; testsToReview: string; specialistsToReview: string },
        callbackPatientId?: string
    ) => {
        if (!selectedPatient || !selectedQueueId) return;

        // Fix 1: Verify the patient the modal was opened for still matches the parent state.
        // If another queue interaction silently changed selectedPatient, abort immediately.
        if (callbackPatientId && callbackPatientId !== selectedPatient.id) {
            toast.error(
                `SAFETY BLOCK: Patient identity mismatch detected! The modal was for a different patient than the current selection. Prescription NOT sent. Please close and re-open the prescription.`,
                { duration: 8000 }
            );
            console.error('[PATIENT SAFETY] Identity mismatch — modal patientId:', callbackPatientId, 'selectedPatient.id:', selectedPatient.id);
            return;
        }
        if (isSendingToPharmacyRef.current) return;
        isSendingToPharmacyRef.current = true;
        const toastId = toast.loading('Sending to pharmacy...');

        try {
            if (paActorAuthEnabled && !actorSession?.sessionToken) {
                throw new Error('Session expired. Please log in again.');
            }

            if (paActorAuthEnabled && actorSession?.sessionToken) {
                const { data, error } = await (supabase as any).rpc('doctor_save_prescription_and_send', {
                    p_hospital_id: doctor.hospital_id,
                    p_chief_doctor_id: doctor.id,
                    p_session_token: actorSession.sessionToken,
                    p_patient_id: selectedPatient.id,
                    p_queue_id: selectedQueueId,
                    p_token_number: selectedPatient.token_number,
                    p_medications: prescriptionMeds,
                    p_notes: prescriptionNotes,
                    p_next_review_date: reviewContext?.nextReviewDate || null,
                    p_tests_to_review: reviewContext?.testsToReview || null,
                    p_specialists_to_review: reviewContext?.specialistsToReview || null,
                    p_metadata: {
                        actorType,
                        actorDisplayName
                    }
                });

                if (error) throw error;
                const row = Array.isArray(data) ? data[0] : null;
                if (!row?.saved_prescription_id) {
                    throw new Error('Prescription was not saved');
                }

                // Sync review date from this prescription (RPC path)
                await upsertReviewFromPrescription(
                    selectedPatient.id,
                    row.saved_prescription_id,
                    reviewContext?.nextReviewDate || null,
                    reviewContext?.testsToReview || null,
                    reviewContext?.specialistsToReview || null
                );

                toast.success('Prescription sent to Pharmacy!', { id: toastId });
                await clearPreparingIndicator(selectedQueueId);
                setShowRxModal(false);
                setPastRxQueueItem(null);
                setSelectedQueueId(null);
                setSelectedPatient(null);
                fetchQueue(true);
                setAdmittedRefreshToken(t => t + 1);
                return;
            }

            let prescriptionId: string | null = null;

            // Idempotency: one prescription per queue visit.
            const existingByQueue = await supabase
                .from('hospital_prescriptions' as any)
                .select('id, status')
                .eq('queue_id', selectedQueueId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            const existingByQueueData = existingByQueue.data as any;

            if (existingByQueueData?.id) {
                prescriptionId = existingByQueueData.id;
            } else {
                // Fallback if queue_id column is not yet present in DB.
                if (existingByQueue.error && String(existingByQueue.error.message || '').toLowerCase().includes('queue_id')) {
                    const legacyMatch = await supabase
                        .from('hospital_prescriptions' as any)
                        .select('id')
                        .eq('doctor_id', doctor.id)
                        .eq('patient_id', selectedPatient.id)
                        .eq('token_number', selectedPatient.token_number)
                        .gte('created_at', getTodayISO())
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    const legacyMatchData = legacyMatch.data as any;
                    if (legacyMatchData?.id) {
                        prescriptionId = legacyMatchData.id;
                    }
                }
            }

            if (!prescriptionId) {
                const insertWithQueue = await supabase
                    .from('hospital_prescriptions' as any)
                    .insert({
                        hospital_id: doctor.hospital_id,
                        doctor_id: doctor.id,
                        patient_id: selectedPatient.id,
                        queue_id: selectedQueueId,
                        token_number: selectedPatient.token_number,
                        medications: prescriptionMeds,
                        notes: prescriptionNotes,
                        next_review_date: reviewContext?.nextReviewDate || null,
                        tests_to_review: reviewContext?.testsToReview || null,
                        specialists_to_review: reviewContext?.specialistsToReview || null,
                        status: 'pending',
                        metadata: {
                            actorType,
                            actorDisplayName
                        }
                    } as any)
                    .select('id')
                    .single();

                // Backward compatibility for DBs where queue_id isn't migrated yet.
                if (
                    insertWithQueue.error &&
                    (
                        String(insertWithQueue.error.message || '').toLowerCase().includes('queue_id') ||
                        String(insertWithQueue.error.message || '').toLowerCase().includes('next_review_date') ||
                        String(insertWithQueue.error.message || '').toLowerCase().includes('tests_to_review') ||
                        String(insertWithQueue.error.message || '').toLowerCase().includes('specialists_to_review')
                    )
                ) {
                    const insertLegacy = await supabase
                        .from('hospital_prescriptions' as any)
                        .insert({
                            hospital_id: doctor.hospital_id,
                            doctor_id: doctor.id,
                            patient_id: selectedPatient.id,
                            token_number: selectedPatient.token_number,
                            medications: prescriptionMeds,
                            notes: prescriptionNotes,
                            status: 'pending'
                        } as any)
                        .select('id')
                        .single();
                    if (insertLegacy.error) throw insertLegacy.error;
                    prescriptionId = (insertLegacy.data as any)?.id || null;
                } else {
                    if (insertWithQueue.error) throw insertWithQueue.error;
                    prescriptionId = (insertWithQueue.data as any)?.id || null;
                }
            } else {
                const updateWithStructured = await (supabase
                    .from('hospital_prescriptions') as any)
                    .update({
                        medications: prescriptionMeds,
                        notes: prescriptionNotes,
                        next_review_date: reviewContext?.nextReviewDate || null,
                        tests_to_review: reviewContext?.testsToReview || null,
                        specialists_to_review: reviewContext?.specialistsToReview || null,
                        status: 'pending'
                    })
                    .eq('id', prescriptionId);

                if (
                    updateWithStructured.error &&
                    (
                        String(updateWithStructured.error.message || '').toLowerCase().includes('next_review_date') ||
                        String(updateWithStructured.error.message || '').toLowerCase().includes('tests_to_review') ||
                        String(updateWithStructured.error.message || '').toLowerCase().includes('specialists_to_review')
                    )
                ) {
                    const updateLegacy = await (supabase
                        .from('hospital_prescriptions') as any)
                        .update({
                            medications: prescriptionMeds,
                            notes: prescriptionNotes,
                            status: 'pending'
                        })
                        .eq('id', prescriptionId);
                    if (updateLegacy.error) throw updateLegacy.error;
                } else if (updateWithStructured.error) {
                    throw updateWithStructured.error;
                }
            }

            if (!prescriptionId) throw new Error('Prescription ID missing after save');

            // Sync queue row in an idempotent way.
            const existingQueue = await (supabase as any)
                .from('hospital_pharmacy_queue')
                .select('id')
                .eq('prescription_id', prescriptionId)
                .limit(1)
                .maybeSingle();

            let queueError: any = null;
            if (existingQueue.data?.id) {
                const updateQueue = await (supabase as any)
                    .from('hospital_pharmacy_queue')
                    .update({
                        patient_name: selectedPatient.name,
                        token_number: selectedPatient.token_number,
                        status: 'waiting'
                    })
                    .eq('id', existingQueue.data.id);
                queueError = updateQueue.error;
            } else {
                const insertQueue = await (supabase as any)
                    .from('hospital_pharmacy_queue')
                    .insert({
                        hospital_id: doctor.hospital_id,
                        prescription_id: prescriptionId,
                        patient_name: selectedPatient.name,
                        token_number: selectedPatient.token_number,
                        status: 'waiting'
                    });
                queueError = insertQueue.error;
            }

            if (queueError) {
                console.error('Pharmacy Queue sync failed:', queueError);
            }

            // Sync review date from this prescription (normal path)
            await upsertReviewFromPrescription(
                selectedPatient.id,
                prescriptionId!,
                reviewContext?.nextReviewDate || null,
                reviewContext?.testsToReview || null,
                reviewContext?.specialistsToReview || null
            );

            toast.success('Prescription sent to Pharmacy!', { id: toastId });
            await clearPreparingIndicator(selectedQueueId);
            setShowRxModal(false);
            setPastRxQueueItem(null);
            setSelectedQueueId(null);
            setSelectedPatient(null);
            setAdmittedRefreshToken(t => t + 1);
            await handleUpdateStatus(selectedQueueId, 'completed');
        } catch (error: any) {
            console.error('Full Error Object:', error);
            // FK violation (23503) or our explicit patient_not_found guard in the RPC:
            // the queue has stale data — patient was deleted after the queue was loaded.
            const isPatientMissing =
                error?.code === '23503' && (error?.details || '').includes('hospital_patients') ||
                (error?.message || '').startsWith('patient_not_found');
            if (isPatientMissing) {
                toast.error('Patient record not found — the queue has been refreshed. Please try again.', { id: toastId });
                fetchQueue(true);
            } else {
                toast.error(`Failed to send: ${error.message || 'Unknown error'}`, { id: toastId });
            }
        } finally {
            isSendingToPharmacyRef.current = false;
        }
    };

    // Edit & Resend: always INSERT a new prescription row
    const handleResendToPharmacy = async (
        prescriptionMeds: any[],
        prescriptionNotes: string,
        reviewContext?: { nextReviewDate: string | null; testsToReview: string; specialistsToReview: string }
    ) => {
        if (!editResendItem?.patient) return;
        if (isSendingToPharmacyRef.current) return;
        isSendingToPharmacyRef.current = true;
        const toastId = toast.loading('Resending prescription...');
        const patient = editResendItem.patient;

        try {
            // Always insert a new prescription (resend = new row, queue_id = null)
            const insertResult = await supabase
                .from('hospital_prescriptions' as any)
                .insert({
                    hospital_id: doctor.hospital_id,
                    doctor_id: doctor.id,
                    patient_id: patient.id,
                    queue_id: null,
                    token_number: editResendItem.token_number || patient.token_number,
                    medications: prescriptionMeds,
                    notes: prescriptionNotes,
                    next_review_date: reviewContext?.nextReviewDate || null,
                    tests_to_review: reviewContext?.testsToReview || null,
                    specialists_to_review: reviewContext?.specialistsToReview || null,
                    status: 'pending',
                    metadata: {
                        actorType,
                        actorDisplayName,
                        resent_from: editResendItem.id
                    }
                } as any)
                .select('id')
                .single();

            if (insertResult.error) {
                // Fallback for DBs missing newer columns
                const fallbackInsert = await supabase
                    .from('hospital_prescriptions' as any)
                    .insert({
                        hospital_id: doctor.hospital_id,
                        doctor_id: doctor.id,
                        patient_id: patient.id,
                        token_number: editResendItem.token_number || patient.token_number,
                        medications: prescriptionMeds,
                        notes: prescriptionNotes,
                        status: 'pending'
                    } as any)
                    .select('id')
                    .single();
                if (fallbackInsert.error) throw fallbackInsert.error;
                var prescriptionId = (fallbackInsert.data as any)?.id;
            } else {
                var prescriptionId = (insertResult.data as any)?.id;
            }

            if (!prescriptionId) throw new Error('Prescription ID missing after save');

            // Cancel the old prescription so it disappears from the pharmacy view,
            // and remove it from the pharmacy queue display as well.
            const oldPrescriptionId = editResendItem?.id;
            if (oldPrescriptionId && oldPrescriptionId !== prescriptionId) {
                await (supabase
                    .from('hospital_prescriptions' as any) as any)
                    .update({ status: 'cancelled' })
                    .eq('id', oldPrescriptionId);
                await (supabase as any)
                    .from('hospital_pharmacy_queue')
                    .delete()
                    .eq('prescription_id', oldPrescriptionId);
            }

            // Add to pharmacy queue
            await (supabase as any)
                .from('hospital_pharmacy_queue')
                .insert({
                    hospital_id: doctor.hospital_id,
                    prescription_id: prescriptionId,
                    patient_name: patient.name,
                    token_number: editResendItem.token_number || patient.token_number,
                    status: 'waiting'
                });

            // Sync review date from this resent prescription
            await upsertReviewFromPrescription(
                patient.id,
                prescriptionId,
                reviewContext?.nextReviewDate || null,
                reviewContext?.testsToReview || null,
                reviewContext?.specialistsToReview || null
            );

            toast.success('Prescription resent to Pharmacy!', { id: toastId });
            setEditResendItem(null);
            // Refresh data
            if (viewMode === 'history') fetchHistory(true);
            else if (viewMode === 'past_records') fetchPastRecords(true);
        } catch (error: any) {
            console.error('Resend error:', error);
            toast.error(`Failed to resend: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            isSendingToPharmacyRef.current = false;
        }
    };

    // View Item for History
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
    const [markDoneCandidate, setMarkDoneCandidate] = useState<{ queueId: string; patientName: string } | null>(null);
    const [admitCandidate, setAdmitCandidate] = useState<{ queueId: string; patientName: string; mrNumber: string | null } | null>(null);
    const [admittedRefreshToken, setAdmittedRefreshToken] = useState(0);
    const [prescribeCandidate, setPrescribeCandidate] = useState<{ queueItem: QueueItem; mode: 'new' | 'past' } | null>(null);

    // Edit & Resend state
    const [editResendItem, setEditResendItem] = useState<any>(null);
    const [prescriptionPickerItems, setPrescriptionPickerItems] = useState<any[]>([]);
    const [prescriptionPickerMode, setPrescriptionPickerMode] = useState<'view' | 'edit' | 'queue-prescribe'>('view');

    // Past Rx for queue item state
    const [pastRxQueueItem, setPastRxQueueItem] = useState<any>(null);

    // Fix 3 & 5: Track whether any prescription modal is open.
    // Used to (a) block queue button clicks and (b) suppress background refetches.
    const isAnyModalOpen = showRxModal || !!pastRxQueueItem || prescriptionPickerItems.length > 0 || !!editResendItem || !!selectedHistoryItem || !!prescribeCandidate;

    // Fix 5: Keep the ref in sync so interval/realtime closures see the latest value
    useEffect(() => { isModalOpenRef.current = isAnyModalOpen; }, [isAnyModalOpen]);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-black font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Floating Glassmorphism Header */}
            <div className="sticky top-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent pointer-events-none" />

                <header className="pointer-events-auto relative mt-2 sm:mt-4 w-full max-w-7xl h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl saturate-150 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-[#8AC43C]/15 flex items-center transition-all duration-300 shadow-sm md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)]">
                    <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                            <button
                                onClick={onBack}
                                className="p-2 sm:p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0 active:scale-95"
                                title="Back to Doctors List"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

                            <div
                                onClick={onBack}
                                className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform group/logo"
                            >
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-300">
                                    <LogoIcon className="w-6 h-6 sm:w-8 sm:h-8 transition-transform duration-300" />
                                </div>
                                <div className="flex flex-col justify-center min-w-0">
                                    <h2 className="text-sm sm:text-lg md:text-xl font-bold leading-none tracking-tight">
                                        <span className="text-primary-500 dark:text-[#e6b8a3]">Bean</span>
                                        <span className="text-secondary-500">Health</span>
                                    </h2>
                                    <p className="text-[7px] sm:text-[9px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-[0.2em] mt-0.5 uppercase truncate">Enterprise Portal</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Section - Hospital Logo & Name */}
                        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                                    {hospitalLogo ? (
                                        <img
                                            src={hospitalLogo}
                                            alt="Hospital"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">H</span>
                                    )}
                                </div>
                                <div className="hidden md:block text-right">
                                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                                        {formatDoctorName(currentDoctor.name)}
                                    </p>
                                    <p className="text-[10px] font-bold text-[#717171] dark:text-[#a0a0a0] tracking-wide mt-1 uppercase leading-none">{currentDoctor.specialty || 'GENERAL MEDICINE'}</p>
                                    {paActorAuthEnabled && (
                                        <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                            <span>{actorType === 'chief' ? 'Chief' : `Jr. ${actorDisplayName}`}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 sm:py-8">
                {/* Title & Controls Section */}
                <div className="flex flex-col gap-4 mb-6 sm:mb-8 md:mb-10">
                    {/* Row 1: Title + CKD button */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div>
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                                {formatDoctorName(currentDoctor.name)}
                            </h2>
                            <p className="text-sm sm:text-base md:text-lg text-gray-700 mt-1">Manage your patient queue and consultations</p>
                            {paActorAuthEnabled && (
                                <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold">
                                    {actorType === 'chief' ? 'Logged in as Chief' : `Logged in as Jr. ${actorDisplayName}`}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setViewMode('ckd_snapshot')}
                            className="relative group overflow-hidden rounded-xl w-full sm:w-auto flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #9333ea, #ec4899)', padding: '2px' }}
                        >
                            <div
                                className="absolute inset-[-2px] rounded-xl opacity-75 group-hover:opacity-100 transition-opacity"
                                style={{
                                    background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff, #ff0000)',
                                    backgroundSize: '400% 400%',
                                    animation: 'rainbow-slide 3s linear infinite',
                                    zIndex: 0
                                }}
                            />
                            <div className="relative flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-[10px] text-white font-bold text-xs sm:text-sm z-10 whitespace-nowrap">
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="uppercase tracking-wide">BeanHealth AI</span>
                            </div>
                        </button>
                    </div>

                    {/* Row 2: Tabs + Settings + Reload */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        {/* Tab switcher — scrollable container prevents overflow on small tablets */}
                        <div className="flex-1 overflow-x-auto">
                            <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-sm inline-grid grid-cols-4 gap-1 min-w-max w-full max-w-2xl">
                                <button
                                    onClick={() => setViewMode('queue')}
                                    className={`px-2.5 md:px-4 py-1.5 rounded-xl text-center text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'queue' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    Active Queue
                                </button>
                                <button
                                    onClick={() => setViewMode('history')}
                                    className={`px-2.5 md:px-4 py-1.5 rounded-xl text-center text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'history' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    History Log
                                </button>
                                <button
                                    onClick={() => setViewMode('past_records')}
                                    className={`px-2.5 md:px-4 py-1.5 rounded-xl text-center text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'past_records' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    Past Records
                                </button>
                                <button
                                    onClick={() => setViewMode('admitted')}
                                    className={`px-2.5 md:px-4 py-1.5 rounded-xl text-center text-[10px] sm:text-xs md:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'admitted' ? 'bg-rose-600 text-white shadow-md' : 'text-gray-700 hover:text-rose-700 hover:bg-rose-50'}`}
                                >
                                    Admitted
                                </button>
                            </div>
                        </div>

                        {/* Settings & Reload — always a tight horizontal row */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {canManageTeamAudit && (
                                <button
                                    onClick={() => setShowTeamAuditModal(true)}
                                    className="px-3 py-2 bg-white text-gray-700 hover:text-blue-700 rounded-2xl border border-gray-200 hover:border-blue-200 transition-all shadow-sm text-xs sm:text-sm font-bold whitespace-nowrap"
                                    title="Team & Audit"
                                >
                                    Team & Audit
                                </button>
                            )}
                            <button
                                onClick={() => setShowSettingsModal(true)}
                                className={`p-2 sm:p-2.5 bg-white text-gray-500 hover:text-blue-600 rounded-2xl border border-gray-200 hover:border-blue-200 transition-all shadow-sm flex-shrink-0 ${currentDoctor.signature_url ? '' : 'animate-pulse ring-2 ring-blue-500/20'}`}
                                title="Doctor Settings & Signature"
                            >
                                <div className="relative">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    {!currentDoctor.signature_url && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border border-white"></span>
                                    )}
                                </div>
                            </button>
                            <button
                                onClick={() => viewMode === 'queue' ? fetchQueue() : fetchHistory()}
                                className="p-2 sm:p-2.5 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm flex-shrink-0"
                                title="Reload"
                            >
                                <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rainbow animation keyframes - injected via style tag */}
            <style>{`
                @keyframes rainbow-slide {
                    0% { background-position: 0% 50%; }
                    100% { background-position: 400% 50%; }
                }
            `}</style>

            {viewMode === 'ckd_snapshot' ? (
                <EnterpriseCKDSnapshotView
                    doctor={doctor}
                    onBack={() => setViewMode('queue')}
                />
            ) : viewMode === 'past_records' ? (
                <DoctorPastRecordsPanel
                    doctor={currentDoctor}
                    onBack={() => setViewMode('queue')}
                    onViewPrescription={handleViewPrescription}
                    onEditResend={handleEditResend}
                />
            ) : viewMode === 'admitted' ? (
                <AdmittedPatientsPanel
                    key={`admitted-${admittedRefreshToken}`}
                    hospitalId={currentDoctor.hospital_id}
                    doctor={currentDoctor}
                    doctorId={currentDoctor.id}
                    enablePrescribe={true}
                    onPrescribe={handlePrescribeAdmitted}
                    actorDisplayName={actorDisplayName}
                />
            ) : (
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
                    {viewMode === 'queue' ? (
                        <>
                            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-gray-900 text-lg">Current Queue</h3>
                                    <div className="relative flex items-center">
                                        <svg className="absolute left-2.5 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <input
                                            type="text"
                                            value={queueSearch}
                                            onChange={e => setQueueSearch(e.target.value)}
                                            placeholder="Name or MR…"
                                            className="pl-8 pr-8 py-1.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 w-44"
                                        />
                                        {queueSearch && (
                                            <button
                                                onClick={() => setQueueSearch('')}
                                                className="absolute right-2 text-gray-400 hover:text-gray-600"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-gray-700 sm:hidden">{queue.length} waiting</span>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-3 sm:mt-0 w-full sm:w-auto">
                                    <button
                                        onClick={() => setShowManageDrugsModal(true)}
                                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 min-w-[120px]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>Manage Drugs</span>
                                    </button>
                                    <button
                                        onClick={() => setShowManageDiagnosesModal(true)}
                                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-1.5 sm:gap-2 shrink-0 min-w-[120px]"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Manage Diag</span>
                                    </button>
                                    <span className="hidden sm:inline text-sm font-medium text-gray-700 ml-2">{queue.length} Patients Waiting</span>
                                </div>
                            </div>

                            {loading ? (
                                <div className="p-20 text-center">
                                    <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full mx-auto mb-4"></div>
                                    <p className="text-gray-700">Loading active patients...</p>
                                </div>
                            ) : queue.length === 0 ? (
                                <div className="p-24 text-center flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900">Queue is Empty</h3>
                                    <p className="text-gray-700 mt-1">No patients are currently waiting for consultation.</p>
                                </div>
                            ) : (
                                <div className={`divide-y divide-gray-50 ${isAnyModalOpen ? 'pointer-events-none opacity-60' : ''}`}>
                                    {queue.filter(item => {
                                        if (!queueSearch.trim()) return true;
                                        const q = queueSearch.toLowerCase();
                                        return item.patient.name?.toLowerCase().includes(q) || item.patient.mr_number?.toLowerCase().includes(q);
                                    }).map((item) => (
                                        <div key={item.id} className="p-5 sm:p-6 md:p-8 hover:bg-gray-50 transition-colors group">
                                            <div className="flex flex-col min-[500px]:grid min-[500px]:grid-cols-[minmax(0,1fr)_240px] md:grid-cols-[minmax(0,1fr)_380px] lg:grid-cols-[minmax(0,1fr)_500px] min-[500px]:items-start gap-4">
                                                <div className="flex items-center gap-4 sm:gap-6">
                                                    <div className={`w-14 h-12 sm:w-16 sm:h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0 px-2
                                                        ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                            item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                        {item.patient.token_number}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-gray-900">{item.patient.name}</h4>
                                                        {item.patient.mr_number && (
                                                            <div className="text-xs font-bold text-gray-700">{item.patient.mr_number}</div>
                                                        )}
                                                        {item.preparing_by && (
                                                            <div className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                {item.preparing_by} preparing
                                                            </div>
                                                        )}
                                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                                            <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold">
                                                                {item.patient.age} yrs
                                                            </span>
                                                            {(() => {
                                                                const metrics = queueMetricsByPatientId[item.patient_id];
                                                                if (queueMetricsLoading && !metrics) {
                                                                    return (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                                                            Syncing metrics...
                                                                        </span>
                                                                    );
                                                                }
                                                                if (!metrics) {
                                                                    return (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold">
                                                                            Metrics unavailable
                                                                        </span>
                                                                    );
                                                                }
                                                                if (!metrics.profileConfigured) {
                                                                    return (
                                                                        <span className="inline-flex items-center px-2 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-bold border border-violet-100">
                                                                            {metrics.profileLabel} pending
                                                                        </span>
                                                                    );
                                                                }

                                                                const availabilityClass = metrics.availability === 'complete'
                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                                                    : metrics.availability === 'partial'
                                                                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                                                        : 'bg-rose-50 text-rose-700 border border-rose-100';
                                                                const availabilityLabel = metrics.availability === 'complete'
                                                                    ? 'Metrics complete'
                                                                    : metrics.availability === 'partial'
                                                                        ? 'Metrics partial'
                                                                        : 'No metrics today';
                                                                return (
                                                                    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${availabilityClass}`}>
                                                                        {availabilityLabel}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="w-full min-[500px]:w-auto mt-2 min-[500px]:mt-0">
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                    <button
                                                        onClick={() => toggleQueuePatientMetrics(item.patient_id)}
                                                        className="px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                                                    >
                                                        <span>Patient Metrics</span>
                                                        <svg className={`w-4 h-4 transition-transform ${expandedQueuePatientIds.has(item.patient_id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </button>

                                                    <button
                                                        onClick={() => setAdmitCandidate({
                                                            queueId: item.id,
                                                            patientName: item.patient.name,
                                                            mrNumber: item.patient.mr_number || null,
                                                        })}
                                                        className="px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all whitespace-nowrap"
                                                    >
                                                        Admit
                                                    </button>

                                                    <button
                                                        onClick={() => setPrescribeCandidate({ queueItem: item, mode: 'new' })}
                                                        className="px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        <span className="hidden xs:inline">Prescribe</span>
                                                        <span className="xs:hidden">Prescribe</span>
                                                    </button>

                                                    <button
                                                        onClick={() => setPrescribeCandidate({ queueItem: item, mode: 'past' })}
                                                        className="px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-indigo-700 bg-indigo-50 rounded-xl hover:bg-indigo-100 border border-indigo-100 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <span>Past Rx</span>
                                                    </button>

                                                    <button
                                                        onClick={() => setMarkDoneCandidate({ queueId: item.id, patientName: item.patient.name })}
                                                        className="px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap"
                                                    >
                                                        Mark Done
                                                    </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {expandedQueuePatientIds.has(item.patient_id) && (
                                                <div className="mt-4 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-4 sm:p-5 animate-fade-in">
                                                    {(() => {
                                                        const metrics = queueMetricsByPatientId[item.patient_id];
                                                        if (!metrics) {
                                                            return (
                                                                <div className="text-sm text-slate-600 font-medium">
                                                                    Patient metrics are syncing. Please wait a moment.
                                                                </div>
                                                            );
                                                        }

                                                        if (item.patient.app_access_enabled === false) {
                                                            return (
                                                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-700 text-sm font-medium">
                                                                    Patient App access is currently disabled for this patient. Enable app access to view submitted vitals and consumption data.
                                                                </div>
                                                            );
                                                        }

                                                        if (!metrics.profileConfigured) {
                                                            return (
                                                                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-violet-700 text-sm font-medium">
                                                                    This department does not have a configured queue metrics profile yet. Nephrology is isolated and active; other departments can be added with their own adapter.
                                                                </div>
                                                            );
                                                        }

                                                        if (metrics.sections.length === 0) {
                                                            return (
                                                                <div className="text-sm text-slate-600 font-medium">
                                                                    No metrics captured for today.
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <>
                                                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                                                    <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                                        {metrics.profileLabel}
                                                                    </div>
                                                                    <div className="text-xs font-medium text-slate-500">{formatMetricsTimestamp(metrics.lastUpdatedAt)}</div>
                                                                </div>
                                                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                                    {metrics.sections.map(section => (
                                                                        <div key={section.key} className="rounded-xl border border-slate-200 bg-white p-3.5">
                                                                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">{section.title}</div>
                                                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                                                {section.cards.map(card => (
                                                                                    <div key={card.key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                                                                                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{card.label}</div>
                                                                                        <div className={`mt-1 text-base font-bold ${card.value === '--' ? 'text-slate-400' : 'text-slate-900'}`}>
                                                                                            {card.value}
                                                                                            {card.unit && <span className="ml-1 text-xs font-semibold text-slate-500">{card.unit}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>

                                                                <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                                                        <div>
                                                                            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Date-wise Patient App Metrics</div>
                                                                            <div className="text-sm font-semibold text-slate-800 mt-0.5">
                                                                                {`${formatMetricsDate(metrics.timelineEndDate)} to ${formatMetricsDate(metrics.timelineStartDate)} (latest to oldest)`}
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                                                                            {metrics.timelineDays.length} days
                                                                        </div>
                                                                    </div>

                                                                    <div className="overflow-x-auto">
                                                                        <div className="min-w-[860px]">
                                                                            <div className="grid grid-cols-[130px_120px_170px_90px_110px_100px_110px] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/70">
                                                                                <span>Date</span>
                                                                                <span>BP</span>
                                                                                <span>Glucose</span>
                                                                                <span>Weight</span>
                                                                                <span>Fluid</span>
                                                                                <span>Salt</span>
                                                                                <span>Urine</span>
                                                                            </div>
                                                                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                                                                {metrics.timelineDays.map(day => (
                                                                                    <div
                                                                                        key={day.date}
                                                                                        className={`grid grid-cols-[130px_120px_170px_90px_110px_100px_110px] px-4 py-2.5 text-sm ${day.hasAnyData ? 'bg-white' : 'bg-slate-50/40'}`}
                                                                                    >
                                                                                        <div className="font-semibold text-slate-800">{formatMetricsDate(day.date)}</div>
                                                                                        <div className={`${day.bloodPressure === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.bloodPressure === '--' ? '--' : `${day.bloodPressure} mmHg`}
                                                                                        </div>
                                                                                        <div className={`${day.bloodGlucose === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.bloodGlucose === '--'
                                                                                                ? '--'
                                                                                                : day.bloodGlucoseType && day.bloodGlucoseType !== '--'
                                                                                                    ? `${day.bloodGlucose} mg/dL (${day.bloodGlucoseType})`
                                                                                                    : `${day.bloodGlucose} mg/dL`}
                                                                                        </div>
                                                                                        <div className={`${day.weight === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.weight === '--' ? '--' : `${day.weight} kg`}
                                                                                        </div>
                                                                                        <div className={`${day.fluidIntake === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.fluidIntake === '--' ? '--' : `${day.fluidIntake} ml`}
                                                                                        </div>
                                                                                        <div className={`${day.saltIntake === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.saltIntake === '--' ? '--' : `${day.saltIntake} g`}
                                                                                        </div>
                                                                                        <div className={`${day.urineOutput === '--' ? 'text-slate-400' : 'text-slate-700 font-semibold'}`}>
                                                                                            {day.urineOutput === '--' ? '--' : `${day.urineOutput} ml`}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : viewMode === 'history' ? (
                        <>
                            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900">Today's History</h3>
                                <span className="text-sm font-medium text-gray-700">{historyList.length} Completed</span>
                            </div>

                            {loading ? (
                                <div className="p-20 text-center text-gray-700">Loading history...</div>
                            ) : historyList.length === 0 ? (
                                <div className="p-24 text-center flex flex-col items-center justify-center">
                                    <p className="text-gray-700 font-medium">No completed patients today</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {historyList.map((item) => (
                                        <div key={item.id} className="p-5 sm:p-6 md:p-8 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="font-bold text-base sm:text-lg text-gray-900">{item.patient?.name}</div>
                                                        {item.patient?.mr_number && (
                                                            <div className="text-xs font-bold text-gray-700">{item.patient.mr_number}</div>
                                                        )}
                                                        {(() => {
                                                            const prescription = Array.isArray(item.prescription) ? item.prescription[0] : item.prescription;
                                                            const prescribedBy = prescription?.metadata?.actorDisplayName;
                                                            if (!prescribedBy) return null;
                                                            return (
                                                                <div className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                                    Rx by {prescribedBy}
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 text-xs">#{item.patient?.token_number}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                        <span>{new Date(item.updated_at || item.created_at).toLocaleTimeString()}</span>
                                                        {(() => {
                                                            const prescription = Array.isArray(item.prescription) ? item.prescription[0] : item.prescription;
                                                            if (prescription?.dispensed_at) {
                                                                return (
                                                                    <>
                                                                        <span className="w-1 h-1 bg-emerald-400 rounded-full"></span>
                                                                        <span className="text-xs text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
                                                                            Dispensed {new Date(prescription.dispensed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                                        </span>
                                                                    </>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between w-full sm:w-auto gap-3">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">
                                                        Completed
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleViewPrescription(item)}
                                                            className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center gap-1 transition-colors whitespace-nowrap"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                            View PDF
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditResend(item)}
                                                            className="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 flex items-center gap-1 transition-colors whitespace-nowrap"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                            Edit & Resend
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Patient Database Header */}
                            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <h3 className="text-sm font-bold text-gray-800">My Patients</h3>
                                    </div>
                                    {pastRecordsTotal > 0 && (
                                        <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200">
                                            {pastRecords.length} of {pastRecordsTotal} patients
                                        </span>
                                    )}
                                </div>
                                <form onSubmit={handleSearchPastRecords} className="relative w-full sm:max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search patient by name..."
                                        className="w-full pl-10 pr-20 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <button
                                        type="submit"
                                        className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors"
                                    >
                                        Search
                                    </button>
                                </form>
                            </div>

                            {loading ? (
                                <div className="p-20 text-center text-gray-700">Loading patients...</div>
                            ) : pastRecords.length === 0 ? (
                                <div className="p-24 text-center flex flex-col items-center justify-center">
                                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <p className="text-gray-700 font-medium">No patients found</p>
                                    <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                                </div>
                            ) : (
                                <div>
                                    {/* Table Header - Hidden on mobile */}
                                    <div className="hidden md:grid grid-cols-[3rem_1.5fr_0.5fr_1fr_1fr_0.5fr_2rem] gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                                        <span>#</span>
                                        <span>Patient Name</span>
                                        <span>Age</span>
                                        <span>Phone</span>
                                        <span>MR #</span>
                                        <span>Visits</span>
                                        <span></span>
                                    </div>
                                    {/* Patient Rows */}
                                    <div className="divide-y divide-gray-100">
                                        {pastRecords.map((patient, index) => {
                                            // Smart initial: skip MR./MRS./MS./DR. prefix
                                            const nameForInitial = (patient.name || '').replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').trim();
                                            const initial = nameForInitial.charAt(0)?.toUpperCase() || '?';
                                            return (
                                                <div key={patient.id}>
                                                    <div
                                                        className={`flex flex-col md:grid md:grid-cols-[3rem_1.5fr_0.5fr_1fr_1fr_0.5fr_2rem] gap-2 md:gap-4 p-4 md:px-6 md:py-4 cursor-pointer transition-all duration-150 items-start md:items-center ${expandedPatientId === patient.id ? 'bg-blue-50/60 border-l-4 border-l-blue-400' : 'hover:bg-gray-50/80 border-l-4 border-l-transparent'}`}
                                                        onClick={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                                                    >
                                                        {/* Mobile: Top Row with # and Name */}
                                                        <div className="flex items-center justify-between w-full md:w-auto md:contents">
                                                            <span className="text-xs text-gray-400 font-medium hidden md:block">{index + 1}</span>

                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                                                                    {initial}
                                                                </div>
                                                                <div className="flex flex-col md:block min-w-0">
                                                                    <p className="font-semibold text-gray-900 text-sm truncate">{patient.name}</p>
                                                                    {/* Mobile-only sub-details */}
                                                                    <p className="text-xs text-gray-500 md:hidden">
                                                                        {patient.age} yrs • {patient.phone || 'No phone'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Mobile Chevron */}
                                                            <svg className={`w-5 h-5 text-gray-400 md:hidden transition-transform duration-200 ${expandedPatientId === patient.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                            </svg>
                                                        </div>

                                                        {/* Desktop Columns / Mobile Data Grid */}
                                                        <span className="text-sm text-gray-700 hidden md:block">{patient.age || '—'}</span>
                                                        <span className="text-sm text-gray-700 font-mono hidden md:block">{patient.phone || '—'}</span>

                                                        {/* Mobile: MR & Visits Row */}
                                                        <div className="flex items-center gap-4 w-full md:contents mt-2 md:mt-0 pl-[3.25rem] md:pl-0">
                                                            <div className="flex-1 md:hidden">
                                                                <p className="text-[10px] text-gray-400 uppercase font-bold">MR Number</p>
                                                                <p className="text-xs font-mono text-gray-700">{patient.mr_number || '—'}</p>
                                                            </div>
                                                            <span className="text-xs text-gray-700 font-medium truncate min-w-0 hidden md:block" title={patient.mr_number || ''}>{patient.mr_number || '—'}</span>

                                                            <div className="flex-1 md:flex-none">
                                                                <p className="text-[10px] text-gray-400 uppercase font-bold md:hidden">Visits</p>
                                                                <span className="text-sm font-semibold text-blue-600">{patient.prescriptions?.length || 0}</span>
                                                            </div>
                                                        </div>

                                                        {/* Desktop Chevron */}
                                                        <svg className={`w-4 h-4 text-gray-400 hidden md:block transition-transform duration-200 ${expandedPatientId === patient.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>

                                                    {/* Expanded: Prescription History */}
                                                    {expandedPatientId === patient.id && (
                                                        <div className="bg-gray-50 border-t border-gray-100">
                                                            {patient.prescriptions?.length > 0 ? (
                                                                <div className="px-6 py-4 space-y-2">
                                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Prescription History</p>
                                                                    {patient.prescriptions.map((rx: any) => (
                                                                        <div key={rx.id} className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                                                                            <div className="flex items-center justify-between gap-2">
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                                        <span className="text-xs font-semibold text-gray-800">
                                                                                            {new Date(rx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                            <span className="text-gray-400 font-normal ml-1">
                                                                                                {new Date(rx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                                            </span>
                                                                                        </span>
                                                                                        {rx.status === 'dispensed' && (
                                                                                            <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Dispensed</span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setRxViewPatient(patient);
                                                                                        setRxViewPrescription(rx);
                                                                                    }}
                                                                                    className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors"
                                                                                >
                                                                                    View Rx
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="px-5 py-4 text-center">
                                                                    <p className="text-xs text-gray-400">No prescriptions recorded</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {hasMorePastRecords && (
                                        <div className="p-4 text-center border-t border-gray-100">
                                            <button
                                                onClick={handleLoadMorePastRecords}
                                                disabled={isLoadingMorePast}
                                                className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 transition-colors border border-gray-200 disabled:opacity-50"
                                            >
                                                {isLoadingMorePast ? 'Loading...' : 'Load More Patients'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* View Rx Modal — Past Records */}
            {rxViewPrescription && rxViewPatient && (
                <PrescriptionModal
                    doctor={doctor}
                    patient={{
                        ...rxViewPatient,
                        token_number: rxViewPrescription.token_number || rxViewPatient.token_number,
                    }}
                    onClose={() => { setRxViewPrescription(null); setRxViewPatient(null); }}
                    readOnly={true}
                    forcePrint={true}
                    existingData={rxViewPrescription}
                    clinicLogo={doctor.avatar_url || undefined}
                />
            )}

            {/* Prescription Modal - Active */}
            {showRxModal && selectedPatient && (
                <PrescriptionModalSelector
                    doctor={currentDoctor}
                    patient={selectedPatient}
                    onClose={() => {
                        clearPreparingIndicator(selectedQueueId);
                        setShowRxModal(false);
                        setSelectedQueueId(null);
                        setSelectedPatient(null);
                        setAdmittedRefreshToken(t => t + 1);
                    }}
                    onSendToPharmacy={handleSendToPharmacy}
                    clinicLogo={hospitalLogo || undefined}
                    actorAttribution={{ actorType, actorDisplayName }}
                    onPrintOpen={() => {
                        logViewEvent('print.preview.open', {
                            eventCategory: 'print',
                            patientId: selectedPatient.id,
                            queueId: selectedQueueId || null,
                        });
                    }}
                />
            )}

            {/* History Modal - Read Only */}
            {selectedHistoryItem && (
                <PrescriptionModalSelector
                    doctor={currentDoctor}
                    patient={{
                        ...selectedHistoryItem.patient,
                        token_number: selectedHistoryItem.token_number || selectedHistoryItem.patient?.token_number
                    }}
                    onClose={() => setSelectedHistoryItem(null)}
                    readOnly={true}
                    forcePrint={true}
                    existingData={selectedHistoryItem}
                    clinicLogo={hospitalLogo || undefined}
                    onPrintOpen={() => {
                        logViewEvent('print.preview.open', {
                            eventCategory: 'print',
                            patientId: selectedHistoryItem.patient_id || null,
                            queueId: selectedHistoryItem.queue_id || null,
                            prescriptionId: selectedHistoryItem.id || null,
                        });
                    }}
                />
            )}

            {/* Prescription Picker Modal */}
            {prescriptionPickerItems.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPrescriptionPickerItems([])}>
                    <div
                        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Multiple Prescriptions Found</h3>
                                <p className="text-blue-100 text-sm">{prescriptionPickerItems.length} prescriptions — {prescriptionPickerMode === 'queue-prescribe' ? 'select one to load into new prescription' : prescriptionPickerMode === 'view' ? 'select one to view' : 'select one to edit & resend'}</p>
                            </div>
                        </div>

                        <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                            {prescriptionPickerItems.map((rx: any, idx: number) => {
                                const meds = Array.isArray(rx.medications) ? rx.medications : [];
                                const medSummary = meds.slice(0, 3).map((m: any) => m.name || '').filter(Boolean).join(', ');
                                const isResent = !rx.queue_id;
                                return (
                                    <div key={rx.id} className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                                        onClick={() => {
                                            if (prescriptionPickerMode === 'view') {
                                                setPrescriptionPickerItems([]);
                                                setSelectedHistoryItem(rx);
                                            } else if (prescriptionPickerMode === 'edit') {
                                                setPrescriptionPickerItems([]);
                                                setEditResendItem(rx);
                                            } else {
                                                // 'queue-prescribe' mode
                                                setPrescriptionPickerItems([]);
                                                setPastRxQueueItem(rx);
                                            }
                                        }}
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-gray-900">
                                                    {new Date(rx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {new Date(rx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                                {isResent && (
                                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Resent</span>
                                                )}
                                                {idx === 0 && (
                                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">Latest</span>
                                                )}
                                                {rx.status === 'dispensed' && (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Dispensed</span>
                                                )}
                                            </div>
                                            {medSummary && (
                                                <p className="text-xs text-gray-500 mt-1 truncate">
                                                    💊 {medSummary}{meds.length > 3 ? ` +${meds.length - 3} more` : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div className="shrink-0">
                                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${prescriptionPickerMode === 'view' ? 'bg-purple-50 text-purple-600' : prescriptionPickerMode === 'queue-prescribe' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                                                {prescriptionPickerMode === 'view' ? 'View' : prescriptionPickerMode === 'queue-prescribe' ? 'Load' : 'Edit'} →
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setPrescriptionPickerItems([])}
                                className="w-full px-4 py-2.5 bg-gray-200 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-300 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit & Resend Modal — Editable */}
            {editResendItem && (
                <PrescriptionModalSelector
                    doctor={currentDoctor}
                    patient={{
                        ...editResendItem.patient,
                        token_number: editResendItem.token_number || editResendItem.patient?.token_number
                    }}
                    onClose={() => setEditResendItem(null)}
                    readOnly={false}
                    existingData={editResendItem}
                    onSendToPharmacy={handleResendToPharmacy}
                    clinicLogo={hospitalLogo || undefined}
                    actorAttribution={{ actorType, actorDisplayName }}
                    onPrintOpen={() => {
                        logViewEvent('print.preview.open', {
                            eventCategory: 'print',
                            patientId: editResendItem.patient_id || null,
                            prescriptionId: editResendItem.id || null,
                        });
                    }}
                />
            )}

            {/* Past Rx Queue Modal — pre-filled from history, sends as new queue prescription */}
            {pastRxQueueItem && selectedPatient && (
                <PrescriptionModalSelector
                    doctor={currentDoctor}
                    patient={{
                        ...selectedPatient,
                        token_number: selectedPatient.token_number
                    }}
                    onClose={() => { clearPreparingIndicator(selectedQueueId); setPastRxQueueItem(null); }}
                    readOnly={false}
                    existingData={pastRxQueueItem}
                    onSendToPharmacy={handleSendToPharmacy}
                    clinicLogo={hospitalLogo || undefined}
                    actorAttribution={{ actorType, actorDisplayName }}
                    onPrintOpen={() => {
                        logViewEvent('print.preview.open', {
                            eventCategory: 'print',
                            patientId: selectedPatient?.id || null,
                            prescriptionId: pastRxQueueItem?.id || null,
                        });
                    }}
                />
            )}

            {/* Settings Modal - For Signature */}
            {showSettingsModal && (
                <DoctorSettingsModal
                    doctor={currentDoctor}
                    onClose={() => setShowSettingsModal(false)}
                    onUpdate={refreshDoctorProfile}
                />
            )}

            {/* Manage Drugs Modal */}
            {showManageDrugsModal && (
                <ManageDrugsModal
                    doctorId={currentDoctor.id}
                    hospitalId={currentDoctor.hospital_id}
                    onClose={() => setShowManageDrugsModal(false)}
                />
            )}

            {showManageDiagnosesModal && (
                <ManageDiagnosesModal
                    doctorId={currentDoctor.id}
                    hospitalId={currentDoctor.hospital_id}
                    onClose={() => setShowManageDiagnosesModal(false)}
                />
            )}

            {showTeamAuditModal && canManageTeamAudit && actorSession?.sessionToken && (
                <DoctorTeamAuditModal
                    isOpen={showTeamAuditModal}
                    onClose={() => setShowTeamAuditModal(false)}
                    hospitalId={currentDoctor.hospital_id}
                    chiefDoctorId={currentDoctor.id}
                    sessionToken={actorSession.sessionToken}
                />
            )}

            {prescribeCandidate && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Prescribe for Patient?</h3>
                        <p className="text-sm text-gray-600 mb-6">
                            Do you want to prescribe for{' '}
                            <span className="font-bold text-gray-900">{prescribeCandidate.queueItem.patient.name}</span>
                            {' '}with MR{' '}
                            <span className="font-mono font-bold text-gray-900">
                                {prescribeCandidate.queueItem.patient.mr_number || 'N/A'}
                            </span>?
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setPrescribeCandidate(null)}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                            >
                                No, Cancel
                            </button>
                            <button
                                onClick={handleConfirmPrescribe}
                                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                            >
                                Yes, Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TwoStepConfirmModal
                isOpen={Boolean(markDoneCandidate)}
                title="Mark Patient As Done?"
                description={markDoneCandidate ? `${markDoneCandidate.patientName} will be moved to completed history.` : ''}
                continueLabel="Continue"
                confirmLabel="Yes, Mark Done"
                onCancel={() => setMarkDoneCandidate(null)}
                onConfirm={() => {
                    if (!markDoneCandidate) return;
                    handleUpdateStatus(markDoneCandidate.queueId, 'completed');
                    setMarkDoneCandidate(null);
                }}
            />

            {/* Admit Patient confirmation — admits without prescription */}
            {admitCandidate && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                                <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900">Admit this patient?</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Do you want to admit{' '}
                            <span className="font-bold text-gray-900">{admitCandidate.patientName}</span>
                            {admitCandidate.mrNumber ? (
                                <>
                                    {' '}(MR <span className="font-mono font-bold text-gray-900">{admitCandidate.mrNumber}</span>)
                                </>
                            ) : null}
                            ? No prescription will be issued. The patient will move to the
                            {' '}<span className="font-semibold text-rose-700">Admitted Patients</span> list until discharged.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setAdmitCandidate(null)}
                                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    const c = admitCandidate;
                                    setAdmitCandidate(null);
                                    if (c) handleAdmitPatient(c.queueId);
                                }}
                                className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-sm"
                            >
                                Confirm Admit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseDoctorDashboard;

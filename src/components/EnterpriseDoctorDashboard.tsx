import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModal from './modals/PrescriptionModal';
import ManageDrugsModal from './modals/ManageDrugsModal';
import ManageDiagnosesModal from './modals/ManageDiagnosesModal';
import DoctorTeamAuditModal from './modals/DoctorTeamAuditModal';
import TwoStepConfirmModal from './common/TwoStepConfirmModal';
import EnterpriseCKDSnapshotView from './EnterpriseCKDSnapshotView';
import { LogoIcon } from './icons/LogoIcon';
import DoctorSettingsModal from './modals/DoctorSettingsModal';
import { type DoctorActorSession } from '../utils/doctorActorSession';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
    signature_url?: string;
}

interface Patient {
    id: string;
    name: string;
    age: number;
    token_number: string;
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
    const [loading, setLoading] = useState(true);
    const [showRxModal, setShowRxModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [selectedQueueId, setSelectedQueueId] = useState<string | null>(null);
    const [medications, setMedications] = useState<Medication[]>([
        { name: '', dosage: '', frequency: '', duration: '', instruction: '' }
    ]);
    const [notes, setNotes] = useState('');
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'queue' | 'history' | 'ckd_snapshot' | 'past_records'>('queue');
    const [historyList, setHistoryList] = useState<any[]>([]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
    const [showManageDiagnosesModal, setShowManageDiagnosesModal] = useState(false);
    const [showTeamAuditModal, setShowTeamAuditModal] = useState(false);
    // Local doctor state to handle updates (e.g. after signature upload)
    const [currentDoctor, setCurrentDoctor] = useState<DoctorProfile>(doctor);
    const isSendingToPharmacyRef = useRef(false);

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
                        created_at
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
    const [pastRecords, setPastRecords] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [pastRecordsPage, setPastRecordsPage] = useState(0);
    const [hasMorePastRecords, setHasMorePastRecords] = useState(true);
    const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
    const [pastRecordsTotal, setPastRecordsTotal] = useState(0);
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
    const PAST_RECORDS_PER_PAGE = 50;

    // Helper: deduplicate prescriptions by patient
    const groupPrescriptionsByPatient = (prescriptions: any[]) => {
        const patientMap = new Map<string, any>();
        for (const rx of prescriptions) {
            const pid = rx.patient_id;
            if (!patientMap.has(pid)) {
                patientMap.set(pid, {
                    ...rx.patient,
                    prescriptions: []
                });
            }
            patientMap.get(pid)!.prescriptions.push(rx);
        }
        // Sort prescriptions within each patient by date desc
        for (const patient of patientMap.values()) {
            patient.prescriptions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        return Array.from(patientMap.values());
    };

    const fetchPastRecords = useCallback(async (isBackground = false, page = 0, append = false) => {
        if (!isBackground && !append) setLoading(true);
        if (append) setIsLoadingMorePast(true);
        try {
            // Get unique patient count for this doctor
            if (!append) {
                const { data: countData } = await supabase
                    .from('hospital_prescriptions' as any)
                    .select('patient_id')
                    .eq('doctor_id', doctor.id);
                const uniquePatients = new Set((countData || []).map((r: any) => r.patient_id));
                setPastRecordsTotal(uniquePatients.size);
            }

            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    id, medications, notes, status, token_number, created_at, patient_id,
                    patient:hospital_patients!hospital_prescriptions_patient_id_fkey(*)
                `)
                .eq('doctor_id', doctor.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const grouped = groupPrescriptionsByPatient(data || []);
            const paged = append
                ? grouped.slice(0, (page + 1) * PAST_RECORDS_PER_PAGE)
                : grouped.slice(0, PAST_RECORDS_PER_PAGE);
            setHasMorePastRecords(paged.length < grouped.length);
            setPastRecords(paged);
            setPastRecordsPage(page);
        } catch (error) {
            console.error('Error fetching patients:', error);
            if (!isBackground) toast.error('Failed to load patients');
        } finally {
            if (!isBackground && !append) setLoading(false);
            if (append) setIsLoadingMorePast(false);
        }
    }, [doctor.id]);

    const handleLoadMorePastRecords = () => {
        fetchPastRecords(true, pastRecordsPage + 1, true);
    };

    const handleSearchPastRecords = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (!searchQuery.trim()) {
                await fetchPastRecords();
                return;
            }

            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    id, medications, notes, status, token_number, created_at, patient_id,
                    patient:hospital_patients!hospital_prescriptions_patient_id_fkey!inner(*)
                `)
                .eq('doctor_id', doctor.id)
                .ilike('patient.name', `%${searchQuery}%`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const grouped = groupPrescriptionsByPatient(data || []);
            setPastRecords(grouped);
            setHasMorePastRecords(false);
        } catch (err) {
            console.error(err);
            toast.error('Search failed');
        } finally {
            setLoading(false);
        }
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
                    // Refetch in background based on viewMode
                    if (viewMode === 'queue') {
                        fetchQueue(true);
                    } else if (viewMode === 'history') {
                        fetchHistory(true);
                    } else if (viewMode === 'past_records') {
                        // Past records usually don't change by self-updates unless we modify them, strict reload might not be needed but safe
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
            if (document.visibilityState === 'visible') {
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
            if (document.visibilityState === 'visible') {
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

    const handleViewPrescription = async (historyItem: any) => {
        const toastId = toast.loading('Opening prescription...');
        try {
            // Primary path: resolve by queue_id (same visit). Fallback keeps legacy DBs working.
            const byQueue = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    patient:hospital_patients(*)
                `)
                .eq('doctor_id', doctor.id)
                .eq('queue_id', historyItem.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            let data = byQueue.data;
            let error = byQueue.error;

            if (!data) {
                const fallback = await supabase
                    .from('hospital_prescriptions' as any)
                    .select(`
                        *,
                        patient:hospital_patients(*)
                    `)
                    .eq('doctor_id', doctor.id)
                    .eq('patient_id', historyItem.patient_id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                data = fallback.data;
                error = fallback.error;
            }

            if (error || !data) {
                toast.dismiss(toastId);
                toast.error('No prescription found for this visit');
                return;
            }

            toast.dismiss(toastId);
            setSelectedHistoryItem(data);
            logViewEvent('view.prescription.open', {
                patientId: data.patient_id || historyItem.patient_id || null,
                queueId: historyItem.id || null,
                prescriptionId: data.id || null,
            });
        } catch (err) {
            console.error(err);
            toast.dismiss(toastId);
            toast.error('Could not load prescription');
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

    const handleSendToPharmacy = async (
        prescriptionMeds: any[],
        prescriptionNotes: string,
        reviewContext?: { nextReviewDate: string | null; testsToReview: string; specialistsToReview: string }
    ) => {
        if (!selectedPatient || !selectedQueueId) return;
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

                toast.success('Prescription sent to Pharmacy!', { id: toastId });
                setShowRxModal(false);
                setSelectedQueueId(null);
                setSelectedPatient(null);
                fetchQueue(true);
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

            toast.success('Prescription sent to Pharmacy!', { id: toastId });
            setShowRxModal(false);
            setSelectedQueueId(null);
            setSelectedPatient(null);
            await handleUpdateStatus(selectedQueueId, 'completed');
        } catch (error: any) {
            console.error('Full Error Object:', error);
            toast.error(`Failed to send: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            isSendingToPharmacyRef.current = false;
        }
    };

    // View Item for History
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);
    const [markDoneCandidate, setMarkDoneCandidate] = useState<{ queueId: string; patientName: string } | null>(null);

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
                                            <span>{actorType === 'chief' ? 'Chief' : `PA: ${actorDisplayName}`}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Title & Controls Section */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 md:mb-10">
                    <div>
                        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                            {formatDoctorName(currentDoctor.name)}
                        </h2>
                        <p className="text-base md:text-lg text-gray-700 mt-2">Manage your patient queue and consultations</p>
                        {paActorAuthEnabled && (
                            <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold">
                                {actorType === 'chief' ? 'Logged in as Chief' : `Logged in as PA: ${actorDisplayName}`}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full lg:w-auto">
                        {/* Action Group 1: CKD Snapshot (Prominent) */}
                        <button
                            onClick={() => setViewMode('ckd_snapshot')}
                            className="relative group overflow-hidden rounded-xl w-full sm:w-auto"
                            style={{
                                background: 'linear-gradient(135deg, #9333ea, #ec4899)',
                                padding: '2px'
                            }}
                        >
                            {/* Animated rainbow border */}
                            <div
                                className="absolute inset-[-2px] rounded-xl opacity-75 group-hover:opacity-100 transition-opacity"
                                style={{
                                    background: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff, #ff0000)',
                                    backgroundSize: '400% 400%',
                                    animation: 'rainbow-slide 3s linear infinite',
                                    zIndex: 0
                                }}
                            />
                            <div className="relative flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 rounded-[10px] text-white font-bold text-sm z-10 whitespace-nowrap">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span className="uppercase tracking-wide">View CKD Snapshot</span>
                            </div>
                        </button>

                        {/* Action Group 2: Tabs + Settings + Refresh */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full lg:w-auto">
                            {/* Tabs Switcher - Force Horizontal Grid */}
                            <div className="bg-white p-1 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-3 gap-1 flex-1 md:flex-none min-w-[320px]">
                                <button
                                    onClick={() => setViewMode('queue')}
                                    className={`px-2 sm:px-6 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold transition-all duration-200 truncate ${viewMode === 'queue' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    Active Queue
                                </button>
                                <button
                                    onClick={() => setViewMode('history')}
                                    className={`px-2 sm:px-6 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold transition-all duration-200 truncate ${viewMode === 'history' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    History Log
                                </button>
                                <button
                                    onClick={() => setViewMode('past_records')}
                                    className={`px-2 sm:px-6 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold transition-all duration-200 truncate ${viewMode === 'past_records' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    Past Records
                                </button>
                            </div>

                            {/* Settings & Reload Buttons */}
                            <div className="flex items-center gap-2 justify-end md:justify-start">
                                {canManageTeamAudit && (
                                    <button
                                        onClick={() => setShowTeamAuditModal(true)}
                                        className="px-3 sm:px-4 py-2.5 sm:py-3 bg-white text-gray-700 hover:text-blue-700 rounded-2xl border border-gray-200 hover:border-blue-200 transition-all shadow-sm shrink-0 text-xs sm:text-sm font-bold"
                                        title="Team & Audit"
                                    >
                                        Team & Audit
                                    </button>
                                )}
                                <button
                                    onClick={() => setShowSettingsModal(true)}
                                    className={`p-2.5 sm:p-3 bg-white text-gray-500 hover:text-blue-600 rounded-2xl border border-gray-200 hover:border-blue-200 transition-all shadow-sm shrink-0 ${currentDoctor.signature_url ? '' : 'animate-pulse ring-2 ring-blue-500/20'}`}
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
                                    className="p-2.5 sm:p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm shrink-0"
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
            ) : (
                <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
                    {viewMode === 'queue' ? (
                        <>
                            <div className="px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-gray-900 text-lg">Current Queue</h3>
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
                                <div className="divide-y divide-gray-50">
                                    {queue.map((item) => (
                                        <div key={item.id} className="p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors group gap-4">
                                            <div className="flex items-center gap-4 sm:gap-6">
                                                <div className={`w-14 h-12 sm:w-16 sm:h-12 rounded-xl flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0 px-2
                                                    ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                        item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {item.patient.token_number}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-gray-900">{item.patient.name}</h4>
                                                    <div className="flex items-center gap-2 text-sm text-gray-700 font-medium whitespace-nowrap">
                                                        <span>{item.patient.age} yrs</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                                {item.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                        className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
                                                    >
                                                        Call In
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => {
                                                        // Ensure token_number is included from queue record
                                                        setSelectedPatient({
                                                            ...item.patient,
                                                            token_number: item.patient.token_number || item.token_number
                                                        });
                                                        setSelectedQueueId(item.id);
                                                        setShowRxModal(true);
                                                        logViewEvent('view.patient.open', {
                                                            patientId: item.patient_id,
                                                            queueId: item.id,
                                                        });
                                                    }}
                                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <span className="hidden xs:inline">Prescribe</span>
                                                    <span className="xs:hidden">Prescribe</span>
                                                </button>

                                                <button
                                                    onClick={() => setMarkDoneCandidate({ queueId: item.id, patientName: item.patient.name })}
                                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors whitespace-nowrap"
                                                >
                                                    Mark Done
                                                </button>
                                            </div>
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
                                                    <div className="font-bold text-base sm:text-lg text-gray-900">{item.patient?.name}</div>
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

                                                <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">
                                                        Completed
                                                    </span>
                                                    <button
                                                        onClick={() => handleViewPrescription(item)}
                                                        className="px-4 py-2 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center gap-1 transition-colors whitespace-nowrap"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                        View PDF
                                                    </button>
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
                                                                    {patient.prescriptions.map((rx: any) => {
                                                                        const meds = Array.isArray(rx.medications) ? rx.medications : [];
                                                                        const medSummary = meds.slice(0, 3).map((m: any) => m.name || m.drug_name || '').filter(Boolean).join(', ');
                                                                        return (
                                                                            <div key={rx.id} className="bg-white rounded-lg p-3 border border-gray-100 hover:border-gray-200 transition-colors">
                                                                                <div className="flex items-start justify-between gap-2">
                                                                                    <div className="min-w-0">
                                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                                            <span className="text-xs font-semibold text-gray-800">
                                                                                                {new Date(rx.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                                            </span>
                                                                                            {rx.status === 'dispensed' && (
                                                                                                <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Dispensed</span>
                                                                                            )}
                                                                                        </div>
                                                                                        {medSummary && (
                                                                                            <p className="text-xs text-gray-500 mt-1 truncate">
                                                                                                💊 {medSummary}{meds.length > 3 ? ` +${meds.length - 3} more` : ''}
                                                                                            </p>
                                                                                        )}
                                                                                        {rx.notes && <p className="text-[11px] text-gray-400 mt-0.5 truncate italic">"{rx.notes}"</p>}
                                                                                    </div>
                                                                                    <span className="text-[10px] text-gray-400 font-medium shrink-0">
                                                                                        {new Date(rx.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
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

            {/* Prescription Modal - Active */}
            {showRxModal && selectedPatient && (
                <PrescriptionModal
                    doctor={currentDoctor}
                    patient={selectedPatient}
                    onClose={() => {
                        setShowRxModal(false);
                        setSelectedQueueId(null);
                        setSelectedPatient(null);
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
                <PrescriptionModal
                    doctor={currentDoctor}
                    patient={{
                        ...selectedHistoryItem.patient,
                        token_number: selectedHistoryItem.token_number || selectedHistoryItem.patient?.token_number
                    }}
                    onClose={() => setSelectedHistoryItem(null)}
                    readOnly={true}
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
        </div>
    );
};

export default EnterpriseDoctorDashboard;

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModal from './modals/PrescriptionModal';
import ManageDrugsModal from './modals/ManageDrugsModal';
import ManageDiagnosesModal from './modals/ManageDiagnosesModal';
import EnterpriseCKDSnapshotView from './EnterpriseCKDSnapshotView';
import { LogoIcon } from './icons/LogoIcon';
import DoctorSettingsModal from './modals/DoctorSettingsModal';

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

const EnterpriseDoctorDashboard: React.FC<{ doctor: DoctorProfile; onBack: () => void }> = ({ doctor, onBack }) => {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRxModal, setShowRxModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [medications, setMedications] = useState<Medication[]>([
        { name: '', dosage: '', frequency: '', duration: '', instruction: '' }
    ]);
    const [notes, setNotes] = useState('');
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);

    const [viewMode, setViewMode] = useState<'queue' | 'history' | 'ckd_snapshot'>('queue');
    const [historyList, setHistoryList] = useState<any[]>([]);

    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [showManageDrugsModal, setShowManageDrugsModal] = useState(false);
    const [showManageDiagnosesModal, setShowManageDiagnosesModal] = useState(false);
    // Local doctor state to handle updates (e.g. after signature upload)
    const [currentDoctor, setCurrentDoctor] = useState<DoctorProfile>(doctor);

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
                .order('queue_number', { ascending: true });

            if (error) throw error;
            setQueue(data || []);
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
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*)
                `)
                .eq('doctor_id', doctor.id)
                .eq('status', 'completed')
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
        }
    }, [doctor.id, viewMode, fetchQueue, fetchHistory]);

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
                        toast.success('New patient added to queue!', { duration: 3000 });
                    }
                    // Refetch in background
                    if (viewMode === 'queue') {
                        fetchQueue(true);
                    } else if (viewMode === 'history') {
                        fetchHistory(true);
                    }
                }
            )
            .subscribe((status, err) => {
                console.log('Doctor queue realtime status:', status);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Doctor realtime error:', err);
                    // Attempt to refetch data after connection error
                    setTimeout(() => {
                        if (viewMode === 'queue') {
                            fetchQueue(true);
                        } else if (viewMode === 'history') {
                            fetchHistory(true);
                        }
                    }, 3000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [doctor.id, viewMode, fetchQueue, fetchHistory]);

    // Periodic health check - refresh data every 60 seconds when tab is visible
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('Periodic health check - refreshing doctor data...');
                if (viewMode === 'queue') {
                    fetchQueue(true);
                } else if (viewMode === 'history') {
                    fetchHistory(true);
                }
            }
        }, 60000); // Every 60 seconds
        return () => clearInterval(interval);
    }, [viewMode, fetchQueue, fetchHistory]);

    // Refetch when tab becomes visible (handles browser tab switching)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('Tab became visible, refreshing data...');
                if (viewMode === 'queue') {
                    fetchQueue(true);
                } else if (viewMode === 'history') {
                    fetchHistory(true);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [viewMode, fetchQueue, fetchHistory]);

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
            // Fetch the latest prescription for this patient and doctor
            // ideally we would link queue_id to prescription_id, but for now we find the closest match
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    patient:hospital_patients(*)
                `)
                .eq('doctor_id', doctor.id)
                .eq('patient_id', historyItem.patient_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !data) {
                toast.dismiss(toastId);
                toast.error('No prescription found for this visit');
                return;
            }

            toast.dismiss(toastId);
            setSelectedHistoryItem(data);
        } catch (err) {
            console.error(err);
            toast.dismiss(toastId);
            toast.error('Could not load prescription');
        }
    };

    const handleUpdateStatus = async (queueId: string, status: string) => {
        try {
            const { error } = await (supabase
                .from('hospital_queues') as any)
                .update({ status } as any)
                .eq('id', queueId);

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

    const handleSendToPharmacy = async (prescriptionMeds: any[], prescriptionNotes: string) => {
        if (!selectedPatient) return;
        const toastId = toast.loading('Sending to pharmacy...');

        try {
            const { data, error } = await supabase
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
                .select()
                .single();

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error;
            }

            // Sync with Pharmacy Queue Display (Bridge logic)
            console.log('Syncing with pharmacy queue for token:', selectedPatient.token_number);
            const { error: queueError } = await (supabase as any)
                .from('hospital_pharmacy_queue')
                .insert({
                    hospital_id: currentDoctor.hospital_id,
                    prescription_id: (data as any)?.id || '',
                    patient_name: selectedPatient.name,
                    token_number: selectedPatient.token_number,
                    status: 'waiting'
                });

            if (queueError) {
                console.error('Pharmacy Queue sync failed:', queueError);
            }

            console.log('Prescription sent successfully:', { prescriptionMeds, prescriptionNotes });
            toast.success('Prescription sent to Pharmacy!', { id: toastId });
            setShowRxModal(false);
            // Update queue status
            handleUpdateStatus(queue.find(q => q.patient.id === selectedPatient.id)?.id || '', 'completed');
        } catch (error: any) {
            console.error('Full Error Object:', error);
            toast.error(`Failed to send: ${error.message || 'Unknown error'}`, { id: toastId });
        }
    };

    // View Item for History
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<any>(null);

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-black font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Floating Glassmorphism Header */}
            <div className="sticky top-0 z-50 flex justify-center pointer-events-none px-4 sm:px-6">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-gray-100 via-gray-100/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent" />

                <header className="pointer-events-auto relative mt-2 sm:mt-4 w-full max-w-7xl h-16 sm:h-20 bg-white/80 dark:bg-[#8AC43C]/[0.08] backdrop-blur-xl saturate-150 rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-[#8AC43C]/15 flex items-center transition-all duration-300 shadow-sm md:shadow-2xl dark:shadow-[0_0_20px_rgba(138,196,60,0.1)]">
                    <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">
                            <button
                                onClick={onBack}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
                                title="Back to Doctors List"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

                            <div className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform">
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
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                            <div className="bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm flex flex-1 sm:flex-none">
                                <button
                                    onClick={() => setViewMode('queue')}
                                    className={`flex-1 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'queue' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    Active Queue
                                </button>
                                <button
                                    onClick={() => setViewMode('history')}
                                    className={`flex-1 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 whitespace-nowrap ${viewMode === 'history' ? 'bg-black text-white shadow-md' : 'text-gray-700 hover:text-black hover:bg-gray-50'}`}
                                >
                                    History Log
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
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
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <button
                                        onClick={() => setShowManageDrugsModal(true)}
                                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/25 transition-all hover:-translate-y-0.5 flex items-center gap-1.5 sm:gap-2 shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="hidden xs:inline">Manage</span> <span className="hidden sm:inline">Saved</span> Drugs
                                    </button>
                                    <button
                                        onClick={() => setShowManageDiagnosesModal(true)}
                                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all hover:-translate-y-0.5 flex items-center gap-1.5 sm:gap-2 shrink-0"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span className="hidden xs:inline">Manage</span> <span className="hidden sm:inline">Saved</span> Diag
                                    </button>
                                    <span className="hidden sm:inline text-sm font-medium text-gray-700">{queue.length} Patients Waiting</span>
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
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm flex-shrink-0
                                                    ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                        item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {item.queue_number}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-gray-900">{item.patient.name}</h4>
                                                    <div className="flex items-center gap-2 text-sm text-gray-700 font-medium whitespace-nowrap">
                                                        <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">Token: {item.patient.token_number}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
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
                                                        setSelectedPatient(item.patient);
                                                        setShowRxModal(true);
                                                    }}
                                                    className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 sm:py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                    <span className="hidden xs:inline">Prescribe</span>
                                                    <span className="xs:hidden">Prescribe</span>
                                                </button>

                                                <button
                                                    onClick={() => handleUpdateStatus(item.id, 'completed')}
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
                    ) : (
                        <>
                            <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <h3 className="font-bold text-gray-900">Consultation History</h3>
                                <span className="text-sm font-medium text-gray-700">Past Records</span>
                            </div>

                            {loading ? (
                                <div className="p-20 text-center text-gray-700">Loading history...</div>
                            ) : historyList.length === 0 ? (
                                <div className="p-24 text-center flex flex-col items-center justify-center">
                                    <p className="text-gray-700 font-medium">No prior consultations found</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {historyList.map((item) => (
                                        <div key={item.id} className="p-5 sm:p-6 md:p-8 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                            {/* Stacked Layout on Mobile, Grid on Tablet+ */}
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="font-bold text-base sm:text-lg text-gray-900">{item.patient?.name}</div>
                                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                                        <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 text-xs">#{item.patient?.token_number}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                        <span>{new Date(item.updated_at || item.created_at).toLocaleDateString()}</span>
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
                    )}
                </div>
            )}

            {/* Prescription Modal - Active */}
            {showRxModal && selectedPatient && (
                <PrescriptionModal
                    doctor={currentDoctor}
                    patient={selectedPatient}
                    onClose={() => setShowRxModal(false)}
                    onSendToPharmacy={handleSendToPharmacy}
                    clinicLogo={hospitalLogo || undefined}
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
        </div>
    );
};

export default EnterpriseDoctorDashboard;

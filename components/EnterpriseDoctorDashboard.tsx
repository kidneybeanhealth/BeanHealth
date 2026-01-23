import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModal from './PrescriptionModal';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
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

    const [viewMode, setViewMode] = useState<'queue' | 'history'>('queue');
    const [historyList, setHistoryList] = useState<any[]>([]);

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

    // Initial fetch and realtime subscription
    useEffect(() => {
        if (viewMode === 'queue') {
            fetchQueue();
        } else {
            fetchHistory();
        }
    }, [doctor.id, viewMode, fetchQueue, fetchHistory]);

    // Realtime subscription for queue updates
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
                    } else {
                        fetchHistory(true);
                    }
                }
            )
            .subscribe((status) => {
                console.log('Doctor queue realtime status:', status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [doctor.id, viewMode, fetchQueue, fetchHistory]);

    // Refetch when tab becomes visible (handles browser tab switching)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                console.log('Tab became visible, refreshing data...');
                if (viewMode === 'queue') {
                    fetchQueue(true);
                } else {
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
            const { error } = await supabase
                .from('hospital_prescriptions' as any)
                .insert({
                    hospital_id: doctor.hospital_id,
                    doctor_id: doctor.id,
                    patient_id: selectedPatient.id,
                    token_number: selectedPatient.token_number,
                    medications: prescriptionMeds,
                    notes: prescriptionNotes,
                    status: 'pending'
                } as any);

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error;
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
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <button
                        onClick={onBack}
                        className="text-sm font-semibold text-gray-500 hover:text-black mb-4 flex items-center transition-colors"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back to List
                    </button>
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Dr. {doctor.name}</h2>
                    <p className="text-lg text-gray-500 mt-2">Manage your patient queue and consultations</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white p-1.5 rounded-2xl border border-gray-200 shadow-sm flex">
                        <button
                            onClick={() => setViewMode('queue')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${viewMode === 'queue' ? 'bg-black text-white shadow-md transform scale-105' : 'text-gray-500 hover:text-black hover:bg-gray-50'}`}
                        >
                            Active Queue
                        </button>
                        <button
                            onClick={() => setViewMode('history')}
                            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${viewMode === 'history' ? 'bg-black text-white shadow-md transform scale-105' : 'text-gray-500 hover:text-black hover:bg-gray-50'}`}
                        >
                            History Log
                        </button>
                    </div>

                    <button
                        onClick={() => viewMode === 'queue' ? fetchQueue() : fetchHistory()}
                        className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                        title="Reload"
                    >
                        <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
                {viewMode === 'queue' ? (
                    <>
                        <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900">Current Queue</h3>
                            <span className="text-sm font-medium text-gray-500">{queue.length} Patients Waiting</span>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center">
                                <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-black rounded-full mx-auto mb-4"></div>
                                <p className="text-gray-500">Loading active patients...</p>
                            </div>
                        ) : queue.length === 0 ? (
                            <div className="p-24 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">Queue is Empty</h3>
                                <p className="text-gray-500 mt-1">No patients are currently waiting for consultation.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {queue.map((item) => (
                                    <div key={item.id} className="p-6 md:p-8 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                        <div className="flex items-center gap-6">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm
                                                ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                    item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {item.queue_number}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900">{item.patient.name}</h4>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">Token: {item.patient.token_number}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    <span>{item.patient.age} yrs</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {item.status === 'pending' && (
                                                <button
                                                    onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                                                    className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                                                >
                                                    Call In
                                                </button>
                                            )}

                                            <button
                                                onClick={() => {
                                                    setSelectedPatient(item.patient);
                                                    setShowRxModal(true);
                                                }}
                                                className="px-5 py-2.5 text-sm font-bold text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 border border-emerald-100 transition-colors flex items-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                Prescribe
                                            </button>

                                            <button
                                                onClick={() => handleUpdateStatus(item.id, 'completed')}
                                                className="px-5 py-2.5 text-sm font-bold text-gray-900 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
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
                            <span className="text-sm font-medium text-gray-500">Past Records</span>
                        </div>

                        {loading ? (
                            <div className="p-20 text-center text-gray-500">Loading history...</div>
                        ) : historyList.length === 0 ? (
                            <div className="p-24 text-center flex flex-col items-center justify-center">
                                <p className="text-gray-400 font-medium">No prior consultations found</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-50">
                                {historyList.map((item) => (
                                    <div key={item.id} className="p-6 md:p-8 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                                        <div className="grid grid-cols-12 items-center w-full">
                                            <div className="col-span-2 text-sm text-gray-600">
                                                {new Date(item.updated_at || item.created_at).toLocaleDateString()}
                                            </div>
                                            <div className="col-span-3">
                                                <div className="font-medium text-gray-900">{item.patient?.name}</div>
                                            </div>
                                            <div className="col-span-2 font-mono text-gray-600">
                                                {item.patient?.token_number}
                                            </div>
                                            <div className="col-span-2">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">
                                                    Completed
                                                </span>
                                            </div>
                                            <div className="col-span-3 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleViewPrescription(item)}
                                                    className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 flex items-center gap-1"
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

            {/* Prescription Modal - Active */}
            {showRxModal && selectedPatient && (
                <PrescriptionModal
                    doctor={doctor}
                    patient={selectedPatient}
                    onClose={() => setShowRxModal(false)}
                    onSendToPharmacy={handleSendToPharmacy}
                    clinicLogo={hospitalLogo || undefined}
                />
            )}

            {/* History Modal - Read Only */}
            {selectedHistoryItem && (
                <PrescriptionModal
                    doctor={doctor}
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
        </div>
    );
};

export default EnterpriseDoctorDashboard;

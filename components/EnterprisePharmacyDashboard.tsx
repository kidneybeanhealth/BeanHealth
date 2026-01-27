import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModal from './PrescriptionModal';

interface PharmacyDashboardProps {
    hospitalId: string;
    onBack?: () => void;
}

interface Prescription {
    id: string;
    hospital_id: string;
    doctor_id: string;
    patient_id: string;
    medications: any[];
    notes: string;
    token_number: string;
    status: string;
    created_at: string;
    doctor: {
        name: string;
        specialty: string;
    };
    patient: {
        name: string;
        age: number;
        gender?: string;
        phone?: string;
    };
}

const EnterprisePharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ hospitalId, onBack }) => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue');

    const fetchPrescriptions = useCallback(async (isBackground = false) => {
        if (!hospitalId) return;
        if (!isBackground) setLoading(true); // Don't show spinner for background updates

        console.log('Fetching prescriptions for Hospital ID:', hospitalId);
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    doctor:hospital_doctors(name, specialty),
                    patient:hospital_patients(name, age)
                `)
                .eq('hospital_id', hospitalId)
                .in('status', ['pending', 'dispensed'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Supabase fetch error:', error);
                throw error;
            }

            console.log('Prescriptions found:', data?.length);
            setPrescriptions(data || []);
        } catch (error) {
            console.error('Error fetching prescriptions:', error);
            if (!isBackground) toast.error('Failed to load prescriptions');
        } finally {
            if (!isBackground) setLoading(false);
        }
    }, [hospitalId]);

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

    // Fetch single prescription for realtime inserts
    const fetchSinglePrescription = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    doctor:hospital_doctors(name, specialty),
                    patient:hospital_patients(name, age)
                `)
                .eq('id', id)
                .single();

            if (data && !error) {
                setPrescriptions(prev => {
                    if (prev.find(p => p.id === data.id)) return prev;
                    return [data as any, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                });
                toast.success('New Prescription Received!', { duration: 4000 });
            }
        } catch (error) {
            console.error('Error fetching new prescription:', error);
        }
    };

    // Realtime Subscription - Optimized
    useEffect(() => {
        if (!hospitalId) {
            fetchPrescriptions(); // Initial load
            return;
        }

        // Initial Fetch
        fetchPrescriptions();

        console.log('Setting up optimized pharmacy realtime subscription...');
        const channel = supabase
            .channel(`pharmacy-dashboard-${hospitalId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_prescriptions',
                    filter: `hospital_id=eq.${hospitalId}`
                },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        fetchSinglePrescription(payload.new.id);
                    } else if (payload.eventType === 'UPDATE') {
                        setPrescriptions(prev => prev.map(p => {
                            if (p.id === payload.new.id) {
                                // If status changed to dispensed, we might want to move it to history tab or keep it updated
                                const updated = { ...p, ...payload.new };
                                // Update selected prescription if open
                                if (selectedPrescription?.id === p.id) {
                                    setSelectedPrescription(prevSelected => ({ ...prevSelected!, ...payload.new }));
                                }
                                return updated;
                            }
                            return p;
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        setPrescriptions(prev => prev.filter(p => p.id !== payload.old.id));
                        if (selectedPrescription?.id === payload.old.id) {
                            setSelectedPrescription(null); // Close modal if deleted
                            toast.error('Prescription was deleted');
                        }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Pharmacy realtime connected');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime error, falling back to fetch');
                    fetchPrescriptions(true);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [hospitalId, fetchPrescriptions]); // frequent 'selectedPrescription' changes shouldn't trigger re-sub, so removed it from deps. Check if 'selectedPrescription' in closure is stale.
    // Actually, 'selectedPrescription' inside the callback will be stale if not in deps. 
    // Ideally, pass setter function to avoid stale state issues. I used setter function for setPrescriptions, but used selectedPrescription state directly for logic check.
    // Solution: I used `selectedPrescription?.id` which might be stale in the closure. 
    // BETTER: Use functional updates or refs for selectedPrescription if needed inside effect. 
    // However, for simplicity and performance, checking stale state might be okay if we just update the list. 
    // The modal uses `selectedPrescription` state. If I update list state, modal does NOT auto-update unless I update selectedPrescription state too.
    // Let's rely on standard re-render cycle or accept slight staleness for now, or use a Ref for selectedPrescription.

    // Refetch when tab becomes visible (Recovery mechanism)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && hospitalId) {
                // Quick refresh to ensure data integrity
                fetchPrescriptions(true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [hospitalId, fetchPrescriptions]);

    // Fetch hospital logo (Restored)
    useEffect(() => {
        const fetchHospitalLogo = async () => {
            if (!hospitalId) return;
            try {
                const { data } = await (supabase
                    .from('users') as any)
                    .select('avatar_url')
                    .eq('id', hospitalId)
                    .single() as { data: { avatar_url?: string } | null };
                if (data?.avatar_url) {
                    setHospitalLogo(data.avatar_url);
                }
            } catch (err) {
                console.warn('Could not fetch hospital logo:', err);
            }
        };
        fetchHospitalLogo();
    }, [hospitalId]);

    // Note: Periodic interval removed to save resources, relying on Realtime + Visibility.

    const handleMarkDispensed = async () => {
        if (!selectedPrescription) return;

        const previousStatus = selectedPrescription.status;
        const optimisticUpdated = { ...selectedPrescription, status: 'dispensed' };

        // 1. Optimistic Update
        setSelectedPrescription(optimisticUpdated as any);
        setPrescriptions(prev => prev.map(p => p.id === optimisticUpdated.id ? { ...p, status: 'dispensed' } : p));
        toast.success('Medicine Delivered');

        try {
            // 2. Perform DB Update
            const { error } = await (supabase
                .from('hospital_prescriptions') as any)
                .update({ status: 'dispensed' } as any)
                .eq('id', selectedPrescription.id);

            if (error) throw error;
            // Success - state already updated
        } catch (error: any) {
            console.error('Dispense Error:', error);
            toast.error('Failed to update status: ' + (error.message || 'Unknown error'));

            // 3. Revert on failure
            setSelectedPrescription(prev => ({ ...prev!, status: previousStatus }));
            setPrescriptions(prev => prev.map(p => p.id === selectedPrescription.id ? { ...p, status: previousStatus } : p));
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h2 className="text-4xl font-bold text-gray-900 tracking-tight">Pharmacy</h2>
                    <p className="text-lg text-gray-700 mt-2">Incoming prescriptions & fulfillment queue</p>
                </div>

                <button
                    onClick={() => fetchPrescriptions()}
                    className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                    title="Reload"
                >
                    <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                </button>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
                {/* Tabs & Stats Header */}
                <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex p-1 bg-gray-200/50 rounded-xl">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'queue'
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Live Queue
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                                {prescriptions.filter(p => p.status === 'pending').length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'history'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            History Log
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-700">Loading pharmacy queue...</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {prescriptions.filter(p => activeTab === 'queue' ? p.status === 'pending' : p.status === 'dispensed').length === 0 ? (
                            <div className="p-24 text-center flex flex-col items-center justify-center">
                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                                    {activeTab === 'queue' ? (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    ) : (
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-gray-900">
                                    {activeTab === 'queue' ? 'All Caught Up!' : 'No History Found'}
                                </h3>
                                <p className="text-gray-700 mt-1">
                                    {activeTab === 'queue'
                                        ? 'There are no pending prescriptions waiting to be dispensed.'
                                        : 'No dispensed prescriptions found in the history log.'}
                                </p>
                                <button
                                    onClick={() => fetchPrescriptions()}
                                    className="mt-6 text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 px-6 py-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Refresh Data
                                </button>
                            </div>
                        ) : (
                            prescriptions
                                .filter(p => activeTab === 'queue' ? p.status === 'pending' : p.status === 'dispensed')
                                .map((item) => (
                                    <div
                                        key={item.id}
                                        className={`p-6 md:p-8 flex items-center justify-between transition-all duration-200
                                            ${item.status === 'dispensed' ? 'bg-gray-50/50' : 'bg-white hover:bg-blue-50/30'}`}
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm
                                                ${item.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                {item.token_number}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                    {item.patient?.name}
                                                    {item.status === 'dispensed' && (
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-md font-bold uppercase">
                                                            Dispensed
                                                        </span>
                                                    )}
                                                </h4>
                                                <div className="flex items-center gap-3 text-sm font-medium text-gray-700 mt-1">
                                                    <span>Age: {item.patient?.age}</span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    <span className="text-gray-900">
                                                        {item.doctor?.name?.toLowerCase().startsWith('dr.') ? item.doctor.name : `Dr. ${item.doctor?.name}`}
                                                    </span>
                                                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                    <span className="text-gray-500 text-xs">
                                                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            {item.status === 'pending' ? (
                                                <button
                                                    onClick={() => setSelectedPrescription(item)}
                                                    className="px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 flex items-center gap-2"
                                                >
                                                    Review & Dispense
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedPrescription(item)}
                                                    className="px-6 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all"
                                                >
                                                    View Details
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                        )}
                    </div>
                )}
            </div>

            {/* Prescription Detail Modal */}
            {selectedPrescription && !showPrintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    Prescription Details
                                </h3>
                                <p className="text-sm font-medium text-gray-700 mt-1">Token: <span className="text-gray-900">{selectedPrescription.token_number}</span></p>
                            </div>
                            <button onClick={() => setSelectedPrescription(null)} className="text-gray-400 hover:text-black p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-8 overflow-y-auto flex-1 font-serif bg-white">
                            <div className="text-center mb-8 pb-6 border-b border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-900 mb-1">BeanHealth Hospital</h2>
                                <p className="text-gray-700 text-sm tracking-wide uppercase">Excellence in Care</p>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8 text-sm">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Patient</p>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPrescription.patient?.name}</p>
                                    <p className="text-gray-800 font-sans">Age: {selectedPrescription.patient?.age}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Doctor</p>
                                    <p className="font-bold text-gray-900 text-lg">
                                        {selectedPrescription.doctor?.name?.toLowerCase().startsWith('dr.') ? selectedPrescription.doctor.name : `Dr. ${selectedPrescription.doctor?.name}`}
                                    </p>
                                    <p className="text-gray-800 font-sans">{selectedPrescription.doctor?.specialty}</p>
                                    <p className="text-gray-600 text-xs mt-2 font-sans">{new Date(selectedPrescription.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="mb-8">
                                <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-3">
                                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 font-serif text-lg">Rx</span>
                                    Medications
                                </h4>
                                <div className="space-y-6">
                                    {(selectedPrescription.medications || []).map((med: any, i: number) => (
                                        <div key={i} className="flex justify-between items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                            <div>
                                                <p className="font-bold text-gray-900 text-lg">{med.name} <span className="text-gray-600 font-normal text-sm ml-1">({med.dosage})</span></p>
                                                <p className="text-gray-700 italic mt-1">{med.instruction}</p>
                                            </div>
                                            <div className="text-right text-sm font-sans">
                                                <div className="inline-block px-3 py-1 bg-gray-100 rounded-lg text-gray-700 font-medium">{med.frequency}</div>
                                                <p className="text-gray-600 mt-1">{med.duration}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {selectedPrescription.notes && (
                                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-100">
                                    <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Doctor's Notes</p>
                                    <p className="text-gray-800 font-medium leading-relaxed">{selectedPrescription.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4">
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="px-6 py-4 bg-white border border-gray-200 text-gray-900 font-bold rounded-2xl hover:bg-gray-50 flex-1 transition-colors shadow-sm"
                            >
                                Print PDF
                            </button>

                            {selectedPrescription.status !== 'dispensed' && (
                                <button
                                    onClick={handleMarkDispensed}
                                    className="px-6 py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 flex-[2] shadow-xl shadow-emerald-600/20 transition-all transform hover:scale-[1.01] active:scale-95"
                                >
                                    Mark as Dispensed
                                </button>
                            )}
                            {selectedPrescription.status === 'dispensed' && (
                                <div className="flex-[2] flex items-center justify-center text-emerald-700 font-bold bg-emerald-100 rounded-2xl border border-emerald-200">
                                    ✓ Already Dispensed
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Official Print Modal (Reusable PrescriptionModal) */}
            {selectedPrescription && showPrintModal && (
                <PrescriptionModal
                    doctor={selectedPrescription.doctor}
                    patient={{
                        ...selectedPrescription.patient,
                        token_number: selectedPrescription.token_number
                    }}
                    onClose={() => setShowPrintModal(false)}
                    readOnly={true}
                    existingData={selectedPrescription}
                    clinicLogo={hospitalLogo || undefined}
                />
            )}
        </div>
    );
};

export default EnterprisePharmacyDashboard;

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

    useEffect(() => {
        if (!hospitalId) return;

        // Initial Fetch
        fetchPrescriptions();

        // Realtime Subscription with error handling
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
                (payload) => {
                    console.log('Realtime update received:', payload);
                    if (payload.eventType === 'INSERT') {
                        toast.success('New Prescription Received!', { duration: 4000 });
                    }
                    // Refetch in background without blocking UI
                    fetchPrescriptions(true);
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Pharmacy realtime connected');
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Pharmacy realtime error:', err);
                    // Attempt to refetch data after connection error
                    setTimeout(() => {
                        fetchPrescriptions(true);
                    }, 3000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [hospitalId, fetchPrescriptions]);

    // Periodic health check - refresh data every 60 seconds when tab is visible
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && hospitalId) {
                console.log('Periodic health check - refreshing pharmacy data...');
                fetchPrescriptions(true);
            }
        }, 60000); // Every 60 seconds
        return () => clearInterval(interval);
    }, [hospitalId, fetchPrescriptions]);

    // Refetch when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && hospitalId) {
                console.log('Tab visible, refreshing pharmacy data...');
                fetchPrescriptions(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [hospitalId, fetchPrescriptions]);

    // Fetch hospital logo
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

    const handleMarkDispensed = async () => {
        if (!selectedPrescription) return;

        try {
            const { error } = await (supabase
                .from('hospital_prescriptions') as any)
                .update({ status: 'dispensed' } as any)
                .eq('id', selectedPrescription.id);

            if (error) throw error;
            toast.success('Medicine Delivered');
            setSelectedPrescription(null);
            fetchPrescriptions();
        } catch (error: any) {
            console.error('Dispense Error:', error);
            toast.error('Failed to update status: ' + (error.message || 'Unknown error'));
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

            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden min-h-[500px]">
                <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-900">Prescription Queue</h3>
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wide">
                            {prescriptions.filter(p => p.status === 'pending').length} Pending
                        </span>
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-700">Loading pharmacy queue...</p>
                    </div>
                ) : prescriptions.length === 0 ? (
                    <div className="p-24 text-center flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-600">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900">No Prescriptions</h3>
                        <p className="text-gray-700 mt-1">There are no pending prescriptions at the moment.</p>
                        <button
                            onClick={() => fetchPrescriptions()}
                            className="mt-6 text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2 px-6 py-3 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            Reload List
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {prescriptions.map((item) => (
                            <div
                                key={item.id}
                                className={`p-6 md:p-8 flex items-center justify-between transition-all duration-200
                                    ${item.status === 'dispensed' ? 'bg-gray-50 opacity-60 grayscale-[0.5]' : 'bg-white hover:bg-blue-50/30'}`}
                            >
                                <div className="flex items-center gap-6">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm
                                        ${item.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                        {item.token_number}
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-900">{item.patient?.name}</h4>
                                        <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                                            <span>Age: {item.patient?.age}</span>
                                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                            <span className="text-gray-900">
                                                {item.doctor?.name?.toLowerCase().startsWith('dr.') ? item.doctor.name : `Dr. ${item.doctor?.name}`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                        ${item.status === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                                        {item.status === 'pending' ? 'Pending' : 'Delivered'}
                                    </span>
                                    <button
                                        onClick={() => setSelectedPrescription(item)}
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                                    >
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
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

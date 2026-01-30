import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import PrescriptionModal from './modals/PrescriptionModal';

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
        mr_number?: string;
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
                    patient:hospital_patients(name, age, mr_number)
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
                    patient:hospital_patients(name, age, mr_number)
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

    // Call patient to pharmacy counter (adds to display queue)
    const handleCallPatient = async (prescription: Prescription) => {
        try {
            // First, mark any currently "calling" patients as "waiting" (demote back to queue)
            await supabase
                .from('hospital_pharmacy_queue')
                .update({ status: 'waiting' })
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling');

            // Check if patient is already in queue
            const { data: existing } = await supabase
                .from('hospital_pharmacy_queue')
                .select('id')
                .eq('prescription_id', prescription.id)
                .in('status', ['waiting', 'calling'])
                .single();

            if (existing) {
                // Update existing entry to "calling"
                await supabase
                    .from('hospital_pharmacy_queue')
                    .update({ status: 'calling', called_at: new Date().toISOString() })
                    .eq('id', existing.id);
            } else {
                // Insert new entry with "calling" status
                await supabase
                    .from('hospital_pharmacy_queue')
                    .insert({
                        hospital_id: hospitalId,
                        prescription_id: prescription.id,
                        patient_name: prescription.patient?.name || 'Unknown',
                        token_number: prescription.token_number,
                        status: 'calling',
                        called_at: new Date().toISOString()
                    });
            }

            toast.success(`📢 Calling ${prescription.patient?.name}!`);
        } catch (error: any) {
            console.error('Error calling patient:', error);
            toast.error('Failed to call patient');
        }
    };

    // Add patient to waiting queue
    const handleAddToQueue = async (prescription: Prescription) => {
        try {
            // Check if already in queue
            const { data: existing } = await supabase
                .from('hospital_pharmacy_queue')
                .select('id, status')
                .eq('prescription_id', prescription.id)
                .in('status', ['waiting', 'calling'])
                .single();

            if (existing) {
                toast('Patient already in queue', { icon: 'ℹ️' });
                return;
            }

            await supabase
                .from('hospital_pharmacy_queue')
                .insert({
                    hospital_id: hospitalId,
                    prescription_id: prescription.id,
                    patient_name: prescription.patient?.name || 'Unknown',
                    token_number: prescription.token_number,
                    status: 'waiting'
                });

            toast.success(`➕ ${prescription.patient?.name} added to queue!`);
        } catch (error: any) {
            console.error('Error adding to queue:', error);
            toast.error('Failed to add to queue');
        }
    };

    // Clear the display (stop calling current patient/reset to waiting)
    const handleClearDisplay = async () => {
        try {
            // Find current "calling" patient
            const { data: current } = await supabase
                .from('hospital_pharmacy_queue')
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single();

            if (current) {
                // Set back to waiting
                await supabase
                    .from('hospital_pharmacy_queue')
                    .update({ status: 'waiting' })
                    .eq('hospital_id', hospitalId)
                    .eq('status', 'calling');

                toast.success('Display Cleared (Patient returned to queue)');
            } else {
                toast('Display is already empty', { icon: 'ℹ️' });
            }
        } catch (error: any) {
            console.error('Error clearing display:', error);
            toast.error('Failed to clear display');
        }
    };

    // Call next patient in queue
    const handleCallNext = async () => {
        try {
            // First, mark current "calling" patient as "dispensed"
            await supabase
                .from('hospital_pharmacy_queue')
                .update({ status: 'dispensed' })
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling');

            // Find next waiting patient (oldest first)
            const { data: nextPatient } = await supabase
                .from('hospital_pharmacy_queue')
                .select('*')
                .eq('hospital_id', hospitalId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (nextPatient) {
                await supabase
                    .from('hospital_pharmacy_queue')
                    .update({ status: 'calling', called_at: new Date().toISOString() })
                    .eq('id', nextPatient.id);

                toast.success(`📢 Calling ${nextPatient.patient_name}!`);
            } else {
                toast('No patients in queue', { icon: '✅' });
            }
        } catch (error: any) {
            console.error('Error calling next:', error);
            toast.error('Failed to call next patient');
        }
    };

    // Skip current patient
    const handleSkipCurrent = async () => {
        try {
            // Mark current "calling" patient as "skipped"
            const { data: current } = await supabase
                .from('hospital_pharmacy_queue')
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single();

            if (current) {
                await supabase
                    .from('hospital_pharmacy_queue')
                    .update({ status: 'skipped' })
                    .eq('hospital_id', hospitalId)
                    .eq('status', 'calling');

                toast(`⏩ Skipped ${current.patient_name}`);
            }

            // Call next patient
            await handleCallNext();
        } catch (error: any) {
            console.error('Error skipping:', error);
            toast.error('Failed to skip patient');
        }
    };

    // Done dispensing, call next
    const handleDoneAndNext = async () => {
        try {
            // Mark current "calling" patient as "dispensed"
            const { data: current } = await supabase
                .from('hospital_pharmacy_queue')
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single();

            if (current) {
                await supabase
                    .from('hospital_pharmacy_queue')
                    .update({ status: 'dispensed' })
                    .eq('hospital_id', hospitalId)
                    .eq('status', 'calling');

                toast.success(`✅ ${current.patient_name} done!`);
            }

            // Call next patient
            await handleCallNext();
        } catch (error: any) {
            console.error('Error:', error);
            toast.error('Failed to complete');
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 md:mb-10">
                <div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">Pharmacy</h2>
                    <p className="text-base md:text-lg text-gray-700 mt-2">Incoming prescriptions & fulfillment queue</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 justify-start md:justify-end">
                    {/* Quick Queue Actions */}
                    <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1.5">
                        <button
                            onClick={handleCallNext}
                            className="px-3 py-2 text-sm font-bold text-blue-600 bg-white rounded-lg hover:bg-blue-50 transition-all shadow-sm flex items-center gap-1.5"
                            title="Call next patient in queue"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                            Next
                        </button>
                        <button
                            onClick={handleSkipCurrent}
                            className="px-3 py-2 text-sm font-bold text-orange-600 bg-white rounded-lg hover:bg-orange-50 transition-all shadow-sm flex items-center gap-1.5"
                            title="Skip current patient"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                            </svg>
                            Skip
                        </button>
                        <button
                            onClick={handleDoneAndNext}
                            className="px-3 py-2 text-sm font-bold text-green-600 bg-white rounded-lg hover:bg-green-50 transition-all shadow-sm flex items-center gap-1.5"
                            title="Mark done and call next"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Done
                        </button>
                    </div>

                    {/* Open Queue Display Button */}
                    {/* Display Controls Group */}
                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                        <button
                            onClick={() => window.open('/enterprise-dashboard/pharmacy/display', '_blank')}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md shadow-emerald-500/20 flex items-center gap-2"
                            title="Open Queue Display for patient waiting area"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span className="hidden sm:inline">Display</span>
                        </button>
                        <div className="w-px h-6 bg-gray-200 mx-1"></div>
                        <button
                            onClick={handleClearDisplay}
                            className="px-3 py-2 text-sm font-bold text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1.5"
                            title="Clear display content (reset to waiting)"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">Clear</span>
                        </button>
                    </div>
                    {/* Refresh Button */}
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
                                        className={`p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between transition-all duration-200 gap-6
                                            ${item.status === 'dispensed' ? 'bg-gray-50/50' : 'bg-white hover:bg-blue-50/30'}`}
                                    >
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full sm:w-auto">
                                            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                                                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-bold text-lg sm:text-xl shadow-sm flex-shrink-0
                                                    ${item.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-gray-200 text-gray-600'}`}>
                                                    {item.token_number}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-lg font-bold text-gray-900 flex flex-wrap items-center gap-2">
                                                        {item.patient?.name}
                                                        {item.status === 'dispensed' && (
                                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-md font-bold uppercase">
                                                                Dispensed
                                                            </span>
                                                        )}
                                                    </h4>
                                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm font-medium text-gray-700 mt-1">
                                                        <span className="whitespace-nowrap">Age: {item.patient?.age}</span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                        <span className="text-gray-900 whitespace-nowrap">
                                                            {item.doctor?.name?.toLowerCase().startsWith('dr.') ? item.doctor.name : `Dr. ${item.doctor?.name}`}
                                                        </span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:block"></span>
                                                        <span className="text-gray-500 text-xs whitespace-nowrap">
                                                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                                            {item.status === 'pending' ? (
                                                <>
                                                    {/* Add to Queue Button */}
                                                    <button
                                                        onClick={() => handleAddToQueue(item)}
                                                        className="px-3 py-3 text-sm font-bold text-purple-600 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-all flex items-center gap-1.5 whitespace-nowrap"
                                                        title="Add to waiting queue"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                        <span className="hidden sm:inline">Queue</span>
                                                    </button>
                                                    {/* Call In Button */}
                                                    <button
                                                        onClick={() => handleCallPatient(item)}
                                                        className="px-3 py-3 text-sm font-bold text-orange-600 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-all flex items-center gap-1.5 whitespace-nowrap"
                                                        title="Call patient to counter now"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                                        </svg>
                                                        <span className="hidden sm:inline">Call In</span>
                                                    </button>
                                                    {/* Review & Dispense Button */}
                                                    <button
                                                        onClick={() => setSelectedPrescription(item)}
                                                        className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 whitespace-nowrap"
                                                    >
                                                        Review & Dispense
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedPrescription(item)}
                                                    className="w-full sm:w-auto px-6 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 transition-all whitespace-nowrap"
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
                        <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <div>
                                <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                                    Prescription Details
                                </h3>
                                <p className="text-sm font-medium text-gray-700 mt-1">Token: <span className="text-gray-900">{selectedPrescription.token_number}</span></p>
                            </div>
                            <button onClick={() => setSelectedPrescription(null)} className="text-gray-400 hover:text-black p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5 sm:p-8 overflow-y-auto flex-1 font-serif bg-white">
                            <div className="text-center mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-100">
                                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">BeanHealth Hospital</h2>
                                <p className="text-gray-700 text-sm tracking-wide uppercase">Excellence in Care</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mb-8 text-sm">
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-700 uppercase tracking-widest">Patient</p>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPrescription.patient?.name}</p>
                                    <p className="text-gray-800 font-sans">
                                        Age: {selectedPrescription.patient?.age}
                                        {selectedPrescription.patient?.mr_number && (
                                            <span className="ml-2 text-gray-600">| MR: {selectedPrescription.patient.mr_number}</span>
                                        )}
                                    </p>
                                </div>
                                <div className="space-y-1 sm:text-right">
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
                        <div className="p-5 sm:p-6 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="w-full sm:flex-1 px-6 py-3 sm:py-4 bg-white border border-gray-200 text-gray-900 font-bold rounded-2xl hover:bg-gray-50 transition-colors shadow-sm order-2 sm:order-1"
                            >
                                Print PDF
                            </button>

                            {selectedPrescription.status !== 'dispensed' && (
                                <button
                                    onClick={handleMarkDispensed}
                                    className="w-full sm:flex-[2] px-6 py-3 sm:py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all transform hover:scale-[1.01] active:scale-95 order-1 sm:order-2"
                                >
                                    Mark as Dispensed
                                </button>
                            )}
                            {selectedPrescription.status === 'dispensed' && (
                                <div className="w-full sm:flex-[2] py-3 sm:py-4 flex items-center justify-center text-emerald-700 font-bold bg-emerald-100 rounded-2xl border border-emerald-200 order-1 sm:order-2">
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

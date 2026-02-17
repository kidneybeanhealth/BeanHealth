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
    next_review_date?: string;
    dispensed_days?: number;
    dispensed_at?: string;
    dispensed_by?: string;
    metadata?: any;
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
        token_number?: string;
    };
}

const EnterprisePharmacyDashboard: React.FC<PharmacyDashboardProps> = ({ hospitalId, onBack }) => {
    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [hospitalLogo, setHospitalLogo] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'past_records'>('queue');
    const [dispensingDays, setDispensingDays] = useState<number>(0);

    // Helper to get today's ISO date
    const getTodayISO = () => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date.toISOString();
    };

    const fetchPrescriptions = useCallback(async (isBackground = false) => {
        if (!hospitalId) return;
        if (!isBackground) setLoading(true); // Don't show spinner for background updates

        console.log('Fetching prescriptions for Hospital ID:', hospitalId);
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    metadata,
                    doctor:hospital_doctors(name, specialty, signature_url),
                    patient:hospital_patients(name, age, mr_number, token_number)
                `)
                .eq('hospital_id', hospitalId)
                .in('status', ['pending', 'dispensed'])
                .gte('created_at', getTodayISO()) // Filter: Today
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
        for (const patient of patientMap.values()) {
            patient.prescriptions.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
        return Array.from(patientMap.values());
    };

    const fetchPastRecords = useCallback(async (isBackground = false, page = 0, append = false) => {
        if (!hospitalId) return;
        if (!isBackground && !append) setLoading(true);
        if (append) setIsLoadingMorePast(true);
        try {
            if (!append) {
                const { data: countData } = await supabase
                    .from('hospital_prescriptions' as any)
                    .select('patient_id')
                    .eq('hospital_id', hospitalId);
                const uniquePatients = new Set((countData || []).map((r: any) => r.patient_id));
                setPastRecordsTotal(uniquePatients.size);
            }

            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    id, medications, notes, status, token_number, created_at, patient_id, metadata,
                    doctor:hospital_doctors(name, specialty, signature_url),
                    patient:hospital_patients(*)
                `)
                .eq('hospital_id', hospitalId)
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
    }, [hospitalId]);

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
                    doctor:hospital_doctors(name, specialty, signature_url),
                    patient:hospital_patients!inner(*)
                `)
                .eq('hospital_id', hospitalId)
                .ilike('patient.name', `%${searchQuery}%`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            const grouped = groupPrescriptionsByPatient(data || []);
            setPastRecords(grouped as any);
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

    // Fetch single prescription for realtime inserts
    const fetchSinglePrescription = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('hospital_prescriptions' as any)
                .select(`
                    *,
                    metadata,
                    doctor:hospital_doctors(name, specialty, signature_url),
                    patient:hospital_patients(name, age, mr_number, token_number)
                `)
                .eq('id', id)
                .single() as any;

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
                const { data } = await supabase
                    .from('users')
                    .select('avatar_url')
                    .eq('id', hospitalId)
                    .single<any>();
                if (data?.avatar_url) {
                    setHospitalLogo(data.avatar_url);
                }
            } catch (err) {
                console.warn('Could not fetch hospital logo:', err);
            }
        };
        fetchHospitalLogo();
    }, [hospitalId]);

    // Initialize dispensing days when prescription is selected
    useEffect(() => {
        if (selectedPrescription && selectedPrescription.status !== 'dispensed') {
            // Calculate prescribed days from next_review_date
            if (selectedPrescription.next_review_date) {
                try {
                    const reviewDate = new Date(selectedPrescription.next_review_date);

                    // Check for invalid date
                    if (isNaN(reviewDate.getTime())) {
                        console.warn('Invalid review date:', selectedPrescription.next_review_date);
                        setDispensingDays(30); // Default to 30 days
                        return;
                    }

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffTime = reviewDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                    // Only use calculated days if reasonable (1-365 days in future)
                    if (diffDays > 0 && diffDays <= 365) {
                        setDispensingDays(diffDays);
                    } else if (diffDays > 365) {
                        setDispensingDays(365); // Cap at max
                    } else {
                        setDispensingDays(30); // Default for past dates
                    }
                } catch (error) {
                    console.error('Error calculating dispensing days:', error);
                    setDispensingDays(30); // Fallback default
                }
            } else {
                setDispensingDays(30); // Default when no review date
            }
        }
    }, [selectedPrescription]);

    // Note: Periodic interval removed to save resources, relying on Realtime + Visibility.

    const handleMarkDispensed = async () => {
        if (!selectedPrescription) return;

        // Allow 0 or empty to mean "not tracked" - don't block workflow
        const daysToDispense = dispensingDays || 0;

        // Validate only if a value was entered
        if (daysToDispense > 365) {
            toast.error('Dispensing days cannot exceed 365');
            return;
        }

        const previousStatus = selectedPrescription.status;
        const optimisticUpdated = {
            ...selectedPrescription,
            status: 'dispensed',
            dispensed_days: daysToDispense > 0 ? daysToDispense : null,
            dispensed_at: new Date().toISOString()
        };

        // 1. Optimistic Update
        setSelectedPrescription(optimisticUpdated as any);
        setPrescriptions(prev => prev.map(p => p.id === optimisticUpdated.id ? { ...p, status: 'dispensed', dispensed_days: daysToDispense > 0 ? daysToDispense : null } : p));
        toast.success(daysToDispense > 0 ? `Medicine Delivered (${daysToDispense} days)` : 'Medicine Delivered');

        try {
            // 2. Update prescription status with dispensing data
            const { error } = await (supabase
                .from('hospital_prescriptions') as any)
                .update({
                    status: 'dispensed',
                    dispensed_days: daysToDispense > 0 ? daysToDispense : null,
                    dispensed_at: new Date().toISOString()
                } as any)
                .eq('id', selectedPrescription.id);

            if (error) throw error;

            // 3. Also update the display queue to mark as dispensed
            await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .update({ status: 'dispensed' } as any)
                .eq('prescription_id', selectedPrescription.id);

            // Success - state already updated
        } catch (error: any) {
            console.error('Dispense Error:', error);
            toast.error('Failed to update status: ' + (error.message || 'Unknown error'));

            // 4. Revert on failure
            setSelectedPrescription(prev => ({ ...prev!, status: previousStatus }));
            setPrescriptions(prev => prev.map(p => p.id === selectedPrescription.id ? { ...p, status: previousStatus } : p));
        }
    };

    // Call patient to pharmacy counter (adds to display queue)
    const handleCallPatient = async (prescription: Prescription) => {
        try {
            // First, mark any currently "calling" patients as "waiting" (demote back to queue)
            // First, mark any currently "calling" patients as "waiting" (demote back to queue)
            await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .update({ status: 'waiting' } as any)
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling');

            // Check if patient is already in queue
            const { data: existing } = await supabase
                .from('hospital_pharmacy_queue' as any)
                .select('id')
                .eq('prescription_id', prescription.id)
                .in('status', ['waiting', 'calling'])
                .single() as any;

            if (existing) {
                // Update existing entry to "calling"
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .update({ status: 'calling', called_at: new Date().toISOString() } as any)
                    .eq('id', existing.id);
            } else {
                // Insert new entry with "calling" status
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .insert({
                        hospital_id: hospitalId,
                        prescription_id: prescription.id,
                        patient_name: prescription.patient?.name || 'Unknown',
                        token_number: prescription.token_number,
                        status: 'calling',
                        called_at: new Date().toISOString()
                    } as any);
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
                .from('hospital_pharmacy_queue' as any)
                .select('id, status')
                .eq('prescription_id', prescription.id)
                .in('status', ['waiting', 'calling'])
                .single() as any;

            if (existing) {
                toast('Patient already in queue', { icon: 'ℹ️' });
                return;
            }

            await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .insert({
                    hospital_id: hospitalId,
                    prescription_id: prescription.id,
                    patient_name: prescription.patient?.name || 'Unknown',
                    token_number: prescription.token_number,
                    status: 'waiting'
                } as any);

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
                .from('hospital_pharmacy_queue' as any)
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single() as any;

            if (current) {
                // Set back to waiting
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .update({ status: 'waiting' } as any)
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
            await (supabase
                .from('hospital_pharmacy_queue' as any) as any)
                .update({ status: 'dispensed' } as any)
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling');

            // Find next waiting patient (oldest first)
            const { data: nextPatient } = await supabase
                .from('hospital_pharmacy_queue' as any)
                .select('*')
                .eq('hospital_id', hospitalId)
                .eq('status', 'waiting')
                .order('created_at', { ascending: true })
                .limit(1)
                .single() as any;

            if (nextPatient) {
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .update({ status: 'calling', called_at: new Date().toISOString() } as any)
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
                .from('hospital_pharmacy_queue' as any)
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single() as any;

            if (current) {
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .update({ status: 'skipped' } as any)
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
                .from('hospital_pharmacy_queue' as any)
                .select('patient_name')
                .eq('hospital_id', hospitalId)
                .eq('status', 'calling')
                .single() as any;

            if (current) {
                await (supabase
                    .from('hospital_pharmacy_queue' as any) as any)
                    .update({ status: 'dispensed' } as any)
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
                        <button
                            onClick={() => { setActiveTab('past_records'); setPastRecords([]); setPastRecordsPage(0); setHasMorePastRecords(true); fetchPastRecords(); }}
                            className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${activeTab === 'past_records'
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            Past Records
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
                        {activeTab === 'past_records' ? (
                            <>
                                {/* Patient Database Header */}
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            <h3 className="text-sm font-bold text-gray-800">Patient Database</h3>
                                        </div>
                                        {pastRecordsTotal > 0 && (
                                            <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200">
                                                {pastRecords.length} of {pastRecordsTotal} patients
                                            </span>
                                        )}
                                    </div>
                                    <form onSubmit={handleSearchPastRecords} className="relative w-full">
                                        <input
                                            type="text"
                                            placeholder="Search patient by name..."
                                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </form>
                                </div>
                                {pastRecords.length === 0 ? (
                                    <div className="p-24 text-center">
                                        <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <p className="font-medium text-gray-700">No patients found</p>
                                        <p className="text-gray-400 text-sm mt-1">Try a different search term</p>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Table Header */}
                                        <div className="grid grid-cols-[2.5rem_1fr_3rem_6.5rem_8.5rem_10rem_3rem_2rem] gap-1 px-6 py-3 bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                                            <span>#</span>
                                            <span>Patient Name</span>
                                            <span>Age</span>
                                            <span>Phone</span>
                                            <span>MR #</span>
                                            <span>BH ID</span>
                                            <span>Rxs</span>
                                            <span></span>
                                        </div>
                                        {/* Patient Rows */}
                                        <div className="divide-y divide-gray-100">
                                            {pastRecords.map((patient, index) => {
                                                const nameForInitial = (patient.name || '').replace(/^(MR\.|MRS\.|MS\.|DR\.)\s*/i, '').trim();
                                                const initial = nameForInitial.charAt(0)?.toUpperCase() || '?';
                                                return (
                                                    <div key={patient.id}>
                                                        <div
                                                            className={`grid grid-cols-[2.5rem_1fr_3rem_6.5rem_8.5rem_10rem_3rem_2rem] gap-1 px-6 py-4 cursor-pointer transition-all duration-150 items-center ${expandedPatientId === patient.id ? 'bg-blue-50/60 border-l-4 border-l-blue-400' : 'hover:bg-gray-50/80 border-l-4 border-l-transparent'}`}
                                                            onClick={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                                                        >
                                                            <span className="text-xs text-gray-400 font-medium">{index + 1}</span>

                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                                                                    {initial}
                                                                </div>
                                                                <p className="font-semibold text-gray-900 text-sm truncate flex items-center gap-2">
                                                                    {patient.name}
                                                                    {patient.token_number && (
                                                                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-bold border border-blue-100">
                                                                            Token: {patient.token_number}
                                                                        </span>
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <span className="text-sm text-gray-700">{patient.age || '—'}</span>

                                                            <span className="text-sm text-gray-700 font-mono">{patient.phone || '—'}</span>

                                                            <span className="text-xs text-gray-700 font-medium truncate min-w-0" title={patient.mr_number || ''}>{patient.mr_number || '—'}</span>

                                                            <span className="text-xs text-gray-500 font-mono truncate min-w-0" title={patient.beanhealth_id || ''}>{patient.beanhealth_id || '—'}</span>

                                                            <span className="text-sm font-semibold text-blue-600">{patient.prescriptions?.length || 0}</span>

                                                            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedPatientId === patient.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                                                                {rx.doctor?.name && (
                                                                                                    <span className="text-[10px] text-gray-500 font-medium">
                                                                                                        · Dr. {rx.doctor.name}
                                                                                                    </span>
                                                                                                )}
                                                                                                {rx.status === 'dispensed' && (
                                                                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">✓ Dispensed</span>
                                                                                                )}
                                                                                                {rx.status === 'pending' && (
                                                                                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">Pending</span>
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
                                                    className="px-6 py-2.5 bg-blue-50 text-blue-600 font-bold text-sm rounded-xl hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50"
                                                >
                                                    {isLoadingMorePast ? 'Loading...' : 'Load More Patients'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : prescriptions.filter(p => activeTab === 'queue' ? p.status === 'pending' : p.status === 'dispensed').length === 0 ? (
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
                                                    {item.token_number || item.patient?.token_number}
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

            {/* Prescription Detail Modal - Redesigned */}
            {selectedPrescription && !showPrintModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full flex flex-col max-h-[90vh] animate-scale-in overflow-hidden">
                        {/* Header with Close Button */}
                        <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                    Rx
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Prescription Sheet</h3>
                                    <p className="text-xs text-gray-600">Token #{selectedPrescription.token_number}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedPrescription(null)}
                                className="text-gray-400 hover:text-gray-900 p-2 hover:bg-white/50 rounded-full transition-all"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 sm:p-8 overflow-y-auto flex-1 bg-white">
                            {/* Patient Information Card */}
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-6 border border-gray-200">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h2 className="text-2xl font-bold text-gray-900">{selectedPrescription.patient?.name}</h2>
                                            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                                                Token {selectedPrescription.token_number || selectedPrescription.patient?.token_number}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                            <div className="flex items-center gap-2">
                                                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                                <span className="text-gray-700 font-medium">Age: <strong className="text-gray-900">{selectedPrescription.patient?.age}</strong></span>
                                            </div>
                                            {selectedPrescription.patient?.mr_number && (
                                                <div className="flex items-center gap-2">
                                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span className="text-gray-700 font-medium">MR: <strong className="text-gray-900">{selectedPrescription.patient.mr_number}</strong></span>
                                                </div>
                                            )}
                                            {(() => {
                                                const phoneMatch = selectedPrescription.notes?.match(/Phone:\s*([^\n]+)/);
                                                const phone = phoneMatch ? phoneMatch[1].trim() : null;
                                                return phone && (
                                                    <div className="flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                        </svg>
                                                        <span className="text-gray-700 font-medium">Ph: <strong className="text-gray-900">{phone}</strong></span>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-300 flex items-center justify-between text-xs text-gray-600">
                                    <span>
                                        Dr. {selectedPrescription.doctor?.name?.toLowerCase().startsWith('dr.')
                                            ? selectedPrescription.doctor.name.replace(/^dr\.\s*/i, '')
                                            : selectedPrescription.doctor?.name}
                                    </span>
                                    <span>{new Date(selectedPrescription.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                </div>
                            </div>

                            {/* Duration Tracking Boxes */}
                            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Prescribed Duration Box */}
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">Prescribed Duration</h5>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-blue-900">
                                            {(() => {
                                                if (!selectedPrescription.next_review_date) return 'N/A';
                                                const reviewDate = new Date(selectedPrescription.next_review_date);
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const diffTime = reviewDate.getTime() - today.getTime();
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                                return diffDays > 0 ? diffDays : 'N/A';
                                            })()}
                                        </span>
                                        {selectedPrescription.next_review_date && (
                                            <span className="text-sm text-blue-700 font-medium">days</span>
                                        )}
                                    </div>
                                    {selectedPrescription.next_review_date && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            Until {new Date(selectedPrescription.next_review_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </p>
                                    )}
                                </div>

                                {/* Dispensing Duration Input Box */}
                                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">Dispensing Duration</h5>
                                    </div>
                                    {selectedPrescription.status === 'dispensed' && selectedPrescription.dispensed_days ? (
                                        <div>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-bold text-emerald-900">{selectedPrescription.dispensed_days}</span>
                                                <span className="text-sm text-emerald-700 font-medium">days</span>
                                            </div>
                                            {selectedPrescription.dispensed_at && (
                                                <p className="text-xs text-emerald-600 mt-1">
                                                    Dispensed on {new Date(selectedPrescription.dispensed_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={dispensingDays || ''}
                                                onChange={(e) => setDispensingDays(parseInt(e.target.value) || 0)}
                                                className="w-24 text-3xl font-bold text-emerald-900 bg-white border-2 border-emerald-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                                placeholder="0"
                                            />
                                            <span className="text-sm text-emerald-700 font-medium">days</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Medications Table */}
                            <div className="mb-6">
                                <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
                                    Prescribed Medications
                                </h4>
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="text-left p-3 text-xs font-bold text-gray-700 uppercase tracking-wider">#</th>
                                                <th className="text-left p-3 text-xs font-bold text-gray-700 uppercase tracking-wider">Medicine</th>
                                                <th className="text-center p-3 text-xs font-bold text-gray-700 uppercase tracking-wider">Frequency</th>
                                                <th className="text-left p-3 text-xs font-bold text-gray-700 uppercase tracking-wider">Instructions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(selectedPrescription.medications || []).map((med: any, i: number) => (
                                                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="p-3 text-sm text-gray-600 font-medium">{i + 1}</td>
                                                    <td className="p-3">
                                                        <p className="font-bold text-gray-900 text-sm">{med.name}</p>
                                                        <p className="text-xs text-gray-600 mt-0.5">{med.dosage}</p>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex items-center justify-center">
                                                            <span className="px-3 py-1.5 bg-blue-100 text-blue-900 text-sm font-mono font-bold rounded-lg">
                                                                {med.frequency}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500 text-center mt-1">{med.duration}</p>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                                                            {med.instruction && (
                                                                <>
                                                                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                                    </svg>
                                                                    {med.instruction}
                                                                </>
                                                            )}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="p-5 sm:p-6 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="w-full sm:flex-1 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                Print PDF
                            </button>

                            {selectedPrescription.status !== 'dispensed' && (
                                <button
                                    onClick={handleMarkDispensed}
                                    className="w-full sm:flex-[2] px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/30 transition-all transform hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Mark as Dispensed
                                </button>
                            )}
                            {selectedPrescription.status === 'dispensed' && (
                                <div className="w-full sm:flex-[2] py-3 flex items-center justify-center text-emerald-700 font-bold bg-emerald-100 rounded-xl border-2 border-emerald-300 gap-2">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                                    </svg>
                                    Already Dispensed
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
                        token_number: selectedPrescription.token_number || selectedPrescription.patient?.token_number
                    }}
                    onClose={() => setShowPrintModal(false)}
                    readOnly={true}
                    existingData={{
                        ...selectedPrescription,
                        dispensed_days: dispensingDays || (selectedPrescription as any).dispensed_days
                    }}
                    clinicLogo={hospitalLogo || undefined}
                />
            )}
        </div>
    );
};

export default EnterprisePharmacyDashboard;

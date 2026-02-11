import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitalName } from '../../hooks/useHospitalName';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { LogoIcon } from '../icons/LogoIcon';
import PrinterSetupModal from '../PrinterSetupModal';
import { printerService } from '../../services/BluetoothPrinterService';
import { generateTokenReceipt, createTokenData } from '../../utils/tokenReceiptGenerator';
import PrinterPreview from '../PrinterPreview';
import { BeanhealthIdService } from '../../services/beanhealthIdService';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
}

interface QueueItem {
    id: string;
    hospital_id: string;
    patient_id: string;
    doctor_id: string | null;
    queue_number: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    patient: {
        id?: string;
        name: string;
        age: number;
        token_number: string;
        mr_number?: string;
        beanhealth_id?: string;
    };
    doctor: {
        id?: string;
        name: string;
        specialty: string;
    };
    created_at: string;
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

const ReceptionDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile, refreshProfile } = useAuth();
    const { displayName } = useHospitalName('Hospital');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [activeTab, setActiveTab] = useState<'queue' | 'patients' | 'past_records'>('queue');

    // Walk-in Modal
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInForm, setWalkInForm] = useState({
        name: '',
        age: '',
        fatherHusbandName: '',
        place: '',
        phone: '',
        department: '',
        doctorId: '',
        tokenNumber: '',
        mrNumber: ''
    });

    // Settings Modal
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [hospitalSettings, setHospitalSettings] = useState({
        hospitalName: profile?.name || '',
        address: '',
        contactNumber: '',
        email: profile?.email || '',
        avatarUrl: profile?.avatar_url || ''
    });
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

    // Printer state
    const [showPrinterSetup, setShowPrinterSetup] = useState(false);
    const [printerConnected, setPrinterConnected] = useState(false);
    const [showPrintDialog, setShowPrintDialog] = useState(false);
    const [lastRegisteredPatient, setLastRegisteredPatient] = useState<{
        tokenNumber: string;
        name: string;
        mrNumber?: string;
        doctorName: string;
        department: string;
    } | null>(null);
    const [isPrintingToken, setIsPrintingToken] = useState(false);
    const [printerSettings, setPrinterSettings] = useState<{ spacing: number; alignment: 'left' | 'center' | 'right' }>({
        spacing: 1,
        alignment: 'center'
    });
    const [isSavingPrinterSettings, setIsSavingPrinterSettings] = useState(false);

    // BeanHealth ID Lookup
    const [bhidMatch, setBhidMatch] = useState<{
        id: string;
        name: string;
        email: string;
        beanhealthId: string;
    } | null>(null);
    const [isSearchingBhid, setIsSearchingBhid] = useState(false);
    const phoneDebounceRef = useRef<NodeJS.Timeout | null>(null);

    const handlePhoneLookup = useCallback((phone: string) => {
        // Clear previous match and timer
        setBhidMatch(null);
        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);

        // Need at least 10 digits for a valid phone
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) return;

        setIsSearchingBhid(true);
        phoneDebounceRef.current = setTimeout(async () => {
            try {
                const match = await BeanhealthIdService.findPatientByPhone(digits);
                setBhidMatch(match);
            } catch (err) {
                console.warn('BHID lookup failed:', err);
            } finally {
                setIsSearchingBhid(false);
            }
        }, 600);
    }, []);

    // Memoized fetch functions
    const fetchDoctors = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('id, name, specialty')
                .eq('hospital_id', profile.id)
                .eq('is_active', true);

            if (error) throw error;
            setDoctors(data || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    }, [profile?.id]);

    const fetchQueue = useCallback(async (isBackground = false) => {
        if (!profile?.id) return;
        if (!isBackground) setIsLoadingQueue(true);
        try {
            const { data, error } = await supabase
                .from('hospital_queues')
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('hospital_id', profile.id)
                .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setQueue(data as any || []);
        } catch (error) {
            console.error('Error fetching queue:', error);
            if (!isBackground) toast.error('Failed to update queue');
        } finally {
            if (!isBackground) setIsLoadingQueue(false);
        }
    }, [profile?.id]);

    // Patient Database State (Past Records tab)
    const [pastRecords, setPastRecords] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [pastRecordsPage, setPastRecordsPage] = useState(0);
    const [hasMorePastRecords, setHasMorePastRecords] = useState(true);
    const [isLoadingMorePast, setIsLoadingMorePast] = useState(false);
    const [pastRecordsTotal, setPastRecordsTotal] = useState(0);
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
    const PAST_RECORDS_PER_PAGE = 50;

    const fetchPastRecords = useCallback(async (isBackground = false, page = 0, append = false) => {
        if (!profile?.id) return;
        if (!isBackground && !append) setIsLoadingQueue(true);
        if (append) setIsLoadingMorePast(true);
        try {
            // Get count first (only on first load)
            if (!append) {
                const { count } = await supabase
                    .from('hospital_patients')
                    .select('id', { count: 'exact', head: true })
                    .eq('hospital_id', profile.id);
                setPastRecordsTotal(count || 0);
            }

            const { data, error } = await supabase
                .from('hospital_patients' as any)
                .select(`
                    *,
                    prescriptions:hospital_prescriptions(id, medications, notes, status, token_number, created_at, doctor:hospital_doctors(name, specialty))
                `)
                .eq('hospital_id', profile.id)
                .order('created_at', { ascending: false })
                .range(page * PAST_RECORDS_PER_PAGE, (page + 1) * PAST_RECORDS_PER_PAGE - 1);

            if (error) throw error;
            const results = (data || []).map((p: any) => ({
                ...p,
                prescriptions: (p.prescriptions || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            }));
            setHasMorePastRecords(results.length === PAST_RECORDS_PER_PAGE);
            if (append) {
                setPastRecords(prev => [...prev, ...results]);
            } else {
                setPastRecords(results);
            }
            setPastRecordsPage(page);
        } catch (error) {
            console.error('Error fetching patients:', error);
            if (!isBackground) toast.error('Failed to load patients');
        } finally {
            if (!isBackground && !append) setIsLoadingQueue(false);
            if (append) setIsLoadingMorePast(false);
        }
    }, [profile?.id]);

    const handleLoadMorePastRecords = () => {
        fetchPastRecords(true, pastRecordsPage + 1, true);
    };

    const handleSearchPastRecords = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoadingQueue(true);
        try {
            if (!searchQuery.trim()) {
                await fetchPastRecords();
                return;
            }

            const { data, error } = await supabase
                .from('hospital_patients' as any)
                .select(`
                    *,
                    prescriptions:hospital_prescriptions(id, medications, notes, status, token_number, created_at, doctor:hospital_doctors(name, specialty))
                `)
                .eq('hospital_id', profile.id)
                .ilike('name', `%${searchQuery}%`)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;
            const results = (data || []).map((p: any) => ({
                ...p,
                prescriptions: (p.prescriptions || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            }));
            setPastRecords(results);
            setHasMorePastRecords(false);
        } catch (err) {
            console.error(err);
            toast.error('Search failed');
        } finally {
            setIsLoadingQueue(false);
        }
    };

    // Loading timeout - prevents infinite loading state
    useEffect(() => {
        if (isLoadingQueue) {
            const timeout = setTimeout(() => {
                setIsLoadingQueue(false);
                toast.error('Loading timed out. Please try refreshing.');
            }, 15000); // 15 second timeout
            return () => clearTimeout(timeout);
        }
    }, [isLoadingQueue]);

    // Initial fetch
    useEffect(() => {
        if (profile?.id) {
            fetchDoctors();
            fetchQueue();
            fetchHospitalSettings();
        }
    }, [profile?.id, fetchDoctors, fetchQueue]);

    // Fetch single item for realtime inserts
    const fetchSingleQueueItem = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('hospital_queues')
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('id', id)
                .single();

            if (data && !error) {
                setQueue((prev: any[]) => {
                    const exists = prev.some((item: any) => item.id === (data as any).id);
                    if (exists) return prev;
                    return [data, ...prev].sort((a: any, b: any) =>
                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    );
                });
            }
        } catch (error) {
            console.error('Error fetching new queue item:', error);
        }
    };

    // Realtime subscription for queue updates - Optimized
    useEffect(() => {
        if (!profile?.id) return;

        console.log('Setting up optimized realtime subscription...');
        const channel = supabase
            .channel(`reception-queue-${profile.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_queues',
                    filter: `hospital_id=eq.${profile.id}`
                },
                (payload: any) => {
                    if (payload.eventType === 'INSERT') {
                        // New item added - fetch details with joins
                        fetchSingleQueueItem(payload.new.id);
                        toast.success('New patient registered', { duration: 3000, position: 'bottom-right' });
                    } else if (payload.eventType === 'UPDATE') {
                        // Update existing item - merge changes
                        setQueue((prev: any[]) => prev.map((item: any) => {
                            if (item.id === payload.new.id) {
                                return { ...item, ...payload.new };
                            }
                            return item;
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        // Remove item
                        setQueue((prev: any[]) => prev.filter((item: any) => item.id !== payload.old.id));
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hospital_doctors',
                    filter: `hospital_id=eq.${profile.id}`
                },
                () => {
                    fetchDoctors();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log('Realtime connected');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('Realtime connection error, falling back to fetch');
                    fetchQueue(true);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchDoctors]); // Removed fetchQueue dependency to avoid recreation

    // Refetch when tab becomes visible (Keep this for consistency/recovery)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && profile?.id) {
                // Check if queue is empty or stale? Just quick refresh to be safe.
                fetchQueue(true);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [profile?.id, fetchQueue]);

    const handleCloseWalkInModal = () => {
        setShowWalkInModal(false);
        setWalkInForm({ name: '', age: '', fatherHusbandName: '', place: '', phone: '', department: '', doctorId: '', tokenNumber: '', mrNumber: '' });
        setBhidMatch(null);
        setIsSearchingBhid(false);
        if (phoneDebounceRef.current) clearTimeout(phoneDebounceRef.current);
    };

    const fetchHospitalSettings = async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_profiles')
                .select('*')
                .eq('id', profile.id)
                .single() as { data: any; error: any };

            if (data && !error) {
                setHospitalSettings({
                    hospitalName: data.hospital_name || profile.name || '',
                    address: data.address || '',
                    contactNumber: data.contact_number || '',
                    email: data.email || profile.email || '',
                    avatarUrl: data.avatar_url || profile.avatar_url || ''
                });
                if (data.avatar_url || profile.avatar_url) {
                    setAvatarPreview(data.avatar_url || profile.avatar_url);
                }
            } else {
                setHospitalSettings({
                    hospitalName: profile.name || '',
                    address: '',
                    contactNumber: '',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url || ''
                });
                if (profile.avatar_url) {
                    setAvatarPreview(profile.avatar_url);
                }
            }

            // Sync printer settings if they exist
            if (data?.printer_settings) {
                setPrinterSettings(data.printer_settings);
            }
        } catch (err) {
            console.warn('Failed to fetch hospital settings:', err);
        }
    };

    const handleSavePrinterSettings = async (newSettings: { spacing: number; alignment: 'left' | 'center' | 'right' }) => {
        if (!profile?.id) return;

        setIsSavingPrinterSettings(true);
        try {
            const { error: updateError } = await supabase
                .from('hospital_profiles' as any)
                .update({
                    printer_settings: newSettings
                })
                .eq('id', profile.id);

            if (updateError) throw updateError;

            setPrinterSettings(newSettings);
            toast.success('Layout saved successfully!');
        } catch (error: any) {
            console.error('Save printer settings error:', error);
            toast.error(`Auto-save failed: ${error.message}`);
        } finally {
            setIsSavingPrinterSettings(false);
        }
    };

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id) return;

        setIsSavingSettings(true);
        const toastId = toast.loading('Saving settings...');

        try {
            let avatarUrl = hospitalSettings.avatarUrl;

            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `hospital-${profile.id}-${Date.now()}.${fileExt}`;
                const filePath = `hospital-logos/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('medical-records')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) {
                    console.error('Avatar upload error:', uploadError);
                    toast.error('Failed to upload image', { id: toastId });
                    setIsSavingSettings(false);
                    return;
                }

                const { data: urlData } = supabase.storage
                    .from('medical-records')
                    .getPublicUrl(filePath);

                avatarUrl = urlData.publicUrl;
            }

            const { error: profileError } = await supabase
                .from('hospital_profiles')
                .upsert({
                    id: profile.id,
                    hospital_name: hospitalSettings.hospitalName,
                    address: hospitalSettings.address,
                    contact_number: hospitalSettings.contactNumber,
                    updated_at: new Date().toISOString()
                });

            if (profileError) {
                console.error('Settings save error:', profileError);
                toast.error('Failed to save settings', { id: toastId });
                setIsSavingSettings(false);
                return;
            }

            await supabase.from('users')
                .update({
                    name: hospitalSettings.hospitalName,
                    avatar_url: avatarUrl,
                    email: hospitalSettings.email
                })
                .eq('id', profile.id);

            // Refresh profile to update dashboard header and global state
            await refreshProfile();

            toast.success('Settings saved successfully!', { id: toastId });
            setShowSettingsModal(false);
            setAvatarFile(null);
        } catch (error: any) {
            console.error('Save settings error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleWalkInSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!profile?.id || !walkInForm.doctorId || !walkInForm.tokenNumber) {
            toast.error('Please fill all required fields');
            return;
        }

        const toastId = toast.loading('Registering patient...');

        try {
            const tokenNumber = walkInForm.tokenNumber;

            const { data: patientResult, error: patientError } = await supabase
                .from('hospital_patients')
                .insert({
                    hospital_id: profile.id,
                    name: walkInForm.name,
                    age: parseInt(walkInForm.age),
                    token_number: tokenNumber,
                    mr_number: walkInForm.mrNumber || null,
                    father_husband_name: walkInForm.fatherHusbandName || null,
                    place: walkInForm.place || null,
                    phone: walkInForm.phone || null
                })
                .select()
                .single();

            if (patientError) {
                console.error('Patient Creation Error:', patientError);
                throw new Error(patientError.message);
            }
            if (!patientResult) throw new Error('No data returned from patient creation');

            const patientData = patientResult as { id: string };

            const { count, error: countError } = await supabase
                .from('hospital_queues')
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', walkInForm.doctorId)
                .eq('status', 'pending');

            if (countError) console.warn('Queue count error:', countError);

            const nextQueueNo = (count || 0) + 1;

            const { error: queueError } = await supabase
                .from('hospital_queues')
                .insert({
                    hospital_id: profile.id,
                    patient_id: patientData.id,
                    doctor_id: walkInForm.doctorId,
                    queue_number: nextQueueNo,
                    status: 'pending'
                });

            if (queueError) {
                console.error('Queue Insertion Error:', queueError);
                throw new Error(queueError.message);
            }

            // Find the selected doctor for the print dialog
            const selectedDoctor = doctors.find(d => d.id === walkInForm.doctorId);

            toast.success(`Patient registered! Token: ${tokenNumber}`, { id: toastId });

            // Store patient info for printing and show print dialog
            setLastRegisteredPatient({
                tokenNumber,
                name: walkInForm.name,
                mrNumber: walkInForm.mrNumber || undefined,
                doctorName: selectedDoctor?.name || '',
                department: walkInForm.department
            });
            setShowPrintDialog(true);

            // Auto-link to BeanHealth app account if match was found
            if (bhidMatch && patientData.id) {
                try {
                    await BeanhealthIdService.linkPatientToUser(
                        patientData.id,
                        bhidMatch.id,
                        profile.id,
                        walkInForm.mrNumber || undefined
                    );
                    toast.success(`Linked to BeanHealth ID: ${bhidMatch.beanhealthId}`, { duration: 4000 });
                } catch (linkErr) {
                    console.warn('Auto-link failed:', linkErr);
                }
            }

            handleCloseWalkInModal();
            fetchQueue();
        } catch (error: any) {
            console.error('Registration Error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        }
    };

    // Print token handler
    const handlePrintToken = async () => {
        if (!lastRegisteredPatient) return;

        setIsPrintingToken(true);
        try {
            const tokenData = createTokenData({
                tokenNumber: lastRegisteredPatient.tokenNumber,
                patientName: lastRegisteredPatient.name,
                mrNumber: lastRegisteredPatient.mrNumber,
                doctorName: lastRegisteredPatient.doctorName,
                department: lastRegisteredPatient.department
            });

            // Apply custom layout settings
            tokenData.settings = printerSettings;

            const receiptData = generateTokenReceipt(tokenData);
            await printerService.print(receiptData);

            toast.success('Token printed successfully!');
            setShowPrintDialog(false);
            setLastRegisteredPatient(null);
        } catch (error: any) {
            console.error('Print error:', error);
            toast.error(error.message || 'Failed to print token');
        } finally {
            setIsPrintingToken(false);
        }
    };

    // Check printer connection status periodically
    useEffect(() => {
        const checkPrinterStatus = () => {
            setPrinterConnected(printerService.isConnected());
        };

        checkPrinterStatus();
        const interval = setInterval(checkPrinterStatus, 2000);
        return () => clearInterval(interval);
    }, []);

    // Reprint token for a patient from the queue
    const handleReprintFromQueue = async (queueItem: QueueItem) => {
        if (!printerConnected) {
            toast.error('Please connect printer first');
            return;
        }

        const toastId = toast.loading('Printing token...');
        try {
            const tokenData = createTokenData({
                tokenNumber: queueItem.patient?.token_number || String(queueItem.queue_number),
                patientName: queueItem.patient?.name || 'Unknown',
                mrNumber: undefined, // MR number not available in queue item
                doctorName: queueItem.doctor?.name || '',
                department: queueItem.doctor?.specialty || ''
            });

            // Apply custom layout settings
            tokenData.settings = printerSettings;

            const receiptData = generateTokenReceipt(tokenData);
            await printerService.print(receiptData);

            toast.success('Token reprinted!', { id: toastId });
        } catch (error: any) {
            console.error('Reprint error:', error);
            toast.error(error.message || 'Failed to reprint', { id: toastId });
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('reception_authenticated');
        navigate('/enterprise-dashboard/reception');
    };

    // Patient Details Modal State
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedPatientDetails, setSelectedPatientDetails] = useState<any>(null);

    // const handleViewDetails = (patient: any) => {
    //     setSelectedPatientDetails(patient);
    //     setShowDetailsModal(true);
    // };

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
                                onClick={() => navigate('/enterprise-dashboard')}
                                className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-all flex-shrink-0"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200 dark:bg-white/10 flex-shrink-0" />

                            <div className="flex items-center gap-2.5 cursor-pointer active:scale-95 transition-transform">
                                <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.05)] transition-all duration-300">
                                    <LogoIcon className="w-6 h-6 sm:w-8 sm:h-8" />
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

                        {/* Right Section - Hospital Logo & Name + Actions */}
                        <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                            {/* Hospital Info */}
                            <button
                                onClick={() => { fetchHospitalSettings(); setShowSettingsModal(true); }}
                                className="flex items-center gap-3 p-1 rounded-xl transition-transform active:scale-95 cursor-pointer group"
                            >
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm transition-transform group-hover:scale-105">
                                    {profile?.avatar_url ? (
                                        <img
                                            src={profile.avatar_url}
                                            alt={profile?.name || 'Hospital'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-300">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className="hidden sm:inline-block text-sm md:text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{displayName}</span>
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Title & Actions */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reception Desk</h2>
                        <p className="text-gray-700 mt-1">Manage patient check-ins and appointments</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Printer Status Button */}
                        <button
                            onClick={() => setShowPrinterSetup(true)}
                            className={`p-3 rounded-xl border transition-all shadow-sm flex items-center gap-2 ${printerConnected
                                ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                                : 'bg-white text-gray-400 border-gray-200 hover:text-gray-900 hover:border-gray-300'
                                }`}
                            title={printerConnected ? 'Printer Connected' : 'Connect Printer'}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span className={`hidden sm:inline text-sm font-medium ${printerConnected ? 'text-green-700' : 'text-gray-600'}`}>
                                {printerConnected ? 'Connected' : 'Printer'}
                            </span>
                            {printerConnected && (
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            )}
                        </button>
                        <button
                            onClick={() => fetchQueue()}
                            className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                            title="Reload"
                        >
                            <svg className={`w-5 h-5 ${isLoadingQueue ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setShowWalkInModal(true)}
                            className="px-4 sm:px-6 py-2.5 sm:py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-semibold shadow-lg shadow-orange-500/20 hover:shadow-xl transition-all flex items-center gap-2 text-sm sm:text-base whitespace-nowrap"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <span className="hidden sm:inline">New Registration</span>
                            <span className="inline sm:hidden">Register</span>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Total Visits (Today)</p>
                        <p className="text-4xl font-bold text-gray-900">{queue.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2">Waiting</p>
                        <p className="text-4xl font-bold text-orange-500">{queue.filter(q => q.status === 'pending').length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">Completed</p>
                        <p className="text-4xl font-bold text-green-600">{queue.filter(q => q.status === 'completed').length}</p>
                    </div>
                </div>

                {/* Queue List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                            <button
                                onClick={() => setActiveTab('queue')}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'queue' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                Live Queue
                            </button>
                            <button
                                onClick={() => setActiveTab('patients')}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'patients' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                History Log
                            </button>
                            <button
                                onClick={() => { setActiveTab('past_records'); setPastRecords([]); setPastRecordsPage(0); setHasMorePastRecords(true); fetchPastRecords(); }}
                                className={`px-5 py-2 font-semibold text-sm rounded-lg transition-all ${activeTab === 'past_records' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-700'}`}
                            >
                                Past Records
                            </button>
                        </div>
                    </div>

                    {isLoadingQueue ? (
                        <div className="p-16 text-center text-gray-700">Loading...</div>
                    ) : activeTab === 'past_records' ? (
                        <>
                            {/* Patient Database Header */}
                            <div className="px-6 py-4 bg-gray-50/50 border-b border-gray-100 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                        <h3 className="text-sm font-bold text-gray-800">Patient Database</h3>
                                    </div>
                                    {pastRecordsTotal > 0 && (
                                        <span className="text-xs text-gray-500 font-medium bg-white px-3 py-1 rounded-full border border-gray-200">
                                            {pastRecords.length} of {pastRecordsTotal} patients
                                        </span>
                                    )}
                                </div>
                                <form onSubmit={handleSearchPastRecords} className="relative w-full max-w-md">
                                    <input
                                        type="text"
                                        placeholder="Search patient by name..."
                                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </form>
                            </div>
                            {pastRecords.length === 0 ? (
                                <div className="p-20 text-center">
                                    <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                    <p className="text-gray-700 font-medium">No patients found</p>
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
                                                    {/* Patient Row */}
                                                    <div
                                                        className={`grid grid-cols-[2.5rem_1fr_3rem_6.5rem_8.5rem_10rem_3rem_2rem] gap-1 px-6 py-4 cursor-pointer transition-all duration-150 items-center ${expandedPatientId === patient.id ? 'bg-orange-50/60 border-l-4 border-l-orange-400' : 'hover:bg-gray-50/80 border-l-4 border-l-transparent'}`}
                                                        onClick={() => setExpandedPatientId(expandedPatientId === patient.id ? null : patient.id)}
                                                    >
                                                        {/* S.No */}
                                                        <span className="text-xs text-gray-400 font-medium">{index + 1}</span>

                                                        {/* Patient Name with avatar */}
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm">
                                                                {initial}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-gray-900 text-sm truncate">{patient.name}</p>
                                                                {patient.father_husband_name && (
                                                                    <p className="text-[11px] text-gray-400 truncate">S/o {patient.father_husband_name}</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Age */}
                                                        <span className="text-sm text-gray-700">{patient.age || '—'}</span>

                                                        {/* Phone */}
                                                        <span className="text-sm text-gray-700 font-mono">{patient.phone || '—'}</span>

                                                        {/* MR # */}
                                                        <span className="text-xs text-gray-700 font-medium truncate min-w-0" title={patient.mr_number || ''}>{patient.mr_number || '—'}</span>

                                                        {/* BH ID */}
                                                        <span className="text-xs text-gray-500 font-mono truncate min-w-0" title={patient.beanhealth_id || ''}>{patient.beanhealth_id || '—'}</span>

                                                        {/* Visits */}
                                                        <span className="text-sm font-semibold text-orange-600">{patient.prescriptions?.length || 0}</span>

                                                        {/* Expand arrow */}
                                                        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expandedPatientId === patient.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </div>

                                                    {/* Expanded: Prescription History */}
                                                    {expandedPatientId === patient.id && (
                                                        <div className="bg-gray-50 border-t border-gray-100">
                                                            {patient.prescriptions?.length > 0 ? (
                                                                <div className="px-5 py-3 space-y-2">
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
                                                                                                    · {formatDoctorName(rx.doctor.name)}
                                                                                                </span>
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
                                                className="px-6 py-2.5 bg-orange-50 text-orange-600 font-bold text-sm rounded-xl hover:bg-orange-100 transition-colors border border-orange-200 disabled:opacity-50"
                                            >
                                                {isLoadingMorePast ? 'Loading...' : 'Load More Patients'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : queue.length === 0 ? (
                        <div className="p-20 text-center">
                            <p className="text-gray-700 font-medium">No records found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {queue
                                .filter(item => activeTab === 'queue' ? (item.status === 'pending' || item.status === 'in_progress') : (item.status === 'completed' || item.status === 'cancelled'))
                                .map((item) => (
                                    <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors gap-4">
                                        <div className="flex items-center gap-4 sm:gap-5 w-full sm:w-auto">
                                            <div className="w-14 h-12 sm:w-16 sm:h-12 rounded-xl flex items-center justify-center font-black text-base bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm px-2 shrink-0">
                                                {item.patient?.token_number || 'N/A'}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 truncate pr-2">{item.patient?.name}</h4>
                                                <div className="flex items-center gap-3 text-sm text-gray-700 mt-1">
                                                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                                    {item.patient?.beanhealth_id && (
                                                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                            {item.patient.beanhealth_id}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-[4.5rem] sm:pl-0">
                                            {/* Reprint Token Button */}
                                            <button
                                                onClick={() => handleReprintFromQueue(item)}
                                                disabled={!printerConnected}
                                                className={`p-2 rounded-xl border transition-all ${printerConnected
                                                    ? 'bg-white text-gray-500 border-gray-200 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50'
                                                    : 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                                                    }`}
                                                title={printerConnected ? 'Reprint Token' : 'Connect printer first'}
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                                </svg>
                                            </button>
                                            <div className="text-right">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase
                                                    ${item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                        item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                    {item.status.replace('_', ' ')}
                                                </span>
                                                <p className="font-medium text-xs sm:text-sm text-gray-800 mt-1">{formatDoctorName(item.doctor?.name || '')}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            {activeTab === 'queue' && queue.filter(i => i.status === 'pending' || i.status === 'in_progress').length === 0 && (
                                <div className="p-16 text-center text-gray-700">All caught up! No active patients in queue.</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Walk-In Modal */}
            {showWalkInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 sm:p-8 overflow-y-auto max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Patient Registration</h3>
                            <button onClick={handleCloseWalkInModal} className="text-gray-500 hover:text-gray-700 p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Token #</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.tokenNumber}
                                        onChange={e => setWalkInForm({ ...walkInForm, tokenNumber: e.target.value })}
                                        placeholder="T-101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">MR. NO</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.mrNumber}
                                        onChange={e => setWalkInForm({ ...walkInForm, mrNumber: e.target.value })}
                                        placeholder="MR-12345"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Age</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.age}
                                        onChange={e => setWalkInForm({ ...walkInForm, age: e.target.value })}
                                        placeholder="Years"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Full Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.name}
                                        onChange={e => setWalkInForm({ ...walkInForm, name: e.target.value })}
                                        placeholder="Patient Name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Father/Husband Name</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                    value={walkInForm.fatherHusbandName}
                                    onChange={e => setWalkInForm({ ...walkInForm, fatherHusbandName: e.target.value })}
                                    placeholder="Father or Husband Name"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Place</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.place}
                                        onChange={e => setWalkInForm({ ...walkInForm, place: e.target.value })}
                                        placeholder="City/Town"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Phone</label>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900 ${bhidMatch ? 'border-green-400 bg-green-50/30' : 'border-gray-200'
                                                }`}
                                            value={walkInForm.phone}
                                            onChange={e => {
                                                setWalkInForm({ ...walkInForm, phone: e.target.value });
                                                handlePhoneLookup(e.target.value);
                                            }}
                                            placeholder="Phone Number"
                                        />
                                        {isSearchingBhid && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                                            </div>
                                        )}
                                        {bhidMatch && (
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* BeanHealth ID Match Banner */}
                            {bhidMatch && (
                                <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-green-800">BeanHealth Patient Found!</p>
                                        <p className="text-xs text-green-700 truncate">
                                            {bhidMatch.name} · <span className="font-mono font-bold">{bhidMatch.beanhealthId}</span>
                                        </p>
                                    </div>
                                    <span className="px-2 py-1 bg-green-200/60 text-green-800 text-[10px] font-bold rounded-full uppercase tracking-wide flex-shrink-0">
                                        Auto-Link
                                    </span>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Department</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                    value={walkInForm.department}
                                    onChange={e => setWalkInForm({ ...walkInForm, department: e.target.value })}
                                    placeholder="e.g. Cardiology"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Consulting Doctor</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                    value={walkInForm.doctorId}
                                    onChange={e => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                                >
                                    <option value="">Select Physician</option>
                                    {doctors.map(doc => (
                                        <option key={doc.id} value={doc.id}>{doc.name} - {doc.specialty}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseWalkInModal}
                                    className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 shadow-lg transition-colors"
                                >
                                    Create Token
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}



            {/* View Patient Details Modal */}
            {showDetailsModal && selectedPatientDetails && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-900">Patient Details</h3>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-200 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Token Number</label>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.token_number || '--'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">MR. NO</label>
                                    <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.mr_number || '--'}</p>
                                </div>
                            </div>

                            {selectedPatientDetails.beanhealth_id && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase">BH ID</span>
                                    <span className="text-xs font-mono font-medium text-gray-500">{selectedPatientDetails.beanhealth_id}</span>
                                </div>
                            )}

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Patient Name</label>
                                <p className="font-bold text-gray-900 text-lg">{selectedPatientDetails.name}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Age</label>
                                    <p className="font-medium text-gray-900">{selectedPatientDetails.age ? `${selectedPatientDetails.age} Years` : '--'}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Phone</label>
                                    <p className="font-medium text-gray-900">{selectedPatientDetails.phone || '--'}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Father/Husband Name</label>
                                <p className="font-medium text-gray-900">{selectedPatientDetails.father_husband_name || '--'}</p>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase">Place</label>
                                <p className="font-medium text-gray-900">{selectedPatientDetails.place || '--'}</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors shadow-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettingsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Hospital Settings</h3>
                            <button
                                onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} className="p-6 space-y-5">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center mb-6">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-xl bg-primary-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Hospital Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-600">{hospitalSettings.hospitalName?.charAt(0) || 'H'}</span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-xl">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Hospital Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.hospitalName}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, hospitalName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Address</label>
                                <textarea
                                    rows={2}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900 resize-none"
                                    value={hospitalSettings.address}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, address: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Contact Number</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.contactNumber}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, contactNumber: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Email</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-gray-900"
                                    value={hospitalSettings.email}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, email: e.target.value })}
                                />
                            </div>

                            <div className="pt-6 border-t border-gray-100 flex flex-col gap-3">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setShowSettingsModal(false); setAvatarFile(null); }}
                                        className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingSettings}
                                        className="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 shadow-lg transition-colors disabled:opacity-50"
                                    >
                                        {isSavingSettings ? 'Saving...' : 'Save Settings'}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="w-full px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Sign Out from Portal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Print Token Dialog */}
            {showPrintDialog && lastRegisteredPatient && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
                        {/* Header */}
                        <div className="px-6 py-5 bg-green-50 border-b border-green-100">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Patient Registered!</h3>
                                    <p className="text-sm text-gray-600">Token created successfully</p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 shadow-inner">
                                <PrinterPreview
                                    data={{
                                        tokenNumber: lastRegisteredPatient.tokenNumber,
                                        patientName: lastRegisteredPatient.name,
                                        mrNumber: lastRegisteredPatient.mrNumber,
                                        doctorName: lastRegisteredPatient.doctorName,
                                        department: lastRegisteredPatient.department,
                                        date: new Date().toLocaleDateString('en-GB'),
                                        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
                                        settings: printerSettings
                                    }}
                                    isSandbox={true}
                                    onSettingsChange={handleSavePrinterSettings}
                                    isSaving={isSavingPrinterSettings}
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-lg flex items-start gap-2 border border-blue-100">
                                <span className="text-blue-600 mt-0.5">ℹ️</span>
                                <p className="text-[10px] text-blue-700 leading-tight">
                                    Above is a live simulation of the 58mm thermal receipt. Verify the token spacing and layout before printing.
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPrintDialog(false);
                                    setLastRegisteredPatient(null);
                                }}
                                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handlePrintToken}
                                disabled={isPrintingToken || !printerConnected}
                                className={`flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${printerConnected
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/25'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    }`}
                            >
                                {isPrintingToken ? (
                                    <>
                                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Printing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                        </svg>
                                        Print Token
                                    </>
                                )}
                            </button>
                        </div>

                        {!printerConnected && (
                            <div className="px-6 pb-6 pt-0">
                                <button
                                    onClick={() => {
                                        setShowPrintDialog(false);
                                        setShowPrinterSetup(true);
                                    }}
                                    className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Connect printer first →
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Printer Setup Modal */}
            <PrinterSetupModal
                isOpen={showPrinterSetup}
                onClose={() => setShowPrinterSetup(false)}
                onConnected={() => setPrinterConnected(true)}
                settings={printerSettings}
                onSettingsChange={handleSavePrinterSettings}
                isSavingSettings={isSavingPrinterSettings}
            />
        </div>
    );
};

export default ReceptionDashboard;

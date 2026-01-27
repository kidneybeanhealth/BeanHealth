import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { LogoIcon } from '../icons/LogoIcon';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
}

interface QueueItem {
    id: string;
    patient_id: string;
    doctor_id: string;
    queue_number: number;
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    patient: {
        name: string;
        age: number;
        token_number: string;
    };
    doctor: {
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

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [activeTab, setActiveTab] = useState<'queue' | 'patients'>('queue');

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
        tokenNumber: ''
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
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('hospital_id', profile.id)
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
        }
    }, [profile?.id, fetchDoctors, fetchQueue]);

    // Fetch single item for realtime inserts
    const fetchSingleQueueItem = async (id: string) => {
        try {
            const { data, error } = await supabase
                .from('hospital_queues' as any)
                .select(`
                    *,
                    patient:hospital_patients!hospital_queues_patient_id_fkey(*),
                    doctor:hospital_doctors(*)
                `)
                .eq('id', id)
                .single();

            if (data && !error) {
                setQueue(prev => {
                    if (prev.find(item => item.id === data.id)) return prev; // already exists
                    return [data as any, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
                        setQueue(prev => prev.map(item => {
                            if (item.id === payload.new.id) {
                                return { ...item, ...payload.new };
                            }
                            return item;
                        }));
                    } else if (payload.eventType === 'DELETE') {
                        // Remove item
                        setQueue(prev => prev.filter(item => item.id !== payload.old.id));
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
        setWalkInForm({ name: '', age: '', fatherHusbandName: '', place: '', phone: '', department: '', doctorId: '', tokenNumber: '' });
    };

    const fetchHospitalSettings = async () => {
        if (!profile?.id) return;
        try {
            const { data, error } = await supabase
                .from('hospital_profiles' as any)
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
        } catch (err) {
            console.warn('Failed to fetch hospital settings:', err);
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

            const { error: profileError } = await (supabase
                .from('hospital_profiles' as any)
                .upsert({
                    id: profile.id,
                    hospital_name: hospitalSettings.hospitalName,
                    address: hospitalSettings.address,
                    contact_number: hospitalSettings.contactNumber,
                    updated_at: new Date().toISOString()
                } as any) as any);

            if (profileError) {
                console.error('Settings save error:', profileError);
                toast.error('Failed to save settings', { id: toastId });
                setIsSavingSettings(false);
                return;
            }

            await (supabase.from('users') as any)
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
                .from('hospital_patients' as any)
                .insert({
                    hospital_id: profile.id,
                    name: walkInForm.name,
                    age: parseInt(walkInForm.age),
                    token_number: tokenNumber,
                    father_husband_name: walkInForm.fatherHusbandName || null,
                    place: walkInForm.place || null,
                    phone: walkInForm.phone || null
                } as any)
                .select()
                .single();

            if (patientError) {
                console.error('Patient Creation Error:', patientError);
                throw new Error(patientError.message);
            }
            if (!patientResult) throw new Error('No data returned from patient creation');

            const patientData = patientResult as { id: string };

            const { count, error: countError } = await supabase
                .from('hospital_queues' as any)
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', walkInForm.doctorId)
                .eq('status', 'pending');

            if (countError) console.warn('Queue count error:', countError);

            const nextQueueNo = (count || 0) + 1;

            const { error: queueError } = await supabase
                .from('hospital_queues' as any)
                .insert({
                    hospital_id: profile.id,
                    patient_id: patientData.id,
                    doctor_id: walkInForm.doctorId,
                    queue_number: nextQueueNo,
                    status: 'pending'
                } as any);

            if (queueError) {
                console.error('Queue Insertion Error:', queueError);
                throw new Error(queueError.message);
            }

            toast.success(`Patient registered! Token: ${tokenNumber}`, { id: toastId });
            handleCloseWalkInModal();
            fetchQueue();
        } catch (error: any) {
            console.error('Registration Error:', error);
            toast.error(`Failed: ${error.message || 'Unknown error'}`, { id: toastId });
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('reception_authenticated');
        navigate('/enterprise-dashboard/reception');
    };

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
                                <span className="hidden sm:inline-block text-sm md:text-base font-bold text-gray-900 dark:text-white whitespace-nowrap">{profile?.name || 'Hospital'}</span>
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
                            className="px-6 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-semibold shadow-lg shadow-orange-500/20 hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            New Registration
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Total Visits</p>
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
                        </div>
                    </div>

                    {isLoadingQueue ? (
                        <div className="p-16 text-center text-gray-700">Loading queue...</div>
                    ) : queue.length === 0 ? (
                        <div className="p-20 text-center">
                            <p className="text-gray-700 font-medium">No records found</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {queue
                                .filter(item => activeTab === 'queue' ? (item.status === 'pending' || item.status === 'in_progress') : true)
                                .map((item) => (
                                    <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                        <div className="flex items-center gap-5">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg
                                                ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                    item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {item.queue_number}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{item.patient?.name}</h4>
                                                <div className="flex items-center gap-3 text-sm text-gray-700 mt-1">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">Token: {item.patient?.token_number}</span>
                                                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase
                                                ${item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                    item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                            <p className="font-medium text-sm text-gray-800 mt-1">{formatDoctorName(item.doctor?.name || '')}</p>
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
                                    <input
                                        type="tel"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-gray-900"
                                        value={walkInForm.phone}
                                        onChange={e => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                                        placeholder="Phone Number"
                                    />
                                </div>
                            </div>
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
        </div>
    );
};

export default ReceptionDashboard;

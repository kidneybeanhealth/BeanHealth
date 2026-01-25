import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

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

const ReceptionDashboard: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [activeTab, setActiveTab] = useState<'queue' | 'patients'>('queue');

    // Walk-in Modal
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [walkInForm, setWalkInForm] = useState({
        name: '',
        age: '',
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

    // Realtime subscription for queue updates with error handling
    useEffect(() => {
        if (!profile?.id) return;

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
                (payload) => {
                    console.log('Reception queue update:', payload.eventType);
                    fetchQueue(true);
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
                    console.log('Doctors list updated');
                    fetchDoctors();
                }
            )
            .subscribe((status, err) => {
                console.log('Reception realtime status:', status);
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error('Reception realtime error:', err);
                    // Attempt to refetch data after connection error
                    setTimeout(() => {
                        fetchQueue(true);
                        fetchDoctors();
                    }, 3000);
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, fetchQueue, fetchDoctors]);

    // Periodic health check - refresh data every 60 seconds when tab is visible
    useEffect(() => {
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible' && profile?.id) {
                console.log('Periodic health check - refreshing reception data...');
                fetchQueue(true);
            }
        }, 60000); // Every 60 seconds
        return () => clearInterval(interval);
    }, [profile?.id, fetchQueue]);

    // Refetch when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && profile?.id) {
                console.log('Tab visible, refreshing reception data...');
                fetchQueue(true);
                fetchDoctors();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [profile?.id, fetchQueue, fetchDoctors]);

    const handleCloseWalkInModal = () => {
        setShowWalkInModal(false);
        setWalkInForm({ name: '', age: '', department: '', doctorId: '', tokenNumber: '' });
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
                if (data.avatar_url) {
                    setAvatarPreview(data.avatar_url);
                }
            } else {
                setHospitalSettings({
                    hospitalName: profile.name || '',
                    address: '',
                    contactNumber: '',
                    email: profile.email || '',
                    avatarUrl: profile.avatar_url || ''
                });
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
                    token_number: tokenNumber
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Main Header Row */}
                    <div className="h-16 md:h-18 flex items-center justify-between">
                        {/* Left Section - Back + BeanHealth Logo & Enterprise Tagline */}
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate('/enterprise-dashboard')}
                                className="p-2 -ml-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all"
                                title="Back to Dashboard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <div className="w-px h-8 bg-gray-200" />
                            <img 
                                src="/beanhealth-logo.png" 
                                alt="BeanHealth" 
                                className="h-14 w-14 object-contain"
                            />
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 leading-tight tracking-tight">BeanHealth</h1>
                                <p className="text-sm font-semibold tracking-widest uppercase text-green-600">ENTERPRISE</p>
                            </div>
                        </div>

                        {/* Right Section - Hospital Logo & Name + Actions */}
                        <div className="flex items-center gap-4">
                            {/* Hospital Info */}
                            <div className="hidden sm:flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 bg-white">
                                    {profile?.avatar_url ? (
                                        <img 
                                            src={profile.avatar_url} 
                                            alt={profile?.name || 'Hospital'} 
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-sm font-bold text-gray-700">
                                            {profile?.name?.charAt(0) || 'H'}
                                        </span>
                                    )}
                                </div>
                                <span className="text-sm font-semibold text-gray-900">{profile?.name || 'Hospital'}</span>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { fetchHospitalSettings(); setShowSettingsModal(true); }}
                                    className="p-2 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-all"
                                    title="Settings"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all"
                                    title="Logout from Reception"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
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
                                            <p className="font-medium text-sm text-gray-800 mt-1">Dr. {item.doctor?.name}</p>
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
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-gray-900">Patient Registration</h3>
                            <button onClick={handleCloseWalkInModal} className="text-gray-500 hover:text-gray-700">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
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

                            <div className="pt-4 flex gap-3">
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
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReceptionDashboard;

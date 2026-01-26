import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams, Routes, Route } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import EnterpriseDoctorDashboard from './EnterpriseDoctorDashboard';
import EnterprisePharmacyDashboard from './EnterprisePharmacyDashboard';

type Department = 'reception' | 'pharmacy' | 'doctor';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
    avatar_url?: string;
    access_code: string;
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

// Session timeout: 4 hours
const DOCTOR_SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

const EnterpriseDashboardMain: React.FC = () => {
    const { signOut, profile } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Extract doctor ID from URL path (e.g., /enterprise-dashboard/doctors/abc123)
    const getDoctorIdFromUrl = (): string | null => {
        const match = location.pathname.match(/\/enterprise-dashboard\/doctors\/([^/]+)/);
        return match ? match[1] : null;
    };
    const doctorIdFromUrl = getDoctorIdFromUrl();

    // Session storage key (scoped per hospital)
    const getSessionKey = () => `enterprise_doctor_session_${profile?.id}`;

    // Determine current view from URL path
    const getCurrentViewFromPath = (): 'selection' | Department | 'doctor_dashboard' => {
        const path = location.pathname;
        if (path.includes('/reception')) return 'reception';
        if (path.includes('/pharmacy')) return 'pharmacy';
        if (path.includes('/doctors/')) return 'doctor_dashboard';
        if (path.includes('/doctors')) return 'doctor';
        return 'selection';
    };

    const [currentView, setCurrentView] = useState<'selection' | Department | 'doctor_dashboard'>(getCurrentViewFromPath());
    const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
    const [selectedDeptForAuth, setSelectedDeptForAuth] = useState<Department | null>(null);
    const [selectedDoctorForAuth, setSelectedDoctorForAuth] = useState<DoctorProfile | null>(null);
    const [passwordInput, setPasswordInput] = useState('');

    // Data States
    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [activeDoctor, setActiveDoctor] = useState<DoctorProfile | null>(null);
    const [activeTab, setActiveTab] = useState<'queue' | 'patients'>('queue');

    // Modal States
    const [showWalkInModal, setShowWalkInModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [walkInForm, setWalkInForm] = useState({
        name: '',
        age: '',
        department: '',
        doctorId: '',
        tokenNumber: ''
    });
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

    // Loading States
    const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);

    // Initial Fetch
    useEffect(() => {
        if (profile?.id) {
            // Pre-fetch doctors as they are needed for multiple views
            fetchDoctors();
        }
    }, [profile?.id]);

    // Restore doctor session from sessionStorage on page reload
    useEffect(() => {
        if (!doctorIdFromUrl || activeDoctor || !profile?.id || doctors.length === 0) return;

        const sessionKey = getSessionKey();
        const savedSession = sessionStorage.getItem(sessionKey);

        if (savedSession) {
            try {
                const { doctorId, timestamp } = JSON.parse(savedSession);
                const isValid = doctorId === doctorIdFromUrl &&
                    (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

                if (isValid) {
                    // Find and restore the doctor
                    const doctor = doctors.find(d => d.id === doctorIdFromUrl);
                    if (doctor) {
                        console.log('[EnterpriseDashboard] Restoring doctor session for:', doctor.name);
                        setActiveDoctor(doctor);
                        setCurrentView('doctor_dashboard');
                        return;
                    }
                } else {
                    // Session expired or invalid, clear it
                    sessionStorage.removeItem(sessionKey);
                }
            } catch (e) {
                console.error('[EnterpriseDashboard] Error parsing saved session:', e);
                sessionStorage.removeItem(sessionKey);
            }
        }

        // No valid session - prompt for authentication
        const doctor = doctors.find(d => d.id === doctorIdFromUrl);
        if (doctor) {
            console.log('[EnterpriseDashboard] No valid session, prompting auth for:', doctor.name);
            setSelectedDoctorForAuth(doctor);
            setShowAuthModal(true);
        } else {
            // Doctor not found, redirect to doctor list
            console.log('[EnterpriseDashboard] Doctor not found, redirecting to list');
            navigate('/enterprise-dashboard/doctors');
            setCurrentView('doctor');
        }
    }, [doctorIdFromUrl, doctors, activeDoctor, profile?.id]);

    useEffect(() => {
        if (currentView === 'doctor') {
            // This was the original useEffect for doctors, now it's redundant due to the above,
            // but keeping it for now as per instruction to avoid breaking existing logic if any.
            // The above useEffect handles initial fetch.
        }
    }, [currentView]);

    useEffect(() => {
        if (currentView === 'reception') {
            fetchQueue();
        }
    }, [currentView]);

    // Realtime subscription for reception queue updates
    useEffect(() => {
        if (!profile?.id || currentView !== 'reception') return;

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
                    console.log('[Reception Dashboard] Queue update received:', payload.eventType);
                    fetchQueue();
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    console.log('[Reception Dashboard] Realtime connected');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, currentView]);

    const fetchDoctors = async () => {
        if (!profile?.id) return;
        setIsLoadingDoctors(true);
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('is_active', true);

            if (error) throw error;
            setDoctors(data || []);
        } catch (error) {
            console.error('Error fetching doctors:', error);
            toast.error('Failed to load doctors list');
        } finally {
            setIsLoadingDoctors(false);
        }
    };

    const fetchQueue = async () => {
        if (!profile?.id) return;
        setIsLoadingQueue(true);
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
            toast.error('Failed to update queue');
        } finally {
            setIsLoadingQueue(false);
        }
    };

    // Handlers - Now using URL navigation
    const handleDeptClick = (dept: Department) => {
        if (dept === 'doctor') {
            // For doctor, navigate to doctor list URL
            navigate('/enterprise-dashboard/doctors');
            setCurrentView('doctor');
        } else {
            // Reception & Pharmacy require department password
            setSelectedDeptForAuth(dept);
            setSelectedDoctorForAuth(null);
            setPasswordInput('');
            setShowAuthModal(true);
        }
    };

    const handleDoctorClick = (doctor: DoctorProfile) => {
        setSelectedDoctorForAuth(doctor);
        setSelectedDeptForAuth(null); // Clear department selection
        setPasswordInput('');
        setShowAuthModal(true);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Handle Individual Doctor Login
        if (selectedDoctorForAuth) {
            if (passwordInput === selectedDoctorForAuth.access_code) {
                // Persist doctor session to sessionStorage
                const sessionKey = getSessionKey();
                sessionStorage.setItem(sessionKey, JSON.stringify({
                    doctorId: selectedDoctorForAuth.id,
                    timestamp: Date.now()
                }));

                setActiveDoctor(selectedDoctorForAuth);
                setCurrentView('doctor_dashboard');
                // Navigate to doctor-specific URL
                navigate(`/enterprise-dashboard/doctors/${selectedDoctorForAuth.id}`);
                setShowAuthModal(false);
                toast.success(`Welcome Dr. ${selectedDoctorForAuth.name.split(' ')[1]}`);
            } else {
                toast.error('Invalid Passcode');
            }
            return;
        }

        // Handle Department Login
        if (!selectedDeptForAuth) return;

        const passwords = {
            'reception': 'reception@123',
            'pharmacy': 'pharmacy@123',
            'doctor': ''
        };

        if (passwordInput === passwords[selectedDeptForAuth]) {
            setCurrentView(selectedDeptForAuth);
            // Navigate to department URL
            navigate(`/enterprise-dashboard/${selectedDeptForAuth}`);
            setShowAuthModal(false);
            toast.success(`Access Granted`);
        } else {
            toast.error('Invalid Password');
        }
    };

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
                // Use profile data as fallback
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

            // Upload avatar if a new file is selected
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

            // Update hospital_profiles table (only columns that exist in schema)
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

            // Update the main users table with name and avatar
            await (supabase
                .from('users') as any)
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
            // Use manual token number
            const tokenNumber = walkInForm.tokenNumber;

            // 2. Create Patient
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

            // Cast to ensure TS knows it has an ID (since we used 'any' on table)
            const patientData = patientResult as { id: string };

            // 3. Calculate Queue Number (Count existing pending for this doctor)
            const { count, error: countError } = await supabase
                .from('hospital_queues' as any)
                .select('*', { count: 'exact', head: true })
                .eq('doctor_id', walkInForm.doctorId)
                .eq('status', 'pending');

            if (countError) console.warn('Queue count error:', countError); // Non-fatal

            const nextQueueNo = (count || 0) + 1;

            // 4. Add to Queue
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

    // Renderers
    const renderSelectionScreen = () => (
        <div className="max-w-7xl mx-auto px-6 py-16 md:py-24">
            <div className="text-center mb-16 max-w-3xl mx-auto">
                <span className="inline-block text-secondary-600 font-semibold tracking-wider text-sm uppercase mb-4">Enterprise Portal</span>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight" style={{ color: '#000000' }}>{profile?.name || 'Select your workspace'}</h2>
                <p className="text-lg md:text-xl leading-relaxed" style={{ color: '#333333' }}>
                    Welcome to the BeanHealth Enterprise Suite. Secure, efficient, and integrated management for your healthcare facility.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                {[
                    {
                        id: 'reception',
                        title: 'Reception',
                        desc: 'Patient registration, check-ins, and queue management.',
                        icon: (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        ),
                        bgColor: 'bg-orange-50',
                        iconColor: 'text-orange-600',
                        hoverRing: 'hover:ring-orange-100'
                    },
                    {
                        id: 'pharmacy',
                        title: 'Pharmacy',
                        desc: 'Prescription fulfillment, inventory, and dispensing logs.',
                        icon: (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        ),
                        bgColor: 'bg-rose-50',
                        iconColor: 'text-rose-600',
                        hoverRing: 'hover:ring-rose-100'
                    },
                    {
                        id: 'doctor',
                        title: 'Doctors',
                        desc: 'Clinical dashboards, consultation tools, and patient history.',
                        icon: (
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        ),
                        bgColor: 'bg-secondary-50',
                        iconColor: 'text-secondary-600',
                        hoverRing: 'hover:ring-secondary-100'
                    }
                ].map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleDeptClick(item.id as any)}
                        className={`group bg-white p-8 md:p-10 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ease-out text-left flex flex-col h-full ring-1 ring-transparent ${item.hoverRing} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2`}
                    >
                        <div className={`w-14 h-14 ${item.bgColor} ${item.iconColor} rounded-xl flex items-center justify-center mb-6 group-hover:scale-105 transition-transform duration-300`}>
                            {item.icon}
                        </div>
                        <h3 className="text-2xl font-bold mb-3" style={{ color: '#000000' }}>{item.title}</h3>
                        <p className="leading-relaxed mb-auto text-base" style={{ color: '#333333' }}>{item.desc}</p>
                        <div className="mt-8 flex items-center text-sm font-semibold opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: '#000000' }}>
                            Enter Workspace <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderDoctorList = () => (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="mb-12">
                <button
                    onClick={() => { navigate('/enterprise-dashboard'); setCurrentView('selection'); }}
                    className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 mb-6 transition-colors focus:outline-none focus:underline"
                >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Back to Departments
                </button>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-2" style={{ color: '#000000' }}>Medical Staff</h2>
                        <p className="text-lg" style={{ color: '#333333' }}>Select your profile to access your clinical dashboard.</p>
                    </div>
                </div>
            </div>

            {isLoadingDoctors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {doctors.map((doctor) => (
                        <button
                            key={doctor.id}
                            onClick={() => handleDoctorClick(doctor)}
                            className="group bg-white p-8 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-primary-100 hover:-translate-y-1 transition-all duration-300 text-center flex flex-col items-center focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        >
                            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mb-5 group-hover:scale-105 transition-transform duration-300 ring-4 ring-primary-50/50">
                                <span className="text-2xl font-bold" style={{ color: '#333333' }}>
                                    {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                            </div>
                            <h3 className="font-bold text-lg mb-2" style={{ color: '#000000' }}>{doctor.name}</h3>
                            <p className="text-sm font-medium bg-gray-100 px-4 py-1.5 rounded-full mb-6" style={{ color: '#444444' }}>{doctor.specialty}</p>
                            <div className="mt-auto w-full py-3 rounded-xl bg-gray-50 font-semibold text-sm group-hover:bg-primary-600 group-hover:text-white transition-colors" style={{ color: '#444444' }}>
                                Access Dashboard
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderReceptionDashboard = () => (
        <div className="max-w-7xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <button onClick={() => setCurrentView('selection')} className="text-sm font-semibold mb-4 flex items-center" style={{ color: '#333333' }}>
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        Back
                    </button>
                    <h2 className="text-4xl font-bold tracking-tight" style={{ color: '#000000' }}>Reception Desk</h2>
                    <p className="text-lg text-gray-700 mt-2">Manage patient check-ins and appointments</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            // Load current settings
                            fetchHospitalSettings();
                            setShowSettingsModal(true);
                        }}
                        className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                        title="Settings"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                    <button
                        onClick={fetchQueue}
                        className="p-3 bg-white text-gray-400 hover:text-gray-900 rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                        title="Reload"
                    >
                        <svg className={`w-5 h-5 ${isLoadingQueue ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                    <button
                        onClick={() => setShowWalkInModal(true)}
                        className="px-6 py-3 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 font-semibold shadow-lg shadow-secondary-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        New Registration
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-10">
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-gray-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform"></div>
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2 relative z-10">Total Visits</p>
                    <p className="text-4xl md:text-5xl font-bold relative z-10" style={{ color: '#000000' }}>{queue.length}</p>
                </div>
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-orange-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform"></div>
                    <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-2 relative z-10">Waiting</p>
                    <p className="text-4xl md:text-5xl font-bold text-orange-500 relative z-10">{queue.filter(q => q.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute right-0 top-0 w-24 h-24 bg-secondary-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform"></div>
                    <p className="text-xs font-semibold text-secondary-600 uppercase tracking-wider mb-2 relative z-10">Completed</p>
                    <p className="text-4xl md:text-5xl font-bold text-secondary-600 relative z-10">{queue.filter(q => q.status === 'completed').length}</p>
                </div>
            </div>

            {/* Queue List - Clean */}
            <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 overflow-hidden border border-gray-100">
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white">
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                        <button
                            onClick={() => setActiveTab('queue')}
                            className={`px-6 py-2.5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'queue' ? 'bg-white shadow-sm' : ''}`}
                            style={{ color: activeTab === 'queue' ? '#000000' : '#333333' }}
                        >
                            Live Queue
                        </button>
                        <button
                            onClick={() => setActiveTab('patients')}
                            className={`px-6 py-2.5 font-semibold text-sm rounded-lg transition-all ${activeTab === 'patients' ? 'bg-white shadow-sm' : ''}`}
                            style={{ color: activeTab === 'patients' ? '#000000' : '#333333' }}
                        >
                            History Log
                        </button>
                    </div>
                </div>

                {isLoadingQueue ? (
                    <div className="p-16 text-center text-gray-600">Loading queue...</div>
                ) : queue.length === 0 ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center gap-4">
                        <p className="text-gray-600 font-medium">No records found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {queue
                            .filter(item => activeTab === 'queue' ? (item.status === 'pending' || item.status === 'in_progress') : true)
                            .map((item) => (
                                <div key={item.id} className="p-6 md:p-8 flex items-center justify-between hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-sm
                                        ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                                item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {item.queue_number}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg mb-1" style={{ color: '#000000' }}>{item.patient.name}</h4>
                                            <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
                                                <span className="bg-gray-100 px-2 py-0.5 rounded" style={{ color: '#444444' }}>Token: {item.patient.token_number}</span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                                                ${item.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                                                    item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                            <p className="font-medium text-sm" style={{ color: '#000000' }}>Dr. {item.doctor?.name}</p>
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

            {/* Walk-In Modal */}
            {showWalkInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-900/50 backdrop-blur-sm transition-opacity duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 transform transition-all duration-200">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-2xl font-bold" style={{ color: '#000000' }}>Patient Registration</h3>
                            <button onClick={handleCloseWalkInModal} className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Token #</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                        style={{ color: '#000000' }}
                                        value={walkInForm.tokenNumber}
                                        onChange={e => setWalkInForm({ ...walkInForm, tokenNumber: e.target.value })}
                                        placeholder="T-101"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Age</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                        style={{ color: '#000000' }}
                                        value={walkInForm.age}
                                        onChange={e => setWalkInForm({ ...walkInForm, age: e.target.value })}
                                        placeholder="Years"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                    style={{ color: '#000000' }}
                                    value={walkInForm.name}
                                    onChange={e => setWalkInForm({ ...walkInForm, name: e.target.value })}
                                    placeholder="Patient Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Department</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                    style={{ color: '#000000' }}
                                    value={walkInForm.department}
                                    onChange={e => setWalkInForm({ ...walkInForm, department: e.target.value })}
                                    placeholder="e.g. Cardiology"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Consulting Doctor</label>
                                <select
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-secondary-500 focus:border-secondary-500 focus:bg-white outline-none transition-all font-semibold"
                                    style={{ color: '#000000' }}
                                    value={walkInForm.doctorId}
                                    onChange={e => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                                >
                                    <option value="">Select Physician</option>
                                    {doctors.map(doc => (
                                        <option key={doc.id} value={doc.id}>
                                            {doc.name} - {doc.specialty}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseWalkInModal}
                                    className="flex-1 px-4 py-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                    style={{ color: '#444444' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3.5 bg-secondary-500 text-white rounded-xl hover:bg-secondary-600 font-semibold shadow-lg shadow-secondary-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-900/50 backdrop-blur-sm transition-opacity duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto transform transition-all duration-200">
                        <div className="sticky top-0 bg-white px-8 py-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-2xl font-bold" style={{ color: '#000000' }}>Hospital Settings</h3>
                            <button
                                onClick={() => {
                                    setShowSettingsModal(false);
                                    setAvatarFile(null);
                                    setAvatarPreview(hospitalSettings.avatarUrl || null);
                                }}
                                className="text-gray-500 hover:text-gray-700 transition-colors focus:outline-none"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleSaveSettings} className="p-8 space-y-6">
                            {/* Avatar Upload */}
                            <div className="flex flex-col items-center mb-8">
                                <div className="relative group">
                                    <div className="w-28 h-28 rounded-2xl bg-primary-50 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Hospital Logo" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold" style={{ color: '#333333' }}>
                                                {hospitalSettings.hospitalName?.charAt(0) || 'H'}
                                            </span>
                                        )}
                                    </div>
                                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl">
                                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleAvatarChange}
                                            className="hidden"
                                        />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-600 mt-3">Click to upload hospital logo</p>
                            </div>

                            {/* Hospital Name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Hospital Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                    style={{ color: '#000000' }}
                                    value={hospitalSettings.hospitalName}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, hospitalName: e.target.value })}
                                    placeholder="City General Hospital"
                                />
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Address / Location</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white outline-none transition-all placeholder:text-gray-400 resize-none"
                                    style={{ color: '#000000' }}
                                    value={hospitalSettings.address}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, address: e.target.value })}
                                    placeholder="123 Medical Center Drive, Suite 100&#10;City, State 12345"
                                />
                            </div>

                            {/* Contact Number */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Contact Number</label>
                                <input
                                    type="tel"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                    style={{ color: '#000000' }}
                                    value={hospitalSettings.contactNumber}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, contactNumber: e.target.value })}
                                    placeholder="+1 (555) 123-4567"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Email Address</label>
                                <input
                                    type="email"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white outline-none transition-all font-semibold placeholder:font-normal placeholder:text-gray-400"
                                    style={{ color: '#000000' }}
                                    value={hospitalSettings.email}
                                    onChange={e => setHospitalSettings({ ...hospitalSettings, email: e.target.value })}
                                    placeholder="contact@hospital.com"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSettingsModal(false);
                                        setAvatarFile(null);
                                        setAvatarPreview(hospitalSettings.avatarUrl || null);
                                    }}
                                    className="flex-1 px-4 py-3.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                    style={{ color: '#444444' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingSettings}
                                    className="flex-1 px-4 py-3.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 font-semibold shadow-lg shadow-orange-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

    const renderDashboard = () => {
        let themeColor = 'gray';
        let title = 'Dashboard';

        switch (currentView) {
            case 'pharmacy': themeColor = 'blue'; title = 'Pharmacy Management'; break;
            case 'doctor_dashboard': themeColor = 'purple'; title = `Dr. ${activeDoctor?.name?.split(' ')?.[1] || 'Doctor'}'s Dashboard`; break;
        }

        return (
            <div className={`max-w-7xl mx-auto px-6 py-8`}>
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <button
                            onClick={() => setCurrentView('selection')}
                            className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2 mb-2 transition-colors"
                        >
                            ← Switch Department
                        </button>
                        <h2 className={`text-3xl font-bold text-${themeColor}-900`}>{title}</h2>
                    </div>
                    <div className={`px-4 py-2 bg-${themeColor}-50 text-${themeColor}-700 rounded-lg text-sm font-medium`}>
                        Logged in as: {profile?.name}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                    <div className={`w-20 h-20 bg-${themeColor}-50 rounded-full flex items-center justify-center mx-auto mb-6`}>
                        <svg className={`w-10 h-10 text-${themeColor}-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {currentView === 'pharmacy' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />}
                            {currentView === 'doctor_dashboard' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />}
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold mb-2" style={{ color: '#000000' }}>
                        {currentView === 'pharmacy' ? 'Prescription Fulfillment' :
                            `Dr. ${activeDoctor?.name?.split(' ')?.[1] || 'Doctor'}'s Consultations`}
                    </h3>
                    <p className="text-gray-700 max-w-lg mx-auto mb-8">
                        This module is under active development. Features for {title} will appear here.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans selection:bg-secondary-100 selection:text-secondary-900">
            {/* Nav - Professional Sticky Header */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 md:h-18 flex items-center justify-between">
                    {/* Left - BeanHealth Logo & Enterprise Tagline */}
                    <div className="flex items-center gap-4">
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

                    {/* Right - Hospital Logo & Name + Sign Out */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border border-gray-200 bg-white">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-sm font-bold text-gray-700">
                                        {profile?.name?.charAt(0) || 'H'}
                                    </span>
                                )}
                            </div>
                            <span className="hidden md:inline-block text-sm font-semibold text-gray-900">{profile?.name}</span>
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sign Out"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            {/* Main Content */}
            {currentView === 'selection' ? renderSelectionScreen() :
                currentView === 'reception' ? renderReceptionDashboard() :
                    currentView === 'doctor' ? renderDoctorList() :
                        currentView === 'doctor_dashboard' && activeDoctor ?
                            <EnterpriseDoctorDashboard
                                doctor={activeDoctor}
                                onBack={() => {
                                    // Clear doctor session from storage
                                    const sessionKey = getSessionKey();
                                    sessionStorage.removeItem(sessionKey);

                                    setActiveDoctor(null);
                                    setCurrentView('doctor');
                                    navigate('/enterprise-dashboard/doctors');
                                }}
                            /> :
                            currentView === 'pharmacy' && profile?.id ? <EnterprisePharmacyDashboard hospitalId={profile.id} onBack={() => setCurrentView('selection')} /> :
                                renderDashboard()}

            {/* Auth Modal (Password) */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-900/60 backdrop-blur-sm transition-opacity duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 transform transition-all duration-200 scale-100">
                        <div className="text-center mb-8">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${selectedDeptForAuth === 'reception' ? 'bg-orange-50 text-orange-600' :
                                selectedDeptForAuth === 'pharmacy' ? 'bg-rose-50 text-rose-600' : 'bg-secondary-50 text-secondary-600'
                                }`}>
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-2" style={{ color: '#000000' }}>
                                {selectedDoctorForAuth ? `Hello, Dr. ${selectedDoctorForAuth.name.split(' ').pop()}` :
                                    selectedDeptForAuth === 'reception' ? 'Reception Access' : 'Pharmacy Access'}
                            </h3>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                {selectedDoctorForAuth
                                    ? 'Enter your secure passcode'
                                    : 'Please authenticate to continue'}
                            </p>
                        </div>

                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="••••••"
                                className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-colors mb-6 text-center text-2xl font-bold tracking-[0.3em] placeholder:text-gray-200 placeholder:tracking-[0.3em]"
                                style={{ color: '#000000' }}
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAuthModal(false);
                                        setPasswordInput('');
                                    }}
                                    className="px-4 py-3.5 text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold transition-colors shadow-lg shadow-primary-600/20 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                                >
                                    Unlock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnterpriseDashboardMain;

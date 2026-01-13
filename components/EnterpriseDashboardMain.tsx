import React, { useState, useEffect } from 'react';
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
}

const EnterpriseDashboardMain: React.FC = () => {
    const { signOut, profile } = useAuth();
    const [currentView, setCurrentView] = useState<'selection' | Department | 'doctor_dashboard'>('selection');
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
    const [walkInForm, setWalkInForm] = useState({
        name: '',
        age: '',
        department: '',
        doctorId: '',
        tokenNumber: ''
    });

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

    // Handlers
    const handleDeptClick = (dept: Department) => {
        if (dept === 'doctor') {
            // For doctor, we go to the doctor list view first
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
                setActiveDoctor(selectedDoctorForAuth);
                setCurrentView('doctor_dashboard');
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
        <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Select Department</h2>
                <p className="text-gray-500">Access your specific hospital department dashboard</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Reception Card */}
                <button
                    onClick={() => handleDeptClick('reception')}
                    className="bg-white p-8 rounded-2xl border-2 border-gray-100 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 group text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24 text-emerald-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <div className="w-14 h-14 bg-emerald-50 rounded-xl flex items-center justify-center mb-6 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-700">Reception</h3>
                    <p className="text-sm text-gray-500">Front desk operations, patient check-ins, and appointments.</p>
                    <div className="mt-6 flex items-center text-sm font-medium text-emerald-600 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                        Login Required <span className="ml-2">→</span>
                    </div>
                </button>

                {/* Pharmacy Card */}
                <button
                    onClick={() => handleDeptClick('pharmacy')}
                    className="bg-white p-8 rounded-2xl border-2 border-gray-100 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 group text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                    </div>
                    <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-700">Pharmacy</h3>
                    <p className="text-sm text-gray-500">Medication dispensing, inventory, and prescription management.</p>
                    <div className="mt-6 flex items-center text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                        Login Required <span className="ml-2">→</span>
                    </div>
                </button>

                {/* Doctor Card */}
                <button
                    onClick={() => handleDeptClick('doctor')}
                    className="bg-white p-8 rounded-2xl border-2 border-gray-100 hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300 group text-left relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <svg className="w-24 h-24 text-purple-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                    <div className="w-14 h-14 bg-purple-50 rounded-xl flex items-center justify-center mb-6 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700">Doctors</h3>
                    <p className="text-sm text-gray-500">View staff list and access individual doctor profiles.</p>
                    <div className="mt-6 flex items-center text-sm font-medium text-purple-600 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                        View Staff <span className="ml-2">→</span>
                    </div>
                </button>
            </div>
        </div>
    );

    const renderDoctorList = () => (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <button
                        onClick={() => setCurrentView('selection')}
                        className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-2 transition-colors"
                    >
                        ← Back to Selection
                    </button>
                    <h2 className="text-3xl font-bold text-gray-900">Hospital Doctors</h2>
                    <p className="text-gray-500">Select your profile to login</p>
                </div>
                <div className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium">
                    {doctors.length} Active Staff
                </div>
            </div>

            {isLoadingDoctors ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-pulse">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-48 bg-gray-100 rounded-2xl"></div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {doctors.map((doctor) => (
                        <button
                            key={doctor.id}
                            onClick={() => handleDoctorClick(doctor)}
                            className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-purple-500 hover:shadow-lg transition-all text-center group"
                        >
                            <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-2xl font-bold text-purple-600">
                                    {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                            </div>
                            <h3 className="font-bold text-gray-900 mb-1">{doctor.name}</h3>
                            <p className="text-sm text-gray-500 mb-4">{doctor.specialty}</p>
                            <div className="inline-block px-3 py-1 bg-gray-50 text-xs font-medium text-gray-600 rounded-full group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                Login Access
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const renderReceptionDashboard = () => (
        <div className="max-w-7xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <button onClick={() => setCurrentView('selection')} className="text-sm text-gray-500 hover:text-gray-900 mb-2">← Back</button>
                    <h2 className="text-3xl font-bold text-gray-900">Reception Desk</h2>
                    <p className="text-gray-500">Manage patient check-ins and appointments</p>
                </div>
                <button
                    onClick={() => setShowWalkInModal(true)}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    New Walk-In
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Total Patients Today</p>
                    <p className="text-3xl font-bold text-gray-900">{queue.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Waiting</p>
                    <p className="text-3xl font-bold text-orange-500">{queue.filter(q => q.status === 'pending').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <p className="text-sm text-gray-500 mb-1">Completed</p>
                    <p className="text-3xl font-bold text-emerald-500">{queue.filter(q => q.status === 'completed').length}</p>
                </div>
            </div>

            {/* Queue List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900">Patient Queue</h3>
                    <div className="text-sm text-gray-500">Live Updates</div>
                </div>

                {isLoadingQueue ? (
                    <div className="p-8 text-center text-gray-500">Loading queue...</div>
                ) : queue.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                        </div>
                        <p className="text-gray-900 font-medium">No patients in queue</p>
                        <p className="text-sm text-gray-500">Click "New Walk-In" to register a patient</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {queue.map((item) => (
                            <div key={item.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                                        ${item.status === 'pending' ? 'bg-orange-50 text-orange-600' :
                                            item.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        {item.queue_number}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{item.patient.name}</h4>
                                        <p className="text-sm text-gray-500 w-32 truncate" title={item.patient.token_number}>Token: {item.patient.token_number}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">{item.doctor?.name}</p>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize
                                        ${item.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                                            item.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                                        {item.status.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Walk-In Modal */}
            {showWalkInModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 animate-scale-in">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-900">New Walk-In Registration</h3>
                            <button onClick={() => setShowWalkInModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <form onSubmit={handleWalkInSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Token Number</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={walkInForm.tokenNumber}
                                    onChange={e => setWalkInForm({ ...walkInForm, tokenNumber: e.target.value })}
                                    placeholder="Enter Token (e.g. T-100)"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={walkInForm.name}
                                    onChange={e => setWalkInForm({ ...walkInForm, name: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={walkInForm.age}
                                    onChange={e => setWalkInForm({ ...walkInForm, age: e.target.value })}
                                    placeholder="Age"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={walkInForm.department}
                                    onChange={e => setWalkInForm({ ...walkInForm, department: e.target.value })}
                                    placeholder="e.g. Cardiology, General"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Consulting Doctor</label>
                                <select
                                    required
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    value={walkInForm.doctorId}
                                    onChange={e => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                                >
                                    <option value="">Select Doctor</option>
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
                                    onClick={() => setShowWalkInModal(false)}
                                    className="flex-1 px-4 py-3 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-600/20"
                                >
                                    Generate Token
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
                            className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-2 mb-2 transition-colors"
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
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {currentView === 'pharmacy' ? 'Prescription Fulfillment' :
                            `Dr. ${activeDoctor?.name?.split(' ')?.[1] || 'Doctor'}'s Consultations`}
                    </h3>
                    <p className="text-gray-500 max-w-lg mx-auto mb-8">
                        This module is under active development. Features for {title} will appear here.
                    </p>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Nav - Condensed */}
            <nav className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-900 rounded-lg"><span className="text-white font-bold">BH</span></div>
                        <div><h1 className="font-bold text-gray-900">Hospital Portal</h1></div>
                    </div>
                    <button onClick={() => signOut()} className="text-sm text-red-600 hover:text-red-700">Sign Out</button>
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
                                    setActiveDoctor(null);
                                    setCurrentView('doctor');
                                }}
                            /> :
                            currentView === 'pharmacy' && profile?.id ? <EnterprisePharmacyDashboard hospitalId={profile.id} /> :
                                renderDashboard()}

            {/* Auth Modal (Password) */}
            {showAuthModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-scale-in">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">
                                {selectedDoctorForAuth ? `Hello, ${selectedDoctorForAuth.name}` :
                                    selectedDeptForAuth === 'reception' ? 'Reception Access' : 'Pharmacy Access'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {selectedDoctorForAuth
                                    ? 'Enter your personal passcode to access your dashboard'
                                    : 'Please enter the department password to continue'}
                            </p>
                        </div>

                        <form onSubmit={handlePasswordSubmit}>
                            <input
                                type="password"
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Enter Access Code"
                                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-0 outline-none transition-colors mb-6 text-center text-lg font-medium tracking-widest placeholder:tracking-normal placeholder:font-normal"
                                autoFocus
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAuthModal(false);
                                        setPasswordInput('');
                                    }}
                                    className="px-4 py-3 text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors shadow-lg shadow-emerald-600/20"
                                >
                                    Access
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

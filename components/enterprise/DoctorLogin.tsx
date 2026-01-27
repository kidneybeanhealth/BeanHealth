import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
    avatar_url?: string;
    access_code: string;
}

// Session timeout: 4 hours
const DOCTOR_SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

const DoctorLogin: React.FC = () => {
    const navigate = useNavigate();
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile } = useAuth();

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    // Session storage key (scoped per hospital)
    const getSessionKey = () => `enterprise_doctor_session_${profile?.id}`;

    // If doctorId is in URL, check session or prompt for password
    useEffect(() => {
        if (!doctorId || doctors.length === 0) return;

        const doctor = doctors.find(d => d.id === doctorId);
        if (!doctor) {
            toast.error('Doctor not found');
            navigate('/enterprise-dashboard/doctors');
            return;
        }

        // Check for existing valid session
        const sessionKey = getSessionKey();
        const savedSession = sessionStorage.getItem(sessionKey);

        if (savedSession) {
            try {
                const { doctorId: savedDoctorId, timestamp } = JSON.parse(savedSession);
                const isValid = savedDoctorId === doctorId &&
                    (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

                if (isValid) {
                    // Valid session, redirect to dashboard
                    navigate(`/enterprise-dashboard/doctors/${doctorId}/dashboard`);
                    return;
                } else {
                    sessionStorage.removeItem(sessionKey);
                }
            } catch (e) {
                sessionStorage.removeItem(sessionKey);
            }
        }

        // No valid session, show password prompt
        setSelectedDoctor(doctor);
        setShowPasswordModal(true);
    }, [doctorId, doctors]);

    const fetchDoctors = async () => {
        if (!profile?.id) {
            console.log('[DoctorLogin] No profile.id yet, skipping fetch');
            return;
        }
        console.log('[DoctorLogin] Fetching doctors for hospital:', profile.id);
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('hospital_doctors')
                .select('*')
                .eq('hospital_id', profile.id)
                .eq('is_active', true);

            if (error) {
                console.error('[DoctorLogin] Error fetching doctors:', error);
                throw error;
            }
            console.log('[DoctorLogin] Found doctors:', data?.length);
            setDoctors(data || []);
        } catch (error) {
            console.error('[DoctorLogin] Error fetching doctors:', error);
            toast.error('Failed to load doctors list');
        } finally {
            setLoading(false);
        }
    };

    // Fetch doctors when profile.id is available
    useEffect(() => {
        if (profile?.id) {
            fetchDoctors();
        }
    }, [profile?.id]);

    // Loading timeout - prevent infinite loading
    useEffect(() => {
        if (loading) {
            const timeout = setTimeout(() => {
                console.log('[DoctorLogin] Loading timed out');
                setLoading(false);
            }, 15000);
            return () => clearTimeout(timeout);
        }
    }, [loading]);

    const handleDoctorClick = (doctor: DoctorProfile) => {
        // Navigate to doctor-specific login URL
        navigate(`/enterprise-dashboard/doctors/${doctor.id}`);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDoctor) return;

        if (password === selectedDoctor.access_code) {
            // Store session
            const sessionKey = getSessionKey();
            sessionStorage.setItem(sessionKey, JSON.stringify({
                doctorId: selectedDoctor.id,
                timestamp: Date.now()
            }));

            toast.success(`Welcome Dr. ${selectedDoctor.name.split(' ').pop()}`);
            setShowPasswordModal(false);
            navigate(`/enterprise-dashboard/doctors/${selectedDoctor.id}/dashboard`);
        } else {
            toast.error('Invalid Passcode');
        }
    };

    const handleCloseModal = () => {
        setShowPasswordModal(false);
        setPassword('');
        setSelectedDoctor(null);
        navigate('/enterprise-dashboard/doctors');
    };

    // If we have a doctorId in URL but showing password modal, render the modal
    if (doctorId && showPasswordModal && selectedDoctor) {
        return (
            <div
                className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6"
                style={{
                    background: 'linear-gradient(135deg, #f8faf6 0%, #e8f5e0 50%, #f0f7ec 100%)'
                }}
            >
                <div className="w-full max-w-lg">
                    {/* Logo & Branding */}
                    <div className="flex flex-col items-center justify-center mb-12 animate-fade-in w-full text-center">
                        <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 relative transition-transform duration-700 hover:scale-105 mb-8">
                            <img
                                src="/logo.png"
                                alt="BeanHealth Logo"
                                className="w-full h-full object-contain drop-shadow-sm"
                            />
                        </div>

                        <div className="flex items-center w-full">
                            <div className="flex-1 flex justify-end pr-5">
                                <div className="flex text-3xl sm:text-4xl font-black tracking-tight leading-none">
                                    <span className="text-[#3d2e2a]">Bean</span>
                                    <span className="text-secondary-500">Health</span>
                                </div>
                            </div>
                            <div className="h-10 w-px bg-[#3d2e2a] opacity-20 shrink-0" />
                            <div className="flex-1 flex justify-start pl-5 text-left">
                                <span className="text-[#3d2e2a] text-2xl sm:text-3xl font-black leading-none tracking-tight">
                                    {profile?.name || 'Hospital Registry'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCloseModal}
                        className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors group px-4"
                    >
                        <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="font-medium">Back to Doctors</span>
                    </button>

                    <div className="bg-white rounded-[2.5rem] shadow-[0_4px_30px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] border border-gray-100/50 p-6 sm:p-10">
                        <div className="text-center mb-10">
                            <div className="w-16 h-16 bg-indigo-50/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                                Hello, Dr. {selectedDoctor.name.split(' ').pop()}
                            </h2>
                            <p className="text-gray-400 mt-3 font-medium text-[15px]">{selectedDoctor.specialty}</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                                    Enter Your Passcode
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all text-center text-2xl font-bold tracking-[0.3em] placeholder:text-gray-200 placeholder:tracking-[0.3em]"
                                    placeholder="••••••"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-3.5 text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 font-bold transition-all active:scale-[0.98]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password}
                                    className="px-4 py-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    Unlock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // Doctor List View
    return (
        <div
            className="min-h-screen flex flex-col p-4 sm:p-8"
            style={{
                background: 'linear-gradient(135deg, #f8faf6 0%, #e8f5e0 50%, #f0f7ec 100%)'
            }}
        >
            <div className="max-w-7xl mx-auto w-full">
                <div className="flex flex-col items-center justify-center mb-16 animate-fade-in text-center w-full">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 relative transition-transform duration-700 hover:scale-105 mb-8">
                        <img
                            src="/logo.png"
                            alt="BeanHealth Logo"
                            className="w-full h-full object-contain drop-shadow-sm"
                        />
                    </div>

                    <div className="flex items-center w-full">
                        <div className="flex-1 flex justify-end pr-5">
                            <div className="flex text-3xl sm:text-4xl font-black tracking-tight leading-none">
                                <span className="text-[#3d2e2a]">Bean</span>
                                <span className="text-secondary-500">Health</span>
                            </div>
                        </div>
                        <div className="h-10 w-px bg-[#3d2e2a] opacity-20 shrink-0" />
                        <div className="flex-1 flex justify-start pl-5 text-left">
                            <span className="text-[#3d2e2a] text-2xl sm:text-3xl font-black leading-none tracking-tight">
                                {profile?.name || 'Hospital Registry'}
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 tracking-[0.3em] uppercase opacity-80 mt-8">Medical Staff Access</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 px-2">
                    <div>
                        <button
                            onClick={() => navigate('/enterprise-dashboard')}
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors group"
                        >
                            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="font-medium">Back to Dashboard</span>
                        </button>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-gray-900 mb-2">
                            Medical Staff
                        </h2>
                        <p className="text-lg text-gray-500 font-medium">
                            Select your profile to access your clinical dashboard.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-72 bg-gray-100 rounded-2xl animate-pulse"></div>
                        ))}
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Doctors Found</h3>
                        <p className="text-gray-900">Add doctors to your hospital to get started.</p>
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
                                    <span className="text-2xl font-bold text-gray-900">
                                        {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{doctor.name}</h3>
                                <p className="text-sm font-medium bg-gray-100 px-4 py-1.5 rounded-full text-gray-900 mb-6">
                                    {doctor.specialty}
                                </p>
                                <div className="mt-auto w-full py-3 rounded-xl bg-gray-50 font-semibold text-sm text-gray-900 group-hover:bg-primary-600 group-hover:text-white transition-colors">
                                    Access Dashboard
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DoctorLogin;

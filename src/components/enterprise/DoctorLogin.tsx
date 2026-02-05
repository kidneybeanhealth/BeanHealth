import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useHospitalName } from '../../hooks/useHospitalName';

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

// Helper to format doctor name professionally
const formatDoctorName = (name: string) => {
    if (!name) return "";
    // Remove existing Dr prefix and any trailing dots/spaces
    let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
    // Fix initials formatting (e.g., A.Divakar -> A. Divakar)
    cleanName = cleanName.replace(/([A-Z])\.(\S)/g, "$1. $2");
    return `Dr. ${cleanName}`;
};

// Helper to get initials from doctor name
const getDoctorInitials = (name: string) => {
    if (!name) return "Dr";
    let cleanName = name.replace(/^(dr\.?\s*)/i, "").trim();
    // Handle cases like A.Divakar
    cleanName = cleanName.replace(/\./g, " ").trim();
    const parts = cleanName.split(/\s+/);

    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const DoctorLogin: React.FC = () => {
    const navigate = useNavigate();
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile } = useAuth();
    const { displayName } = useHospitalName('Hospital Registry');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

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

            // Custom sort: Prabhakar first, Divakar second, others after
            const doctorsList = (data as DoctorProfile[]) || [];
            const sortedDoctors = doctorsList.sort((a, b) => {
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();

                if (nameA.includes('prabhakar')) return -1;
                if (nameB.includes('prabhakar')) return 1;
                if (nameA.includes('divakar')) return -1;
                if (nameB.includes('divakar')) return 1;
                return 0;
            });

            console.log('[DoctorLogin] Found doctors:', sortedDoctors.length);
            setDoctors(sortedDoctors);
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
        selectedDoctor && setSelectedDoctor(null);
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
                                    {displayName}
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
                                Hello, {formatDoctorName(selectedDoctor.name)}
                            </h2>
                            <p className="text-gray-400 mt-3 font-medium text-[15px]">{selectedDoctor.specialty}</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                                    Enter Your Passcode
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all text-center text-2xl font-bold tracking-[0.3em] placeholder:text-gray-200 placeholder:tracking-[0.3em]"
                                        placeholder="••••••"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-2"
                                    >
                                        {showPassword ? (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
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
                <div className="flex flex-col items-center justify-center mb-10 sm:mb-16 animate-fade-in text-center w-full">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 flex-shrink-0 relative transition-transform duration-700 hover:scale-105 mb-6 sm:mb-8">
                        <img
                            src="/logo.png"
                            alt="BeanHealth Logo"
                            className="w-full h-full object-contain drop-shadow-sm"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-0 w-full max-w-2xl">
                        <div className="sm:flex-1 flex justify-center sm:justify-end sm:pr-8">
                            <div className="flex text-2xl sm:text-4xl font-black tracking-tight leading-none">
                                <span className="text-[#3d2e2a]">Bean</span>
                                <span className="text-secondary-500">Health</span>
                            </div>
                        </div>
                        <div className="hidden sm:block h-10 w-px bg-[#3d2e2a] opacity-20 shrink-0" />
                        <div className="sm:flex-1 flex justify-center sm:justify-start sm:pl-8">
                            <span className="text-[#3d2e2a] text-xl sm:text-3xl font-black leading-tight tracking-tight px-4 sm:px-0">
                                {displayName}
                            </span>
                        </div>
                    </div>
                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 tracking-[0.3em] uppercase opacity-80 mt-6 sm:mt-8">Medical Staff Access</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 sm:gap-6 mb-8 sm:mb-12 px-2">
                    <div className="w-full">
                        <button
                            onClick={() => navigate('/enterprise-dashboard')}
                            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4 sm:mb-6 transition-colors group"
                        >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm sm:font-medium">Back to Dashboard</span>
                        </button>
                        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-gray-900 mb-1 sm:mb-2">
                            Medical Staff
                        </h2>
                        <p className="text-base sm:text-lg text-gray-500 font-medium">
                            Select your profile to access your dashboard.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-[300px] bg-white/50 rounded-3xl animate-pulse border border-white/20 shadow-sm"></div>
                        ))}
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="text-center py-20 bg-white/40 backdrop-blur-md rounded-[3rem] border border-white/50 shadow-sm">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                            <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2 tracking-tight">No Doctors Found</h3>
                        <p className="text-gray-500 font-medium">Add doctors to your hospital to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {doctors.map((doctor) => (
                            <button
                                key={doctor.id}
                                onClick={() => handleDoctorClick(doctor)}
                                className="group relative flex flex-col items-center p-6 sm:p-8 bg-white/80 backdrop-blur-sm rounded-[1.5rem] sm:rounded-[2rem] border border-white/60 shadow-[0_2px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-500 ease-out text-center focus:outline-none focus:ring-4 focus:ring-primary-500/20"
                            >
                                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 sm:mb-6 relative">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary-100 to-primary-50 rounded-full scale-90 group-hover:scale-110 transition-transform duration-500 ease-out opacity-60" />
                                    <div className="relative w-full h-full rounded-full overflow-hidden border-[3px] sm:border-[4px] border-white shadow-sm flex items-center justify-center bg-gray-50 text-xl sm:text-2xl font-bold text-gray-900 group-hover:border-primary-50 transition-colors duration-300">
                                        {doctor.avatar_url ? (
                                            <img src={doctor.avatar_url} alt={doctor.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-2xl sm:text-3xl text-gray-800">
                                                {getDoctorInitials(doctor.name)}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-0.5 sm:mb-1 tracking-tight group-hover:text-primary-700 transition-colors line-clamp-1">{formatDoctorName(doctor.name)}</h3>
                                <p className="text-[10px] sm:text-sm font-medium text-gray-500 mb-6 sm:mb-8 uppercase tracking-wider">{doctor.specialty || 'GENERAL MEDICINE'}</p>

                                <div className="mt-auto pointer-events-none w-full">
                                    <span className="inline-flex w-full items-center justify-center px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-50 text-gray-900 text-xs sm:text-sm font-bold rounded-xl sm:rounded-full group-hover:bg-primary-600 group-hover:text-white transition-all duration-300 shadow-sm">
                                        Access Dashboard
                                    </span>
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

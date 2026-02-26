import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { sortDoctors } from '../../utils/doctorSortStrategy';
import { useHospitalName } from '../../hooks/useHospitalName';
import {
    getLegacyDoctorSessionKey,
    loadDoctorActorSession,
    saveDoctorActorSession,
    clearDoctorActorSession,
    type DoctorActorType,
} from '../../utils/doctorActorSession';

interface DoctorProfile {
    id: string;
    name: string;
    specialty: string;
    hospital_id: string;
    avatar_url?: string;
    access_code: string;
}

interface DoctorActorLoginResponse {
    session_token: string;
    session_id: string;
    actor_type: DoctorActorType;
    assistant_id: string | null;
    actor_display_name: string;
    expires_at: string;
    can_manage_team?: boolean;
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
    const { tenant } = useTenant();
    const { displayName } = useHospitalName('Hospital Registry');

    const [doctors, setDoctors] = useState<DoctorProfile[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paAuthEnabled, setPaAuthEnabled] = useState(false);
    const [authMode, setAuthMode] = useState<DoctorActorType>('chief');
    const [assistantCode, setAssistantCode] = useState('');

    const [showPassword, setShowPassword] = useState(false);

    const getLegacySessionKey = () => getLegacyDoctorSessionKey(profile?.id || '');

    // If doctorId is in URL, check actor/legacy session or prompt for password
    useEffect(() => {
        if (!doctorId || doctors.length === 0 || !profile?.id) return;

        const doctor = doctors.find(d => d.id === doctorId);
        if (!doctor) {
            toast.error('Doctor not found');
            navigate('/enterprise-dashboard/doctors');
            return;
        }

        let isCancelled = false;

        const promptLogin = () => {
            if (isCancelled) return;
            setSelectedDoctor(doctor);
            setAuthMode('chief');
            setAssistantCode('');
            setPassword('');
            setShowPasswordModal(true);
        };

        const checkSessions = async () => {
            if (paAuthEnabled) {
                const actorSession = loadDoctorActorSession(profile.id, doctorId);
                if (actorSession) {
                    const { data, error } = await (supabase as any).rpc('doctor_actor_validate', {
                        p_hospital_id: profile.id,
                        p_chief_doctor_id: doctorId,
                        p_session_token: actorSession.sessionToken,
                    });

                    const validated = Array.isArray(data) ? data[0] : null;
                    if (!error && validated?.session_id) {
                        saveDoctorActorSession({
                            ...actorSession,
                            actorType: validated.actor_type,
                            assistantId: validated.assistant_id || null,
                            actorDisplayName: validated.actor_display_name,
                            sessionId: validated.session_id,
                            expiresAt: validated.expires_at,
                            canManageTeam: Boolean(validated.can_manage_team),
                        });

                        const legacyKey = getLegacySessionKey();
                        sessionStorage.setItem(legacyKey, JSON.stringify({
                            doctorId,
                            timestamp: Date.now(),
                        }));

                        if (!isCancelled) {
                            navigate(`/enterprise-dashboard/doctors/${doctorId}/dashboard`);
                        }
                        return;
                    }

                    clearDoctorActorSession(profile.id, doctorId);
                }

                promptLogin();
                return;
            }

            // Legacy flow
            const sessionKey = getLegacySessionKey();
            const savedSession = sessionStorage.getItem(sessionKey);
            if (savedSession) {
                try {
                    const { doctorId: savedDoctorId, timestamp } = JSON.parse(savedSession);
                    const isValid = savedDoctorId === doctorId &&
                        (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

                    if (isValid) {
                        if (!isCancelled) {
                            navigate(`/enterprise-dashboard/doctors/${doctorId}/dashboard`);
                        }
                        return;
                    }
                    sessionStorage.removeItem(sessionKey);
                } catch (_e) {
                    sessionStorage.removeItem(sessionKey);
                }
            }

            promptLogin();
        };

        checkSessions();
        return () => {
            isCancelled = true;
        };
    }, [doctorId, doctors, paAuthEnabled, profile?.id, navigate]);

    const fetchDoctors = async () => {
        if (!profile?.id) {
            console.log('[DoctorLogin] No profile.id yet, skipping fetch');
            return;
        }
        console.log('[DoctorLogin] Fetching doctors for hospital:', profile.id);
        setLoading(true);
        try {
            const [doctorResult, featureResult] = await Promise.all([
                supabase
                    .from('hospital_doctors')
                    .select('*')
                    .eq('hospital_id', profile.id)
                    .eq('is_active', true),
                (supabase
                    .from('hospital_profiles' as any)
                    .select('enable_pa_actor_auth')
                    .eq('id', profile.id)
                    .maybeSingle() as any),
            ]);

            const { data, error } = doctorResult;

            if (error) {
                console.error('[DoctorLogin] Error fetching doctors:', error);
                throw error;
            }

            const featureEnabled = Boolean(featureResult?.data?.enable_pa_actor_auth);
            setPaAuthEnabled(featureEnabled);

            // Sort using the tenant's configured doctor_sort_order from hospital_profiles.config.
            // KKC config: ["prabhakar", "divakar"] → identical result to previous hardcoded sort.
            // New hospitals: order comes from their DB config, no code changes needed.
            const doctorsList = (data as DoctorProfile[]) || [];
            const sortOrder = tenant?.config?.doctor_sort_order ?? [];
            const sortedDoctors = sortDoctors(doctorsList, sortOrder);

            console.log('[DoctorLogin] Found doctors:', sortedDoctors.length);
            setDoctors(sortedDoctors);
        } catch (error) {
            console.error('[DoctorLogin] Error fetching doctors:', error);
            setPaAuthEnabled(false);
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

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDoctor || !profile?.id) return;

        if (paAuthEnabled) {
            if (authMode === 'assistant' && !assistantCode.trim()) {
                toast.error('Assistant code is required');
                return;
            }

            setIsSubmitting(true);
            try {
                const { data, error } = await (supabase as any).rpc('doctor_actor_login', {
                    p_hospital_id: profile.id,
                    p_chief_doctor_id: selectedDoctor.id,
                    p_actor_type: authMode,
                    p_assistant_code: authMode === 'assistant' ? assistantCode.trim().toUpperCase() : null,
                    p_passcode: password,
                    p_device_info: {
                        userAgent: navigator.userAgent,
                        platform: navigator.platform,
                        language: navigator.language,
                        isMobile: window.innerWidth < 768,
                    },
                });

                const actorData: DoctorActorLoginResponse | null = Array.isArray(data) ? data[0] : null;
                if (error || !actorData?.session_token) {
                    toast.error('Invalid credentials');
                    return;
                }

                saveDoctorActorSession({
                    hospitalId: profile.id,
                    chiefDoctorId: selectedDoctor.id,
                    sessionToken: actorData.session_token,
                    sessionId: actorData.session_id,
                    actorType: actorData.actor_type,
                    assistantId: actorData.assistant_id || null,
                    actorDisplayName: actorData.actor_display_name,
                    expiresAt: actorData.expires_at,
                    canManageTeam: actorData.actor_type === 'chief',
                    loginAt: Date.now(),
                });

                const legacyKey = getLegacySessionKey();
                sessionStorage.setItem(legacyKey, JSON.stringify({
                    doctorId: selectedDoctor.id,
                    timestamp: Date.now(),
                }));

                toast.success(`Welcome ${actorData.actor_display_name}`);
                setShowPasswordModal(false);
                navigate(`/enterprise-dashboard/doctors/${selectedDoctor.id}/dashboard`);
            } catch (error) {
                console.error('[DoctorLogin] doctor_actor_login failed:', error);
                toast.error('Invalid credentials');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Legacy fallback or hashed check
        // If we reach here, either the cleartext check failed OR the code is already hashed.
        try {
            setIsSubmitting(true);
            const { data, error } = await (supabase as any).rpc('doctor_actor_login', {
                p_hospital_id: profile.id,
                p_chief_doctor_id: selectedDoctor.id,
                p_actor_type: 'chief',
                p_assistant_code: null,
                p_passcode: password.trim(),
                p_device_info: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    isMobile: window.innerWidth < 768,
                },
            });
            const actorData: DoctorActorLoginResponse | null = Array.isArray(data) ? data[0] : null;
            if (!error && actorData?.session_token) {
                saveDoctorActorSession({
                    hospitalId: profile.id,
                    chiefDoctorId: selectedDoctor.id,
                    sessionToken: actorData.session_token,
                    sessionId: actorData.session_id,
                    actorType: actorData.actor_type,
                    assistantId: actorData.assistant_id || null,
                    actorDisplayName: actorData.actor_display_name,
                    expiresAt: actorData.expires_at,
                    canManageTeam: true,
                    loginAt: Date.now(),
                });

                // Also set legacy session for safety
                const sessionKey = getLegacySessionKey();
                sessionStorage.setItem(sessionKey, JSON.stringify({
                    doctorId: selectedDoctor.id,
                    timestamp: Date.now()
                }));

                toast.success(`Welcome ${actorData.actor_display_name}`);
                setShowPasswordModal(false);
                navigate(`/enterprise-dashboard/doctors/${selectedDoctor.id}/dashboard`);
                return;
            }
        } catch (error) {
            console.warn('[DoctorLogin] RPC fallback failed:', error);
        } finally {
            setIsSubmitting(false);
        }

        toast.error('Invalid Passcode');
    };

    const handleCloseModal = () => {
        setShowPasswordModal(false);
        setPassword('');
        setAssistantCode('');
        setAuthMode('chief');
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
                    <div className="flex flex-col items-center justify-center mb-6 sm:mb-12 animate-fade-in w-full text-center">
                        <div className="w-20 h-20 sm:w-32 sm:h-32 flex-shrink-0 relative transition-transform duration-700 hover:scale-105 mb-4 sm:mb-8">
                            <img
                                src="/logo.png"
                                alt="BeanHealth Logo"
                                className="w-full h-full object-contain drop-shadow-sm"
                            />
                        </div>

                        <div className="flex items-center w-full max-w-xs sm:max-w-none">
                            <div className="flex-1 flex justify-end pr-3 sm:pr-5">
                                <div className="flex text-2xl sm:text-4xl font-black tracking-tight leading-none">
                                    <span className="text-[#3d2e2a]">Bean</span>
                                    <span className="text-secondary-500">Health</span>
                                </div>
                            </div>
                            <div className="h-6 sm:h-10 w-px bg-[#3d2e2a] opacity-20 shrink-0" />
                            <div className="flex-1 flex justify-start pl-3 sm:pl-5 text-left">
                                <span className="text-[#3d2e2a] text-xl sm:text-3xl font-black leading-none tracking-tight line-clamp-1">
                                    {displayName}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleCloseModal}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-900 mb-4 sm:mb-6 transition-colors group px-4"
                    >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-sm font-medium">Back to Doctors</span>
                    </button>

                    <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_4px_30px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] border border-gray-100/50 p-6 sm:p-10">
                        <div className="text-center mb-6 sm:mb-10">
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50/50 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6">
                                <svg className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
                                Hello, {formatDoctorName(selectedDoctor.name)}
                            </h2>
                            <p className="text-gray-400 mt-2 sm:mt-3 font-medium text-xs sm:text-[15px]">{selectedDoctor.specialty}</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-4 sm:space-y-6">
                            {paAuthEnabled && (
                                <div className="space-y-2 sm:space-y-3">
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                                        Sign In As
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthMode('chief');
                                                setAssistantCode('');
                                            }}
                                            className={`py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${authMode === 'chief' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                        >
                                            Chief
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAuthMode('assistant')}
                                            className={`py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-colors ${authMode === 'assistant' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
                                        >
                                            PA
                                        </button>
                                    </div>
                                </div>
                            )}

                            {paAuthEnabled && authMode === 'assistant' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 ml-1">
                                        Assistant Code
                                    </label>
                                    <input
                                        type="text"
                                        value={assistantCode}
                                        onChange={(e) => setAssistantCode(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-2.5 sm:py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all text-center text-base sm:text-lg font-bold tracking-wider"
                                        placeholder="PA CODE"
                                        autoComplete="off"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3 ml-1">
                                    {paAuthEnabled ? (authMode === 'chief' ? 'Chief Passcode' : 'PA Passcode') : 'Enter Your Passcode'}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 sm:py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-0 outline-none transition-all text-center text-xl sm:text-2xl font-bold tracking-[0.3em] placeholder:text-gray-200 placeholder:tracking-[0.3em]"
                                        placeholder="••••••"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-2"
                                    >
                                        {showPassword ? (
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268-2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268-2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>


                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-3 sm:py-3.5 text-gray-500 bg-gray-50 rounded-xl hover:bg-gray-100 text-sm sm:text-base font-bold transition-all active:scale-[0.98]"
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password || isSubmitting || (paAuthEnabled && authMode === 'assistant' && !assistantCode.trim())}
                                    className="px-4 py-3 sm:py-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 text-sm sm:text-base font-bold transition-all shadow-lg shadow-primary-600/20 disabled:opacity-50 active:scale-[0.98]"
                                >
                                    {isSubmitting ? 'Checking...' : 'Unlock'}
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
            className="min-h-screen flex flex-col p-4 sm:p-8 bg-[#f9fbf8]"
        >
            <div className="max-w-7xl mx-auto w-full relative z-10">
                <div className="flex flex-col items-center justify-center mb-10 sm:mb-20 animate-fade-in text-center w-full">
                    <div className="w-20 h-20 sm:w-28 sm:h-28 flex-shrink-0 relative mb-6 sm:mb-8">
                        <img
                            src="/logo.png"
                            alt="BeanHealth Logo"
                            className="w-full h-full object-contain"
                        />
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-10">
                            <div className="flex text-2xl sm:text-4xl font-black tracking-tight leading-none">
                                <span className="text-gray-900">Bean</span>
                                <span className="text-emerald-600">Health</span>
                            </div>
                            <div className="hidden sm:block h-10 w-px bg-gray-300 shrink-0" />
                            <span className="text-gray-800 text-xl sm:text-3xl font-bold leading-tight tracking-tight px-4 sm:px-0">
                                {displayName}
                            </span>
                        </div>
                        <p className="mt-4 sm:mt-6 text-[9px] sm:text-[11px] font-bold text-gray-400 tracking-[0.3em] uppercase">Medical Staff Access</p>
                    </div>
                </div>

                <div className="flex flex-col items-center mb-8 sm:mb-16 px-4">
                    <div className="max-w-3xl w-full text-center">
                        <h2 className="text-2xl sm:text-5xl font-black tracking-tight text-gray-900 mb-2 sm:mb-3 leading-tight">
                            Select Your Profile
                        </h2>
                        <p className="text-sm sm:text-lg text-gray-500 font-medium max-w-xl mx-auto">
                            Choose your profile to securely access your clinical workspace.
                        </p>
                    </div>
                </div>

                <div className="mb-6 sm:mb-10 px-4 flex justify-center">
                    <button
                        onClick={() => navigate('/enterprise-dashboard')}
                        className="flex items-center gap-2 px-4 sm:px-6 py-2 text-gray-400 hover:text-gray-600 transition-colors group"
                    >
                        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="text-xs sm:text-sm font-semibold">Back to Dashboard</span>
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-[250px] sm:h-[300px] bg-white/50 rounded-2xl sm:rounded-3xl animate-pulse border border-white/20 shadow-sm"></div>
                        ))}
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="text-center py-16 sm:py-20 bg-white/40 backdrop-blur-md rounded-[2rem] sm:rounded-[3rem] border border-white/50 shadow-sm mx-4">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
                            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 tracking-tight">No Doctors Found</h3>
                        <p className="text-sm sm:text-base text-gray-500 font-medium">Add doctors to your hospital to get started.</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap justify-center gap-4 sm:gap-8 px-4 pb-20">
                        {doctors.map((doctor) => (
                            <button
                                key={doctor.id}
                                onClick={() => handleDoctorClick(doctor)}
                                className="group relative flex flex-col items-center w-full sm:w-[280px] p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 transform hover:-translate-y-1 text-center focus:outline-none"
                            >
                                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 sm:mb-6 relative">
                                    <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-gray-50 flex items-center justify-center bg-gray-50 ring-4 ring-gray-50/50">
                                        {doctor.avatar_url ? (
                                            <img src={doctor.avatar_url} alt={doctor.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                <span className="text-xl sm:text-2xl font-bold text-gray-400">
                                                    {getDoctorInitials(doctor.name)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="w-full mb-4 sm:mb-6">
                                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1 tracking-tight truncate px-2">
                                        {formatDoctorName(doctor.name)}
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest truncate px-2">
                                        {doctor.specialty || 'GENERAL MEDICINE'}
                                    </p>
                                </div>

                                <div className="mt-auto w-full">
                                    <div className="w-full py-2.5 sm:py-3 bg-gray-900 text-white rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-widest group-hover:bg-emerald-600 transition-colors">
                                        Access Dashboard
                                    </div>
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

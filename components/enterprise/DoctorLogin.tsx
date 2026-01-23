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

    useEffect(() => {
        fetchDoctors();
    }, [profile?.id]);

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
        if (!profile?.id) return;
        setLoading(true);
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
            setLoading(false);
        }
    };

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
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="max-w-md w-full">
                    <button
                        onClick={handleCloseModal}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="font-medium">Back to Doctors</span>
                    </button>

                    <div className="bg-white rounded-2xl shadow-xl p-8">
                        <div className="text-center mb-8">
                            <div className="w-20 h-20 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-4 ring-primary-50/50">
                                <span className="text-2xl font-bold text-gray-700">
                                    {selectedDoctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900">
                                Hello, Dr. {selectedDoctor.name.split(' ').pop()}
                            </h2>
                            <p className="text-gray-500 mt-2">{selectedDoctor.specialty}</p>
                        </div>

                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Enter Your Passcode
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-primary-500 focus:ring-0 outline-none transition-colors text-center text-2xl font-bold tracking-[0.3em] placeholder:text-gray-200 placeholder:tracking-[0.3em]"
                                    placeholder="••••••"
                                    autoFocus
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-3.5 text-gray-600 bg-gray-50 rounded-xl hover:bg-gray-100 font-semibold transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={!password}
                                    className="px-4 py-3.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-semibold transition-colors shadow-lg shadow-primary-600/20 disabled:opacity-50"
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
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <button
                        onClick={() => navigate('/enterprise-dashboard')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="font-medium">Back to Dashboard</span>
                    </button>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-2">
                        Medical Staff
                    </h2>
                    <p className="text-lg text-gray-600">
                        Select your profile to access your clinical dashboard.
                    </p>
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
                            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Doctors Found</h3>
                        <p className="text-gray-500">Add doctors to your hospital to get started.</p>
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
                                    <span className="text-2xl font-bold text-gray-700">
                                        {doctor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                    </span>
                                </div>
                                <h3 className="font-bold text-lg text-gray-900 mb-2">{doctor.name}</h3>
                                <p className="text-sm font-medium bg-gray-100 px-4 py-1.5 rounded-full text-gray-600 mb-6">
                                    {doctor.specialty}
                                </p>
                                <div className="mt-auto w-full py-3 rounded-xl bg-gray-50 font-semibold text-sm text-gray-600 group-hover:bg-primary-600 group-hover:text-white transition-colors">
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

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { HospitalService } from '../../services/hospitalService';
import { Hospital } from '../../types';
import HospitalOnboarding from './HospitalOnboarding';
import ReceptionistDashboard from './ReceptionistDashboard';
import PharmacyDashboard from './PharmacyDashboard';
import DoctorDashboardHospital from './DoctorDashboardHospital';
import { toast } from 'react-hot-toast';
import Header from '../Header';
import { LogoIcon } from '../icons/LogoIcon';

type StaffRole = 'none' | 'receptionist' | 'doctor' | 'pharmacy';

const HospitalDashboardMain: React.FC = () => {
    const { user, signOut } = useAuth();
    const [hospital, setHospital] = useState<Hospital | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState<StaffRole>('none');
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
    const [showDummyLogin, setShowDummyLogin] = useState<{ role: StaffRole; pass: string }>({ role: 'none', pass: '' });
    const [showDoctorSelect, setShowDoctorSelect] = useState(false);

    useEffect(() => {
        fetchHospital();
    }, [user]);

    const fetchHospital = async () => {
        if (!user) return;
        try {
            const data = await HospitalService.getHospitalByUserId(user.id);
            setHospital(data);
            if (data) {
                const docs = await HospitalService.getDoctors(data.id);
                setDoctors(docs);
            }
        } catch (error) {
            console.error('Error fetching hospital:', error);
            toast.error('Failed to load hospital profile');
        } finally {
            setLoading(false);
        }
    };

    const handleDummyLogin = (role: StaffRole) => {
        if (role === 'doctor') {
            setShowDoctorSelect(true);
            return;
        }

        setShowDummyLogin({ role, pass: '' });
    };

    const handleDoctorClick = (doctor: any) => {
        setSelectedDoctor(doctor);
        setShowDoctorSelect(false);
        setShowDummyLogin({ role: 'doctor', pass: '' });
    };

    const verifyDummyPass = () => {
        const { role, pass } = showDummyLogin;

        if (role === 'receptionist' && pass === 'reception123') {
            setActiveRole('receptionist');
            setShowDummyLogin({ role: 'none', pass: '' });
        } else if (role === 'pharmacy' && pass === 'pharma123') {
            setActiveRole('pharmacy');
            setShowDummyLogin({ role: 'none', pass: '' });
        } else if (role === 'doctor') {
            // For specific doctors, let's use their name as the password for simplicity, 
            // or a standard one if the user prefers. The user said "kumaru password should enter".
            // Since we haven't set passwords in DB for staff yet, we'll check against a generic or specific one.
            // Case insensitive name check for better UX. Support "Dhoni123" for "Dr. Dhoni"
            const cleanName = selectedDoctor?.name.replace(/^Dr\.?\s*/i, '').toLowerCase();
            const nameMatch = selectedDoctor && (
                pass.toLowerCase() === `${selectedDoctor.name.toLowerCase()}123` ||
                (cleanName && pass.toLowerCase() === `${cleanName}123`)
            );

            if (nameMatch || pass === 'doctor123') {
                setActiveRole('doctor');
                setShowDummyLogin({ role: 'none', pass: '' });
            } else {
                toast.error(`Invalid password for Dr. ${selectedDoctor?.name}`);
            }
        } else {
            toast.error('Invalid dummy credentials');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!hospital || !hospital.detailsCompleted) {
        return <HospitalOnboarding onComplete={fetchHospital} />;
    }

    if (activeRole === 'receptionist') {
        return <ReceptionistDashboard hospital={hospital} onBack={() => setActiveRole('none')} />;
    }

    if (activeRole === 'pharmacy') {
        return <PharmacyDashboard hospital={hospital} onBack={() => setActiveRole('none')} />;
    }

    if (activeRole === 'doctor') {
        return (
            <DoctorDashboardHospital
                hospitalId={hospital.id}
                onBack={() => {
                    setActiveRole('none');
                    setSelectedDoctor(null);
                }}
                doctorInfo={selectedDoctor}
            />
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-6 md:p-12 relative overflow-hidden">
            {/* Background Decorative Mesh - Matching Core App */}
            <div className="fixed inset-0 pointer-events-none opacity-40 dark:opacity-20">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-200/30 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-secondary-300/20 blur-[120px]" />
            </div>

            <div className="max-w-6xl mx-auto relative z-10">
                <Header
                    user={{
                        id: user.id,
                        name: hospital.name,
                        email: user.email || '',
                        role: 'hospital' as any
                    }}
                    onLogout={signOut}
                    showMenu={false}
                    className="!mb-12"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                    {/* Receptionist Card */}
                    <button
                        onClick={() => handleDummyLogin('receptionist')}
                        className="group relative overflow-hidden bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-white/10 hover-lift transition-all text-left"
                    >
                        <div className="h-16 w-16 bg-secondary-100 dark:bg-secondary-900/30 rounded-2xl flex items-center justify-center mb-8 border border-secondary-200/50 dark:border-secondary-500/20 group-hover:bg-secondary-500 group-hover:text-white transition-all duration-300 text-secondary-600 dark:text-secondary-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Receptionist</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Manage patient registration, walk-ins, and doctor assignments in real-time.</p>

                        <div className="mt-8 flex items-center gap-2 text-secondary-600 dark:text-secondary-400 font-bold text-sm">
                            Launch Terminal
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </div>
                    </button>

                    {/* Doctor Card */}
                    <button
                        onClick={() => handleDummyLogin('doctor')}
                        className="group relative overflow-hidden bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-white/10 hover-lift transition-all text-left"
                    >
                        <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-8 border border-emerald-200/50 dark:border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 text-emerald-600 dark:text-emerald-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Doctor Portal</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Access assigned patient queues, medical history, and e-prescription tools.</p>

                        <div className="mt-8 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                            Open Workstation
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </div>
                    </button>

                    {/* Pharmacy Card */}
                    <button
                        onClick={() => handleDummyLogin('pharmacy')}
                        className="group relative overflow-hidden bg-white/70 dark:bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-xl border border-gray-200 dark:border-white/10 hover-lift transition-all text-left"
                    >
                        <div className="h-16 w-16 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center mb-8 border border-purple-200/50 dark:border-purple-500/20 group-hover:bg-purple-600 group-hover:text-white transition-all duration-300 text-purple-600 dark:text-purple-400">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                        </div>
                        <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3">Pharmacy</h3>
                        <p className="text-gray-500 dark:text-gray-400 leading-relaxed">Dispense medications based on active prescriptions and manage inventory.</p>

                        <div className="mt-8 flex items-center gap-2 text-purple-600 dark:text-purple-400 font-bold text-sm">
                            Manage Dispensary
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>
                        </div>
                    </button>
                </div>

                {showDoctorSelect && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full border border-gray-200 dark:border-white/10 animate-slide-up">
                            <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">Select Your Profile</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">Please pick your account to continue.</p>

                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2 scrollbar-hide">
                                {doctors.map((doc) => (
                                    <button
                                        key={doc.id}
                                        onClick={() => handleDoctorClick(doc)}
                                        className="w-full p-5 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:border-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 text-left transition-all group overflow-hidden relative"
                                    >
                                        <div className="relative z-10 flex items-center gap-4">
                                            <div className="h-12 w-12 bg-secondary-500 rounded-2xl flex items-center justify-center text-white font-bold shrink-0">
                                                {doc.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-900 dark:text-white group-hover:text-secondary-600 transition-colors">Dr. {doc.name}</div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">{doc.specialty || 'General Practitioner'}</div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                                {doctors.length === 0 && (
                                    <div className="text-center py-12 px-6 bg-gray-50 dark:bg-white/5 rounded-3xl border border-dashed border-gray-300 dark:border-white/10">
                                        <div className="text-gray-400 dark:text-gray-500 font-medium italic">No doctors registered yet.</div>
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowDoctorSelect(false)}
                                className="w-full mt-8 py-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Dummy Login Modal */}
                {showDummyLogin.role !== 'none' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-2xl p-10 max-w-sm w-full border border-gray-200 dark:border-white/10 animate-slide-up">
                            <div className="mb-8 text-center">
                                <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2 capitalize">
                                    {selectedDoctor ? `Dr. ${selectedDoctor.name}` : showDummyLogin.role}
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">
                                    {selectedDoctor ? 'Enter your secure passcode' : 'Access Restricted Area'}
                                </p>
                            </div>

                            <input
                                type="password"
                                className="w-full px-6 py-4 rounded-2xl border-2 border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white mb-8 outline-none focus:border-secondary-500 transition-all text-center text-xl tracking-widest"
                                placeholder="••••••••"
                                value={showDummyLogin.pass}
                                onChange={(e) => setShowDummyLogin({ ...showDummyLogin, pass: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && verifyDummyPass()}
                                autoFocus
                            />

                            <div className="space-y-3">
                                <button
                                    onClick={verifyDummyPass}
                                    className="w-full py-4 bg-secondary-700 text-white rounded-2xl font-extrabold shadow-xl shadow-secondary-900/20 hover:bg-secondary-800 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Authenticate
                                </button>
                                <button
                                    onClick={() => {
                                        setShowDummyLogin({ role: 'none', pass: '' });
                                        setSelectedDoctor(null);
                                    }}
                                    className="w-full py-4 bg-gray-50 dark:bg-white/5 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default HospitalDashboardMain;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const PHARMACY_PASSWORD = 'pharmacy@123';

const PharmacyLogin: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (password === PHARMACY_PASSWORD) {
            // Store session with enterprise-scoped key for isolation
            sessionStorage.setItem('enterprise_pharmacy_authenticated', 'true');
            toast.success('Access Granted');
            navigate('/enterprise-dashboard/pharmacy/dashboard');
        } else {
            toast.error('Invalid Password');
        }
        setLoading(false);
    };

    return (
        <div
            className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6"
            style={{
                background: 'linear-gradient(135deg, #f8faf6 0%, #e8f5e0 50%, #f0f7ec 100%)'
            }}
        >
            <div className="w-full max-w-lg">
                {/* Logo & Branding */}
                <div className="flex flex-col items-center justify-center mb-12 animate-fade-in w-full">
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
                        <div className="flex-1 flex justify-start pl-5">
                            <span className="text-[#3d2e2a] text-2xl sm:text-3xl font-black leading-none tracking-tight">
                                {profile?.name || 'Hospital Registry'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Back Button */}
                <button
                    onClick={() => navigate('/enterprise-dashboard')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors group px-4"
                >
                    <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="font-medium">Back to Dashboard</span>
                </button>

                {/* Login Card */}
                <div className="bg-white rounded-[2.5rem] shadow-[0_4px_30px_rgba(0,0,0,0.03),0_1px_3px_rgba(0,0,0,0.02)] border border-gray-100/50 p-6 sm:p-10">
                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-rose-50/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-7 h-7 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Pharmacy Access</h2>
                        <p className="text-gray-400 mt-3 font-medium text-[15px]">Enter your department password</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                                Department Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-rose-500 focus:ring-0 outline-none transition-all text-center text-xl font-bold tracking-[0.2em] placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-normal"
                                placeholder="Enter password"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold hover:bg-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-500/20 active:scale-[0.98]"
                        >
                            {loading ? 'Verifying...' : 'Unlock Pharmacy'}
                        </button>
                    </form>

                    <div className="mt-8 flex items-center justify-center gap-2 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Secure Department Access</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PharmacyLogin;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const RECEPTION_PASSWORD = 'reception@123';

const ReceptionLogin: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useAuth();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (password === RECEPTION_PASSWORD) {
            // Store session with enterprise-scoped key for isolation
            sessionStorage.setItem('enterprise_reception_authenticated', 'true');
            toast.success('Access Granted');
            navigate('/enterprise-dashboard/reception/dashboard');
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
                        <div className="w-16 h-16 bg-orange-50/50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-7 h-7 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Reception Access</h2>
                        <p className="text-gray-400 mt-3 font-medium text-[15px]">Enter your department password</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                                Department Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-xl focus:bg-white focus:border-orange-500 focus:ring-0 outline-none transition-all text-center text-xl font-bold tracking-[0.2em] placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-normal"
                                    placeholder="Enter password"
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

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                        >
                            {loading ? 'Verifying...' : 'Unlock Reception'}
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

export default ReceptionLogin;

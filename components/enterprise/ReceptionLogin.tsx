import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const RECEPTION_PASSWORD = 'reception@123';

const ReceptionLogin: React.FC = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

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
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full">
                {/* Back Button */}
                <button
                    onClick={() => navigate('/enterprise-dashboard')}
                    className="flex items-center gap-2 text-gray-900 hover:text-gray-900 mb-6 transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span className="font-medium">Back to Dashboard</span>
                </button>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900">Reception Access</h2>
                        <p className="text-gray-900 mt-2">Enter your department password to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Department Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-4 border-2 border-gray-100 rounded-xl focus:border-orange-500 focus:ring-0 outline-none transition-colors text-center text-xl font-bold tracking-[0.2em] placeholder:text-gray-300 placeholder:tracking-normal placeholder:font-normal"
                                placeholder="Enter password"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !password}
                            className="w-full py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-500/20"
                        >
                            {loading ? 'Verifying...' : 'Unlock Reception'}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-900">
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

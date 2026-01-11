import React, { useState } from 'react';

interface ClinicLoginProps {
    onBack: () => void;
}

// Demo clinic credentials
const DEMO_CREDENTIALS = {
    email: 'clinic@beanhealth.demo',
    password: 'clinic123'
};

const ClinicLogin: React.FC<ClinicLoginProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // For now, validate against demo credentials
            // TODO: Replace with actual Supabase clinic auth
            if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
                // Store clinic session
                localStorage.setItem('clinicSession', JSON.stringify({
                    email,
                    clinicName: 'Demo Clinic',
                    role: 'admin',
                    loggedInAt: new Date().toISOString()
                }));

                // Navigate to clinic dashboard
                window.location.href = '/clinic';
            } else {
                setError('Invalid credentials. Try: clinic@beanhealth.demo / clinic123');
            }
        } catch (err) {
            console.error('Clinic login error:', err);
            setError('Login failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-4">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    Clinic Portal
                </h2>
                <p className="text-sm !text-gray-500">
                    Sign in to your clinic dashboard
                </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                    <label htmlFor="clinic-email" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Email
                    </label>
                    <input
                        type="email"
                        id="clinic-email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="clinic@example.com"
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-gray-900 placeholder-gray-400"
                    />
                </div>

                {/* Password Field */}
                <div>
                    <label htmlFor="clinic-password" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password
                    </label>
                    <input
                        type="password"
                        id="clinic-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary-500 focus:outline-none transition-colors text-gray-900 placeholder-gray-400"
                    />
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-full font-bold text-base transition-all duration-200 bg-primary-500 hover:bg-primary-600 text-white shadow-lg hover:shadow-xl disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Signing in...
                        </span>
                    ) : (
                        'Sign In to Clinic'
                    )}
                </button>
            </form>

            {/* Demo Credentials Hint */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-500 text-center mb-2">Demo credentials:</p>
                <div className="flex flex-col gap-1 text-xs text-gray-600 font-mono text-center">
                    <span>Email: <strong>clinic@beanhealth.demo</strong></span>
                    <span>Password: <strong>clinic123</strong></span>
                </div>
            </div>

            {/* Back Button */}
            <button
                onClick={onBack}
                className="w-full flex items-center justify-center gap-2 py-3 transition-colors !text-gray-500 hover:text-primary-500"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back to options</span>
            </button>
        </div>
    );
};

export default ClinicLogin;

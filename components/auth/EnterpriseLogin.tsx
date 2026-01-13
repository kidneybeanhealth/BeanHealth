import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface EnterpriseLoginProps {
    onSwitchToChooser: () => void;
}

const EnterpriseLogin: React.FC<EnterpriseLoginProps> = ({ onSwitchToChooser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter both email and password');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            // Successful login will be handled by AuthContext state change
            toast.success('Welcome to Enterprise Portal');

        } catch (error: any) {
            console.error('Enterprise login error:', error);
            toast.error(error.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header - No Logo as requested */}
            <div className="text-center pt-2">
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    Enterprise Login
                </h2>
                <p className="text-sm !text-gray-500">
                    Hospital Administration Access
                </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email ID
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-200 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="admin@hospital.com"
                        autoComplete="email"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-secondary-500 focus:ring-2 focus:ring-secondary-200 outline-none transition-all text-gray-900 placeholder-gray-400"
                        placeholder="••••••••"
                        autoComplete="current-password"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200 bg-secondary-900 hover:bg-secondary-800 text-white shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Signing in...</span>
                        </>
                    ) : (
                        <span>Sign In</span>
                    )}
                </button>
            </form>

            {/* Security Badge */}
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl bg-gray-50 border border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-500 text-xs font-medium">Secure Enterprise Gateway</span>
            </div>

            {/* Back Button */}
            <button
                type="button"
                onClick={onSwitchToChooser}
                className="w-full flex items-center justify-center gap-2 py-2 transition-colors !text-gray-500 hover:text-secondary-900"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm">Back to role selection</span>
            </button>
        </div>
    );
};

export default EnterpriseLogin;

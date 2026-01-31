import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface EnterpriseLoginProps {
    onSwitchToChooser: () => void;
}

const EnterpriseLogin: React.FC<EnterpriseLoginProps> = ({ onSwitchToChooser }) => {
    const navigate = useNavigate();
    const { user, profile, isInitialized, loading: authLoading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const hasNavigatedRef = useRef(false);

    // Effect to navigate when auth state updates after successful login
    useEffect(() => {
        // Only navigate if:
        // 1. Auth is initialized and not loading
        // 2. We have a user and profile
        // 3. Profile role is enterprise
        // 4. We haven't already navigated
        if (
            isInitialized &&
            !authLoading &&
            user &&
            profile?.role === 'enterprise' &&
            !hasNavigatedRef.current
        ) {
            console.log('[EnterpriseLogin] Auth state updated, navigating to dashboard');
            hasNavigatedRef.current = true;
            navigate('/enterprise-dashboard', { replace: true });
        }
    }, [isInitialized, authLoading, user, profile, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) {
            toast.error('Please enter both email and password');
            return;
        }

        setLoading(true);
        const toastId = toast.loading('Signing in...');

        try {
            // PRODUCTION FIX: Clear any stale enterprise session data before new login
            // This prevents cached data from interfering with fresh logins
            try {
                sessionStorage.removeItem('enterprise_reception_authenticated');
                sessionStorage.removeItem('enterprise_pharmacy_authenticated');
                // Clear any doctor sessions (pattern: enterprise_doctor_session_*)
                Object.keys(sessionStorage).forEach(key => {
                    if (key.startsWith('enterprise_doctor_session_')) {
                        sessionStorage.removeItem(key);
                    }
                });
            } catch (e) {
                console.warn('[EnterpriseLogin] Could not clear session storage:', e);
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });

            if (error) {
                // Handle specific Supabase auth errors
                if (error.message?.includes('Invalid login credentials')) {
                    throw new Error('Invalid email or password');
                }
                if (error.message?.includes('Email not confirmed')) {
                    throw new Error('Please verify your email before logging in');
                }
                throw error;
            }

            if (!data.user || !data.session) {
                throw new Error('Login failed - please try again');
            }

            // PRODUCTION FIX: Wait a moment for Supabase to fully establish the session
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify user has enterprise role before showing success
            // Use retry logic for production reliability
            let userProfile: { role: string } | null = null;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                const { data: profileData, error: profileError } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (!profileError && profileData) {
                    userProfile = profileData as { role: string };
                    break;
                }

                if (profileError?.code === 'PGRST116') {
                    // No profile found - user needs setup
                    throw new Error('Account setup incomplete. Please contact support.');
                }

                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
                }
            }

            if (!userProfile) {
                console.error('Profile fetch failed after retries');
                throw new Error('Failed to verify account - please try again');
            }

            if (userProfile.role !== 'enterprise') {
                // Sign out immediately if not enterprise
                await supabase.auth.signOut();
                throw new Error('This account is not an Enterprise account. Please use the correct login portal.');
            }

            // Success - show toast and let the useEffect handle navigation
            toast.success('Welcome to Enterprise Portal', { id: toastId });

            // Force navigation after a short delay if useEffect doesn't catch it
            setTimeout(() => {
                if (!hasNavigatedRef.current) {
                    console.log('[EnterpriseLogin] Forcing navigation after timeout');
                    hasNavigatedRef.current = true;
                    navigate('/enterprise-dashboard', { replace: true });
                }
            }, 500);

        } catch (error: any) {
            console.error('Enterprise login error:', error);
            toast.error(error.message || 'Failed to sign in', { id: toastId });
            setLoading(false);
            hasNavigatedRef.current = false; // Reset navigation flag on error
        }
        // Note: Don't set loading to false on success - let the navigation happen
    };

    return (
        <div className="space-y-6">
            {/* Header - No Logo as requested */}
            <div className="text-center pt-2">
                <h2 className="text-2xl font-semibold mb-1 !text-gray-900">
                    Enterprise Login
                </h2>
                <p className="text-sm !text-gray-900">
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
                <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-gray-900 text-xs font-medium">Secure Enterprise Gateway</span>
            </div>

            {/* Back Button */}
            <button
                type="button"
                onClick={onSwitchToChooser}
                className="w-full flex items-center justify-center gap-2 py-2 transition-colors !text-gray-900 hover:text-secondary-900"
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

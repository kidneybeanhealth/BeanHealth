import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles?: ('patient' | 'doctor' | 'admin' | 'enterprise')[];
    redirectTo?: string;
}

/**
 * ProtectedRoute component that guards routes based on authentication and role.
 * Redirects unauthenticated users to login, and unauthorized users to their appropriate dashboard.
 * 
 * Enhanced for enterprise stability:
 * - Waits for auth AND profile to be fully stable before making redirect decisions
 * - Prevents flash of loading/redirect during auth state changes
 * - Uses stable ready state to avoid infinite loops
 * - Properly handles the transition period after login where profile is being loaded
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    redirectTo = '/'
}) => {
    const { user, profile, loading, isInitialized } = useAuth();
    const location = useLocation();
    const [isStable, setIsStable] = useState(false);

    // Wait for auth AND profile to stabilize before making any decisions
    // This prevents race conditions where components try to access profile before it's loaded
    useEffect(() => {
        // Only consider stable when:
        // 1. Auth is initialized and not loading
        // 2. Either we have a profile OR we don't have a user (logged out)
        const isProfileReady = !user || !!profile;

        if (isInitialized && !loading && isProfileReady) {
            // Delay to ensure auth state is fully stable after login
            // Increased to 100ms to handle slower profile fetches
            const timer = setTimeout(() => {
                setIsStable(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setIsStable(false);
        }
    }, [isInitialized, loading, user, profile]);

    // Show loading while auth is initializing, loading, or profile is pending
    // This is the key fix - we wait for profile to be available for authenticated users
    if (loading || !isInitialized || !isStable || (user && !profile)) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium">Loading...</p>
                </div>
            </div>
        );
    }

    // Not authenticated - redirect to login
    if (!user) {
        return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Check role-based access if allowedRoles specified
    if (allowedRoles && profile?.role && !allowedRoles.includes(profile.role as any)) {
        // Redirect to appropriate dashboard based on actual role
        const dashboardMap: Record<string, string> = {
            patient: '/patient',
            doctor: '/doctor',
            admin: '/admin-dashboard',
            enterprise: '/enterprise-dashboard'
        };
        const correctDashboard = dashboardMap[profile.role] || '/';
        return <Navigate to={correctDashboard} replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;

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
 * - Waits for auth to be fully stable before making redirect decisions
 * - Prevents flash of loading/redirect during auth state changes
 * - Uses stable ready state to avoid infinite loops
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    redirectTo = '/'
}) => {
    const { user, profile, loading, isInitialized } = useAuth();
    const location = useLocation();
    const [isStable, setIsStable] = useState(false);

    // Wait for auth to stabilize before making any decisions
    useEffect(() => {
        if (isInitialized && !loading) {
            // Small delay to ensure auth state is fully stable
            // This prevents premature redirects during token refresh
            const timer = setTimeout(() => {
                setIsStable(true);
            }, 100);
            return () => clearTimeout(timer);
        } else {
            setIsStable(false);
        }
    }, [isInitialized, loading]);

    // Show loading while auth is initializing or stabilizing
    if (loading || !isInitialized || !isStable) {
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

import React from 'react';
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
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    redirectTo = '/'
}) => {
    const { user, profile, loading, isInitialized } = useAuth();
    const location = useLocation();

    // Show loading while auth is initializing
    if (loading || !isInitialized) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
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

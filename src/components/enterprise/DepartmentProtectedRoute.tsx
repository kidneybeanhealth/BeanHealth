import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface DepartmentProtectedRouteProps {
    children: React.ReactNode;
    department: 'reception' | 'pharmacy';
}

/**
 * Protected route for department dashboards
 * Checks if department session is authenticated
 * 
 * Enhanced for enterprise stability:
 * - Waits for auth to be fully initialized before checking
 * - Prevents premature redirects during auth state changes
 * - Uses stable session storage keys
 */
const DepartmentProtectedRoute: React.FC<DepartmentProtectedRouteProps> = ({ children, department }) => {
    const { loading, isInitialized, profile } = useAuth();
    const [isReady, setIsReady] = useState(false);
    
    // Session key scoped to enterprise to prevent conflicts
    const sessionKey = `enterprise_${department}_authenticated`;
    const isAuthenticated = sessionStorage.getItem(sessionKey) === 'true';
    
    // Wait for auth to stabilize before rendering
    useEffect(() => {
        if (isInitialized && !loading) {
            // Small delay to ensure auth state is stable
            const timer = setTimeout(() => setIsReady(true), 50);
            return () => clearTimeout(timer);
        }
    }, [isInitialized, loading]);

    // Show loading while auth is initializing
    if (!isReady || loading || !isInitialized) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">Loading {department}...</p>
                </div>
            </div>
        );
    }

    // Verify enterprise role
    if (profile?.role !== 'enterprise') {
        return <Navigate to="/" replace />;
    }

    if (!isAuthenticated) {
        return <Navigate to={`/enterprise-dashboard/${department}`} replace />;
    }

    return <>{children}</>;
};

export default DepartmentProtectedRoute;

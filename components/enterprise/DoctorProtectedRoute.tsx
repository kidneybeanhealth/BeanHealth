import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface DoctorProtectedRouteProps {
    children: React.ReactNode;
}

// Session timeout: 4 hours
const DOCTOR_SESSION_TIMEOUT = 4 * 60 * 60 * 1000;

/**
 * Protected route for doctor dashboards
 * Checks if doctor session is authenticated
 * 
 * Enhanced for enterprise stability:
 * - Waits for auth to be fully initialized before checking
 * - Prevents premature redirects during auth state changes
 * - Uses stable session validation
 */
const DoctorProtectedRoute: React.FC<DoctorProtectedRouteProps> = ({ children }) => {
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile, loading, isInitialized } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [isValidSession, setIsValidSession] = useState<boolean | null>(null);

    // Wait for auth to stabilize before checking session
    useEffect(() => {
        if (isInitialized && !loading && profile) {
            // Small delay to ensure auth state is stable
            const timer = setTimeout(() => {
                setIsReady(true);
                validateSession();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isInitialized, loading, profile, doctorId]);

    const validateSession = () => {
        if (!doctorId || !profile?.id) {
            setIsValidSession(false);
            return;
        }

        const sessionKey = `enterprise_doctor_session_${profile.id}`;
        const savedSession = sessionStorage.getItem(sessionKey);

        if (!savedSession) {
            setIsValidSession(false);
            return;
        }

        try {
            const { doctorId: savedDoctorId, timestamp } = JSON.parse(savedSession);
            const isValid = savedDoctorId === doctorId &&
                (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

            if (!isValid) {
                sessionStorage.removeItem(sessionKey);
            }
            setIsValidSession(isValid);
        } catch (e) {
            sessionStorage.removeItem(sessionKey);
            setIsValidSession(false);
        }
    };

    // Show loading while auth is initializing or session is being validated
    if (!isReady || loading || !isInitialized || isValidSession === null) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
                    <p className="text-gray-900 dark:text-gray-100 font-medium text-sm">Loading doctor dashboard...</p>
                </div>
            </div>
        );
    }

    // Verify enterprise role
    if (profile?.role !== 'enterprise') {
        return <Navigate to="/" replace />;
    }

    if (!doctorId) {
        return <Navigate to="/enterprise-dashboard/doctors" replace />;
    }

    if (!isValidSession) {
        return <Navigate to={`/enterprise-dashboard/doctors/${doctorId}`} replace />;
    }

    return <>{children}</>;
};

export default DoctorProtectedRoute;

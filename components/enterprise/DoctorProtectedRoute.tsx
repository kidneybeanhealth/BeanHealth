import React from 'react';
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
 */
const DoctorProtectedRoute: React.FC<DoctorProtectedRouteProps> = ({ children }) => {
    const { doctorId } = useParams<{ doctorId: string }>();
    const { profile } = useAuth();

    if (!doctorId) {
        return <Navigate to="/enterprise-dashboard/doctors" replace />;
    }

    const sessionKey = `enterprise_doctor_session_${profile?.id}`;
    const savedSession = sessionStorage.getItem(sessionKey);

    if (!savedSession) {
        return <Navigate to={`/enterprise-dashboard/doctors/${doctorId}`} replace />;
    }

    try {
        const { doctorId: savedDoctorId, timestamp } = JSON.parse(savedSession);
        const isValid = savedDoctorId === doctorId &&
            (Date.now() - timestamp) < DOCTOR_SESSION_TIMEOUT;

        if (!isValid) {
            sessionStorage.removeItem(sessionKey);
            return <Navigate to={`/enterprise-dashboard/doctors/${doctorId}`} replace />;
        }
    } catch (e) {
        sessionStorage.removeItem(sessionKey);
        return <Navigate to={`/enterprise-dashboard/doctors/${doctorId}`} replace />;
    }

    return <>{children}</>;
};

export default DoctorProtectedRoute;

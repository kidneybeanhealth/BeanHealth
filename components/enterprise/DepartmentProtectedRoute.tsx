import React from 'react';
import { Navigate } from 'react-router-dom';

interface DepartmentProtectedRouteProps {
    children: React.ReactNode;
    department: 'reception' | 'pharmacy';
}

/**
 * Protected route for department dashboards
 * Checks if department session is authenticated
 */
const DepartmentProtectedRoute: React.FC<DepartmentProtectedRouteProps> = ({ children, department }) => {
    const sessionKey = `${department}_authenticated`;
    const isAuthenticated = sessionStorage.getItem(sessionKey) === 'true';

    if (!isAuthenticated) {
        return <Navigate to={`/enterprise-dashboard/${department}`} replace />;
    }

    return <>{children}</>;
};

export default DepartmentProtectedRoute;

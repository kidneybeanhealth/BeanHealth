import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Auth Components
import Auth from '../components/auth/Auth';
import AuthChooser from '../components/auth/AuthChooser';
import Login from '../components/auth/Login';
import EnterpriseLogin from '../components/auth/EnterpriseLogin';
import AdminLogin from '../components/auth/AdminLogin';
import ProfileSetup from '../components/auth/ProfileSetup';

// Dashboard Components
import PatientDashboard from '../components/PatientDashboard';
import DoctorDashboardMain from '../components/DoctorDashboardMain';
import AdminDashboardMain from '../components/AdminDashboardMain';

// Enterprise Components
import {
    EnterpriseDashboardHome,
    ReceptionLogin,
    ReceptionDashboard,
    PharmacyLogin,
    PharmacyDashboard,
    DoctorLogin,
    DoctorDashboardWrapper,
    DepartmentProtectedRoute,
    DoctorProtectedRoute
} from '../components/enterprise';

// Route Guards
import ProtectedRoute from '../components/ProtectedRoute';

// Onboarding
import OnboardingFlow from '../components/OnboardingFlow';
import TermsAndConditionsModal from '../components/TermsAndConditionsModal';

/**
 * AuthRedirect - Redirects authenticated users to their dashboard
 */
const AuthRedirect: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading, isInitialized, needsProfileSetup } = useAuth();

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

    // If user is authenticated and has a profile, redirect to dashboard
    if (user && profile && !needsProfileSetup) {
        const dashboardMap: Record<string, string> = {
            patient: '/patient',
            doctor: '/doctor',
            admin: '/admin-dashboard',
            enterprise: '/enterprise-dashboard'
        };
        const dashboard = dashboardMap[profile.role] || '/';
        return <Navigate to={dashboard} replace />;
    }

    // If needs profile setup, redirect there
    if (user && needsProfileSetup) {
        return <Navigate to="/setup" replace />;
    }

    return <>{children}</>;
};

/**
 * ProfileSetupRoute - For users who need to complete profile setup
 */
const ProfileSetupRoute: React.FC = () => {
    const { user, needsProfileSetup, loading, isInitialized } = useAuth();

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

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (!needsProfileSetup) {
        return <Navigate to="/" replace />;
    }

    return <ProfileSetup />;
};

/**
 * Main App Routes Configuration
 */
const AppRoutes: React.FC = () => {
    const { needsOnboarding, needsTermsAcceptance, acceptTerms, profile } = useAuth();

    return (
        <Routes>
            {/* ============ PUBLIC AUTH ROUTES ============ */}

            {/* Landing / Role Chooser */}
            <Route
                path="/"
                element={
                    <AuthRedirect>
                        <Auth />
                    </AuthRedirect>
                }
            />

            {/* Patient/Doctor Login */}
            <Route
                path="/login"
                element={
                    <AuthRedirect>
                        <Auth initialView="login" />
                    </AuthRedirect>
                }
            />

            {/* Enterprise Login */}
            <Route
                path="/enterprise"
                element={
                    <AuthRedirect>
                        <Auth initialView="enterprise-login" />
                    </AuthRedirect>
                }
            />

            {/* Admin Login */}
            <Route
                path="/admin"
                element={
                    <AuthRedirect>
                        <Auth initialView="admin-login" />
                    </AuthRedirect>
                }
            />

            {/* Profile Setup */}
            <Route path="/setup" element={<ProfileSetupRoute />} />

            {/* ============ PROTECTED DASHBOARD ROUTES ============ */}

            {/* Patient Dashboard */}
            <Route
                path="/patient/*"
                element={
                    <ProtectedRoute allowedRoles={['patient']}>
                        {needsTermsAcceptance ? (
                            <TermsAndConditionsModal
                                isOpen={true}
                                onAccept={acceptTerms}
                                userName={profile?.name}
                            />
                        ) : (
                            <>
                                <div className={needsOnboarding ? 'filter blur-sm pointer-events-none select-none h-screen overflow-hidden' : ''}>
                                    <PatientDashboard />
                                </div>
                                {needsOnboarding && (
                                    <div className="fixed inset-0 z-[9999]">
                                        <OnboardingFlow />
                                    </div>
                                )}
                            </>
                        )}
                    </ProtectedRoute>
                }
            />

            {/* Doctor Dashboard */}
            <Route
                path="/doctor/*"
                element={
                    <ProtectedRoute allowedRoles={['doctor']}>
                        <>
                            <div className={needsOnboarding ? 'filter blur-sm pointer-events-none select-none h-screen overflow-hidden' : ''}>
                                <DoctorDashboardMain />
                            </div>
                            {needsOnboarding && (
                                <div className="fixed inset-0 z-[9999]">
                                    <OnboardingFlow />
                                </div>
                            )}
                        </>
                    </ProtectedRoute>
                }
            />

            {/* Admin Dashboard */}
            <Route
                path="/admin-dashboard/*"
                element={
                    <ProtectedRoute allowedRoles={['admin']}>
                        <AdminDashboardMain />
                    </ProtectedRoute>
                }
            />

            {/* Enterprise Dashboard & Sub-routes */}
            <Route
                path="/enterprise-dashboard"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <EnterpriseDashboardHome />
                    </ProtectedRoute>
                }
            />

            {/* Reception Routes */}
            <Route
                path="/enterprise-dashboard/reception"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <ReceptionLogin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/enterprise-dashboard/reception/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <DepartmentProtectedRoute department="reception">
                            <ReceptionDashboard />
                        </DepartmentProtectedRoute>
                    </ProtectedRoute>
                }
            />

            {/* Pharmacy Routes */}
            <Route
                path="/enterprise-dashboard/pharmacy"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <PharmacyLogin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/enterprise-dashboard/pharmacy/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <DepartmentProtectedRoute department="pharmacy">
                            <PharmacyDashboard />
                        </DepartmentProtectedRoute>
                    </ProtectedRoute>
                }
            />

            {/* Doctor Routes */}
            <Route
                path="/enterprise-dashboard/doctors"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <DoctorLogin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/enterprise-dashboard/doctors/:doctorId"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <DoctorLogin />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/enterprise-dashboard/doctors/:doctorId/dashboard"
                element={
                    <ProtectedRoute allowedRoles={['enterprise']}>
                        <DoctorProtectedRoute>
                            <DoctorDashboardWrapper />
                        </DoctorProtectedRoute>
                    </ProtectedRoute>
                }
            />

            {/* ============ FALLBACK ============ */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
};

export default AppRoutes;

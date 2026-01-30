import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Auth Components - kept eager as they're needed immediately
import Auth from '../components/auth/Auth';
import AuthChooser from '../components/auth/AuthChooser';
import Login from '../components/auth/Login';
import EnterpriseLogin from '../components/auth/EnterpriseLogin';
import AdminLogin from '../components/auth/AdminLogin';
import ProfileSetup from '../components/auth/ProfileSetup';
import LandingPage from '../components/landing/LandingPage';

// Dashboard Components - LAZY LOADED for faster initial load
const PatientDashboard = React.lazy(() => import('../components/PatientDashboard'));
const DoctorDashboardMain = React.lazy(() => import('../components/DoctorDashboardMain'));
const AdminDashboardMain = React.lazy(() => import('../components/AdminDashboardMain'));

// Enterprise Components - LAZY LOADED
const EnterpriseDashboardHome = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.EnterpriseDashboardHome }))
);
const ReceptionLogin = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.ReceptionLogin }))
);
const ReceptionDashboard = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.ReceptionDashboard }))
);
const PharmacyLogin = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.PharmacyLogin }))
);
const PharmacyDashboard = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.PharmacyDashboard }))
);
const PharmacyQueueDisplay = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.PharmacyQueueDisplay }))
);
const DoctorLogin = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.DoctorLogin }))
);
const DoctorDashboardWrapper = React.lazy(() =>
    import('../components/enterprise').then(m => ({ default: m.DoctorDashboardWrapper }))
);

// These are needed synchronously for route protection
import { DepartmentProtectedRoute, DoctorProtectedRoute } from '../components/enterprise';

// Route Guards
import ProtectedRoute from '../components/ProtectedRoute';

// Onboarding - LAZY LOADED
const OnboardingFlow = React.lazy(() => import('../components/OnboardingFlow'));
const TermsAndConditionsModal = React.lazy(() => import('../components/modals/TermsAndConditionsModal'));

// Loading fallback component for lazy-loaded routes
const PageLoader: React.FC = () => (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
            <p className="text-gray-900 dark:text-gray-100 font-medium">Loading...</p>
        </div>
    </div>
);

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
                    <p className="text-gray-900 dark:text-gray-100 font-medium">Loading...</p>
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
                    <p className="text-gray-900 dark:text-gray-100 font-medium">Loading...</p>
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
 * Wrapped in Suspense for lazy-loaded components
 */
const AppRoutes: React.FC = () => {
    const { needsOnboarding, needsTermsAcceptance, acceptTerms, profile } = useAuth();

    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* ============ PUBLIC AUTH ROUTES ============ */}

                {/* Landing / Role Chooser */}
                <Route
                    path="/"
                    element={
                        <AuthRedirect>
                            <LandingPage />
                        </AuthRedirect>
                    }
                />

                {/* Auth Role Chooser */}
                <Route
                    path="/start"
                    element={
                        <AuthRedirect>
                            <Auth initialView="chooser" />
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
                {/* Pharmacy Queue Display - for patient waiting area */}
                <Route
                    path="/enterprise-dashboard/pharmacy/display"
                    element={
                        <ProtectedRoute allowedRoles={['enterprise']}>
                            <PharmacyQueueDisplay />
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
        </Suspense>
    );
};

export default AppRoutes;

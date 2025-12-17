/**
 * Main App Component
 * 
 * FIXES APPLIED:
 * - Reduced loading timeout from 15s to 8s
 * - Simplified conditional logic for auth state rendering
 * - Added isInitialized check from AuthContext
 * - Improved loading state management
 * 
 * WHY: Prevents excessive waiting and provides clearer auth state transitions
 */

import React from 'react';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import Auth from './components/auth/Auth';
import ProfileSetup from './components/auth/ProfileSetup';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboardMain from './components/DoctorDashboardMain';
import AdminDashboardMain from './components/AdminDashboardMain';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';

const AppContent: React.FC = () => {
  const { user, profile, loading, needsProfileSetup, isInitialized } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  // Handle deep link for OAuth callback on mobile
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async (event: { url: string }) => {
      console.log('[App] Deep link received:', event.url);

      // Check if this is an OAuth callback
      if (event.url.includes('oauth-callback')) {
        // Close the browser
        await Browser.close();

        // Extract the URL fragments (Supabase auth tokens)
        const url = new URL(event.url);
        const fragment = url.hash.substring(1); // Remove the # symbol

        // Parse fragment into params
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('[App] Setting session from deep link');
          // Set the session in Supabase
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
        }
      }
    };

    // Listen for app URL open events
    CapacitorApp.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  // Add a timeout to prevent infinite loading (8s for better UX)
  // This is a safety net in case auth initialization hangs
  React.useEffect(() => {
    // Only set timeout if we're still in loading state
    if (!loading && isInitialized) {
      // Auth completed successfully, no timeout needed
      return;
    }

    const timer = setTimeout(() => {
      if (loading || !isInitialized) {
        console.warn('[App] Loading timeout reached after 8 seconds - falling back to login');
        setLoadingTimeout(true);
      }
    }, 8000);

    return () => clearTimeout(timer);
  }, [loading, isInitialized]);

  // Debug logging
  React.useEffect(() => {
    console.log('=== APP STATE ===');
    console.log('User:', user ? { id: user.id, email: user.email } : 'null');
    console.log('Profile:', profile ? { id: profile.id, role: profile.role, name: profile.name } : 'null');
    console.log('Loading:', loading);
    console.log('Initialized:', isInitialized);
    console.log('Needs Profile Setup:', needsProfileSetup);
    console.log('Loading Timeout:', loadingTimeout);
    console.log('==================');
  }, [user, profile, loading, isInitialized, needsProfileSetup, loadingTimeout]);

  // Show loading screen while authentication is being determined
  // But only if we haven't timed out and aren't initialized yet
  if ((loading || !isInitialized) && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading your account...</p>
        </div>
      </div>
    );
  }

  // If we have a loading timeout but still have a user and profile, proceed with the app
  // This prevents getting stuck in loading state
  if (loadingTimeout && user && profile && !needsProfileSetup) {
    console.log('[App] Loading timeout reached but user exists, proceeding to dashboard');
  }

  // Not authenticated - show auth flow
  if (!user) {
    console.log('[App] No user found, showing Auth');
    return <Auth />;
  }

  // Authenticated but needs profile setup
  if (needsProfileSetup) {
    console.log('[App] User needs profile setup');
    return <ProfileSetup />;
  }

  // Authenticated and profile complete - show dashboard
  console.log('[App] User authenticated with profile, showing dashboard for role:', profile?.role);

  // Extra validation to ensure profile is complete
  if (profile?.role === 'doctor') {
    console.log('[App] Rendering DoctorDashboardMain');
    return <DoctorDashboardMain />;
  } else if (profile?.role === 'admin') {
    console.log('[App] Rendering AdminDashboardMain');
    return <AdminDashboardMain />;
  } else if (profile?.role === 'patient') {
    console.log('[App] Rendering PatientDashboard');
    return <PatientDashboard />;
  } else {
    console.log('[App] Profile exists but no valid role, showing ProfileSetup');
    return <ProfileSetup />;
  }
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <DataProvider>
            <Toaster
              position="top-right"
              reverseOrder={false}
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#363636',
                  color: '#fff',
                },
              }}
            />
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
              <AppContent />
            </div>
          </DataProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

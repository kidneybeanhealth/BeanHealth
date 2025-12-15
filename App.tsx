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
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';

const AppContent: React.FC = () => {
  const { user, profile, loading, needsProfileSetup } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  // Handle deep link for OAuth callback on mobile
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const handleAppUrlOpen = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      
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
          console.log('Setting session from deep link');
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

  // Add a longer timeout to prevent infinite loading, but be more forgiving
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.warn('Loading timeout reached after 15 seconds');
        setLoadingTimeout(true);
      }
    }, 15000); // Increased to 15 seconds for better reliability

    return () => clearTimeout(timer);
  }, [loading]);

  // Reset loading timeout when loading state changes
  React.useEffect(() => {
    if (!loading) {
      setLoadingTimeout(false);
    }
  }, [loading]);

  // Debug logging
  React.useEffect(() => {
    console.log('=== APP STATE ===');
    console.log('User:', user ? { id: user.id, email: user.email } : 'null');
    console.log('Profile:', profile ? { id: profile.id, role: profile.role, name: profile.name } : 'null');
    console.log('Loading:', loading);
    console.log('Needs Profile Setup:', needsProfileSetup);
    console.log('Loading Timeout:', loadingTimeout);
    console.log('==================');
  }, [user, profile, loading, needsProfileSetup, loadingTimeout]);

  // Show loading screen while authentication is being determined
  if (loading && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Loading your account...</p>
        </div>
      </div>
    );
  }

  // If we have a loading timeout but still have a user, proceed with the app
  // This prevents getting stuck in loading state
  if (loadingTimeout && user && profile) {
    console.log('Loading timeout reached but user exists, proceeding to dashboard');
  }

  // Not authenticated - show auth flow
  if (!user) {
    console.log('No user found, showing Auth');
    return <Auth />;
  }

  // Authenticated but needs profile setup
  if (needsProfileSetup) {
    console.log('User needs profile setup');
    return <ProfileSetup />;
  }

  // Authenticated and profile complete - show dashboard
  console.log('User authenticated with profile, showing dashboard for role:', profile?.role);
  
  // Extra validation to ensure profile is complete
  if (profile?.role === 'doctor') {
    console.log('Rendering DoctorDashboardMain');
    return <DoctorDashboardMain />;
  } else if (profile?.role === 'patient') {
    console.log('Rendering PatientDashboard');
    return <PatientDashboard />;
  } else {
    console.log('Profile exists but no valid role, showing ProfileSetup');
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
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
              <AppContent />
            </div>
          </DataProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

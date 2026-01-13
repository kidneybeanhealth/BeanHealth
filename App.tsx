/**
 * Main App Component
 * 
 * OAuth flow now handled by AuthService with browserFinished detection.
 * Deep link handler kept as backup but primary flow is browser close detection.
 */

import React from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import TermsAndConditionsModal from './components/TermsAndConditionsModal';
import Auth from './components/auth/Auth';
import ProfileSetup from './components/auth/ProfileSetup';
import OnboardingFlow from './components/OnboardingFlow';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboardMain from './components/DoctorDashboardMain';
import AdminDashboardMain from './components/AdminDashboardMain';
import EnterpriseDashboardMain from './components/EnterpriseDashboardMain';
import ReturnToAdminButton from './components/ReturnToAdminButton';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';
import { useDocumentTitle } from './hooks/useDocumentTitle';

const AppContent: React.FC = () => {
  const { user, profile, loading, needsProfileSetup, needsOnboarding, isInitialized, needsTermsAcceptance, acceptTerms, checkAuth } = useAuth();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  // Dynamic document title based on app state
  const getAppTitle = () => {
    if (loading || !isInitialized) return 'Loading...';
    if (!user) return 'Get Started'; // Default for Auth view
    if (needsProfileSetup) return 'Set Up Your Profile';
    if (needsOnboarding) return 'Welcome to BeanHealth';

    if (profile?.role === 'doctor') return 'Doctor Portal';
    if (profile?.role === 'admin') return 'Admin Dashboard';
    if (profile?.role === 'enterprise') return 'Enterprise Portal';
    if (profile?.role === 'patient') return 'Patient Portal';

    return 'Healthcare Management';
  };

  useDocumentTitle(getAppTitle());

  // Check for launch URL on mount (handles cold start deep links)
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const checkLaunchUrl = async () => {
      try {
        const urlResult = await CapacitorApp.getLaunchUrl();
        if (urlResult?.url) {
          console.log('[App] Launch URL found:', urlResult.url);
          await handleDeepLink(urlResult.url);
        }
      } catch (e) {
        console.log('[App] No launch URL or error:', e);
      }
    };

    checkLaunchUrl();
  }, []);

  // Handle deep links while app is running
  React.useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('appUrlOpen', async (event) => {
      console.log('[App] App URL open:', event.url);
      await handleDeepLink(event.url);
    });

    return () => {
      listener.then(l => l.remove());
    };
  }, []);

  // Deep link handler function - Fixed for Android OAuth
  const handleDeepLink = async (url: string) => {
    console.log('[App] Processing deep link:', url);

    // Check if this is our OAuth callback
    if (!url.includes('oauth-callback') && !url.includes('com.beanhealth.app://')) {
      console.log('[App] Not an OAuth callback URL, ignoring');
      return;
    }

    toast.loading('Completing login...', { id: 'oauth' });

    // Close the browser first
    try {
      await Browser.close();
      console.log('[App] Browser closed');
    } catch (e) {
      console.log('[App] Browser might already be closed:', e);
    }

    try {
      // Parse the URL manually for custom schemes (new URL() doesn't work for custom schemes)
      let queryString = '';
      let hashString = '';

      // Handle custom scheme URLs like: com.beanhealth.app://oauth-callback?code=xxx
      if (url.includes('?')) {
        const queryStart = url.indexOf('?');
        const hashStart = url.indexOf('#', queryStart);
        if (hashStart !== -1) {
          queryString = url.substring(queryStart + 1, hashStart);
          hashString = url.substring(hashStart + 1);
        } else {
          queryString = url.substring(queryStart + 1);
        }
      } else if (url.includes('#')) {
        hashString = url.substring(url.indexOf('#') + 1);
      }

      console.log('[App] Query string:', queryString);
      console.log('[App] Hash string:', hashString);

      const searchParams = new URLSearchParams(queryString);
      const hashParams = new URLSearchParams(hashString);

      // Check for error in callback
      const error = searchParams.get('error') || hashParams.get('error');
      const errorDescription = searchParams.get('error_description') || hashParams.get('error_description');
      if (error) {
        console.error('[App] OAuth error:', error, errorDescription);
        toast.error(errorDescription || error, { id: 'oauth' });
        return;
      }

      // Try PKCE code first (this is what Supabase uses by default)
      const code = searchParams.get('code') || hashParams.get('code');
      if (code) {
        console.log('[App] Found auth code, exchanging for session...');
        console.log('[App] Code (first 20 chars):', code.substring(0, 20) + '...');

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[App] Code exchange error:', exchangeError);
          toast.error('Login failed: ' + exchangeError.message, { id: 'oauth' });
          return;
        }

        console.log('[App] Session exchange successful!');
        console.log('[App] User ID:', data.session?.user?.id);

        toast.success('Login successful!', { id: 'oauth' });

        // Wait a moment for session to persist, then refresh
        await new Promise(r => setTimeout(r, 500));

        // Force a full refresh to pick up the new session
        window.location.reload();
        return;
      }

      // Try implicit flow tokens (fallback)
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[App] Found access tokens, setting session...');

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (sessionError) {
          console.error('[App] Set session error:', sessionError);
          toast.error('Login failed: ' + sessionError.message, { id: 'oauth' });
          return;
        }

        toast.success('Login successful!', { id: 'oauth' });
        await new Promise(r => setTimeout(r, 500));
        window.location.reload();
        return;
      }

      // No auth data found - check if we already have a session
      console.log('[App] No auth data in URL, checking for existing session...');
      const { data: sessionData } = await supabase.auth.getSession();

      if (sessionData.session) {
        console.log('[App] Existing session found!');
        toast.success('Login successful!', { id: 'oauth' });
        await new Promise(r => setTimeout(r, 500));
        window.location.reload();
      } else {
        console.log('[App] No session found after OAuth callback');
        toast.dismiss('oauth');
      }
    } catch (error) {
      console.error('[App] Deep link processing error:', error);
      toast.error('Login error. Please try again.', { id: 'oauth' });
    }
  };

  // Timeout for loading
  React.useEffect(() => {
    if (!loading && isInitialized) return;

    const timer = setTimeout(() => {
      if (loading || !isInitialized) {
        setLoadingTimeout(true);
      }
    }, 10000);

    return () => clearTimeout(timer);
  }, [loading, isInitialized]);

  // Loading state
  if ((loading || !isInitialized) && !loadingTimeout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-white mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Auth />;
  }

  // Needs profile setup (first-time users who haven't selected a role)
  if (needsProfileSetup) {
    return <ProfileSetup />;
  }

  // Define Dashboard Component
  let DashboardComponent;
  if (profile?.role === 'doctor') {
    DashboardComponent = <DoctorDashboardMain />;
  } else if (profile?.role === 'admin') {
    DashboardComponent = <AdminDashboardMain />;
  } else if (profile?.role === 'enterprise') {
    DashboardComponent = <EnterpriseDashboardMain />;
  } else if (profile?.role === 'patient') {
    if (needsTermsAcceptance) {
      // For terms acceptance, we can treat it similar to onboarding or just return it directly
      // But since it's a modal, we might want to overlay it too
      // For now, retaining original behavior for Terms
      return (
        <TermsAndConditionsModal
          isOpen={true}
          onAccept={acceptTerms}
          userName={profile.name}
        />
      );
    }
    DashboardComponent = <PatientDashboard />;
  } else {
    // Fallback if no valid role or profile yet but needs onboarding
    // In this case, we can't show a specific dash, so we might show an empty state or just the overlay
    // But logically, if they have no role, they should be in ProfileSetup.
    // If they have a role but needed onboarding, they hit the logic above.
    // This fallback is rare - usually indicates a corrupted state or new role not handled.
    DashboardComponent = (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account State Error</h2>
          <p className="text-gray-500 mb-6">
            Your account is in an unknown state (Role: {profile?.role || 'None'}).
            Please sign out and try again.
          </p>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.reload())}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-600/20"
          >
            Sign Out & Reset
          </button>
        </div>
      </div>
    );
  }

  // Render Dashboard with potential Onboarding Overlay
  return (
    <>
      <div className={needsOnboarding ? 'filter blur-sm pointer-events-none select-none h-screen overflow-hidden' : ''}>
        {DashboardComponent}
      </div>

      {needsOnboarding && (
        <div className="fixed inset-0 z-[9999]">
          <OnboardingFlow />
        </div>
      )}
    </>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <DataProvider>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: { background: '#363636', color: '#fff' },
              }}
            />
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
              <AppContent />
              <ReturnToAdminButton />
            </div>
          </DataProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

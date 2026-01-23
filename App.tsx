/**
 * Main App Component
 * 
 * Now using React Router for URL-based navigation.
 * OAuth flow handled by AuthService with browserFinished detection.
 * Deep link handler kept as backup for mobile OAuth.
 */

import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ReturnToAdminButton from './components/ReturnToAdminButton';
import AppRoutes from './routes';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';

/**
 * DeepLinkHandler - Handles OAuth callbacks for native mobile apps
 */
const DeepLinkHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return <>{children}</>;
};

/**
 * Main App Component with Router
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <DataProvider>
              <DeepLinkHandler>
                <Toaster
                  position="top-center"
                  toastOptions={{
                    duration: 3000,
                    style: { background: '#363636', color: '#fff' },
                  }}
                />
                <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
                  <AppRoutes />
                  <ReturnToAdminButton />
                </div>
              </DeepLinkHandler>
            </DataProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;

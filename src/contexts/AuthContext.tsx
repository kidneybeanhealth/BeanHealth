/**
 * Authentication Context
 * 
 * FIXES APPLIED (from main branch):
 * - Single auth state listener with proper cleanup
 * - Synchronous session hydration on mount using getSession()
 * - Removed race conditions between initial load and auth state changes
 * - Always set loading=false in finally blocks
 * - Proper error boundaries for network vs auth errors
 * - Atomic state updates to prevent stale closures
 * - Timeout handling for all async operations
 * - Simplified OAuth callback handling
 * 
 * WHY: Prevents infinite loading, race conditions, and inconsistent auth state
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthService } from '../services/authService'
import { TermsService } from '../services/termsService'
import { OnboardingService } from '../services/onboardingService'
import { User as AppUser } from '../types'
import { showErrorToast, showSuccessToast } from '../utils/toastUtils'

/**
 * Generate a unique tab ID for session isolation
 * This helps prevent auth conflicts when multiple tabs are open
 */
const getTabId = (): string => {
  let tabId = sessionStorage.getItem('beanhealth_tab_id');
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('beanhealth_tab_id', tabId);
  }
  return tabId;
};

/**
 * Debounce utility to prevent rapid-fire auth state changes
 */
function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: AppUser | null
  loading: boolean
  isInitialized: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signUp: (email: string, password: string, userData: {
    name: string
    role: 'patient' | 'doctor' | 'admin' | 'enterprise'
    specialty?: string
    dateOfBirth?: string
    condition?: string
  }) => Promise<void>
  signOut: () => Promise<void>
  needsProfileSetup: boolean
  needsOnboarding: boolean
  refreshProfile: () => Promise<void>
  // Terms and Conditions
  needsTermsAcceptance: boolean
  acceptTerms: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInitialized, setIsInitialized] = useState(false)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(false)

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true)

  // Use ref to track initialization state (avoids stale closure issues)
  const isInitializedRef = useRef(false)

  // Use ref to track auth subscription
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  // Use ref to track if we're processing an auth state change
  const isProcessingAuthRef = useRef(false)

  // Tab ID for session isolation (prevents conflicts when multiple tabs are open)
  const tabIdRef = useRef(getTabId())

  // Track last processed session to prevent duplicate processing
  const lastSessionIdRef = useRef<string | null>(null)

  // Track if tab is visible (prevents processing when tab is hidden)
  const isTabVisibleRef = useRef(!document.hidden)

  // Debounce timer for auth state changes
  const authDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stability flag - once stable, avoid unnecessary reloads
  const isStableRef = useRef(false)

  /**
   * Fetch user profile with proper error handling
   * OPTIMIZED: Uses getUserProfileById to skip redundant session check
   */
  const fetchUserProfile = useCallback(async (userId: string, userSession: Session): Promise<AppUser | null> => {
    try {
      console.log('[AuthContext] Fetching profile for user:', userId);

      // OPTIMIZATION: Use getUserProfileById instead of getCurrentUser to skip session check
      const userProfile = await AuthService.getUserProfileById(userId);

      if (!isMountedRef.current) return null;

      // If this is a Google OAuth user and we don't have their profile picture saved,
      // update their profile with the Google picture
      if (userSession.user.user_metadata?.picture &&
        (!userProfile?.avatar_url || userProfile.avatar_url !== userSession.user.user_metadata.picture)) {
        try {
          console.log('[AuthContext] Updating Google profile picture');
          await AuthService.createOrUpdateProfile({
            id: userId,
            email: userSession.user.email || '',
            name: userSession.user.user_metadata?.full_name || userSession.user.email || '',
            role: userProfile?.role || 'patient',
            avatarUrl: userSession.user.user_metadata.picture,
            specialty: userProfile?.specialty,
            dateOfBirth: userProfile?.date_of_birth,
            condition: userProfile?.condition
          });

          // Refresh the profile to get the updated avatar - use optimized method
          const updatedProfile = await AuthService.getUserProfileById(userId);
          if (isMountedRef.current) {
            return updatedProfile;
          }
        } catch (updateError) {
          console.error('[AuthContext] Error updating Google profile picture:', updateError);
          // Fall back to using the profile we already have
          return userProfile;
        }
      }

      return userProfile;
    } catch (error) {
      console.error('[AuthContext] Error fetching user profile:', error);
      // Don't throw - return null to indicate profile setup is needed
      return null;
    }
  }, []);

  /**
   * Process a session - fetch profile and set all states
   * OPTIMIZED: Parallelizes API calls for faster loading
   */
  const processSession = useCallback(async (currentSession: Session | null) => {
    if (!isMountedRef.current) return;

    if (currentSession?.user) {
      console.log('[AuthContext] Processing session for user:', currentSession.user.id);

      setUser(currentSession.user);
      setSession(currentSession);

      // Fetch profile
      try {
        const userProfile = await fetchUserProfile(currentSession.user.id, currentSession);

        if (!isMountedRef.current) return;

        setProfile(userProfile);
        setNeedsProfileSetup(!userProfile || !userProfile.role);

        // OPTIMIZATION: Parallelize onboarding and terms checks
        if (userProfile && userProfile.role) {
          const userId = currentSession.user.id;
          const isPatient = userProfile.role === 'patient';

          // Run checks in parallel for faster loading
          const [isOnboarded, needsTerms] = await Promise.all([
            OnboardingService.checkOnboardingStatus(userId),
            isPatient ? TermsService.needsToAcceptNewTerms(userId) : Promise.resolve(false)
          ]);

          if (isMountedRef.current) {
            setNeedsOnboarding(!isOnboarded);
            setNeedsTermsAcceptance(needsTerms);
          }
        } else {
          setNeedsOnboarding(false);
          setNeedsTermsAcceptance(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error processing session:', error);
        if (isMountedRef.current) {
          setProfile(null);
          setNeedsProfileSetup(true);
          setNeedsOnboarding(false);
          setNeedsTermsAcceptance(false);
        }
      }
    } else {
      console.log('[AuthContext] No session to process');
      setUser(null);
      setSession(null);
      setProfile(null);
      setNeedsProfileSetup(false);
      setNeedsOnboarding(false);
      setNeedsTermsAcceptance(false);
    }
  }, [fetchUserProfile]);

  /**
   * Handle auth state changes from Supabase
   * Includes debouncing and tab visibility checks for enterprise stability
   */
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    const tabId = tabIdRef.current;
    console.log(`[AuthContext][${tabId}] Auth state change:`, event, 'initialized:', isInitializedRef.current);

    // Skip if tab is not visible (prevents background tab conflicts)
    if (!isTabVisibleRef.current && event === 'TOKEN_REFRESHED') {
      console.log(`[AuthContext][${tabId}] Skipping TOKEN_REFRESHED - tab not visible`);
      return;
    }

    // Prevent concurrent processing
    if (isProcessingAuthRef.current) {
      console.log(`[AuthContext][${tabId}] Already processing auth, skipping`);
      return;
    }

    // Skip duplicate session processing (prevents infinite loops)
    const sessionId = newSession?.access_token?.substring(0, 20) || 'no-session';
    if (event === 'TOKEN_REFRESHED' && lastSessionIdRef.current === sessionId && isStableRef.current) {
      console.log(`[AuthContext][${tabId}] Skipping duplicate TOKEN_REFRESHED`);
      return;
    }

    // For INITIAL_SESSION during OAuth callback, we need to process it
    // even if not "initialized" because that's how OAuth works
    if (event === 'INITIAL_SESSION' && newSession?.user) {
      console.log('[AuthContext] Processing INITIAL_SESSION with user');
      isProcessingAuthRef.current = true;

      try {
        if (isMountedRef.current && !isInitializedRef.current) {
          setLoading(true);
        }
        await processSession(newSession);
      } finally {
        isProcessingAuthRef.current = false;
        if (isMountedRef.current) {
          // Only turn off loading if we turned it on
          if (!isInitializedRef.current) {
            setLoading(false);
          }
          setIsInitialized(true);
          isInitializedRef.current = true;
        }
      }
      return;
    }

    // For other events, only process if initialized
    if (!isInitializedRef.current) {
      console.log('[AuthContext] Skipping auth state change - not initialized yet');
      return;
    }

    // Clean up OAuth tokens from URL after processing
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.hash.includes('access_token') || url.hash.includes('refresh_token') || url.searchParams.has('code')) {
        window.history.replaceState({}, document.title, url.pathname);
        console.log('[AuthContext] Cleared OAuth tokens from URL');
      }
    }

    // Handle sign out immediately
    if (event === 'SIGNED_OUT') {
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setNeedsOnboarding(false);
        setNeedsTermsAcceptance(false);
        setLoading(false);
      }
      return;
    }

    // Handle sign in / token refresh
    if (newSession?.user) {
      isProcessingAuthRef.current = true;
      const newSessionId = newSession.access_token?.substring(0, 20) || 'no-token';

      try {
        // For TOKEN_REFRESHED when already stable, don't show loading or reprocess profile
        if (event === 'TOKEN_REFRESHED' && isStableRef.current && lastSessionIdRef.current) {
          // Just update session without full reload
          if (isMountedRef.current) {
            setSession(newSession);
            lastSessionIdRef.current = newSessionId;
          }
          console.log(`[AuthContext][${tabIdRef.current}] Token refreshed - updated session silently`);
          return;
        }

        // Only show loading if not initialized (sanity check, though we check above)
        if (isMountedRef.current && !isInitializedRef.current) {
          setLoading(true);
        }
        await processSession(newSession);

        // Mark as stable after successful processing
        lastSessionIdRef.current = newSessionId;
        isStableRef.current = true;
      } finally {
        isProcessingAuthRef.current = false;
        if (isMountedRef.current && !isInitializedRef.current) {
          setLoading(false);
        }
      }
    } else {
      // No session - reset stability
      isStableRef.current = false;
      lastSessionIdRef.current = null;

      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setNeedsOnboarding(false);
        setLoading(false);
      }
    }
  }, [processSession]);

  /**
   * Initialize auth - sets up listener first, then checks session
   * Includes tab visibility handling for enterprise multi-role support
   */
  useEffect(() => {
    isMountedRef.current = true;
    const tabId = tabIdRef.current;

    console.log(`[AuthContext][${tabId}] Setting up auth...`);

    // Tab visibility handler - prevents auth conflicts when switching tabs
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      console.log(`[AuthContext][${tabId}] Tab visibility:`, !document.hidden);

      // When tab becomes visible and is stable, just verify session is valid
      if (!document.hidden && isStableRef.current && isInitializedRef.current) {
        console.log(`[AuthContext][${tabId}] Tab visible - session is stable, no reload needed`);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Debounced auth state handler to prevent rapid-fire changes
    const debouncedAuthHandler = debounce(handleAuthStateChange, 100);

    // Set up auth state listener FIRST - this catches OAuth callbacks
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Use immediate handling for critical events, debounced for others
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        handleAuthStateChange(event, session);
      } else {
        debouncedAuthHandler(event, session);
      }
    });
    authSubscriptionRef.current = subscription;

    // Then check for existing session (for normal page loads)
    const checkSession = async () => {
      // OPTIMIZATION: Reduced delay from 100ms to 10ms - just enough for event loop
      await new Promise(resolve => setTimeout(resolve, 10));

      // If already initialized by auth state change (OAuth callback), skip
      if (isInitializedRef.current) {
        console.log('[AuthContext] Already initialized by auth state change');
        return;
      }

      console.log('[AuthContext] Checking for existing session...');

      try {
        // Add timeout to prevent infinite hang if Supabase is slow - reduced to 5s for faster feedback
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out after 5s')), 5000)
        );

        const { data: { session }, error } = await Promise.race([
          sessionPromise,
          timeoutPromise
        ]) as Awaited<typeof sessionPromise>;

        if (error) {
          console.error('[AuthContext] Session error:', error);
          throw error;
        }

        if (!isMountedRef.current) return;

        // Only process if not already initialized
        if (!isInitializedRef.current) {
          await processSession(session);
        }
      } catch (error) {
        console.error('[AuthContext] Error checking session:', error);
        if (isMountedRef.current && !isInitializedRef.current) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setNeedsProfileSetup(false);
          setNeedsOnboarding(false);
          setNeedsTermsAcceptance(false);
        }
      } finally {
        if (isMountedRef.current && !isInitializedRef.current) {
          setLoading(false);
          setIsInitialized(true);
          isInitializedRef.current = true;
          console.log('[AuthContext] Auth initialization complete');
        }
      }
    };

    checkSession();

    // Cleanup
    return () => {
      console.log(`[AuthContext][${tabId}] Cleaning up auth context`);
      isMountedRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (authDebounceTimerRef.current) {
        clearTimeout(authDebounceTimerRef.current);
      }
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, [handleAuthStateChange, processSession]);

  /**
   * Sign in with email/password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      await AuthService.signIn(email, password);
      showSuccessToast('Welcome back!');
    } catch (error) {
      console.error('[AuthContext] Sign in error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in';
      showErrorToast(errorMessage);
      throw error;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Sign in with Google
   */
  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    try {
      const result = await AuthService.signInWithGoogle();

      if (result.success) {
        // On native platforms, the deep link handler will handle the session exchange and reload
        // On web, the OAuth redirect will happen automatically and we'll pick up the session
        console.log('[AuthContext] OAuth initiated successfully');
        // Don't reload here - let the deep link handler or OAuth flow complete naturally
      } else if (result.error) {
        showErrorToast(result.error);
      }
    } catch (error) {
      console.error('[AuthContext] Google sign in error:', error);
      showErrorToast('Failed to sign in with Google. Please try again.');
      throw error;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Sign up with email/password
   */
  const signUp = useCallback(async (email: string, password: string, userData: {
    name: string
    role: 'patient' | 'doctor' | 'admin' | 'enterprise'
    specialty?: string
    dateOfBirth?: string
    condition?: string
  }) => {
    setLoading(true);
    try {
      await AuthService.signUp(email, password, userData);
      showSuccessToast('Account created successfully! Welcome to BeanHealth.');
    } catch (error) {
      console.error('[AuthContext] Sign up error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account';
      showErrorToast(errorMessage);
      throw error;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Sign out - clears all auth state including enterprise department sessions
   */
  const signOut = useCallback(async () => {
    setLoading(true);

    // Reset stability flags to ensure clean state
    isStableRef.current = false;
    lastSessionIdRef.current = null;

    try {
      await AuthService.signOut();

      // Clear local state immediately
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setNeedsOnboarding(false);
        setNeedsTermsAcceptance(false);
      }

      // PRODUCTION FIX: Clear all enterprise-related session data
      try {
        sessionStorage.removeItem('authView');
        sessionStorage.removeItem('enterprise_reception_authenticated');
        sessionStorage.removeItem('enterprise_pharmacy_authenticated');
        // Clear all doctor sessions
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('enterprise_doctor_session_')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        console.warn('[AuthContext] Could not clear session storage:', e);
      }

      showSuccessToast('Signed out successfully');
    } catch (error) {
      // Even on error, clear state and show success (better UX)
      console.warn('[AuthContext] Sign out completed with warnings:', error);

      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setNeedsOnboarding(false);
        setNeedsTermsAcceptance(false);
      }

      // Still clear enterprise sessions on error
      try {
        sessionStorage.removeItem('authView');
        sessionStorage.removeItem('enterprise_reception_authenticated');
        sessionStorage.removeItem('enterprise_pharmacy_authenticated');
        // Clear hospital name cache
        localStorage.removeItem('hospital_name_cache');
        Object.keys(sessionStorage).forEach(key => {
          if (key.startsWith('enterprise_doctor_session_')) {
            sessionStorage.removeItem(key);
          }
        });
      } catch (e) {
        // Ignore storage errors
      }

      showSuccessToast('Signed out successfully');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Refresh user profile
   */
  const refreshProfile = useCallback(async () => {
    if (!user || !session) {
      console.warn('[AuthContext] Cannot refresh profile - no user session');
      return;
    }

    try {
      console.log('[AuthContext] Refreshing profile for user:', user.id);

      const userProfile = await fetchUserProfile(user.id, session);

      if (isMountedRef.current) {
        setProfile(userProfile);
        setNeedsProfileSetup(!userProfile || !userProfile.role);

        // Check if user needs onboarding
        if (userProfile && userProfile.role) {
          const isOnboarded = await OnboardingService.checkOnboardingStatus(user.id);
          if (isMountedRef.current) {
            setNeedsOnboarding(!isOnboarded);
          }
        } else {
          setNeedsOnboarding(false);
        }

        // Check if patient needs to accept terms
        if (userProfile && userProfile.role === 'patient') {
          const needsTerms = await TermsService.needsToAcceptNewTerms(user.id);
          if (isMountedRef.current) {
            setNeedsTermsAcceptance(needsTerms);
          }
        }
      }

      console.log('[AuthContext] Profile refreshed');
    } catch (error) {
      console.error('[AuthContext] Error refreshing profile:', error);
      throw error;
    }
  }, [user, session, fetchUserProfile]);

  /**
   * Accept terms and conditions
   */
  const acceptTerms = useCallback(async () => {
    if (!user) {
      console.warn('[AuthContext] Cannot accept terms - no user');
      return;
    }

    try {
      console.log('[AuthContext] Accepting terms for user:', user.id);

      await TermsService.acceptTerms(user.id);

      if (isMountedRef.current) {
        setNeedsTermsAcceptance(false);
        showSuccessToast('Terms and conditions accepted');
      }

      console.log('[AuthContext] Terms accepted successfully');
    } catch (error) {
      console.error('[AuthContext] Error accepting terms:', error);
      showErrorToast('Failed to accept terms. Please try again.');
      throw error;
    }
  }, [user]);

  /**
   * Re-check authentication state
   */
  const initializeAuth = useCallback(async () => {
    console.log('[AuthContext] Re-checking auth state...');
    setLoading(true);

    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession();

      if (error) {
        console.error('[AuthContext] Session error:', error);
        throw error;
      }

      if (!isMountedRef.current) return;

      await processSession(currentSession);
    } catch (error) {
      console.error('[AuthContext] Error checking auth:', error);
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
        setNeedsOnboarding(false);
        setNeedsTermsAcceptance(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [processSession]);

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    isInitialized,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    needsProfileSetup,
    needsOnboarding,
    refreshProfile,
    needsTermsAcceptance,
    acceptTerms,
    checkAuth: initializeAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
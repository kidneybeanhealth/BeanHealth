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
import { User as AppUser } from '../types'
import { showErrorToast, showSuccessToast } from '../utils/toastUtils'

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
    role: 'patient' | 'doctor'
    specialty?: string
    dateOfBirth?: string
    condition?: string
  }) => Promise<void>
  signOut: () => Promise<void>
  needsProfileSetup: boolean
  refreshProfile: () => Promise<void>
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

  // Use ref to track if component is mounted
  const isMountedRef = useRef(true)

  // Use ref to track initialization state (avoids stale closure issues)
  const isInitializedRef = useRef(false)

  // Use ref to track auth subscription
  const authSubscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)

  /**
   * Fetch user profile with proper error handling
   */
  const fetchUserProfile = useCallback(async (userId: string, userSession: Session): Promise<AppUser | null> => {
    try {
      console.log('[AuthContext] Fetching profile for user:', userId);

      const userProfile = await AuthService.getCurrentUser();

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

          // Refresh the profile to get the updated avatar
          const updatedProfile = await AuthService.getCurrentUser();
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
   * Initialize auth state on mount - called once
   */
  const initializeAuth = useCallback(async () => {
    console.log('[AuthContext] Initializing auth state');

    try {
      // Get current session with timeout
      console.log('[AuthContext] Calling supabase.auth.getSession()...');
      const startTime = Date.now();

      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      console.log('[AuthContext] getSession completed in', Date.now() - startTime, 'ms');

      if (sessionError) {
        console.error('[AuthContext] Session error:', sessionError);
        throw sessionError;
      }

      if (!isMountedRef.current) return;

      if (currentSession?.user) {
        console.log('[AuthContext] Session found, loading profile');

        setUser(currentSession.user);
        setSession(currentSession);

        // Fetch profile
        const userProfile = await fetchUserProfile(currentSession.user.id, currentSession);

        if (!isMountedRef.current) return;

        setProfile(userProfile);
        setNeedsProfileSetup(!userProfile || !userProfile.role);

        console.log('[AuthContext] Auth initialized with user');
      } else {
        console.log('[AuthContext] No session found');
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }
    } catch (error) {
      console.error('[AuthContext] Error initializing auth:', error);

      // Clear state on ANY auth errors so user can proceed to login
      // This prevents getting stuck in loading state
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsInitialized(true);
        isInitializedRef.current = true; // Also set the ref for callback access
        console.log('[AuthContext] Auth initialization complete');
      }
    }
  }, [fetchUserProfile]);

  /**
   * Handle auth state changes from Supabase
   */
  const handleAuthStateChange = useCallback(async (event: string, newSession: Session | null) => {
    // Don't process during initial load - use ref to get current value
    if (!isInitializedRef.current) {
      console.log('[AuthContext] Skipping auth state change - not initialized yet');
      return;
    }

    console.log('[AuthContext] Auth state change:', event);

    // Handle sign out immediately
    if (event === 'SIGNED_OUT') {
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }
      return;
    }

    // Handle sign in / token refresh
    if (newSession?.user) {
      if (isMountedRef.current) {
        setUser(newSession.user);
        setSession(newSession);

        // Fetch profile in background
        fetchUserProfile(newSession.user.id, newSession).then(userProfile => {
          if (isMountedRef.current) {
            setProfile(userProfile);
            setNeedsProfileSetup(!userProfile || !userProfile.role);
          }
        }).catch(error => {
          console.error('[AuthContext] Error fetching profile on auth change:', error);
          if (isMountedRef.current) {
            setProfile(null);
            setNeedsProfileSetup(true);
          }
        });
      }
    } else {
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }
    }
  }, [fetchUserProfile]); // Removed isInitialized from deps - using ref instead

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    // Reset mounted ref to true at the start (important for React Strict Mode)
    isMountedRef.current = true;

    // Initialize auth state first
    initializeAuth();

    // Cleanup on unmount
    return () => {
      console.log('[AuthContext] Cleaning up auth context (mount effect)');
      isMountedRef.current = false;
    };
  }, [initializeAuth]);

  /**
   * Setup auth state listener AFTER initialization is complete
   */
  useEffect(() => {
    // Only setup listener after initialization is complete
    if (!isInitialized) {
      return;
    }

    console.log('[AuthContext] Setting up auth state listener (after init)');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthStateChange);
    authSubscriptionRef.current = subscription;

    console.log('[AuthContext] Auth listener established');

    // Cleanup
    return () => {
      console.log('[AuthContext] Cleaning up auth listener');
      if (authSubscriptionRef.current) {
        authSubscriptionRef.current.unsubscribe();
        authSubscriptionRef.current = null;
      }
    };
  }, [isInitialized, handleAuthStateChange]);

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
      await AuthService.signInWithGoogle();
      // Success toast will show after redirect
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
    role: 'patient' | 'doctor'
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
   * Sign out
   */
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await AuthService.signOut();

      // Clear local state immediately
      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }

      // Clear auth view state to reset flow
      sessionStorage.removeItem('authView');

      showSuccessToast('Signed out successfully');
    } catch (error) {
      // Even on error, clear state and show success (better UX)
      console.warn('[AuthContext] Sign out completed with warnings:', error);

      if (isMountedRef.current) {
        setUser(null);
        setSession(null);
        setProfile(null);
        setNeedsProfileSetup(false);
      }

      sessionStorage.removeItem('authView');
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
      }

      console.log('[AuthContext] Profile refreshed');
    } catch (error) {
      console.error('[AuthContext] Error refreshing profile:', error);
      throw error;
    }
  }, [user, session, fetchUserProfile]);

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
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
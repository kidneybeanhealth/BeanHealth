import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthService } from '../services/authService'
import { User as AppUser } from '../types'
import { showErrorToast, showSuccessToast } from '../utils/toastUtils'

interface AuthContextType {
  user: User | null
  profile: AppUser | null
  loading: boolean
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
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)

  useEffect(() => {
    let mounted = true;
    let initializationComplete = false;

    // Handle OAuth callback if present
    const handleOAuthCallback = async () => {
      // Check if this is an OAuth callback (URL contains #access_token or ?code)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      
      if (hashParams.get('access_token') || searchParams.get('code')) {
        console.log('OAuth callback detected, processing...');
        try {
          // Let Supabase handle the callback
          const { data, error } = await supabase.auth.getSession();
          if (error) {
            console.error('OAuth callback error:', error);
          } else {
            console.log('OAuth callback successful');
            // Clear the URL hash/search params
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error) {
          console.error('Error processing OAuth callback:', error);
        }
      }
    };

    // Get initial session with better error handling
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...');
        
        // Wait for OAuth callback handling to complete
        await handleOAuthCallback();
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }
        
        if (!mounted) return;
        
        setUser(session?.user ?? null)
        
        if (session?.user) {
          console.log('User found, fetching profile...');
          try {
            const userProfile = await AuthService.getCurrentUser()
            if (!mounted) return;
            
            // If this is a Google OAuth user and we don't have their profile picture saved,
            // update their profile with the Google picture
            if (session.user.user_metadata?.picture && 
                (!userProfile?.avatar_url || userProfile.avatar_url !== session.user.user_metadata.picture)) {
              try {
                await AuthService.createOrUpdateProfile({
                  id: session.user.id,
                  email: session.user.email || '',
                  name: session.user.user_metadata?.full_name || session.user.email || '',
                  role: userProfile?.role || 'patient',
                  avatarUrl: session.user.user_metadata.picture,
                  specialty: userProfile?.specialty,
                  dateOfBirth: userProfile?.date_of_birth,
                  condition: userProfile?.condition
                });
                
                // Refresh the profile to get the updated avatar
                const updatedProfile = await AuthService.getCurrentUser();
                if (mounted) {
                  setProfile(updatedProfile);
                }
              } catch (updateError) {
                console.error('Error updating Google profile picture:', updateError);
                setProfile(userProfile);
              }
            } else {
              setProfile(userProfile);
            }
            
            setNeedsProfileSetup(!userProfile || !userProfile.role)
            console.log('Profile loaded:', { userProfile, needsSetup: !userProfile || !userProfile.role });
          } catch (profileError) {
            console.error('Error fetching user profile:', profileError);
            if (!mounted) return;
            // Don't clear the user, just indicate profile setup is needed
            setProfile(null)
            setNeedsProfileSetup(true)
          }
        } else {
          console.log('No user session found');
          if (!mounted) return;
          setProfile(null)
          setNeedsProfileSetup(false)
        }
      } catch (error) {
        console.error('Error getting initial session:', error)
        if (!mounted) return;
        // Only clear state if there's a real auth error, not a network issue
        if (error?.message?.includes('Invalid JWT') || error?.message?.includes('expired')) {
          setUser(null)
          setProfile(null)
          setNeedsProfileSetup(false)
        }
      } finally {
        if (mounted) {
          initializationComplete = true;
          console.log('Initial session loading complete');
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state change:', event, session?.user?.id)
      
      // Don't process auth state changes until initial session is loaded
      // This prevents race conditions during app startup
      if (!initializationComplete && event !== 'SIGNED_OUT') {
        console.log('Skipping auth state change - initialization not complete');
        return;
      }
      
      setUser(session?.user ?? null)
      
      if (session?.user) {
        try {
          const userProfile = await AuthService.getCurrentUser()
          if (!mounted) return;
          
          // If this is a Google OAuth user and we don't have their profile picture saved,
          // update their profile with the Google picture
          if (session.user.user_metadata?.picture && 
              (!userProfile?.avatar_url || userProfile.avatar_url !== session.user.user_metadata.picture)) {
            try {
              await AuthService.createOrUpdateProfile({
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.full_name || session.user.email || '',
                role: userProfile?.role || 'patient',
                avatarUrl: session.user.user_metadata.picture,
                specialty: userProfile?.specialty,
                dateOfBirth: userProfile?.date_of_birth,
                condition: userProfile?.condition
              });
              
              // Refresh the profile to get the updated avatar
              const updatedProfile = await AuthService.getCurrentUser();
              if (mounted) {
                setProfile(updatedProfile);
              }
            } catch (updateError) {
              console.error('Error updating Google profile picture:', updateError);
            }
          } else {
            setProfile(userProfile);
          }
          
          setNeedsProfileSetup(!userProfile || !userProfile.role)
        } catch (error) {
          console.error('Error fetching user profile:', error)
          if (!mounted) return;
          // Don't clear the user session, just indicate profile setup is needed
          setProfile(null)
          setNeedsProfileSetup(true)
        }
      } else {
        if (!mounted) return;
        setProfile(null)
        setNeedsProfileSetup(false)
      }
      
      if (mounted && initializationComplete) {
        setLoading(false)
      }
    })

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [])

  const signInWithGoogle = async () => {
    setLoading(true)
    try {
      await AuthService.signInWithGoogle()
      // Success toast will show after redirect
    } catch (error) {
      setLoading(false)
      showErrorToast('Failed to sign in with Google. Please try again.')
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    try {
      await AuthService.signIn(email, password)
      showSuccessToast('Welcome back!')
    } catch (error) {
      setLoading(false)
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign in'
      showErrorToast(errorMessage)
      throw error
    }
  }

  const signUp = async (email: string, password: string, userData: {
    name: string
    role: 'patient' | 'doctor'
    specialty?: string
    dateOfBirth?: string
    condition?: string
  }) => {
    setLoading(true)
    try {
      await AuthService.signUp(email, password, userData)
      showSuccessToast('Account created successfully! Welcome to BeanHealth.')
    } catch (error) {
      setLoading(false)
      const errorMessage = error instanceof Error ? error.message : 'Failed to create account'
      showErrorToast(errorMessage)
      throw error
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await AuthService.signOut()
      showSuccessToast('Signed out successfully')
    } catch (error) {
      setLoading(false)
      showErrorToast('Failed to sign out')
      throw error
    }
  }

  const refreshProfile = async () => {
    if (!user) return;
    
    try {
      console.log('Refreshing profile for user:', user.id);
      
      // Check if we need to update Google profile picture
      if (user.user_metadata?.picture) {
        const currentProfile = await AuthService.getCurrentUser();
        
        if (!currentProfile?.avatar_url || currentProfile.avatar_url !== user.user_metadata.picture) {
          console.log('Updating Google profile picture:', user.user_metadata.picture);
          await AuthService.createOrUpdateProfile({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email || '',
            role: currentProfile?.role || 'patient',
            avatarUrl: user.user_metadata.picture,
            specialty: currentProfile?.specialty,
            dateOfBirth: currentProfile?.date_of_birth,
            condition: currentProfile?.condition
          });
        }
      }
      
      const userProfile = await AuthService.getCurrentUser();
      setProfile(userProfile);
      setNeedsProfileSetup(!userProfile || !userProfile.role);
      console.log('Profile refreshed:', { userProfile, needsSetup: !userProfile || !userProfile.role });
    } catch (error) {
      console.error('Error refreshing profile:', error);
    }
  }

  const value = {
    user,
    profile,
    loading,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    needsProfileSetup,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
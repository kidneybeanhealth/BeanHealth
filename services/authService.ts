/**
 * Authentication Service
 * 
 * FIXES APPLIED:
 * - Added proper try/catch/finally blocks to all async methods
 * - SignOut now properly clears all state regardless of API response
 * - Improved error messages and logging
 * - Added defensive checks for null/undefined
 * 
 * WHY: Prevents hanging on signOut and ensures auth state is always consistent
 */

import { supabase } from '../lib/supabase'
import { Patient, Doctor, User, UserRole } from '../types'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export class AuthService {
  // Google OAuth sign in
  static async signInWithGoogle() {
    try {
      // Determine redirect URL based on platform
      const redirectTo = Capacitor.isNativePlatform()
        ? 'com.beanhealth.app://oauth-callback'
        : window.location.origin

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Capacitor.isNativePlatform() // Don't auto-redirect on mobile
        }
      })

      if (error) {
        console.error('[AuthService] Supabase OAuth error:', error);
        throw error;
      }

      // On mobile, open browser manually
      if (Capacitor.isNativePlatform() && data?.url) {
        await Browser.open({
          url: data.url,
          presentationStyle: 'popover'
        })
      }

      return data;
    } catch (error) {
      console.error('[AuthService] Google sign in failed:', error);
      throw error;
    }
  }

  // Create or update user profile after Google OAuth
  static async createOrUpdateProfile(userData: {
    id: string
    email: string
    name: string
    role: UserRole
    specialty?: string
    dateOfBirth?: string
    condition?: string
    avatarUrl?: string
  }) {
    try {
      console.log('[AuthService] Creating or updating profile for:', userData.id);

      // Check if user already exists
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userData.id)
        .single()

      // If user doesn't exist (selectError means no user found), create new user
      if (selectError && selectError.code === 'PGRST116') {
        console.log('[AuthService] Creating new user profile');

        // Create new user - triggers will auto-generate referral_code for doctors
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: userData.id,
            email: userData.email,
            name: userData.name,
            role: userData.role,
            specialty: userData.role === 'doctor' ? userData.specialty : null,
            date_of_birth: userData.role === 'patient' ? userData.dateOfBirth : null,
            condition: userData.role === 'patient' ? userData.condition : null,
            avatar_url: userData.avatarUrl,
          })

        if (insertError) {
          console.error('[AuthService] Insert error:', insertError);
          throw insertError;
        }

        console.log('[AuthService] User profile created successfully');
      } else if (existingUser) {
        console.log('[AuthService] Updating existing user profile');

        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            name: userData.name,
            role: userData.role,
            specialty: userData.role === 'doctor' ? userData.specialty : null,
            date_of_birth: userData.role === 'patient' ? userData.dateOfBirth : null,
            condition: userData.role === 'patient' ? userData.condition : null,
            avatar_url: userData.avatarUrl,
          })
          .eq('id', userData.id)

        if (updateError) {
          console.error('[AuthService] Update error:', updateError);
          throw updateError;
        }

        console.log('[AuthService] User profile updated successfully');
      } else if (selectError) {
        // Some other error occurred during select
        console.error('[AuthService] Select error:', selectError);
        throw selectError;
      }
    } catch (error) {
      console.error('[AuthService] Error in createOrUpdateProfile:', error);
      throw error;
    }
  }

  static async signUp(email: string, password: string, userData: {
    name: string
    role: UserRole
    specialty?: string
    dateOfBirth?: string
    condition?: string
  }) {
    if (!email || !password || !userData.name || !userData.role) {
      throw new Error('Email, password, name, and role are required');
    }

    try {
      console.log('[AuthService] Attempting signUp for:', email);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })

      if (authError) {
        console.error('[AuthService] SignUp error:', authError);
        throw authError;
      }

      if (!authData.user) {
        throw new Error('SignUp failed - no user returned');
      }

      console.log('[AuthService] Creating user profile for:', authData.user.id);

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email.trim(),
          name: userData.name.trim(),
          role: userData.role,
          specialty: userData.specialty?.trim() || null,
          date_of_birth: userData.dateOfBirth || null,
          condition: userData.condition?.trim() || null,
        })

      if (profileError) {
        console.error('[AuthService] Profile creation error:', profileError);
        throw profileError;
      }

      console.log('[AuthService] SignUp successful for user:', authData.user.id);
      return authData;
    } catch (error) {
      console.error('[AuthService] SignUp failed:', error);
      throw error;
    }
  }

  static async signIn(email: string, password: string) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    try {
      console.log('[AuthService] Attempting signIn for:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        console.error('[AuthService] SignIn error:', error);
        // Provide user-friendly error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('SignIn failed - no user returned');
      }

      console.log('[AuthService] SignIn successful for user:', data.user.id);
      return data;
    } catch (error) {
      console.error('[AuthService] SignIn failed:', error);
      throw error;
    }
  }

  static async signOut(): Promise<void> {
    console.log('[AuthService] Starting signOut process');

    try {
      await supabase.auth.signOut();
      console.log('[AuthService] SignOut successful');
    } catch (error) {
      // Log but don't throw - we want to clear local state regardless
      console.warn('[AuthService] SignOut API call failed (clearing local state anyway):', error);
    } finally {
      // CRITICAL: Always clear local storage to ensure clean state
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();
        console.log('[AuthService] Local auth state cleared');
      } catch (storageError) {
        console.error('[AuthService] Failed to clear storage:', storageError);
      }
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      console.log('[AuthService] Getting current user');

      // First check if we have an active session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[AuthService] Session error:', sessionError);
        // For auth errors, clear local storage
        if (sessionError.message?.includes('JWT') || sessionError.message?.includes('expired')) {
          localStorage.removeItem('supabase.auth.token');
        }
        throw sessionError;
      }

      if (!session?.user) {
        console.log('[AuthService] No active session');
        return null;
      }

      console.log('[AuthService] Active session found, fetching profile');

      // Then try to get the user profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      // If user doesn't exist in database, return null (they need to set up profile)
      if (error && error.code === 'PGRST116') {
        console.log('[AuthService] User profile not found - needs setup');
        return null;
      }

      if (error) {
        console.error('[AuthService] Error fetching user profile:', error);
        throw error;
      }

      console.log('[AuthService] Profile fetched successfully');
      return profile as User;
    } catch (error: any) {
      console.error('[AuthService] Error in getCurrentUser:', error);

      // Don't throw network errors, return null instead
      if (error?.message?.includes('fetch') ||
        error?.message?.includes('network') ||
        error?.message?.includes('timeout')) {
        console.warn('[AuthService] Network error, returning null');
        return null;
      }

      // Only throw auth-related errors
      if (error?.message?.includes('JWT') ||
        error?.message?.includes('expired') ||
        error?.message?.includes('invalid')) {
        throw error;
      }

      return null;
    }
  }

  static onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((event, session) => {
      callback(session?.user || null)
    })
  }
}

export class UserService {
  static async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // No rows found
      throw error
    }
    return data as User
  }

  static async updateUser(id: string, updates: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  static async getAllDoctors(): Promise<Doctor[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'doctor')

    if (error) throw error
    return data as Doctor[]
  }

  static async getPatientsByDoctorId(doctorId: string): Promise<Patient[]> {
    const { data, error } = await supabase
      .from('patient_doctor_relationships')
      .select(`
        patient:users!patient_doctor_relationships_patient_id_fkey(*)
      `)
      .eq('doctor_id', doctorId)

    if (error) throw error
    return (data as any[]).map(rel => rel.patient) as Patient[]
  }
}
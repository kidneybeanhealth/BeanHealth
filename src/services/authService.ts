/**
 * Authentication Service
 * 
 * FIXES APPLIED:
 * - Uses Browser.addListener('browserFinished') to detect OAuth completion
 * - Checks session after browser closes as fallback
 * - Returns a promise that resolves when OAuth is complete
 */

import { supabase } from '../lib/supabase'
import { Patient, Doctor, User, UserRole } from '../types'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export class AuthService {
  // Google OAuth sign in with browser finish detection
  static async signInWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      // Determine redirect URL based on platform
      const redirectTo = Capacitor.isNativePlatform()
        ? 'com.beanhealth.app://oauth-callback'
        : window.location.origin

      console.log('[AuthService] Starting OAuth with redirect:', redirectTo);
      console.log('[AuthService] Platform:', Capacitor.getPlatform());

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: Capacitor.isNativePlatform()
        }
      })

      if (error) {
        console.error('[AuthService] Supabase OAuth error:', error);
        throw error;
      }

      // On mobile, open browser and DON'T wait for it to close
      // The deep link handler in App.tsx will handle the callback
      if (Capacitor.isNativePlatform() && data?.url) {
        console.log('[AuthService] Opening browser for OAuth...');
        console.log('[AuthService] OAuth URL:', data.url);

        try {
          await Browser.open({
            url: data.url,
            presentationStyle: 'fullscreen',
            windowName: '_blank'
          });

          console.log('[AuthService] Browser opened successfully');

          // On native, we just return success - the deep link handler will do the rest
          // No need to listen for browserFinished as the deep link handles everything
          return { success: true };
        } catch (err) {
          console.error('[AuthService] Browser open error:', err);
          return { success: false, error: 'Could not open browser for login' };
        }
      }

      // On web, the OAuth redirect happens automatically
      return { success: true };
    } catch (error) {
      console.error('[AuthService] Google sign in failed:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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
    notes?: string
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
            // notes: userData.notes, // Separated for Enterprise
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
            // notes: userData.notes,
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

      // Handle Enterprise-Specific Table
      if (userData.role === 'enterprise' && userData.notes) {
        // Parse notes to extract address and contact
        let address = '';
        let contact = '';

        const lines = userData.notes.split('\n');
        lines.forEach(line => {
          if (line.startsWith('Address: ')) address = line.replace('Address: ', '');
          if (line.startsWith('Contact: ')) contact = line.replace('Contact: ', '');
        });

        console.log('[AuthService] Upserting hospital_profiles');
        // We use try/catch block here specifically because we don't want to fail the whole process 
        // if this optional table fails (e.g. if the SQL script wasn't run yet)
        try {
          const { error: hospitalError } = await supabase
            .from('hospital_profiles')
            .upsert({
              id: userData.id,
              hospital_name: userData.name,
              address: address,
              contact_number: contact,
              updated_at: new Date().toISOString()
            })

          if (hospitalError) {
            console.error('[AuthService] Hospital profile upsert error:', hospitalError);
          }
        } catch (e) {
          console.warn('[AuthService] Failed to update hospital_profiles (table might not exist yet)', e);
        }
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

  /**
   * Get user profile directly by ID - OPTIMIZED version that skips session check
   * Use this when you already have a valid session/userId
   */
  static async getUserProfileById(userId: string): Promise<User | null> {
    try {
      console.log('[AuthService] Getting user profile by ID:', userId);

      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
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
      console.error('[AuthService] Error in getUserProfileById:', error);

      // Don't throw network errors, return null instead
      if (error?.message?.includes('fetch') ||
        error?.message?.includes('network') ||
        error?.message?.includes('timeout')) {
        console.warn('[AuthService] Network error, returning null');
        return null;
      }

      return null;
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

  // ============================
  // Hospital Patient Phone Login
  // ============================

  /**
   * Find hospital patients by phone number (Step 1 of phone login)
   */
  static async findHospitalPatientsByPhone(phone: string): Promise<{
    patient_id: string;
    patient_name: string;
    hospital_name: string;
    age: number;
    created_at: string;
  }[]> {
    const digits = phone.replace(/\D/g, '');

    const { data, error } = await supabase.rpc('find_patients_by_phone', {
      p_phone: digits
    });

    if (error) {
      console.error('[AuthService] Phone lookup error:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Sign in as hospital patient using phone + name verification
   * Creates Supabase auth account on first login, signs in on subsequent logins
   */
  static async signInAsHospitalPatient(phone: string, name: string): Promise<{
    success: boolean;
    error?: string;
    isNewAccount?: boolean;
  }> {
    const digits = phone.replace(/\D/g, '');
    const phantomEmail = `${digits}@p.beanhealth.app`;
    const password = `bh_${digits}_${name.toLowerCase().trim().replace(/\s+/g, '_')}`;

    try {
      // Step 1: Verify the patient exists in hospital_patients
      const { data: verifyData, error: verifyError } = await supabase.rpc('verify_hospital_patient', {
        p_phone: digits,
        p_name: name
      });

      if (verifyError || !verifyData || verifyData.length === 0) {
        console.error('[AuthService] Verification failed:', verifyError);
        return { success: false, error: 'No matching patient found. Please check your phone number and name.' };
      }

      const hospitalPatient = verifyData[0];
      console.log('[AuthService] Patient verified:', hospitalPatient.patient_name);

      // Step 2: Try to sign in (returning user)
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: phantomEmail,
        password,
      });

      if (signInData?.session) {
        console.log('[AuthService] Returning hospital patient signed in');
        return { success: true, isNewAccount: false };
      }

      // Step 3: If sign-in failed, create new account (first-time user)
      console.log('[AuthService] Creating new account for hospital patient');

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: phantomEmail,
        password,
        options: {
          data: {
            name: hospitalPatient.patient_name,
            role: 'patient',
            source: 'hospital_registration'
          }
        }
      });

      if (signUpError) {
        console.error('[AuthService] SignUp error:', signUpError);
        return { success: false, error: signUpError.message };
      }

      if (!signUpData.user) {
        return { success: false, error: 'Account creation failed' };
      }

      // Step 4: Create users table entry
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: signUpData.user.id,
          email: phantomEmail,
          name: hospitalPatient.patient_name,
          role: 'patient',
          beanhealth_id: hospitalPatient.beanhealth_id, // Transfer BHID from hospital record
        });

      if (profileError) {
        console.error('[AuthService] Profile creation error:', profileError);
        // Don't fail completely - auth account exists, profile can be retried
      }

      // Step 5: Link hospital_patients to new users account
      try {
        await (supabase.from('hospital_patients') as any)
          .update({ linked_user_id: signUpData.user.id })
          .eq('id', hospitalPatient.patient_id);

        // Create patient_hospital_links entry
        await (supabase.from('patient_hospital_links') as any)
          .insert({
            user_id: signUpData.user.id,
            hospital_id: (await supabase
              .from('hospital_patients')
              .select('hospital_id')
              .eq('id', hospitalPatient.patient_id)
              .single()).data?.hospital_id,
            hospital_patient_id: hospitalPatient.patient_id,
            local_mr_number: hospitalPatient.mr_number,
            linked_at: new Date().toISOString()
          });
      } catch (linkErr) {
        console.warn('[AuthService] Auto-link failed (non-critical):', linkErr);
      }

      // Step 6: If signUp didn't return a session, try signing in
      if (!signUpData.session) {
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email: phantomEmail,
          password,
        });
        if (retryError) {
          return { success: false, error: 'Account created but sign-in failed. Please try again.' };
        }
      }

      console.log('[AuthService] New hospital patient account created and signed in');
      return { success: true, isNewAccount: true };

    } catch (error: any) {
      console.error('[AuthService] Hospital patient auth failed:', error);
      return { success: false, error: error.message || 'Something went wrong' };
    }
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
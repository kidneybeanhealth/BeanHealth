import { supabase } from '../lib/supabase'
import { Patient, Doctor, User, UserRole } from '../types'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'

export class AuthService {
  // Google OAuth sign in
  static async signInWithGoogle() {
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

    if (error) throw error

    // On mobile, open browser manually
    if (Capacitor.isNativePlatform() && data?.url) {
      await Browser.open({ 
        url: data.url,
        presentationStyle: 'popover'
      })
    }

    return data
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
      // Check if user already exists
      const { data: existingUser, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userData.id)
        .single()

      // If user doesn't exist (selectError means no user found), create new user
      if (selectError && selectError.code === 'PGRST116') {
        // Create new user
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
          console.error('Insert error:', insertError);
          throw insertError;
        }
      } else if (existingUser) {
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
          console.error('Update error:', updateError);
          throw updateError;
        }
      } else if (selectError) {
        // Some other error occurred during select
        console.error('Select error:', selectError);
        throw selectError;
      }
    } catch (error) {
      console.error('Error in createOrUpdateProfile:', error);
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
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    })

    if (authError) throw authError

    if (authData.user) {
      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name: userData.name,
          role: userData.role,
          specialty: userData.specialty,
          date_of_birth: userData.dateOfBirth,
          condition: userData.condition,
        })

      if (profileError) throw profileError
    }

    return authData
  }

  static async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
    return data
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  static async getCurrentUser() {
    try {
      // First check if we have an active session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.error('Session error in getCurrentUser:', sessionError);
        throw sessionError;
      }
      
      if (!session?.user) {
        return null;
      }

      // Then try to get the user profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single()

      // If user doesn't exist in database, return null (they need to set up profile)
      if (error && error.code === 'PGRST116') {
        return null;
      }
      
      if (error) {
        console.error('Error fetching user profile:', error);
        throw error;
      }
      
      return profile;
    } catch (error) {
      console.error('Error in getCurrentUser:', error);
      
      // Don't throw network errors, return null instead
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        console.warn('Network error in getCurrentUser, returning null');
        return null;
      }
      
      // Only throw auth-related errors
      if (error?.message?.includes('JWT') || error?.message?.includes('expired') || error?.message?.includes('invalid')) {
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
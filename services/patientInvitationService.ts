import { supabase } from '../lib/supabase'
import { User } from '../types'

export class PatientAdditionService {
  // Search for existing patients by email
  static async searchPatients(email: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'patient')
      .ilike('email', `%${email}%`)
      .limit(10)

    if (error) throw error

    return data.map(user => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: null, // No longer use external avatar URLs
      avatar_url: null,
      specialty: user.specialty,
      dateOfBirth: user.date_of_birth,
      date_of_birth: user.date_of_birth,
      condition: user.condition,
      subscriptionTier: user.subscription_tier,
      subscription_tier: user.subscription_tier,
      urgentCredits: user.urgent_credits,
      urgent_credits: user.urgent_credits,
      trialEndsAt: user.trial_ends_at,
      trial_ends_at: user.trial_ends_at,
      notes: user.notes,
      created_at: user.created_at,
      updated_at: user.updated_at
    }))
  }

  // Get exact patient by email
  static async getPatientByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'patient')
      .eq('email', email)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
      avatarUrl: null, // No longer use external avatar URLs
      avatar_url: null,
      specialty: data.specialty,
      dateOfBirth: data.date_of_birth,
      date_of_birth: data.date_of_birth,
      condition: data.condition,
      subscriptionTier: data.subscription_tier,
      subscription_tier: data.subscription_tier,
      urgentCredits: data.urgent_credits,
      urgent_credits: data.urgent_credits,
      trialEndsAt: data.trial_ends_at,
      trial_ends_at: data.trial_ends_at,
      notes: data.notes,
      created_at: data.created_at,
      updated_at: data.updated_at
    }
  }

  // Add patient directly to doctor's roster
  static async addPatientToDoctor(patientId: string, doctorId: string): Promise<void> {
    // Check if relationship already exists
    const { data: existing, error: checkError } = await supabase
      .from('patient_doctor_relationships')
      .select('*')
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError
    }

    if (existing) {
      throw new Error('Patient is already in your roster')
    }

    // Create new relationship
    const { error } = await supabase
      .from('patient_doctor_relationships')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId
      })

    if (error) throw error
  }

  // Remove patient from doctor's roster
  static async removePatientFromDoctor(patientId: string, doctorId: string): Promise<void> {
    const { error } = await supabase
      .from('patient_doctor_relationships')
      .delete()
      .eq('patient_id', patientId)
      .eq('doctor_id', doctorId)

    if (error) throw error
  }

  // Get doctor's patients
  static async getDoctorPatients(doctorId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('patient_doctor_relationships')
      .select(`
        patient:users!patient_doctor_relationships_patient_id_fkey(*)
      `)
      .eq('doctor_id', doctorId)

    if (error) throw error

    return data.map(relationship => {
      const user = relationship.patient as any
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: null, // No longer use external avatar URLs
        avatar_url: null,
        specialty: user.specialty,
        dateOfBirth: user.date_of_birth,
        date_of_birth: user.date_of_birth,
        condition: user.condition,
        subscriptionTier: user.subscription_tier,
        subscription_tier: user.subscription_tier,
        urgentCredits: user.urgent_credits,
        urgent_credits: user.urgent_credits,
        trialEndsAt: user.trial_ends_at,
        trial_ends_at: user.trial_ends_at,
        notes: user.notes,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    })
  }

  // Get patient's doctors
  static async getPatientDoctors(patientId: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('patient_doctor_relationships')
      .select(`
        doctor:users!patient_doctor_relationships_doctor_id_fkey(*)
      `)
      .eq('patient_id', patientId)

    if (error) throw error

    return data.map(relationship => {
      const user = relationship.doctor as any
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: null, // No longer use external avatar URLs
        avatar_url: null,
        specialty: user.specialty,
        dateOfBirth: user.date_of_birth,
        date_of_birth: user.date_of_birth,
        condition: user.condition,
        subscriptionTier: user.subscription_tier,
        subscription_tier: user.subscription_tier,
        urgentCredits: user.urgent_credits,
        urgent_credits: user.urgent_credits,
        trialEndsAt: user.trial_ends_at,
        trial_ends_at: user.trial_ends_at,
        notes: user.notes,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    })
  }
}
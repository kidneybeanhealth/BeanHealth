import { supabase } from '../lib/supabase'
import { User } from '../types'

export class PatientAdditionService {
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

    return (data as any[]).map(relationship => {
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

    return (data as any[]).map(relationship => {
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